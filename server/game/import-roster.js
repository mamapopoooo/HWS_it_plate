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
// 更新语义（教师端的真实诉求是每学年换一次名单，表格列不一定齐）：
//   - 只更新「这一列出现在表格里」的字段；列缺席 → 库里原值保留。
//   - 出现但空白的可选列（英文名/性别/课程/班级）同样保留，不做隐式清空；
//     教师真要清空某个字段走单个编辑（PUT /students/:id）。
//   - 预演（dryRun）与实际写入跑同一个 planRoster，杜绝「预演说改 252 人、实际只改 3 人」。

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

/**
 * 年级统一口径：显式有效值 > 从课程/班级名推断 > 保留原值 > null（未知）。
 * 绝不返回 0：0 不是任何年级，还会让按年级筛选和登录后的 users.grade 一起坏掉。
 */
export function resolveGrade(explicit, course, className, keep) {
  const n = Number(explicit)
  if (Number.isInteger(n) && n > 0) return n
  const parsed = parseGrade(course, className)
  if (parsed > 0) return parsed
  return knownGrade(keep)
}

/** 历史脏数据里的 grade=0 一律当作「未知」，避免把 0 又写回库里 */
export function knownGrade(grade) {
  const n = Number(grade)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** 姓名归一：去空格、转小写，用于中英文名的宽松比对 */
export function normalizeName(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase().trim()
}

// 表格里的可选文本列：[表格键, students 列, users 列]。users 没有性别/课程列，第二项留 null。
const OPTIONAL_COLUMNS = [
  ['nameEn', 'name_en', 'name_en'],
  ['gender', 'gender', null],
  ['course', 'course', null]
]

/** 列是否真的出现在表格里：键缺席 = 没这一列；值为 null/'' = 有列但单元格空着 */
function hasKey(row, key) {
  return !!row && Object.prototype.hasOwnProperty.call(row, key)
}

/** 取单元格文本，数字学号（Excel 常见）按字面转文本 */
function cellText(row, key) {
  const v = row?.[key]
  if (v === undefined || v === null) return ''
  return String(v).trim()
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
 * 单行 → 落库决策。只读，不写库，所以 dryRun 可以直接复用。
 * patch 的键是 students 的列名，班级例外用 class_name（因为要按需建班，不能提前写 id）。
 * @returns {{action:'create'|'update'|'unchanged'|'rejected', studentNo:string, reason?:string,
 *            patch:Object, existing:Object|null, userId:string|null}}
 */
function planRow(row) {
  const fail = (studentNo, reason, extra = {}) => ({
    action: 'rejected', studentNo, reason, patch: {}, existing: null, userId: null, ...extra
  })

  if (!row || typeof row !== 'object') return fail('', '表格行不是对象')

  const studentNo = cellText(row, 'studentNo')
  if (!hasKey(row, 'studentNo') || !studentNo) return fail(studentNo, '缺少学号列或学号为空')

  const existing = findStudentRow(studentNo)
  const identity = findIdentityRow(studentNo)
  if (identity && !existing) {
    // 有登录身份却不在名单里：自动建行会把资产悄悄挂到新用户身上，撞 username 唯一索引还会炸库
    return fail(studentNo, '该学号已有登录身份但不在名单里，请教师先核对该账号')
  }
  const userId = identity && identity.role === 'student' ? identity.id : null

  const patch = {}

  // 中文名必填：有列但空着就报错，students.name 是 NOT NULL，写空串等于把名字抹了
  if (hasKey(row, 'name')) {
    const name = cellText(row, 'name')
    if (!name) return fail(studentNo, '中文名列存在但为空', { existing, userId })
    if (name !== (existing?.name ?? '')) patch.name = name
  } else if (!existing) {
    return fail(studentNo, '新增学生必须有中文名', { existing, userId })
  }

  for (const [key, col] of OPTIONAL_COLUMNS) {
    if (!hasKey(row, key)) continue
    const value = cellText(row, key)
    if (!value) continue // 空白可选列：保留原值，不隐式清空
    const current = key === 'nameEn' ? existing?.nameEn : existing?.[key]
    if (value !== (current ?? '')) patch[col] = value
  }

  // 班级：有列且非空才动。空白的班级列不等于「把这个学生移出班级」，
  // 写 NULL 会撞 students.class_id NOT NULL（500），写 '' 会造出无班级的脏数据。
  let classWasGiven = false
  if (hasKey(row, 'class')) {
    const className = cellText(row, 'class')
    if (className) {
      classWasGiven = true
      if (className !== classNameById(existing?.classId)) patch.class_name = className
    }
  }

  // 新增学生必须有真实班级：不写 class_id=''，也不建空班
  if (!existing && !classWasGiven) return fail(studentNo, '新增学生必须有班级', { existing, userId })

  // 年级：显式列 > 课程/班级推断 > 沿用原值 > null，永不写 0
  const effectiveCourse = patch.course ?? existing?.course ?? ''
  const effectiveClass = patch.class_name ?? classNameById(existing?.classId)
  const grade = resolveGrade(
    hasKey(row, 'grade') ? row.grade : undefined,
    effectiveCourse,
    effectiveClass,
    existing?.grade
  )
  if (grade !== knownGrade(existing?.grade)) patch.grade = grade

  const action = existing ? (Object.keys(patch).length ? 'update' : 'unchanged') : 'create'
  return { action, studentNo, patch, existing, userId }
}

/**
 * 整表规划：dryRun 与实际写入共用的唯一判定入口。
 * @param {Array<Object>} rows
 * @returns {{plans:Array, created:number, updated:number, unchanged:number,
 *            rejected:Array<{index:number, studentNo:string, reason:string}>, existingNos:string[]}}
 */
export function planRoster(rows) {
  const list = Array.isArray(rows) ? rows : []
  const plans = []
  const summary = { created: 0, updated: 0, unchanged: 0, rejected: [], existingNos: [] }

  for (let i = 0; i < list.length; i++) {
    const plan = planRow(list[i])
    plans.push(plan)
    if (plan.action === 'rejected') {
      summary.rejected.push({ index: i, studentNo: plan.studentNo, reason: plan.reason })
      continue
    }
    if (plan.action === 'create') summary.created += 1
    else if (plan.action === 'update') summary.updated += 1
    else summary.unchanged += 1
    if (plan.existing) summary.existingNos.push(plan.studentNo)
  }
  return { plans, ...summary }
}

// patch 列名 → users 里的对应列；users 没有性别/课程列，不在表里就不镜像
const USER_COLUMN_OF = { name: 'real_name', name_en: 'name_en', grade: 'grade' }

function applyCreate(plan, now) {
  const classId = ensureClass(plan.patch.class_name)
  const name = plan.patch.name
  const nameEn = plan.patch.name_en ?? ''
  db.prepare(`
    INSERT INTO students (id, class_id, name, student_no, name_en, gender, grade, course, total_points, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(uuidv4(), classId, name, plan.studentNo, nameEn, plan.patch.gender ?? '',
    plan.patch.grade ?? null, plan.patch.course ?? '', now)

  db.prepare(`
    INSERT INTO users (id, username, password_hash, role, real_name, name_en, grade, class_id_ref,
                       is_guest, created_at, game_points, last_login_at)
    VALUES (?, ?, '', 'student', ?, ?, ?, ?, 0, ?, 0, NULL)
  `).run(uuidv4(), plan.studentNo, name, nameEn, plan.patch.grade ?? null, classId, now)
}

/** 只拼本次真正要改的列：缺席列不进 SET，也就不可能被写成空 */
function applyUpdate(plan) {
  const studentSet = []
  const studentArgs = []
  const userSet = []
  const userArgs = []

  for (const [col, value] of Object.entries(plan.patch)) {
    if (col === 'class_name') {
      const classId = ensureClass(value)
      studentSet.push('class_id = ?'); studentArgs.push(classId)
      if (plan.userId) { userSet.push('class_id_ref = ?'); userArgs.push(classId) }
      continue
    }
    studentSet.push(`${col} = ?`); studentArgs.push(value)
    const userCol = USER_COLUMN_OF[col]
    if (plan.userId && userCol) { userSet.push(`${userCol} = ?`); userArgs.push(value) }
  }

  // students 和 users 要一起改：登录时 studentLogin 用 students 覆盖 users，
  // 只改一边等于下次登录就被旧值回退回去。列名全部来自上面写死的白名单，不来自请求。
  if (studentSet.length) {
    db.prepare(`UPDATE students SET ${studentSet.join(', ')} WHERE student_no = ?`)
      .run(...studentArgs, plan.studentNo)
  }
  if (userSet.length) {
    db.prepare(`UPDATE users SET ${userSet.join(', ')} WHERE id = ?`).run(...userArgs, plan.userId)
  }
}

/**
 * @param {Array<{studentNo:string,name?:string,nameEn?:string,gender?:string,class?:string,course?:string,grade?:number}>} rows
 * @returns {{created:number,updated:number,unchanged:number,rejected:Array<{index:number,studentNo:string,reason:string}>}}
 */
export function importRoster(rows) {
  const { plans, created, updated, unchanged, rejected } = planRoster(rows)
  const now = Date.now()

  db.transaction(() => {
    for (const plan of plans) {
      if (plan.action === 'rejected' || plan.action === 'unchanged') continue
      if (plan.action === 'create') applyCreate(plan, now)
      else applyUpdate(plan)
    }
  })()

  return { created, updated, unchanged, rejected }
}
