// 王宠课堂 - 战斗引擎（服务端权威结算）
// 回合制队伍对战，所有计算在服务端完成

import {
  calcStats, calcDamage, getElementCoefficient,
  CRIT_RATE, BATTLE_CONFIG, STATUS_EFFECTS, MAX_LEVEL
} from './constants.js'
import { getPetTemplate } from './pet-data.js'

// ========== 战斗状态 ==========
export class BattleState {
  constructor(playerAConfig, playerBConfig) {
    this.id = generateBattleId()
    this.turn = 0
    this.status = 'waiting' // waiting | active | switch_required | finished
    this.winner = null
    this.log = []
    this.switchSide = null // 'A' | 'B' | null

    this.playerA = {
      playerId: playerAConfig.playerId,
      team: playerAConfig.team.map(c => this.createFighter(c, 'A')),
      activeIndex: 0
    }
    this.playerB = {
      playerId: playerBConfig.playerId,
      team: playerBConfig.team.map(c => this.createFighter(c, 'B')),
      activeIndex: 0
    }
  }

  get activeA() { return this.playerA.team[this.playerA.activeIndex] }
  get activeB() { return this.playerB.team[this.playerB.activeIndex] }

  createFighter(config, side) {
    const template = getPetTemplate(config.petId)
    if (!template) throw new Error(`宠物模板不存在: ${config.petId}`)

    const level = Math.min(config.level || MAX_LEVEL, MAX_LEVEL)
    const stats = calcStats(level, template.role)
    const equippedSkills = this.validateSkills(config.equippedSkills, template, level)

    return {
      side,
      playerId: config.playerId,
      petId: template.id,
      petName: template.name,
      element: template.element,
      role: template.role,
      level,
      stats: { ...stats },
      baseStats: { ...stats },
      currentHp: stats.maxHp,
      maxHp: stats.maxHp,
      shield: 0,
      equippedSkills,
      cooldowns: {},
      statusEffects: [],
      passives: [],
      dodgeChance: 0,
      accuracyMod: 0,
      firstStrike: true,
      alive: true
    }
  }

  validateSkills(skillIds, template, level) {
    const available = template.skills.filter((s, i) => i < level)
    const equipped = skillIds || available.slice(0, 4).map(s => s.id)

    if (equipped.length > 4) throw new Error('最多装备 4 个技能')

    return equipped.map(id => {
      const skill = template.skills.find(s => s.id === id)
      if (!skill) throw new Error(`技能不存在: ${id}`)
      return { ...skill }
    })
  }

  // 检查某方是否还有存活的宠物
  hasAlivePet(side) {
    const team = side === 'A' ? this.playerA.team : this.playerB.team
    return team.some(f => f.alive)
  }

  // 获取某方所有存活宠物的索引
  getAliveIndices(side) {
    const team = side === 'A' ? this.playerA.team : this.playerB.team
    return team.map((f, i) => f.alive ? i : -1).filter(i => i >= 0)
  }
}

// ========== 战斗引擎 ==========
export class BattleEngine {
  constructor(state) {
    this.state = state
  }

  init() {
    this.state.status = 'active'
    const { activeA: playerA, activeB: playerB } = this.state

    const aHasFirstCrit = playerA.equippedSkills.some(s =>
      s.effect?.type === 'passive_first_crit')
    const bHasFirstCrit = playerB.equippedSkills.some(s =>
      s.effect?.type === 'passive_first_crit')

    const aSpd = this.getEffectiveStat(playerA, 'spd')
    const bSpd = this.getEffectiveStat(playerB, 'spd')

    if (aSpd >= bSpd) {
      this.state.firstPlayer = 'A'
    } else {
      this.state.firstPlayer = 'B'
    }

    this.addLog('battle_start', {
      playerA: playerA.petName,
      playerB: playerB.petName,
      firstHand: this.state.firstPlayer
    })

    return this.state
  }

  executeTurn(actionA, actionB) {
    if (this.state.status !== 'active') {
      throw new Error('战斗未在进行中')
    }

    this.state.turn++
    const { activeA: playerA, activeB: playerB } = this.state
    const turnLog = { turn: this.state.turn, actions: [] }

    const order = this.getActionOrder(actionA, actionB)

    for (const { actor, target, action } of order) {
      if (!actor.alive) continue

      const cc = actor.statusEffects.find(e =>
        [STATUS_EFFECTS.STUN, STATUS_EFFECTS.FREEZE, STATUS_EFFECTS.PARALYZE].includes(e.status))
      if (cc) {
        turnLog.actions.push({
          actor: actor.side,
          pet: actor.petName,
          action: 'cc_skip',
          status: cc.status,
          message: `${actor.petName} 被${this.getStatusName(cc.status)}，无法行动！`
        })
        cc.remainingTurns--
        if (cc.remainingTurns <= 0) {
          actor.statusEffects = actor.statusEffects.filter(e => e !== cc)
        }
        continue
      }

      const result = this.executeSkill(actor, target, action.skillId)
      turnLog.actions.push(result)

      if (target.currentHp <= 0) {
        target.alive = false
        target.currentHp = 0

        this.checkKillPassives(actor)

        turnLog.actions.push({
          actor: actor.side,
          action: 'knockout',
          pet: target.petName,
          message: `${target.petName} 被击败！`
        })

        // 检查被击败方是否还有存活宠物
        const defeatedSide = target.side
        if (this.state.hasAlivePet(defeatedSide)) {
          this.state.status = 'switch_required'
          this.state.switchSide = defeatedSide
        } else {
          this.state.status = 'finished'
          this.state.winner = actor.side
          turnLog.actions.push({
            action: 'battle_end',
            message: `${actor.petName} 的队伍获胜！`
          })
        }
        break
      }
    }

    if (this.state.status === 'active') {
      this.processEndOfTurn(playerA, playerB, turnLog)
      this.processEndOfTurn(playerB, playerA, turnLog)

      for (const player of [playerA, playerB]) {
        for (const skillId of Object.keys(player.cooldowns)) {
          if (player.cooldowns[skillId] > 0) {
            player.cooldowns[skillId]--
          }
        }
      }

      for (const player of [playerA, playerB]) {
        player.statusEffects = player.statusEffects.filter(e => {
          e.remainingTurns--
          return e.remainingTurns > 0
        })
        player.dodgeChance = 0
      }
    }

    if (this.state.turn >= BATTLE_CONFIG.MAX_TURNS && this.state.status === 'active') {
      this.state.status = 'finished'
      const aPercent = playerA.currentHp / playerA.maxHp
      const bPercent = playerB.currentHp / playerB.maxHp
      this.state.winner = aPercent >= bPercent ? 'A' : 'B'
      turnLog.actions.push({
        action: 'timeout',
        message: `回合数耗尽！${this.state.winner === 'A' ? playerA.petName : playerB.petName} 以更高 HP 比例获胜！`
      })
    }

    this.state.log.push(turnLog)
    return { state: this.state, turnLog }
  }

  // 切换宠物
  switchPet(side, newIndex) {
    const player = side === 'A' ? this.state.playerA : this.state.playerB
    if (newIndex < 0 || newIndex >= player.team.length) return false
    if (!player.team[newIndex].alive) return false
    if (newIndex === player.activeIndex) return false

    player.activeIndex = newIndex
    const newActive = player.team[newIndex]

    if (this.state.status === 'switch_required' && this.state.switchSide === side) {
      this.state.status = 'active'
      this.state.switchSide = null
    }

    this.addLog('switch', {
      side,
      pet: newActive.petName,
      hp: newActive.currentHp,
      maxHp: newActive.maxHp
    })

    return true
  }

  executeSkill(actor, target, skillId) {
    const skill = actor.equippedSkills.find(s => s.id === skillId)
    if (!skill) throw new Error(`技能 ${skillId} 未装备`)
    if ((actor.cooldowns[skillId] || 0) > 0) throw new Error(`技能 ${skillId} 冷却中`)

    const result = {
      actor: actor.side,
      pet: actor.petName,
      skill: skill.name,
      target: target.side,
      targetPet: target.petName,
      damage: 0,
      heal: 0,
      isCrit: false,
      elementCoeff: 1.0,
      effects: [],
      message: ''
    }

    if (target.dodgeChance > 0 && Math.random() < target.dodgeChance) {
      result.message = `${actor.petName} 使用 ${skill.name}，但被 ${target.petName} 闪避了！`
      actor.cooldowns[skillId] = skill.cooldown
      return result
    }

    if (actor.accuracyMod < 0 && Math.random() < Math.abs(actor.accuracyMod)) {
      result.message = `${actor.petName} 使用 ${skill.name}，但未命中！`
      actor.cooldowns[skillId] = skill.cooldown
      return result
    }

    switch (skill.effect?.type) {
      case 'instant_kill': this.handleInstantKill(actor, target, skill, result); break
      case 'self_destruct': this.handleSelfDestruct(actor, target, skill, result); break
      case 'high_risk': this.handleHighRisk(actor, target, skill, result); break
      case 'reset_cooldowns': this.handleResetCooldowns(actor, skill, result); break
      case 'full_heal': this.handleFullHeal(actor, skill, result); break
      case 'heal': this.handleHeal(actor, skill, result); break
      case 'shield': this.handleShield(actor, skill, result); break
      case 'buff':
      case 'multi_buff': this.handleBuff(actor, skill, result); break
      case 'debuff': this.handleDebuff(actor, target, skill, result); break
      case 'dodge': this.handleDodge(actor, skill, result); break
      case 'lifesteal': this.handleLifesteal(actor, target, skill, result); break
      case 'drain': this.handleDrain(actor, target, skill, result); break
      case 'cc': this.handleCC(actor, target, skill, result); break
      case 'purify': this.handlePurify(actor, target, skill, result); break
      default: this.handleDamage(actor, target, skill, result); break
    }

    if (skill.cooldown > 0) {
      actor.cooldowns[skillId] = skill.cooldown
    }

    return result
  }

  // ========== 技能效果处理 ==========

  handleDamage(actor, target, skill, result) {
    let origCritRate = null
    if (actor.firstStrike) {
      const firstCritPassive = actor.equippedSkills.find(s => s.effect?.type === 'passive_first_crit')
      if (firstCritPassive) {
        origCritRate = skill.critRate
        skill = { ...skill, critRate: firstCritPassive.effect.critRate }
      }
      actor.firstStrike = false
    }

    const dmgResult = calcDamage(actor, target, skill)

    if (origCritRate !== null) {
      skill.critRate = origCritRate
    }

    this.applyDamage(target, dmgResult.damage)
    result.damage = dmgResult.damage
    result.isCrit = dmgResult.isCrit
    result.elementCoeff = dmgResult.elementCoeff
    result.message = `${actor.petName} 使用 ${skill.name}，造成 ${dmgResult.damage} 点伤害${dmgResult.isCrit ? '（暴击！）' : ''}${dmgResult.elementCoeff > 1 ? '（克制！）' : ''}`

    if (skill.effect?.type === 'dot' && skill.effect.probability) {
      if (Math.random() < skill.effect.probability) {
        target.statusEffects.push({
          status: skill.effect.status,
          damagePercent: skill.effect.damagePercent,
          remainingTurns: skill.effect.duration
        })
        result.effects.push(skill.effect.status)
        result.message += `（附加${this.getStatusName(skill.effect.status)}！）`
      }
    }

    const counterDmg = target.statusEffects.find(e => e.status === STATUS_EFFECTS.COUNTER_DMG)
    if (counterDmg && skill.power > 0) {
      const reflect = Math.round(dmgResult.damage * counterDmg.damagePercent)
      this.applyDamage(actor, reflect)
      result.effects.push('counter_damage')
      result.message += `（反伤 ${reflect}！）`
    }
  }

  handleInstantKill(actor, target, skill, result) {
    if (Math.random() < skill.effect.probability) {
      result.damage = target.currentHp
      result.effects.push('instant_kill')
      result.message = `${actor.petName} 使用 ${skill.name}——绝对零度命中！！${target.petName} 被直接秒杀！`
      target.currentHp = 0
    } else {
      result.message = `${actor.petName} 使用 ${skill.name}……没有命中。`
      if (skill.effect.missPenalty === 'skip_turn') {
        result.effects.push('miss')
      }
    }
  }

  handleSelfDestruct(actor, target, skill, result) {
    const damage = Math.round(actor.currentHp * 2)
    this.applyDamage(target, damage)
    result.damage = damage
    result.message = `${actor.petName} 发动自爆！造成 ${damage} 点伤害！`
    actor.currentHp = 0
    actor.alive = false
    result.effects.push('self_knockout')
    result.message += `（自身阵亡）`
  }

  handleHighRisk(actor, target, skill, result) {
    if (Math.random() < skill.effect.probability) {
      const highSkill = { ...skill, power: skill.effect.hitPower }
      const dmgResult = calcDamage(actor, target, highSkill)
      this.applyDamage(target, dmgResult.damage)
      result.damage = dmgResult.damage
      result.isCrit = dmgResult.isCrit
      result.message = `${actor.petName} 使用 ${skill.name}——成功！造成 ${dmgResult.damage} 点伤害！`

      if (skill.effect.hitBonus?.type === 'lifesteal') {
        const heal = Math.round(dmgResult.damage * skill.effect.hitBonus.convertPercent)
        this.applyHeal(actor, heal)
        result.heal = heal
        result.message += `（吸血回复 ${heal}）`
      }
    } else {
      result.message = `${actor.petName} 使用 ${skill.name}……失败了！`
      if (skill.effect.missPenalty) {
        if (skill.effect.missSelfDamage) {
          const selfDmg = Math.round(actor.maxHp * skill.effect.missSelfDamage)
          this.applyDamage(actor, selfDmg)
          result.message += `（自伤 ${selfDmg}）`
        }
        if (skill.effect.missPenalty.stat) {
          const penalty = skill.effect.missPenalty
          actor.statusEffects.push({
            status: `${penalty.stat}_down`,
            stat: penalty.stat,
            value: penalty.value,
            remainingTurns: penalty.duration
          })
          result.message += `（${penalty.stat === 'def' ? '防御' : '属性'}下降！）`
        }
      }
    }
  }

  handleResetCooldowns(actor, skill, result) {
    if (Math.random() < skill.effect.probability) {
      for (const key of Object.keys(actor.cooldowns)) {
        actor.cooldowns[key] = 0
      }
      result.effects.push('cooldown_reset')
      result.message = `${actor.petName} 使用 ${skill.name}——奇迹绽放！所有技能冷却清零！`
    } else {
      result.message = `${actor.petName} 使用 ${skill.name}……奇迹没有发生。`
    }
  }

  handleFullHeal(actor, skill, result) {
    if (Math.random() < skill.effect.probability) {
      const heal = actor.maxHp - actor.currentHp
      actor.currentHp = actor.maxHp
      result.heal = heal
      result.effects.push('full_heal')
      result.message = `${actor.petName} 使用 ${skill.name}——奇迹之光！HP 完全恢复！`
    } else {
      result.message = `${actor.petName} 使用 ${skill.name}……光芒没有降临。`
    }
  }

  handleHeal(actor, skill, result) {
    const heal = Math.round(actor.maxHp * skill.effect.valuePercent)
    this.applyHeal(actor, heal)
    result.heal = heal
    result.message = `${actor.petName} 使用 ${skill.name}，回复 ${heal} HP`
  }

  handleShield(actor, skill, result) {
    const shield = Math.round(actor.maxHp * skill.effect.valuePercent)
    actor.shield += shield
    result.effects.push('shield')
    result.message = `${actor.petName} 使用 ${skill.name}，获得 ${shield} 点护盾`
  }

  handleBuff(actor, skill, result) {
    if (skill.effect.type === 'multi_buff') {
      for (const buff of skill.effect.buffs) {
        actor.statusEffects.push({
          status: `${buff.stat}_up`,
          stat: buff.stat,
          value: buff.value,
          remainingTurns: buff.duration
        })
      }
      result.message = `${actor.petName} 使用 ${skill.name}，多项属性提升！`
    } else {
      actor.statusEffects.push({
        status: `${skill.effect.stat}_up`,
        stat: skill.effect.stat,
        value: skill.effect.value,
        remainingTurns: skill.effect.duration
      })
      const statName = this.getStatName(skill.effect.stat)
      result.message = `${actor.petName} 使用 ${skill.name}，${statName} +${Math.round(skill.effect.value * 100)}%！`
    }
  }

  handleDebuff(actor, target, skill, result) {
    const immune = target.equippedSkills.some(s =>
      s.effect?.type === 'passive_immune' && s.effect.immune === 'debuffs')
    if (immune) {
      result.message = `${actor.petName} 使用 ${skill.name}，但 ${target.petName} 免疫减益效果！`
      return
    }

    target.statusEffects.push({
      status: `${skill.effect.stat}_down`,
      stat: skill.effect.stat,
      value: skill.effect.value,
      remainingTurns: skill.effect.duration
    })
    result.message = `${actor.petName} 使用 ${skill.name}，${target.petName} ${this.getStatName(skill.effect.stat)}下降！`
  }

  handleDodge(actor, skill, result) {
    actor.dodgeChance = skill.effect.probability
    result.effects.push('dodge')
    result.message = `${actor.petName} 进入闪避姿态（${Math.round(skill.effect.probability * 100)}% 闪避率）`
  }

  handleLifesteal(actor, target, skill, result) {
    const dmgResult = calcDamage(actor, target, skill)
    this.applyDamage(target, dmgResult.damage)
    const heal = Math.round(dmgResult.damage * skill.effect.convertPercent)
    this.applyHeal(actor, heal)
    result.damage = dmgResult.damage
    result.heal = heal
    result.isCrit = dmgResult.isCrit
    result.message = `${actor.petName} 使用 ${skill.name}，造成 ${dmgResult.damage} 伤害，吸血回复 ${heal}`
  }

  handleDrain(actor, target, skill, result) {
    const dmgResult = calcDamage(actor, target, skill)
    this.applyDamage(target, dmgResult.damage)
    const drain = Math.round(target.maxHp * skill.effect.damagePercent)
    const heal = Math.round(target.maxHp * skill.effect.healPercent)
    this.applyDamage(target, drain)
    this.applyHeal(actor, heal)
    result.damage = dmgResult.damage + drain
    result.heal = heal
    result.message = `${actor.petName} 使用 ${skill.name}，吸取 ${drain} HP，回复 ${heal}`
  }

  handleCC(actor, target, skill, result) {
    if (skill.power > 0) {
      const dmgResult = calcDamage(actor, target, skill)
      this.applyDamage(target, dmgResult.damage)
      result.damage = dmgResult.damage
    }

    if (Math.random() < skill.effect.probability) {
      target.statusEffects.push({
        status: skill.effect.status,
        remainingTurns: skill.effect.duration
      })
      result.effects.push(skill.effect.status)
      result.message = `${actor.petName} 使用 ${skill.name}${skill.power > 0 ? `，造成 ${result.damage} 伤害` : ''}，${target.petName} 被${this.getStatusName(skill.effect.status)}！`
    } else {
      result.message = `${actor.petName} 使用 ${skill.name}${skill.power > 0 ? `，造成 ${result.damage} 伤害` : ''}，但控制效果未生效`
    }
  }

  handlePurify(actor, target, skill, result) {
    if (skill.power > 0) {
      const dmgResult = calcDamage(actor, target, skill)
      this.applyDamage(target, dmgResult.damage)
      result.damage = dmgResult.damage
    }

    if (skill.effect.removeDebuffs) {
      const removed = actor.statusEffects.filter(e =>
        e.status.endsWith('_down') || e.status === STATUS_EFFECTS.BURN)
      actor.statusEffects = actor.statusEffects.filter(e =>
        !e.status.endsWith('_down') && e.status !== STATUS_EFFECTS.BURN)
      result.effects.push('purify')
      result.message = `${actor.petName} 使用 ${skill.name}，驱散了 ${removed.length} 个减益效果！`
    }
  }

  // ========== 辅助方法 ==========

  applyDamage(target, damage) {
    if (target.shield > 0) {
      if (target.shield >= damage) {
        target.shield -= damage
        return
      }
      damage -= target.shield
      target.shield = 0
    }
    target.currentHp = Math.max(0, target.currentHp - damage)
  }

  applyHeal(target, heal) {
    target.currentHp = Math.min(target.maxHp, target.currentHp + heal)
  }

  getEffectiveStat(player, stat) {
    let value = player.baseStats[stat] || 0
    for (const effect of player.statusEffects) {
      if (effect.stat === stat) {
        value *= (1 + effect.value)
      }
    }
    for (const skill of player.equippedSkills) {
      if (skill.effect?.type === 'passive_low_hp') {
        const hpPercent = player.currentHp / player.maxHp
        if (hpPercent < skill.effect.threshold && skill.effect.stat === stat) {
          value *= skill.effect.multiplier
        }
      }
    }
    return Math.max(1, Math.round(value))
  }

  getActionOrder(actionA, actionB) {
    const { activeA: playerA, activeB: playerB } = this.state
    const aSpd = this.getEffectiveStat(playerA, 'spd')
    const bSpd = this.getEffectiveStat(playerB, 'spd')

    const aSkill = playerA.equippedSkills.find(s => s.id === actionA.skillId)
    const bSkill = playerB.equippedSkills.find(s => s.id === actionB.skillId)
    const aPriority = aSkill?.priority || 0
    const bPriority = bSkill?.priority || 0

    if (aPriority > bPriority) return [{ actor: playerA, target: playerB, action: actionA }, { actor: playerB, target: playerA, action: actionB }]
    if (bPriority > aPriority) return [{ actor: playerB, target: playerA, action: actionB }, { actor: playerA, target: playerB, action: actionA }]

    if (aSpd >= bSpd) {
      return [{ actor: playerA, target: playerB, action: actionA }, { actor: playerB, target: playerA, action: actionB }]
    }
    return [{ actor: playerB, target: playerA, action: actionB }, { actor: playerA, target: playerB, action: actionA }]
  }

  processEndOfTurn(player, opponent, turnLog) {
    const dots = player.statusEffects.filter(e =>
      [STATUS_EFFECTS.BURN].includes(e.status) && e.damagePercent)
    for (const dot of dots) {
      const dotDmg = Math.round(player.maxHp * dot.damagePercent)
      player.currentHp = Math.max(0, player.currentHp - dotDmg)
      turnLog.actions.push({
        actor: player.side,
        action: 'dot_tick',
        status: dot.status,
        damage: dotDmg,
        message: `${player.petName} 受到${this.getStatusName(dot.status)}伤害 ${dotDmg}`
      })
    }

    for (const skill of player.equippedSkills) {
      if (skill.effect?.type === 'passive_regen') {
        if (this.state.turn % skill.effect.interval === 0) {
          const heal = Math.round(player.maxHp * skill.effect.valuePercent)
          this.applyHeal(player, heal)
          turnLog.actions.push({
            actor: player.side,
            action: 'passive_regen',
            heal,
            message: `${player.petName} 的${skill.name}触发，回复 ${heal} HP`
          })
        }
      }
    }

    if (player.currentHp <= 0) {
      player.alive = false
      if (this.state.hasAlivePet(player.side)) {
        this.state.status = 'switch_required'
        this.state.switchSide = player.side
      } else {
        this.state.status = 'finished'
        this.state.winner = opponent.side
      }
    }
  }

  checkKillPassives(killer) {
    for (const skill of killer.equippedSkills) {
      if (skill.effect?.type === 'passive_on_kill') {
        const bonus = Math.round(killer.baseStats[skill.effect.stat] * skill.effect.value)
        killer.baseStats[skill.effect.stat] += bonus
        if (skill.effect.stackable) {
          this.addLog('passive_trigger', {
            pet: killer.petName,
            passive: skill.name,
            stat: skill.effect.stat,
            bonus
          })
        }
      }
    }
  }

  getStatusName(status) {
    const names = {
      burn: '灼烧', freeze: '冰冻', paralyze: '麻痹',
      stun: '眩晕', dodge: '闪避', shield: '护盾',
      counter_dmg: '反伤'
    }
    return names[status] || status
  }

  getStatName(stat) {
    const names = { atk: '攻击', def: '防御', spd: '速度', accuracy: '命中率' }
    return names[stat] || stat
  }

  addLog(type, data) {
    this.state.log.push({ type, ...data, turn: this.state.turn })
  }
}

// ========== 工具函数 ==========
function generateBattleId() {
  return 'battle_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)
}

// ========== AI 决策 ==========
export class BattleAI {
  constructor(difficulty) {
    this.difficulty = difficulty
  }

  chooseSkill(fighter, opponent) {
    const available = fighter.equippedSkills.filter(s =>
      (fighter.cooldowns[s.id] || 0) <= 0)

    if (available.length === 0) {
      return fighter.equippedSkills[0].id
    }

    switch (this.difficulty) {
      case 'easy': return this.easyChoice(available)
      case 'hard': return this.hardChoice(fighter, opponent, available)
      default: return this.normalChoice(fighter, opponent, available)
    }
  }

  easyChoice(available) {
    return available[Math.floor(Math.random() * available.length)].id
  }

  normalChoice(fighter, opponent, available) {
    const scored = available.map(s => {
      let score = (s.power || 0.5) * 10
      const elemCoeff = getElementCoefficient(s.element, opponent.element)
      score *= elemCoeff
      if (elemCoeff < 1.0) score *= 0.3
      if (elemCoeff > 1.0) score *= 1.5
      if (fighter.currentHp / fighter.maxHp < 0.3 && s.effect?.type === 'heal') score += 30
      if (fighter.shield === 0 && s.effect?.type === 'shield') score += 10
      return { id: s.id, score }
    })
    scored.sort((a, b) => b.score - a.score)
    if (Math.random() < 0.8) return scored[0].id
    return available[Math.floor(Math.random() * available.length)].id
  }

  hardChoice(fighter, opponent, available) {
    const hpPercent = fighter.currentHp / fighter.maxHp
    const oppHpPercent = opponent.currentHp / opponent.maxHp

    if (oppHpPercent < 0.3) {
      const ult = available.find(s => s.type === 'ultimate')
      if (ult) return ult.id
    }
    if (hpPercent < 0.2) {
      const gamble = available.find(s => s.type === 'gamble')
      if (gamble) return gamble.id
    }

    const scored = available.map(s => {
      let score = (s.power || 0) * getElementCoefficient(s.element, opponent.element)
      if (s.effect?.type === 'cc') score += 20
      if (s.effect?.type === 'heal' && hpPercent < 0.5) score += 30
      return { id: s.id, score }
    })
    scored.sort((a, b) => b.score - a.score)
    return scored[0].id
  }

  // AI 选择切换宠物
  chooseSwitch(battleState, aiSide) {
    const aliveIndices = battleState.getAliveIndices(aiSide)
    if (aliveIndices.length === 0) return -1

    const player = aiSide === 'A' ? battleState.playerA : battleState.playerB
    const opponent = aiSide === 'A' ? battleState.activeB : battleState.activeA

    // 选择克制对手属性的宠物
    let bestIndex = aliveIndices[0]
    let bestScore = -1

    for (const idx of aliveIndices) {
      const pet = player.team[idx]
      let score = 0
      const elemCoeff = getElementCoefficient(pet.element, opponent.element)
      score += elemCoeff * 10
      score += pet.currentHp / pet.maxHp * 5
      if (score > bestScore) {
        bestScore = score
        bestIndex = idx
      }
    }

    return bestIndex
  }
}
