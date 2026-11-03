/**
 * 求签（抽卡）核心逻辑 —— 纯函数，便于单测与后续替换为接口
 *
 * 规则来源：docs/seeds/tiers.json（各阶 gachaRate）与 economy.json（价格、保底、碎片）
 * 代码里不写死概率与保底数字，改配置即生效。
 */
import { ECONOMY, PETS, TIERS } from '@/config/gameConfig'
import type { PetTemplate } from '@/config/gameConfig'

export interface DrawResult {
  pet: PetTemplate
  tier: number
  /** 是否新获得（false 表示重复，转为灵纹碎片） */
  isNew: boolean
  /** 重复时得到的碎片数 */
  fragments: number
}

export interface DrawState {
  /** 已抽总次数（用于保底计数） */
  pulls: number
  /** 已拥有的宠物 id */
  owned: Set<string>
}

/** 进池的品阶（无极不进池） */
export function gachaPool() {
  return TIERS.filter((t) => t.isGacha && t.gachaRate > 0).sort((a, b) => a.tier - b.tier)
}

/** 概率公示数据：给页面直接用 */
export function rateTable() {
  return gachaPool().map((t) => ({ tier: t.tier, name: t.name, rate: t.gachaRate, color: t.bezelColor }))
}

/** 保底：第 N 抽必出 tier≥2 / tier≥3 */
export function minTierForPull(pullIndex: number): number {
  const { pityTier2, pityTier3 } = ECONOMY.gacha
  if (pullIndex % pityTier3 === 0) return 3
  if (pullIndex % pityTier2 === 0) return 2
  return 1
}

/** 还差多少抽触发保底（给界面倒计时用） */
export function pityProgress(pulls: number) {
  const { pityTier2, pityTier3 } = ECONOMY.gacha
  return {
    toTier3: pityTier3 - (pulls % pityTier3),
    toTier2: pityTier2 - (pulls % pityTier2),
  }
}

/** 按权重挑品阶，支持保底下限 */
export function pickTier(minTier: number, rng: () => number = Math.random): number {
  const pool = gachaPool().filter((t) => t.tier >= minTier)
  const total = pool.reduce((sum, t) => sum + t.gachaRate, 0)
  let roll = rng() * total
  for (const t of pool) {
    roll -= t.gachaRate
    if (roll <= 0) return t.tier
  }
  return pool[pool.length - 1]?.tier ?? 1
}

/** 该品阶的宠物（同阶内等概率） */
export function petsOfTier(tier: number): PetTemplate[] {
  return PETS.filter((p) => p.tier === tier)
}

/** 抽一次 */
export function drawOnce(state: DrawState, rng: () => number = Math.random): DrawResult {
  const pullIndex = state.pulls + 1
  const tier = pickTier(minTierForPull(pullIndex), rng)

  const pool = petsOfTier(tier)
  const pet = pool[Math.floor(rng() * pool.length)] ?? PETS[0]
  const isNew = !state.owned.has(pet.id)
  const fragments = isNew
    ? 0
    : (ECONOMY.fragment[`dupTier${tier}`] ?? 0)

  state.pulls = pullIndex
  if (isNew) state.owned.add(pet.id)

  return { pet, tier, isNew, fragments }
}

/** 抽 n 次（十连） */
export function drawMany(state: DrawState, count: number, rng: () => number = Math.random): DrawResult[] {
  const results: DrawResult[] = []
  for (let i = 0; i < count; i++) results.push(drawOnce(state, rng))
  return results
}

/** 单抽 / 十连价格（含年级系数） */
export function drawPrice(kind: 'single' | 'ten', grade: number): number {
  const base = kind === 'single' ? ECONOMY.gacha.single : ECONOMY.gacha.ten
  const coef = ECONOMY.gradeCoef[String(grade)] ?? 1
  return Math.max(1, Math.round(base * coef))
}
