// @vitest-environment node
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import { generateToken } from './utils/token.js'

let db, server, base
beforeAll(async () => {
  db = new Database(':memory:')
  db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT, role TEXT,
    real_name TEXT, name_en TEXT, grade INTEGER, class_id_ref TEXT, is_guest INTEGER DEFAULT 0,created_at INTEGER);
    CREATE TABLE classes(id TEXT PRIMARY KEY,name TEXT,user_id TEXT,created_at INTEGER,updated_at INTEGER);
    CREATE TABLE students(id TEXT PRIMARY KEY,student_no TEXT,name TEXT,class_id TEXT NOT NULL,total_points INTEGER DEFAULT 0,created_at INTEGER);`)
  vi.doMock('./db.js', () => ({ db }))
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  try {
    ;(await import('./game/migrate-v2.js')).migrateV2()
    ;(await import('./game/migrate-v3.js')).migrateV3()
    ;(await import('./game/migrate-roster.js')).migrateRoster()
    ;(await import('./game/import-seeds.js')).importSeeds()
  } finally { log.mockRestore() }
  const app = express()
  app.use(express.json())
  app.use('/api/auth', (await import('./routes/auth.js')).default)
  app.use('/api/v2', (await import('./routes/game-v2.js')).default)
  app.use('/api/v3/roster', (await import('./routes/roster.js')).default)
  app.use('/api/v3', (await import('./routes/game-v3.js')).default)
  app.use((err, _req, res, _next) => res.status(500).json({ error: err.message }))
  server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})
beforeEach(() => {
  db.exec(`DELETE FROM player_pets; DELETE FROM player_items; DELETE FROM player_skins; DELETE FROM player_character_skins;
    DELETE FROM player_fragments; DELETE FROM gacha_records; DELETE FROM gacha_pity; DELETE FROM exchange_records;
    DELETE FROM game_points_records; DELETE FROM trainers; DELETE FROM characters; DELETE FROM users; DELETE FROM students; DELETE FROM classes;
    INSERT INTO users(id,username,role,grade,game_points) VALUES('demo-user','0001','student',7,1000),('demo-teacher','demo-teacher','admin',6,0);
    INSERT INTO classes(id,name) VALUES('c6','六年级示例班'),('c7','七年级示例班');
    INSERT INTO students(id,student_no,name,name_en,grade,class_id,course) VALUES('s1','0001','示例学生','Demo Name',7,'c7','信息技术 G7');
    INSERT INTO trainers(user_id) VALUES('demo-user');
    INSERT OR REPLACE INTO economy_config(key,value_json) VALUES('gradeCoef','{"6":1,"7":0.6}');
    INSERT OR REPLACE INTO items_template(id,name,type,price) VALUES('demo-item','示例道具','test',7);
    INSERT OR REPLACE INTO skins_template(id,name,pet_template_id,type,price,css_class) VALUES('demo-skin','示例皮肤','pet_qinglong','test',6,'demo');
    INSERT OR REPLACE INTO character_skins(id,name,theme,gender,price) VALUES('demo-character-skin','示例角色','test','male',6);
    INSERT INTO player_pets(id,user_id,template_id,level,awakening_level) VALUES('demo-pet','demo-user','pet_qinglong',1,0);`)
})
afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); db?.close(); vi.doUnmock('./db.js') })
async function call(path, body, id = 'demo-user', method) {
  const response = await fetch(base + path, { method: method || (body === undefined ? 'GET' : 'POST'),
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${generateToken(id)}` },
    body: body === undefined ? undefined : JSON.stringify(body) })
  return { status: response.status, data: await response.json() }
}
const points = () => db.prepare("SELECT game_points FROM users WHERE id='demo-user'").get().game_points

describe('真实挂载消费接口', () => {
  it('G7道具单价按配置四舍五入，数量是单价整数倍；G6保留原价', async () => {
    const r = await call('/api/v2/shop/buy', { itemId: 'demo-item', quantity: 3 })
    expect(r).toMatchObject({ status: 200, data: { cost: 12, newPoints: 988 } })
    expect(db.prepare("SELECT quantity FROM player_items WHERE item_id='demo-item'").get().quantity).toBe(3)
    db.exec("UPDATE users SET grade=6 WHERE id='demo-user'")
    expect((await call('/api/v2/shop/buy', { itemId: 'demo-item' })).data.cost).toBe(7)
  })
  it.each([0, -1, 1.5, '2'])('非法数量%s不扣款、不发货', async quantity => {
    expect((await call('/api/v2/shop/buy', { itemId: 'demo-item', quantity })).status).toBe(400)
    expect(points()).toBe(1000)
    expect(db.prepare('SELECT COUNT(*) AS n FROM player_items').get().n).toBe(0)
  })
  it('运行期倍率配置立即生效，皮肤零价保持免费', async () => {
    db.exec(`UPDATE economy_config SET value_json='{"6":1,"7":0.5}' WHERE key='gradeCoef'`)
    expect((await call('/api/v2/shop/buy', { itemId: 'demo-item' })).data.cost).toBe(4)
    db.exec("UPDATE character_skins SET price=0 WHERE id='demo-character-skin'")
    expect((await call('/api/v3/character/buy-skin', { skinId: 'demo-character-skin' })).data.cost).toBe(0)
    expect(points()).toBe(996)
  })
  it.each(['/api/v2/shop/skins/buy', '/api/v3/character/buy-skin'])('皮肤%s按0.6计价，重复购买不再扣款', async path => {
    const skinId = path.includes('/v2/') ? 'demo-skin' : 'demo-character-skin'
    expect((await call(path, { skinId })).data.cost).toBe(4)
    expect((await call(path, { skinId })).status).toBe(400)
    expect(points()).toBe(996)
  })
  it('资产写入异常时道具与扣款/流水一起回滚', async () => {
    db.exec("CREATE TRIGGER reject_item BEFORE INSERT ON player_items BEGIN SELECT RAISE(ABORT,'fixture failure'); END")
    try {
      expect((await call('/api/v2/shop/buy', { itemId: 'demo-item' })).status).toBe(500)
      expect(points()).toBe(1000)
      expect(db.prepare('SELECT COUNT(*) AS n FROM exchange_records').get().n).toBe(0)
    } finally { db.exec('DROP TRIGGER reject_item') }
  })
  it.each(['/api/v2/pets/demo-pet/awaken','/api/v3/pets/demo-pet/awaken'])('觉醒%s统一定价及碎片上限', async path => {
    db.exec("INSERT INTO player_fragments VALUES('demo-user',3,100)")
    const r = await call(path, {})
    expect(r).toMatchObject({ status: 200, data: { totalCost: 48, fragmentCost: 24, cost: 24, form: 2 } })
    expect(points()).toBe(976)
    expect(db.prepare('SELECT count FROM player_fragments').get().count).toBe(76)
  })
  it('正式求签v2 kind与v3 count复用算法、余额与保底状态', async () => {
    const first = await call('/api/v2/gacha/draw', { kind: 'single' })
    expect(first.status).toBe(200)
    expect(first.data.cost).toBe(3)
    expect(first.data.results).toHaveLength(1)
    expect(first.data.results[0]).toHaveProperty('pet_id')
    const ten = await call('/api/v3/gacha/draw', { count: 10 })
    expect(ten).toMatchObject({ status: 200, data: { cost: 27, pityCount: 11 } })
    expect(ten.data.results).toHaveLength(10)
    expect(points()).toBe(970)
    expect(db.prepare('SELECT COUNT(*) AS n FROM gacha_records').get().n).toBe(11)
  })
  it('旧蛋型保留原基础价格，G7系数统一为0.6', async () => {
    const r = await call('/api/v2/gacha/draw', { eggType: 'normal', count: 1 })
    expect(r).toMatchObject({ status: 200, data: { cost: 120, newPoints: 880 } })
  })
  it('实际求签第60抽至少三阶，不再硬加四阶保底', async () => {
    db.exec("INSERT INTO gacha_pity(user_id,egg_type,count) VALUES('demo-user','v3',59)")
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    try {
      const r = await call('/api/v2/gacha/draw', { kind: 'single' })
      expect(r.status).toBe(200)
      expect(r.data.results[0].tier).toBe(3)
      expect(r.data.pityCount).toBe(60)
    } finally { random.mockRestore() }
  })
  it('觉醒资产更新失败时积分与碎片均回滚', async () => {
    db.exec("INSERT INTO player_fragments VALUES('demo-user',3,100)")
    db.exec("CREATE TRIGGER reject_awaken BEFORE UPDATE OF awakening_level ON player_pets BEGIN SELECT RAISE(ABORT,'fixture failure'); END")
    try {
      expect((await call('/api/v3/pets/demo-pet/awaken', {})).status).toBe(500)
      expect(points()).toBe(1000)
      expect(db.prepare('SELECT count FROM player_fragments').get().count).toBe(100)
      expect(db.prepare("SELECT awakening_level FROM player_pets WHERE id='demo-pet'").get().awakening_level).toBe(0)
    } finally { db.exec('DROP TRIGGER reject_awaken') }
  })
  it('小数抽数和余额不足不改变保底或资产', async () => {
    expect((await call('/api/v3/gacha/draw', { count: 1.5 })).status).toBe(400)
    db.exec("UPDATE users SET game_points=2 WHERE id='demo-user'")
    expect((await call('/api/v2/gacha/draw', { kind: 'single' })).status).toBe(400)
    expect(points()).toBe(2)
    expect(db.prepare('SELECT COUNT(*) AS n FROM gacha_records').get().n).toBe(0)
    expect(db.prepare('SELECT COUNT(*) AS n FROM gacha_pity').get().n).toBe(0)
  })
  it('正式求签流水失败时扣款、宠物与保底整批回滚', async () => {
    db.exec("CREATE TRIGGER reject_draw BEFORE INSERT ON gacha_records BEGIN SELECT RAISE(ABORT,'fixture failure'); END")
    try {
      expect((await call('/api/v2/gacha/draw', { kind: 'ten' })).status).toBe(500)
      expect(points()).toBe(1000)
      expect(db.prepare('SELECT COUNT(*) AS n FROM player_pets').get().n).toBe(1)
      expect(db.prepare('SELECT COUNT(*) AS n FROM player_fragments').get().n).toBe(0)
      expect(db.prepare('SELECT COUNT(*) AS n FROM gacha_pity').get().n).toBe(0)
    } finally { db.exec('DROP TRIGGER reject_draw') }
  })
})

it('名单全链路：预演不写库、提交、英文登录、改学号、转班、再次登录和HUD真值', async () => {
  const rows = [{ studentNo: '0099', name: '示例新生', nameEn: 'New Demo', class: '六年级示例班' }]
  const preview = await call('/api/v3/roster/import', { rows, dryRun: true }, 'demo-teacher')
  expect(preview.data.rowPlans[0].action).toBe('create')
  expect(db.prepare("SELECT id FROM students WHERE student_no='0099'").get()).toBeUndefined()
  expect((await call('/api/v3/roster/import', { rows }, 'demo-teacher')).data.created).toBe(1)
  const student = db.prepare("SELECT id FROM students WHERE student_no='0099'").get()
  const login = await call('/api/auth/student/login', { studentNo: '0099', realName: ' new DEMO ' })
  expect(login.status).toBe(200)
  const userId = login.data.user.id
  db.prepare('UPDATE users SET game_points=73 WHERE id=?').run(userId)
  expect((await call(`/api/v3/roster/students/${student.id}`, { studentNo: '0100' }, 'demo-teacher', 'PUT')).status).toBe(200)
  expect((await call('/api/auth/student/login', { studentNo: '0099', realName: 'New Demo' })).status).toBe(401)
  expect((await call('/api/v3/roster/bulk', { action: 'move', ids: [student.id], classId: 'c7' }, 'demo-teacher')).status).toBe(200)
  const again = await call('/api/v2/auth/student/login', { studentNo: '0100', realName: '示例新生' })
  expect(again.data.user).toMatchObject({ id: userId, grade: 7, gamePoints: 73, className: '七年级示例班' })
  const hud = await call('/api/v2/trainer/me', undefined, userId)
  expect(hud).toMatchObject({ status: 200, data: { trainer: { user_id: userId, game_points: 73, grade: 7, class_name: '七年级示例班' } } })
})
