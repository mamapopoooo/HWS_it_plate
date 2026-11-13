// 名单体系迁移（v9）：students 表升级为花名册权威源
// 背景：登录/积分原先只读 users，students 是 v1 遗留且从不参与认证。
// 现在名单以 students 为准，users 继续承载登录身份与游戏数据，两表用学号打通。
// 原则：只加不删，旧字段保留。

import { db } from '../db.js'

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
    const addCol = (col, def) => {
      try { db.exec(`ALTER TABLE students ADD COLUMN ${col} ${def}`) } catch {}
    }

    // 英文名：学生可用中文名或英文名任一种登录
    addCol('name_en', "TEXT DEFAULT ''")
    addCol('gender', "TEXT DEFAULT ''")
    // grade 用 6/7 这种整数，与 users.grade 同口径，便于按年级筛选
    addCol('grade', 'INTEGER DEFAULT 0')
    addCol('course', "TEXT DEFAULT ''")

    // 学号是名单的自然主键：导入要按它 upsert、登录要按它定位。
    // SQLite 的 UNIQUE 索引允许 NULL，历史脏数据不至于建索引失败。
    try {
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_students_student_no ON students(student_no)')
    } catch {}

    // users.class_id_ref 建表以来从未写入过，现在用来挂班级
    try {
      db.exec('CREATE INDEX IF NOT EXISTS idx_users_class_ref ON users(class_id_ref)')
    } catch {}

    markApplied(9, 'roster_students_source_of_truth')
    console.log('✅ [v9] 名单迁移：students 加 name_en/gender/grade/course + 学号唯一索引')
  }

  if (!applied(10)) {
    // 学生登录身份也要英文名，教师端与登录页都直接读 users，省掉一次 JOIN
    const addCol = (col, def) => {
      try { db.exec(`ALTER TABLE users ADD COLUMN ${col} ${def}`) } catch {}
    }
    addCol('name_en', "TEXT DEFAULT ''")

    markApplied(10, 'roster_users_name_en')
    console.log('✅ [v10] users 加 name_en（登录身份同步英文名）')
  }
}
