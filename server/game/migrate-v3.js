// 墨境 v3.0 数据库迁移脚本
// 从 v2（6属性+1-6星+深空科幻）→ v3（八卦+五阶品阶+中国风水墨）
// 原则：只加不删，字段废弃写注释，不 DROP

import { db } from '../db.js'
import { v4 as uuidv4 } from 'uuid'

export function migrateV3() {
  // ========== 0. 迁移版本表（最先建，用于追踪） ==========
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `)

  const applied = (v) => db.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(v)
  const markApplied = (v, name) => db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(v, name, Date.now())

  // ========== 1. pets_template 加 tier/trigram/form_images/unlock_cond/source ==========
  if (!applied(3)) {
    const addCol = (col, def) => {
      try { db.exec(`ALTER TABLE pets_template ADD COLUMN ${col} ${def}`) } catch {}
    }
    addCol('image_prefix', "TEXT DEFAULT ''")  // 兼容旧版，v3 改用 form_images
    addCol('tier', 'INTEGER DEFAULT 1')
    addCol('trigram', "TEXT DEFAULT ''")
    addCol('form_images', "TEXT DEFAULT '{}'")
    addCol('unlock_cond', "TEXT DEFAULT ''")
    addCol('source', "TEXT DEFAULT ''")
    addCol('style', "TEXT DEFAULT ''")
    addCol('pinyin', "TEXT DEFAULT ''")
    addCol('base_hp', 'INTEGER DEFAULT 100')
    addCol('base_attack', 'INTEGER DEFAULT 30')
    addCol('base_defense', 'INTEGER DEFAULT 20')
    addCol('base_speed', 'INTEGER DEFAULT 25')

    // 旧 rarity 字段注释废弃
    // -- deprecated: rarity 已由 tier 替代，保留字段不删

    // 旧 element 字段映射到 trigram
    // 已在数据迁移时通过 legacyElementMap 转换

    markApplied(3, 'tier_trigram_columns')
    console.log('✅ [v3-003] pets_template 加 tier/trigram/form_images/source 等字段')
  }

  // ========== 2. 角色系统：characters / player_characters ==========
  if (!applied(4)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS characters (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        gender TEXT DEFAULT 'male',
        nickname TEXT DEFAULT '',
        title TEXT DEFAULT '',
        current_skin_id TEXT DEFAULT '',
        created_at INTEGER,
        updated_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      -- 角色皮肤（从宠物端迁移到角色端）
      -- 注：skins_template 表保留但标记废弃，新皮肤走 characters_skins
      CREATE TABLE IF NOT EXISTS character_skins (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        theme TEXT NOT NULL,
        gender TEXT NOT NULL,
        price INTEGER DEFAULT 0,
        image TEXT DEFAULT '',
        unlock_json TEXT DEFAULT '{}',
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS player_character_skins (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        skin_id TEXT NOT NULL,
        obtained_at INTEGER,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (skin_id) REFERENCES character_skins(id)
      );

      -- 旧的 skins_template 标记废弃
      -- deprecated: 皮肤已迁到角色端 character_skins，此表不再使用
    `)

    // 为已有用户创建角色记录
    const usersWithoutChar = db.prepare(`
      SELECT u.id FROM users u
      LEFT JOIN characters c ON c.user_id = u.id
      WHERE c.id IS NULL AND u.role = 'student'
    `).all()

    const insertChar = db.prepare(`
      INSERT INTO characters (id, user_id, gender, nickname, created_at, updated_at)
      VALUES (?, ?, 'male', '', ?, ?)
    `)
    const now = Date.now()
    for (const u of usersWithoutChar) {
      insertChar.run(uuidv4(), u.id, now, now)
    }

    markApplied(4, 'character_system')
    console.log(`✅ [v3-004] 角色系统：characters + character_skins（${usersWithoutChar.length} 个角色已创建）`)
  }

  // ========== 3. 造物系统：custom_pets 增强 + custom_pet_skills ==========
  if (!applied(5)) {
    // 检查 custom_pets 表是否存在（v2 可能已建）
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='custom_pets'
    `).get()

    if (!tableExists) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS custom_pets (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          image TEXT DEFAULT '',
          trigram TEXT DEFAULT 'qian',
          status TEXT DEFAULT 'pending',
          review_note TEXT DEFAULT '',
          power_points_used INTEGER DEFAULT 0,
          created_at INTEGER,
          updated_at INTEGER,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `)
    } else {
      // 表已存在，加新字段
      const addCol = (col, def) => {
        try { db.exec(`ALTER TABLE custom_pets ADD COLUMN ${col} ${def}`) } catch {}
      }
      addCol('status', "TEXT DEFAULT 'pending'")
      addCol('review_note', "TEXT DEFAULT ''")
      addCol('power_points_used', 'INTEGER DEFAULT 0')
      addCol('trigram', "TEXT DEFAULT 'qian'")
      addCol('image', "TEXT DEFAULT ''")
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS custom_pet_skills (
        id TEXT PRIMARY KEY,
        custom_pet_id TEXT NOT NULL,
        effect_code TEXT NOT NULL,
        params_json TEXT DEFAULT '{}',
        sort_order INTEGER DEFAULT 0,
        FOREIGN KEY (custom_pet_id) REFERENCES custom_pets(id)
      );

      CREATE INDEX IF NOT EXISTS idx_custom_pets_user ON custom_pets(user_id);
      CREATE INDEX IF NOT EXISTS idx_custom_pets_status ON custom_pets(status);
      CREATE INDEX IF NOT EXISTS idx_custom_pet_skills_pet ON custom_pet_skills(custom_pet_id);
    `)

    markApplied(5, 'custom_pet_system')
    console.log('✅ [v3-005] 造物系统：custom_pets 增强 + custom_pet_skills')
  }

  // ========== 4. 配置层表：tier_config / trigram_config / economy_config / ranking_config ==========
  if (!applied(6)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tier_config (
        tier INTEGER PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        subtitle TEXT DEFAULT '',
        power_coef REAL DEFAULT 1.0,
        form_count INTEGER DEFAULT 2,
        awaken_cap INTEGER DEFAULT 1,
        skill_slots INTEGER DEFAULT 2,
        gacha_rate REAL DEFAULT 0,
        bezel_color TEXT DEFAULT '#8A8577',
        is_gacha INTEGER DEFAULT 1,
        is_custom INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS trigram_config (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        symbol TEXT DEFAULT '',
        element TEXT NOT NULL,
        color TEXT DEFAULT '#8A8577',
        color_dark TEXT DEFAULT '#4A4A5A',
        opposite TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS economy_config (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS ranking_config (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        metric TEXT NOT NULL,
        scope TEXT DEFAULT 'grade',
        reset_cycle TEXT DEFAULT 'season',
        top_pose INTEGER DEFAULT 7,
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0
      );
    `)

    markApplied(6, 'config_tables')
    console.log('✅ [v3-006] 配置层：tier_config + trigram_config + economy_config + ranking_config')
  }

  // ========== 5. 活动系统：events ==========
  if (!applied(7)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        type TEXT DEFAULT 'default',
        start_date INTEGER NOT NULL,
        end_date INTEGER NOT NULL,
        condition_json TEXT DEFAULT '{}',
        reward_json TEXT DEFAULT '{}',
        is_active INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS player_event_progress (
        user_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        progress INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        claimed INTEGER DEFAULT 0,
        last_updated INTEGER,
        PRIMARY KEY (user_id, event_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (event_id) REFERENCES events(id)
      );

      CREATE INDEX IF NOT EXISTS idx_events_active ON events(is_active);
      CREATE INDEX IF NOT EXISTS idx_event_progress_user ON player_event_progress(user_id);
    `)

    markApplied(7, 'events_system')
    console.log('✅ [v3-007] 活动系统：events + player_event_progress')
  }

  // ========== 6. 玩家数据层补充：灵纹碎片 ==========
  if (!applied(8)) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS player_fragments (
        user_id TEXT NOT NULL,
        tier INTEGER NOT NULL,
        count INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, tier),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      -- 抽卡保底改为 tier 保底（旧 egg_type 保底保留但 deprecated）
      -- gacha_pity 表加 tier_pity 字段
    `)

    // 给 gacha_pity 加 tier 保底字段
    const addCol = (col, def) => {
      try { db.exec(`ALTER TABLE gacha_pity ADD COLUMN ${col} ${def}`) } catch {}
    }
    addCol('tier2_pity', 'INTEGER DEFAULT 0')
    addCol('tier3_pity', 'INTEGER DEFAULT 0')
    addCol('tier4_pity', 'INTEGER DEFAULT 0')

    // 给 gacha_records 加 tier 字段
    const addCol2 = (col, def) => {
      try { db.exec(`ALTER TABLE gacha_records ADD COLUMN ${col} ${def}`) } catch {}
    }
    addCol2('tier', 'INTEGER DEFAULT 1')
    addCol2('trigram', "TEXT DEFAULT ''")
    // rarity 字段保留但 deprecated

    // 给 player_pets 加 form / power 字段
    const addCol3 = (col, def) => {
      try { db.exec(`ALTER TABLE player_pets ADD COLUMN ${col} ${def}`) } catch {}
    }
    addCol3('form', 'INTEGER DEFAULT 1')
    addCol3('power', 'INTEGER DEFAULT 0')
    addCol3('fragments', 'INTEGER DEFAULT 0')

    markApplied(8, 'player_data_supplement')
    console.log('✅ [v3-008] 玩家数据补充：fragments + tier保底 + form/power')
  }

  console.log('✅ v3.0 数据库迁移全部完成')
}
