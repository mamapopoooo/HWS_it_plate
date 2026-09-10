import { describe, it, expect } from 'vitest'
import { calculateLevel, LEVEL_CONFIG, MAX_LEVEL } from './utils/level.js'

describe('后端等级计算（7级×40分）', () => {
  it('应该与前端等级计算保持一致', () => {
    const testCases = [
      { exp: 0, level: 1 },
      { exp: 39, level: 1 },
      { exp: 40, level: 2 },
      { exp: 79, level: 2 },
      { exp: 80, level: 3 },
      { exp: 119, level: 3 },
      { exp: 120, level: 4 },
      { exp: 159, level: 4 },
      { exp: 160, level: 5 },
      { exp: 199, level: 5 },
      { exp: 200, level: 6 },
      { exp: 239, level: 6 },
      { exp: 240, level: 7 },
      { exp: 500, level: 7 },
      { exp: 1000, level: 7 },
    ]

    for (const { exp, level } of testCases) {
      expect(calculateLevel(exp), `经验 ${exp} 应该是 ${level} 级`).toBe(level)
    }
  })

  it('等级配置应为6个40分', () => {
    expect(LEVEL_CONFIG).toEqual([40, 40, 40, 40, 40, 40])
    expect(MAX_LEVEL).toBe(7)
  })

  it('满级所需总经验应为240', () => {
    const totalExp = LEVEL_CONFIG.reduce((sum, req) => sum + req, 0)
    expect(totalExp).toBe(240)
  })
})

describe('经验变化计算（用于撤回评价）', () => {
  function calculateWithdraw(student, recordPoints) {
    const expChange = Math.abs(recordPoints)
    const newExp = Math.max(0, student.pet_exp - expChange)
    const newLevel = calculateLevel(newExp)
    return { newExp, newLevel }
  }

  it('撤回加分应该正确减少经验', () => {
    const student = { pet_exp: 100, pet_level: 3 }
    const result = calculateWithdraw(student, 10)
    expect(result.newExp).toBe(90)
    expect(result.newLevel).toBe(3) // 90 >= 80, still level 3
  })

  it('撤回扣分应该正确减少经验（基于绝对值）', () => {
    const student = { pet_exp: 100, pet_level: 3 }
    const result = calculateWithdraw(student, -10)
    expect(result.newExp).toBe(90)
    expect(result.newLevel).toBe(3)
  })

  it('经验不会变成负数', () => {
    const student = { pet_exp: 5, pet_level: 1 }
    const result = calculateWithdraw(student, 100)
    expect(result.newExp).toBe(0)
    expect(result.newLevel).toBe(1)
  })
})
