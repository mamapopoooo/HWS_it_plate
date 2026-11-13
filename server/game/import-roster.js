// 名单导入：把「学号/中文名/英文名/性别/班级/课程」写进 students（花名册权威源），
// 并同步维护 users 里的登录身份行（username=学号），两端用学号打通。
//
// 三个入口共用这一个函数：
//   1. CLI 灌库（scripts/import-roster.mjs）
//   2. 教师端上传 xlsx（POST /api/students/import）
//   3. 教师端单个新增（POST /api/students）
//
// 幂等：按学号 upsert，重复执行不产生双份。

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

/** 姓名归一：去空格、转小写，用于中英文名的宽松比对 */
export function normalizeName(s) {
  return String(s || '').replace(/\s+/g, '').toLowerCase().trim()
}

function ensureClass(className) {
  const existing = db.prepare('SELECT id FROM classes WHERE name = ?').get(className)
  if (existing) return existing.id
  const id = uuidv4()
  db.prepare('INSERT INTO classes (id, user_id, name, created_at, updated_at) VALUES (?, NULL, ?, ?, ?)')
    .run(id, className, Date.now(), Date.now())
  return id
}

/**
 * @param {Array<{studentNo:string,name:string,nameEn?:string,gender?:string,class?:string,course?:string}>} rows
 * @returns {{created:number,updated:number,rejected:Array<{studentNo:string,reason:string}>}}
 */
export function importRoster(rows) {
  const result = { created: 0, updated: 0, rejected: [] }

  const findStudent = db.prepare('SELECT id FROM students WHERE student_no = ?')
  const insertStudent = db.prepare(`
    INSERT INTO students (id, class_id, name, student_no, name_en, gender, grade, course, total_points, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `)
  const updateStudent = db.prepare(`
    UPDATE students SET class_id = ?, name = ?, name_en = ?, gender = ?, grade = ?, course = ?
    WHERE student_no = ?
  `)
  const findUser = db.prepare("SELECT id FROM users WHERE username = ? AND role = 'student'")
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, password_hash, role, real_name, name_en, grade, class_id_ref,
                       is_guest, created_at, game_points, last_login_at)
    VALUES (?, ?, '', 'student', ?, ?, ?, ?, 0, ?, 0, NULL)
  `)
  const updateUser = db.prepare(`
    UPDATE users SET real_name = ?, name_en = ?, grade = ?, class_id_ref = ?
    WHERE username = ? AND role = 'student'
  `)

  const runOne = (r) => {
    const studentNo = String(r.studentNo || '').trim()
    const name = String(r.name || '').trim()

    if (!studentNo || !name) {
      result.rejected.push({ studentNo: studentNo || '(空)', reason: '学号或中文名为空' })
      return
    }
    const nameEn = String(r.nameEn || '').trim()
    const gender = String(r.gender || '').trim()
    const className = String(r.class || '').trim()
    const course = String(r.course || '').trim()
    const grade = parseGrade(course, className)

    const classId = className ? ensureClass(className) : null

    const known = findStudent.get(studentNo)
    if (known) {
      updateStudent.run(classId, name, nameEn, gender, grade, course, studentNo)
      result.updated += 1
    } else {
      insertStudent.run(uuidv4(), classId ?? '', name, studentNo, nameEn, gender, grade, course, Date.now())
      result.created += 1
    }

    // 登录身份行：学号已存在则只同步档案字段，绝不重置 game_points
    const user = findUser.get(studentNo)
    if (user) {
      updateUser.run(name, nameEn, grade, classId, studentNo)
    } else {
      insertUser.run(uuidv4(), studentNo, name, nameEn, grade, classId, Date.now())
    }
  }

  db.transaction(() => { for (const r of rows) runOne(r) })()

  return result
}
