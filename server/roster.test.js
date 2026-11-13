// @vitest-environment node
// 名单管理接口回归：QD-01 派生字段、QD-02 按列存在性导入、QD-03 转班年级同步。
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
      grade INTEGER DEFAULT 0, course TEXT DEFAULT '');
    CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'student', real_name TEXT DEFAULT '', name_en TEXT DEFAULT '', grade INTEGER,
      class_id_ref TEXT, is_guest INTEGER DEFAULT 0, created_at INTEGER, game_points INTEGER DEFAULT 0,
      last_login_at INTEGER);
    CREATE TABLE trainers (user_id TEXT PRIMARY KEY, level INTEGER DEFAULT 1, title TEXT DEFAULT '');
    CREATE TABLE player_pets (id TEXT PRIMARY KEY, user_id TEXT, pet_type TEXT);
    CREATE UNIQUE INDEX idx_students_student_no ON students(student_no);
  `)
  // 路由只访问内存库，禁止导入真实 server/pet-garden.db
  vi.doMock('./db.js', () => ({ db }))
  const roster = (await import('./routes/roster.js')).default
  const app = express()
  app.use(express.json())
  app.use('/api/v3/roster', roster)
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

beforeEach(() => {
  db.exec(`
    DELETE FROM player_pets; DELETE FROM trainers; DELETE FROM users; DELETE FROM students; DELETE FROM classes;
    INSERT INTO classes (id, name) VALUES ('class-a', '六年级A班'), ('class-b', '七年级B班'), ('class-x', '甲班');
    INSERT INTO students (id, class_id, name, student_no, name_en, gender, grade, course) VALUES
      ('s-1', 'class-a', '示例甲', '990000001', 'Demo One', '男', 6, '信息技术 G6'),
      ('s-2', 'class-a', '示例乙', '990000002', '', '', 6, '信息技术 G6');
    INSERT INTO users (id, username, password_hash, role, real_name, name_en, grade, class_id_ref, game_points, last_login_at) VALUES
      ('u-admin', '999999999', '', 'teacher', '示例教师', '', 6, 'class-a', 0, NULL),
      ('u-1', '990000001', '', 'student', '示例甲', 'Demo One', 6, 'class-a', 1234, 1730000000000),
      ('u-2', '990000002', '', 'student', '示例乙', '', 6, 'class-a', 0, NULL);
    INSERT INTO trainers (user_id) VALUES ('u-1');
    INSERT INTO player_pets (id, user_id, pet_type) VALUES ('p-1', 'u-1', 'fox');
  `)
  teacherToken = generateToken('u-admin')
})

afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve))
  db?.close()
  vi.doUnmock('./db.js')
})

async function call(path, { method, body } = {}) {
  const m = method ?? (body === undefined ? 'GET' : 'POST')
  const res = await fetch(`${base}/api/v3/roster${path}`, {
    method: m,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

const student = (no) => db.prepare('SELECT * FROM students WHERE student_no = ?').get(no)
const identity = (no) => db.prepare("SELECT * FROM users WHERE username = ? AND role = 'student'").get(no)

describe('QD-01 名单派生字段', () => {
  it('积分和登录态读的是 users 真值，不是恒 0 恒未登录', async () => {
    const { status, data } = await call('/students')
    expect(status).toBe(200)
    const byNo = Object.fromEntries(data.students.map((s) => [s.studentNo, s]))
    expect(byNo['990000001']).toMatchObject({ gamePoints: 1234, loggedIn: true, petCount: 1, trainerLevel: 1 })
    expect(byNo['990000002']).toMatchObject({ gamePoints: 0, loggedIn: false, petCount: 0 })
  })

  it('还没有登录身份的学生积分 0、未登录，不会因缺行崩掉', async () => {
    db.prepare('DELETE FROM users WHERE username = ?').run('990000002')
    const { data } = await call('/students')
    const s = data.students.find((r) => r.studentNo === '990000002')
    expect(s).toMatchObject({ gamePoints: 0, loggedIn: false, userId: null })
  })
})

describe('QD-02 按列存在性导入', () => {
  it('表格只给学号+中文名两列时，英文名/班级/课程原样保留', async () => {
    const { status, data } = await call('/import', {
      body: { rows: [{ studentNo: '990000001', name: '示例甲' }] }
    })
    // 旧版这里会因为 class 缺席把 class_id 写成 NULL，直接 NOT NULL 崩成 500
    expect(status).toBe(200)
    expect(data).toMatchObject({ created: 0, updated: 0, unchanged: 1, rejected: [] })
    expect(student('990000001')).toMatchObject({
      class_id: 'class-a', name_en: 'Demo One', course: '信息技术 G6', grade: 6
    })
  })

  it('出现但空白的可选列不清空原值', async () => {
    const { status, data } = await call('/import', {
      body: { rows: [{ studentNo: '990000001', name: '示例甲', nameEn: '', gender: '', course: '', class: '' }] }
    })
    expect(status).toBe(200)
    expect(data.unchanged).toBe(1)
    expect(student('990000001')).toMatchObject({ name_en: 'Demo One', course: '信息技术 G6', class_id: 'class-a' })
  })

  it('表格里出现的列才更新，且 users 身份同步同一批列', async () => {
    const { status, data } = await call('/import', {
      body: { rows: [{ studentNo: '990000001', name: '示例甲', nameEn: 'Demo A' }] }
    })
    expect(status).toBe(200)
    expect(data.updated).toBe(1)
    expect(student('990000001').name_en).toBe('Demo A')
    expect(identity('990000001').name_en).toBe('Demo A')
    expect(identity('990000001').game_points).toBe(1234) // 导入绝不重置积分
  })

  it('新增学生缺班级时明确拒绝，不写无效 class_id 也不写 grade 0', async () => {
    const { status, data } = await call('/import', {
      body: { rows: [{ studentNo: '990000003', name: '示例丙' }] }
    })
    expect(status).toBe(200)
    expect(data.rejected).toEqual([{ studentNo: '990000003', reason: '新增学生必须有班级' }])
    expect(student('990000003')).toBeUndefined()
    expect(db.prepare("SELECT COUNT(*) AS n FROM students WHERE class_id = '' OR class_id IS NULL").get().n).toBe(0)
  })

  it('新增学生带班级时建身份、年级从课程推断，英文名可缺省', async () => {
    const { data } = await call('/import', {
      body: { rows: [{ studentNo: '990000003', name: '示例丙', class: '七年级B班', course: '信息技术 G7' }] }
    })
    expect(data).toMatchObject({ created: 1, updated: 0 })
    expect(student('990000003')).toMatchObject({ class_id: 'class-b', grade: 7, name_en: '' })
    expect(identity('990000003')).toMatchObject({ grade: 7, class_id_ref: 'class-b', game_points: 0 })
    expect(identity('990000003').last_login_at).toBeNull()
  })

  it('班级列出现但空白的新学生被拒绝，而不是写进空班', async () => {
    const { data } = await call('/import', {
      body: { rows: [{ studentNo: '990000004', name: '示例丁', class: '' }] }
    })
    expect(data.rejected[0].reason).toBe('新增学生必须有班级')
    expect(student('990000004')).toBeUndefined()
  })

  it('有登录身份却不在名单里的学号交人工核对，不自动建第二条身份', async () => {
    db.prepare('DELETE FROM students WHERE student_no = ?').run('990000002')
    const { data } = await call('/import', {
      body: { rows: [{ studentNo: '990000002', name: '示例乙', class: '七年级B班' }] }
    })
    expect(data.rejected[0].reason).toContain('已有登录身份')
    expect(db.prepare('SELECT COUNT(*) AS n FROM users WHERE username = ?').get('990000002').n).toBe(1)
  })

  it('dryRun 预演与实际写入的计数完全一致', async () => {
    const rows = [
      { studentNo: '990000001', name: '示例甲', nameEn: 'Demo A' },
      { studentNo: '990000002', name: '示例乙' },
      { studentNo: '990000003', name: '示例丙' },
      { studentNo: '', name: '示例丁' }
    ]
    const preview = await call('/import', { body: { rows, dryRun: true } })
    expect(preview.status).toBe(200)
    expect(preview.data).toMatchObject({ wouldCreate: 0, wouldUpdate: 1, unchanged: 1, invalid: 2 })
    expect(preview.data.existingNos.sort()).toEqual(['990000001', '990000002'])

    const commit = await call('/import', { body: { rows } })
    expect(commit.data).toMatchObject({
      created: preview.data.wouldCreate,
      updated: preview.data.wouldUpdate,
      unchanged: preview.data.unchanged
    })
    expect(commit.data.rejected.map((r) => r.reason)).toEqual(preview.data.rejected.map((r) => r.reason))
    expect(student('990000003')).toBeUndefined()
  })

  it('dryRun 不落库：预演说新增 1 人时库里仍没有这个人', async () => {
    const rows = [{ studentNo: '990000005', name: '示例戊', class: '六年级A班' }]
    const preview = await call('/import', { body: { rows, dryRun: true } })
    expect(preview.data.wouldCreate).toBe(1)
    expect(student('990000005')).toBeUndefined()
    expect(db.prepare('SELECT COUNT(*) AS n FROM classes').get().n).toBe(3)
  })

  it('同一份表格重复导入第二次全为无变化', async () => {
    const rows = [
      { studentNo: '990000001', name: '示例甲', nameEn: 'Demo One', gender: '男', class: '六年级A班', course: '信息技术 G6' },
      { studentNo: '990000002', name: '示例乙', nameEn: '', gender: '', class: '六年级A班', course: '信息技术 G6' }
    ]
    const first = await call('/import', { body: { rows } })
    expect(first.data.updated).toBe(0)
    expect(first.data.unchanged).toBe(2)
    const second = await call('/import', { body: { rows } })
    expect(second.data).toMatchObject({ created: 0, updated: 0, unchanged: 2 })
    expect(db.prepare('SELECT COUNT(*) AS n FROM students').get().n).toBe(2)
  })

  // 契约 docs/名单导入契约-Codex-20261113.md：action 只有 create/update/reject，
  // writeFields/skipFields 只用五个字段 code，warnings/errors 是中文句子且不泄露别人资料。
  it('rowPlans 逐行给出写/跳/警/错，且与提交时的计划一致', async () => {
    const rows = [
      { studentNo: '990000001', name: '示例甲', nameEn: 'Demo A' },
      { studentNo: '990000002', name: '示例乙', nameEn: '', gender: '', class: '', course: '' },
      { studentNo: '990000003', name: '示例丙', class: '甲班' },
      { studentNo: '990000003', name: '示例丙', class: '七年级B班' }
    ]
    const expectPlans = [
      {
        studentNo: '990000001', action: 'update', writeFields: ['nameEn'],
        skipFields: ['name', 'gender', 'class', 'course'], warnings: [], errors: []
      },
      {
        studentNo: '990000002', action: 'update', writeFields: [],
        skipFields: ['name', 'nameEn', 'gender', 'class', 'course'],
        warnings: [
          '英文名列为空，本次保留原值', '性别列为空，本次保留原值',
          '班级列为空，本次保留原值', '课程列为空，本次保留原值',
          '本次没有需要更新的列，档案保持原样'
        ],
        errors: []
      },
      {
        studentNo: '990000003', action: 'reject', writeFields: [], skipFields: [], warnings: [],
        errors: ['同一份表格里这个学号出现多次，请合并成一行后重传']
      },
      {
        studentNo: '990000003', action: 'reject', writeFields: [], skipFields: [], warnings: [],
        errors: ['同一份表格里这个学号出现多次，请合并成一行后重传']
      }
    ]
    const preview = await call('/import', { body: { rows, dryRun: true } })
    expect(preview.data.rowPlans).toEqual(expectPlans)
    expect(preview.data.rejected).toEqual([
      { studentNo: '990000003', reason: '同一份表格里这个学号出现多次，请合并成一行后重传' },
      { studentNo: '990000003', reason: '同一份表格里这个学号出现多次，请合并成一行后重传' }
    ])

    const commit = await call('/import', { body: { rows } })
    expect(commit.data.rowPlans).toEqual(expectPlans)
    expect(commit.data).toMatchObject({
      created: preview.data.wouldCreate,
      updated: preview.data.wouldUpdate,
      unchanged: preview.data.unchanged
    })
  })

  it('同批重复学号两行都拒绝，后行不覆盖前行', async () => {
    const rows = [
      { studentNo: '990000001', name: '示例甲', nameEn: 'First' },
      { studentNo: '990000001', name: '示例甲', nameEn: 'Second' }
    ]
    const { data } = await call('/import', { body: { rows } })
    expect(data).toMatchObject({ created: 0, updated: 0 })
    expect(data.rejected.every(r => r.reason.includes('出现多次'))).toBe(true)
    expect(student('990000001').name_en).toBe('Demo One')
    expect(identity('990000001').game_points).toBe(1234)
  })

  it('已有学生的姓名单元格空白是跳过并警告，不是拒绝也不是清空', async () => {
    const { data } = await call('/import', {
      body: { rows: [{ studentNo: '990000001', name: '   ', nameEn: 'Demo A' }] }
    })
    expect(data.rejected).toEqual([])
    expect(data.updated).toBe(1)
    expect(student('990000001')).toMatchObject({ name: '示例甲', name_en: 'Demo A' })
    expect(data.rowPlans[0].skipFields).toContain('name')
    expect(data.rowPlans[0].warnings).toContain('中文名列为空，本次保留原值')
  })

  it('新增学生的班级和课程都推不出年级时拒绝，宁可让教师补全也不猜', async () => {
    const { data } = await call('/import', {
      body: { rows: [{ studentNo: '990000007', name: '示例庚', class: '甲班' }] }
    })
    expect(data.rejected[0].reason).toContain('无法从班级或课程确定年级')
    expect(student('990000007')).toBeUndefined()
  })

  it('库里 grade=0 的脏数据在下次导入时被校正，users 同步', async () => {
    db.prepare('UPDATE students SET grade = 0, course = ? WHERE id = ?').run('', 's-2')
    const { data } = await call('/import', { body: { rows: [{ studentNo: '990000002', name: '示例乙' }] } })
    expect(data.updated).toBe(1)
    expect(student('990000002').grade).toBe(6)
    expect(identity('990000002').grade).toBe(6)
    expect(data.rowPlans[0].warnings).toContain('年级按班级或课程校正为 6 年级')
  })

  it('数据库意外失败整批回滚，绝不把未提交行计成成功', async () => {
    db.exec(`CREATE TRIGGER boom BEFORE INSERT ON students
      WHEN NEW.student_no = '990000004' BEGIN SELECT RAISE(ABORT, '模拟数据库故障'); END;`)
    try {
      const rows = [
        { studentNo: '990000001', name: '示例甲', nameEn: 'Demo Z' },
        { studentNo: '990000003', name: '示例丙', class: '八年级C班' },
        { studentNo: '990000004', name: '示例丁', class: '八年级C班' }
      ]
      const preview = await call('/import', { body: { rows, dryRun: true } })
      expect(preview.data).toMatchObject({ wouldCreate: 2, wouldUpdate: 1 })
      const { status } = await call('/import', { body: { rows } })
      expect(status).toBe(500)
      expect(student('990000001').name_en).toBe('Demo One')
      expect(student('990000003')).toBeUndefined()
      expect(student('990000004')).toBeUndefined()
      expect(db.prepare('SELECT COUNT(*) AS n FROM classes').get().n).toBe(3)
      expect(db.prepare('SELECT COUNT(*) AS n FROM students').get().n).toBe(2)
    } finally { db.exec('DROP TRIGGER boom') }
  })
})

describe('QD-03 转班与年级同步', () => {
  it('转班同事务同步 students.grade 与 users.grade，登录后不回退', async () => {
    const { status } = await call('/bulk', {
      body: { action: 'move', ids: ['s-1'], classId: 'class-b' }
    })
    expect(status).toBe(200)
    // studentLogin 用 students 覆盖 users，两边一致才是「登录后不回退」
    expect(student('990000001')).toMatchObject({ class_id: 'class-b', grade: 7 })
    expect(identity('990000001')).toMatchObject({ class_id_ref: 'class-b', grade: 7 })
  })

  it('目标班级名推不出年级时保留原年级，不写 0', async () => {
    const { data } = await call('/bulk', { body: { action: 'move', ids: ['s-1'], classId: 'class-x' } })
    expect(data.moved).toBe(1)
    expect(student('990000001').grade).toBe(6)
    expect(identity('990000001').grade).toBe(6)
    expect(student('990000001').class_id).toBe('class-x')
  })

  it('库里原本是脏 grade=0 且推不出年级时，转班把年级改成未知而不是继续写 0', async () => {
    db.prepare('UPDATE students SET grade = 0, course = ? WHERE id = ?').run('', 's-1')
    await call('/bulk', { body: { action: 'move', ids: ['s-1'], classId: 'class-x' } })
    expect(student('990000001').grade).toBeNull()
    expect(identity('990000001').grade).toBeNull()
  })

  it('显式 grade=0 不再被当成有效值吞掉班级推断', async () => {
    const { status } = await call('/students/s-2', {
      method: 'PUT', body: { grade: 0, course: '', className: '七年级B班' }
    })
    expect(status).toBe(200)
    expect(student('990000002').grade).toBe(7)
    expect(identity('990000002').grade).toBe(7)
  })

  it('新增学生缺班级返回 400，而不是 NOT NULL 崩成 500', async () => {
    const { status, data } = await call('/students', { body: { studentNo: '990000009', name: '示例辛' } })
    expect(status).toBe(400)
    expect(data.error).toContain('班级')
    expect(student('990000009')).toBeUndefined()
  })

  it('新增学生写 NULL 年级而不是 0', async () => {
    const { status } = await call('/students', {
      body: { studentNo: '990000010', name: '示例壬', className: '甲班' }
    })
    expect(status).toBe(200)
    expect(student('990000010').grade).toBeNull()
    expect(identity('990000010').grade).toBeNull()
  })
})

// Codex 决定本轮不全局开启 foreign_keys，所以这里锁住「关系断了也不丢人」的底线，
// 并把 classes.js 删班不清 students 这个孤儿来源写进反馈区等收口。
describe('孤儿关联兜底', () => {
  it('班级被别处删掉后名单仍列出该生，班级名为空而不是整行消失', async () => {
    db.prepare('DELETE FROM classes WHERE id = ?').run('class-a')
    const { status, data } = await call('/students')
    expect(status).toBe(200)
    expect(data.total).toBe(2)
    expect(data.students).toHaveLength(2)
    expect(data.students.every((s) => s.className === '')).toBe(true)
    expect(data.students.find((s) => s.studentNo === '990000001').gamePoints).toBe(1234)
  })

  it('库里 grade 为 NULL 的学生照旧列出，教师端不会把人筛丢', async () => {
    db.prepare('UPDATE students SET grade = NULL WHERE id = ?').run('s-2')
    const { data } = await call('/students')
    expect(data.students).toHaveLength(2)
    expect(data.students.find((s) => s.studentNo === '990000002').grade).toBeNull()
  })
})
