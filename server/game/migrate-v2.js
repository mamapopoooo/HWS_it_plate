// 王宠课堂 v2.0 数据库迁移脚本
// 在现有 v1.0 表结构基础上新增游戏系统表

import { db } from '../db.js'

import { v4 as uuidv4 } from 'uuid'
import { hashPassword } from '../utils/password.js'

export function migrateV2() {
  // 扩展 users 表（幂等：列已存在则跳过）
  const addColumn = (col, def) => {
    try { db.exec(`ALTER TABLE users ADD COLUMN ${col} ${def}`) } catch {}
  }
  addColumn('role', "TEXT DEFAULT 'student'")
  addColumn('real_name', "TEXT DEFAULT ''")
  addColumn('grade', 'INTEGER DEFAULT 6')
  addColumn('class_id_ref', 'TEXT')
  addColumn('game_points', 'INTEGER DEFAULT 0')
  addColumn('last_login_at', 'INTEGER')

  // 创建新表（IF NOT EXISTS 保证幂等）
  db.exec(`
    -- ========== 训练师系统 ==========
    CREATE TABLE IF NOT EXISTS trainers (
      user_id TEXT PRIMARY KEY,
      level INTEGER DEFAULT 1,
      exp INTEGER DEFAULT 0,
      title TEXT DEFAULT '新手训练师',
      avatar TEXT DEFAULT 'default',
      attack_bonus INTEGER DEFAULT 0,
      defense_bonus INTEGER DEFAULT 0,
      luck_bonus INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- ========== 宠物模板表 ==========
    CREATE TABLE IF NOT EXISTS pets_template (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      element TEXT NOT NULL,
      role TEXT NOT NULL,
      description TEXT DEFAULT '',
      skills_json TEXT DEFAULT '[]',
      image_prefix TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      rarity INTEGER DEFAULT 1
    );

    -- ========== 玩家宠物表（v2.0 独立于 students 表） ==========
    CREATE TABLE IF NOT EXISTS player_pets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      nickname TEXT DEFAULT '',
      level INTEGER DEFAULT 1,
      exp INTEGER DEFAULT 0,
      equipped_skills TEXT DEFAULT '[]',
      awakening_level INTEGER DEFAULT 0,
      equipped_skin_id TEXT DEFAULT '',
      obtained_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (template_id) REFERENCES pets_template(id)
    );

    -- ========== 宠物技能学习表 ==========
    CREATE TABLE IF NOT EXISTS pet_skills (
      id TEXT PRIMARY KEY,
      pet_id TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      learned_at INTEGER,
      FOREIGN KEY (pet_id) REFERENCES player_pets(id)
    );

    -- ========== 皮肤模板表 ==========
    CREATE TABLE IF NOT EXISTS skins_template (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pet_template_id TEXT NOT NULL,
      type TEXT NOT NULL,
      price INTEGER DEFAULT 0,
      css_class TEXT NOT NULL,
      description TEXT DEFAULT '',
      is_limited INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      release_date INTEGER,
      expire_date INTEGER,
      FOREIGN KEY (pet_template_id) REFERENCES pets_template(id)
    );

    -- ========== 玩家皮肤表 ==========
    CREATE TABLE IF NOT EXISTS player_skins (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      skin_id TEXT NOT NULL,
      equipped_pet_id TEXT DEFAULT '',
      obtained_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (skin_id) REFERENCES skins_template(id)
    );

    -- ========== 道具模板表 ==========
    CREATE TABLE IF NOT EXISTS items_template (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT DEFAULT '',
      price INTEGER DEFAULT 0,
      effect_json TEXT DEFAULT '{}',
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0
    );

    -- ========== 玩家道具表 ==========
    CREATE TABLE IF NOT EXISTS player_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      obtained_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (item_id) REFERENCES items_template(id)
    );

    -- ========== 战斗记录表 ==========
    CREATE TABLE IF NOT EXISTS battle_records (
      id TEXT PRIMARY KEY,
      battle_type TEXT NOT NULL,
      player_a_id TEXT,
      player_b_id TEXT,
      winner_id TEXT,
      turn_count INTEGER DEFAULT 0,
      log_json TEXT DEFAULT '[]',
      created_at INTEGER
    );

    -- ========== 赛季表 ==========
    CREATE TABLE IF NOT EXISTS seasons (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_date INTEGER NOT NULL,
      end_date INTEGER NOT NULL,
      is_active INTEGER DEFAULT 0,
      reward_json TEXT DEFAULT '{}'
    );

    -- ========== PVP 段位表 ==========
    CREATE TABLE IF NOT EXISTS pvp_rankings (
      user_id TEXT NOT NULL,
      season_id TEXT NOT NULL,
      points INTEGER DEFAULT 1000,
      tier TEXT DEFAULT 'bronze',
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      win_streak INTEGER DEFAULT 0,
      last_battle_at INTEGER,
      PRIMARY KEY (user_id, season_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (season_id) REFERENCES seasons(id)
    );

    -- ========== 班级战表 ==========
    CREATE TABLE IF NOT EXISTS class_battles (
      id TEXT PRIMARY KEY,
      class_a_id TEXT NOT NULL,
      class_b_id TEXT NOT NULL,
      season_id TEXT,
      start_date INTEGER NOT NULL,
      end_date INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      class_a_score INTEGER DEFAULT 0,
      class_b_score INTEGER DEFAULT 0,
      winner_class_id TEXT,
      vote_a INTEGER DEFAULT 0,
      vote_b INTEGER DEFAULT 0,
      FOREIGN KEY (class_a_id) REFERENCES classes(id),
      FOREIGN KEY (class_b_id) REFERENCES classes(id),
      FOREIGN KEY (season_id) REFERENCES seasons(id)
    );

    -- ========== 班级战记录表 ==========
    CREATE TABLE IF NOT EXISTS class_battle_records (
      id TEXT PRIMARY KEY,
      battle_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      opponent_id TEXT NOT NULL,
      result TEXT NOT NULL,
      score INTEGER DEFAULT 0,
      created_at INTEGER,
      FOREIGN KEY (battle_id) REFERENCES class_battles(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- ========== 成就模板表 ==========
    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT DEFAULT '',
      condition_json TEXT DEFAULT '{}',
      reward_points INTEGER DEFAULT 0,
      reward_title TEXT DEFAULT '',
      reward_skin TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0
    );

    -- ========== 玩家成就表 ==========
    CREATE TABLE IF NOT EXISTS player_achievements (
      user_id TEXT NOT NULL,
      achievement_id TEXT NOT NULL,
      completed_at INTEGER,
      PRIMARY KEY (user_id, achievement_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (achievement_id) REFERENCES achievements(id)
    );

    -- ========== 任务模板表 ==========
    CREATE TABLE IF NOT EXISTS quests (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT DEFAULT '',
      condition_json TEXT DEFAULT '{}',
      reward_points INTEGER DEFAULT 0,
      reward_exp INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0
    );

    -- ========== 玩家任务进度表 ==========
    CREATE TABLE IF NOT EXISTS player_quests (
      user_id TEXT NOT NULL,
      quest_id TEXT NOT NULL,
      progress INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      claimed INTEGER DEFAULT 0,
      last_reset INTEGER,
      PRIMARY KEY (user_id, quest_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (quest_id) REFERENCES quests(id)
    );

    -- ========== 抽卡记录表 ==========
    CREATE TABLE IF NOT EXISTS gacha_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      egg_type TEXT NOT NULL,
      pet_template_id TEXT,
      skin_id TEXT,
      rarity INTEGER DEFAULT 1,
      pity_count INTEGER DEFAULT 0,
      created_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- ========== 抽卡保底计数表 ==========
    CREATE TABLE IF NOT EXISTS gacha_pity (
      user_id TEXT NOT NULL,
      egg_type TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, egg_type),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- ========== 兑换记录表 ==========
    CREATE TABLE IF NOT EXISTS exchange_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      cost_points INTEGER NOT NULL,
      result_json TEXT DEFAULT '{}',
      created_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- ========== 积分变动记录表（游戏积分） ==========
    CREATE TABLE IF NOT EXISTS game_points_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT DEFAULT '',
      category TEXT DEFAULT '',
      created_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- ========== 通知表 ==========
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      type TEXT DEFAULT 'system',
      is_read INTEGER DEFAULT 0,
      created_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- ========== 索引优化 ==========
    CREATE INDEX IF NOT EXISTS idx_player_pets_user ON player_pets(user_id);
    CREATE INDEX IF NOT EXISTS idx_player_pets_template ON player_pets(template_id);
    CREATE INDEX IF NOT EXISTS idx_battle_records_player_a ON battle_records(player_a_id);
    CREATE INDEX IF NOT EXISTS idx_battle_records_player_b ON battle_records(player_b_id);
    CREATE INDEX IF NOT EXISTS idx_battle_records_type ON battle_records(battle_type);
    CREATE INDEX IF NOT EXISTS idx_pvp_rankings_season ON pvp_rankings(season_id);
    CREATE INDEX IF NOT EXISTS idx_pvp_rankings_points ON pvp_rankings(points DESC);
    CREATE INDEX IF NOT EXISTS idx_class_battles_status ON class_battles(status);
    CREATE INDEX IF NOT EXISTS idx_class_battle_records_battle ON class_battle_records(battle_id);
    CREATE INDEX IF NOT EXISTS idx_player_achievements_user ON player_achievements(user_id);
    CREATE INDEX IF NOT EXISTS idx_player_quests_user ON player_quests(user_id);
    CREATE INDEX IF NOT EXISTS idx_gacha_records_user ON gacha_records(user_id);
    CREATE INDEX IF NOT EXISTS idx_game_points_records_user ON game_points_records(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read);
  `)

  // 插入默认管理员账号（如果不存在）
  const adminExists = db.prepare("SELECT id FROM users WHERE username = ?").get('admin')
  if (!adminExists) {
    const adminId = uuidv4()
    const passwordHash = hashPassword('123456')
    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, real_name, is_guest, created_at)
      VALUES (?, ?, ?, 'admin', '管理员', 0, ?)
    `).run(adminId, 'admin', passwordHash, Date.now())
    console.log('✅ 创建默认管理员账号 admin/123456')
  }

  // 插入默认赛季（如果不存在）
  const seasonExists = db.prepare("SELECT id FROM seasons WHERE is_active = 1").get()
  if (!seasonExists) {
    const now = Date.now()
    const seasonId = 'season_1'
    db.prepare(`
      INSERT INTO seasons (id, name, start_date, end_date, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run(seasonId, 'S1 创始赛季', now, now + 180 * 24 * 60 * 60 * 1000)
    console.log('✅ 创建默认赛季 S1')
  }

  // 插入默认任务（如果不存在）
  const questCount = db.prepare('SELECT COUNT(*) as cnt FROM quests').get()
  if (questCount.cnt === 0) {
    const now = Date.now()
    const quests = [
      { id: 'q_daily_1', name: '每日登录', type: 'daily', description: '每天登录游戏', condition: '{"type":"login"}', reward_points: 5, reward_exp: 10 },
      { id: 'q_daily_2', name: '完成3场战斗', type: 'daily', description: '完成3场PVE或PVP战斗', condition: '{"type":"battle","count":3}', reward_points: 30, reward_exp: 20 },
      { id: 'q_daily_3', name: '给宠物喂食', type: 'daily', description: '使用一次道具喂养宠物', condition: '{"type":"feed","count":1}', reward_points: 20, reward_exp: 10 },
      { id: 'q_daily_4', name: '查看排行榜', type: 'daily', description: '查看一次排行榜', condition: '{"type":"view_ranking"}', reward_points: 10, reward_exp: 5 },
      { id: 'q_weekly_1', name: '完成10场战斗', type: 'weekly', description: '本周完成10场战斗', condition: '{"type":"battle","count":10}', reward_points: 100, reward_exp: 50 },
      { id: 'q_weekly_2', name: 'PVP胜利3场', type: 'weekly', description: '本周PVP胜利3场', condition: '{"type":"pvp_win","count":3}', reward_points: 150, reward_exp: 80 },
      { id: 'q_weekly_3', name: '抽卡一次', type: 'weekly', description: '本周至少抽卡一次', condition: '{"type":"gacha","count":1}', reward_points: 50, reward_exp: 20 },
    ]
    const insertQuest = db.prepare(`
      INSERT INTO quests (id, name, type, description, condition_json, reward_points, reward_exp, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `)
    quests.forEach((q, i) => insertQuest.run(q.id, q.name, q.type, q.description, q.condition, q.reward_points, q.reward_exp, i + 1))
    console.log(`✅ 创建 ${quests.length} 个默认任务`)
  }

  // 插入默认成就（如果不存在）
  const achievementCount = db.prepare('SELECT COUNT(*) as cnt FROM achievements').get()
  if (achievementCount.cnt === 0) {
    const achievements = [
      { id: 'a_1', name: '初战告捷', category: 'battle', description: '完成第一场战斗', condition: '{"type":"battle_first"}', reward_points: 50, reward_title: '新手训练师' },
      { id: 'a_2', name: '百战百胜', category: 'battle', description: '累计胜利100场', condition: '{"type":"battle_wins","count":100}', reward_points: 500, reward_title: '战斗大师' },
      { id: 'a_3', name: '连胜达人', category: 'battle', description: '连续胜利10场', condition: '{"type":"win_streak","count":10}', reward_points: 200, reward_title: '连胜王者' },
      { id: 'a_4', name: '初识宠物', category: 'collection', description: '收集第一只宠物', condition: '{"type":"collect_first"}', reward_points: 30, reward_title: '宠物爱好者' },
      { id: 'a_5', name: '收藏家', category: 'collection', description: '收集全部6只基础宠物', condition: '{"type":"collect_all","count":6}', reward_points: 300, reward_title: '收藏大师' },
      { id: 'a_6', name: '觉醒大师', category: 'awakening', description: '将一只宠物觉醒到4阶', condition: '{"type":"awakening_max","level":4}', reward_points: 500, reward_title: '觉醒者' },
      { id: 'a_7', name: 'PVP新星', category: 'pvp', description: 'PVP段位达到黄金', condition: '{"type":"pvp_tier","tier":"gold"}', reward_points: 200, reward_title: 'PVP战士' },
      { id: 'a_8', name: '班级英雄', category: 'class_battle', description: '在班级战中获得MVP', condition: '{"type":"class_battle_mvp"}', reward_points: 300, reward_title: '班级英雄' },
    ]
    const insertAchievement = db.prepare(`
      INSERT INTO achievements (id, name, category, description, condition_json, reward_points, reward_title, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `)
    achievements.forEach((a, i) => insertAchievement.run(a.id, a.name, a.category, a.description, a.condition, a.reward_points, a.reward_title, i + 1))
    console.log(`✅ 创建 ${achievements.length} 个默认成就`)
  }

  // 插入默认道具（如果不存在）
  const itemCount = db.prepare('SELECT COUNT(*) as cnt FROM items_template').get()
  if (itemCount.cnt === 0) {
    const items = [
      { id: 'item_1', name: '经验药水（小）', type: 'exp', description: '宠物经验+50', price: 50, effect: '{"exp":50}' },
      { id: 'item_2', name: '经验药水（大）', type: 'exp', description: '宠物经验+200', price: 150, effect: '{"exp":200}' },
      { id: 'item_3', name: '普通宠物蛋', type: 'gacha', description: '普通抽卡券', price: 200, effect: '{"egg_type":"normal"}' },
      { id: 'item_4', name: '稀有宠物蛋', type: 'gacha', description: '稀有抽卡券', price: 500, effect: '{"egg_type":"rare"}' },
      { id: 'item_5', name: '传说宠物蛋', type: 'gacha', description: '传说抽卡券', price: 1000, effect: '{"egg_type":"legendary"}' },
      { id: 'item_6', name: '技能重置书', type: 'skill', description: '重置宠物已学技能', price: 300, effect: '{"type":"reset_skills"}' },
      { id: 'item_7', name: '觉醒石', type: 'awakening', description: '宠物觉醒材料', price: 500, effect: '{"type":"awakening_material"}' },
      { id: 'item_8', name: 'HP恢复药', type: 'heal', description: '战斗中恢复50%HP', price: 100, effect: '{"heal_percent":0.5}' },
    ]
    const insertItem = db.prepare(`
      INSERT INTO items_template (id, name, type, description, price, effect_json, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `)
    items.forEach((item, i) => insertItem.run(item.id, item.name, item.type, item.description, item.price, item.effect, i + 1))
    console.log(`✅ 创建 ${items.length} 个默认道具`)
  }

  console.log('✅ v2.0 数据库迁移完成')
}
