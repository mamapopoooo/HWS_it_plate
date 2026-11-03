// 种子文件校验（DSH 内部工具，可保留供 Qoder 灌库前自检）
// 用法：node docs/seeds/_validate.mjs
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
const problems = []

function load(name) {
  try {
    return JSON.parse(readFileSync(join(dir, name), 'utf8'))
  } catch (e) {
    problems.push(`${name} 不是合法 JSON: ${e.message}`)
    return null
  }
}

const tiers = load('tiers.json')
const trigrams = load('trigrams.json')
const pets = load('pets.json')
const effects = load('skill_effects.json')
const economy = load('economy.json')
const skins = load('skins.json')

const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
console.log(`JSON 文件: ${files.join(', ')}`)

if (tiers && trigrams && pets) {
  const tierNums = new Set(tiers.tiers.map((t) => t.tier))
  const codes = new Set(trigrams.trigrams.map((t) => t.code))

  // 八卦对宫必须两两互指
  for (const t of trigrams.trigrams) {
    const opp = trigrams.trigrams.find((x) => x.code === t.opposite)
    if (!opp) problems.push(`属性 ${t.code} 的 opposite 不存在: ${t.opposite}`)
    else if (opp.opposite !== t.code) problems.push(`属性 ${t.code} 与 ${t.opposite} 的 opposite 未互指`)
  }

  const ids = new Set()
  const perTier = {}
  for (const p of pets.pets) {
    if (ids.has(p.id)) problems.push(`宠物 id 重复: ${p.id}`)
    ids.add(p.id)
    if (!tierNums.has(p.tier)) problems.push(`${p.id} 的 tier 不存在: ${p.tier}`)
    for (const tr of String(p.trigram).split(',')) {
      if (tr !== 'all' && !codes.has(tr)) problems.push(`${p.id} 的 trigram 不存在: ${tr}`)
    }
    perTier[p.tier] = (perTier[p.tier] || 0) + 1
  }

  // 数量必须是 24 / 8 / 4 / 2
  const expect = { 1: 24, 2: 8, 3: 4, 4: 2 }
  for (const [tier, want] of Object.entries(expect)) {
    const got = perTier[tier] || 0
    if (got !== want) problems.push(`tier ${tier} 数量应为 ${want}，实际 ${got}`)
  }

  // 抽卡概率合计
  const rateSum = tiers.tiers.reduce((s, t) => s + (t.gachaRate || 0), 0)
  if (Math.abs(rateSum - 1) > 1e-9) problems.push(`抽卡概率合计 ${rateSum}，应为 1`)

  // 觉醒上限 = 形态数 - 1
  for (const t of tiers.tiers) {
    if (t.awakenCap !== t.formCount - 1) problems.push(`tier ${t.tier} 觉醒上限与形态数不匹配`)
  }

  console.log(`宠物: ${pets.pets.length} 只，分阶 ${JSON.stringify(perTier)}`)
  console.log(`抽卡概率合计: ${rateSum}`)
}

if (effects) {
  let cost = 0
  for (const e of effects.effects) cost += e.cost
  console.log(`技能效果: ${effects.effects.length} 项，单技能平均消耗 ${(cost / effects.effects.length).toFixed(1)} 灵力（预算 ${effects.customBudget}）`)
  if (cost / effects.effects.length > effects.customBudget / effects.customSkillCount) {
    problems.push('平均效果消耗高于「预算 ÷ 技能数」，可能出现无法配满 3 个技能')
  }
}

if (skins && economy) {
  const genders = { male: 0, female: 0 }
  for (const s of skins.skins) genders[s.gender] = (genders[s.gender] || 0) + 1
  if (genders.male !== genders.female) problems.push(`皮肤男女数量不配对: ${JSON.stringify(genders)}`)
  console.log(`皮肤: ${skins.skins.length} 套（男女各 ${genders.male}）`)
  if (!economy.gradeCoef['7']) problems.push('economy.gradeCoef 缺少 G7 系数')
  console.log(`G7 系数: ${economy.gradeCoef['7']}，单抽 ${economy.gacha.single} 分`)
}

console.log('\n=== 结果 ===')
if (problems.length === 0) console.log('通过：种子数据一致')
else problems.forEach((p) => console.log('问题: ' + p))
process.exit(problems.length === 0 ? 0 : 1)
