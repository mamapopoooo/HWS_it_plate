// 王宠课堂 - 游戏 API 路由（队伍对战版）
import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db.js'
import { PETS, getPetTemplate } from '../game/pet-data.js'
import { BattleState, BattleEngine, BattleAI } from '../game/battle-engine.js'
import { calcStats, MAX_LEVEL, LEVEL_EXP, getLevelBracket } from '../game/constants.js'

const router = Router()
const activeBattles = new Map()

// ========== 宠物模板 ==========

router.get('/pets', (req, res) => {
  const templates = db.prepare('SELECT id, name, element, role, description, signature FROM pets_template').all()
  res.json({ pets: templates })
})

router.get('/pets/:id', (req, res) => {
  const template = getPetTemplate(req.params.id)
  if (!template) return res.status(404).json({ error: '宠物不存在' })
  res.json({ pet: template })
})

// ========== 玩家宠物 ==========

// 选择宠物（支持多次选择，最多6只不同宠物）
router.post('/pets/choose', (req, res) => {
  const { studentId, petTemplateId } = req.body
  if (!studentId || !petTemplateId) {
    return res.status(400).json({ error: '缺少 studentId 或 petTemplateId' })
  }

  const template = getPetTemplate(petTemplateId)
  if (!template) return res.status(404).json({ error: '宠物模板不存在' })

  // 检查是否已拥有该类型宠物
  const existing = db.prepare('SELECT id FROM player_pets WHERE user_id = ? AND template_id = ?').get(studentId, petTemplateId)
  if (existing) {
    return res.status(400).json({ error: '已拥有该宠物' })
  }

  // 检查是否已满6只
  const count = db.prepare('SELECT COUNT(*) as cnt FROM player_pets WHERE user_id = ?').get(studentId)
  if (count.cnt >= 6) {
    return res.status(400).json({ error: '宠物栏已满（最多6只）' })
  }

  const petId = uuidv4()
  const now = Date.now()
  const defaultSkills = template.skills.slice(0, 1).map(s => s.id)

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
      stats: calcStats(1, template.role),
      equippedSkills: defaultSkills
    }
  })
})

// 获取学员所有宠物
router.get('/my-pets/:userId', (req, res) => {
  const pets = db.prepare(`
    SELECT pp.*, pt.name, pt.element, pt.role, pt.description, pt.skills_json
    FROM player_pets pp
    JOIN pets_template pt ON pp.template_id = pt.id
    WHERE pp.user_id = ?
    ORDER BY pp.obtained_at ASC
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

// 装备技能
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

// 增加经验
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

  if (newLevel >= MAX_LEVEL) newLevel = MAX_LEVEL

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

// 开始战斗（队伍模式）
router.post('/battle/start', (req, res) => {
  const { playerId, teamPetIds } = req.body
  if (!playerId || !teamPetIds || !Array.isArray(teamPetIds) || teamPetIds.length === 0) {
    return res.status(400).json({ error: '缺少 playerId 或 teamPetIds' })
  }

  // 验证所有宠物属于该玩家
  const playerPets = []
  for (const petId of teamPetIds) {
    const pet = db.prepare('SELECT * FROM player_pets WHERE id = ?').get(petId)
    if (!pet) return res.status(404).json({ error: `宠物 ${petId} 不存在` })
    if (pet.user_id !== playerId) return res.status(403).json({ error: `宠物 ${petId} 不属于你` })
    playerPets.push(pet)
  }

  // 构建玩家队伍配置
  const playerTeam = playerPets.map(pet => {
    const template = getPetTemplate(pet.template_id)
    return {
      playerId,
      petId: pet.template_id,
      level: pet.level,
      equippedSkills: JSON.parse(pet.equipped_skills)
    }
  })

  // AI 队伍：随机选 3 只不同宠物
  const aiTeamSize = Math.min(3, playerTeam.length)
  const shuffled = [...PETS].sort(() => Math.random() - 0.5)
  const aiPets = shuffled.slice(0, aiTeamSize)
  const aiLevel = Math.round(playerTeam.reduce((sum, p) => sum + p.level, 0) / playerTeam.length)

  const aiTeam = aiPets.map(pet => ({
    playerId: 'ai_opponent',
    petId: pet.id,
    level: aiLevel,
    equippedSkills: pet.skills.slice(0, Math.min(4, aiLevel)).map(s => s.id)
  }))

  // 创建战斗
  const state = new BattleState(
    { playerId, team: playerTeam },
    { playerId: 'ai_opponent', team: aiTeam }
  )
  const engine = new BattleEngine(state)
  engine.init()

  activeBattles.set(state.id, { state, engine, playerSide: 'A' })

  res.json(buildBattleResponse(state, 'A'))
})

// 玩家操作（使用技能）
router.post('/battle/:id/action', (req, res) => {
  const battle = activeBattles.get(req.params.id)
  if (!battle) return res.status(404).json({ error: '战斗不存在或已结束' })

  const { skillId } = req.body
  if (!skillId) return res.status(400).json({ error: '缺少 skillId' })

  const { state, engine, playerSide } = battle
  if (state.status !== 'active') {
    return res.status(400).json({ error: `战斗状态: ${state.status}` })
  }

  const playerAction = { skillId }

  // AI 操作
  const aiSide = playerSide === 'A' ? 'B' : 'A'
  const aiFighter = aiSide === 'A' ? state.activeA : state.activeB
  const targetFighter = playerSide === 'A' ? state.activeA : state.activeB
  const ai = new BattleAI('normal')
  const aiSkillId = ai.chooseSkill(aiFighter, targetFighter)
  const aiAction = { skillId: aiSkillId }

  const actionA = playerSide === 'A' ? playerAction : aiAction
  const actionB = playerSide === 'A' ? aiAction : playerAction

  const result = engine.executeTurn(actionA, actionB)

  // 如果战斗进入 switch_required 且需要 AI 切换
  if (state.status === 'switch_required' && state.switchSide === aiSide) {
    const aiSwitchIndex = ai.chooseSwitch(state, aiSide)
    if (aiSwitchIndex >= 0) {
      engine.switchPet(aiSide, aiSwitchIndex)
    }
  }

  res.json(buildBattleResponse(state, playerSide))
})

// 切换宠物
router.post('/battle/:id/switch', (req, res) => {
  const battle = activeBattles.get(req.params.id)
  if (!battle) return res.status(404).json({ error: '战斗不存在或已结束' })

  const { petIndex } = req.body
  if (petIndex === undefined || petIndex === null) {
    return res.status(400).json({ error: '缺少 petIndex' })
  }

  const { state, engine, playerSide } = battle

  // 检查是否允许切换
  if (state.status !== 'switch_required' || state.switchSide !== playerSide) {
    // 如果战斗正在进行，切换会消耗一回合
    if (state.status !== 'active') {
      return res.status(400).json({ error: `当前无法切换（状态: ${state.status}）` })
    }
  }

  const success = engine.switchPet(playerSide, petIndex)
  if (!success) {
    return res.status(400).json({ error: '无法切换到该宠物' })
  }

  // 如果是主动切换（战斗进行中），AI 也行动一回合
  if (state.status === 'active') {
    const aiSide = playerSide === 'A' ? 'B' : 'A'
    const aiFighter = aiSide === 'A' ? state.activeA : state.activeB
    const targetFighter = playerSide === 'A' ? state.activeA : state.activeB
    const ai = new BattleAI('normal')
    const aiSkillId = ai.chooseSkill(aiFighter, targetFighter)

    const actionA = playerSide === 'A' ? { skillId: '__switch__' } : { skillId: aiSkillId }
    const actionB = playerSide === 'A' ? { skillId: aiSkillId } : { skillId: '__switch__' }

    // 切换方跳过攻击，AI 正常攻击
    const skipAction = { skillId: '__skip__' }
    const aiAction = { skillId: aiSkillId }
    const realActionA = playerSide === 'A' ? skipAction : aiAction
    const realActionB = playerSide === 'A' ? aiAction : skipAction

    // 手动执行 AI 的攻击（跳过切换方的行动）
    const turnLog = { turn: state.turn, actions: [] }
    state.turn++

    const aiResult = engine.executeSkill(aiFighter, targetFighter, aiSkillId)
    turnLog.actions.push(aiResult)

    if (targetFighter.currentHp <= 0) {
      targetFighter.alive = false
      targetFighter.currentHp = 0
      engine.checkKillPassives(aiFighter)
      turnLog.actions.push({
        actor: aiFighter.side,
        action: 'knockout',
        pet: targetFighter.petName,
        message: `${targetFighter.petName} 被击败！`
      })

      if (state.hasAlivePet(targetFighter.side)) {
        state.status = 'switch_required'
        state.switchSide = targetFighter.side
      } else {
        state.status = 'finished'
        state.winner = aiFighter.side
        turnLog.actions.push({
          action: 'battle_end',
          message: `${aiFighter.petName} 的队伍获胜！`
        })
      }
    }

    // 冷却递减
    for (const player of [state.activeA, state.activeB]) {
      for (const skillId of Object.keys(player.cooldowns)) {
        if (player.cooldowns[skillId] > 0) player.cooldowns[skillId]--
      }
    }

    state.log.push(turnLog)
  }

  res.json(buildBattleResponse(state, playerSide))
})

// 获取战斗状态
router.get('/battle/:id/state', (req, res) => {
  const battle = activeBattles.get(req.params.id)
  if (!battle) return res.status(404).json({ error: '战斗不存在或已结束' })

  const { state, playerSide } = battle
  res.json(buildBattleResponse(state, playerSide))
})

// 排行榜
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

// ========== 辅助函数 ==========

function buildBattleResponse(state, playerSide) {
  const playerFighter = playerSide === 'A' ? state.activeA : state.activeB
  const opponentFighter = playerSide === 'A' ? state.activeB : state.activeA
  const playerTeam = playerSide === 'A' ? state.playerA.team : state.playerB.team
  const opponentTeam = playerSide === 'A' ? state.playerB.team : state.activeA // not used directly

  // 获取最后一条日志中的 actions
  const lastLog = state.log.length > 0 ? state.log[state.log.length - 1] : null
  const actions = lastLog?.actions || []

  return {
    battleId: state.id,
    turn: state.turn,
    battleStatus: state.status,
    switchSide: state.switchSide,
    winner: state.winner ? (state.winner === playerSide ? 'player' : 'opponent') : null,
    actions,
    player: {
      petName: playerFighter.petName,
      element: playerFighter.element,
      level: playerFighter.level,
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
      element: opponentFighter.element,
      level: opponentFighter.level,
      hp: opponentFighter.currentHp,
      maxHp: opponentFighter.maxHp,
      shield: opponentFighter.shield
    },
    // 队伍信息
    playerTeam: playerTeam.map((f, i) => ({
      index: i,
      petName: f.petName,
      element: f.element,
      level: f.level,
      hp: f.currentHp,
      maxHp: f.maxHp,
      alive: f.alive,
      isActive: i === (playerSide === 'A' ? state.playerA.activeIndex : state.playerB.activeIndex)
    })),
    opponentTeamSize: (playerSide === 'A' ? state.playerB : state.playerA).team.length
  }
}

export default router
