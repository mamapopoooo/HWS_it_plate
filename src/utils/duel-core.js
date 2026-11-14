function getTier(config, tier) {
  return config.tiers.find((item) => item.tier === tier)
}

function getPet(config, petId) {
  return config.pets.find((item) => item.id === petId)
}

function elementCoefficient(attacker, defender, config) {
  if (attacker === 'all' || defender === 'all') return 1
  const attack = config.trigrams.find((item) => item.code === attacker)
  const defense = config.trigrams.find((item) => item.code === defender)
  if (!attack || !defense) return 1
  return attack.opposite === defense.code ? 1.3 : 1
}

export function statsOf(tier, level, awaken, config) {
  const tierCoef = getTier(config, tier)?.powerCoef ?? 1
  const levelCoef = 1 + config.economy.levelCoef * (Math.max(1, level) - 1)
  const awakenBonus = config.economy.awakenBonus[
    Math.min(awaken, config.economy.awakenBonus.length - 1)
  ] ?? 0
  const scale = tierCoef * levelCoef * (1 + awakenBonus)
  return {
    maxHp: Math.round(80 * scale),
    atk: Math.round(14 * scale),
    def: Math.round(8 * scale),
    spd: Math.round(10 * scale),
  }
}

export function createFighter(petId, level, awaken, config) {
  const pet = getPet(config, petId)
  if (!pet) return null
  const stats = statsOf(pet.tier, level, awaken, config)
  const slots = getTier(config, pet.tier)?.skillSlots ?? 2
  const skills = config.skillEffects.slice(0, Math.min(slots, 4)).map((effect) => ({
    code: effect.code,
    name: effect.name,
    cost: effect.cost,
    cd: effect.code === 'damage_aoe' ? 3 : effect.code === 'heal_pct' ? 2 : 0,
    remain: 0,
  }))
  return {
    petId,
    name: pet.name,
    pinyin: pet.pinyin,
    tier: pet.tier,
    trigram: pet.trigram,
    level,
    awaken,
    maxHp: stats.maxHp,
    hp: stats.maxHp,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
    shield: 0,
    atkBuff: 0,
    buffTurns: 0,
    skills,
  }
}

export function coefAgainst(attacker, defender, config) {
  if (attacker === 'all' || defender === 'all') return 1
  const attackCodes = attacker.split(',')
  const defenseCodes = defender.split(',')
  return Math.min(...defenseCodes.map((defense) =>
    Math.max(...attackCodes.map((attack) => elementCoefficient(attack, defense, config))),
  ))
}

export function resolveSkill(actor, target, skillCode, side, rng, config) {
  const effect = config.skillEffects.find((item) => item.code === skillCode) ?? config.skillEffects[0]
  const events = []
  const who = actor.name
  const slot = actor.skills.find((skill) => skill.code === skillCode)
  if (slot) slot.remain = slot.cd

  if (effect.code.startsWith('damage')) {
    if (rng() < 0.08) {
      events.push({ side, kind: 'miss', value: 0, message: `${who} 的${effect.name}落空了` })
      return events
    }
    const power = effect.code === 'damage_aoe' ? 60 : effect.code === 'damage_burn' ? 70 : 100
    const buffed = actor.atk * (1 + actor.atkBuff)
    const coefficient = coefAgainst(actor.trigram, target.trigram, config)
    const crit = rng() < 0.12
    const raw = Math.round((buffed * power) / 100 * coefficient * (100 / (100 + target.def)) * (crit ? 1.6 : 1))
    let dealt = raw
    if (target.shield > 0) {
      const absorbed = Math.min(target.shield, dealt)
      target.shield -= absorbed
      dealt -= absorbed
      if (absorbed > 0) {
        events.push({ side, kind: 'shield', value: absorbed, message: `${target.name} 的护盾吸收了 ${absorbed} 点伤害` })
      }
    }
    target.hp = Math.max(0, target.hp - dealt)
    events.push({
      side,
      kind: crit ? 'crit' : 'hit',
      value: dealt,
      message: `${who} 用${effect.name}造成 ${dealt} 点伤害${crit ? '（暴击！）' : ''}${coefficient > 1 ? '（属性克制）' : ''}`,
    })
    if (target.hp === 0) {
      events.push({ side, kind: 'ko', value: 0, message: `${target.name} 倒下了` })
    }
    return events
  }

  if (effect.code === 'heal_pct') {
    const heal = Math.round(actor.maxHp * 0.25)
    const before = actor.hp
    actor.hp = Math.min(actor.maxHp, actor.hp + heal)
    events.push({ side, kind: 'heal', value: actor.hp - before, message: `${who} 恢复了 ${actor.hp - before} 点生命` })
    return events
  }

  if (effect.code === 'shield_pct') {
    const amount = Math.round(actor.maxHp * 0.2)
    actor.shield += amount
    events.push({ side, kind: 'shield', value: amount, message: `${who} 获得 ${amount} 点护盾` })
    return events
  }

  if (effect.code === 'buff_stat') {
    actor.atkBuff = 0.2
    actor.buffTurns = 2
    events.push({ side, kind: 'buff', value: 20, message: `${who} 攻击提升 20%（2 回合）` })
    return events
  }

  if (effect.code === 'stun') {
    events.push({ side, kind: 'hit', value: 0, message: `${who} 施加眩晕，但对手稳住了身形` })
    return events
  }

  const raw = Math.round(actor.atk * 0.6 * (100 / (100 + target.def)))
  target.hp = Math.max(0, target.hp - raw)
  events.push({ side, kind: 'hit', value: raw, message: `${who} 抢先出手，造成 ${raw} 点伤害` })
  if (target.hp === 0) events.push({ side, kind: 'ko', value: 0, message: `${target.name} 倒下了` })
  return events
}

export function endTurn(fighter) {
  for (const skill of fighter.skills) if (skill.remain > 0) skill.remain -= 1
  if (fighter.buffTurns > 0) {
    fighter.buffTurns -= 1
    if (fighter.buffTurns === 0) fighter.atkBuff = 0
  }
}

export function pickEnemySkill(enemy, rng) {
  const usable = enemy.skills.filter((skill) => skill.remain === 0)
  const pool = usable.length > 0 ? usable : enemy.skills
  const damaging = pool.filter((skill) => skill.code.startsWith('damage') || skill.code === 'first_strike')
  const list = damaging.length > 0 ? damaging : pool
  return list[Math.floor(rng() * list.length)]?.code ?? 'damage_single'
}

export function winnerOf(player, enemy) {
  if (enemy.hp <= 0) return 'player'
  if (player.hp <= 0) return 'enemy'
  return null
}
