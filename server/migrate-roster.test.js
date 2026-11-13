// @vitest-environment node
// QD-04 名单迁移回归：补列/建索引失败不得吞错记版本；重复学号预检即中止；版本 11 修复被错标的库。
// 全部内存库 + 假学号，不碰 server/pet-garden.db。
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Database from 'better-sqlite3'

let db

/** v8 时代的最小表结构：students 还没有名单四列，users 还没有 name_en */
function baseDb() {
  const d = new Database(':memory:')
  d.exec(`
    CREATE TABLE classes (id TEXT PRIMARY KEY, name TEXT);
    CREATE TABLE students (id TEXT PRIMARY KEY, class_id TEXT NOT NULL, name TEXT NOT NULL,
      student_no TEXT, total_points INTEGER DEFAULT 0, created_at INTEGER);
    CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'student', real_name TEXT DEFAULT '', grade INTEGER, class_id_ref TEXT,
      is_guest INTEGER DEFAULT 0, created_at INTEGER, game_points INTEGER DEFAULT 0, last_login_at INTEGER);
    CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at INTEGER NOT NULL);
  `)
  return d
}

const hasCol = (d, table, col) =>
  d.prepare('SELECT name FROM pragma_table_info(?)').all(table).some((r) => r.name === col)

const hasUniqueOn = (d, table, col) =>
  d.prepare('SELECT name, "unique" AS is_unique FROM pragma_index_list(?)').all(table)
    .filter((i) => i.is_unique)
    .some((i) => {
      const cols = d.prepare('SELECT name FROM pragma_index_info(?)').all(i.name).map((r) => r.name)
      return cols.length === 1 && cols[0] === col
    })

const versions = (d) => d.prepare('SELECT version FROM schema_migrations ORDER BY version').all().map((r) => r.version)

async function loadMigrator(instance) {
  db = instance
  vi.resetModules()
  vi.doMock('./db.js', () => ({ db }))
  return (await import('./game/migrate-roster.js')).migrateRoster
}

describe('migrateRoster', () => {
  let migrate

  beforeEach(async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    migrate = await loadMigrator(baseDb())
  })

  it('全新库依次记 v9/v10/v11，列与学号唯一索引齐备', () => {
    migrate()
    expect(versions(db)).toEqual([9, 10, 11])
    for (const col of ['name_en', 'gender', 'grade', 'course']) expect(hasCol(db, 'students', col)).toBe(true)
    expect(hasCol(db, 'users', 'name_en')).toBe(true)
    expect(hasUniqueOn(db, 'students', 'student_no')).toBe(true)
    expect(db.prepare("SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_users_class_ref'").get()).toBeTruthy()
  })

  it('重复跑不会重复记版本', () => {
    migrate()
    migrate()
    expect(versions(db)).toEqual([9, 10, 11])
    expect(db.prepare('SELECT COUNT(*) AS n FROM schema_migrations').get().n).toBe(3)
  })

  it('被错标成 v9/v10 完成、实际缺列缺索引的库由 v11 补齐', () => {
    // 旧版迁移把失败也 markApplied 了：版本表说 9/10 都做过，库里却什么都没落地
    db.prepare('INSERT INTO schema_migrations VALUES (9, ?, 1)').run('roster_students_source_of_truth')
    db.prepare('INSERT INTO schema_migrations VALUES (10, ?, 1)').run('roster_users_name_en')
    expect(hasCol(db, 'students', 'name_en')).toBe(false)
    expect(hasUniqueOn(db, 'students', 'student_no')).toBe(false)

    migrate()

    expect(hasCol(db, 'students', 'name_en')).toBe(true)
    expect(hasCol(db, 'students', 'grade')).toBe(true)
    expect(hasCol(db, 'users', 'name_en')).toBe(true)
    expect(hasUniqueOn(db, 'students', 'student_no')).toBe(true)
    expect(versions(db)).toEqual([9, 10, 11])
  })

  it('重复学号预检不过时中止，且不记版本号', () => {
    db.prepare('INSERT INTO schema_migrations VALUES (9, ?, 1)').run('roster_students_source_of_truth')
    db.prepare('INSERT INTO schema_migrations VALUES (10, ?, 1)').run('roster_users_name_en')
    db.prepare("INSERT INTO students (id, class_id, name, student_no) VALUES ('a','c1','示例甲','990000001')").run()
    db.prepare("INSERT INTO students (id, class_id, name, student_no) VALUES ('b','c1','示例乙','990000001')").run()

    expect(migrate).toThrow(/重复学号/)
    expect(versions(db)).toEqual([9, 10])
    expect(hasUniqueOn(db, 'students', 'student_no')).toBe(false)
  })

  it('学号为空的成堆脏行也算重复，同样中止', () => {
    db.prepare('INSERT INTO schema_migrations VALUES (9, ?, 1)').run('x')
    db.prepare('INSERT INTO schema_migrations VALUES (10, ?, 1)').run('x')
    db.prepare("INSERT INTO students (id, class_id, name) VALUES ('a','c1','示例甲')").run()
    db.prepare("INSERT INTO students (id, class_id, name) VALUES ('b','c1','示例乙')").run()

    expect(migrate).toThrow(/重复学号/)
    expect(versions(db)).toEqual([9, 10])
  })

  it('补列失败时不记 v9，下次启动会重来', () => {
    db.exec('DROP TABLE students')
    expect(migrate).toThrow()
    expect(versions(db)).toEqual([])
  })

  it('同名但非唯一的历史索引会被重建为唯一索引', () => {
    db.prepare('INSERT INTO schema_migrations VALUES (9, ?, 1)').run('x')
    db.prepare('INSERT INTO schema_migrations VALUES (10, ?, 1)').run('x')
    db.exec('CREATE INDEX idx_students_student_no ON students(student_no)')
    expect(hasUniqueOn(db, 'students', 'student_no')).toBe(false)

    migrate()

    expect(hasUniqueOn(db, 'students', 'student_no')).toBe(true)
    expect(versions(db)).toEqual([9, 10, 11])
  })

  it('索引的前置列缺失时报的是启动顺序问题，而不是 SQLite 原生错', () => {
    db.exec('ALTER TABLE users DROP COLUMN class_id_ref')
    expect(migrate).toThrow(/initDb → migrateV2/)
    // v9/v10 已经真正做完才记账，v11 不记，下次启动会重试
    expect(versions(db)).toEqual([9, 10])
    expect(hasUniqueOn(db, 'students', 'student_no')).toBe(true)
  })

  it('唯一索引建起来后真的能拦住重复学号', () => {
    migrate()
    db.prepare("INSERT INTO students (id, class_id, name, student_no) VALUES ('a','c1','示例甲','990000001')").run()
    expect(() =>
      db.prepare("INSERT INTO students (id, class_id, name, student_no) VALUES ('b','c1','示例乙','990000001')").run()
    ).toThrow(/UNIQUE/)
  })
})
