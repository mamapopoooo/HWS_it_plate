import { db } from '../db.js'

/**
 * 确保 users 表具备 v3 需要的列（role / real_name / grade）。
 *
 * 背景：v1 的建表语句里没有 role，后来的迁移只在「表还不存在」时才建带 role 的表，
 * 已有库不会自动补列。这里统一做一次幂等补齐，登录与路由守卫都依赖 role。
 *
 * 注意：本函数可能在 initDb() 之前被 import 触发，此时表还不存在，直接跳过。
 */
export function ensureUserColumns() {
  const exists = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'")
    .get()
  if (!exists) return

  const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name)
  const wanted = [
    ['role', "TEXT DEFAULT 'student'"],
    ['real_name', 'TEXT'],
    ['grade', 'INTEGER'],
  ]
  for (const [name, ddl] of wanted) {
    if (!cols.includes(name)) {
      db.prepare(`ALTER TABLE users ADD COLUMN ${name} ${ddl}`).run()
      console.log(`✓ users 表补列: ${name}`)
    }
  }
}
