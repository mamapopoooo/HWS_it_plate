# KIMI v3 Algorithms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变 v3 冻结规则的前提下，完成八卦克制修正、服务端权威抽卡核心与 20 教学月经济模拟。

**Architecture:** 前端继续保留可离线运行的纯函数；服务端新增独立、无 Express 依赖的抽卡模块，直接读取 `docs/seeds` 配置并支持随机源注入。所有行为先写 Vitest 失败测试，再做最小实现；Qoder 后续只需把服务端返回的 `results[]` 接入路由。

**Tech Stack:** TypeScript、JavaScript ES Modules、Node.js、Vitest、JSON 配置、CSV。

---

### Task 1: 恢复测试基线并修正八卦克制

**Files:**
- Modify: `src/config/gameConfig.test.ts`
- Modify: `src/utils/duel.test.ts`
- Modify: `src/utils/duel.ts`

- [ ] **Step 1: 用大写 Windows 盘符验证既有测试基线**

在 `D:\课件\platform\pet-garden-kimi` 工作目录运行，保留原 Vue 插件，不修改生产依赖。小写盘符 `d:\...` 会让 ESM 将同一个 `@vitest/runner` 加载为两个实例，导致收集阶段出现 `runner.config` 未初始化错误。

Run: `node node_modules/vitest/vitest.mjs run`
Expected: 当前基线 45 条既有测试通过，Vitest 根目录显示为 `D:/课件/platform/pet-garden-kimi`。

- [ ] **Step 2: 写 8×8 矩阵和双属性防御失败测试**

```ts
it.each(TRIGRAMS.flatMap((atk) => TRIGRAMS.map((def) => ({ atk, def }))))(
  '$atk.code 对 $def.code 的系数符合对宫表',
  ({ atk, def }) => {
    expect(elementCoefficient(atk.code, def.code)).toBe(atk.opposite === def.code ? 1.3 : 1)
  },
)
```

```ts
it('防守方双属性取对自己最有利的系数，而不是攻击方最有利', () => {
  expect(coefAgainst('li', 'kan,zhen')).toBe(1)
  expect(coefAgainst('qian', 'kun,dui')).toBe(1)
  expect(coefAgainst('zhen,dui', 'xun')).toBe(1.3)
})
```

Run: `node node_modules/vitest/vitest.mjs run src/config/gameConfig.test.ts src/utils/duel.test.ts`
Expected: 矩阵通过；双属性防御两条断言因现有实现返回 1.3 而失败。

- [ ] **Step 3: 实现攻击方取优势、防守方取优势的组合规则**

```ts
export function coefAgainst(attacker: string, defender: string): number {
  if (attacker === 'all' || defender === 'all') return 1
  const atkCodes = attacker.split(',')
  const defCodes = defender.split(',')
  // 对每个防守属性，攻击方取最优；防守方再从自己的属性中取最优（系数最低）。
  return Math.min(...defCodes.map((d) =>
    Math.max(...atkCodes.map((a) => elementCoefficient(a, d))),
  ))
}
```

Run: `node node_modules/vitest/vitest.mjs run src/config/gameConfig.test.ts src/utils/duel.test.ts`
Expected: 全部通过，单属性与全属行为不变。

- [ ] **Step 4: 提交属性模块**

```bash
git add src/config/gameConfig.test.ts src/utils/duel.test.ts src/utils/duel.ts docs/superpowers/plans/2026-11-04-kimi-algorithms.md
git commit -m "fix(battle): 修正双属性防守克制并补齐八卦矩阵"
```

### Task 2: 服务端权威抽卡核心

**Files:**
- Create: `server/game/gacha.js`
- Create: `server/game/gacha.test.js`

- [ ] **Step 1: 写价格、概率、保底与 results[] 契约失败测试**

```js
import { describe, expect, it } from 'vitest'
import { createDrawState, drawMany, drawPrice, pickTier } from './gacha.js'

it('G7 单抽与十连按 0.6 取整且不为零', () => {
  expect(drawPrice('single', 7)).toBe(3)
  expect(drawPrice('ten', 7)).toBe(27)
  expect(drawPrice('single', 6)).toBe(5)
})

it('第20抽至少八卦，第60抽至少四象', () => {
  const state = createDrawState()
  const results = Array.from({ length: 6 }, () => drawMany(state, 10, () => 0)).flat()
  expect(results[19].tier).toBeGreaterThanOrEqual(2)
  expect(results[59].tier).toBeGreaterThanOrEqual(3)
})

it('返回 Qoder 需要的 results[] 字段并结算重复碎片', () => {
  const state = createDrawState()
  const [first, second] = drawMany(state, 2, () => 0)
  expect(first).toEqual({ tier: 1, pet_id: first.pet_id, is_new: true, fragments: 0 })
  expect(second).toEqual({ tier: 1, pet_id: first.pet_id, is_new: false, fragments: 20 })
})
```

Run: `node node_modules/vitest/vitest.mjs run server/game/gacha.test.js`
Expected: 模块不存在而失败。

- [ ] **Step 2: 实现配置加载、品阶抽取与保底**

```js
import { readFileSync } from 'node:fs'

const loadSeed = (name) => JSON.parse(readFileSync(new URL(`../../docs/seeds/${name}.json`, import.meta.url), 'utf8'))
export const TIERS = loadSeed('tiers').tiers
export const PETS = loadSeed('pets').pets
export const ECONOMY = loadSeed('economy')

export function createDrawState({ pulls = 0, owned = [] } = {}) {
  return { pulls, owned: new Set(owned) }
}

export function minTierForPull(pullIndex, economy = ECONOMY) {
  if (pullIndex % economy.gacha.pityTier3 === 0) return 3
  if (pullIndex % economy.gacha.pityTier2 === 0) return 2
  return 1
}

export function pickTier(minTier = 1, rng = Math.random, tiers = TIERS) {
  const pool = tiers.filter((t) => t.isGacha && t.gachaRate > 0 && t.tier >= minTier)
  if (!pool.length) throw new Error('抽卡池配置为空')
  const total = pool.reduce((sum, t) => sum + t.gachaRate, 0)
  let roll = rng() * total
  for (const tier of pool) {
    roll -= tier.gachaRate
    if (roll <= 0) return tier.tier
  }
  return pool[pool.length - 1].tier
}
```

- [ ] **Step 3: 实现抽卡、重复碎片与年级价格**

```js
export function drawPrice(kind, grade, economy = ECONOMY) {
  const base = kind === 'single' ? economy.gacha.single : economy.gacha.ten
  const coefficient = economy.gradeCoef[String(grade)] ?? 1
  return Math.max(1, Math.round(base * coefficient))
}

export function drawMany(state, count, rng = Math.random, config = { tiers: TIERS, pets: PETS, economy: ECONOMY }) {
  if (!Number.isInteger(count) || count < 1 || count > 10) throw new Error('抽卡次数必须为 1–10 的整数')
  const results = []
  for (let index = 0; index < count; index++) {
    state.pulls += 1
    const tier = pickTier(minTierForPull(state.pulls, config.economy), rng, config.tiers)
    const pool = config.pets.filter((pet) => pet.tier === tier)
    if (!pool.length) throw new Error(`品阶 ${tier} 没有可抽取宠物`)
    const pet = pool[Math.floor(rng() * pool.length)]
    const isNew = !state.owned.has(pet.id)
    if (isNew) state.owned.add(pet.id)
    results.push({ tier, pet_id: pet.id, is_new: isNew, fragments: isNew ? 0 : config.economy.fragment[`dupTier${tier}`] })
  }
  return results
}
```

Run: `node node_modules/vitest/vitest.mjs run server/game/gacha.test.js`
Expected: 契约与保底测试通过。

- [ ] **Step 4: 添加可复现的 10000 次概率测试和碎片抵扣测试**

```js
function seededRandom(seed) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
}

it('10000 次品阶抽取误差不超过 ±0.5%', () => {
  const rng = seededRandom(20261104)
  const counts = new Map([[1, 0], [2, 0], [3, 0], [4, 0]])
  for (let index = 0; index < 10000; index++) {
    const tier = pickTier(1, rng)
    counts.set(tier, counts.get(tier) + 1)
  }
  for (const tier of TIERS.filter((item) => item.isGacha)) {
    expect(Math.abs(counts.get(tier.tier) / 10000 - tier.gachaRate)).toBeLessThanOrEqual(0.005)
  }
})
```

```js
export function awakeningPayment(tier, grade, fragments, economy = ECONOMY) {
  const price = Math.max(1, Math.round(economy.awaken[`tier${tier}`] * (economy.gradeCoef[String(grade)] ?? 1)))
  const fragmentCost = Math.min(Math.max(0, fragments), Math.floor(price * economy.fragment.payRatio))
  return { price, fragmentCost, pointsCost: price - fragmentCost }
}
```

Run: `node node_modules/vitest/vitest.mjs run server/game/gacha.test.js`
Expected: 概率与抵扣上限测试稳定通过。

- [ ] **Step 5: 提交服务端抽卡模块**

```bash
git add server/game/gacha.js server/game/gacha.test.js
git commit -m "feat(gacha): 实现服务端权威抽卡与保底"
```

### Task 3: 经济模拟与整体验证

**Files:**
- Create: `server/game/economy-simulation.js`
- Create: `server/game/economy-simulation.test.js`
- Create: `scripts/generate-economy-report.mjs`
- Create: `docs/economy-simulation-20-months.csv`

- [ ] **Step 1: 写教学月与年级价格失败测试**

```js
it('G6 中位收入 20 个月折算 240 次单抽', () => {
  const report = simulateEconomy({ grade: 6, months: 20, monthlyIncome: 60 })
  expect(report.totalIncome).toBe(1200)
  expect(report.incomeEquivalentPulls).toBe(240)
})

it('G7 中位收入 10 个月折算 100 次单抽', () => {
  const report = simulateEconomy({ grade: 7, months: 10, monthlyIncome: 30 })
  expect(report.totalIncome).toBe(300)
  expect(report.incomeEquivalentPulls).toBe(100)
})
```

Run: `node node_modules/vitest/vitest.mjs run server/game/economy-simulation.test.js`
Expected: 模块不存在而失败。

- [ ] **Step 2: 实现经济投影**

```js
import { drawPrice, ECONOMY } from './gacha.js'

export function simulateEconomy({ grade, months, monthlyIncome, consumptionRate = 0.775 }) {
  if (![6, 7].includes(grade)) throw new Error('年级仅支持 6 或 7')
  if (!Number.isInteger(months) || months < 1) throw new Error('教学月必须为正整数')
  if (monthlyIncome < 0 || consumptionRate < 0.7 || consumptionRate > 0.85) throw new Error('经济参数超出总纲范围')
  const totalIncome = months * monthlyIncome
  return {
    grade, months, monthlyIncome, consumptionRate, totalIncome,
    targetSpending: Math.round(totalIncome * consumptionRate),
    targetSaving: totalIncome - Math.round(totalIncome * consumptionRate),
    singlePrice: drawPrice('single', grade, ECONOMY),
    tenPrice: drawPrice('ten', grade, ECONOMY),
    incomeEquivalentPulls: Math.floor(totalIncome / drawPrice('single', grade, ECONOMY)),
  }
}
```

Run: `node node_modules/vitest/vitest.mjs run server/game/economy-simulation.test.js`
Expected: 收入、消耗与抽数投影通过。

- [ ] **Step 3: 生成并检查 20 教学月 CSV**

脚本遍历 G6/G7、1–20 月、低收入/中位收入/高收入，输出收入、70–85% 目标消耗、结余、年级抽价和累计抽数；另输出 G7 第 10 月作为一年节点。

Run: `node scripts/generate-economy-report.mjs`
Expected: 生成 `docs/economy-simulation-20-months.csv`，G6 第 20 月中位情景为 240 抽，G7 第 10 月中位情景为 100 抽。

- [ ] **Step 4: 全量验证并提交**

```bash
node node_modules/vitest/vitest.mjs run
node node_modules/vitest/vitest.mjs run --coverage
npm run build
git add server/game/economy-simulation.js server/game/economy-simulation.test.js scripts/generate-economy-report.mjs docs/economy-simulation-20-months.csv
git commit -m "test(economy): 添加20教学月经济模拟"
git push -u origin dev-kimi
```

Expected: 全量测试通过；算法覆盖率达到 85% 以上；生产构建通过；远程建立 `dev-kimi`，不推送 `dev-dsh`。
