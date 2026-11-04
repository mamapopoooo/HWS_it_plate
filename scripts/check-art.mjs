#!/usr/bin/env node
/**
 * 立绘缺口检查（美工交付用，命令行版）
 *
 * 用法：node scripts/check-art.mjs
 * 读取 docs/seeds/pets.json 与 tiers.json，按品阶形态数推算应有张数，
 * 检查 public/pets/{id}/form{N}.png 是否存在；角色皮肤同理。
 *
 * 退出码：0 = 齐全；1 = 有缺口（便于接入 CI/构建前检查）
 */
import { existsSync, readFileSync } from 'node:fs'

const read = (p) => JSON.parse(readFileSync(p, 'utf8'))
const pets = read('docs/seeds/pets.json').pets
const tiers = read('docs/seeds/tiers.json').tiers
const skins = read('docs/seeds/skins.json').skins

const formCountOf = (tier) => tiers.find((t) => t.tier === tier)?.formCount ?? 1
const shortId = (id) => id.replace(/^pet_/, '')

const missingPets = []
const missingByTier = {}
let expectedPets = 0

for (const p of pets) {
  const forms = formCountOf(p.tier)
  expectedPets += forms
  const miss = []
  for (let n = 1; n <= forms; n++) {
    const path = `public/pets/${shortId(p.id)}/form${n}.png`
    if (!existsSync(path)) miss.push(n)
  }
  if (miss.length > 0) {
    missingPets.push({ id: p.id, name: p.name, tier: p.tier, style: p.style, miss })
    missingByTier[p.tier] = (missingByTier[p.tier] ?? 0) + miss.length
  }
}

const missingSkins = skins.filter((s) => !existsSync(`public/characters/${s.id.replace(/^skin_/, '')}.png`))

/* ---------- 输出 ---------- */
const done = expectedPets - missingPets.reduce((s, x) => s + x.miss.length, 0)
console.log(`宠物立绘: ${done}/${expectedPets} 张已就位`)
if (missingPets.length > 0) {
  console.log('\n按品阶缺口:')
  for (const t of tiers) {
    const miss = missingByTier[t.tier] ?? 0
    const total = pets.filter((p) => p.tier === t.tier).length * t.formCount
    if (miss > 0) console.log(`  ${t.name.padEnd(3)} 缺 ${String(miss).padStart(3)} 张 / 共 ${total} 张`)
  }
  console.log('\n前 10 只待补:')
  for (const x of missingPets.slice(0, 10)) {
    console.log(`  ${x.name.padEnd(6, '　')} ${x.id.padEnd(18)} 缺形态 ${x.miss.join('/')}  （${x.style}）`)
  }
  if (missingPets.length > 10) console.log(`  …还有 ${missingPets.length - 10} 只`)
}

console.log(`\n角色立绘: ${skins.length - missingSkins.length}/${skins.length} 张已就位`)
if (missingSkins.length > 0) {
  console.log('  缺: ' + missingSkins.map((s) => s.id).join(', '))
}

const totalGap = missingPets.reduce((s, x) => s + x.miss.length, 0) + missingSkins.length
console.log('\n=== 结果 ===')
if (totalGap === 0) {
  console.log('立绘齐全，可以发布')
  process.exit(0)
}
console.log(`共缺 ${totalGap} 张。规格与命名见 docs/美术生产指南-v3.md`)
process.exit(1)
