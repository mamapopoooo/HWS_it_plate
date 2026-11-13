import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { calculateLevel } from '../utils/level.js'

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

  db.prepare('UPDATE students SET name = ?, student_no = ? WHERE id = ?').run(name, studentNo || null, req.params.id)
  res.json({ success: true })
})

// 删除学生
router.delete('/:id', authMiddleware, (req, res) => {
  // 验证学生归属
  const student = loadManageableStudent(req)

  if (!student) {
    return res.status(404).json({ error: '学生不存在或无权访问' })
  }

  // 先删除相关的评价记录
  db.prepare('DELETE FROM evaluation_records WHERE student_id = ?').run(req.params.id)
  // 再删除学生
  db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

// 批量导入学生
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

  const now = Date.now()
  const insertStmt = db.prepare('INSERT INTO students (id, class_id, name, student_no, total_points, pet_level, pet_exp, created_at) VALUES (?, ?, ?, ?, 0, 0, 0, ?)')

  let imported = 0
  for (const student of students) {
    if (student.name && student.name.trim()) {
      const id = uuidv4()
      insertStmt.run(id, classId, student.name.trim(), student.studentNo?.trim() || null, now)
      imported++
    }
  }

  res.json({ success: true, imported })
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
