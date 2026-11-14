import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { calculateLevel } from '../utils/level.js'
import { studentRefs, studentDeletable, studentBlockReason } from '../utils/rosterRefs.js'
import { GARBLED_HINT, garbled } from '../utils/garbled.js'

const router = Router()

// v2/v3 起教师是 users.role='admin'，不再依赖 v1 的 classes.user_id 归属。
// 两种都放行：班级创建者，或管理员/教师。
function isTeacher(userId) {
  const u = db.prepare('SELECT role FROM users WHERE id = ?').get(userId)
  return !!u && ['admin', 'teacher'].includes(u.role)
}

function canManageClass(cls, userId) {
  return cls.user_id === userId || isTeacher(userId)
}

// 验证班级归属的中间件
function verifyClassOwnership(req, res, next) {
  const classId = req.params.classId || req.body.classId
  if (!classId) {
    return res.status(400).json({ error: '缺少班级ID' })
  }
  const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId)
  if (!cls) {
    return res.status(404).json({ error: '班级不存在' })
  }
  if (!canManageClass(cls, req.userId)) {
    return res.status(403).json({ error: '无权访问此班级' })
  }
  req.classId = classId
  next()
}

// 取学生并校验权限（v1 归属 或 教师角色）
function loadManageableStudent(req) {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id)
  if (!student) return null
  const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(student.class_id)
  if (cls && !canManageClass(cls, req.userId)) return null
  return student
}

// 获取班级学生列表
router.get('/classes/:classId/students', authMiddleware, verifyClassOwnership, (req, res) => {
  const students = db.prepare('SELECT * FROM students WHERE class_id = ? ORDER BY name').all(req.params.classId)
  res.json({ students })
})

// 添加学生
router.post('/', authMiddleware, (req, res) => {
  const { classId, name, studentNo } = req.body

  // 验证班级归属
  const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId)
  if (!cls) {
    return res.status(404).json({ error: '班级不存在' })
  }
  if (!canManageClass(cls, req.userId)) {
    return res.status(403).json({ error: '无权访问此班级' })
  }

  const id = uuidv4()
  const now = Date.now()
  db.prepare('INSERT INTO students (id, class_id, name, student_no, total_points, pet_level, pet_exp, created_at) VALUES (?, ?, ?, ?, 0, 0, 0, ?)')
    .run(id, classId, name, studentNo || null, now)
  res.json({ id, class_id: classId, name, student_no: studentNo || null, total_points: 0, pet_level: 0, pet_exp: 0, created_at: now })
})

// 更新学生
router.put('/:id', authMiddleware, (req, res) => {
  const { name, studentNo } = req.body

  // 验证学生归属
  const student = loadManageableStudent(req)

  if (!student) {
    return res.status(404).json({ error: '学生不存在或无权访问' })
  }

  // 没带的键保留原值（undefined 直接绑给 better-sqlite3 会抛异常崩成 500）
  const nextName = name === undefined ? student.name : String(name).trim()
  if (!nextName) return res.status(400).json({ error: '中文名不能为空' })
  // 学号就是登录名：这个旧入口只写 students，不动 users.username，
  // 一改学号就把身份和档案掰开，学生下次用新学号直接进不来。改名可以，改学号不行。
  const nextNo = studentNo === undefined ? student.student_no : String(studentNo).trim() || null
  if (nextNo !== (student.student_no || null)) {
    return res.status(409).json({
      error: '旧接口不能改学号（学号即登录名，改了就和学生账号脱钩），请到教师端「名单管理」修改'
    })
  }

  db.prepare('UPDATE students SET name = ?, student_no = ? WHERE id = ?').run(nextName, nextNo, req.params.id)
  res.json({ success: true })
})

// 删除学生
router.delete('/:id', authMiddleware, (req, res) => {
  // 验证学生归属
  const student = loadManageableStudent(req)

  if (!student) {
    return res.status(404).json({ error: '学生不存在或无权访问' })
  }

  // 没开外键，所以旧入口直接删主行会把登录身份和游戏资产留成孤儿。
  // 库里没有 foreign_keys 兜底，这一层检查就是唯一的闸。
  const refs = studentRefs(student.student_no)
  if (!studentDeletable(refs)) {
    const reason = studentBlockReason(refs)
    return res.status(409).json({
      error: reason
        ? `该学号还有${reason}，旧接口不删以免留下孤儿账号；请到教师端「名单管理」删除（带确认并同事务清理）`
        : '无法核对该学号的登录身份表，旧接口不删；请先完成数据库迁移',
      refs
    })
  }

  db.transaction(() => {
    db.prepare('DELETE FROM evaluation_records WHERE student_id = ?').run(req.params.id)
    db.prepare('DELETE FROM badges WHERE student_id = ?').run(req.params.id)
    db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id)
  })()
  res.json({ success: true })
})

// 批量导入学生
//
// 旧写法是循环里逐行 INSERT：既不查重也不开事务，撞上 idx_students_student_no
// 唯一索引就 500，而前面几行已经落库 —— 教师拿到的是一份被咬掉中间的名单，
// 重传又被「学号已存在」反复挡。这里改成「整批预检 → 一个事务落库」，
// 响应仍保留原来的 { success, imported }（只追加字段，不改语义）。
// 注意口径与 v3 /roster/import 不同：这个入口只认班级 + 姓名 + 学号三列，
// 不推年级、不建身份、不写 name_en/course，也不套用 v3 的「新生必须能推出年级」规则。
router.post('/import', authMiddleware, (req, res) => {
  const { classId, students } = req.body
  if (!classId || !students || !Array.isArray(students)) {
    return res.status(400).json({ error: 'Invalid input' })
  }

  // 验证班级归属
  const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId)
  if (!cls) {
    return res.status(404).json({ error: '班级不存在' })
  }
  if (!canManageClass(cls, req.userId)) {
    return res.status(403).json({ error: '无权访问此班级' })
  }

  const findStudentNo = db.prepare('SELECT id FROM students WHERE student_no = ?')
  const findIdentity = db.prepare('SELECT username, role FROM users WHERE username IN (?, ?)')
  const findPrefixedOwner = db.prepare('SELECT 1 FROM students WHERE student_no = ?')
  const malformed = []
  const conflicts = []
  const plans = []
  let skipped = 0

  students.forEach((row, index) => {
    // 行结构问题（不是对象、字段是对象/数组）：这类行连要写什么都读不出来，整批退回
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      malformed.push({ index, reason: '不是学生对象（应为 { name, studentNo }）' })
      return
    }
    const rawName = row.name === undefined || row.name === null ? '' : String(row.name).trim()
    const rawNo = row.studentNo === undefined || row.studentNo === null ? '' : String(row.studentNo).trim()
    // null / 缺键沿用旧行为（当成空），但 {} 或 [] 这类是类型错误，不能当成空白静默跳过
    const isObjectValue = (v) => v !== null && v !== undefined && typeof v === 'object'
    if (isObjectValue(row.name) || isObjectValue(row.studentNo)) {
      malformed.push({ index, reason: '姓名或学号不是文本' })
      return
    }
    // 空白姓名沿用旧行为：不算错误，也不写库（旧代码同样是跳过，只是不吭声）
    if (!rawName) { skipped += 1; return }
    if (garbled(rawName, rawNo)) {
      malformed.push({ index, reason: GARBLED_HINT })
      return
    }
    if (rawNo.startsWith('stu_') && findPrefixedOwner.get(rawNo.slice(4))) {
      conflicts.push({ index, studentNo: rawNo, reason: '这个学号形如另一名学生的旧前缀账号，写进去会让名单和账号对不上' })
      return
    }
    const dupInBatch = plans.some((p) => p.no && p.no === rawNo)
    if (dupInBatch) {
      conflicts.push({ index, studentNo: rawNo, reason: '同一份表格里这个学号出现多次，请合并成一行后重传' })
      return
    }
    if (rawNo && findStudentNo.get(rawNo)) {
      conflicts.push({ index, studentNo: rawNo, reason: '名单里已有这个学号（旧接口只做新增，不做覆盖更新）' })
      return
    }
    const taken = rawNo ? findIdentity.all(rawNo, `stu_${rawNo}`) : []
    if (taken.length) {
      conflicts.push({
        index, studentNo: rawNo,
        reason: `已有账号占用了这些用户名（${taken.map((u) => `${u.username}·${u.role}`).join('、')}），先核对身份再决定是否建人`
      })
      return
    }
    plans.push({ name: rawName, no: rawNo || null })
  })

  // 结构问题和冲突都不写任何一行：半批名单比一次失败更难收拾
  if (malformed.length) {
    return res.status(400).json({
      error: `表格里有 ${malformed.length} 行无法识别，整批未导入`,
      malformed: malformed.map((m) => ({ index: m.index, reason: m.reason }))
    })
  }
  if (conflicts.length) {
    return res.status(409).json({
      error: `表格里有 ${conflicts.length} 行与现有名单或账号冲突，整批未导入`,
      conflicts: conflicts.map((c) => ({ index: c.index, studentNo: c.studentNo, reason: c.reason }))
    })
  }

  const now = Date.now()
  const insertStmt = db.prepare('INSERT INTO students (id, class_id, name, student_no, total_points, pet_level, pet_exp, created_at) VALUES (?, ?, ?, ?, 0, 0, 0, ?)')

  let imported = 0
  // 事务里不 catch：数据库意外失败整批回滚，imported 不会把未提交行算成成功
  db.transaction(() => {
    for (const plan of plans) {
      insertStmt.run(uuidv4(), classId, plan.name, plan.no, now)
      imported += 1
    }
  })()

  res.json({ success: true, imported, skipped })
})

// 更新学生宠物
router.put('/:id/pet', authMiddleware, (req, res) => {
  const { petType } = req.body
  const now = Date.now()

  // 验证学生归属
  const student = loadManageableStudent(req)

  if (!student) {
    return res.status(404).json({ error: '学生不存在或无权访问' })
  }

  // If student already has a pet, create a badge for it if level is max
  if (student.pet_type && student.pet_level >= 7) {
    const badgeId = uuidv4()
    db.prepare('INSERT INTO badges (id, student_id, pet_type, earned_at) VALUES (?, ?, ?, ?)')
      .run(badgeId, req.params.id, student.pet_type, now)
  }

  // Update pet type and reset level/exp (选宠物后从1级开始)
  db.prepare('UPDATE students SET pet_type = ?, pet_level = 1, pet_exp = 0 WHERE id = ?')
    .run(petType, req.params.id)

  res.json({ success: true, petLevel: 1 })
})

export default router
