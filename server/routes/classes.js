import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()

// v2/v3 起教师来自 users.role，班级也可能由名单导入自动建（user_id 为 NULL）。
// 因此：班级创建者或教师角色都算有权限。
function isTeacher(userId) {
  const u = db.prepare('SELECT role FROM users WHERE id = ?').get(userId)
  return !!u && ['admin', 'teacher'].includes(u.role)
}

function canManage(classInfo, userId) {
  return classInfo.user_id === userId || isTeacher(userId)
}

// 获取班级列表（教师看到全部班级，普通用户只看自己建的）
router.get('/', authMiddleware, (req, res) => {
  const classes = isTeacher(req.userId)
    ? db.prepare(`
        SELECT c.*, (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) AS studentCount
        FROM classes c ORDER BY c.name
      `).all()
    : db.prepare('SELECT * FROM classes WHERE user_id = ? ORDER BY created_at DESC').all(req.userId)
  res.json({ classes })
})

// 创建班级（关联当前用户）
router.post('/', authMiddleware, (req, res) => {
  const { name } = req.body
  const id = uuidv4()
  const now = Date.now()

  db.prepare('INSERT INTO classes (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, req.userId, name, now, now)

  res.json({ id, user_id: req.userId, name, created_at: now, updated_at: now })
})

// 获取班级学生列表
router.get('/:classId/students', authMiddleware, (req, res) => {
  const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.classId)
  if (!cls) {
    return res.status(404).json({ error: '班级不存在' })
  }
  if (!canManage(cls, req.userId)) {
    return res.status(403).json({ error: '无权访问此班级' })
  }
  // 旧字段只增不删：课堂累计仍保留，教师余额与HUD统一读取游戏账本。
  const students = db.prepare(`SELECT s.*, COALESCE(u.game_points,0) AS game_points
    FROM students s LEFT JOIN users u ON u.username=s.student_no AND u.role='student'
    WHERE s.class_id=? ORDER BY s.name`).all(req.params.classId)
  res.json({ students })
})

// 更新班级
router.put('/:id', authMiddleware, (req, res) => {
  const { name } = req.body
  const classInfo = db.prepare('SELECT user_id FROM classes WHERE id = ?').get(req.params.id)

  if (!classInfo) {
    return res.status(404).json({ error: '班级不存在' })
  }
  if (!canManage(classInfo, req.userId)) {
    return res.status(403).json({ error: '无权修改' })
  }

  const now = Date.now()
  db.prepare('UPDATE classes SET name = ?, updated_at = ? WHERE id = ?').run(name, now, req.params.id)
  res.json({ success: true })
})

// 删除班级
router.delete('/:id', authMiddleware, (req, res) => {
  const classInfo = db.prepare('SELECT user_id FROM classes WHERE id = ?').get(req.params.id)

  if (!classInfo) {
    return res.status(404).json({ error: '班级不存在' })
  }
  if (!canManage(classInfo, req.userId)) {
    return res.status(403).json({ error: '无权删除' })
  }

  // Delete students in this class first
  db.prepare('DELETE FROM students WHERE class_id = ?').run(req.params.id)
  db.prepare('DELETE FROM classes WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
