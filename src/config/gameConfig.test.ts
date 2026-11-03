/**
 * 配置层单测：宠物库、属性克制、战力、形态与价格
 * 跑法：node node_modules\vitest\vitest.mjs run
 */
import { describe, expect, it } from 'vitest'
import {
  ECONOMY,
  PETS,
  TIERS,
  TRIGRAMS,
  calcPower,
  elementCoefficient,
  formFromAwaken,
  formName,
  getPet,
  getTier,
  getTrigram,
  priceFor,
  styleName,
  tierName,
  trigramGlyphs,
  trigramLabel,
} from '@/config/gameConfig'

describe('宠物库完整性', () => {
  it('官方宠物 38 只，分阶 24/8/4/2', () => {
    expect(PETS).toHaveLength(38)
    const byTier = (t: number) => PETS.filter((p) => p.tier === t).length
    expect([byTier(1), byTier(2), byTier(3), byTier(4)]).toEqual([24, 8, 4, 2])
  })

  it('每只宠物都有注音与合法风格', () => {
    for (const p of PETS) {
      expect(p.pinyin, `${p.name} 缺注音`).toBeTruthy()
      expect(['meng', 'jun', 'ya', 'qi']).toContain(p.style)
      expect(p.name).toBeTruthy()
    }
  })

  it('注音与 id 一一对应，可按 id 反查', () => {
    const pet = getPet('pet_jiuweihu')
    expect(pet?.name).toBe('九尾狐')
    expect(pet?.pinyin).toBe('jiǔ wěi hú')
    expect(getPet('不存在的 id')).toBeUndefined()
  })

  it('萌系占比不低于 15%', () => {
    const meng = PETS.filter((p) => p.style === 'meng').length
    expect(meng / PETS.length).toBeGreaterThanOrEqual(0.15)
  })
})

describe('品阶与形态', () => {
  it('五阶齐全，觉醒上限 = 形态数 - 1', () => {
    expect(TIERS).toHaveLength(5)
    for (const t of TIERS) expect(t.awakenCap).toBe(t.formCount - 1)
  })

  it('形态号受品阶形态数封顶', () => {
    expect(formFromAwaken(1, 0)).toBe(1)
    expect(formFromAwaken(1, 5)).toBe(2) // 万象只有 2 形态
    expect(formFromAwaken(3, 5)).toBe(4) // 四象 4 形态
    expect(formFromAwaken(5, 5)).toBe(6) // 无极 6 形态
  })

  it('形态与品阶的名字可读', () => {
    expect(formName(1)).toBe('初相')
    expect(formName(6)).toBe('无相')
    expect(tierName(3)).toBe('四象')
    expect(styleName('qi')).toBe('奇诡')
  })
})

describe('八卦与克制', () => {
  it('八个属性，对宫两两互指', () => {
    expect(TRIGRAMS).toHaveLength(8)
    for (const t of TRIGRAMS) {
      expect(getTrigram(t.code)?.opposite).toBeTruthy()
      expect(getTrigram(t.opposite)?.opposite).toBe(t.code)
    }
  })

  it('对宫互冲 1.3、其余 1.0（相冲是双向的，没有单向减伤）', () => {
    expect(elementCoefficient('qian', 'kun')).toBe(1.3)
    expect(elementCoefficient('kun', 'qian')).toBe(1.3)
    expect(elementCoefficient('kan', 'li')).toBe(1.3)
    expect(elementCoefficient('li', 'kan')).toBe(1.3)
    expect(elementCoefficient('zhen', 'dui')).toBe(1)
    expect(elementCoefficient('qian', 'qian')).toBe(1)
  })

  it('全属（太极）不吃克制', () => {
    expect(elementCoefficient('all', 'kan')).toBe(1)
    expect(elementCoefficient('li', 'all')).toBe(1)
  })

  it('卦象符号与中文标签正确', () => {
    expect(trigramGlyphs('zhun')).toBe('·') // 非法编码退化为占位符
    expect(trigramGlyphs('zhen,xun')).toBe('☳☴')
    expect(trigramGlyphs('all')).toBe('☯')
    expect(trigramLabel('zhen,xun')).toBe('震 + 巽')
    expect(trigramLabel('all')).toBe('全属')
  })
})

describe('战力与价格', () => {
  it('战力公式与总纲 §6.3 一致', () => {
    // 四象 Lv.7 觉醒 3：100 × 1.25 × 1.30 × 1.50 = 244
    expect(calcPower(3, 7, 3)).toBe(244)
    // 万象 Lv.1 觉醒 0 = 100
    expect(calcPower(1, 1, 0)).toBe(100)
    // 无极 Lv.7 觉醒 5：100 × 1.57 × 1.30 × 2.50 = 510
    expect(calcPower(5, 7, 5)).toBe(510)
  })

  it('战力随等级单调递增', () => {
    for (let lv = 1; lv < ECONOMY.levelCap; lv++) {
      expect(calcPower(2, lv + 1, 0)).toBeGreaterThan(calcPower(2, lv, 0))
    }
  })

  it('年级系数只影响价格，不影响战力', () => {
    expect(priceFor(100, 6)).toBe(100)
    expect(priceFor(100, 7)).toBe(60)
    expect(priceFor(5, 7)).toBe(3)
    expect(priceFor(1, 7)).toBeGreaterThan(0)
    expect(getTier(3)?.powerCoef).toBe(1.25)
  })
})
