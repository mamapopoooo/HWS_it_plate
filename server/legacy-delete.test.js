// @vitest-environment node
// 旧 v1 删除入口（routes/students.js、routes/classes.js）的孤儿防护回归。
// Codex 口径：有关联就拒绝删除并提示走名单管理，旧入口不许扩大级联删除、更不许自动清资产。
// 全部用虚构姓名和 99 开头的假学号，不碰真实库。
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'
import express from 'express'
import { generateToken } from './utils/token.js'

let db, server, base, teacherToken

beforeAll(async () => {
  db = new Database(':memory:')
  db.exec(`
    CREATE TABLE classes (id TEXT PRIMARY KEY, name TEXT, user_id TEXT, created_at INTEGER, updated_at INTEGER);
    CREATE TABLE students (id TEXT PRIMARY KEY, class_id TEXT NOT NULL, name TEXT NOT NULL, student_no TEXT,
      total_points INTEGER DEFAULT 0, created_at INTEGER, name_en TEXT DEFAULT '', gender TEXT DEFAULT '',
      grade INTEGER, course TEXT DEFAULT '');
    CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'student', real_name TEXT DEFAULT '', name_en TEXT DEFAULT '', grade INTEGER,
      class_id_ref TEXT, is_guest INTEGER DEFAULT 0, created_at INTEGER, game_points INTEGER DEFAULT 0,
      last_login_at INTEGER);
    CREATE TABLE trainers (user_id TEXT PRIMARY KEY, level INTEGER DEFAULT 1, title TEXT DEFAULT '');
    CREATE TABLE player_pets (id TEXT PRIMARY KEY, user_id TEXT, pet_type TEXT);
    CREATE TABLE evaluation_records (id TEXT PRIMARY KEY, class_id TEXT, student_id TEXT, score INTEGER, created_at INTEGER);
    CREATE TABLE badges (id TEXT PRIMARY KEY, student_id TEXT, badge_type TEXT);
    CREATE TABLE class_battles (id TEXT PRIMARY KEY, class_a_id TEXT, class_b_id TEXT, status TEXT);
    -- 真库有这两张表，内存库不建就等于没测：多列 OR 的参数个数就是在缺表时被跳过去才炸的
    CREATE TABLE battle_records (id TEXT PRIMARY KEY, player_a_id TEXT, player_b_id TEXT, result TEXT);
    CREATE TABLE custom_pets (id TEXT PRIMARY KEY, user_id TEXT, name TEXT);
    CREATE TABLE custom_pet_images (id TEXT PRIMARY KEY, custom_pet_id TEXT, url TEXT);
    CREATE UNIQUE INDEX idx_students_student_no ON students(student_no);
  `)
  vi.doMock('./db.js', () => ({ db }))
  const [legacyStudents, legacyClasses] = await Promise.all([
    import('./routes/students.js'),
    import('./routes/classes.js')
  ])
  const app = express()
  app.use(express.json())
  app.use('/api/students', legacyStudents.default)
  app.use('/api/classes', legacyClasses.default)
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

beforeEach(() => {
  db.exec(`
    DELETE FROM custom_pet_images; DELETE FROM custom_pets; DELETE FROM battle_records;
    DELETE FROM class_battles; DELETE FROM badges; DELETE FROM evaluation_records;
    DELETE FROM player_pets; DELETE FROM trainers; DELETE FROM users; DELETE FROM students; DELETE FROM classes;
    INSERT INTO classes (id, name, user_id) VALUES
      ('class-a', '六年级A班', 'u-admin'), ('class-b', '七年级B班', 'u-admin'), ('class-empty', '空班', 'u-admin');
    INSERT INTO students (id, class_id, name, student_no, name_en, grade) VALUES
      ('s-1', 'class-a', '示例甲', '990000001', 'Demo One', 6),
      ('s-2', 'class-a', '示例乙', '990000002', '', 6),
      ('s-3', 'class-b', '示例丙', '990000003', '', 7),
      ('s-4', 'class-b', '示例丁', NULL, '', NULL);
    INSERT INTO users (id, username, password_hash, role, real_name, grade, class_id_ref, game_points) VALUES
      ('u-admin', '999999999', '', 'teacher', '示例教师', NULL, NULL, 0),
      ('u-1', '990000001', '', 'student', '示例甲', 6, 'class-a', 1234),
      ('u-3', 'stu_990000003', '', 'student', '示例丙', 7, 'class-b', 66);
    INSERT INTO trainers (user_id) VALUES ('u-1'), ('u-3');
    INSERT INTO player_pets (id, user_id, pet_type) VALUES ('p-1', 'u-1', 'fox'), ('p-3', 'u-3', 'owl');
    INSERT INTO evaluation_records (id, class_id, student_id, score) VALUES
      ('e-1', 'class-a', 's-1', 5), ('e-2', 'class-a', 's-2', 3), ('e-4', 'class-b', 's-4', 1);
    INSERT INTO badges (id, student_id, badge_type) VALUES ('b-1', 's-2', 'first');
    INSERT INTO class_battles (id, class_a_id, class_b_id) VALUES ('cb-1', 'class-a', 'class-empty');
    INSERT INTO battle_records (id, player_a_id, player_b_id, result) VALUES ('br-1', 'u-1', 'u-3', 'win');
    INSERT INTO custom_pets (id, user_id, name) VALUES ('cp-1', 'u-1', '示例造物');
    INSERT INTO custom_pet_images (id, custom_pet_id, url) VALUES ('cpimg-1', 'cp-1', '/x.png');
  `)
  teacherToken = generateToken('u-admin')
})

afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve))
  db?.close()
  vi.doUnmock('./db.js')
})

async function send(path, { method = 'DELETE', api = '/api/students', body } = {}) {
  const res = await fetch(`${base}${api}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${teacherToken}`
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

const del = (id) => send(`/${id}`)
const put = (id, body) => send(`/${id}`, { method: 'PUT', body })
const delClass = (id) => send(`/${id}`, { api: '/api/classes' })
const count = (sql, ...args) => db.prepare(sql).get(...args).n
const get = (sql, ...args) => db.prepare(sql).get(...args)
const student = (no) => get('SELECT * FROM students WHERE student_no = ?', no)

describe('QD-08 旧学生删除入口', () => {
  it('学号已有登录身份和游戏资产时拒绝删除，一行都不动', async () => {
    const { status, data } = await del('s-1')
    expect(status).toBe(409)
    expect(data.error).toContain('名单管理')
    expect(data.refs).toMatchObject({
      identities: [{ id: 'u-1', username: '990000001' }],
      assetRows: 5,
      records: { evaluations: 1, badges: 0 }
    })
    // 斗法记录挂在两侧、造物图片挂在 custom_pets 之下：这两张不按 user_id 直挂的表
    // 曾在缺表的内存库里被跳过，真库上一调就炸参数个数，这里必须实打实数到。
    expect(data.refs.assets).toEqual(expect.arrayContaining([
      { table: 'battle_records', rows: 1 },
      { table: 'custom_pet_images', rows: 1 }
    ]))
    expect(count('SELECT COUNT(*) AS n FROM students WHERE id = ?', 's-1')).toBe(1)
    expect(count('SELECT COUNT(*) AS n FROM users WHERE id = ?', 'u-1')).toBe(1)
    expect(count('SELECT COUNT(*) AS n FROM player_pets WHERE user_id = ?', 'u-1')).toBe(1)
    expect(count('SELECT COUNT(*) AS n FROM evaluation_records WHERE student_id = ?', 's-1')).toBe(1)
  })

  it('只有旧 stu_ 前缀身份也算牵连，不能当成没账号', async () => {
    const { status, data } = await del('s-3')
    expect(status).toBe(409)
    expect(data.refs.legacyUsernames).toEqual(['stu_990000003'])
    expect(data.error).toContain('旧 stu_ 前缀账号')
    expect(count('SELECT COUNT(*) AS n FROM students WHERE id = ?', 's-3')).toBe(1)
  })

  it('从没登录过的学生照旧能删，评价与徽章一并清掉不留孤儿', async () => {
    const { status } = await del('s-2')
    expect(status).toBe(200)
    expect(count('SELECT COUNT(*) AS n FROM students WHERE id = ?', 's-2')).toBe(0)
    expect(count('SELECT COUNT(*) AS n FROM evaluation_records WHERE student_id = ?', 's-2')).toBe(0)
    expect(count('SELECT COUNT(*) AS n FROM badges WHERE student_id = ?', 's-2')).toBe(0)
  })

  it('没有学号的学生不会被身份闸误伤', async () => {
    const { status } = await del('s-4')
    expect(status).toBe(200)
    expect(count('SELECT COUNT(*) AS n FROM students WHERE id = ?', 's-4')).toBe(0)
    expect(count('SELECT COUNT(*) AS n FROM evaluation_records WHERE student_id = ?', 's-4')).toBe(0)
  })

  it('删除中途失败整笔回滚，不许留下半截清理', async () => {
    db.prepare("CREATE TRIGGER break_student BEFORE DELETE ON students BEGIN SELECT RAISE(ABORT, 'boom'); END").run()
    const { status } = await del('s-2')
    db.prepare('DROP TRIGGER break_student').run()
    // 路由没有自定义错误处理，事务抛错由 express 兜成 500；重点是库回到原样
    expect(status).toBe(500)
    expect(count('SELECT COUNT(*) AS n FROM students WHERE id = ?', 's-2')).toBe(1)
    expect(count('SELECT COUNT(*) AS n FROM evaluation_records WHERE student_id = ?', 's-2')).toBe(1)
    expect(count('SELECT COUNT(*) AS n FROM badges WHERE student_id = ?', 's-2')).toBe(1)
  })
})

// 学号 = 登录名。旧 v1 编辑只写 students，不镜像 users.username，
// 让它改学号等于把档案和身份掰开，学生下次用新学号直接进不来。
describe('QD-09 旧学生编辑入口', () => {
  it('改学号被拒，students 与 users 都保持对得上', async () => {
    const { status, data } = await put('s-1', { name: '示例甲', studentNo: '990000011' })
    expect(status).toBe(409)
    expect(data.error).toContain('名单管理')
    expect(student('990000001')).toMatchObject({ name: '示例甲', student_no: '990000001' })
    expect(get("SELECT username FROM users WHERE id = 'u-1'").username).toBe('990000001')
  })

  it('原学号原样回传（前端整行提交）不算改学号，照常放行', async () => {
    const { status } = await put('s-1', { name: '示例甲（改）', studentNo: '990000001' })
    expect(status).toBe(200)
    expect(student('990000001')).toMatchObject({ name: '示例甲（改）', student_no: '990000001' })
  })

  it('只改名不带动学号', async () => {
    const { status } = await put('s-2', { name: '示例乙（改）' })
    expect(status).toBe(200)
    expect(student('990000002')).toMatchObject({ name: '示例乙（改）', student_no: '990000002' })
  })

  it('空中文名拒绝，缺 name 键保留原值而不是崩成 500 或写空', async () => {
    const blank = await put('s-2', { name: '  ' })
    expect(blank.status).toBe(400)
    const absent = await put('s-2', { studentNo: '990000002' })
    expect(absent.status).toBe(200)
    expect(student('990000002').name).toBe('示例乙')
  })

  it('从没填过学号的学生补学号也拒绝——学号得由名单管理统一建身份', async () => {
    const { status } = await put('s-4', { name: '示例丁', studentNo: '990000012' })
    expect(status).toBe(409)
    expect(get('SELECT student_no FROM students WHERE id = ?', 's-4').student_no).toBeNull()
  })
})

describe('QD-08 旧班级删除入口', () => {
  it('班里还有学生时拒绝删班，学生名单一行都不掉', async () => {
    const { status, data } = await delClass('class-a')
    expect(status).toBe(409)
    expect(data.links).toMatchObject({ students: 2, withIdentity: 1, identityRefs: 1, battles: 1 })
    expect(data.error).toContain('这个班不能删')
    expect(count('SELECT COUNT(*) AS n FROM students WHERE class_id = ?', 'class-a')).toBe(2)
    expect(count('SELECT COUNT(*) AS n FROM classes WHERE id = ?', 'class-a')).toBe(1)
  })

  it('班里没人但有账号档案还指着这个班 —— 拒绝，不留孤儿引用', async () => {
    db.prepare('DELETE FROM students WHERE class_id = ?').run('class-b')
    const { status, data } = await delClass('class-b')
    expect(status).toBe(409)
    expect(data.links.students).toBe(0)
    expect(data.links.identityRefs).toBe(1)
    expect(count('SELECT COUNT(*) AS n FROM classes WHERE id = ?', 'class-b')).toBe(1)
  })

  it('只剩班级战对阵挂在上面也拒绝，比分不能变成查无此班', async () => {
    db.prepare("UPDATE class_battles SET class_a_id = 'class-empty', class_b_id = 'class-empty'").run()
    const { status, data } = await delClass('class-empty')
    expect(status).toBe(409)
    expect(data.links.battles).toBe(1)
    expect(count('SELECT COUNT(*) AS n FROM classes WHERE id = ?', 'class-empty')).toBe(1)
  })

  it('真正干净的班才允许删除', async () => {
    db.prepare('DELETE FROM class_battles').run()
    const { status } = await delClass('class-empty')
    expect(status).toBe(200)
    expect(count('SELECT COUNT(*) AS n FROM classes WHERE id = ?', 'class-empty')).toBe(0)
  })

  it('班级名前后空格归一，但相近写法不自动归并', async () => {
    const created = await fetch(`${base}/api/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
      body: JSON.stringify({ name: '  六年级A班  ' })
    }).then((r) => r.json())
    expect(created.name).toBe('六年级A班')
    expect(count('SELECT COUNT(*) AS n FROM classes WHERE name = ?', '六年级A班')).toBe(2)
    expect(count("SELECT COUNT(*) AS n FROM classes WHERE name LIKE '% %'")).toBe(0)
  })
})

describe('QD-07 引用盘点：只读、缺表不假通过', () => {
  it('盘点不写库', async () => {
    const { studentRefs } = await import('./utils/rosterRefs.js')
    const tables = count("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'")
    const refs = studentRefs('990000001')
    expect(refs.identities.map((i) => i.id)).toEqual(['u-1'])
    expect(refs.assets).toEqual(expect.arrayContaining([{ table: 'player_pets', rows: 1 }]))
    expect(count("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'")).toBe(tables)
    expect(count('SELECT COUNT(*) AS n FROM users')).toBe(3)
  })

  it('资产表缺失只记 missingTables，不假装查过是 0', async () => {
    db.prepare('DROP TABLE trainers').run()
    try {
      const { studentRefs } = await import('./utils/rosterRefs.js')
      const refs = studentRefs('990000001')
      expect(refs.missingTables).toContain('trainers')
      expect(refs.assets.find((a) => a.table === 'trainers')).toBeUndefined()
      expect(refs.assetRows).toBe(4) // 去掉 trainers，其余 4 张有行的表照数
    } finally {
      // 表要还回去：后面的用例还靠 beforeEach 往里插数据
      db.exec("CREATE TABLE trainers (user_id TEXT PRIMARY KEY, level INTEGER DEFAULT 1, title TEXT DEFAULT '')")
    }
  })

  // users 表整张缺失时路由会在鉴权阶段就 500，跑不到删除闸，所以这一条按单元口径锁判定函数。
  it('查不到 users 就证明不了安全，一律判不可删', async () => {
    const { studentDeletable } = await import('./utils/rosterRefs.js')
    const empty = { identities: [], assetRows: 0, records: { evaluations: 0, badges: 0 }, missingTables: [] }
    expect(studentDeletable(empty)).toBe(true)
    expect(studentDeletable({ ...empty, missingTables: ['users'] })).toBe(false)
    expect(studentDeletable({ ...empty, identities: [{ id: 'u-1' }] })).toBe(false)
    expect(studentDeletable({ ...empty, assetRows: 1 })).toBe(false)
  })
})
