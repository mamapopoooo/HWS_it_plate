/**
 * 内容层访问入口（商城 / 作业 / 功名册）
 *
 * 与 gameConfig 一样：数据只在 docs/seeds 维护，组件不写死内容。
 * M2 起改为 GET /api/v2/config 一并下发，本文件降级为离线兜底。
 */
import shopSeed from '../../docs/seeds/shop.json'
import questsSeed from '../../docs/seeds/quests.json'
import achievementsSeed from '../../docs/seeds/achievements.json'
import skinsSeed from '../../docs/seeds/skins.json'
import skillsSeed from '../../docs/seeds/skill_effects.json'
import eventsSeed from '../../docs/seeds/events.json'
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

export type Gender = 'male' | 'female'

export interface SkinDef {
  id: string
  name: string
  theme: string
  gender: Gender
  image: string
  unlock: { type: string; value: number } | null
  sortOrder: number
}

export const SKINS = skinsSeed.skins as unknown as SkinDef[]

/**
 * 皮肤价格：按 theme 读 economy.json 的 skin.<theme>。
 * base / graduate 定价为 0 —— 一个默认送、一个毕业才能拿，都不走购买。
 */
export function skinPrice(skin: SkinDef, grade: number): number {
  const table = ECONOMY.skin as unknown as Record<string, number>
  const base = table[skin.theme] ?? 0
  return base === 0 ? 0 : priceFor(base, grade)
}

/* ---------------- 造物（无极）技能效果池 ---------------- */

export interface SkillEffect {
  code: string
  name: string
  cost: number
  impl: string
  description: string
}

export const SKILL_EFFECTS = skillsSeed.effects as unknown as SkillEffect[]
/** 灵力预算与技能个数（学生只能选效果，不能填数值） */
export const CUSTOM_BUDGET = skillsSeed.customBudget
export const CUSTOM_SKILL_COUNT = skillsSeed.customSkillCount
export const CUSTOM_NAME_MAX = skillsSeed.nameMaxLength
export const CUSTOM_DESC_MAX = skillsSeed.descMaxLength

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

/* ---------------- 活动 ---------------- */

export interface EventDef {
  id: string
  name: string
  type: string
  /** ISO 日期，如 2026-11-01 */
  startDate: string
  endDate: string
  desc: string
  reward: Array<{ item: string; amount?: number; id?: string }>
  banner?: string
  sortOrder: number
}

export const EVENTS = eventsSeed.events as unknown as EventDef[]

export type EventPhase = 'active' | 'upcoming' | 'ended'

/** 本地日期（避免 toISOString 的时区偏移把日期挪一天） */
export function todayIso(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function eventPhase(event: EventDef, date = new Date()): EventPhase {
  const today = todayIso(date)
  if (today < event.startDate) return 'upcoming'
  if (today > event.endDate) return 'ended'
  return 'active'
}

/** 进行中的活动（大厅面板用） */
export function activeEvents(date = new Date()): EventDef[] {
  return EVENTS.filter((e) => eventPhase(e, date) === 'active').sort((a, b) => a.sortOrder - b.sortOrder)
}
