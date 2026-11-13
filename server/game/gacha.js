import { readFileSync } from 'node:fs'

const loadSeed = (name) => JSON.parse(readFileSync(new URL(`../../docs/seeds/${name}.json`, import.meta.url), 'utf8'))
export const TIERS = loadSeed('tiers').tiers
export const PETS = loadSeed('pets').pets
export const ECONOMY = loadSeed('economy')

/** 创建服务端抽卡状态。 */
export function createDrawState({ pulls = 0, owned = [] } = {}) {
  return { pulls, owned: new Set(owned) }
}

/** 按总抽数计算本次保底下限，三阶保底优先。 */
export function minTierForPull(pullIndex, economy = ECONOMY) {
  const { pityTier2, pityTier3 } = economy.gacha
  if (pullIndex % pityTier3 === 0) return 3
  if (pullIndex % pityTier2 === 0) return 2
  return 1
}

/** 从可抽品阶中按配置权重挑选，保底时重新归一化权重。 */
export function pickTier(minTier = 1, rng = Math.random, tiers = TIERS) {
  const pool = tiers
    .filter((tier) => tier.isGacha && tier.gachaRate > 0 && tier.tier >= minTier)
    .sort((a, b) => a.tier - b.tier)

  if (pool.length === 0) throw new Error('可抽取品阶池为空')

  const total = pool.reduce((sum, tier) => sum + tier.gachaRate, 0)
  let roll = rng() * total
  for (const tier of pool) {
    roll -= tier.gachaRate
    if (roll <= 0) return tier.tier
  }
  return pool[pool.length - 1].tier
}

/** 连抽 1 至 10 次，全部结果有效后才提交状态。 */
export function drawMany(
  state,
  count,
  rng = Math.random,
  config = { tiers: TIERS, pets: PETS, economy: ECONOMY },
) {
  if (!Number.isInteger(count) || count < 1 || count > 10) {
    throw new Error('抽数必须为 1 到 10 的整数')
  }

  const results = []
  const owned = new Set(state.owned)
  let pulls = state.pulls

  for (let i = 0; i < count; i += 1) {
    const pullIndex = pulls + 1
    const tier = pickTier(minTierForPull(pullIndex, config.economy), rng, config.tiers)
    const pool = config.pets.filter((pet) => pet.tier === tier)
    if (pool.length === 0) throw new Error(`品阶 ${tier} 没有可抽取的宠物`)

    const pet = pool[Math.floor(rng() * pool.length)]
    const isNew = !owned.has(pet.id)
    const fragments = isNew ? 0 : (config.economy.fragment[`dupTier${tier}`] ?? 0)

    results.push({ tier, pet_id: pet.id, is_new: isNew, fragments })
    pulls = pullIndex
    if (isNew) owned.add(pet.id)
  }

  state.pulls = pulls
  state.owned = owned
  return results
}

/** 单抽或十连价格，按年级系数取整且至少为 1。 */
export function priceFor(base, grade, economy = ECONOMY) {
  const coefficient = economy.gradeCoef[String(grade)] ?? 1
  if (!Number.isFinite(base) || base < 0 || !Number.isFinite(coefficient) || coefficient <= 0) {
    throw new Error('价格配置无效')
  }
  return base === 0 ? 0 : Math.max(1, Math.round(base * coefficient))
}

export function drawPrice(kind, grade, economy = ECONOMY) {
  const base = kind === 'single' ? economy.gacha.single : economy.gacha.ten
  return priceFor(base, grade, economy)
}

/** 计算觉醒的碎片抵扣与仍需支付的积分。 */
export function awakeningPayment(tier, grade, fragments, economy = ECONOMY) {
  const base = economy.awaken[`tier${tier}`]
  const price = priceFor(base, grade, economy)
  const fragmentLimit = Math.floor(price * economy.fragment.payRatio)
  const fragmentCost = Math.min(fragmentLimit, Math.max(0, fragments))

  return { price, fragmentCost, pointsCost: price - fragmentCost }
}
