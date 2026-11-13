import { verifyToken } from '../utils/token.js'
import { db } from '../db.js'

export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')

  // 支持游客 token
  if (token === 'guest') {
    const guestUser = db.prepare('SELECT id FROM users WHERE username = ? AND is_guest = 1').get('guest')
    if (guestUser) {
      req.userId = guestUser.id
      return next()
    }
    return res.status(401).json({ error: '游客用户不存在' })
  }

  const payload = verifyToken(token)

  if (!payload) {
    return res.status(401).json({ error: '未登录或登录已过期' })
  }

  req.userId = payload.userId
  next()
}

export function optionalAuthMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')

  // 支持游客 token
  if (token === 'guest') {
    const guestUser = db.prepare('SELECT id FROM users WHERE username = ? AND is_guest = 1').get('guest')
    if (guestUser) {
      req.userId = guestUser.id
    }
    return next()
  }

  const payload = verifyToken(token)

  if (payload) {
    req.userId = payload.userId
  }

  next()
}

// 教师端接口守卫：只认 users.role 里的管理角色，不认 v1 的 classes.user_id 归属
export function teacherMiddleware(req, res, next) {
  const payload = verifyToken(req.headers.authorization?.replace('Bearer ', ''))
  if (!payload) {
    return res.status(401).json({ error: '未登录或登录已过期' })
  }
  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(payload.userId)
  if (!user || !['admin', 'teacher'].includes(user.role)) {
    return res.status(403).json({ error: '需要教师权限' })
  }
  req.userId = user.id
  req.userRole = user.role
  next()
}
