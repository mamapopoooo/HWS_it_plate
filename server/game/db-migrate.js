// 墨境 - 游戏数据库迁移
// 在现有 ClassPetGarden 数据库上新增游戏相关表

import { db } from '../db.js'

export function migrateGameTables() {
  db.exec(`
    -- 宠物模板表（36只宠物的定义数据）
    CREATE TABLE IF NOT EXISTS pets_template (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      element TEXT NOT NULL,
      role TEXT NOT NULL,
      description TEXT,
      signature TEXT,
      skills_json TEXT NOT NULL,
      image_path TEXT,
      avatar_path TEXT
    );

    -- 玩家宠物实例表
    CREATE TABLE IF NOT EXISTS player_pets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      level INTEGER DEFAULT 1,
      exp INTEGER DEFAULT 0,
      equipped_skills TEXT NOT NULL DEFAULT '[]',
      is_favorite INTEGER DEFAULT 0,
      obtained_at INTEGER,
      FOREIGN KEY (template_id) REFERENCES pets_template(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- 战斗记录表
    CREATE TABLE IF NOT EXISTS battle_records (
      id TEXT PRIMARY KEY,
      player_a_id TEXT NOT NULL,
      player_b_id TEXT,
      player_a_pet TEXT NOT NULL,
      player_b_pet TEXT NOT NULL,
      player_a_level INTEGER,
      player_b_level INTEGER,
      winner TEXT,
      battle_log TEXT NOT NULL,
      battle_type TEXT NOT NULL DEFAULT 'pvp',
      created_at INTEGER
    );

    -- 排位排行榜
    CREATE TABLE IF NOT EXISTS rankings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      mmr INTEGER DEFAULT 1000,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      tier TEXT DEFAULT 'BRONZE',
      title TEXT,
      season TEXT,
      updated_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- 老师世界 Boss 伤害记录
    CREATE TABLE IF NOT EXISTS boss_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      boss_id TEXT NOT NULL,
      damage INTEGER DEFAULT 0,
      pet_id TEXT NOT NULL,
      battle_log TEXT,
      created_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- 答题题库
    CREATE TABLE IF NOT EXISTS question_bank (
      id TEXT PRIMARY KEY,
      subject TEXT,
      chapter TEXT,
      difficulty INTEGER DEFAULT 1,
      question TEXT NOT NULL,
      options_json TEXT NOT NULL,
      correct_answer INTEGER NOT NULL,
      buff_type TEXT,
      buff_value REAL,
      created_by TEXT,
      created_at INTEGER
    );

    -- 老师放行状态
    CREATE TABLE IF NOT EXISTS teacher_gate (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      class_id TEXT NOT NULL,
      unlocked INTEGER DEFAULT 0,
      unlocked_at INTEGER,
      expires_at INTEGER,
      unlocked_by TEXT,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (class_id) REFERENCES classes(id)
    );

    -- 赛季配置
    CREATE TABLE IF NOT EXISTS seasons (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_at INTEGER,
      end_at INTEGER,
      is_active INTEGER DEFAULT 0
    );

    -- 特殊称号记录
    CREATE TABLE IF NOT EXISTS special_titles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title_type TEXT NOT NULL,
      title_name TEXT NOT NULL,
      season TEXT,
      awarded_at INTEGER,
      expires_at INTEGER
    );
  `)

  console.log('[DB] 游戏表迁移完成')
}

// 插入 P0 六只宠物模板
export function seedPetTemplates(petDataArray) {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO pets_template
    (id, name, element, role, description, signature, skills_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  for (const pet of petDataArray) {
    insert.run(
      pet.id,
      pet.name,
      pet.element,
      pet.role,
      pet.description,
      pet.signature,
      JSON.stringify(pet.skills)
    )
  }

  console.log(`[DB] 已插入 ${petDataArray.length} 只宠物模板`)
}
