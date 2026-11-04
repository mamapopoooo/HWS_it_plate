// @vitest-environment node
import { describe, expect, it } from 'vitest'
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
