import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { generateToken } from '../utils/token.js'
import { authMiddleware } from '../middleware/auth.js'
import { ensureUserColumns } from '../utils/userSchema.js'

import { createStudentLogin, toPublicUser as publicUser } from '../utils/studentLogin.js'

const router = Router()

// 老库补列（role / real_name / grade），登录与路由守卫都依赖 role
ensureUserColumns()

/** 统一的用户返回结构，字段名与前端 src/api/types.ts 对齐 */
function toPublicUser(row) { return publicUser(db, row) }

// 注册（教师自助注册，注册出来就是管理员）
router.post('/register', (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' })
  }
  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: '用户名长度3-20字符' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码至少6位' })
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (existingUser) {
    return res.status(400).json({ error: '用户名已存在' })
  }

  const userId = uuidv4()
  db.prepare(
    'INSERT INTO users (id, username, password_hash, is_guest, role, real_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(userId, username, hashPassword(password), 0, 'admin', username, Date.now())

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  res.json({ success: true, token: generateToken(userId), user: toPublicUser(row) })
})

/**
 * 教师登录（前端 POST /api/auth/admin/login）
 * 账号 + 密码 → 返回带 role='admin' 的用户
 */
router.post('/admin/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: '账号和密码不能为空' })
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: '账号或密码错误' })
  }
  if ((user.role || 'admin') !== 'admin') {
    return res.status(403).json({ error: '这是学生账号，请用学号在「学生登录」进入' })
  }

  res.json({ success: true, token: generateToken(user.id), user: toPublicUser(user) })
})

/**
 * 学生登录（前端 POST /api/auth/student/login）
 * 学号 + 姓名免密：匹配 students 表，首次登录自动为其建一条 users 记录。
 */
router.post('/student/login', createStudentLogin(db))

// 旧登录入口（兼容 v1 页面调用）
router.post('/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' })
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username)
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: '用户名或密码错误' })
  }

  res.json({ success: true, token: generateToken(user.id), user: toPublicUser(user) })
})

// 获取当前用户信息
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId)
  if (!user) {
    return res.status(404).json({ error: '用户不存在' })
  }
  res.json({ user: toPublicUser(user) })
})

export default router
