import { randomUUID } from 'node:crypto'
import { hashPassword } from './password.js'

export function bootstrapAdmin(db, env = process.env) {
  if (db.prepare("SELECT 1 FROM users WHERE role='admin'").get()) return false
  const name = env.ADMIN_USERNAME?.trim()
  const password = env.ADMIN_PASSWORD
  if (!name || !password || password.length < 12 || !/[a-zA-Z]/.test(password) || !/[^a-zA-Z]/.test(password)) {
    throw new Error('首次初始化需显式设置ADMIN_USERNAME和至少12位含字母及其他字符的ADMIN_PASSWORD')
  }
  if (db.prepare('SELECT 1 FROM users WHERE username=?').get(name)) throw new Error('初始化管理员用户名已被占用')
  db.prepare(`INSERT INTO users(id,username,password_hash,role,real_name,is_guest,created_at)
    VALUES(?,?,?,'admin','管理员',0,?)`).run(randomUUID(), name, hashPassword(password), Date.now())
  return true
}
