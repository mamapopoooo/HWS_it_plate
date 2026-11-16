import { describe, expect, it } from 'vitest'
import tiersSeed from '../../docs/seeds/tiers.json'
import trigramsSeed from '../../docs/seeds/trigrams.json'
import petsSeed from '../../docs/seeds/pets.json'
import economySeed from '../../docs/seeds/economy.json'
import skillsSeed from '../../docs/seeds/skill_effects.json'
import {
  coefAgainst,
  createFighter,
  endTurn,
  pickEnemySkill,
  resolveSkill,
  statsOf,
  winnerOf,
} from './duel-core.js'
import {
  coefAgainst as browserCoefAgainst,
  createFighter as createBrowserFighter,
  endTurn as browserEndTurn,
  pickEnemySkill as pickBrowserEnemySkill,
  resolveSkill as resolveBrowserSkill,
  winnerOf as browserWinnerOf,
} from './duel'

const config = {
  tiers: tiersSeed.tiers,
  trigrams: trigramsSeed.trigrams,
  pets: petsSeed.pets,
  economy: economySeed,
  skillEffects: skillsSeed.effects,
}

const fixedRng = (value) => () => value

describe('共享斗法核心', () => {
  it('完全由注入配置推导属性、技能与对宫系数', () => {
    expect(statsOf(3, 7, 3, config)).toEqual({ maxHp: 195, atk: 34, def: 20, spd: 24 })
    const fighter = createFighter('pet_baihu', 7, 3, config)
    expect(fighter).toMatchObject({ petId: 'pet_baihu', tier: 3, trigram: 'qian,dui', hp: 195 })
    expect(fighter.skills.map((skill) => skill.code)).toEqual([
      'damage_single',
      'damage_burn',
      'damage_aoe',
      'heal_pct',
    ])
    expect(coefAgainst('qian', 'kun', config)).toBe(1.3)
    expect(coefAgainst('kun', 'qian', config)).toBe(1.3)
    expect(coefAgainst('qian,dui', 'kun,zhen', config)).toBe(1)
  })

  it('固定 RNG 下保持命中、暴击和事件数值', () => {
    const actor = createFighter('pet_baihu', 7, 3, config)
    const target = createFighter('pet_qinglong', 7, 3, config)
    const events = resolveSkill(actor, target, 'damage_single', 'player', fixedRng(0.1), config)
    expect(events).toEqual([
      { side: 'player', kind: 'crit', value: 45, message: '白虎·监兵 用单体伤害造成 45 点伤害（暴击！）' },
    ])
    expect(target.hp).toBe(150)
  })

  it('护盾、伤害、倒下与胜方判定保持既定顺序', () => {
    const actor = createFighter('pet_baihu', 7, 3, config)
    const target = createFighter('pet_qinglong', 7, 3, config)
    target.hp = 1
    target.shield = 5
    const events = resolveSkill(actor, target, 'damage_single', 'player', fixedRng(0.5), config)
    expect(events.map(({ kind, value }) => ({ kind, value }))).toEqual([
      { kind: 'shield', value: 5 },
      { kind: 'hit', value: 23 },
      { kind: 'ko', value: 0 },
    ])
    expect(target).toMatchObject({ hp: 0, shield: 0 })
    expect(winnerOf(actor, target)).toBe('player')
    expect(winnerOf(target, actor)).toBe('enemy')
  })

  it('冷却递减且 AI 不会选择仍在冷却的技能', () => {
    const actor = createFighter('pet_baihu', 7, 3, config)
    const target = createFighter('pet_qinglong', 7, 3, config)
    const aoe = actor.skills.find((skill) => skill.code === 'damage_aoe')
    resolveSkill(actor, target, 'damage_aoe', 'player', fixedRng(0.5), config)
    expect(aoe.remain).toBe(3)
    endTurn(actor)
    expect(aoe.remain).toBe(2)
    actor.skills.forEach((skill) => { skill.remain = 1 })
    actor.skills[0].remain = 0
    expect(pickEnemySkill(actor, fixedRng(0.5))).toBe('damage_single')
  })

  it('护盾和增益保持数值、事件与持续回合', () => {
    const actor = createFighter('pet_baihu', 7, 3, config)
    const shieldEvents = resolveSkill(actor, actor, 'shield_pct', 'player', fixedRng(0.5), config)
    expect(actor.shield).toBe(39)
    expect(shieldEvents).toEqual([
      { side: 'player', kind: 'shield', value: 39, message: '白虎·监兵 获得 39 点护盾' },
    ])
    const buffEvents = resolveSkill(actor, actor, 'buff_stat', 'player', fixedRng(0.5), config)
    expect(buffEvents).toEqual([
      { side: 'player', kind: 'buff', value: 20, message: '白虎·监兵 攻击提升 20%（2 回合）' },
    ])
    expect(actor).toMatchObject({ atkBuff: 0.2, buffTurns: 2 })
    endTurn(actor)
    expect(actor).toMatchObject({ atkBuff: 0.2, buffTurns: 1 })
    endTurn(actor)
    expect(actor).toMatchObject({ atkBuff: 0, buffTurns: 0 })
  })

  it('灼烧斩在纯提取阶段保持当前单次伤害，不擅自新增 DOT', () => {
    const actor = createFighter('pet_baihu', 7, 3, config)
    const target = createFighter('pet_qinglong', 7, 3, config)
    const events = resolveSkill(actor, target, 'damage_burn', 'player', fixedRng(0.5), config)
    expect(events.map(({ kind, value }) => ({ kind, value }))).toEqual([{ kind: 'hit', value: 20 }])
    expect(target.hp).toBe(175)
    endTurn(target)
    expect(target.hp).toBe(175)
  })

  it('浏览器适配与共享核心在全部规则场景下保持一致', () => {
    for (const [attacker, defender] of [['qian', 'kun'], ['kun', 'qian'], ['qian,dui', 'kun,zhen']]) {
      expect(coefAgainst(attacker, defender, config)).toBe(browserCoefAgainst(attacker, defender))
    }

    const scenarios = [
      { skillCode: 'damage_single', rngValue: 0.1, lethal: true },
      { skillCode: 'damage_burn', rngValue: 0.5 },
      { skillCode: 'damage_aoe', rngValue: 0.5, cooldown: true },
      { skillCode: 'shield_pct', rngValue: 0.5, self: true },
      { skillCode: 'buff_stat', rngValue: 0.5, self: true, buff: true },
    ]
    for (const scenario of scenarios) {
      const coreActor = createFighter('pet_baihu', 7, 3, config)
      const coreTarget = createFighter('pet_qinglong', 7, 3, config)
      const browserActor = createBrowserFighter('pet_baihu', 7, 3)
      const browserTarget = createBrowserFighter('pet_qinglong', 7, 3)
      expect(coreActor).toEqual(browserActor)
      expect(coreTarget).toEqual(browserTarget)
      if (scenario.lethal) {
        coreTarget.hp = 1
        coreTarget.shield = 5
        browserTarget.hp = 1
        browserTarget.shield = 5
      }
      const coreReceiver = scenario.self ? coreActor : coreTarget
      const browserReceiver = scenario.self ? browserActor : browserTarget
      const coreEvents = resolveSkill(
        coreActor,
        coreReceiver,
        scenario.skillCode,
        'player',
        fixedRng(scenario.rngValue),
        config,
      )
      const browserEvents = resolveBrowserSkill(
        browserActor,
        browserReceiver,
        scenario.skillCode,
        'player',
        fixedRng(scenario.rngValue),
      )
      expect(coreEvents, scenario.skillCode).toEqual(browserEvents)
      expect(coreActor, scenario.skillCode).toEqual(browserActor)
      expect(coreReceiver, scenario.skillCode).toEqual(browserReceiver)

      if (scenario.cooldown) {
        endTurn(coreActor)
        browserEndTurn(browserActor)
        expect(coreActor).toEqual(browserActor)
        for (const fighter of [coreActor, browserActor]) {
          fighter.skills.forEach((skill) => { skill.remain = 1 })
          fighter.skills[0].remain = 0
        }
        expect(pickEnemySkill(coreActor, fixedRng(0.5))).toBe(pickBrowserEnemySkill(browserActor, fixedRng(0.5)))
      }
      if (scenario.buff) {
        endTurn(coreActor)
        browserEndTurn(browserActor)
        expect(coreActor).toEqual(browserActor)
        endTurn(coreActor)
        browserEndTurn(browserActor)
        expect(coreActor).toEqual(browserActor)
      }
      if (scenario.lethal) {
        expect(winnerOf(coreActor, coreTarget)).toBe(browserWinnerOf(browserActor, browserTarget))
        expect(winnerOf(coreTarget, coreActor)).toBe(browserWinnerOf(browserTarget, browserActor))
      }
    }
  })
})
