// 王宠课堂 v2.0 游戏 API 路由
import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { generateToken } from '../utils/token.js'
import { hashPassword, verifyPassword } from '../utils/password.js'
import { createStudentLogin, toPublicUser } from '../utils/studentLogin.js'

import { routePrice, readEconomy, debit } from '../utils/economy.js'
import { createGachaRoute } from '../utils/gachaRoute.js'

import { createAwakenRoute } from '../utils/awakenRoute.js'

const router = Router()
const officialGacha = createGachaRoute(db)

// 本地演出不是权威战斗：明确拒绝结果记账，不能把客户端自报胜负计入战绩或奖励。
router.post('/battle/pve/result', authMiddleware, (_req, res) => {
  res.status(501).json({ success: false, code: 'AUTHORITATIVE_BATTLE_REQUIRED',
    error: '本地斗法暂不计入正式战绩，需接入服务端权威结算' })
})

// ========== 认证接口 ==========

// 学生登录：学号 + 姓名（中文名或英文名任一匹配），名单是唯一准入依据
//
// 不再自动建号：以前任何学号都能登录，名单形同虚设，还会以 grade=6 兜底写脏数据。
// 英文名重名率很高（同一个英文名在名单里能有好几个），所以姓名不能当标识符，必须先按学号定位再验名。
router.post('/auth/student/login', createStudentLogin(db))

// 管理员登录（账号+密码）
router.post('/auth/admin/login', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: '缺少账号或密码' })
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND role = ?').get(username, 'admin')
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: '账号或密码错误' })
  }

  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(Date.now(), user.id)

  const token = generateToken(user.id)
  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      username: user.username,
      realName: user.real_name,
      role: user.role
    }
  })
})

// 获取当前用户信息
router.get('/auth/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId)
  if (!user) {
    return res.status(404).json({ error: '用户不存在' })
  }
  res.json({ user: toPublicUser(db, user) })
})

// ========== 训练师接口 ==========

// 获取我的训练师信息
// 顶栏要的班级、今日功名、今日斗法、灵纹都不在 trainers 里，这里一次性算好带上，
// 免得前端再发四个请求或干脆写死假数据。派生字段一律用子查询，避免 JOIN 把行数乘开。
router.get('/trainer/me', authMiddleware, (req, res) => {
  const todayStart = new Date().setHours(0, 0, 0, 0)
  const trainer = db.prepare(`
    SELECT t.*, u.username, u.real_name, u.name_en, u.grade, u.game_points,
      (SELECT nickname FROM characters WHERE user_id = t.user_id LIMIT 1) AS character_nickname,
      (SELECT name FROM classes WHERE id = u.class_id_ref) AS class_name,
      (SELECT gender FROM students WHERE student_no = u.username LIMIT 1) AS roster_gender,
      COALESCE((SELECT SUM(amount) FROM game_points_records r
                WHERE r.user_id = t.user_id AND r.created_at >= ?), 0) AS today_points,
      (SELECT COUNT(*) FROM battle_records b
        WHERE (b.player_a_id = t.user_id OR b.player_b_id = t.user_id) AND b.created_at >= ?) AS today_battles,
      COALESCE((SELECT SUM(count) FROM player_fragments f WHERE f.user_id = t.user_id), 0) AS fragment_total
    FROM trainers t
    JOIN users u ON t.user_id = u.id
    WHERE t.user_id = ?
  `).get(todayStart, todayStart, req.userId)

  if (!trainer) {
    return res.status(404).json({ error: '训练师信息不存在' })
  }

  res.json({ trainer })
})

// 训练师升级
router.post('/trainer/level-up', authMiddleware, (req, res) => {
  const trainer = db.prepare('SELECT * FROM trainers WHERE user_id = ?').get(req.userId)
  if (!trainer) {
    return res.status(404).json({ error: '训练师信息不存在' })
  }

  const requiredExp = trainer.level * 100
  if (trainer.exp < requiredExp) {
    return res.status(400).json({ error: '经验不足', required: requiredExp, current: trainer.exp })
  }

  const newLevel = trainer.level + 1
  const newExp = trainer.exp - requiredExp
  db.prepare('UPDATE trainers SET level = ?, exp = ? WHERE user_id = ?').run(newLevel, newExp, req.userId)

  res.json({ success: true, level: newLevel, exp: newExp })
})

// 更新训练师称号
router.post('/trainer/update-title', authMiddleware, (req, res) => {
  const { title } = req.body
  if (!title) {
    return res.status(400).json({ error: '缺少称号' })
  }
  db.prepare('UPDATE trainers SET title = ? WHERE user_id = ?').run(title, req.userId)
  res.json({ success: true, title })
})

// ========== 宠物接口 ==========

// 获取宠物模板列表
router.get('/pets/templates', (req, res) => {
  const pets = db.prepare('SELECT * FROM pets_template WHERE is_active = 1 ORDER BY sort_order').all()
  res.json({ pets })
})

// 获取我的宠物列表
router.get('/pets/my', authMiddleware, (req, res) => {
  const pets = db.prepare(`
    SELECT pp.*, pt.name as template_name, pt.element, pt.role, pt.description, pt.skills_json, pt.image_prefix
    FROM player_pets pp
    JOIN pets_template pt ON pp.template_id = pt.id
    WHERE pp.user_id = ?
    ORDER BY pp.obtained_at DESC
  `).all(req.userId)

  res.json({ pets })
})

// 选择/获得宠物（通过积分兑换或抽卡）
router.post('/pets/obtain', authMiddleware, (req, res) => {
  const { templateId } = req.body
  if (!templateId) {
    return res.status(400).json({ error: '缺少宠物模板ID' })
  }

  const template = db.prepare('SELECT * FROM pets_template WHERE id = ? AND is_active = 1').get(templateId)
  if (!template) {
    return res.status(404).json({ error: '宠物模板不存在' })
  }

  // 检查是否已拥有
  const existing = db.prepare('SELECT id FROM player_pets WHERE user_id = ? AND template_id = ?').get(req.userId, templateId)
  if (existing) {
    return res.status(400).json({ error: '已拥有该宠物' })
  }

  // 检查宠物数量上限（6只）
  const count = db.prepare('SELECT COUNT(*) as cnt FROM player_pets WHERE user_id = ?').get(req.userId)
  if (count.cnt >= 6) {
    return res.status(400).json({ error: '宠物栏已满（最多6只）' })
  }

  const petId = uuidv4()
  const now = Date.now()
  const defaultSkills = JSON.parse(template.skills_json || '[]').slice(0, 1).map(s => s.id)

  db.prepare(`
    INSERT INTO player_pets (id, user_id, template_id, level, exp, equipped_skills, obtained_at)
    VALUES (?, ?, ?, 1, 0, ?, ?)
  `).run(petId, req.userId, templateId, JSON.stringify(defaultSkills), now)

  res.json({
    success: true,
    pet: {
      id: petId,
      templateId,
      name: template.name,
      element: template.element,
      level: 1
    }
  })
})

// 宠物觉醒
router.post('/pets/:petId/awaken', authMiddleware, createAwakenRoute(db))

// 装备皮肤
router.post('/pets/:petId/equip-skin', authMiddleware, (req, res) => {
  const { skinId } = req.body
  const pet = db.prepare('SELECT * FROM player_pets WHERE id = ? AND user_id = ?').get(req.params.petId, req.userId)
  if (!pet) {
    return res.status(404).json({ error: '宠物不存在' })
  }

  const skin = db.prepare('SELECT * FROM player_skins WHERE id = ? AND user_id = ?').get(skinId, req.userId)
  if (!skin) {
    return res.status(404).json({ error: '皮肤不存在或未拥有' })
  }

  db.prepare('UPDATE player_pets SET equipped_skin_id = ? WHERE id = ?').run(skinId, pet.id)
  res.json({ success: true })
})

// 获取宠物技能
router.get('/pets/:petId/skills', authMiddleware, (req, res) => {
  const pet = db.prepare('SELECT * FROM player_pets WHERE id = ? AND user_id = ?').get(req.params.petId, req.userId)
  if (!pet) {
    return res.status(404).json({ error: '宠物不存在' })
  }

  const template = db.prepare('SELECT skills_json FROM pets_template WHERE id = ?').get(pet.template_id)
  const allSkills = JSON.parse(template.skills_json || '[]')
  const learnedSkillIds = db.prepare('SELECT skill_id FROM pet_skills WHERE pet_id = ?').all(pet.id).map(s => s.skill_id)

  res.json({
    skills: allSkills.map((s, i) => ({
      ...s,
      learned: learnedSkillIds.includes(s.id),
      unlockLevel: i + 1
    }))
  })
})

// 学习技能
router.post('/pets/:petId/learn-skill', authMiddleware, (req, res) => {
  const { skillId } = req.body
  const pet = db.prepare('SELECT * FROM player_pets WHERE id = ? AND user_id = ?').get(req.params.petId, req.userId)
  if (!pet) {
    return res.status(404).json({ error: '宠物不存在' })
  }

  const existing = db.prepare('SELECT id FROM pet_skills WHERE pet_id = ? AND skill_id = ?').get(pet.id, skillId)
  if (existing) {
    return res.status(400).json({ error: '已学习该技能' })
  }

  db.prepare('INSERT INTO pet_skills (id, pet_id, skill_id, learned_at) VALUES (?, ?, ?, ?)')
    .run(uuidv4(), pet.id, skillId, Date.now())

  res.json({ success: true })
})

// 宠物图鉴
router.get('/pets/collection', authMiddleware, (req, res) => {
  const collection = db.prepare(`
    SELECT pt.*, COUNT(pp.id) as owned
    FROM pets_template pt
    LEFT JOIN player_pets pp ON pt.id = pp.template_id AND pp.user_id = ?
    WHERE pt.is_active = 1
    GROUP BY pt.id
    ORDER BY pt.sort_order
  `).all(req.userId)

  res.json({ collection })
})

// ========== 战斗接口 ==========

// 开始PVE战斗
router.post('/battle/pve/start', authMiddleware, (req, res) => {
  const { teamPetIds } = req.body
  if (!teamPetIds || !Array.isArray(teamPetIds) || teamPetIds.length === 0) {
    return res.status(400).json({ error: '请选择出战宠物' })
  }

  // 验证宠物属于该玩家
  const pets = []
  for (const petId of teamPetIds) {
    const pet = db.prepare('SELECT * FROM player_pets WHERE id = ? AND user_id = ?').get(petId, req.userId)
    if (!pet) {
      return res.status(404).json({ error: `宠物 ${petId} 不存在或不属于你` })
    }
    pets.push(pet)
  }

  // TODO: 调用战斗引擎创建战斗
  const battleId = uuidv4()
  res.json({
    battleId,
    message: '战斗开始（战斗引擎待集成）',
    team: pets.map(p => ({ id: p.id, name: p.template_id, level: p.level }))
  })
})

// 开始PVP匹配
router.post('/battle/pvp/match', authMiddleware, (req, res) => {
  const season = db.prepare('SELECT * FROM seasons WHERE is_active = 1').get()
  if (!season) {
    return res.status(400).json({ error: '当前无活跃赛季' })
  }

  const playerRank = db.prepare('SELECT * FROM pvp_rankings WHERE user_id = ? AND season_id = ?').get(req.userId, season.id)
  if (!playerRank) {
    return res.status(400).json({ error: '未参加本赛季PVP' })
  }

  // 查找匹配对手（±200分）
  const candidates = db.prepare(`
    SELECT * FROM pvp_rankings
    WHERE season_id = ? AND user_id != ?
    AND ABS(points - ?) <= 200
    ORDER BY RANDOM()
    LIMIT 1
  `).all(season.id, req.userId, playerRank.points)

  if (candidates.length === 0) {
    return res.status(404).json({ error: '未找到匹配对手' })
  }

  const opponent = candidates[0]
  res.json({
    opponent: {
      userId: opponent.user_id,
      points: opponent.points,
      tier: opponent.tier
    }
  })
})

// 班级战信息
router.get('/battle/class/info', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT class_id_ref FROM users WHERE id = ?').get(req.userId)
  if (!user || !user.class_id_ref) {
    return res.status(400).json({ error: '未绑定班级' })
  }

  const battle = db.prepare(`
    SELECT * FROM class_battles
    WHERE (class_a_id = ? OR class_b_id = ?) AND status = 'active'
    ORDER BY start_date DESC
    LIMIT 1
  `).get(user.class_id_ref, user.class_id_ref)

  if (!battle) {
    return res.json({ active: false })
  }

  const myRecords = db.prepare(`
    SELECT COUNT(*) as total, SUM(CASE WHEN result = 'win' THEN 1 ELSE 0 END) as wins
    FROM class_battle_records WHERE battle_id = ? AND user_id = ?
  `).get(battle.id, req.userId)

  res.json({
    active: true,
    battle: {
      id: battle.id,
      classA: battle.class_a_id,
      classB: battle.class_b_id,
      scoreA: battle.class_a_score,
      scoreB: battle.class_b_score,
      endDate: battle.end_date,
      myWins: myRecords.wins || 0,
      myTotal: myRecords.total || 0
    }
  })
})

// ========== 商城接口 ==========

// 获取道具列表
router.get('/shop/items', (req, res) => {
  const items = db.prepare('SELECT * FROM items_template WHERE is_active = 1 ORDER BY sort_order').all()
  res.json({ items })
})

// 购买道具
router.post('/shop/buy', authMiddleware, (req, res) => {
  const { itemId, quantity = 1 } = req.body
  if (!Number.isSafeInteger(quantity) || quantity < 1) return res.status(400).json({ error: '购买数量必须为正整数' })
  const item = db.prepare('SELECT * FROM items_template WHERE id = ? AND is_active = 1').get(itemId)
  if (!item) {
    return res.status(404).json({ error: '道具不存在' })
  }

  const user = db.prepare('SELECT game_points, grade FROM users WHERE id = ?').get(req.userId)
  if (!user) return res.status(401).json({ error: '登录身份不存在' })
  const price = routePrice(db, item.price, user.grade)
  const totalCost = price * quantity
  if (!Number.isSafeInteger(totalCost)) return res.status(400).json({ error: '购买数量超出范围' })

  if (user.game_points < totalCost) {
    return res.status(400).json({ error: '积分不足', required: totalCost, current: user.game_points })
  }

  db.transaction(() => {
    debit(db, req.userId, totalCost)

    // 检查是否已有该道具
    const existing = db.prepare('SELECT * FROM player_items WHERE user_id = ? AND item_id = ?').get(req.userId, itemId)
    if (existing) {
      db.prepare('UPDATE player_items SET quantity = quantity + ? WHERE id = ?').run(quantity, existing.id)
    } else {
      db.prepare('INSERT INTO player_items (id, user_id, item_id, quantity, obtained_at) VALUES (?, ?, ?, ?, ?)')
        .run(uuidv4(), req.userId, itemId, quantity, Date.now())
    }

    // 记录兑换
    db.prepare('INSERT INTO exchange_records (id, user_id, item_id, cost_points, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuidv4(), req.userId, itemId, totalCost, JSON.stringify({ quantity }), Date.now())

  })()
  res.json({ success: true, newPoints: user.game_points - totalCost, cost: totalCost })
})

// 获取皮肤列表
router.get('/shop/skins', (req, res) => {
  const skins = db.prepare('SELECT * FROM skins_template WHERE is_active = 1').all()
  res.json({ skins })
})

// 购买皮肤
router.post('/shop/skins/buy', authMiddleware, (req, res) => {
  const { skinId } = req.body
  const skin = db.prepare('SELECT * FROM skins_template WHERE id = ? AND is_active = 1').get(skinId)
  if (!skin) {
    return res.status(404).json({ error: '皮肤不存在' })
  }

  const user = db.prepare('SELECT game_points, grade FROM users WHERE id = ?').get(req.userId)
  if (!user) return res.status(401).json({ error: '登录身份不存在' })
  const price = routePrice(db, skin.price, user.grade)

  if (user.game_points < price) {
    return res.status(400).json({ error: '积分不足', required: price, current: user.game_points })
  }

  // 检查是否已拥有
  const existing = db.prepare('SELECT id FROM player_skins WHERE user_id = ? AND skin_id = ?').get(req.userId, skinId)
  if (existing) {
    return res.status(400).json({ error: '已拥有该皮肤' })
  }

  db.transaction(() => {
    debit(db, req.userId, price)
    db.prepare('INSERT INTO player_skins (id, user_id, skin_id, obtained_at) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), req.userId, skinId, Date.now())

  })()
  res.json({ success: true, newPoints: user.game_points - price, cost: price })
})

// ========== 抽卡接口 ==========

// 抽卡
router.post('/gacha/draw', authMiddleware, (req, res) => {
  if (req.body.kind !== undefined) return officialGacha(req, res)
  const { eggType, count = 1 } = req.body
  if (!['normal', 'rare', 'legendary'].includes(eggType)) {
    return res.status(400).json({ error: '无效的蛋类型' })
  }
  if (!Number.isInteger(count) || count < 1 || count > 10) {
    return res.status(400).json({ error: '抽卡数量1-10' })
  }

  const prices = readEconomy(db).legacyGacha
  const user = db.prepare('SELECT game_points, grade FROM users WHERE id = ?').get(req.userId)
  if (!user) return res.status(401).json({ error: '登录身份不存在' })
  const price = routePrice(db, prices[eggType], user.grade)
  const totalCost = price * count

  if (user.game_points < totalCost) {
    return res.status(400).json({ error: '积分不足', required: totalCost, current: user.game_points })
  }

  const result = db.transaction(() => {
    // 获取保底计数
    let pity = db.prepare('SELECT count FROM gacha_pity WHERE user_id = ? AND egg_type = ?').get(req.userId, eggType)
    let pityCount = pity ? pity.count : 0

    const results = []
    for (let i = 0; i < count; i++) {
      pityCount++

      // 保底检查
      let minRarity = 1
      if (pityCount >= 100) minRarity = 6
      else if (pityCount >= 50) minRarity = 5
      else if (pityCount >= 10) minRarity = 4

      // 概率抽卡
      const roll = Math.random()
      let rarity = 1

      if (eggType === 'normal') {
        if (roll < 0.1) rarity = 3
        else if (roll < 0.4) rarity = 2
        else rarity = 1
      } else if (eggType === 'rare') {
        if (roll < 0.2) rarity = 5
        else if (roll < 0.6) rarity = 4
        else rarity = 3
      } else {
        if (roll < 0.7) rarity = 6
        else rarity = 5
      }

      rarity = Math.max(rarity, minRarity)

      // 根据稀有度选择宠物
      const pets = db.prepare('SELECT * FROM pets_template WHERE rarity = ? AND is_active = 1 ORDER BY RANDOM() LIMIT 1').get(rarity)
      const petTemplate = pets || db.prepare('SELECT * FROM pets_template WHERE is_active = 1 ORDER BY RANDOM() LIMIT 1').get()

      if (petTemplate) {
        // 检查是否已拥有
        const existing = db.prepare('SELECT id FROM player_pets WHERE user_id = ? AND template_id = ?').get(req.userId, petTemplate.id)
        if (!existing) {
          const petId = uuidv4()
          const defaultSkills = JSON.parse(petTemplate.skills_json || '[]').slice(0, 1).map(s => s.id)
          db.prepare(`
            INSERT INTO player_pets (id, user_id, template_id, level, exp, equipped_skills, obtained_at)
            VALUES (?, ?, ?, 1, 0, ?, ?)
          `).run(petId, req.userId, petTemplate.id, JSON.stringify(defaultSkills), Date.now())
        }
      }

      results.push({
        petTemplateId: petTemplate?.id,
        rarity,
        isNew: !db.prepare('SELECT id FROM player_pets WHERE user_id = ? AND template_id = ?').get(req.userId, petTemplate?.id)
      })

      // 记录抽卡
      db.prepare('INSERT INTO gacha_records (id, user_id, egg_type, pet_template_id, rarity, pity_count, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(uuidv4(), req.userId, eggType, petTemplate?.id, rarity, pityCount, Date.now())
    }

    // 更新保底计数
    db.prepare('INSERT OR REPLACE INTO gacha_pity (user_id, egg_type, count) VALUES (?, ?, ?)')
      .run(req.userId, eggType, pityCount)

    // 扣除积分
    debit(db, req.userId, totalCost)

    return { results, newPoints: user.game_points - totalCost, pityCount, cost: totalCost }
  })()
  res.json(result)
})

// 抽卡记录
router.get('/gacha/records', authMiddleware, (req, res) => {
  const records = db.prepare(`
    SELECT gr.*, pt.name as pet_name
    FROM gacha_records gr
    LEFT JOIN pets_template pt ON gr.pet_template_id = pt.id
    WHERE gr.user_id = ?
    ORDER BY gr.created_at DESC
    LIMIT 100
  `).all(req.userId)

  res.json({ records })
})

// 概率公示
router.get('/gacha/rates', (req, res) => {
  res.json({
    normal: { 1: 0.6, 2: 0.3, 3: 0.1 },
    rare: { 3: 0.4, 4: 0.4, 5: 0.2 },
    legendary: { 5: 0.3, 6: 0.7 },
    pity: { guaranteed4Star: 10, guaranteed5Star: 50, guaranteed6Star: 100 }
  })
})

// ========== 任务接口 ==========

// 获取每日任务
router.get('/quests/daily', authMiddleware, (req, res) => {
  const today = new Date().setHours(0, 0, 0, 0)
  const quests = db.prepare(`SELECT * FROM quests WHERE type = 'daily' AND is_active = 1 ORDER BY sort_order`).all()
  const progress = db.prepare(`
    SELECT quest_id, progress, completed, claimed
    FROM player_quests WHERE user_id = ? AND last_reset = ?
  `).all(req.userId, today)

  res.json({ quests, progress })
})

// 获取每周任务
router.get('/quests/weekly', authMiddleware, (req, res) => {
  const now = new Date()
  const weekStart = new Date(now.setDate(now.getDate() - now.getDay())).setHours(0, 0, 0, 0)
  const quests = db.prepare(`SELECT * FROM quests WHERE type = 'weekly' AND is_active = 1 ORDER BY sort_order`).all()
  const progress = db.prepare(`
    SELECT quest_id, progress, completed, claimed
    FROM player_quests WHERE user_id = ? AND last_reset = ?
  `).all(req.userId, weekStart)

  res.json({ quests, progress })
})

// 领取任务奖励
router.post('/quests/:questId/claim', authMiddleware, (req, res) => {
  const quest = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.questId)
  if (!quest) {
    return res.status(404).json({ error: '任务不存在' })
  }

  const progress = db.prepare('SELECT * FROM player_quests WHERE user_id = ? AND quest_id = ?').get(req.userId, req.params.questId)
  if (!progress || !progress.completed) {
    return res.status(400).json({ error: '任务未完成' })
  }
  if (progress.claimed) {
    return res.status(400).json({ error: '奖励已领取' })
  }

  db.prepare('UPDATE users SET game_points = game_points + ? WHERE id = ?').run(quest.reward_points, req.userId)
  db.prepare('UPDATE trainers SET exp = exp + ? WHERE user_id = ?').run(quest.reward_exp, req.userId)
  db.prepare('UPDATE player_quests SET claimed = 1 WHERE user_id = ? AND quest_id = ?').run(req.userId, req.params.questId)

  res.json({ success: true, reward: quest.reward_points, expReward: quest.reward_exp })
})

// ========== 成就接口 ==========

// 成就列表
router.get('/achievements', (req, res) => {
  const achievements = db.prepare('SELECT * FROM achievements WHERE is_active = 1 ORDER BY sort_order').all()
  res.json({ achievements })
})

// 我的成就
router.get('/achievements/my', authMiddleware, (req, res) => {
  const achievements = db.prepare(`
    SELECT a.*, pa.completed_at
    FROM achievements a
    LEFT JOIN player_achievements pa ON a.id = pa.achievement_id AND pa.user_id = ?
    WHERE a.is_active = 1
    ORDER BY a.sort_order
  `).all(req.userId)

  res.json({ achievements })
})

// 领取成就奖励
router.post('/achievements/:id/claim', authMiddleware, (req, res) => {
  const achievement = db.prepare('SELECT * FROM achievements WHERE id = ?').get(req.params.id)
  if (!achievement) {
    return res.status(404).json({ error: '成就不存在' })
  }

  const completed = db.prepare('SELECT * FROM player_achievements WHERE user_id = ? AND achievement_id = ?').get(req.userId, req.params.id)
  if (!completed) {
    return res.status(400).json({ error: '成就未解锁' })
  }

  // 检查是否已领取（通过积分记录判断）
  const claimed = db.prepare('SELECT id FROM game_points_records WHERE user_id = ? AND reason = ?')
    .get(req.userId, `成就奖励：${achievement.name}`)
  if (claimed) {
    return res.status(400).json({ error: '奖励已领取' })
  }

  db.prepare('UPDATE users SET game_points = game_points + ? WHERE id = ?').run(achievement.reward_points, req.userId)
  db.prepare('INSERT INTO game_points_records (id, user_id, amount, reason, category, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uuidv4(), req.userId, achievement.reward_points, `成就奖励：${achievement.name}`, 'achievement', Date.now())

  res.json({ success: true, reward: achievement.reward_points })
})

// ========== 排行榜接口 ==========

// 积分排行榜
router.get('/ranking/points', (req, res) => {
  const rankings = db.prepare(`
    SELECT username, real_name, grade, game_points,
           RANK() OVER (ORDER BY game_points DESC) as rank
    FROM users WHERE role = 'student'
    ORDER BY game_points DESC LIMIT 100
  `).all()

  res.json({ rankings })
})

// PVP排行榜
router.get('/ranking/pvp', (req, res) => {
  const season = db.prepare('SELECT * FROM seasons WHERE is_active = 1').get()
  if (!season) {
    return res.json({ rankings: [] })
  }

  const rankings = db.prepare(`
    SELECT u.username, u.real_name, pr.points, pr.tier, pr.wins, pr.losses,
           RANK() OVER (ORDER BY pr.points DESC) as rank
    FROM pvp_rankings pr
    JOIN users u ON pr.user_id = u.id
    WHERE pr.season_id = ?
    ORDER BY pr.points DESC LIMIT 100
  `).all(season.id)

  res.json({ rankings, season: season.name })
})

// 班级排行榜
router.get('/ranking/class', (req, res) => {
  const rankings = db.prepare(`
    SELECT c.name, SUM(u.game_points) as total_points,
           RANK() OVER (ORDER BY SUM(u.game_points) DESC) as rank
    FROM classes c
    JOIN users u ON c.id = u.class_id_ref
    WHERE u.role = 'student'
    GROUP BY c.id
    ORDER BY total_points DESC
  `).all()

  res.json({ rankings })
})

// ========== 教师端接口 ==========

// 同步学生积分（教师端调用）
router.post('/teacher/sync-points', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId)
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' })
  }

  const { records } = req.body
  if (!records || !Array.isArray(records)) {
    return res.status(400).json({ error: '缺少积分记录' })
  }

  let synced = 0
  for (const record of records) {
    const student = db.prepare('SELECT id FROM users WHERE username = ? AND role = ?').get(record.studentNo, 'student')
    if (student) {
      db.prepare('UPDATE users SET game_points = game_points + ? WHERE id = ?').run(record.amount, student.id)
      db.prepare('INSERT INTO game_points_records (id, user_id, amount, reason, category, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(uuidv4(), student.id, record.amount, record.reason || '教师同步', 'teacher_sync', record.timestamp || Date.now())
      synced++
    }
  }

  res.json({ success: true, synced })
})

// 获取学生列表
router.get('/teacher/students', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId)
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' })
  }

  const students = db.prepare(`
    SELECT id, username, real_name, grade, class_id_ref, game_points
    FROM users WHERE role = 'student'
    ORDER BY class_id_ref, username
  `).all()

  res.json({ students })
})

// 开启班级战
router.post('/teacher/class-battle/start', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId)
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' })
  }

  const { classAId, classBId, duration = 5 } = req.body
  if (!classAId || !classBId) {
    return res.status(400).json({ error: '缺少班级ID' })
  }

  const battleId = uuidv4()
  const now = Date.now()
  const endDate = now + duration * 24 * 60 * 60 * 1000

  db.prepare(`
    INSERT INTO class_battles (id, class_a_id, class_b_id, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(battleId, classAId, classBId, now, endDate)

  res.json({ success: true, battleId, endDate })
})

// ========== 管理端接口 ==========

// 数据统计
router.get('/admin/stats', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId)
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' })
  }

  const stats = {
    totalUsers: db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'student'").get().cnt,
    totalPets: db.prepare('SELECT COUNT(*) as cnt FROM player_pets').get().cnt,
    totalBattles: db.prepare("SELECT COUNT(*) as cnt FROM battle_records WHERE battle_type = 'pvp'").get().cnt,
    totalPoints: db.prepare("SELECT COALESCE(SUM(game_points), 0) as sum FROM users WHERE role = 'student'").get().sum
  }

  res.json({ stats })
})

// 创建宠物模板
router.post('/admin/pets/create', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId)
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' })
  }

  const { id, name, element, role: petRole, description, skillsJson, imagePrefix, rarity = 1, sortOrder = 0 } = req.body
  if (!id || !name || !element || !petRole) {
    return res.status(400).json({ error: '缺少必要字段' })
  }

  db.prepare(`
    INSERT INTO pets_template (id, name, element, role, description, skills_json, image_prefix, rarity, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, name, element, petRole, description || '', skillsJson || '[]', imagePrefix || '', rarity, sortOrder)

  res.json({ success: true })
})

// 创建皮肤
router.post('/admin/skins/create', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId)
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' })
  }

  const { id, name, petTemplateId, type, price, cssClass, description, isLimited = 0 } = req.body
  if (!id || !name || !petTemplateId || !type || !cssClass) {
    return res.status(400).json({ error: '缺少必要字段' })
  }

  db.prepare(`
    INSERT INTO skins_template (id, name, pet_template_id, type, price, css_class, description, is_limited, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, name, petTemplateId, type, price || 0, cssClass, description || '', isLimited)

  res.json({ success: true })
})

// 创建任务
router.post('/admin/quests/create', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId)
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' })
  }

  const { id, name, type, description, conditionJson, rewardPoints, rewardExp, sortOrder = 0 } = req.body
  if (!id || !name || !type) {
    return res.status(400).json({ error: '缺少必要字段' })
  }

  db.prepare(`
    INSERT INTO quests (id, name, type, description, condition_json, reward_points, reward_exp, is_active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(id, name, type, description || '', conditionJson || '{}', rewardPoints || 0, rewardExp || 0, sortOrder)

  res.json({ success: true })
})

// 创建成就
router.post('/admin/achievements/create', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId)
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' })
  }

  const { id, name, category, description, conditionJson, rewardPoints, rewardTitle, sortOrder = 0 } = req.body
  if (!id || !name || !category) {
    return res.status(400).json({ error: '缺少必要字段' })
  }

  db.prepare(`
    INSERT INTO achievements (id, name, category, description, condition_json, reward_points, reward_title, is_active, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(id, name, category, description || '', conditionJson || '{}', rewardPoints || 0, rewardTitle || '', sortOrder)

  res.json({ success: true })
})

export default router
