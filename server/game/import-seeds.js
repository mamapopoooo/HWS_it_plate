// 王宠课堂 v3.0 种子数据导入脚本
// 从 docs/seeds/*.json 读取配置，写入数据库
// 幂等：按 id upsert，可重复执行

import { db } from '../db.js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const seedsDir = join(__dirname, '..', '..', 'docs', 'seeds')

function readJSON(filename) {
  return JSON.parse(readFileSync(join(seedsDir, filename), 'utf-8'))
}

export function importSeeds() {
  console.log('📦 开始导入种子数据...')

  // 1. tier_config（五阶）
  const tiersData = readJSON('tiers.json')
  const upsertTier = db.prepare(`
    INSERT OR REPLACE INTO tier_config
      (tier, code, name, subtitle, power_coef, form_count, awaken_cap, skill_slots, gacha_rate, bezel_color, is_gacha, is_custom, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const t of tiersData.tiers) {
    upsertTier.run(
      t.tier, t.code, t.name, t.subtitle, t.powerCoef, t.formCount, t.awakenCap,
      t.skillSlots, t.gachaRate, t.bezelColor, t.isGacha ? 1 : 0, t.isCustom ? 1 : 0, t.sortOrder
    )
  }
  console.log(`  ✅ tier_config: ${tiersData.tiers.length} 阶`)

  // 2. trigram_config（八卦）
  const trigramsData = readJSON('trigrams.json')
  const upsertTrigram = db.prepare(`
    INSERT OR REPLACE INTO trigram_config
      (code, name, symbol, element, color, color_dark, opposite, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const g of trigramsData.trigrams) {
    upsertTrigram.run(g.code, g.name, g.symbol, g.element, g.color, g.colorDark, g.opposite, g.sortOrder)
  }
  console.log(`  ✅ trigram_config: ${trigramsData.trigrams.length} 卦`)

  // 3. pets_template（38 只官方宠物）
  const petsData = readJSON('pets.json')
  const upsertPet = db.prepare(`
    INSERT OR REPLACE INTO pets_template
      (id, name, element, role, description, skills_json, image_prefix, sort_order, is_active, rarity, tier, trigram, source, form_images, style, pinyin, base_hp, base_attack, base_defense, base_speed)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // 基础属性按品阶分配
  const tierBaseStats = {
    1: { hp: 100, atk: 30, def: 20, spd: 25 },  // 万象
    2: { hp: 130, atk: 40, def: 28, spd: 32 },  // 八卦
    3: { hp: 170, atk: 55, def: 38, spd: 42 },  // 四象
    4: { hp: 220, atk: 70, def: 50, spd: 55 }   // 太极
  }

  for (const p of petsData.pets) {
    const stats = tierBaseStats[p.tier] || tierBaseStats[1]
    const formImages = {}
    for (let f = 1; f <= (tiersData.tiers[p.tier - 1]?.formCount || 2); f++) {
      formImages[f] = `/pet-garden/pets/${p.id.replace('pet_', '')}/form${f}.png`
    }
    upsertPet.run(
      p.id, p.name,
      p.trigram.includes(',') ? p.trigram.split(',')[0] : (p.trigram === 'all' ? 'qian' : p.trigram),
      p.role, p.description, '[]',
      `/pet-garden/pets/${p.id.replace('pet_', '')}/`,
      p.sortOrder, p.tier, p.tier, p.trigram, p.source,
      JSON.stringify(formImages),
      p.style || '', p.pinyin || '',
      stats.hp, stats.atk, stats.def, stats.spd
    )
  }
  console.log(`  ✅ pets_template: ${petsData.pets.length} 只宠物`)

  // 4. skill_effects（技能效果池）
  const skillsData = readJSON('skill_effects.json')
  // skill_effects 表可能不存在于 v2，需要创建
  db.exec(`
    CREATE TABLE IF NOT EXISTS skill_effects (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cost INTEGER DEFAULT 0,
      impl TEXT NOT NULL,
      params_json TEXT DEFAULT '{}',
      description TEXT DEFAULT ''
    )
  `)
  const upsertSkill = db.prepare(`
    INSERT OR REPLACE INTO skill_effects (code, name, cost, impl, params_json, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  for (const s of skillsData.effects) {
    upsertSkill.run(s.code, s.name, s.cost, s.impl, JSON.stringify(s.params), s.description)
  }
  console.log(`  ✅ skill_effects: ${skillsData.effects.length} 个技能效果`)

  // 5. character_skins（角色皮肤）
  const skinsData = readJSON('skins.json')
  const upsertSkin = db.prepare(`
    INSERT OR REPLACE INTO character_skins (id, name, theme, gender, price, image, unlock_json, is_active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `)
  for (const s of skinsData.skins) {
    upsertSkin.run(s.id, s.name, s.theme, s.gender, s.price, s.image, JSON.stringify(s.unlock || {}), s.sortOrder)
  }
  console.log(`  ✅ character_skins: ${skinsData.skins.length} 套皮肤`)

  // 6. ranking_config（三榜排行）
  if (skinsData.rankingConfig) {
    const upsertRanking = db.prepare(`
      INSERT OR REPLACE INTO ranking_config (id, name, metric, scope, reset_cycle, top_pose, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `)
    for (const r of skinsData.rankingConfig) {
      upsertRanking.run(r.id, r.name, r.metric, r.scope, r.resetCycle, r.topPose, r.sortOrder)
    }
    console.log(`  ✅ ranking_config: ${skinsData.rankingConfig.length} 个榜单`)
  }

  // 7. economy_config（经济参数）
  const economyData = readJSON('economy.json')
  const upsertEconomy = db.prepare(`
    INSERT OR REPLACE INTO economy_config (key, value_json, updated_at)
    VALUES (?, ?, ?)
  `)
  const now = Date.now()

  // 将 economy.json 的每个顶层 key 存为一行
  for (const [key, value] of Object.entries(economyData)) {
    if (key.startsWith('_')) continue // 跳过注释
    upsertEconomy.run(key, JSON.stringify(value), now)
  }
  console.log(`  ✅ economy_config: ${Object.keys(economyData).filter(k => !k.startsWith('_')).length} 项配置`)

  // 8. 默认赛季（如果不存在）
  const seasonExists = db.prepare("SELECT id FROM seasons WHERE is_active = 1").get()
  if (!seasonExists) {
    const seasonId = 'S2_shanhai'
    db.prepare(`
      INSERT OR IGNORE INTO seasons (id, name, start_date, end_date, is_active, reward_json)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(seasonId, 'S2 山海赛季', now, now + 180 * 24 * 60 * 60 * 1000, JSON.stringify({}))
    console.log('  ✅ seasons: S2 山海赛季')
  }

  console.log('📦 种子数据导入完成！')
}
