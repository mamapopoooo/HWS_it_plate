/**
 * 内容层访问入口（商城 / 作业 / 功名册）
 *
 * 与 gameConfig 一样：数据只在 docs/seeds 维护，组件不写死内容。
 * M2 起改为 GET /api/v2/config 一并下发，本文件降级为离线兜底。
 */
import shopSeed from '../../docs/seeds/shop.json'
import questsSeed from '../../docs/seeds/quests.json'
import achievementsSeed from '../../docs/seeds/achievements.json'
import { ECONOMY, priceFor } from '@/config/gameConfig'

export interface ShopItem {
  id: string
  name: string
  category: string
  glyph: string
  /** 指向 economy.json 的键，价格唯一来源 */
  priceKey?: string
  /** 直接给价（少数固定价商品） */
  price?: number
  limit?: number
  desc: string
}

export interface ShopCategory {
  key: string
  name: string
}

export interface QuestDef {
  id: string
  type: 'daily' | 'weekly'
  name: string
  cond: { type: string; value: number }
  reward: Array<{ item: string; amount: number }>
}

export interface AchievementDef {
  id: string
  category: string
  name: string
  seal: string
  desc: string
  cond: { type: string; value: number }
  reward: Array<{ item: string; amount: number }>
}

export const SHOP_ITEMS = shopSeed.items as unknown as ShopItem[]
export const SHOP_CATEGORIES = shopSeed.categories as unknown as ShopCategory[]
export const QUESTS = questsSeed.quests as unknown as QuestDef[]
export const ACHIEVEMENTS = achievementsSeed.achievements as unknown as AchievementDef[]

/** 按点号路径读 economy，例如 "skin.hanfu" */
function readEconomy(path: string): number | undefined {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, ECONOMY)
  return typeof value === 'number' ? value : undefined
}

/** 商品价格（含年级系数），价格键找不到时回退到直接定价 */
export function itemPrice(item: ShopItem, grade: number): number {
  const base = item.priceKey ? readEconomy(item.priceKey) : item.price
  if (base == null) return 0
  return priceFor(base, grade)
}

/** 奖励摘要：+30 灵石 / 皮肤等，给任务与成就列表复用 */
export function rewardText(reward: AchievementDef['reward']): string {
  return reward
    .map((r) => {
      if (r.item === 'points') return `+${r.amount} 灵石`
      if (r.item === 'skin') return `皮肤`
      if (r.item === 'title') return `称号`
      return r.item
    })
    .join(' · ')
}
