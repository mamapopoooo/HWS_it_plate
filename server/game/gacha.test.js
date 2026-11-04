import { describe, expect, it } from 'vitest'
import {
  ECONOMY,
  PETS,
  TIERS,
  awakeningPayment,
  createDrawState,
  drawMany,
  drawPrice,
  minTierForPull,
  pickTier,
} from './gacha.js'

function seededRandom(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
}

describe('抽卡价格', () => {
  it('G6 单抽 5 积分、十连 45 积分', () => {
    expect(drawPrice('single', 6)).toBe(5)
    expect(drawPrice('ten', 6)).toBe(45)
  })

  it('G7 单抽 3 积分、十连 27 积分', () => {
    expect(drawPrice('single', 7)).toBe(3)
    expect(drawPrice('ten', 7)).toBe(27)
  })
})

describe('服务端权威抽卡', () => {
  it('连续六次十连时第 20 抽至少二阶，第 60 抽至少三阶', () => {
    const state = createDrawState()
    const results = []

    for (let i = 0; i < 6; i += 1) {
      results.push(...drawMany(state, 10, () => 0))
    }

    expect(results).toHaveLength(60)
    expect(state.pulls).toBe(60)
    expect(results[19].tier).toBeGreaterThanOrEqual(2)
    expect(results[59].tier).toBeGreaterThanOrEqual(3)
    expect(minTierForPull(20)).toBe(2)
    expect(minTierForPull(60)).toBe(3)
  })

  it('固定随机数下前两次获得同一只宠物并严格遵守结果字段契约', () => {
    const state = createDrawState()
    const results = drawMany(state, 2, () => 0)

    expect(results[0]).toStrictEqual({
      tier: 1,
      pet_id: 'pet_luwu',
      is_new: true,
      fragments: 0,
    })
    expect(results[1]).toStrictEqual({
      tier: 1,
      pet_id: 'pet_luwu',
      is_new: false,
      fragments: ECONOMY.fragment.dupTier1,
    })
    expect(state.pulls).toBe(2)
    expect(state.owned).toEqual(new Set(['pet_luwu']))
  })

  it.each([0, 11, 1.5])('拒绝非法抽数 %s', (count) => {
    const state = createDrawState()

    expect(() => drawMany(state, count)).toThrow('抽数必须为 1 到 10 的整数')
    expect(state.pulls).toBe(0)
    expect(state.owned.size).toBe(0)
  })

  it('可抽品阶没有宠物时抛错且不更新状态', () => {
    const state = createDrawState()
    const config = {
      tiers: [{ tier: 1, isGacha: true, gachaRate: 1 }],
      pets: [],
      economy: ECONOMY,
    }

    expect(() => drawMany(state, 1, () => 0, config)).toThrow('没有可抽取的宠物')
    expect(state.pulls).toBe(0)
    expect(state.owned.size).toBe(0)
  })

  it('可抽品阶池为空时抛错且不更新状态', () => {
    const state = createDrawState()
    const config = {
      tiers: [{ tier: 1, isGacha: false, gachaRate: 1 }],
      pets: PETS,
      economy: ECONOMY,
    }

    expect(() => drawMany(state, 1, () => 0, config)).toThrow('可抽取品阶池为空')
    expect(state.pulls).toBe(0)
    expect(state.owned.size).toBe(0)
  })

  it('空品阶配置直接挑选品阶时同样抛错', () => {
    expect(() => pickTier(1, () => 0, [])).toThrow('可抽取品阶池为空')
  })
})

describe('品阶概率与觉醒碎片抵扣', () => {
  it('固定种子 LCG 抽取 10000 次的四阶频率误差均不超过 0.005', () => {
    const rng = seededRandom(2026)
    const gachaTiers = TIERS.filter((tier) => tier.isGacha && tier.gachaRate > 0)
    const counts = Object.fromEntries(gachaTiers.map((tier) => [tier.tier, 0]))

    for (let i = 0; i < 10000; i += 1) {
      counts[pickTier(1, rng)] += 1
    }

    for (const tier of gachaTiers) {
      const frequency = counts[tier.tier] / 10000
      expect(Math.abs(frequency - tier.gachaRate)).toBeLessThanOrEqual(0.005)
    }
  })

  it('碎片不足时全部用于抵扣', () => {
    expect(awakeningPayment(1, 6, 10)).toStrictEqual({
      price: 30,
      fragmentCost: 10,
      pointsCost: 20,
    })
  })

  it('碎片充足时最多抵扣价格的 50%', () => {
    expect(awakeningPayment(1, 6, 100)).toStrictEqual({
      price: 30,
      fragmentCost: 15,
      pointsCost: 15,
    })
  })

  it('觉醒价格按年级系数取整且至少为 1 积分', () => {
    expect(awakeningPayment(1, 7, 0)).toStrictEqual({
      price: 18,
      fragmentCost: 0,
      pointsCost: 18,
    })

    const economy = {
      awaken: { tier1: 1 },
      gradeCoef: { 7: 0.1 },
      fragment: { payRatio: 0.5 },
    }
    expect(awakeningPayment(1, 7, 100, economy)).toStrictEqual({
      price: 1,
      fragmentCost: 0,
      pointsCost: 1,
    })
  })
})
