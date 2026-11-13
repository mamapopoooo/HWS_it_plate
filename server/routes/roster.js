// 名单管理 API（v3）
// 前缀：/api/v3/roster，全部走 teacherMiddleware
//
// 设计约定（与 00-总纲 §名单统一 一致）：
//   students  = 花名册权威源（学号唯一，中英文名、性别、年级、班级、课程）
//   users     = 登录身份 + 游戏数据（username 恒等于学号）
//   姓名是账号、学号是密码，所以改学号等于改密码，必须同步 users.username。

import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db.js'
import { teacherMiddleware } from '../middleware/auth.js'
import { importRoster, parseGrade, planRoster, resolveGrade } from '../game/import-roster.js'
import { GARBLED_HINT, garbled, garbledRows } from '../utils/garbled.js'
// 级联表清单与引用盘点同源，见 server/utils/rosterRefs.js
import { USER_DATA_TABLES, studentRefs, purgeBlockReason } from '../utils/rosterRefs.js'

const router = Router()
router.use(teacherMiddleware)

// 乱码守卫见 server/utils/garbled.js：库里曾被 GBK 请求写坏过中文名和班级名。

function classIdOf(body) {
  const name = String(body.className || '').trim()
  if (body.classId) {
    const cls = db.prepare('SELECT id, name FROM classes WHERE id = ?').get(body.classId)
    if (!cls) return { error: '班级不存在' }
    // 表单可能同时带着「新选中的班级」和「残留的旧班级名」，静默取一个会把学生改到意外的班
    if (name && name !== cls.name) return { error: '不能同时指定两个班级，请只保留班级或只保留班级名' }
    return { classId: cls.id }
  }
  if (!name) return { classId: null }
  if (garbled(name)) return { error: GARBLED_HINT }
  const existing = db.prepare('SELECT id FROM classes WHERE name = ?').get(name)
  if (existing) return { classId: existing.id }
  const id = uuidv4()
  db.prepare('INSERT INTO classes (id, user_id, name, created_at, updated_at) VALUES (?, NULL, ?, ?, ?)')
    .run(id, name, Date.now(), Date.now())
  return { classId: id }
}

/**
 * 旧版自动建号写过 `stu_学号` 这种用户名，资产都挂在它身上。
 * 单条新增/改学号若撞上这类账号，就会造出「同一学生两条身份、资产各在一边」，
 * 批量导入已按同口径拒绝（见 import-roster.js），单条入口不能留缝。
 * @returns {string} 冲突说明，空串表示没冲突
 */
function legacyIdentityConflict(studentNo) {
  const prefixed = db.prepare('SELECT username, role FROM users WHERE username = ?').get(`stu_${studentNo}`)
  if (prefixed) return `旧账号 ${prefixed.username} 已存在，请先在名单里核对或处理它`
  if (studentNo.startsWith('stu_')) {
    const owner = db.prepare('SELECT 1 FROM students WHERE student_no = ?').get(studentNo.slice(4))
    if (owner) return `学号 ${studentNo} 与名单里另一名学生的旧前缀账号撞车`
  }
  return ''
}

// ========== 班级 ==========

router.get('/classes', (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.name, COUNT(s.id) AS studentCount, MAX(s.grade) AS grade
    FROM classes c
    LEFT JOIN students s ON s.class_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `).all()
  res.json({ classes: rows })
})

// ========== 名单查询 ==========

router.get('/students', (req, res) => {
  const { classId, grade, q } = req.query
  const where = []
  const params = []

  if (classId) { where.push('s.class_id = ?'); params.push(classId) }
  if (grade) { where.push('s.grade = ?'); params.push(Number(grade)) }
  if (q) {
    const key = `%${String(q).trim()}%`
    where.push('(s.name LIKE ? OR s.name_en LIKE ? OR s.student_no LIKE ?)')
    params.push(key, key, key)
  }

  const filter = where.length ? `WHERE ${where.join(' AND ')}` : ''
  const total = db.prepare(`SELECT COUNT(*) AS n FROM students s ${filter}`).get(...params).n

  const limit = Math.min(Number(req.query.limit) || 500, 1000)
  const offset = Number(req.query.offset) || 0

  // 别名和下面的映射一一对应：SELECT 用 AS 起别名，映射只读别名键，
  // 否则 r.game_points / r.last_login_at 这类原始列名在这里恒为 undefined，
  // 教师端会看到「所有人 0 积分、所有人未登录」这种看起来很正常的假数据。
  const students = db.prepare(`
    SELECT s.*, c.name AS className,
           u.id AS userId, u.game_points AS gamePoints, u.last_login_at AS lastLoginAt,
           t.level AS trainerLevel, t.title AS trainerTitle,
           (SELECT COUNT(*) FROM player_pets p WHERE p.user_id = u.id) AS petCount
    FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    LEFT JOIN users u ON u.username = s.student_no AND u.role = 'student'
    LEFT JOIN trainers t ON t.user_id = u.id
    ${filter}
    ORDER BY c.name, s.student_no
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset)

  res.json({
    total,
    students: students.map((r) => ({
      id: r.id,
      userId: r.userId,
      studentNo: r.student_no,
      name: r.name,
      nameEn: r.name_en,
      gender: r.gender,
      grade: r.grade,
      course: r.course,
      classId: r.class_id,
      className: r.className || '',
      totalPoints: r.total_points ?? 0,
      gamePoints: r.gamePoints ?? 0,
      trainerLevel: r.trainerLevel ?? 1,
      trainerTitle: r.trainerTitle || '',
      petCount: r.petCount ?? 0,
      loggedIn: !!r.lastLoginAt
    }))
  })
})

// ========== 单个新增 ==========

router.post('/students', (req, res) => {
  const studentNo = String(req.body.studentNo || '').trim()
  const name = String(req.body.name || '').trim()
  if (!studentNo || !name) {
    return res.status(400).json({ error: '学号和中文名必填' })
  }
  if (garbled(studentNo, name, req.body.nameEn)) {
    return res.status(400).json({ error: GARBLED_HINT })
  }
  if (db.prepare('SELECT 1 FROM students WHERE student_no = ?').get(studentNo)) {
    return res.status(409).json({ error: `学号 ${studentNo} 已存在` })
  }
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(studentNo)) {
    return res.status(409).json({ error: `学号 ${studentNo} 已被其他账号占用` })
  }
  const legacy = legacyIdentityConflict(studentNo)
  if (legacy) return res.status(409).json({ error: legacy })

  const cls = classIdOf(req.body)
  if (cls.error) return res.status(400).json({ error: cls.error })
  // students.class_id 是 NOT NULL：不拦的话这里会抛 500，教师只看到一个「请求失败（500）」
  if (!cls.classId) return res.status(400).json({ error: '新增学生需要选择或填写班级' })

  const nameEn = String(req.body.nameEn || '').trim()
  const gender = String(req.body.gender || '').trim()
  const course = String(req.body.course || '').trim()
  // 班级名一律从库里解析出来的那个班读：前端只选 classId 时 body.className 是空的，
  // 用它推年级会让「七年级1班」这种明显带年级的班也写成无年级。
  const className = db.prepare('SELECT name FROM classes WHERE id = ?').get(cls.classId)?.name || ''
  // 显式 grade=0 / 非数字一律视为「没给」，交给课程名和班级名推断；推不出来写 NULL，不写 0
  const grade = resolveGrade(req.body.grade, course, className, null)

  const now = Date.now()
  const id = uuidv4()
  const userId = uuidv4()

  db.transaction(() => {
    db.prepare(`
      INSERT INTO students (id, class_id, name, student_no, name_en, gender, grade, course, total_points, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(id, cls.classId, name, studentNo, nameEn, gender, grade, course, now)

    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, real_name, name_en, grade, class_id_ref,
                         is_guest, created_at, game_points, last_login_at)
      VALUES (?, ?, '', 'student', ?, ?, ?, ?, 0, ?, 0, NULL)
    `).run(userId, studentNo, name, nameEn, grade, cls.classId, now)

    db.prepare('INSERT INTO trainers (user_id) VALUES (?)').run(userId)
  })()

  res.json({ success: true, id, userId })
})

// ========== 修改（含改学号 = 改密码） ==========

router.put('/students/:id', (req, res) => {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id)
  if (!student) return res.status(404).json({ error: '学生不存在' })

  const nextNo = req.body.studentNo !== undefined ? String(req.body.studentNo).trim() : student.student_no
  const nextName = req.body.name !== undefined ? String(req.body.name).trim() : student.name
  if (!nextNo || !nextName) return res.status(400).json({ error: '学号和中文名不能为空' })
  if (garbled(nextNo, nextName, req.body.nameEn)) {
    return res.status(400).json({ error: GARBLED_HINT })
  }

  const dup = db.prepare('SELECT id FROM students WHERE student_no = ? AND id <> ?').get(nextNo, student.id)
  if (dup) return res.status(409).json({ error: `学号 ${nextNo} 已被其他学生占用` })

  const cls = classIdOf(req.body)
  if (cls.error) return res.status(400).json({ error: cls.error })
  const classId = cls.classId ?? student.class_id

  const nameEn = req.body.nameEn !== undefined ? String(req.body.nameEn).trim() : student.name_en
  const gender = req.body.gender !== undefined ? String(req.body.gender).trim() : student.gender
  const course = req.body.course !== undefined ? String(req.body.course).trim() : student.course
  const className = db.prepare('SELECT name FROM classes WHERE id = ?').get(classId)?.name || ''
  // 推不出年级时沿用库里原值，绝不把已有年级刷成 0
  const grade = resolveGrade(req.body.grade, course, className, student.grade)

  const user = db.prepare("SELECT id FROM users WHERE username = ? AND role = 'student'").get(student.student_no)
  // 改学号前先确认新学号没被别人占着，否则 username 唯一索引会炸
  if (nextNo !== student.student_no && db.prepare('SELECT 1 FROM users WHERE username = ?').get(nextNo)) {
    return res.status(409).json({ error: `学号 ${nextNo} 已有登录身份，请先处理` })
  }
  // 只在真的改学号时查前缀冲突：不动学号的编辑（改名、转班）不该被历史旧账号卡住
  if (nextNo !== student.student_no) {
    const legacy = legacyIdentityConflict(nextNo)
    if (legacy) return res.status(409).json({ error: legacy })
  }

  db.transaction(() => {
    db.prepare(`
      UPDATE students SET class_id = ?, name = ?, student_no = ?, name_en = ?, gender = ?, grade = ?, course = ?
      WHERE id = ?
    `).run(classId, nextName, nextNo, nameEn, gender, grade, course, student.id)

    if (user) {
      db.prepare(`
        UPDATE users SET username = ?, real_name = ?, name_en = ?, grade = ?, class_id_ref = ? WHERE id = ?
      `).run(nextNo, nextName, nameEn, grade, classId, user.id)
    }
  })()

  res.json({ success: true })
})

// ========== 删除 ==========

function purgeStudent(studentId) {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId)
  if (!student) return null

  const user = db.prepare("SELECT id FROM users WHERE username = ? AND role = 'student'").get(student.student_no)
  const removed = { userId: user?.id || null, dataRows: 0 }

  db.transaction(() => {
    if (user) {
      // 这两张不按 user_id 挂，得先单独清：斗法记录分左右两侧，造物图片挂在 custom_pets 之下
      // （图片必须在删 custom_pets 之前删，否则子查询查不到）
      removed.dataRows += db
        .prepare('DELETE FROM battle_records WHERE player_a_id = ? OR player_b_id = ?')
        .run(user.id, user.id).changes
      removed.dataRows += db
        .prepare('DELETE FROM custom_pet_images WHERE custom_pet_id IN (SELECT id FROM custom_pets WHERE user_id = ?)')
        .run(user.id).changes
      for (const table of USER_DATA_TABLES) {
        removed.dataRows += db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(user.id).changes
      }
      db.prepare('DELETE FROM users WHERE id = ?').run(user.id)
    }
    db.prepare('DELETE FROM badges WHERE student_id = ?').run(studentId)
    db.prepare('DELETE FROM evaluation_records WHERE student_id = ?').run(studentId)
    db.prepare('DELETE FROM students WHERE id = ?').run(studentId)
  })()

  return removed
}

router.delete('/students/:id', (req, res) => {
  if (req.body?.confirm !== true) {
    return res.status(400).json({ error: '删除会一并清除该生的宠物、抽卡和积分记录，需带 confirm=true' })
  }
  const student = db.prepare('SELECT id, student_no FROM students WHERE id = ?').get(req.params.id)
  if (!student) return res.status(404).json({ error: '学生不存在' })
  // purgeStudent 只认「username 恰等于学号」那一条身份。旧 stu_ 前缀账号或
  // 学号被非学生角色占用时照删，会把带资产的账号留下还报「已清理 N 行」，所以先预检。
  const refs = studentRefs(student.student_no)
  const reason = purgeBlockReason(refs)
  if (reason) return res.status(409).json({ error: reason, refs })
  const removed = purgeStudent(student.id)
  res.json({ success: true, ...removed })
})

// ========== 批量：移动班级 / 删除 ==========

router.post('/bulk', (req, res) => {
  const { action, ids } = req.body
  const list = Array.isArray(ids) ? ids.filter(Boolean) : []
  if (!list.length) return res.status(400).json({ error: '未选择学生' })

  if (action === 'move') {
    if (!req.body.classId && !parseGrade('', String(req.body.className || ''))) {
      return res.status(400).json({ error: '目标班级无法确定年级，请先完善班级信息' })
    }
    const cls = classIdOf(req.body)
    if (cls.error) return res.status(400).json({ error: cls.error })
    if (!cls.classId) return res.status(400).json({ error: '请选择目标班级' })

    const className = db.prepare('SELECT name FROM classes WHERE id = ?').get(cls.classId).name
    // 转班要同时改 students.grade：登录时 studentLogin 用 students 覆盖 users，
    // 只同步 users 的话，学生下次登录年级就被 students 的旧值带回去了。
    const move = db.prepare('UPDATE students SET class_id = ?, grade = ? WHERE id = ?')
    const sync = db.prepare("UPDATE users SET class_id_ref = ?, grade = ? WHERE username = ? AND role = 'student'")
    const findNo = db.prepare('SELECT student_no, grade, course FROM students WHERE id = ?')
    const classGrade = parseGrade('', className)
    if (!classGrade) return res.status(400).json({ error: '目标班级无法确定年级，请先完善班级信息' })

    let moved = 0
    db.transaction(() => {
      for (const id of list) {
        const s = findNo.get(id)
        if (!s) continue
        // 目标班级名优先，其次学生自己的课程名，最后沿用原值；三条路都推不出来就保持未知（NULL），不写 0
        const grade = classGrade > 0 ? classGrade : resolveGrade(undefined, s.course, '', s.grade)
        move.run(cls.classId, grade, id)
        sync.run(cls.classId, grade, s.student_no)
        moved += 1
      }
    })()
    return res.json({ success: true, action, moved })
  }

  if (action === 'delete') {
    if (req.body.confirm !== true) {
      return res.status(400).json({ error: '批量删除会清空这些学生的全部游戏数据，需带 confirm=true' })
    }
    const find = db.prepare('SELECT id, student_no FROM students WHERE id = ?')
    const targets = []
    const blocked = []
    const notFound = []
    // 先去重再预检：同一 id 传两次会在第二遍查不到学生，被当成「不存在」而不是「已删」
    for (const id of new Set(list)) {
      const student = find.get(id)
      if (!student) { notFound.push(id); continue }
      const refs = studentRefs(student.student_no)
      const reason = purgeBlockReason(refs)
      if (reason) blocked.push({ id, studentNo: student.student_no, reason, identityCount: refs.identities.length, assetRows: refs.assetRows })
      else targets.push(student)
    }
    // 全批预检通过才动手：旧写法一路 purge，第 3 个人被挡住时前 2 个人已经删完，
    // 教师看到的是一份被咬掉中间的名单，而且响应只说删了几个。
    if (blocked.length) {
      return res.status(409).json({
        error: `这批里有 ${blocked.length} 人不能安全删除，整批一行都没删。${blocked[0].reason}`,
        blocked, notFound
      })
    }
    let deleted = 0
    let dataRows = 0
    db.transaction(() => {
      for (const student of targets) {
        const removed = purgeStudent(student.id)
        if (removed) { deleted += 1; dataRows += removed.dataRows }
      }
    })()
    return res.json({ success: true, action, deleted, dataRows, notFound })
  }

  res.status(400).json({ error: `不支持的批量操作：${action}` })
})

// ========== 批量导入（xlsx 上传后由前端解析成行） ==========

router.post('/import', (req, res) => {
  const { rows, dryRun } = req.body
  if (!Array.isArray(rows) || !rows.length) {
    return res.status(400).json({ error: '表格里没有可导入的学生行' })
  }
  const badRows = garbledRows(rows)
  if (dryRun) {
    // 预演和实际写入跑同一个 planRoster：按列存在性判定新增/更新/无变化/拒绝，
    // 不再是「行数减一减等于更新数」那种估算，教师看到的数字就是提交后会发生的数字。
    // existingNos 是给前端逐行判定用的——前端的列表可能正被班级/关键词筛选着，
    // 只拿筛选结果判断会把库里已有的学生标成「新增」。
    const plan = planRoster(rows)
    return res.json({
      dryRun: true,
      total: rows.length,
      wouldCreate: plan.created,
      wouldUpdate: plan.updated,
      unchanged: plan.unchanged,
      invalid: plan.rejected.length,
      rejected: plan.rejected,
      rowPlans: plan.rowPlans,
      garbled: badRows,
      existingNos: plan.existingNos
    })
  }

  if (badRows) {
    return res.status(400).json({ error: `${GARBLED_HINT}，共 ${badRows} 行` })
  }

  const result = importRoster(rows)
  res.json({ success: true, ...result })
})

// ========== 重名检查：帮教师发现英文名撞车 ==========

router.get('/duplicate-names', (req, res) => {
  const english = db.prepare(`
    SELECT name_en AS name, COUNT(*) AS n, GROUP_CONCAT(student_no) AS studentNos
    FROM students WHERE name_en <> ''
    GROUP BY name_en HAVING COUNT(*) > 1 ORDER BY name_en
  `).all()
  const chinese = db.prepare(`
    SELECT name, COUNT(*) AS n, GROUP_CONCAT(student_no) AS studentNos
    FROM students GROUP BY name HAVING COUNT(*) > 1 ORDER BY name
  `).all()
  res.json({ english, chinese })
})

export default router
