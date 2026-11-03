/**
 * 斗法逻辑单测（纯函数，不依赖 DOM）
 */
import { describe, expect, it } from 'vitest'
import { SKILL_EFFECTS } from '@/config/contentConfig'
import { coefAgainst, createFighter, endTurn, pickEnemySkill, resolveSkill, statsOf } from '@/utils/duel'

const fixedRng = (v: number) => () => v

describe('战斗单位', () => {
  it('按品阶/等级/觉醒推导三维，且高阶更强', () => {
    const wanxiang = statsOf(1, 5, 0)
    const sixiang = statsOf(3, 5, 0)
    expect(sixiang.maxHp).toBeGreaterThan(wanxiang.maxHp)
    expect(sixiang.atk).toBeGreaterThan(wanxiang.atk)
  })

  it('从未知 id 造单位返回 null，不抛错', () => {
    expect(createFighter('pet_不存在', 1, 0)).toBeNull()
  })

  it('技能数量受品阶技能位限制，且都来自效果池', () => {
    const pet = createFighter('pet_baihu', 7, 3)
    expect(pet).not.toBeNull()
    expect(pet!.skills.length).toBeLessThanOrEqual(4)
    const codes = SKILL_EFFECTS.map((e) => e.code)
    for (const s of pet!.skills) expect(codes).toContain(s.code)
  })

  it('初始血量为满值', () => {
    const pet = createFighter('pet_jiuweihu', 3, 0)!
    expect(pet.hp).toBe(pet.maxHp)
  })
})

describe('属性克制', () => {
  it('对宫互冲 1.3，被对宫也是 1.3（双向）', () => {
    expect(coefAgainst('qian', 'kun')).toBe(1.3)
    expect(coefAgainst('kun', 'qian')).toBe(1.3)
    expect(coefAgainst('zhen', 'dui')).toBe(1)
  })

  it('双属性取最有利的一条（四象）', () => {
    // 白虎 = 乾 + 兑；对坤时，乾克坤 → 1.3
    expect(coefAgainst('qian,dui', 'kun')).toBe(1.3)
  })

  it('全属不吃克制', () => {
    expect(coefAgainst('all', 'kan')).toBe(1)
    expect(coefAgainst('li', 'all')).toBe(1)
  })
})

describe('技能结算', () => {
  it('普通命中会造成正数伤害', () => {
    const p = createFighter('pet_baihu', 7, 3)!
    const e = createFighter('pet_qinglong', 7, 3)!
    const before = e.hp
    const events = resolveSkill(p, e, 'damage_single', 'player', fixedRng(0.5))
    const hit = events.find((x) => x.kind === 'hit' || x.kind === 'crit')
    expect(hit).toBeTruthy()
    expect(hit!.value).toBeGreaterThan(0)
    expect(e.hp).toBe(before - hit!.value)
  })

  it('rng 极小值时判定闪避，不掉血', () => {
    const p = createFighter('pet_baihu', 7, 3)!
    const e = createFighter('pet_qinglong', 7, 3)!
    const before = e.hp
    const events = resolveSkill(p, e, 'damage_single', 'player', fixedRng(0.01))
    expect(events[0].kind).toBe('miss')
    expect(e.hp).toBe(before)
  })

  it('rng 落在暴击区间时倍率更高', () => {
    const p1 = createFighter('pet_baihu', 7, 3)!
    const e1 = createFighter('pet_qinglong', 7, 3)!
    const normal = resolveSkill(p1, e1, 'damage_single', 'player', () => 0.5)[0]

    const p2 = createFighter('pet_baihu', 7, 3)!
    const e2 = createFighter('pet_qinglong', 7, 3)!
    const crit = resolveSkill(p2, e2, 'damage_single', 'player', () => 0.1)[0]

    expect(crit.kind).toBe('crit')
    expect(crit.value).toBeGreaterThan(normal.value)
  })

  it('治疗不会超过生命上限', () => {
    const p = createFighter('pet_baize', 5, 1)!
    p.hp = p.maxHp - 1
    resolveSkill(p, p, 'heal_pct', 'player', fixedRng(0.5))
    expect(p.hp).toBe(p.maxHp)
  })

  it('护盾会先吸收伤害', () => {
    const p = createFighter('pet_baihu', 7, 3)!
    const e = createFighter('pet_qinglong', 7, 3)!
    e.shield = 9999
    const before = e.hp
    resolveSkill(p, e, 'damage_single', 'player', fixedRng(0.5))
    expect(e.hp).toBe(before)
    expect(e.shield).toBeLessThan(9999)
  })

  it('血量归零时产生倒下事件', () => {
    const p = createFighter('pet_baihu', 7, 3)!
    const e = createFighter('pet_qinglong', 1, 0)!
    e.hp = 1
    const events = resolveSkill(p, e, 'damage_single', 'player', fixedRng(0.5))
    expect(e.hp).toBe(0)
    expect(events.some((x) => x.kind === 'ko')).toBe(true)
  })

  it('使用后进入冷却，回合结束递减', () => {
    const p = createFighter('pet_wanxiang' as string, 1, 0) ?? createFighter('pet_huan', 3, 0)!
    const slot = p.skills.find((s) => s.cd > 0) ?? p.skills[0]
    const e = createFighter('pet_baize', 3, 0)!
    resolveSkill(p, e, slot.code, 'player', fixedRng(0.5))
    expect(slot.remain).toBe(slot.cd === 0 ? 0 : slot.cd)
    endTurn(p)
    expect(slot.remain).toBe(Math.max(0, slot.cd - 1))
  })

  it('敌方 AI 只挑可用的技能', () => {
    const e = createFighter('pet_qinglong', 7, 3)!
    e.skills.forEach((s) => (s.remain = 1))
    e.skills[0].remain = 0
    expect(pickEnemySkill(e, fixedRng(0.5))).toBe(e.skills[0].code)
  })
})
