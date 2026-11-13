// 名单体系迁移：students 表升级为花名册权威源
// 背景：登录/积分原先只读 users，students 是 v1 遗留且从不参与认证。
// 现在名单以 students 为准，users 继续承载登录身份与游戏数据，两表用学号打通。
// 原则：只加不删，旧字段保留。
//
// v11 是给 v9/v10 擦屁股的：旧版把 ALTER TABLE 和 CREATE UNIQUE INDEX 全裹在 try{}catch{} 里，
// 失败也照样 markApplied，于是出现过「版本表说迁移完成、库里却没有学号唯一索引」的库。
// 学号唯一索引是登录按学号定位的前提，缺了它导入会静默造出双份身份。
// 现在补列/建索引失败一律抛出，不记版本号；重复学号先预检，预检不过就中止。

import { db } from '../db.js'

// [表, 列, 定义]
const ROSTER_COLUMNS = [
  // 英文名：学生可用中文名或英文名任一种登录
  ['students', 'name_en', "TEXT DEFAULT ''"],
  ['students', 'gender', "TEXT DEFAULT ''"],
  // grade 用 6/7 这种整数，与 users.grade 同口径，便于按年级筛选；未知写 NULL，代码里不写 0
  ['students', 'grade', 'INTEGER DEFAULT 0'],
  ['students', 'course', "TEXT DEFAULT ''"],
  // 学生登录身份也要英文名，教师端与登录页都直接读 users，省掉一次 JOIN
  ['users', 'name_en', "TEXT DEFAULT ''"]
]

// [索引名, 表, 列, 是否唯一]
// SQLite 的 UNIQUE 索引允许 NULL，历史脏数据不至于建索引失败。
const ROSTER_INDEXES = [
  ['idx_students_student_no', 'students', 'student_no', true],
  // users.class_id_ref 建表以来从未写入过，现在用来挂班级
  ['idx_users_class_ref', 'users', 'class_id_ref', false]
]

const hasColumn = (table, col) =>
  db.prepare('SELECT name FROM pragma_table_info(?)').all(table).some((r) => r.name === col)

/** 按「该列上有没有唯一索引」判定，而不是按索引名：历史库里同名索引可能压根没建成 */
function hasUniqueIndex(table, col) {
  for (const idx of db.prepare('SELECT name, "unique" AS is_unique FROM pragma_index_list(?)').all(table)) {
    if (!idx.is_unique) continue
    const cols = db.prepare('SELECT name FROM pragma_index_info(?)').all(idx.name).map((r) => r.name)
    if (cols.length === 1 && cols[0] === col) return true
  }
  return false
}

const hasPlainIndex = (name) =>
  !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?").get(name)

/** 建唯一索引前必须确认学号不重复：重复的话 DDL 直接失败，得让教师先清理，而不是悄悄跳过 */
function assertUniqueStudentNo() {
  const groups = db.prepare(`
    SELECT COUNT(*) AS n FROM (
      SELECT COALESCE(NULLIF(student_no, ''), '(空学号)') AS no
      FROM students GROUP BY no HAVING COUNT(*) > 1
    )
  `).get().n
  if (groups) {
    throw new Error(
      `[名单迁移] 名单里有 ${groups} 组重复学号，学号唯一索引建不起来。` +
      '请先在教师端名单里改正学号后重启服务（迁移会自动重试）。'
    )
  }
}

function ensureColumn(table, col, def) {
  if (hasColumn(table, col)) return false
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`)
  } catch (e) {
    throw new Error(`[名单迁移] 给 ${table} 加列 ${col} 失败：${e.message}`)
  }
  // ALTER 返回成功但列没出现（例如表名打错、库被锁、SQL 被截断）也要报错，
  // 否则版本号一记，这个缺列的库再也不会被修。
  if (!hasColumn(table, col)) {
    throw new Error(`[名单迁移] ${table}.${col} 执行完仍不存在，DDL 未生效`)
  }
  return true
}

function ensureIndex(table, col, unique, name) {
  if (unique ? hasUniqueIndex(table, col) : hasPlainIndex(name)) return false
  // 索引的前置列由更早的迁移负责（例如 users.class_id_ref 来自 v2/v3）。
  // 少了它就直说缺前置列，而不是抛 SQLite 的 no such column 让人猜。
  if (!hasColumn(table, col)) {
    throw new Error(`[名单迁移] 建索引 ${name} 需要 ${table}.${col}，但该列不存在——启动顺序应为 initDb → migrateV2 → migrateV3 → migrateRoster`)
  }
  if (unique) assertUniqueStudentNo()
  // 同名但口径不对的旧索引（v9 当年可能建成非唯一）先删再建：
  // 索引删了可以重建，不动任何数据，留着它反而让 CREATE ... IF NOT EXISTS 静默跳过。
  if (hasPlainIndex(name)) db.exec(`DROP INDEX ${name}`)
  try {
    db.exec(
      `CREATE ${unique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS ${name} ON ${table}(${col})`
    )
  } catch (e) {
    throw new Error(`[名单迁移] 建索引 ${name}（${table}.${col}）失败：${e.message}`)
  }
  if (unique ? !hasUniqueIndex(table, col) : !hasPlainIndex(name)) {
    throw new Error(`[名单迁移] 索引 ${name} 执行完仍不存在，DDL 未生效`)
  }
  return true
}

export function migrateRoster() {
  // 独立跑脚本时 migrateV3 可能还没建版本表，这里自己兜一层
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `)

  const applied = (v) => db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(v)
  const markApplied = (v, name) =>
    db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
      .run(v, name, Date.now())

  if (!applied(9)) {
    // v9 的原始职责：students 四个名单列 + 学号唯一索引。任一步失败就抛出，不记版本。
    for (const [table, col, def] of ROSTER_COLUMNS) {
      if (table === 'students') ensureColumn(table, col, def)
    }
    ensureIndex('students', 'student_no', true, 'idx_students_student_no')
    markApplied(9, 'roster_students_source_of_truth')
    console.log('✅ [v9] 名单迁移：students 加 name_en/gender/grade/course + 学号唯一索引')
  }

  if (!applied(10)) {
    ensureColumn('users', 'name_en', "TEXT DEFAULT ''")
    markApplied(10, 'roster_users_name_en')
    console.log('✅ [v10] users 加 name_en（登录身份同步英文名）')
  }

  if (!applied(11)) {
    // 复核并补齐：对已经被错标成 v9/v10 完成的库，用 PRAGMA 查真实列和真实索引，缺什么补什么。
    const repaired = []
    for (const [table, col, def] of ROSTER_COLUMNS) {
      if (ensureColumn(table, col, def)) repaired.push(`${table}.${col}`)
    }
    for (const [name, table, col, unique] of ROSTER_INDEXES) {
      if (ensureIndex(table, col, unique, name)) repaired.push(name)
    }
    markApplied(11, 'roster_verify_columns_and_unique_index')
    console.log(
      repaired.length
        ? `✅ [v11] 名单复核：补齐 ${repaired.join('、')}`
        : '✅ [v11] 名单复核：列与学号唯一索引齐备'
    )
  }
}
