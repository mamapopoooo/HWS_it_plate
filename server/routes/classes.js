import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { classRefs } from '../utils/rosterRefs.js'

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
  // 只做首尾空格归一：「七年级1班」和「七年级1班␣」是同一个班，
  // 但「七年级 1 班」「七(1)班」按 Codex 口径不自动归并，仍各自成班。
  const name = String(req.body.name || '').trim()
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
  const students = db.prepare('SELECT * FROM students WHERE class_id = ? ORDER BY name').all(req.params.classId)
  res.json({ students })
})

// 更新班级
router.put('/:id', authMiddleware, (req, res) => {
  const name = String(req.body.name || '').trim()
  const classInfo = db.prepare('SELECT user_id FROM classes WHERE id = ?').get(req.params.id)

  if (!name) {
    return res.status(400).json({ error: '班级名不能为空' })
  }

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

  // 班里还有人就不能删：旧写法是把 students 一起删掉，
  // 那正好把这些人的 users 登录身份和游戏资产留在库里当孤儿。
  const links = classRefs(req.params.id)
  if (links.missingTables.length) {
    return res.status(409).json({
      error: `无法核对该班级下的名单与账号引用（缺 ${links.missingTables.join('、')} 表），旧接口不删；请先完成数据库迁移`,
      links
    })
  }
  if (links.students || links.identityRefs || links.battles) {
    const parts = []
    if (links.students) parts.push(`名单里还有 ${links.students} 名学生（${links.withIdentity} 人已有登录身份）`)
    if (links.identityRefs) parts.push(`${links.identityRefs} 个账号的班级档案还指向这里`)
    if (links.battles) parts.push(`${links.battles} 场班级战对阵挂在它上面`)
    return res.status(409).json({
      error: `这个班不能删：${parts.join('，')}。请先在教师端名单里转班、清理账号或结束相关赛事，再删班级`,
      links
    })
  }
  db.prepare('DELETE FROM classes WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
