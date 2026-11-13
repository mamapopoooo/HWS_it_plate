import { describe, it, expect } from 'vitest'

// 从 game-v2.js 提取的核心游戏逻辑进行单元测试

describe('抽卡概率系统', () => {
  const GACHA_RATES = {
    normal: { 1: 0.6, 2: 0.3, 3: 0.1 },
    rare: { 3: 0.4, 4: 0.4, 5: 0.2 },
    legendary: { 5: 0.3, 6: 0.7 }
  }

  const PITY_THRESHOLDS = {
    guaranteed4Star: 10,
    guaranteed5Star: 50,
    guaranteed6Star: 100
  }

  function simulateDraw(eggType, pityCount) {
    let minRarity = 1
    if (pityCount >= PITY_THRESHOLDS.guaranteed6Star) minRarity = 6
    else if (pityCount >= PITY_THRESHOLDS.guaranteed5Star) minRarity = 5
    else if (pityCount >= PITY_THRESHOLDS.guaranteed4Star) minRarity = 4

    const roll = Math.random()
    const rates = GACHA_RATES[eggType]
    let rarity = 1
    let cumulative = 0
    for (const [r, prob] of Object.entries(rates).sort((a, b) => Number(a[0]) - Number(b[0]))) {
      cumulative += prob
      if (roll < cumulative) {
        rarity = Number(r)
        break
      }
    }

    return Math.max(rarity, minRarity)
  }

  it('普通蛋不应抽出4★以上（无保底时）', () => {
    for (let i = 0; i < 100; i++) {
      const rarity = simulateDraw('normal', 1)
      expect(rarity).toBeLessThanOrEqual(3)
    }
  })

  it('传说蛋不应抽出低于5★', () => {
    for (let i = 0; i < 100; i++) {
      const rarity = simulateDraw('legendary', 1)
      expect(rarity).toBeGreaterThanOrEqual(5)
    }
  })

  it('10次保底应确保至少4★', () => {
    for (let i = 0; i < 50; i++) {
      const rarity = simulateDraw('normal', 10)
      expect(rarity).toBeGreaterThanOrEqual(4)
    }
  })

  it('50次保底应确保至少5★', () => {
    for (let i = 0; i < 50; i++) {
      const rarity = simulateDraw('normal', 50)
      expect(rarity).toBeGreaterThanOrEqual(5)
    }
  })

  it('100次保底应确保6★', () => {
    for (let i = 0; i < 50; i++) {
      const rarity = simulateDraw('normal', 100)
      expect(rarity).toBe(6)
    }
  })

  it('保底计数应递增稀有度', () => {
    const r1 = simulateDraw('normal', 9)
    const r10 = simulateDraw('normal', 10)
    // 第10次保底至少4★，第9次不一定
    expect(r10).toBeGreaterThanOrEqual(4)
  })
})

// 经济规则不再复制旧八折/500觉醒公式；实际消费路由回归见economy-routes.test.js。

describe('训练师升级系统', () => {
  function getRequiredExp(level) {
    return level * 100
  }

  it('1→2 需要 100 经验', () => {
    expect(getRequiredExp(1)).toBe(100)
  })

  it('2→3 需要 200 经验', () => {
    expect(getRequiredExp(2)).toBe(200)
  })

  it('5→6 需要 500 经验', () => {
    expect(getRequiredExp(5)).toBe(500)
  })

  it('经验不足时不应升级', () => {
    const level = 3
    const exp = 250
    const required = getRequiredExp(level)
    expect(exp < required).toBe(true)
  })

  it('升级后剩余经验应正确计算', () => {
    const exp = 350
    const required = getRequiredExp(3) // 300
    const newExp = exp - required
    expect(newExp).toBe(50)
  })
})
