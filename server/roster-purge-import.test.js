// @vitest-environment node
// 完整启动 schema 下的删除与导入安全闸（QD-11 / QD-12，应 Codex 第六轮指令）。
//
// 为什么这里不手搓 mini DDL：purgeStudent 要遍历 18 张资产表，
// 表不齐时 rosterRefs 的「缺表」分支会把整段级联跳过 —— 测试照样绿，等于没测。
// 所以直接跑服务启动时同一条迁移链（initDb → migrateV2 → migrateV3 → migrateRoster → ensureUserColumns），
// 库用 PET_GARDEN_DB=:memory:，不落文件、不碰工作区默认库、也不需要 seeds。
// 姓名与学号全部虚构（99 开头假学号）。

process.env.PET_GARDEN_DB = ':memory:'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import express from 'express'
import { generateToken } from './utils/token.js'

let db, server, base, teacherToken, CASCADE

const FFD = String.fromCharCode(0xfffd)
const NO = (n) => `9900001${String(n).padStart(2, '0')}`

async function call(scope, path, { method, body } = {}) {
  const m = method ?? (body === undefined ? 'GET' : 'POST')
  const res = await fetch(`${base}${scope}${path}`, {
    method: m,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${teacherToken}` },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  return { status: res.status, data: await res.json().catch(() => null) }
}
const v1 = (path, opts) => call('/api/students', path, opts)
const v3 = (path, opts) => call('/api/v3/roster', path, opts)

const rows = (sql, ...a) => db.prepare(sql).all(...a)
const count = (sql, ...a) => db.prepare(sql).get(...a).n
const studentRow = (no) => db.prepare('SELECT * FROM students WHERE student_no = ?').get(no)
const userRow = (username) => db.prepare('SELECT * FROM users WHERE username = ?').get(username)

/** 一个身份名下还剩多少行游戏数据：按 user_id 挂的 18 张表 + 两张不按 user_id 直挂的表 */
function assetCount(userId) {
  let total = 0
  for (const table of CASCADE) total += count(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = ?`, userId)
  total += count('SELECT COUNT(*) AS n FROM battle_records WHERE player_a_id = ? OR player_b_id = ?', userId, userId)
  total += count(
    'SELECT COUNT(*) AS n FROM custom_pet_images WHERE custom_pet_id IN (SELECT id FROM custom_pets WHERE user_id = ?)',
    userId
  )
  return total
}

/** 给某个 user id 铺一份「他真的玩过后」的资产 */
function seedAssets(userId, tag) {
  db.prepare('INSERT INTO trainers (user_id, level, exp) VALUES (?, 5, 200)').run(userId)
  db.prepare("INSERT INTO player_pets (id, user_id, template_id, nickname) VALUES (?, ?, 'pet-1', ?)")
    .run(`pp-${tag}`, userId, `示例宠${tag}`)
  db.prepare("INSERT INTO gacha_records (id, user_id, egg_type, rarity) VALUES (?, ?, 'basic', 2)")
    .run(`gr-${tag}`, userId)
  db.prepare("INSERT INTO battle_records (id, battle_type, player_a_id, winner_id, created_at) VALUES (?, 'pvp', ?, ?, ?)")
    .run(`br-${tag}`, userId, userId, Date.now())
  db.prepare("INSERT INTO custom_pets (id, user_id, name, created_at) VALUES (?, ?, ?, ?)")
    .run(`cp-${tag}`, userId, `示例造物${tag}`, Date.now())
  db.prepare("INSERT INTO custom_pet_images (id, custom_pet_id, level, image_path) VALUES (?, ?, 1, '/x.png')")
    .run(`cpi-${tag}`, `cp-${tag}`)
}

function mkStudent(id, no, name) {
  db.prepare(`
    INSERT INTO students (id, class_id, name, student_no, name_en, grade, total_points, created_at)
    VALUES (?, 'class-a', ?, ?, '', 7, 0, ?)
  `).run(id, name, no, Date.now())
}

function mkIdentity(id, username, role, realName) {
  db.prepare(`
    INSERT INTO users (id, username, password_hash, role, real_name, grade, class_id_ref, is_guest, created_at, game_points)
    VALUES (?, ?, '', ?, ?, 7, 'class-a', 0, ?, 300)
  `).run(id, username, role, realName, Date.now())
}

beforeAll(async () => {
  const dbModule = await import('./db.js')
  db = dbModule.db
  dbModule.initDb()
  ;(await import('./game/migrate-v2.js')).migrateV2()
  ;(await import('./game/migrate-v3.js')).migrateV3()
  ;(await import('./game/migrate-roster.js')).migrateRoster()
  ;(await import('./utils/userSchema.js')).ensureUserColumns()
  CASCADE = (await import('./utils/rosterRefs.js')).USER_DATA_TABLES

  // 完整启动库里 player_pets.template_id 有外键指向 pets_template，而 seed 不跑就是空表。
  // 外键是强制的（见下面「完整启动库真的强制外键」那条），所以夹具必须先有一条真模板。
  db.prepare("INSERT OR IGNORE INTO pets_template (id, name, element, role) VALUES ('pet-1', '示例狐', '火', '输出')").run()

  const studentsRouter = (await import('./routes/students.js')).default
  const rosterRouter = (await import('./routes/roster.js')).default
  const app = express()
  app.use(express.json())
  app.use('/api/students', studentsRouter)
  app.use('/api/v3/roster', rosterRouter)
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve))
  db?.close()
})

beforeEach(() => {
  db.transaction(() => {
    // 清理顺序按外键来：图片挂在造物下，造物/评价/徽章又挂在 users 与 students 下，
    // 主行排在最后删。顺序错了 SQLite 直接报 FOREIGN KEY constraint failed（这恰好也是本文件想钉住的事实）。
    const teardown = [
      'custom_pet_images', 'battle_records', 'evaluation_records', 'badges',
      ...CASCADE.filter((t) => t !== 'custom_pets'), 'custom_pets',
      'users', 'students', 'classes'
    ]
    for (const table of teardown) db.prepare(`DELETE FROM ${table}`).run()
    db.prepare('INSERT INTO classes (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run('class-a', 'u-teacher', '七年级A班', Date.now(), Date.now())
    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, real_name, grade, is_guest, created_at)
      VALUES ('u-teacher', '998800001', '', 'teacher', '示例教师', 7, 0, ?)
    `).run(Date.now())

    // ① 只有裸学号身份 —— 名单管理该清得干净
    mkStudent('s-1', NO(1), '示例甲')
    mkIdentity('u-101', NO(1), 'student', '示例甲')
    seedAssets('u-101', 'a')
    // ② 只有旧 stu_ 前缀账号 —— purgeStudent 一行都碰不到它
    mkStudent('s-2', NO(2), '示例乙')
    mkIdentity(`u-${NO(2)}`, `stu_${NO(2)}`, 'student', '示例乙')
    seedAssets(`u-${NO(2)}`, 'b')
    // ③ 从没登录过
    mkStudent('s-3', NO(3), '示例丙')
    // ④ 双身份：裸学号 + 旧前缀，资产各在一边
    mkStudent('s-4', NO(4), '示例丁')
    mkIdentity('u-104', NO(4), 'student', '示例丁')
    mkIdentity(`u-${NO(4)}`, `stu_${NO(4)}`, 'student', '示例丁')
    seedAssets('u-104', 'd')
    seedAssets(`u-${NO(4)}`, 'd2')
    // ⑤ 学号被非学生角色占用
    mkStudent('s-5', NO(5), '示例戊')
    mkIdentity('u-105', NO(5), 'admin', '示例戊')
    seedAssets('u-105', 'e')

    db.prepare(`
      INSERT INTO evaluation_records (id, class_id, student_id, points, reason, category, timestamp)
      VALUES ('ev-1', 'class-a', 's-1', 5, '课堂表现', '课堂', ?), ('ev-2', 'class-a', 's-3', 3, '课堂表现', '课堂', ?)
    `).run(Date.now(), Date.now())
    db.prepare("INSERT INTO badges (id, student_id, pet_type, earned_at) VALUES ('bd-1', 's-1', 'fox', ?)").run(Date.now())
    teacherToken = generateToken('u-teacher')
  })()
})

describe('库本身的前提：外键到底强不强制', () => {
  it('better-sqlite3 默认就开着 foreign_keys，与三处注释的说法相反', () => {
    // rosterRefs.js:3、students.js:111、roster.test.js:479 都写「库里没有开 PRAGMA foreign_keys」。
    // 真实启动库里它一直是强制的：删主行时子行没清干净不是「留下孤儿」，而是 SQLite 直接报错。
    // 这条只钉住事实，不改任何删除口径 —— 是否据此放宽引用盘点留给 Codex 决定。
    expect(db.pragma('foreign_keys')).toEqual([{ foreign_keys: 1 }])
    expect(() => db.prepare("INSERT INTO custom_pets (id, user_id, name) VALUES ('cp-x', 'u-nope', '幽灵造物')").run())
      .toThrow(/FOREIGN KEY/)
    expect(count('SELECT COUNT(*) AS n FROM custom_pets WHERE id = ?', 'cp-x')).toBe(0)
  })
})

describe('QD-11 v3 单条删除：只清得掉的东西才算清得掉', () => {
  it('旧 stu_ 前缀账号不会被当成「已清理全部资产」', async () => {
    const before = assetCount(`u-${NO(2)}`)
    const { status, data } = await v3('/students/s-2', { method: 'DELETE', body: { confirm: true } })
    expect(status).toBe(409)
    expect(data.error).toContain('stu_')
    expect(studentRow(NO(2))).toBeTruthy()
    expect(userRow(`stu_${NO(2)}`)).toBeTruthy()
    expect(assetCount(`u-${NO(2)}`)).toBe(before)
  })

  it('同一学号有两条身份时拒绝，不挑一条删', async () => {
    const { status, data } = await v3('/students/s-4', { method: 'DELETE', body: { confirm: true } })
    expect(status).toBe(409)
    expect(data.refs.identities.map((i) => i.username).sort()).toEqual([NO(4), `stu_${NO(4)}`].sort())
    expect(studentRow(NO(4))).toBeTruthy()
    expect(userRow(NO(4))).toBeTruthy()
    expect(userRow(`stu_${NO(4)}`)).toBeTruthy()
  })

  it('学号被非学生角色占用也拒绝，且绝不动那条账号', async () => {
    const { status, data } = await v3('/students/s-5', { method: 'DELETE', body: { confirm: true } })
    expect(status).toBe(409)
    expect(data.error).toContain('非学生角色')
    expect(userRow(NO(5)).role).toBe('admin')
    expect(assetCount('u-105')).toBeGreaterThan(0)
  })

  it('唯一学生身份时 18 张资产表 + 两张旁挂表真的被清干净', async () => {
    expect(assetCount('u-101')).toBeGreaterThan(0)
    const { status, data } = await v3('/students/s-1', { method: 'DELETE', body: { confirm: true } })
    expect(status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.userId).toBe('u-101')
    expect(data.dataRows).toBeGreaterThan(0)
    expect(studentRow(NO(1))).toBeUndefined()
    expect(userRow(NO(1))).toBeUndefined()
    expect(assetCount('u-101')).toBe(0)
    expect(count('SELECT COUNT(*) AS n FROM evaluation_records WHERE student_id = ?', 's-1')).toBe(0)
    expect(count('SELECT COUNT(*) AS n FROM badges WHERE student_id = ?', 's-1')).toBe(0)
  })

  it('从没登录过的学生照常删，userId 为 null 且不算失败', async () => {
    const { status, data } = await v3('/students/s-3', { method: 'DELETE', body: { confirm: true } })
    expect(status).toBe(200)
    expect(data.userId).toBeNull()
    expect(studentRow(NO(3))).toBeUndefined()
  })

  it('缺 confirm 仍是 400，且不删任何东西（旧行为保留）', async () => {
    const { status } = await v3('/students/s-1', { method: 'DELETE', body: {} })
    expect(status).toBe(400)
    expect(studentRow(NO(1))).toBeTruthy()
  })
})

describe('QD-11 批量删除：先全批预检，再一个事务', () => {
  it('批里第 2 人有旧前缀账号 → 整批一行不删', async () => {
    const { status, data } = await v3('/bulk', {
      body: { action: 'delete', ids: ['s-1', 's-2', 's-3'], confirm: true }
    })
    expect(status).toBe(409)
    expect(data.blocked.map((b) => b.studentNo)).toEqual([NO(2)])
    for (const no of [NO(1), NO(2), NO(3)]) expect(studentRow(no)).toBeTruthy()
    // 被挡的人之外，其余人的资产也不能被动过
    expect(assetCount('u-101')).toBeGreaterThan(0)
    expect(count('SELECT COUNT(*) AS n FROM evaluation_records')).toBe(2)
  })

  it('全批干净时逐个清干净并回报数量', async () => {
    const { status, data } = await v3('/bulk', {
      body: { action: 'delete', ids: ['s-1', 's-3'], confirm: true }
    })
    expect(status).toBe(200)
    expect(data.deleted).toBe(2)
    expect(studentRow(NO(1))).toBeUndefined()
    expect(studentRow(NO(3))).toBeUndefined()
    expect(assetCount('u-101')).toBe(0)
  })

  it('中途数据库故障整批回滚，不留半批名单', async () => {
    // 只铺干净 ids：预检放行后才会真的进事务，这样才能测到「故障发生在第二条」时第一条有没有回滚。
    // s-2（旧前缀账号）会先被预检挡成 409，用它测回滚等于测不到事务。
    db.exec(`CREATE TRIGGER boom BEFORE DELETE ON students
      WHEN OLD.id = 's-3' BEGIN SELECT RAISE(ABORT, '模拟数据库故障'); END;`)
    try {
      const { status } = await v3('/bulk', { body: { action: 'delete', ids: ['s-1', 's-3'], confirm: true } })
      expect(status).toBe(500)
    } finally {
      db.exec('DROP TRIGGER boom')
    }
    expect(studentRow(NO(1))).toBeTruthy()
    expect(studentRow(NO(3))).toBeTruthy()
    expect(assetCount('u-101')).toBeGreaterThan(0)
    expect(count('SELECT COUNT(*) AS n FROM evaluation_records')).toBe(2)
  })

  it('同一个 id 传两次只算删一个人', async () => {
    const { status, data } = await v3('/bulk', {
      body: { action: 'delete', ids: ['s-3', 's-3'], confirm: true }
    })
    expect(status).toBe(200)
    expect(data.deleted).toBe(1)
  })

  it('不存在的 id 单独回报，不影响其他人删除', async () => {
    const { status, data } = await v3('/bulk', {
      body: { action: 'delete', ids: ['s-3', 'ghost-id'], confirm: true }
    })
    expect(status).toBe(200)
    expect(data.deleted).toBe(1)
    expect(data.notFound).toEqual(['ghost-id'])
  })
})

describe('QD-12 v1 批量导入：整批预检 + 一个事务，旧响应保留', () => {
  const importBody = (students) => ({ classId: 'class-a', students })

  it('干净批次仍返回 { success, imported }，行数与库里一致', async () => {
    const { status, data } = await v1('/import', {
      body: importBody([
        { name: '示例己', studentNo: NO(6) },
        { name: '示例庚', studentNo: NO(7) }
      ])
    })
    expect(status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.imported).toBe(2)
    expect(count('SELECT COUNT(*) AS n FROM students WHERE class_id = ?', 'class-a')).toBe(7)
    expect(studentRow(NO(6))).toMatchObject({ name: '示例己', class_id: 'class-a' })
  })

  it('批内重复学号：整批不写，而不是第二行撞唯一索引崩半批', async () => {
    const before = count('SELECT COUNT(*) AS n FROM students')
    const { status, data } = await v1('/import', {
      body: importBody([
        { name: '示例辛', studentNo: NO(8) },
        { name: '示例辛', studentNo: NO(8) }
      ])
    })
    expect(status).toBe(409)
    expect(data.conflicts[0].reason).toContain('同一份表格里这个学号出现多次')
    expect(count('SELECT COUNT(*) AS n FROM students')).toBe(before)
    expect(studentRow(NO(8))).toBeUndefined()
  })

  it('学号已在名单里：409 且不覆盖原行', async () => {
    const { status, data } = await v1('/import', { body: importBody([{ name: '改名试试', studentNo: NO(1) }]) })
    expect(status).toBe(409)
    expect(data.conflicts[0].reason).toContain('名单里已有这个学号')
    expect(studentRow(NO(1)).name).toBe('示例甲')
    expect(count('SELECT COUNT(*) AS n FROM students WHERE name = ?', '改名试试')).toBe(0)
  })

  it('学号被已有登录身份占用（档案已被删过的那种）：拒绝自动认领，零写入', async () => {
    // 先按「安全删除」的姿势把 s-3 的档案连带记录清掉（评价/徽章有外键，不先删就删不动学生行），
    // 只留下 users 里那条身份 —— 这正是历史库里「人在账号在、档案没了」的形态。
    db.prepare("DELETE FROM evaluation_records WHERE student_id = 's-3'").run()
    db.prepare("DELETE FROM students WHERE student_no = ?").run(NO(3))
    db.prepare(`INSERT INTO users (id, username, password_hash, role, real_name, created_at)
      VALUES ('u-orphan', ?, '', 'student', '示例丙', ?)`).run(NO(3), Date.now())
    const { status, data } = await v1('/import', { body: importBody([{ name: '示例丙', studentNo: NO(3) }]) })
    expect(status).toBe(409)
    expect(data.conflicts[0].reason).toContain('已有账号占用')
    expect(studentRow(NO(3))).toBeUndefined()
    expect(userRow(NO(3)).id).toBe('u-orphan')
  })

  it('旧 stu_ 前缀账号占着这个学号时也拒绝', async () => {
    // 档案已被删过、只剩旧前缀账号的形态：不加这句，NO(2) 会先撞上「名单里已有这个学号」，测不到身份占用这条闸
    db.prepare('DELETE FROM students WHERE student_no = ?').run(NO(2))
    const { status, data } = await v1('/import', { body: importBody([{ name: '示例壬', studentNo: NO(2) }]) })
    expect(status).toBe(409)
    expect(data.conflicts[0].reason).toContain('已有账号占用')
    expect(studentRow(NO(2))).toBeUndefined()
    expect(userRow(`stu_${NO(2)}`).id).toBeTruthy()
  })

  it('提交 stu_ 形态的学号而它属于名单里另一人：拒绝', async () => {
    const { status, data } = await v1('/import', { body: importBody([{ name: '示例癸', studentNo: `stu_${NO(1)}` }]) })
    expect(status).toBe(409)
    expect(data.conflicts[0].reason).toContain('旧前缀账号')
    expect(userRow(`stu_${NO(1)}`)).toBeUndefined()
  })

  it('非法行整批退回 400，一行都不写', async () => {
    const before = count('SELECT COUNT(*) AS n FROM students')
    const { status, data } = await v1('/import', {
      body: importBody([
        { name: '示例子', studentNo: NO(9) },
        null,
        { name: { 坏: '结构' }, studentNo: NO(10) }
      ])
    })
    expect(status).toBe(400)
    expect(data.malformed.map((m) => m.index)).toEqual([1, 2])
    expect(count('SELECT COUNT(*) AS n FROM students')).toBe(before)
    expect(studentRow(NO(9))).toBeUndefined()
  })

  it('乱码行按编码红线整批拒绝，不入库', async () => {
    const { status, data } = await v1('/import', {
      body: importBody([{ name: `示例${FFD}己`, studentNo: NO(11) }])
    })
    expect(status).toBe(400)
    expect(data.malformed[0].reason).toContain('乱码')
    expect(studentRow(NO(11))).toBeUndefined()
  })

  it('空白姓名沿用旧行为：跳过并计数，其余行照常写入', async () => {
    const before = count('SELECT COUNT(*) AS n FROM students')
    const { status, data } = await v1('/import', {
      body: importBody([{ name: '   ', studentNo: NO(12) }, { name: '示例丑', studentNo: NO(13) }])
    })
    expect(status).toBe(200)
    expect(data.imported).toBe(1)
    expect(data.skipped).toBe(1)
    expect(count('SELECT COUNT(*) AS n FROM students')).toBe(before + 1)
    expect(studentRow(NO(12))).toBeUndefined()
  })

  it('没有学号的行仍允许建档（多个空学号不算重复），沿用旧接口语义', async () => {
    const { status, data } = await v1('/import', { body: importBody([{ name: '示例寅' }, { name: '示例卯' }]) })
    expect(status).toBe(200)
    expect(data.imported).toBe(2)
    expect(count('SELECT COUNT(*) AS n FROM students WHERE student_no IS NULL')).toBe(2)
  })

  it('数据库意外失败整批回滚，imported 不把未提交行算成成功', async () => {
    const before = count('SELECT COUNT(*) AS n FROM students')
    db.exec(`CREATE TRIGGER boom BEFORE INSERT ON students
      WHEN NEW.student_no = '${NO(15)}' BEGIN SELECT RAISE(ABORT, '模拟数据库故障'); END;`)
    try {
      const { status } = await v1('/import', {
        body: importBody([{ name: '示例巳', studentNo: NO(14) }, { name: '示例午', studentNo: NO(15) }])
      })
      expect(status).toBe(500)
    } finally {
      db.exec('DROP TRIGGER boom')
    }
    expect(count('SELECT COUNT(*) AS n FROM students')).toBe(before)
    expect(studentRow(NO(14))).toBeUndefined()
  })

  it('不套用 v3 的新生规则：推不出年级、没有英文名也照样收（旧入口口径不同）', async () => {
    db.prepare('INSERT INTO classes (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run('class-y', 'u-teacher', '甲班', Date.now(), Date.now())
    const { status, data } = await v1('/import', {
      body: { classId: 'class-y', students: [{ name: '示例未', studentNo: NO(16) }] }
    })
    // v3 /roster/import 对「推不出年级」的新生的处理与此不同；这个入口只认三列，照样建档。
    expect(status).toBe(200)
    expect(data.imported).toBe(1)
    const s = studentRow(NO(16))
    expect(s.class_id).toBe('class-y')
    // 旧入口不写 grade，落的是列默认 0 —— 与 v3「未知写 NULL」的口径不一致，本用例只钉住现状，
    // 是否统一留给 Codex 决定（见 REPORT 第七轮待决定项）。
    expect(s.grade).toBe(0)
    expect(s.name_en).toBe('')
  })

  it('缺参数与班级不存在沿用旧响应，不写任何行', async () => {
    const before = count('SELECT COUNT(*) AS n FROM students')
    expect((await v1('/import', { body: { students: [{ name: '示例申', studentNo: NO(17) }] } })).status).toBe(400)
    expect((await v1('/import', { body: { classId: 'class-a' } })).status).toBe(400)
    expect((await v1('/import', { body: { classId: 'class-a', students: '不是数组' } })).status).toBe(400)
    const missing = await v1('/import', { body: { classId: 'class-none', students: [{ name: '示例申', studentNo: NO(17) }] } })
    expect(missing.status).toBe(404)
    expect(missing.data.error).toBe('班级不存在')
    expect(rows('SELECT * FROM students WHERE class_id = ?', 'class-none')).toEqual([])
    expect(count('SELECT COUNT(*) AS n FROM students')).toBe(before)
  })
})
