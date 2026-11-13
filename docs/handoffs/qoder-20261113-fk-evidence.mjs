// D14 取证脚本（Qoder，第八轮）：外键在**实际启动链**里到底强不强制，以及它管不到的缝在哪。
//
// 为什么要有这个文件：仓库里三处注释（server/utils/rosterRefs.js:3、server/routes/students.js:111、
// server/roster.test.js:479）都写着「库里没有开 PRAGMA foreign_keys / Codex 决定本轮不开」，
// 但 better-sqlite3 建库时默认就把它开着。结论到底是「有 SQLite 兜底、我们的闸可以放松」
// 还是「兜底只覆盖 DDL 声明过的父子关系、名单↔身份那条缝仍然没人管」，不能靠读注释拍脑袋。
// 这里用与服务启动完全相同的迁移链建一个内存库，逐条实测，可重跑、可进 CI。
//
// 只读语义的破坏性探测全部发生在 :memory: 沙箱里；不碰工作区默认库，不碰生产，不用真实名单。
// 用法：node docs/handoffs/qoder-20261113-fk-evidence.mjs
process.env.PET_GARDEN_DB = ':memory:'

const { db, initDb } = await import('../../server/db.js')
const { migrateV2 } = await import('../../server/game/migrate-v2.js')
const { migrateV3 } = await import('../../server/game/migrate-v3.js')
const { migrateRoster } = await import('../../server/game/migrate-roster.js')
const { ensureUserColumns } = await import('../../server/utils/userSchema.js')

initDb()
migrateV2()
migrateV3()
migrateRoster()
ensureUserColumns()

const say = (s) => console.log(s)
const results = []
const READER = /^\s*(SELECT|WITH|PRAGMA|EXPLAIN)/i

/** 跑一条语句：报错返回报错文本，成功返回影响/返回行数 */
function probe(sql, ...args) {
  try {
    const st = db.prepare(sql)
    if (READER.test(sql)) return { ok: true, detail: `查询成功，返回 ${st.all(...args).length} 行` }
    return { ok: true, detail: `执行成功，影响 ${st.run(...args).changes} 行` }
  } catch (e) {
    return { ok: false, detail: `${e.code ? e.code + ' ' : ''}${e.message}` }
  }
}

/** kind：blocked=必须被 SQLite 拦下，allowed=必须静悄悄通过（＝外键管不到） */
function expect(name, kind, detail, pattern = /FOREIGN KEY/i) {
  const hit = kind === 'blocked' ? pattern.test(detail) : /^执行成功/.test(detail)
  results.push({ name, kind, pass: hit, detail })
  say(`  ${hit ? '✅' : '❌'} ${name}\n      实测：${detail}`)
}

say('== 0. 建库参数（与实际进程同一条路径：new Database(path) 默认配置） ==')
say(`  PRAGMA foreign_keys = ${JSON.stringify(db.pragma('foreign_keys'))}`)
say(`  journal_mode = ${JSON.stringify(db.pragma('journal_mode'))} · 表 ${db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE type='table'").get().n} 张`)

say('')
say('== 1. DDL 里真正声明了的外键（父表 ← 子表.列） ==')
const edges = []
for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()) {
  for (const fk of db.prepare('SELECT * FROM pragma_foreign_key_list(?)').all(name)) {
    edges.push({ child: name, col: fk.from, parent: fk.table, ondelete: fk.on_delete })
  }
}
const byParent = {}
for (const e of edges) (byParent[e.parent] ??= []).push(e)
say(`  共 ${edges.length} 条外键约束，指向 ${Object.keys(byParent).length} 张父表；ON DELETE 全部是 ${[...new Set(edges.map(e => e.ondelete))].join('/')}`)
for (const [parent, list] of Object.entries(byParent)) {
  say(`    ${parent.padEnd(18)} ← ${list.map((l) => `${l.child}.${l.col}`).join(', ')}`)
}

say('')
say('== 2. 名单体系实际依赖、但 DDL 里没有外键的列 ==')
const fkCols = (t) => db.prepare('SELECT "from" AS col FROM pragma_foreign_key_list(?)').all(t).map((r) => r.col)
const userFks = fkCols('users')
const stuFks = fkCols('students')
say(`  users 声明的外键列：${userFks.length ? userFks.join(', ') : '（一条都没有）'} —— class_id_ref ${userFks.includes('class_id_ref') ? '在' : '不在'}其中`)
say(`  students 声明的外键列：${stuFks.length ? stuFks.join(', ') : '（一条都没有）'} —— student_no ${stuFks.includes('student_no') ? '在' : '不在'}其中`)
say('  → username（身份）与 student_no（档案）之间从来没有外键，也没有交叉校验，SQLite 不会替你挡任何一步。')

say('')
say('== 3. 沙箱铺虚构数据（99 开头假学号 + 示例姓名，全内存） ==')
const now = Date.now()
db.transaction(() => {
  db.prepare("INSERT OR IGNORE INTO pets_template (id, name, element, role) VALUES ('ptpl-art-1', '示例狐', '火', '输出')").run()
  db.prepare("INSERT INTO classes (id, user_id, name, created_at, updated_at) VALUES ('c1', NULL, '七年级Z班', ?, ?)").run(now, now)
  db.prepare("INSERT INTO classes (id, user_id, name, created_at, updated_at) VALUES ('c2', NULL, '八年级Y班', ?, ?)").run(now, now)
  db.prepare('INSERT INTO students (id, class_id, name, student_no, grade, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run('st1', 'c1', '示例甲', '990000801', 7, now)
  db.prepare('INSERT INTO users (id, username, password_hash, role, real_name, grade, class_id_ref, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run('u1', '990000801', '', 'student', '示例甲', 7, 'c1', now)
  db.prepare('INSERT INTO trainers (user_id, level) VALUES (?, 3)').run('u1')
  db.prepare("INSERT INTO player_pets (id, user_id, template_id) VALUES ('pp1', 'u1', 'ptpl-art-1')").run()
  db.prepare("INSERT INTO badges (id, student_id, pet_type, earned_at) VALUES ('b1', 'st1', 'fox', ?)").run(now)
  db.prepare("INSERT INTO evaluation_records (id, class_id, student_id, points, reason, category, timestamp) VALUES ('ev1', 'c1', 'st1', 5, '课堂', '课堂', ?)").run(now)
})()
say("  已铺：班级 c1/c2、档案 st1（示例甲 990000801）、身份 u1、trainers/player_pets/badges/evaluation_records 各 1 行")

say('')
say('== 4. 外键管得到的：删主行留子行 → SQLite 直接报错，而不是静默孤儿 ==')
let r = probe("DELETE FROM users WHERE id='u1'")
expect('删仍有 trainers/player_pets 挂载的身份', 'blocked', r.detail)
r = probe("DELETE FROM students WHERE id='st1'")
expect('删仍有 badges/evaluation_records 的档案', 'blocked', r.detail)
r = probe("INSERT INTO students (id, class_id, name, student_no, created_at) VALUES ('st9', 'c-none', '示例乙', '990000802', 1)")
expect('把档案挂到不存在的班级', 'blocked', r.detail)
// 第一轮交接单里我写过「better-sqlite3 默认 OFF，class_id='' 不会被外键拦」——这条是错的。
// 空串不是 NULL，外键照样校验；这里把当时那句错话的具体场景单独钉一遍，便于 Codex 核对更正。
r = probe("INSERT INTO students (id, class_id, name, student_no, created_at) VALUES ('st10', '', '示例戊', '990000803', 1)")
expect("把档案的 class_id 写成空串 ''（第一轮错判的场景）", 'blocked', r.detail)
r = probe("INSERT INTO player_pets (id, user_id, template_id) VALUES ('pp9', 'u-none', 'ptpl-art-1')")
expect('把宠物挂到不存在的身份', 'blocked', r.detail)
r = probe("DELETE FROM pets_template WHERE id='ptpl-art-1'")
expect('删还被宠物引用的模板', 'blocked', r.detail)
r = probe("DELETE FROM classes WHERE id='c1'")
expect('删还有档案的班级', 'blocked', r.detail)

say('')
say('== 5. 外键管不到的缝：4 条实测全部静悄悄通过（末尾附 1 条唯一索引对照） ==')
db.prepare("DELETE FROM badges WHERE id='b1'").run()
db.prepare("DELETE FROM evaluation_records WHERE id='ev1'").run()
r = probe("DELETE FROM students WHERE id='st1'")
expect('清掉子行后删档案：身份 u1（username=学号）原样留下 → 孤儿诞生', 'allowed', r.detail)
say(`      复核：students.st1 剩余 ${db.prepare('SELECT COUNT(*) n FROM students WHERE id=?').get('st1').n} 行，users.u1 仍在 ${db.prepare("SELECT COUNT(*) n FROM users WHERE id='u1'").get().n} 行，宠物仍挂着 ${db.prepare("SELECT COUNT(*) n FROM player_pets WHERE user_id='u1'").get().n} 行`)

r = probe("UPDATE users SET username='990000899' WHERE id='u1'")
expect('把身份改成名单里查无此人的学号（名单↔账号对不上）', 'allowed', r.detail)
r = probe("UPDATE users SET class_id_ref='c-none' WHERE id='u1'")
expect('把 users.class_id_ref 指向不存在的班（删班后的悬空引用）', 'allowed', r.detail)
r = probe("INSERT INTO students (id, class_id, name, student_no, created_at) VALUES ('st7', 'c2', '示例丙', '990000801', 1)")
expect('用「已被别的身份占用过的学号」新建档案', 'allowed', r.detail)
r = probe("INSERT INTO students (id, class_id, name, student_no, created_at) VALUES ('st6', 'c2', '示例丁', '990000801', 1)")
expect('同同学号再建一份档案（这条是唯一索引管的，不是外键）', 'blocked', r.detail, /UNIQUE/)

say('')
say('== 6. 结论 ==')
const cnt = (kind, pass) => results.filter((x) => x.kind === kind && x.pass === pass).length
// 拦下的两类要分开数：外键拦父子关系，唯一索引拦重复学号，混在一起报数会把机制说错。
const cntPattern = (kind, re) => results.filter((x) => x.kind === kind && x.pass && re.test(x.detail)).length
say(`  · foreign_keys 全程为 1：三处注释的说法不成立，建议更正为「外键默认开着，但只覆盖 DDL 声明过的父子关系」。`)
say(`  · ${cntPattern('blocked', /FOREIGN KEY/i)} 项「删主行留子行 / 挂到不存在的父行」被外键拦下：这类一致性不必再由 rosterRefs 的盘点重复兜底。`)
say(`  · ${cnt('allowed', true)} 项外键完全不管：username↔student_no、class_id_ref→classes.id 都没有约束，`)
say(`    「档案删了账号还在」「账号改成查无此人」「删班后班级引用悬空」都不会报错 —— 这正是 QD-08/QD-09/QD-11 预检闸不能被放松的原因。`)
say(`  · 最后一项说明唯一索引仍在：学号重复由 idx_students_student_no 拦，与外键是两套机制。`)
say(`  · 本脚本不改变任何写入口径：不全局开/关外键，不迁真实数据，等 Codex 决定注释更正与闸门去留。`)

const failed = results.filter((x) => !x.pass)
say('')
say(`===== D14 取证：${results.length - failed.length}/${results.length} 条与预期一致 =====`)
db.close()
process.exit(failed.length ? 1 : 0)
