// 王宠课堂 - 游戏 API 路由
import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db.js'
import { PETS, getPetTemplate } from '../game/pet-data.js'
import { BattleState, BattleEngine, BattleAI } from '../game/battle-engine.js'
import { calcStats, MAX_LEVEL, LEVEL_EXP, getLevelBracket } from '../game/constants.js'

const router = Router()

// 内存中存储活跃战斗（P0 简化方案，后续可改 Redis）
const activeBattles = new Map()

// ========== 宠物模板 ==========

// GET /api/game/pets - 获取所有宠物模板
router.get('/pets', (req, res) => {
  const templates = db.prepare('SELECT id, name, element, role, description, signature FROM pets_template').all()
  res.json({ pets: templates })
})

// GET /api/game/pets/:id - 获取单个宠物详情（含技能）
router.get('/pets/:id', (req, res) => {
  const template = getPetTemplate(req.params.id)
  if (!template) return res.status(404).json({ error: '宠物不存在' })
  res.json({ pet: template })
})

// ========== 玩家宠物 ==========

// POST /api/game/pets/choose - 为学员选择初始宠物
router.post('/pets/choose', (req, res) => {
  const { studentId, petTemplateId } = req.body
  if (!studentId || !petTemplateId) {
    return res.status(400).json({ error: '缺少 studentId 或 petTemplateId' })
  }

  const template = getPetTemplate(petTemplateId)
  if (!template) return res.status(404).json({ error: '宠物模板不存在' })

  // 检查学员是否已有宠物
  const existing = db.prepare('SELECT id FROM player_pets WHERE user_id = ?').get(studentId)
  if (existing) {
    return res.status(400).json({ error: '该学员已有宠物' })
  }

  const petId = uuidv4()
  const now = Date.now()
  const defaultSkills = template.skills.slice(0, 1).map(s => s.id) // Lv1 只有 1 个技能

  db.prepare(`
    INSERT INTO player_pets (id, user_id, template_id, level, exp, equipped_skills, obtained_at)
    VALUES (?, ?, ?, 1, 0, ?, ?)
  `).run(petId, studentId, petTemplateId, JSON.stringify(defaultSkills), now)

  res.json({
    success: true,
    pet: {
      id: petId,
      templateId: petTemplateId,
      name: template.name,
      element: template.element,
      level: 1,
      exp: 0,
      stats: calcStats(1, template.role),
      equippedSkills: defaultSkills
    }
  })
})

// GET /api/game/my-pets/:userId - 获取学员的宠物
router.get('/my-pets/:userId', (req, res) => {
  const pets = db.prepare(`
    SELECT pp.*, pt.name, pt.element, pt.role, pt.description, pt.skills_json
    FROM player_pets pp
    JOIN pets_template pt ON pp.template_id = pt.id
    WHERE pp.user_id = ?
  `).all(req.params.userId)

  const result = pets.map(p => {
    const skills = JSON.parse(p.skills_json)
    const level = p.level
    const availableSkills = skills.slice(0, level).map(s => ({
      id: s.id,
      name: s.name,
      type: s.type,
      element: s.element,
      description: s.description,
      unlocked: true
    }))

    // 标记未解锁的技能
    const lockedSkills = skills.slice(level).map(s => ({
      id: s.id,
      name: s.name,
      unlocked: false,
      unlockLevel: skills.indexOf(s) + 1
    }))

    return {
      id: p.id,
      templateId: p.template_id,
      name: p.name,
      element: p.element,
      role: p.role,
      level: p.level,
      exp: p.exp,
      nextLevelExp: level < MAX_LEVEL ? LEVEL_EXP[level] : null,
      stats: calcStats(level, p.role),
      equippedSkills: JSON.parse(p.equipped_skills),
      availableSkills,
      lockedSkills
    }
  })

  res.json({ pets: result })
})

// POST /api/game/pets/:petId/equip - 装备技能
router.post('/pets/:petId/equip', (req, res) => {
  const { skillIds } = req.body
  if (!skillIds || skillIds.length > 4) {
    return res.status(400).json({ error: '最多装备 4 个技能' })
  }

  const pet = db.prepare('SELECT * FROM player_pets WHERE id = ?').get(req.params.petId)
  if (!pet) return res.status(404).json({ error: '宠物不存在' })

  const template = getPetTemplate(pet.template_id)
  const availableIds = template.skills.slice(0, pet.level).map(s => s.id)

  for (const id of skillIds) {
    if (!availableIds.includes(id)) {
      return res.status(400).json({ error: `技能 ${id} 未解锁` })
    }
  }

  db.prepare('UPDATE player_pets SET equipped_skills = ? WHERE id = ?')
    .run(JSON.stringify(skillIds), req.params.petId)

  res.json({ success: true, equippedSkills: skillIds })
})

// POST /api/game/pets/:petId/add-exp - 增加经验（老师加分触发）
router.post('/pets/:petId/add-exp', (req, res) => {
  const { amount } = req.body
  if (!amount || amount <= 0) return res.status(400).json({ error: '无效经验值' })

  const pet = db.prepare('SELECT * FROM player_pets WHERE id = ?').get(req.params.petId)
  if (!pet) return res.status(404).json({ error: '宠物不存在' })

  let newExp = pet.exp + amount
  let newLevel = pet.level
  let leveledUp = false

  while (newLevel < MAX_LEVEL && LEVEL_EXP[newLevel] && newExp >= LEVEL_EXP[newLevel]) {
    newExp -= LEVEL_EXP[newLevel]
    newLevel++
    leveledUp = true
  }

  if (newLevel >= MAX_LEVEL) {
    newLevel = MAX_LEVEL
  }

  db.prepare('UPDATE player_pets SET exp = ?, level = ? WHERE id = ?')
    .run(newExp, newLevel, req.params.petId)

  const template = getPetTemplate(pet.template_id)
  res.json({
    success: true,
    leveledUp,
    level: newLevel,
    exp: newExp,
    stats: calcStats(newLevel, template.role),
    newSkillUnlocked: leveledUp ? template.skills[newLevel - 1]?.id : null
  })
})

// ========== 战斗系统 ==========

// POST /api/game/battle/start - 开始战斗（P0: 自动匹配 AI）
router.post('/battle/start', (req, res) => {
  const { playerId, petId } = req.body
  if (!playerId || !petId) {
    return res.status(400).json({ error: '缺少 playerId 或 petId' })
  }

  const playerPet = db.prepare('SELECT * FROM player_pets WHERE id = ?').get(petId)
  if (!playerPet) return res.status(404).json({ error: '宠物不存在' })
  if (playerPet.user_id !== playerId) return res.status(403).json({ error: '这不是你的宠物' })

  const template = getPetTemplate(playerPet.template_id)
  const equippedSkills = JSON.parse(playerPet.equipped_skills)

  // 创建玩家战斗者配置
  const playerConfig = {
    playerId,
    petId: playerPet.template_id,
    level: playerPet.level,
    equippedSkills
  }

  // P0: 创建 AI 对手（随机宠物，同等级）
  const otherPets = PETS.filter(p => p.id !== playerPet.template_id)
  const aiPet = otherPets[Math.floor(Math.random() * otherPets.length)]
  const aiConfig = {
    playerId: 'ai_opponent',
    petId: aiPet.id,
    level: playerPet.level,
    equippedSkills: aiPet.skills.slice(0, Math.min(4, playerPet.level)).map(s => s.id)
  }

  // 创建战斗状态
  const state = new BattleState(playerConfig, aiConfig)
  const engine = new BattleEngine(state)
  engine.init()

  // 存储活跃战斗
  activeBattles.set(state.id, { state, engine, playerSide: 'A' })

  res.json({
    battleId: state.id,
    player: {
      petName: state.playerA.petName,
      element: state.playerA.element,
      level: state.playerA.level,
      hp: state.playerA.currentHp,
      maxHp: state.playerA.maxHp,
      skills: state.playerA.equippedSkills.map(s => ({
        id: s.id,
        name: s.name,
        cooldown: state.playerA.cooldowns[s.id] || 0,
        canUse: (state.playerA.cooldowns[s.id] || 0) <= 0
      }))
    },
    opponent: {
      petName: state.playerB.petName,
      element: state.playerB.element,
      level: state.playerB.level,
      hp: state.playerB.currentHp,
      maxHp: state.playerB.maxHp
    },
    turn: state.turn,
    firstHand: state.firstPlayer === 'A' ? 'player' : 'opponent'
  })
})

// POST /api/game/battle/:id/action - 玩家提交回合操作
router.post('/battle/:id/action', (req, res) => {
  const battle = activeBattles.get(req.params.id)
  if (!battle) return res.status(404).json({ error: '战斗不存在或已结束' })

  const { skillId } = req.body
  if (!skillId) return res.status(400).json({ error: '缺少 skillId' })

  const { state, engine, playerSide } = battle
  if (state.status !== 'active') {
    return res.status(400).json({ error: '战斗已结束' })
  }

  // 玩家操作
  const playerAction = { skillId }

  // AI 对手操作
  const aiSide = playerSide === 'A' ? 'B' : 'A'
  const aiFighter = aiSide === 'A' ? state.playerA : state.playerB
  const targetFighter = playerSide === 'A' ? state.playerA : state.playerB
  const ai = new BattleAI('normal')
  const aiSkillId = ai.chooseSkill(aiFighter, targetFighter)
  const aiAction = { skillId: aiSkillId }

  // 执行回合
  const actionA = playerSide === 'A' ? playerAction : aiAction
  const actionB = playerSide === 'A' ? aiAction : playerAction

  const result = engine.executeTurn(actionA, actionB)

  // 构建响应
  const playerFighter = playerSide === 'A' ? state.playerA : state.playerB
  const opponentFighter = playerSide === 'A' ? state.playerB : state.playerA

  const response = {
    turn: result.turnLog.turn,
    actions: result.turnLog.actions,
    player: {
      petName: playerFighter.petName,
      hp: playerFighter.currentHp,
      maxHp: playerFighter.maxHp,
      shield: playerFighter.shield,
      statusEffects: playerFighter.statusEffects,
      skills: playerFighter.equippedSkills.map(s => ({
        id: s.id,
        name: s.name,
        cooldown: playerFighter.cooldowns[s.id] || 0,
        canUse: (playerFighter.cooldowns[s.id] || 0) <= 0
      }))
    },
    opponent: {
      petName: opponentFighter.petName,
      hp: opponentFighter.currentHp,
      maxHp: opponentFighter.maxHp,
      shield: opponentFighter.shield
    },
    battleStatus: state.status,
    winner: state.winner ? (state.winner === playerSide ? 'player' : 'opponent') : null
  }

  // 战斗结束，保存记录
  if (state.status === 'finished') {
    const recordId = uuidv4()
    db.prepare(`
      INSERT INTO battle_records (id, battle_type, player_a_id, player_b_id, winner_id, turn_count, log_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      recordId,
      'pve',
      state.playerA.playerId,
      state.playerB.playerId,
      state.winner === 'A' ? state.playerA.playerId : state.playerB.playerId,
      state.turn,
      JSON.stringify(state.log),
      Date.now()
    )

    // 清理活跃战斗
    activeBattles.delete(req.params.id)
  }

  res.json(response)
})

// GET /api/game/battle/:id/state - 获取战斗状态
router.get('/battle/:id/state', (req, res) => {
  const battle = activeBattles.get(req.params.id)
  if (!battle) return res.status(404).json({ error: '战斗不存在或已结束' })

  const { state, playerSide } = battle
  const playerFighter = playerSide === 'A' ? state.playerA : state.playerB
  const opponentFighter = playerSide === 'A' ? state.playerB : state.playerA

  res.json({
    battleId: state.id,
    turn: state.turn,
    status: state.status,
    player: {
      petName: playerFighter.petName,
      hp: playerFighter.currentHp,
      maxHp: playerFighter.maxHp
    },
    opponent: {
      petName: opponentFighter.petName,
      hp: opponentFighter.currentHp,
      maxHp: opponentFighter.maxHp
    },
    winner: state.winner
  })
})

// GET /api/game/rankings - 获取排行榜
router.get('/rankings', (req, res) => {
  const rankings = db.prepare(`
    SELECT r.*, u.username
    FROM rankings r
    JOIN users u ON r.user_id = u.id
    ORDER BY r.mmr DESC
    LIMIT 50
  `).all()
  res.json({ rankings })
})

export default router
