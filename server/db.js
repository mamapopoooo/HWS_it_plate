import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const dbPath = join(__dirname, 'pet-garden.db')
export const db = new Database(dbPath)

// 初始化数据库表
export function initDb() {
  db.exec(`
    -- 用户表
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_guest INTEGER DEFAULT 0,
      created_at INTEGER
    );

    -- 班级表
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      created_at INTEGER,
      updated_at INTEGER
    );

    -- 学生表
    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      name TEXT NOT NULL,
      student_no TEXT,
      total_points INTEGER DEFAULT 0,
      pet_type TEXT,
      pet_level INTEGER DEFAULT 1,
      pet_exp INTEGER DEFAULT 0,
      custom_pet_id TEXT,
      created_at INTEGER,
      FOREIGN KEY (class_id) REFERENCES classes(id)
    );

    -- 徽章表
    CREATE TABLE IF NOT EXISTS badges (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      pet_type TEXT NOT NULL,
      earned_at INTEGER,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    -- 自定义宠物表
    CREATE TABLE IF NOT EXISTS custom_pets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- 自定义宠物等级图片表
    CREATE TABLE IF NOT EXISTS custom_pet_images (
      id TEXT PRIMARY KEY,
      custom_pet_id TEXT NOT NULL,
      level INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      FOREIGN KEY (custom_pet_id) REFERENCES custom_pets(id)
    );

    -- 评价规则表
    CREATE TABLE IF NOT EXISTS evaluation_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      points INTEGER NOT NULL,
      category TEXT NOT NULL,
      is_custom INTEGER DEFAULT 0,
      created_at INTEGER
    );

    -- 评价记录表
    CREATE TABLE IF NOT EXISTS evaluation_records (
      id TEXT PRIMARY KEY,
      class_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      points INTEGER NOT NULL,
      reason TEXT NOT NULL,
      category TEXT NOT NULL,
      timestamp INTEGER,
      FOREIGN KEY (class_id) REFERENCES classes(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    -- 设置表
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- 插入默认评价规则
    INSERT OR IGNORE INTO evaluation_rules (id, name, points, category, is_custom, created_at) VALUES
      ('rule_1', '课堂积极发言', 2, '学习', 0, 1704067200000),
      ('rule_2', '作业完成优秀', 3, '学习', 0, 1704067200000),
      ('rule_3', '帮助同学', 2, '行为', 0, 1704067200000),
      ('rule_4', '遵守纪律', 1, '行为', 0, 1704067200000),
      ('rule_5', '迟到', -1, '行为', 0, 1704067200000),
      ('rule_6', '未完成作业', -2, '学习', 0, 1704067200000),
      ('rule_7', '课堂捣乱', -3, '行为', 0, 1704067200000),
      ('rule_8', '主动打扫卫生', 2, '健康', 0, 1704067200000),
      ('rule_9', '坚持运动', 2, '健康', 0, 1704067200000),
      ('rule_10', '不讲卫生', -1, '健康', 0, 1704067200000);
  `)
}
