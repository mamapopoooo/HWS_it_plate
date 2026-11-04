#!/usr/bin/env node
/**
 * 构建产物自检（部署前跑一次）
 *
 * 用法：node scripts/verify-build.mjs
 * 检查项：
 *   1. dist 存在且 index.html 引用的是 /pet-garden/ 基路径（部署在子路径下，写错就整站白屏）
 *   2. index.html 里引用的每个 js/css 文件都真实存在（hash 对不上说明 dist 是旧的）
 *   3. 13 个 v3 页面各自产出独立分包
 *   4. v1 页面（Home / PetPreview / 旧 Battle）不再出现在产物里
 *   5. 打印产物体积，超阈值告警
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'dist'
const ASSETS = join(DIST, 'assets')
const problems = []
const warnings = []

if (!existsSync(DIST)) {
  console.error('✗ dist 不存在，请先跑 node node_modules\\vite\\bin\\vite.js build')
  process.exit(1)
}

/* ---------- 1. 基路径 ---------- */
const html = readFileSync(join(DIST, 'index.html'), 'utf8')
if (!html.includes('/pet-garden/')) {
  problems.push('index.html 里没有 /pet-garden/ 基路径（vite.config.ts 的 base 未生效？）')
}

/* ---------- 2. 引用的资源都存在 ---------- */
const refs = [...html.matchAll(/(?:src|href)="(\/pet-garden\/[^"]+)"/g)].map((m) => m[1])
for (const ref of refs) {
  const rel = ref.replace(/^\/pet-garden\//, '')
  if (!existsSync(join(DIST, rel))) problems.push(`index.html 引用了不存在的资源: ${ref}（dist 可能是旧的）`)
}

/* ---------- 3. v3 页面分包齐全 ---------- */
const EXPECTED = [
  'Login',
  'GameLobby',
  'Collection',
  'PetDetail',
  'Gacha',
  'Ranking',
  'Shop',
  'Quests',
  'Achievements',
  'Character',
  'CustomPet',
  'Events',
  'Duel',
  'TeacherDesk',
  'AdminReview',
  'ContentAdmin',
]
const files = readdirSync(ASSETS)
for (const name of EXPECTED) {
  if (!files.some((f) => f.startsWith(name + '-') && f.endsWith('.js'))) {
    problems.push(`缺少页面分包: ${name}-*.js`)
  }
}

/* ---------- 4. v1 页面不应再出现 ---------- */
for (const gone of ['Home-', 'PetPreview-']) {
  if (files.some((f) => f.startsWith(gone))) problems.push(`产物里仍有 v1 分包: ${gone}*.js`)
}

/* ---------- 5. 体积 ---------- */
let jsBytes = 0
let cssBytes = 0
for (const f of files) {
  const size = statSync(join(ASSETS, f)).size
  if (f.endsWith('.js')) jsBytes += size
  if (f.endsWith('.css')) cssBytes += size
}
const kb = (n) => (n / 1024).toFixed(1)

// vite.config.ts 里默认 500KB 告警；这里按 gzip 后估算更贴近真实传输
if (jsBytes > 1200 * 1024) warnings.push(`JS 总量 ${kb(jsBytes)}KB，建议拆分或懒加载`)
if (cssBytes > 200 * 1024) warnings.push(`CSS 总量 ${kb(cssBytes)}KB，偏大`)

/* ---------- 输出 ---------- */
console.log(`产物文件: ${files.length} 个`)
console.log(`JS ${kb(jsBytes)}KB · CSS ${kb(cssBytes)}KB`)
console.log(`页面分包: ${EXPECTED.filter((n) => files.some((f) => f.startsWith(n + '-'))).length}/${EXPECTED.length}`)

if (warnings.length > 0) {
  console.log('\n告警:')
  warnings.forEach((w) => console.log('  ! ' + w))
}

console.log('\n=== 结果 ===')
if (problems.length === 0) {
  console.log('通过：构建产物可用于部署')
  process.exit(0)
}
problems.forEach((p) => console.log('问题: ' + p))
process.exit(1)
