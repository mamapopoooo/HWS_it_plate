// 名单导入：把「学号/中文名/英文名/性别/班级/课程」写进 students（花名册权威源），
// 并同步维护 users 里的登录身份行（username=学号），两端用学号打通。
//
// 三个入口共用这一个函数：
//   1. CLI 灌库（scripts/import-roster.mjs）
//   2. 教师端上传表格（POST /api/v3/roster/import，含 dryRun 预演）
//   3. 其他批量调用方
//
// 幂等：按学号 upsert，重复执行不产生双份。
//
// 契约：docs/名单导入契约-Codex-20261113.md（S2 实施契约）
//   - 只更新「这一列出现在表格里、有效、且与库里现值不同」的字段；键缺席或空白 → 保留原值，进 skipFields，
//     空白还要给 warning，绝不做隐式清空（故意清空走单条编辑）。
//   - 年级只从有效班级名/课程名推导，不接受表格里的 grade 猜测值；推不出就保持未知（NULL），永不写 0。
//   - 预演（dryRun）与实际写入跑同一个规划函数，rowPlans 逐行给出写/跳/警/错。
//   - 同一批里重复的学号整批拒绝，不玩「后行覆盖前行」。

import { db } from '../db.js'
import { v4 as uuidv4 } from 'uuid'

/** 从「六年级A班」/「信息技术 G6」里取出 6 或 7，取不到返回 0 */
export function parseGrade(course, className) {
  const m = String(course || '').match(/G\s*(\d)/)
  if (m) return Number(m[1])
  const c = String(className || '').match(/([六七八九])年级/)
  if (c) return ({ 六: 6, 七: 7, 八: 8, 九: 9 })[c[1]] || 0
  return 0
}

/** 历史脏数据里的 grade=0 一律当作「未知」，避免把 0 又写回库里 */
export function knownGrade(grade) {
  const n = Number(grade)
  return Number.isInteger(n) && n > 0 ? n : null
}

/**
 * 年级统一口径：显式有效值 > 从课程/班级名推断 > 保留原值 > null（未知）。
 * 只给单条编辑用；批量导入不接受表格里的 grade。
 */
export function resolveGrade(explicit, course, className, keep) {
  const n = Number(explicit)
  if (Number.isInteger(n) && n > 0) return n
  const parsed = parseGrade(course, className)
  if (parsed > 0) return parsed
  return knownGrade(keep)
}

/** 姓名归一：去空格、转小写，用于中英文名的宽松比对 */
export function normalizeName(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase().trim()
}

// 契约里的五个可更新列：code 给 rowPlans 用，col 是 students 的列，userCol 是 users 的对应列。
// users 没有性别/课程列，所以那两项不镜像；class 存的是班级名，落库时再解析成 id。
const IMPORT_FIELDS = [
  { code: 'name', label: '中文名', col: 'name', userCol: 'real_name' },
  { code: 'nameEn', label: '英文名', col: 'name_en', userCol: 'name_en' },
  { code: 'gender', label: '性别', col: 'gender', userCol: null },
  { code: 'class', label: '班级', col: 'class_name', userCol: 'class_id_ref' },
  { code: 'course', label: '课程', col: 'course', userCol: null }
]

/** 列是否真的出现在表格里：键缺席 = 没这一列；值为 null/'' = 有列但单元格空着 */
function hasKey(row, key) {
  return !!row && Object.prototype.hasOwnProperty.call(row, key)
}

// findStudentRow 把 students 的列起了驼峰别名，比对现值时按这个映射取值；class 存班级名，另走查询。
const ROW_KEY_OF = { name: 'name', nameEn: 'nameEn', gender: 'gender', course: 'course' }

/** 单元格取文本；数字学号（Excel 常见）按字面转文本，对象/数组算类型错误 */
function cellOf(row, key) {
  if (!hasKey(row, key)) return { present: false, value: '', badType: false }
  const v = row[key]
  if (v === undefined || v === null) return { present: true, value: '', badType: false }
  if (typeof v === 'object') return { present: true, value: '', badType: true }
  return { present: true, value: String(v).trim(), badType: false }
}

function classIdByName(className) {
  if (!className) return null
  return db.prepare('SELECT id FROM classes WHERE name = ?').get(className)?.id ?? null
}

function classNameById(classId) {
  if (!classId) return ''
  return db.prepare('SELECT name FROM classes WHERE id = ?').get(classId)?.name || ''
}

function ensureClass(className) {
  const existing = classIdByName(className)
  if (existing) return existing
  const id = uuidv4()
  db.prepare('INSERT INTO classes (id, user_id, name, created_at, updated_at) VALUES (?, NULL, ?, ?, ?)')
    .run(id, className, Date.now(), Date.now())
  return id
}

const findStudentRow = (studentNo) => db.prepare(`
  SELECT id, class_id AS classId, name, name_en AS nameEn, gender, grade, course
  FROM students WHERE student_no = ?
`).get(studentNo)

const findIdentityRow = (studentNo) => db.prepare('SELECT id, role FROM users WHERE username = ?').get(studentNo)

/**
 * 单行 → 计划。只读，不写库，所以 dryRun 可以直接复用。
 * @param {Object} row 表格行
 * @param {boolean} duplicated 同一批里这个学号是否出现多次
 */
function planRow(row, duplicated) {
  const plan = {
    studentNo: '', action: 'reject', writeFields: [], skipFields: [], warnings: [], errors: [],
    writes: {}, existing: null, userId: null
  }
  const reject = (reason) => {
    plan.errors.push(reason)
    return plan
  }

  if (!row || typeof row !== 'object') return reject('表格行不是对象')

  const no = cellOf(row, 'studentNo')
  if (no.badType) return reject('学号列类型错误，无法定位学生')
  plan.studentNo = no.value
  if (!no.present || !no.value) return reject('缺少学号列或学号为空')
  // 同批重复：整批跳过，绝不「后行覆盖前行」，否则教师看到的行数和对不上
  if (duplicated) return reject('同一份表格里这个学号出现多次，请合并成一行后重传')

  const existing = findStudentRow(no.value)
  const identity = findIdentityRow(no.value)
  if (identity && !existing) {
    // 有登录身份却不在名单里：自动建行会把资产悄悄挂到新身份上，还会撞 username 唯一索引
    return reject('该学号已有登录身份但不在名单里，请教师先核对该账号')
  }
  plan.existing = existing ?? null
  plan.userId = identity && identity.role === 'student' ? identity.id : null

  for (const field of IMPORT_FIELDS) {
    const cell = cellOf(row, field.code)
    if (cell.badType) {
      plan.errors.push(`${field.label}列类型错误，无法写入`)
      continue
    }
    if (!cell.present) {
      plan.skipFields.push(field.code)
      if (!existing && (field.code === 'name' || field.code === 'class')) {
        plan.errors.push(`新增学生必须有${field.label}`)
      }
      continue
    }
    if (!cell.value) {
      plan.skipFields.push(field.code)
      plan.warnings.push(`${field.label}列为空，本次保留原值`)
      if (!existing && (field.code === 'name' || field.code === 'class')) {
        plan.errors.push(`新增学生必须有${field.label}`)
      }
      continue
    }
    // 和库里现值相同就不进写入列表：学年名单反复上传时，教师看到的必须是「无变化」而不是「更新 252 人」。
    if (existing && cell.value === (field.code === 'class'
      ? classNameById(existing.classId)
      : existing[ROW_KEY_OF[field.code]] ?? '')) {
      plan.skipFields.push(field.code)
      continue
    }
    plan.writeFields.push(field.code)
    plan.writes[field.col] = cell.value
  }

  if (plan.errors.length) {
    plan.writeFields = []
    return plan
  }

  // 年级：只看生效后的班级名和课程名，表格里给不给 grade 都不采信
  const effectiveCourse = plan.writes.course ?? existing?.course ?? ''
  const effectiveClass = plan.writes.class_name ?? classNameById(existing?.classId)
  const derived = parseGrade(effectiveCourse, effectiveClass)
  if (derived > 0) {
    if (derived !== knownGrade(existing?.grade)) {
      plan.writes.grade = derived
      if (existing) plan.warnings.push(`年级按班级或课程校正为 ${derived} 年级`)
    }
  } else if (!existing) {
    plan.errors.push('无法从班级或课程确定年级，请补全「班级」（如七年级B班）或「课程」（如信息技术 G7）后重传')
    plan.writeFields = []
    return plan
  } else if (knownGrade(existing.grade) === null && plan.writeFields.length) {
    plan.warnings.push('班级和课程都推不出年级，该生年级保持为未知（不会写成 0）')
  }

  plan.action = existing ? 'update' : 'create'
  if (existing && !Object.keys(plan.writes).length) plan.warnings.push('本次没有需要更新的列，档案保持原样')
  return plan
}

/**
 * 整表规划：dryRun 与实际写入共用的唯一判定入口。
 * @param {Array<Object>} rows
 * @returns {{plans:Array, created:number, updated:number, unchanged:number,
 *            rejected:Array<{studentNo:string, reason:string}>, rowPlans:Array, existingNos:string[]}}
 */
export function planRoster(rows) {
  const list = Array.isArray(rows) ? rows : []
  const seen = new Map()
  for (const row of list) {
    const no = cellOf(row, 'studentNo').value
    if (no) seen.set(no, (seen.get(no) || 0) + 1)
  }

  const plans = []
  const summary = { created: 0, updated: 0, unchanged: 0, rejected: [], rowPlans: [], existingNos: [] }
  for (const row of list) {
    const no = cellOf(row, 'studentNo').value
    const plan = planRow(row, !!no && seen.get(no) > 1)
    plans.push(plan)
    summary.rowPlans.push({
      studentNo: plan.studentNo,
      action: plan.action,
      writeFields: plan.writeFields,
      skipFields: plan.skipFields,
      warnings: plan.warnings,
      errors: plan.errors
    })
    if (plan.action === 'reject') {
      summary.rejected.push({ studentNo: plan.studentNo, reason: plan.errors[0] })
      continue
    }
    if (plan.action === 'create') summary.created += 1
    else if (Object.keys(plan.writes).length) summary.updated += 1
    else summary.unchanged += 1
    if (plan.existing) summary.existingNos.push(plan.studentNo)
  }
  return { plans, ...summary }
}

function applyCreate(plan, now) {
  const classId = ensureClass(plan.writes.class_name)
  const name = plan.writes.name
  const nameEn = plan.writes.name_en ?? ''
  const grade = knownGrade(plan.writes.grade) ?? null
  db.prepare(`
    INSERT INTO students (id, class_id, name, student_no, name_en, gender, grade, course, total_points, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(uuidv4(), classId, name, plan.studentNo, nameEn, plan.writes.gender ?? '',
    grade, plan.writes.course ?? '', now)

  db.prepare(`
    INSERT INTO users (id, username, password_hash, role, real_name, name_en, grade, class_id_ref,
                       is_guest, created_at, game_points, last_login_at)
    VALUES (?, ?, '', 'student', ?, ?, ?, ?, 0, ?, 0, NULL)
  `).run(uuidv4(), plan.studentNo, name, nameEn, grade, classId, now)
}

/** 只拼本次真正要写的列：缺席列和空白列都不进 SET，也就不可能被写成空 */
function applyUpdate(plan) {
  const studentSet = []
  const studentArgs = []
  const userSet = []
  const userArgs = []

  for (const field of IMPORT_FIELDS) {
    const value = plan.writes[field.col]
    if (value === undefined) continue
    if (field.code === 'class') {
      const classId = ensureClass(value)
      studentSet.push('class_id = ?'); studentArgs.push(classId)
      if (plan.userId) { userSet.push('class_id_ref = ?'); userArgs.push(classId) }
      continue
    }
    studentSet.push(`${field.col} = ?`); studentArgs.push(value)
    if (plan.userId && field.userCol) {
      userSet.push(`${field.userCol} = ?`); userArgs.push(value)
    }
  }
  if ('grade' in plan.writes) {
    const grade = knownGrade(plan.writes.grade) ?? null
    studentSet.push('grade = ?'); studentArgs.push(grade)
    if (plan.userId) { userSet.push('grade = ?'); userArgs.push(grade) }
  }

  // students 和 users 要一起改：登录时 studentLogin 用 students 覆盖 users，
  // 只改一边等于下次登录就被旧值回退。列名全部来自上面的写死白名单，不来自请求。
  if (studentSet.length) {
    db.prepare(`UPDATE students SET ${studentSet.join(', ')} WHERE student_no = ?`)
      .run(...studentArgs, plan.studentNo)
  }
  if (userSet.length) {
    db.prepare(`UPDATE users SET ${userSet.join(', ')} WHERE id = ?`).run(...userArgs, plan.userId)
  }
}

/**
 * @param {Array<{studentNo:string,name?:string,nameEn?:string,gender?:string,class?:string,course?:string}>} rows
 * @returns {{created:number,updated:number,unchanged:number,
 *            rejected:Array<{studentNo:string,reason:string}>, rowPlans:Array}}
 */
export function importRoster(rows) {
  const { plans, created, updated, unchanged, rejected, rowPlans } = planRoster(rows)
  const now = Date.now()

  // 意外失败整批回滚：这里不 catch，让调用方拿到真实错误，绝不把未提交行计成成功
  db.transaction(() => {
    for (const plan of plans) {
      if (plan.action === 'reject') continue
      if (plan.action === 'create') applyCreate(plan, now)
      else applyUpdate(plan)
    }
  })()

  return { created, updated, unchanged, rejected, rowPlans }
}
