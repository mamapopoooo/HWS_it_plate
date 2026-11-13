// @vitest-environment node
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import { verifyToken } from './utils/token.js'

let db, server, base
beforeAll(async () => {
  db = new Database(':memory:')
  db.exec(`
    CREATE TABLE classes (id TEXT PRIMARY KEY, name TEXT);
    CREATE TABLE students (id TEXT PRIMARY KEY, student_no TEXT, name TEXT, name_en TEXT, grade INTEGER, class_id TEXT);
    CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT, role TEXT,
      real_name TEXT, name_en TEXT, grade INTEGER, class_id_ref TEXT, is_guest INTEGER, created_at INTEGER,
      game_points INTEGER DEFAULT 0, last_login_at INTEGER);
    CREATE TABLE trainers (user_id TEXT PRIMARY KEY);
  `)
  // 路由只访问内存库，禁止导入真实 server/pet-garden.db。
  vi.doMock('./db.js', () => ({ db }))
  const auth = (await import('./routes/auth.js')).default
  const game = (await import('./routes/game-v2.js')).default
  const app = express()
  app.use(express.json())
  app.use('/api/auth', auth)
  app.use('/api/v2', game)
  server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})
beforeEach(() => {
  db.exec(`DELETE FROM trainers; DELETE FROM users; DELETE FROM students; DELETE FROM classes;
    INSERT INTO classes VALUES ('class-demo', '示例班');
    INSERT INTO students VALUES ('roster-demo', '0001', '示例学生', 'Demo Name', 7, 'class-demo');`)
})
afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve))
  db?.close()
  vi.doUnmock('./db.js')
})
async function login(path, studentNo = '0001', realName = '示例学生') {
  const res = await fetch(`${base}${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentNo, realName }),
  })
  return { status: res.status, data: await res.json() }
}
const paths = ['/api/auth/student/login', '/api/v2/auth/student/login']
describe.each(paths)('%s 名单认证', path => {
  it('接受中英文姓名并保留前导零，两入口复用同一身份', async () => {
    const first = await login(path)
    const second = await login(paths.find(p => p !== path), '0001', '  dEmO   NAME ')
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(second.data.user).toMatchObject({ id: first.data.user.id, username: '0001', grade: 7, className: '示例班' })
    expect(verifyToken(second.data.token).userId).toBe(first.data.user.id)
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get().n).toBe(1)
    expect(db.prepare('SELECT COUNT(*) AS n FROM trainers').get().n).toBe(1)
  })
  it('未知学号即使姓名正确也不能按姓名回落，错误姓名拒绝', async () => {
    expect((await login(path, '9999')).status).toBe(401)
    expect((await login(path, '0001', '错误姓名')).status).toBe(401)
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get().n).toBe(0)
  })
  it('空白及非字符串凭据拒绝', async () => {
    expect((await login(path, '0001', '  ')).status).toBe(400)
    expect((await login(path, 1)).status).toBe(400)
  })
  it('登录保留原用户id与积分，两个me响应一致', async () => {
    db.prepare(`INSERT INTO users (id,username,role,game_points) VALUES ('existing-demo','0001','student',73)`).run()
    const result = await login(path)
    expect(result.data.user).toMatchObject({ id: 'existing-demo', gamePoints: 73 })
    const responses = await Promise.all(['/api/auth/me', '/api/v2/auth/me'].map(async url => {
      const res = await fetch(base + url, { headers: { Authorization: `Bearer ${result.data.token}` } })
      return res.json()
    }))
    expect(responses[0]).toEqual(responses[1])
  })
  it('旧前缀身份不自动创建第二条或迁移资产', async () => {
    db.prepare(`INSERT INTO users (id,username,role,game_points) VALUES ('legacy-demo','stu_0001','student',81)`).run()
    expect((await login(path)).status).toBe(409)
    expect(db.prepare('SELECT id, username, game_points FROM users').all()).toEqual([
      { id: 'legacy-demo', username: 'stu_0001', game_points: 81 },
    ])
  })
  it('双身份、教师账号占用与重复名单阻止自动认领', async () => {
    db.prepare(`INSERT INTO users (id,username,role) VALUES ('admin-demo','0001','admin')`).run()
    expect((await login(path)).status).toBe(409)
    db.exec(`DELETE FROM users;
      INSERT INTO users (id,username,role) VALUES ('plain-demo','0001','student'),('old-demo','stu_0001','student');`)
    expect((await login(path)).status).toBe(409)
    db.exec(`DELETE FROM users;
      INSERT INTO students VALUES ('duplicate-demo','0001','示例学生','Demo Name',7,'class-demo');`)
    expect((await login(path)).status).toBe(409)
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get().n).toBe(0)
  })
  it('训练师创建失败时回滚用户与档案更新', async () => {
    db.exec(`CREATE TRIGGER reject_trainer BEFORE INSERT ON trainers BEGIN SELECT RAISE(ABORT,'test rollback'); END;`)
    try {
      expect((await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentNo: '0001', realName: '示例学生' }) })).status).toBe(500)
      expect(db.prepare('SELECT COUNT(*) AS n FROM users').get().n).toBe(0)
    } finally { db.exec('DROP TRIGGER reject_trainer') }
  })
  it('真实学号与他人旧前缀重合时不得认领对方资产', async () => {
    db.exec(`INSERT INTO students VALUES ('prefix-roster-demo','stu_0001','示例另一学生','Another Demo',7,'class-demo');
      INSERT INTO users (id,username,role,game_points) VALUES ('legacy-owner-demo','stu_0001','student',89);`)
    expect((await login(path, 'stu_0001', '示例另一学生')).status).toBe(409)
    expect(db.prepare("SELECT id,game_points,real_name FROM users WHERE username='stu_0001'").get())
      .toEqual({ id: 'legacy-owner-demo', game_points: 89, real_name: null })
    db.exec("DELETE FROM users")
    expect((await login(path, 'stu_0001', '示例另一学生')).status).toBe(409)
    expect(db.prepare('SELECT COUNT(*) AS n FROM users').get().n).toBe(0)
  })
})
