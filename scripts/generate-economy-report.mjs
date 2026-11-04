import { writeFileSync } from 'node:fs'
import { simulateEconomy } from '../server/game/economy-simulation.js'

// 情景假设：低收入/高收入分别为中位收入的 50%/150%，并非总纲新增规则。
const GRADE_SCENARIOS = [
  { grade: 6, scenarios: [['低收入', 30], ['中位收入', 60], ['高收入', 90]] },
  { grade: 7, scenarios: [['低收入', 15], ['中位收入', 30], ['高收入', 45]] },
]
const CONSUMPTION_RATES = [0.7, 0.775, 0.85]
const HEADER = [
  'grade',
  'month',
  'scenario',
  'monthly_income',
  'total_income',
  'single_price',
  'ten_price',
  'income_equivalent_pulls',
  'target_spending_70',
  'target_spending_77_5',
  'target_spending_85',
  'target_saving_70',
  'target_saving_77_5',
  'target_saving_85',
]

const rows = []
for (const { grade, scenarios } of GRADE_SCENARIOS) {
  for (let month = 1; month <= 20; month += 1) {
    for (const [scenario, monthlyIncome] of scenarios) {
      const reports = CONSUMPTION_RATES.map((consumptionRate) =>
        simulateEconomy({ grade, months: month, monthlyIncome, consumptionRate }),
      )
      const [report70, report775, report85] = reports

      rows.push([
        grade,
        month,
        scenario,
        monthlyIncome,
        report775.totalIncome,
        report775.singlePrice,
        report775.tenPrice,
        report775.incomeEquivalentPulls,
        report70.targetSpending,
        report775.targetSpending,
        report85.targetSpending,
        report70.targetSaving,
        report775.targetSaving,
        report85.targetSaving,
      ])
    }
  }
}

const csv = `\uFEFF${[HEADER, ...rows].map((row) => row.join(',')).join('\r\n')}\r\n`
const outputFile = new URL('../docs/economy-simulation-20-months.csv', import.meta.url)
writeFileSync(outputFile, csv, 'utf8')
console.log(`已生成 ${rows.length} 行经济模拟数据：${outputFile.pathname}`)
