// 名单缺陷复现脚本：IN-03 / IN-04 / IN-05 / IN-06（Codex 整合方案 2026-11-13）
//
// 隔离方式（对应方案 §8 的硬要求）：
//   把整棵 server/ 复制到运行期沙箱目录，**排除 *.db**，所以副本里的 db.js
//   打开的是沙箱内一个全新的空库 —— 既不碰真实数据库，也不碰冻结源码。
//   端口用 listen(0) 随机分配，进程退出即回收，不占用他人端口。
//
// 用法：node docs/handoffs/qoder-20261113-repro.mjs
// 判定：输出「复现成功」= 缺陷仍在；修复合入后应全部变成「未复现」，退出码 0。
//       若异常中断残留沙箱，手工删除仓库根目录下的 .repro-* 即可。

import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import express from 'express'

const REPO = path.resolve(import.meta.dirname, '..', '..')
const sandboxes = []
const handles = []

function sandbox(tag) {
  const dir = path.join(REPO, `.repro-${tag}-${process.pid}`)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.cpSync(path.join(REPO, 'server'), path.join(dir, 'server'), {
    recursive: true,
    filter: (p) => !p.endsWith('.db')
  })
  sandboxes.push(dir)
  return { dir, load: (rel) => import(pathToFileURL(path.join(dir, 'server', rel)).href) }
}

function cleanup() {
  // Windows 上 SQLite 句柄没关就删目录会 EPERM，所以先关库再删，并容忍删失败
  for (const h of handles) {
    try { h.close() } catch {}
  }
  for (const d of sandboxes) {
    try {
      fs.rmSync(path.join(d, 'server', 'pet-garden.db'), { force: true, maxRetries: 5, retryDelay: 100 })
    } catch {}
    try {
      fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    } catch (e) {
      console.log(`⚠️ 沙箱未自动回收，请手工删除 ${d}`)
    }
  }
}
process.on('exit', cleanup)

const findings = []
function report(id, title, expected, actual, buggy) {
  findings.push({ id, title, buggy })
  console.log(`\n[${id}] ${title}`)
  console.log(`  正确应为：${expected}`)
  console.log(`  实际结果：${actual}`)
  console.log(`  判定：${buggy ? '复现成功（缺陷仍在）' : '未复现（已修复）'}`)
}

// ---------- 沙箱 A：完整启动链 + 路由真跑 ----------
const A = sandbox('full')
const dbMod = await A.load('db.js')
const db = dbMod.db
handles.push(db)
const { migrateV2 } = await A.load('game/migrate-v2.js')
const { migrateV3 } = await A.load('game/migrate-v3.js')
const { migrateRoster } = await A.load('game/migrate-roster.js')
const { generateToken } = await A.load('utils/token.js')

// 与 server/index.js:47-50 完全一致的启动顺序
dbMod.initDb()
migrateV2()
migrateV3()
migrateRoster()

const NOW = Date.now()
const mkClass = (id, name) =>
  db.prepare('INSERT INTO classes (id, user_id, name, created_at, updated_at) VALUES (?, NULL, ?, ?, ?)')
    .run(id, name, NOW, NOW)
mkClass('c-g6a', '六年级A班')
mkClass('c-g7b', '七年级B班')

// 虚构学生：绝不能拿真实名单跑这个脚本
db.prepare(`
  INSERT INTO students (id, class_id, name, student_no, name_en, gender, grade, course, total_points, created_at)
  VALUES ('s-1', 'c-g6a', '示例同学A', '900001', 'Alice Example', '女', 6, '信息技术 G6', 500, ?)
`).run(NOW)
db.prepare(`
  INSERT INTO users (id, username, password_hash, role, real_name, name_en, grade, class_id_ref,
                     is_guest, created_at, game_points, last_login_at)
  VALUES ('u-1', '900001', '', 'student', '示例同学A', 'Alice Example', 6, 'c-g6a', 0, ?, 1234, ?)
`).run(NOW, NOW - 60000)
db.prepare('INSERT INTO trainers (user_id) VALUES (?)').run('u-1')

db.prepare(`
  INSERT INTO users (id, username, password_hash, role, real_name, is_guest, created_at)
  VALUES ('u-t', 'teacher-demo', '', 'teacher', '示例教师', 0, ?)
`).run(NOW)

const app = express()
app.use(express.json())
app.use('/api/v3/roster', (await A.load('routes/roster.js')).default)
app.use('/api/v2', (await A.load('routes/game-v2.js')).default)
const server = app.listen(0)
await new Promise((r) => server.once('listening', r))
const base = `http://127.0.0.1:${server.address().port}`
const auth = { Authorization: `Bearer ${generateToken('u-t')}` }
const get = async (p) => (await fetch(`${base}${p}`, { headers: auth })).json()
const post = async (p, body, h = auth) => {
  const res = await fetch(`${base}${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...h },
    body: JSON.stringify(body)
  })
  return { status: res.status, json: await res.json().catch(() => null) }
}
const row = (sql, ...a) => db.prepare(sql).get(...a)

// ---- IN-03 名单查询：积分与登录状态 ----
{
  const list = await get('/api/v3/roster/students?q=900001')
  const s = list.students?.[0] || {}
  report(
    'IN-03',
    'roster 查询别名与映射键不一致 → 教师端全员 0 分、全员未登录',
    'gamePoints=1234、loggedIn=true',
    `gamePoints=${JSON.stringify(s.gamePoints)}、loggedIn=${JSON.stringify(s.loggedIn)}`,
    s.gamePoints !== 1234 || s.loggedIn !== true
  )
}

// ---- IN-04 简表导入：Codex 写的是「缺席列清空」，实测要分两种情况 ----
{
  // A：表格完全没有班级列 → class_id=null 撞 students.class_id 的 NOT NULL，整批回滚并报 500
  const a = await post('/api/v3/roster/import', { rows: [{ studentNo: '900001', name: '示例同学A' }] })
  const keep = row("SELECT name_en, course, grade, class_id FROM students WHERE student_no='900001'")
  report(
    'IN-04A',
    '无班级列的简表导入不是「清空」，是 500 崩溃（NOT NULL）+ 整批回滚',
    `应返回 4xx 带人话错误，且不写库（status=200 或 4xx，绝不是 500）`,
    `status=${a.status}；回滚后档案完好：name_en=${JSON.stringify(keep.name_en)} grade=${keep.grade}`,
    a.status >= 500
  )

  // B：有班级列但缺英文名/课程列 → 静默把已有档案清空，这才是 Codex 描述的那种丢数据
  const b = await post('/api/v3/roster/import', {
    rows: [{ studentNo: '900001', name: '示例同学A', class: '六年级A班' }]
  })
  const wiped = row("SELECT name_en, course, grade, class_id FROM students WHERE student_no='900001'")
  const userWiped = row("SELECT name_en, class_id_ref FROM users WHERE username='900001'")
  report(
    'IN-04B',
    '缺席的英文名列/课程列被静默清空（用户已定语义：只更新表格出现的列）',
    '导入成功且 name_en 仍为 "Alice Example"、course 仍为 "信息技术 G6"',
    `status=${b.status}；students: name_en=${JSON.stringify(wiped.name_en)} course=${JSON.stringify(wiped.course)} grade=${wiped.grade} class_id=${JSON.stringify(wiped.class_id)}；users.name_en=${JSON.stringify(userWiped.name_en)}`,
    wiped.name_en === '' && wiped.course === ''
  )
}

// ---- IN-06 转班：students.grade 不同步，登录后被旧值覆盖 ----
{
  const r = await post('/api/v3/roster/bulk', { action: 'move', ids: ['s-1'], className: '七年级B班' })
  const moved = row("SELECT class_id, grade FROM students WHERE id='s-1'")
  const u1 = row("SELECT grade FROM users WHERE username='900001'")
  const login = await post('/api/v2/auth/student/login', { studentNo: '900001', realName: '示例同学A' }, {})
  const u2 = row("SELECT grade FROM users WHERE username='900001'")
  report(
    'IN-06',
    '转班后学生一登录，年级又被名单旧值滚回去',
    `转班后 students.class_id 变七年级、students.grade=7、users.grade 恒为 7（status=${r.status} login=${login.status}）`,
    `students: class_id=${moved.class_id} grade=${moved.grade}；users.grade 转班后=${u1.grade}，登录后=${u2.grade}`,
    moved.grade !== 7 || u2.grade !== 7
  )
}

server.close()

// ---------- 沙箱 B：迁移 v9 在建索引失败时仍记成功 ----------
{
  const B = sandbox('mig')
  const bMod = await B.load('db.js')
  const b = bMod.db
  handles.push(b)
  const { migrateRoster: mRoster } = await B.load('game/migrate-roster.js')
  bMod.initDb()

  // v1 建表语句里 student_no 没有表级 UNIQUE，所以重复学号能插进来
  b.prepare('INSERT INTO classes (id, user_id, name, created_at, updated_at) VALUES (?, NULL, ?, ?, ?)')
    .run('c-dup', '六年级A班', NOW, NOW)
  for (const [id, name] of [['s-a', '示例同学B'], ['s-b', '示例同学C']]) {
    b.prepare('INSERT INTO students (id, class_id, name, student_no, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, 'c-dup', name, '900002', NOW)
  }

  mRoster()

  const idx = b.prepare("SELECT name FROM pragma_index_list('students') WHERE \"unique\" = 1").all()
  const hasUnique = idx.some((i) => i.name === 'idx_students_student_no')
  const marked = b.prepare('SELECT 1 FROM schema_migrations WHERE version = 9').get()
  report(
    'IN-05',
    '学号唯一索引建失败被 catch 吞掉，仍把 v9 记为已完成',
    '重复学号应中止迁移并报错，不得标记版本 9',
    `唯一索引存在=${hasUnique}；schema_migrations 已记 v9=${!!marked}`,
    !hasUnique && !!marked
  )
}

cleanup()

const stillBuggy = findings.filter((f) => f.buggy)
console.log('\n================ 汇总 ================')
for (const f of findings) console.log(`${f.buggy ? '❌' : '✅'} ${f.id} ${f.title}`)
console.log(`\n缺陷仍在：${stillBuggy.length} / ${findings.length}`)
process.exitCode = stillBuggy.length
