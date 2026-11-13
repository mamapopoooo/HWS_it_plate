// 王宠课堂 v3.0 游戏 API 路由
// 新增/改造接口，适配八卦+五阶品阶+中国风体系
// 前缀：/api/v3

import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

import { routePrice, debit } from '../utils/economy.js'
import { createGachaRoute } from '../utils/gachaRoute.js'

import { createAwakenRoute } from '../utils/awakenRoute.js'

const router = Router()

// ========== 配置接口（前端启动时一次性拉取缓存） ==========

// GET /config — 一次返回 tiers/trigrams/forms/economy
router.get('/config', (req, res) => {
  const tiers = db.prepare('SELECT * FROM tier_config ORDER BY sort_order').all()
  const trigrams = db.prepare('SELECT * FROM trigram_config ORDER BY sort_order').all()
  const economy = {}
  const economyRows = db.prepare('SELECT key, value_json FROM economy_config').all()
  for (const row of economyRows) {
    try { economy[row.key] = JSON.parse(row.value_json) } catch {}
  }
  const rankings = db.prepare('SELECT * FROM ranking_config WHERE is_active = 1 ORDER BY sort_order').all()

  res.json({ tiers, trigrams, economy, rankings })
})

// ========== 宠物接口（改造：加 tier/trigram/form） ==========

// GET /pets/templates — 加 tier/trigram/formImages/source
router.get('/pets/templates', (req, res) => {
  const { tier, trigram } = req.query
  let sql = 'SELECT * FROM pets_template WHERE is_active = 1'
  const params = []

  if (tier) { sql += ' AND tier = ?'; params.push(Number(tier)) }
  if (trigram) { sql += ' AND trigram LIKE ?'; params.push(`%${trigram}%`) }

  sql += ' ORDER BY sort_order'
  const pets = db.prepare(sql).all(...params)

  // 附加 tier 名称
  const tierMap = {}
  const tiers = db.prepare('SELECT tier, name FROM tier_config').all()
  for (const t of tiers) tierMap[t.tier] = t.name

  res.json({
    pets: pets.map(p => ({
      ...p,
      tierName: tierMap[p.tier] || '未知',
      formImages: safeJsonParse(p.form_images, {}),
      formCount: tierMap[p.tier] ? (tiers.find(t => t.name === tierMap[p.tier])?.form_count || 2) : 2
    }))
  })
})

// GET /pets/my — 加 form/power
router.get('/pets/my', authMiddleware, (req, res) => {
  const pets = db.prepare(`
    SELECT pp.*, pt.name as template_name, pt.element, pt.role, pt.description,
           pt.skills_json, pt.image_prefix, pt.tier, pt.trigram, pt.source,
           pt.form_images, pt.base_hp, pt.base_attack, pt.base_defense, pt.base_speed,
           tc.name as tier_name, tc.power_coef, tc.form_count as tier_form_count
    FROM player_pets pp
    JOIN pets_template pt ON pp.template_id = pt.id
    LEFT JOIN tier_config tc ON pt.tier = tc.tier
    WHERE pp.user_id = ?
    ORDER BY pp.obtained_at DESC
  `).all(req.userId)

  // 计算战力
  const levelCoef = 0.05
  const powerBase = 100
  const awakenBonus = [0, 0.1, 0.25, 0.5, 1.0, 1.5]

  res.json({
    pets: pets.map(p => {
      const form = (p.awakening_level || 0) + 1
      const maxForm = p.tier_form_count || 2
      const levelCoeff = 1 + (p.level - 1) * levelCoef
      const awakenCoeff = 1 + (awakenBonus[p.awakening_level] || 0)
      const power = Math.round(powerBase * (p.power_coef || 1) * levelCoeff * awakenCoeff)

      return {
        ...p,
        form: Math.min(form, maxForm),
        power,
        formImages: safeJsonParse(p.form_images, {})
      }
    })
  })
})

// POST /pets/:petId/awaken — 返回 form/formChanged
router.post('/pets/:petId/awaken', authMiddleware, createAwakenRoute(db))

// ========== 抽卡接口（改造：tier 保底） ==========

// POST /gacha/draw — 返回 tier/trigram
router.post('/gacha/draw', authMiddleware, createGachaRoute(db))

// GET /gacha/rates — 返回品阶概率
router.get('/gacha/rates', (req, res) => {
  const tiers = db.prepare('SELECT tier, name, gacha_rate, form_count, awaken_cap FROM tier_config WHERE is_gacha = 1 ORDER BY tier').all()
  const economy = getEconomyValue('gacha', {})
  res.json({ tiers, pity: { tier2: economy.pityTier2 || 20, tier3: economy.pityTier3 || 60 } })
})

// ========== 图鉴接口 ==========

// GET /collection — 按 tier 分组
router.get('/collection', authMiddleware, (req, res) => {
  const tiers = db.prepare('SELECT * FROM tier_config ORDER BY sort_order').all()
  const collection = {}

  for (const tier of tiers) {
    const pets = db.prepare(`
      SELECT pt.*, CASE WHEN pp.id IS NOT NULL THEN 1 ELSE 0 END as owned
      FROM pets_template pt
      LEFT JOIN player_pets pp ON pt.id = pp.template_id AND pp.user_id = ?
      WHERE pt.tier = ? AND pt.is_active = 1
      ORDER BY pt.sort_order
    `).all(req.userId, tier.tier)

    collection[tier.code] = {
      tier: tier.tier,
      name: tier.name,
      subtitle: tier.subtitle,
      bezelColor: tier.bezel_color,
      pets: pets.map(p => ({
        id: p.id,
        name: p.name,
        trigram: p.trigram,
        source: p.source,
        owned: !!p.owned,
        formImages: safeJsonParse(p.form_images, {})
      }))
    }
  }

  // 无极（隐藏位）
  const hasYinYang = db.prepare(`
    SELECT COUNT(*) as cnt FROM player_pets pp
    JOIN pets_template pt ON pp.template_id = pt.id
    WHERE pp.user_id = ? AND pt.id IN ('pet_yinyu', 'pet_yangyu')
  `).get(req.userId)

  collection['wuji'] = {
    tier: 5,
    name: '无极',
    subtitle: '造物',
    bezelColor: '#6B5B2E',
    unlocked: hasYinYang.cnt >= 2,
    pets: hasYinYang.cnt >= 2 ? [{
      id: 'custom_' + req.userId,
      name: '我的造物',
      owned: true,
      isCustom: true
    }] : [{
      id: 'hidden',
      name: '???',
      owned: false,
      isHidden: true
    }]
  }

  res.json({ collection })
})

// POST /pets/hidden/check — 检查是否解锁造物权
router.post('/pets/hidden/check', authMiddleware, (req, res) => {
  const result = db.prepare(`
    SELECT COUNT(*) as cnt FROM player_pets pp
    JOIN pets_template pt ON pp.template_id = pt.id
    WHERE pp.user_id = ? AND pt.id IN ('pet_yinyu', 'pet_yangyu')
  `).get(req.userId)

  res.json({ unlocked: result.cnt >= 2 })
})

// ========== 角色接口 ==========

// GET /character/me
router.get('/character/me', authMiddleware, (req, res) => {
  const character = db.prepare('SELECT * FROM characters WHERE user_id = ?').get(req.userId)
  if (!character) return res.status(404).json({ error: '角色不存在' })

  const skin = character.current_skin_id
    ? db.prepare('SELECT * FROM character_skins WHERE id = ?').get(character.current_skin_id)
    : null

  res.json({
    character: {
      ...character,
      currentSkin: skin ? { id: skin.id, name: skin.name, image: skin.image } : null
    }
  })
})

// POST /character/update
router.post('/character/update', authMiddleware, (req, res) => {
  const { nickname, gender } = req.body
  const character = db.prepare('SELECT * FROM characters WHERE user_id = ?').get(req.userId)
  if (!character) return res.status(404).json({ error: '角色不存在' })

  if (nickname !== undefined) {
    // 改名收费
    if (nickname !== character.nickname) {
      const renameCost = getEconomyValue('character', {}).nicknameChange || 15
      const user = db.prepare('SELECT game_points FROM users WHERE id = ?').get(req.userId)
      if (user.game_points < renameCost) {
        return res.status(400).json({ error: '积分不足', required: renameCost })
      }
      db.prepare('UPDATE users SET game_points = game_points - ? WHERE id = ?').run(renameCost, req.userId)
    }
    db.prepare('UPDATE characters SET nickname = ?, updated_at = ? WHERE user_id = ?').run(nickname, Date.now(), req.userId)
  }

  if (gender !== undefined) {
    db.prepare('UPDATE characters SET gender = ?, updated_at = ? WHERE user_id = ?').run(gender, Date.now(), req.userId)
  }

  res.json({ success: true })
})

// POST /character/equip-skin
router.post('/character/equip-skin', authMiddleware, (req, res) => {
  const { skinId } = req.body
  const skin = db.prepare('SELECT * FROM character_skins WHERE id = ?').get(skinId)
  if (!skin) return res.status(404).json({ error: '皮肤不存在' })

  // 检查是否拥有
  const owned = db.prepare('SELECT * FROM player_character_skins WHERE user_id = ? AND skin_id = ?').get(req.userId, skinId)
  if (!owned) return res.status(400).json({ error: '未拥有该皮肤' })

  db.prepare('UPDATE characters SET current_skin_id = ?, updated_at = ? WHERE user_id = ?').run(skinId, Date.now(), req.userId)
  res.json({ success: true })
})

// GET /character/skins — 可购买皮肤列表
router.get('/character/skins', (req, res) => {
  const skins = db.prepare('SELECT * FROM character_skins WHERE is_active = 1 ORDER BY sort_order').all()
  res.json({ skins })
})

// POST /character/buy-skin
router.post('/character/buy-skin', authMiddleware, (req, res) => {
  const { skinId } = req.body
  const skin = db.prepare('SELECT * FROM character_skins WHERE id = ? AND is_active = 1').get(skinId)
  if (!skin) return res.status(404).json({ error: '皮肤不存在' })

  const owned = db.prepare('SELECT * FROM player_character_skins WHERE user_id = ? AND skin_id = ?').get(req.userId, skinId)
  if (owned) return res.status(400).json({ error: '已拥有该皮肤' })

  const user = db.prepare('SELECT game_points, grade FROM users WHERE id = ?').get(req.userId)
  if (!user) return res.status(401).json({ error: '登录身份不存在' })
  const price = routePrice(db, skin.price, user.grade)

  if (user.game_points < price) {
    return res.status(400).json({ error: '积分不足', required: price, current: user.game_points })
  }

  db.transaction(() => {
    debit(db, req.userId, price)
    db.prepare('INSERT INTO player_character_skins (id, user_id, skin_id, obtained_at) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), req.userId, skinId, Date.now())

  })()
  res.json({ success: true, newPoints: user.game_points - price, cost: price })
})

// ========== 造物接口 ==========

// POST /custom-pets/submit — 提交造物
router.post('/custom-pets/submit', authMiddleware, (req, res) => {
  const { name, image, trigram, skills } = req.body
  if (!name || !skills || !Array.isArray(skills)) {
    return res.status(400).json({ error: '缺少必要字段' })
  }

  // 检查是否已解锁造物权
  const check = db.prepare(`
    SELECT COUNT(*) as cnt FROM player_pets pp
    JOIN pets_template pt ON pp.template_id = pt.id
    WHERE pp.user_id = ? AND pt.id IN ('pet_yinyu', 'pet_yangyu')
  `).get(req.userId)
  if (check.cnt < 2) return res.status(403).json({ error: '未解锁造物权（需同时拥有阴鱼和阳鱼）' })

  // 检查是否已有造物
  const existing = db.prepare('SELECT id FROM custom_pets WHERE user_id = ?').get(req.userId)
  if (existing) return res.status(400).json({ error: '已提交过造物' })

  // 校验技能预算
  const maxBudget = 120
  const skillEffects = db.prepare('SELECT code, cost FROM skill_effects').all()
  const costMap = {}
  for (const s of skillEffects) costMap[s.code] = s.cost

  let totalCost = 0
  for (const skill of skills) {
    const cost = costMap[skill.effectCode]
    if (!cost) return res.status(400).json({ error: `无效技能效果：${skill.effectCode}` })
    totalCost += cost
  }
  if (totalCost > maxBudget) {
    return res.status(400).json({ error: `灵力预算超出（${totalCost}/${maxBudget}）` })
  }

  // 检查技能数
  const tierConfig = db.prepare('SELECT skill_slots FROM tier_config WHERE tier = 5').get()
  if (skills.length > (tierConfig?.skill_slots || 6)) {
    return res.status(400).json({ error: `技能数超出上限（${skills.length}/${tierConfig?.skill_slots || 6}）` })
  }

  const petId = uuidv4()
  const now = Date.now()
  db.prepare(`
    INSERT INTO custom_pets (id, user_id, name, image, trigram, status, power_points_used, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).run(petId, req.userId, name, image || '', trigram || 'qian', totalCost, now, now)

  const insertSkill = db.prepare(`
    INSERT INTO custom_pet_skills (id, custom_pet_id, effect_code, params_json, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `)
  skills.forEach((s, i) => {
    insertSkill.run(uuidv4(), petId, s.effectCode, JSON.stringify(s.params || {}), i)
  })

  res.json({ success: true, petId, status: 'pending' })
})

// GET /custom-pets/my — 我的造物
router.get('/custom-pets/my', authMiddleware, (req, res) => {
  const pet = db.prepare('SELECT * FROM custom_pets WHERE user_id = ?').get(req.userId)
  if (!pet) return res.json({ pet: null })

  const skills = db.prepare('SELECT * FROM custom_pet_skills WHERE custom_pet_id = ? ORDER BY sort_order').all(pet.id)

  res.json({
    pet: {
      ...pet,
      skills: skills.map(s => ({ effectCode: s.effect_code, params: safeJsonParse(s.params_json, {}) }))
    }
  })
})

// ========== 教师审核接口 ==========

// GET /admin/custom-pets/pending — 待审队列
router.get('/admin/custom-pets/pending', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId)
  if (!user || user.role !== 'admin') return res.status(403).json({ error: '权限不足' })

  const pets = db.prepare(`
    SELECT cp.*, u.username, u.real_name
    FROM custom_pets cp
    JOIN users u ON cp.user_id = u.id
    WHERE cp.status = 'pending'
    ORDER BY cp.created_at ASC
  `).all()

  const result = pets.map(p => ({
    ...p,
    skills: db.prepare('SELECT * FROM custom_pet_skills WHERE custom_pet_id = ? ORDER BY sort_order').all(p.id)
  }))

  res.json({ pets: result })
})

// POST /admin/custom-pets/review — 审核
router.post('/admin/custom-pets/review', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId)
  if (!user || user.role !== 'admin') return res.status(403).json({ error: '权限不足' })

  const { petId, approved, note } = req.body
  const pet = db.prepare('SELECT * FROM custom_pets WHERE id = ?').get(petId)
  if (!pet) return res.status(404).json({ error: '造物不存在' })

  const status = approved ? 'approved' : 'rejected'
  db.prepare('UPDATE custom_pets SET status = ?, review_note = ?, updated_at = ? WHERE id = ?')
    .run(status, note || '', Date.now(), petId)

  res.json({ success: true, status })
})

// ========== 活动接口 ==========

// GET /events/active — 当前活动
router.get('/events/active', (req, res) => {
  const now = Date.now()
  const events = db.prepare(`
    SELECT * FROM events WHERE is_active = 1 AND start_date <= ? AND end_date >= ?
    ORDER BY sort_order
  `).all(now, now)

  res.json({ events })
})

// POST /events/:eventId/claim — 领取活动奖励
router.post('/events/:eventId/claim', authMiddleware, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ? AND is_active = 1').get(req.params.eventId)
  if (!event) return res.status(404).json({ error: '活动不存在' })

  const now = Date.now()
  if (now < event.start_date || now > event.end_date) {
    return res.status(400).json({ error: '活动不在有效期内' })
  }

  const progress = db.prepare('SELECT * FROM player_event_progress WHERE user_id = ? AND event_id = ?').get(req.userId, req.params.eventId)
  if (!progress || !progress.completed) return res.status(400).json({ error: '活动未完成' })
  if (progress.claimed) return res.status(400).json({ error: '奖励已领取' })

  const reward = safeJsonParse(event.reward_json, {})
  const rewardPoints = reward.points || 0

  if (rewardPoints > 0) {
    db.prepare('UPDATE users SET game_points = game_points + ? WHERE id = ?').run(rewardPoints, req.userId)
  }

  db.prepare('UPDATE player_event_progress SET claimed = 1 WHERE user_id = ? AND event_id = ?').run(req.userId, req.params.eventId)

  res.json({ success: true, reward: rewardPoints })
})

// ========== 排行榜接口（改造：三榜） ==========

// GET /rankings/:id — 按 metric 读 ranking_config
router.get('/rankings/:id', (req, res) => {
  const config = db.prepare('SELECT * FROM ranking_config WHERE id = ?').get(req.params.id)
  if (!config) return res.status(404).json({ error: '榜单不存在' })

  let sql = ''
  if (config.metric === 'points') {
    sql = `
      SELECT u.username, u.real_name, u.grade, u.game_points as value,
             RANK() OVER (ORDER BY u.game_points DESC) as rank
      FROM users u WHERE u.role = 'student'
    `
  } else if (config.metric === 'power') {
    sql = `
      SELECT u.username, u.real_name, u.grade,
             COALESCE(SUM(pp.power), 0) as value,
             RANK() OVER (ORDER BY SUM(pp.power) DESC) as rank
      FROM users u
      LEFT JOIN player_pets pp ON pp.user_id = u.id
      WHERE u.role = 'student'
      GROUP BY u.id
    `
  } else if (config.metric === 'collection_rate') {
    sql = `
      SELECT u.username, u.real_name, u.grade,
             COUNT(DISTINCT pp.template_id) as value,
             RANK() OVER (ORDER BY COUNT(DISTINCT pp.template_id) DESC) as rank
      FROM users u
      LEFT JOIN player_pets pp ON pp.user_id = u.id
      WHERE u.role = 'student'
      GROUP BY u.id
    `
  }

  if (config.scope === 'grade') {
    // 按年级分榜需要前端传 grade 参数
    const grade = req.query.grade
    if (grade) sql += ` AND u.grade = ${Number(grade)}`
  }

  sql += ' ORDER BY value DESC LIMIT 100'

  const rankings = db.prepare(sql).all()
  res.json({ config, rankings })
})

// ========== 辅助函数 ==========

function safeJsonParse(str, fallback) {
  try { return JSON.parse(str) } catch { return fallback }
}

function getEconomyValue(key, fallback) {
  const row = db.prepare('SELECT value_json FROM economy_config WHERE key = ?').get(key)
  if (!row) return fallback
  try { return JSON.parse(row.value_json) } catch { return fallback }
}

export default router
