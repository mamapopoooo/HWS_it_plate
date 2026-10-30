// 游戏数据库迁移执行脚本
// 运行: node server/game/run-migrate.js

import { db } from '../db.js'
import { migrateGameTables, seedPetTemplates } from './db-migrate.js'
import { PETS } from './pet-data.js'

console.log('[迁移] 开始游戏表迁移...')

try {
  // 创建游戏表
  migrateGameTables()

  // 插入宠物模板
  seedPetTemplates(PETS)

  // 验证
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%template%' OR name LIKE '%player_pets%' OR name LIKE '%battle%' OR name LIKE '%ranking%' OR name LIKE '%boss%' OR name LIKE '%question%' OR name LIKE '%teacher_gate%' OR name LIKE '%season%' OR name LIKE '%special_title%'").all()
  console.log(`[迁移] 创建的游戏表: ${tables.map(t => t.name).join(', ')}`)

  const petCount = db.prepare('SELECT COUNT(*) as count FROM pets_template').get()
  console.log(`[迁移] 宠物模板数量: ${petCount.count}`)

  const petNames = db.prepare('SELECT id, name, element, role FROM pets_template').all()
  console.log('[迁移] 宠物列表:')
  for (const p of petNames) {
    console.log(`  ${p.id}: ${p.name} (${p.element}/${p.role})`)
  }

  console.log('\n[迁移] 完成！')
} catch (err) {
  console.error('[迁移] 失败:', err.message)
  process.exit(1)
}
