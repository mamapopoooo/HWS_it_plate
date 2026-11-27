// D17 取证脚本（Qoder，第十轮）：Codex 本轮新增的 teacher_point_events 去重账本，
// 与「名单删除 / 改学号」这条链到底怎么相互作用。
//
// 为什么要有这个文件：
//   · server/utils/rosterRefs.js:13 的注释是我自己写的 ——「v3 加表时这里要一起加，
//     否则级联清理和引用盘点会各拿一份清单」。Codex 在 7a058e4 新增了按 user_id 挂的
//     teacher_point_events，而它**不在** USER_DATA_TABLES 里。
//   · 但这次**不能照注释直接加**：USER_DATA_TABLES 同时是 purgeStudent 的 DELETE 清单，
//     加进去就等于「删学生顺手删去重记录」，正是 Codex 在 FEEDBACK 里明令禁止、要求先交方案的做法。
//   所以这里只做实测取证，不改任何业务代码；结论用于交方案。
//
// 全部破坏性操作都在 :memory: 沙箱里，走**真实启动链 + 真实 express 路由 + 真实 token**；
// 不碰工作区默认库、不碰生产、不用真实名单（学号 9900009xx、姓名「示例甲/乙」全是虚构）。
// 用法：node docs/handoffs/qd17-teacher-events-probe.mjs
process.env.PET_GARDEN_DB = ':memory:'

const { db, initDb } = await import('../../server/db.js')
const { migrateV2 } = await import('../../server/game/migrate-v2.js')
const { migrateV3 } = await import('../../server/game/migrate-v3.js')
const { migrateRoster } = await import('../../server/game/migrate-roster.js')
const { ensureUserColumns } = await import('../../server/utils/userSchema.js')
const { generateToken } = await import('../../server/utils/token.js')
const { USER_DATA_TABLES, studentRefs, studentDeletable } = await import('../../server/utils/rosterRefs.js')
const { createTeacherPointsRoute } = await import('../../server/utils/teacherPoints.js')
const rosterRoutes = (await import('../../server/routes/roster.js')).default
const studentRoutes = (await import('../../server/routes/students.js')).default
const { authMiddleware } = await import('../../server/middleware/auth.js')
const express = (await import('express')).default
const { v4: uuidv4 } = await import('uuid')

initDb()
migrateV2()
migrateV3()
migrateRoster()
ensureUserColumns()

const say = (s) => console.log(s)
const results = []
/** 记录一条实测：pass 表示「与我预期一致」，不代表「系统没毛病」。
 *  kind='防线成立' 的条目是在替 Codex 证明他的保护有效；kind='缺口' 才是问题。 */
function expect(name, kind, actual, wanted) {
  const pass = JSON.stringify(actual) === JSON.stringify(wanted)
  results.push({ name, kind, pass })
  say(`  ${pass ? '✅' : '❌'} [${kind}] ${name}`)
  say(`      预期：${JSON.stringify(wanted)}　实测：${JSON.stringify(actual)}`)
}
const one = (sql, ...a) => db.prepare(sql).get(...a)
const count = (sql, ...a) => db.prepare(sql).get(...a).n

// ---------- 沙箱身份与班级 ----------
const adminId = uuidv4()
db.prepare("INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, 'qd17admin', '', 'admin', ?)")
  .run(adminId, Date.now())
const classId = uuidv4()
db.prepare('INSERT INTO classes (id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
  .run(classId, adminId, '六年级A班', Date.now(), Date.now())
const auth = { Authorization: `Bearer ${generateToken(adminId)}`, 'Content-Type': 'application/json' }

const app = express()
app.use(express.json())
app.use('/api/v3/roster', rosterRoutes)
app.use('/api/students', studentRoutes)
// 教师积分按 server/routes/game-v2.js:719 的原样挂载（同一路由工厂、同一 authMiddleware）
const v2 = express.Router()
v2.post('/teacher/sync-points', authMiddleware, createTeacherPointsRoute(db))
app.use('/api/v2', v2)
const server = app.listen(0)
await new Promise((r) => server.once('listening', r))
const base = `http://127.0.0.1:${server.address().port}`
async function call(method, path, body) {
  const res = await fetch(base + path, { method, headers: auth, body: body === undefined ? undefined : JSON.stringify(body) })
  let data = null
  try { data = await res.json() } catch { data = null }
  return { status: res.status, data }
}

say('== 0. 新表的外键声明与清单归属 ==')
expect('teacher_point_events 声明的外键条数', '事实', db.prepare('SELECT * FROM pragma_foreign_key_list(?)').all('teacher_point_events').length, 0)
expect('USER_DATA_TABLES 是否收录 teacher_point_events', '缺口', USER_DATA_TABLES.includes('teacher_point_events'), false)

say('')
say('== 1. 建学生 → 教师加 7 分（真实路由） ==')
const made = await call('POST', '/api/v3/roster/students', { studentNo: '990000901', name: '示例甲', classId })
expect('单条新增成功', '前置', made.status, 200)
const sid = one("SELECT id FROM students WHERE student_no='990000901'").id
const uid = one("SELECT id FROM users WHERE username='990000901'").id
const EV = 'qd17-event-00000001'
const rec = { eventId: EV, studentNo: '990000901', amount: 7, reason: '示例理由' }
const sync = await call('POST', '/api/v2/teacher/sync-points', { records: [rec] })
expect('教师积分入账', '前置', [sync.status, sync.data?.results?.[0]?.status], [200, 'applied'])
expect('余额 / 累计 / 流水 / 去重账本', '前置', [
  one('SELECT game_points g FROM users WHERE id=?', uid).g,
  one('SELECT total_points t FROM students WHERE id=?', sid).t,
  count('SELECT COUNT(*) n FROM game_points_records WHERE user_id=?', uid),
  count('SELECT COUNT(*) n FROM teacher_point_events WHERE user_id=?', uid)
], [7, 7, 1, 1])

say('')
say('== 2. 我的只读盘点漏没漏这张表 ==')
const refs = studentRefs('990000901')
// 注意：单条新增会顺带建 trainers 行（roster.js:170 附近），所以盘点里本来就有 1 行 trainers。
// 第一版脚本我漏算了它，把预期写成只有流水 1 行 —— 那是我的预期错，不是系统缺陷，已按实测更正。
expect('盘点报告的资产表名（不含去重账本）', '缺口', refs.assets.map((a) => a.table).sort(), ['game_points_records', 'trainers'])
expect('盘点报告的资产行数（账本那 1 行没被数进去）', '缺口', refs.assetRows, 2)
expect('旧 v1 删除入口仍被身份挡住', '防线成立', (await call('DELETE', `/api/students/${sid}`)).status, 409)
expect('studentDeletable 判定', '防线成立', studentDeletable(refs), false)

say('')
say('== 3. 名单管理删除后，去重账本与流水是否一致 ==')
const purged = await call('DELETE', `/api/v3/roster/students/${sid}`, { confirm: true })
expect('v3 删除成功', '前置', purged.status, 200)
expect('删除后：账本留存 / 流水已清 / 身份已清', '缺口', [
  count('SELECT COUNT(*) n FROM teacher_point_events WHERE user_id=?', uid),
  count('SELECT COUNT(*) n FROM game_points_records WHERE user_id=?', uid),
  count('SELECT COUNT(*) n FROM users WHERE id=?', uid)
], [1, 0, 0])
expect('账本行的 user_id 已成孤儿（查无此身份）', '缺口',
  count('SELECT COUNT(*) n FROM teacher_point_events e LEFT JOIN users u ON u.id=e.user_id WHERE e.user_id=? AND u.id IS NULL', uid), 1)
expect('删除回执是否提到留存的账本行', '缺口', Object.keys(purged.data).sort(), ['dataRows', 'success', 'userId'])

say('')
say('== 4. 同学号重新入库后重放旧 eventId：Codex 的防重还成不成立 ==')
const again = await call('POST', '/api/v3/roster/students', { studentNo: '990000901', name: '示例甲', classId })
expect('同学号重新新增', '前置', again.status, 200)
const uid2 = one("SELECT id FROM users WHERE username='990000901'").id
expect('换了新身份 id', '前置', uid2 !== uid, true)
const replay = await call('POST', '/api/v2/teacher/sync-points', { records: [rec] })
expect('重放同一 eventId 同一内容 → duplicate', '防线成立', replay.data?.results?.[0]?.status, 'duplicate')
expect('重放后余额仍为 0，没有二次入账', '防线成立', [
  one('SELECT game_points g FROM users WHERE id=?', uid2).g,
  count('SELECT COUNT(*) n FROM game_points_records WHERE user_id=?', uid2)
], [0, 0])

say('')
say('== 5. 改学号之后，教师端待提交队列会怎样 ==')
const made2 = await call('POST', '/api/v3/roster/students', { studentNo: '990000902', name: '示例乙', classId })
expect('第二名学生新增', '前置', made2.status, 200)
const sid2 = one("SELECT id FROM students WHERE student_no='990000902'").id
const EV2 = 'qd17-event-00000002'
expect('先入账 3 分', '前置',
  (await call('POST', '/api/v2/teacher/sync-points', { records: [{ eventId: EV2, studentNo: '990000902', amount: 3, reason: '示例理由' }] })).data?.results?.[0]?.status, 'applied')
const moved = await call('PUT', `/api/v3/roster/students/${sid2}`, { studentNo: '990000903' })
expect('改学号成功', '前置', moved.status, 200)
expect('账本 payload 仍是旧学号', '事实',
  JSON.parse(one('SELECT payload p FROM teacher_point_events WHERE event_id=?', EV2).p)[0], '990000902')
const stale = await call('POST', '/api/v2/teacher/sync-points', {
  records: [{ eventId: 'qd17-event-00000003', studentNo: '990000902', amount: 4, reason: '示例理由' }]
})
expect('队列里旧学号 + 新 eventId → 整批 409（安全失败，但教师队列会卡住）', '缺口', stale.status, 409)
expect('改用新学号则可入账', '防线成立',
  (await call('POST', '/api/v2/teacher/sync-points', { records: [{ eventId: 'qd17-event-00000004', studentNo: '990000903', amount: 4, reason: '示例理由' }] })).data?.results?.[0]?.status, 'applied')
expect('改学号后余额与累计跟着走', '防线成立', [
  one("SELECT game_points g FROM users WHERE username='990000903'").g,
  one("SELECT total_points t FROM students WHERE student_no='990000903'").t
], [7, 7])

say('')
const bad = results.filter((r) => !r.pass)
say(`===== D17 取证：${results.length - bad.length}/${results.length} 条与预期一致 =====`)
say(`  其中「防线成立」${results.filter((r) => r.kind === '防线成立' && r.pass).length} 条（Codex 的防重与占用保护有效，不夸大成漏洞）`)
say(`  「缺口」${results.filter((r) => r.kind === '缺口' && r.pass).length} 条（盘点漏表 / 账本孤儿 / 回执不提 / 改学号卡队列）`)
if (bad.length) for (const b of bad) say(`  ❌ 与预期不符：${b.name}`)
say('  说明：本脚本不改任何业务代码；teacher_point_events 的处置需先交方案（Codex 2026-11-16 指令）。')

await new Promise((r) => server.close(r))
db.close()
process.exitCode = bad.length ? 1 : 0