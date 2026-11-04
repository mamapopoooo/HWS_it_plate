/**
 * 回合制斗法逻辑（纯函数，无 DOM、无 Vue，可单测、可替换为服务端权威）
 *
 * 数值口径与 00-总纲 §6 一致：品阶系数 × 等级系数 × (1 + 觉醒加成)；
 * 属性克制 = 对宫互冲 ×1.3（双向，见 gameConfig.elementCoefficient 的注释）。
 */
import { ECONOMY, elementCoefficient, getPet, getTier } from '@/config/gameConfig'
import { SKILL_EFFECTS } from '@/config/contentConfig'

export type Side = 'player' | 'enemy'

export interface DuelSkill {
  code: string
  name: string
  cost: number
  /** 冷却回合数 */
  cd: number
  /** 剩余冷却，0 表示可用 */
  remain: number
}

export interface DuelFighter {
  petId: string
  name: string
  pinyin: string
  tier: number
  trigram: string
  level: number
  awaken: number
  maxHp: number
  hp: number
  atk: number
  def: number
  spd: number
  /** 护盾可吸收的伤害 */
  shield: number
  /** 攻击/防御增益（本回合百分比，0.2 = +20%） */
  atkBuff: number
  buffTurns: number
  skills: DuelSkill[]
}

export interface DuelEvent {
  side: Side
  /** 表现层用：命中/暴击/闪避/治疗/护盾/增益/倒下 */
  kind: 'hit' | 'crit' | 'miss' | 'heal' | 'shield' | 'buff' | 'ko'
  value: number
  message: string
}

export interface DuelState {
  player: DuelFighter
  enemy: DuelFighter
  turn: number
  log: DuelEvent[]
  finished: boolean
  winner?: Side
}

/** 由品阶/等级/觉醒推导三维 */
export function statsOf(tier: number, level: number, awaken: number) {
  const t = getTier(tier)
  const tierCoef = t?.powerCoef ?? 1
  const levelCoef = 1 + ECONOMY.levelCoef * (Math.max(1, level) - 1)
  const awakenBonus = ECONOMY.awakenBonus[Math.min(awaken, ECONOMY.awakenBonus.length - 1)] ?? 0
  const scale = tierCoef * levelCoef * (1 + awakenBonus)
  return {
    maxHp: Math.round(80 * scale),
    atk: Math.round(14 * scale),
    def: Math.round(8 * scale),
    spd: Math.round(10 * scale),
  }
}

/** 从宠物库造一个战斗单位（技能取效果池前 N 个，够用即可） */
export function createFighter(petId: string, level: number, awaken: number): DuelFighter | null {
  const pet = getPet(petId)
  if (!pet) return null
  const s = statsOf(pet.tier, level, awaken)
  const slots = getTier(pet.tier)?.skillSlots ?? 2
  const skills: DuelSkill[] = SKILL_EFFECTS.slice(0, Math.min(slots, 4)).map((e) => ({
    code: e.code,
    name: e.name,
    cost: e.cost,
    cd: e.code === 'damage_aoe' ? 3 : e.code === 'heal_pct' ? 2 : 0,
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
    maxHp: s.maxHp,
    hp: s.maxHp,
    atk: s.atk,
    def: s.def,
    spd: s.spd,
    shield: 0,
    atkBuff: 0,
    buffTurns: 0,
    skills,
  }
}

/** 属性系数：双属性取对自身最有利的一条（四象） */
export function coefAgainst(attacker: string, defender: string): number {
  if (attacker === 'all' || defender === 'all') return 1
  const atkCodes = attacker.split(',')
  const defCodes = defender.split(',')
  // 对每个防守属性，攻击方取最优；防守方再从自己的属性中取最优（系数最低）。
  return Math.min(...defCodes.map((d) =>
    Math.max(...atkCodes.map((a) => elementCoefficient(a, d))),
  ))
}

/**
 * 结算一次技能。返回本次产生的表现事件（不改动对手以外的东西）。
 * 随机源可注入，便于测试。
 */
export function resolveSkill(
  actor: DuelFighter,
  target: DuelFighter,
  skillCode: string,
  side: Side,
  rng: () => number = Math.random,
): DuelEvent[] {
  const effect = SKILL_EFFECTS.find((e) => e.code === skillCode) ?? SKILL_EFFECTS[0]
  const events: DuelEvent[] = []
  const who = actor.name

  // 冷却
  const slot = actor.skills.find((s) => s.code === skillCode)
  if (slot) slot.remain = slot.cd

  if (effect.code.startsWith('damage')) {
    // 命中判定：8% 闪避
    if (rng() < 0.08) {
      events.push({ side, kind: 'miss', value: 0, message: `${who} 的${effect.name}落空了` })
      return events
    }
    const power = effect.code === 'damage_aoe' ? 60 : effect.code === 'damage_burn' ? 70 : 100
    const buffed = actor.atk * (1 + actor.atkBuff)
    const coef = coefAgainst(actor.trigram, target.trigram)
    const crit = rng() < 0.12
    const raw = Math.round((buffed * power) / 100 * coef * (100 / (100 + target.def)) * (crit ? 1.6 : 1))

    // 护盾先扣
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
      message: `${who} 用${effect.name}造成 ${dealt} 点伤害${crit ? '（暴击！）' : ''}${coef > 1 ? '（属性克制）' : ''}`,
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

  // first_strike 等：仅影响先后手，伤害为小幅突袭
  const raw = Math.round(actor.atk * 0.6 * (100 / (100 + target.def)))
  target.hp = Math.max(0, target.hp - raw)
  events.push({ side, kind: 'hit', value: raw, message: `${who} 抢先出手，造成 ${raw} 点伤害` })
  if (target.hp === 0) events.push({ side, kind: 'ko', value: 0, message: `${target.name} 倒下了` })
  return events
}

/** 回合结束：冷却递减、增益倒计时 */
export function endTurn(fighter: DuelFighter) {
  for (const s of fighter.skills) if (s.remain > 0) s.remain -= 1
  if (fighter.buffTurns > 0) {
    fighter.buffTurns -= 1
    if (fighter.buffTurns === 0) fighter.atkBuff = 0
  }
}

/** 敌方 AI：优先能用的伤害技能 */
export function pickEnemySkill(enemy: DuelFighter, rng: () => number = Math.random): string {
  const usable = enemy.skills.filter((s) => s.remain === 0)
  const pool = usable.length > 0 ? usable : enemy.skills
  const damaging = pool.filter((s) => s.code.startsWith('damage') || s.code === 'first_strike')
  const list = damaging.length > 0 ? damaging : pool
  return list[Math.floor(rng() * list.length)]?.code ?? 'damage_single'
}
