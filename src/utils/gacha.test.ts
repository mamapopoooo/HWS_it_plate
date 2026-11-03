/**
 * 抽卡逻辑单测
 * 跑法：node node_modules\vitest\vitest.mjs run
 */
import { describe, expect, it } from 'vitest'
import { ECONOMY, PETS } from '@/config/gameConfig'
import {
  drawMany,
  drawOnce,
  drawPrice,
  gachaPool,
  minTierForPull,
  pickTier,
  pityProgress,
  rateTable,
} from '@/utils/gacha'

describe('概率与保底', () => {
  it('进池品阶的概率合计为 1', () => {
    const sum = rateTable().reduce((s, r) => s + r.rate, 0)
    expect(sum).toBeCloseTo(1, 10)
  })

  it('无极（第 5 阶）不进抽卡池', () => {
    expect(gachaPool().map((t) => t.tier)).toEqual([1, 2, 3, 4])
  })

  it('第 20 抽保底八卦、第 60 抽保底四象、其余为 1', () => {
    expect(minTierForPull(19)).toBe(1)
    expect(minTierForPull(20)).toBe(2)
    expect(minTierForPull(59)).toBe(1)
    expect(minTierForPull(60)).toBe(3)
  })

  it('保底进度在 0 抽时显示满额', () => {
    const p = pityProgress(0)
    expect(p.toTier2).toBe(ECONOMY.gacha.pityTier2)
    expect(p.toTier3).toBe(ECONOMY.gacha.pityTier3)
  })

  it('pickTier 按权重落在正确区间', () => {
    expect(pickTier(1, () => 0)).toBe(1) // 落在万象区间的起点
    expect(pickTier(1, () => 0.99)).toBe(4) // 落在太极区间
    expect(pickTier(3, () => 0)).toBe(3) // 保底下限生效，不会返回 1/2
  })
})

describe('抽卡与记账', () => {
  it('抽到新宠物时计入持有，重复时折算碎片', () => {
    const owned = new Set<string>()
    const state = { pulls: 0, owned }

    const first = drawOnce(state, () => 0)
    expect(first.tier).toBe(1)
    expect(first.isNew).toBe(true)
    expect(first.fragments).toBe(0)
    expect(state.pulls).toBe(1)
    expect(state.owned.size).toBe(1)

    // 同样的随机构造，再抽到同一只 → 重复
    const second = drawOnce(state, () => 0)
    expect(second.pet.id).toBe(first.pet.id)
    expect(second.isNew).toBe(false)
    expect(second.fragments).toBe(ECONOMY.fragment.dupTier1)
    expect(state.pulls).toBe(2)
  })

  it('十连抽满 10 次并推进保底计数', () => {
    const state = { pulls: 0, owned: new Set<string>() }
    const results = drawMany(state, 10, () => 0.5)
    expect(results).toHaveLength(10)
    expect(state.pulls).toBe(10)
  })

  it('抽到的宠物都属于对应品阶', () => {
    const state = { pulls: 0, owned: new Set<string>() }
    for (const r of drawMany(state, 40, () => 0.42)) {
      expect(PETS.find((p) => p.id === r.pet.id)?.tier).toBe(r.tier)
    }
  })
})

describe('价格与年级系数', () => {
  it('G6 按基准价、G7 按 0.6 结算', () => {
    expect(drawPrice('single', 6)).toBe(ECONOMY.gacha.single)
    expect(drawPrice('ten', 6)).toBe(ECONOMY.gacha.ten)
    expect(drawPrice('single', 7)).toBe(Math.round(ECONOMY.gacha.single * 0.6))
    expect(drawPrice('ten', 7)).toBe(Math.round(ECONOMY.gacha.ten * 0.6))
  })

  it('价格取整后不会出现 0', () => {
    expect(drawPrice('single', 7)).toBeGreaterThan(0)
  })
})
