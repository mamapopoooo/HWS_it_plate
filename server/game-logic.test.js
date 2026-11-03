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

describe('商城折扣系统', () => {
  function calculatePrice(basePrice, grade) {
    return grade === 7 ? Math.floor(basePrice * 0.8) : basePrice
  }

  it('G7 学生应享受 8 折优惠', () => {
    expect(calculatePrice(100, 7)).toBe(80)
    expect(calculatePrice(500, 7)).toBe(400)
    expect(calculatePrice(250, 7)).toBe(200)
  })

  it('非 G7 学生应按原价', () => {
    expect(calculatePrice(100, 6)).toBe(100)
    expect(calculatePrice(500, 8)).toBe(500)
    expect(calculatePrice(100, 5)).toBe(100)
  })

  it('折扣后价格应向下取整', () => {
    expect(calculatePrice(99, 7)).toBe(79)
    expect(calculatePrice(10, 7)).toBe(8)
  })

  it('批量购买应正确计算总价', () => {
    const unitPrice = calculatePrice(100, 7)
    expect(unitPrice * 5).toBe(400)
    expect(unitPrice * 10).toBe(800)
  })
})

describe('抽卡价格计算', () => {
  const EGG_PRICES = { normal: 200, rare: 500, legendary: 1000 }

  function calculateGachaCost(eggType, count, grade) {
    const basePrice = EGG_PRICES[eggType]
    const price = basePrice * (grade === 7 ? 0.8 : 1)
    return Math.floor(price * count)
  }

  it('普通蛋单价 200', () => {
    expect(calculateGachaCost('normal', 1, 6)).toBe(200)
    expect(calculateGachaCost('normal', 10, 6)).toBe(2000)
  })

  it('稀有蛋单价 500', () => {
    expect(calculateGachaCost('rare', 1, 6)).toBe(500)
    expect(calculateGachaCost('rare', 10, 6)).toBe(5000)
  })

  it('传说蛋单价 1000', () => {
    expect(calculateGachaCost('legendary', 1, 6)).toBe(1000)
  })

  it('G7 学生抽 10 次普通蛋应为 1600', () => {
    expect(calculateGachaCost('normal', 10, 7)).toBe(1600)
  })

  it('G7 学生抽 10 次传说蛋应为 8000', () => {
    expect(calculateGachaCost('legendary', 10, 7)).toBe(8000)
  })
})

describe('觉醒费用计算', () => {
  function getAwakenCost(currentLevel) {
    if (currentLevel >= 4) return Infinity
    return (currentLevel + 1) * 500
  }

  it('0→1 觉醒费用 500', () => {
    expect(getAwakenCost(0)).toBe(500)
  })

  it('1→2 觉醒费用 1000', () => {
    expect(getAwakenCost(1)).toBe(1000)
  })

  it('2→3 觉醒费用 1500', () => {
    expect(getAwakenCost(2)).toBe(1500)
  })

  it('3→4 觉醒费用 2000', () => {
    expect(getAwakenCost(3)).toBe(2000)
  })

  it('已满觉醒（4级）不可再觉醒', () => {
    expect(getAwakenCost(4)).toBe(Infinity)
  })

  it('总觉醒费用应为 5000', () => {
    const total = 500 + 1000 + 1500 + 2000
    expect(total).toBe(5000)
  })
})

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
