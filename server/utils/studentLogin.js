import { v4 as uuidv4 } from 'uuid'
import { generateToken } from './token.js'

export function toPublicUser(db, row) {
  return {
    id: row.id,
    username: row.username,
    realName: row.real_name || row.username,
    nameEn: row.name_en || '',
    role: row.role || 'student',
    grade: row.grade ?? null,
    isGuest: !!row.is_guest,
    gamePoints: row.game_points ?? 0,
    className: row.class_id_ref
      ? db.prepare('SELECT name FROM classes WHERE id = ?').get(row.class_id_ref)?.name || ''
      : '',
  }
}

/** 两个登录入口共用名单校验与事务，旧身份冲突交人工核对，不自动合并资产。 */
export function createStudentLogin(db) {
  const normalize = (value) => String(value ?? '').replace(/\s+/g, '').toLowerCase()
  const login = db.transaction((studentNo, inputName) => {
    const matches = db.prepare('SELECT * FROM students WHERE student_no = ?').all(studentNo)
    if (!matches.length) return { status: 401, error: '名单里没有这个学号，请核对后重试或找老师' }
    if (matches.length !== 1) return { status: 409, error: '名单学号重复，请找老师核对' }
    const student = matches[0]
    const typed = normalize(inputName)
    if (![student.name, student.name_en].some(name => normalize(name) && normalize(name) === typed)) {
      return { status: 401, error: '姓名和学号对不上，请找老师核对名单' }
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(studentNo)
    const legacy = db.prepare('SELECT id FROM users WHERE username = ?').get(`stu_${studentNo}`)
    // 真实学号也可能以stu_开头，不能认领另一名册学生的旧前缀账号。
    const namespaceConflict = studentNo.startsWith('stu_') &&
      db.prepare('SELECT 1 FROM students WHERE student_no = ?').get(studentNo.slice(4))
    if (legacy || namespaceConflict || (user && (user.role !== 'student' || user.is_guest))) {
      return { status: 409, error: '登录身份需要核对，请找老师处理，原有积分和宠物不会被合并或清除' }
    }
    const now = Date.now()
    const userId = user?.id || uuidv4()
    if (user) {
      db.prepare(`UPDATE users SET real_name = ?, name_en = ?, grade = ?, class_id_ref = ?, last_login_at = ?
        WHERE id = ?`).run(student.name, student.name_en || '', student.grade, student.class_id, now, userId)
    } else {
      db.prepare(`INSERT INTO users
        (id, username, password_hash, role, real_name, name_en, grade, class_id_ref, is_guest, created_at, game_points, last_login_at)
        VALUES (?, ?, '', 'student', ?, ?, ?, ?, 0, ?, 0, ?)`)
        .run(userId, studentNo, student.name, student.name_en || '', student.grade, student.class_id, now, now)
    }
    db.prepare('INSERT OR IGNORE INTO trainers (user_id) VALUES (?)').run(userId)
    return { user: toPublicUser(db, db.prepare('SELECT * FROM users WHERE id = ?').get(userId)) }
  })

  return (req, res) => {
    const studentNo = typeof req.body?.studentNo === 'string' ? req.body.studentNo.trim() : ''
    const name = typeof req.body?.realName === 'string' ? req.body.realName.trim() : ''
    if (!studentNo || !normalize(name)) return res.status(400).json({ error: '请输入学号和姓名' })
    const result = login(studentNo, name)
    if (result.error) return res.status(result.status).json({ error: result.error })
    return res.json({ success: true, token: generateToken(result.user.id), user: result.user })
  }
}
