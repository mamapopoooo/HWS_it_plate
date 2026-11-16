// @vitest-environment node
import { expect, it } from 'vitest'
import Database from 'better-sqlite3'
import { bootstrapAdmin } from './utils/bootstrapAdmin.js'
import { verifyPassword } from './utils/password.js'
it('首次建号必须显式凭据；已有管理员不重置；不覆盖占用身份', () => {
  const db = new Database(':memory:')
  try {
    db.exec('CREATE TABLE users(id TEXT,username TEXT UNIQUE,password_hash TEXT,role TEXT,real_name TEXT,is_guest INTEGER,created_at INTEGER)')
    expect(() => bootstrapAdmin(db, {})).toThrow('显式设置')
    expect(db.prepare('SELECT COUNT(*) n FROM users').get().n).toBe(0)
    expect(() => bootstrapAdmin(db, { ADMIN_USERNAME:'demo',ADMIN_PASSWORD:'short' })).toThrow()
    const env={ ADMIN_USERNAME:'demo',ADMIN_PASSWORD:'Only-for-tests-9284' }
    expect(bootstrapAdmin(db,env)).toBe(true)
    const hash=db.prepare('SELECT password_hash FROM users').get().password_hash
    expect(verifyPassword(env.ADMIN_PASSWORD,hash)).toBe(true)
    expect(bootstrapAdmin(db,{})).toBe(false)
    expect(db.prepare('SELECT password_hash FROM users').get().password_hash).toBe(hash)
    db.exec("UPDATE users SET role='student'")
    expect(() => bootstrapAdmin(db,env)).toThrow('占用')
  } finally { db.close() }
})
