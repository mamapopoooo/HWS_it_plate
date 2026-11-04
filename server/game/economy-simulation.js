import { drawPrice, ECONOMY } from './gacha.js'

/** 按教学月投影收入、目标消耗、结余与累计收入等效抽数。 */
export function simulateEconomy({ grade, months, monthlyIncome, consumptionRate = 0.775 }) {
  if (![6, 7].includes(grade)) throw new Error('年级仅支持 6 或 7')
  if (!Number.isInteger(months) || months < 1) throw new Error('教学月必须为正整数')
  if (!Number.isFinite(monthlyIncome) || monthlyIncome < 0) throw new Error('月收入必须为非负有限数')
  if (!Number.isFinite(consumptionRate) || consumptionRate < 0.7 || consumptionRate > 0.85) {
    throw new Error('消耗比例必须为 0.7 至 0.85 的有限数')
  }

  const totalIncome = months * monthlyIncome
  if (!Number.isFinite(totalIncome)) throw new Error('累计总收入必须为有限数')
  const product = totalIncome * consumptionRate
  const targetSpending = Math.round(product + Number.EPSILON * product)
  const targetSaving = totalIncome - targetSpending
  const singlePrice = drawPrice('single', grade, ECONOMY)
  const tenPrice = drawPrice('ten', grade, ECONOMY)

  return {
    grade,
    months,
    monthlyIncome,
    consumptionRate,
    totalIncome,
    targetSpending,
    targetSaving,
    singlePrice,
    tenPrice,
    incomeEquivalentPulls: Math.floor(totalIncome / singlePrice),
  }
}
