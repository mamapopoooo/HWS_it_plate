// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildEconomyCsv } from '../../scripts/generate-economy-report.mjs'
import { simulateEconomy } from './economy-simulation.js'

describe('simulateEconomy', () => {
  it('G6 中位收入 20 个月折算 240 次单抽', () => {
    const report = simulateEconomy({ grade: 6, months: 20, monthlyIncome: 60 })

    expect(report).toMatchObject({
      grade: 6,
      months: 20,
      monthlyIncome: 60,
      totalIncome: 1200,
      incomeEquivalentPulls: 240,
      singlePrice: 5,
      tenPrice: 45,
    })
  })

  it('G7 中位收入 10 个月折算 100 次单抽', () => {
    const report = simulateEconomy({ grade: 7, months: 10, monthlyIncome: 30 })

    expect(report).toMatchObject({
      grade: 7,
      months: 10,
      monthlyIncome: 30,
      totalIncome: 300,
      incomeEquivalentPulls: 100,
      singlePrice: 3,
      tenPrice: 27,
    })
  })

  it('默认按 77.5% 计算目标消耗，且消耗与结余相加等于总收入', () => {
    const report = simulateEconomy({ grade: 7, months: 3, monthlyIncome: 17 })

    expect(report.consumptionRate).toBe(0.775)
    expect(report.targetSpending).toBe(Math.round(report.totalIncome * 0.775))
    expect(report.targetSaving).toBe(report.totalIncome - report.targetSpending)
    expect(report.targetSpending + report.targetSaving).toBe(report.totalIncome)
  })

  it.each([
    { months: 3, monthlyIncome: 15, totalIncome: 45, targetSpending: 32, targetSaving: 13 },
    { months: 11, monthlyIncome: 15, totalIncome: 165, targetSpending: 116, targetSaving: 49 },
    { months: 15, monthlyIncome: 45, totalIncome: 675, targetSpending: 473, targetSaving: 202 },
  ])('G7 $months 个月、月收入 $monthlyIncome 的 70% 半值消耗向上取整', ({
    months,
    monthlyIncome,
    totalIncome,
    targetSpending,
    targetSaving,
  }) => {
    const report = simulateEconomy({ grade: 7, months, monthlyIncome, consumptionRate: 0.7 })

    expect(report).toMatchObject({ totalIncome, targetSpending, targetSaving })
  })

  it('累计总收入溢出时抛错', () => {
    expect(() => simulateEconomy({
      grade: 7,
      months: 2,
      monthlyIncome: Number.MAX_VALUE,
      consumptionRate: 0.7,
    })).toThrow('累计总收入必须为有限数')
  })

  it.each([0.7, 0.85])('接受边界消耗比例 %s', (consumptionRate) => {
    const report = simulateEconomy({ grade: 6, months: 10, monthlyIncome: 60, consumptionRate })

    expect(report.consumptionRate).toBe(consumptionRate)
    expect(report.targetSpending).toBe(Math.round(report.totalIncome * consumptionRate))
    expect(report.targetSaving).toBe(report.totalIncome - report.targetSpending)
  })

  it.each([5, 8, '6', null])('拒绝非法年级 %s', (grade) => {
    expect(() => simulateEconomy({ grade, months: 1, monthlyIncome: 60 })).toThrow()
  })

  it.each([0, -1, 1.5, NaN, Infinity])('拒绝非正整数教学月 %s', (months) => {
    expect(() => simulateEconomy({ grade: 6, months, monthlyIncome: 60 })).toThrow()
  })

  it.each([-1, NaN, Infinity, -Infinity])('拒绝负数或非有限月收入 %s', (monthlyIncome) => {
    expect(() => simulateEconomy({ grade: 6, months: 1, monthlyIncome })).toThrow()
  })

  it.each([0.69, 0.851, NaN, Infinity, -Infinity])('拒绝越界或非有限消耗比例 %s', (consumptionRate) => {
    expect(() => simulateEconomy({ grade: 6, months: 1, monthlyIncome: 60, consumptionRate })).toThrow()
  })
})

describe('经济模拟 CSV 报表', () => {
  it('提交 CSV 与生成器输出逐字一致', () => {
    const committed = readFileSync(new URL('../../docs/economy-simulation-20-months.csv', import.meta.url), 'utf8')

    expect(buildEconomyCsv()).toBe(committed)
  })
})
