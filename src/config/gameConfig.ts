/**
 * 配置层单一入口（00-总纲 P1 内容即数据）
 *
 * 数据源：docs/seeds/*.json（唯一内容入口，Qoder 灌库读同一份文件）。
 * M1 阶段直接读本地种子做离线预览；M2 起应改为启动时 GET /api/v2/config 覆盖这里的值，
 * 组件只依赖本文件导出的函数与类型，不直接读 JSON。
 */

import tiersSeed from '../../docs/seeds/tiers.json'
import trigramsSeed from '../../docs/seeds/trigrams.json'
import petsSeed from '../../docs/seeds/pets.json'
import economySeed from '../../docs/seeds/economy.json'

/* ---------------- 类型 ---------------- */

export interface TierConfig {
  tier: number
  code: string
  name: string
  subtitle: string
  powerCoef: number
  formCount: number
  awakenCap: number
  skillSlots: number
  gachaRate: number
  bezelColor: string
  isGacha: boolean
  isCustom?: boolean
}

export interface TrigramConfig {
  code: string
  name: string
  symbol: string
  element: string
  color: string
  colorDark: string
  opposite: string
  sortOrder: number
}

export interface PetTemplate {
  id: string
  name: string
  /** 注音（生僻字必须显示，学生 11–14 岁） */
  pinyin: string
  tier: number
  trigram: string
  /** 风格标签：meng 萌系 / jun 俊逸 / ya 雅致 / qi 奇诡 */
  style: string
  source: string
  role: string
  description: string
  sortOrder: number
  formImages?: Record<string, string>
}

export interface EconomyConfig {
  gacha: { single: number; ten: number; pityTier2: number; pityTier3: number }
  exchange: Record<string, number | null>
  awaken: Record<string, number>
  awakenBonus: number[]
  fragment: Record<string, number>
  gradeCoef: Record<string, number>
  character: { nicknameChange: number; titleBuy: number }
  misc: { trigramReroll: number; battleRefill: number; battleFreePerDay: number }
  skin: { school: number; hanfu: number; season: number; graduate: number }
  levelCoef: number
  levelCap: number
  powerBase: number
}

/* ---------------- 数据 ---------------- */

export const TIERS = tiersSeed.tiers as unknown as TierConfig[]
export const TRIGRAMS = trigramsSeed.trigrams as unknown as TrigramConfig[]
export const PETS = petsSeed.pets as unknown as PetTemplate[]
export const ECONOMY = economySeed as unknown as EconomyConfig

/** 形态名（下标 = 形态号 - 1），超出范围时回退为「第 N 相」 */
export const FORM_NAMES = ['初相', '化相', '法相', '真形', '神相', '无相'] as const

/** 风格标签（见 品阶体系-v3 §7.4 风格光谱） */
export const STYLE_NAMES: Record<string, string> = {
  meng: '萌系',
  jun: '俊逸',
  ya: '雅致',
  qi: '奇诡',
}

export function styleName(code: string): string {
  return STYLE_NAMES[code] ?? '—'
}

/* ---------------- 查询 ---------------- */

export function getTier(tier: number): TierConfig | undefined {
  return TIERS.find((t) => t.tier === tier)
}

/** 按 id 取宠物模板：名称/注音/风格/卦属的唯一来源 */
export function getPet(id: string): PetTemplate | undefined {
  return PETS.find((p) => p.id === id)
}

export function getTrigram(code: string): TrigramConfig | undefined {
  return TRIGRAMS.find((t) => t.code === code)
}

/**
 * 宠物某形态的立绘路径。
 * 优先级：模板 formImages → 约定路径 {id}/formN.png（缺图由组件退化为卦象占位，不报错）。
 */
export function formImage(pet: PetTemplate, form = 1): string {
  const custom = pet.formImages?.[String(form)]
  if (custom) return custom
  const shortId = pet.id.replace(/^pet_/, '')
  return `/pet-garden/pets/${shortId}/form${form}.png`
}

export function tierName(tier: number): string {
  return getTier(tier)?.name ?? `第${tier}阶`
}

export function formName(form: number): string {
  return FORM_NAMES[form - 1] ?? `第${form}相`
}

/** 觉醒阶 → 形态号（形态 = 觉醒 + 1，受品阶形态数封顶） */
export function formFromAwaken(tier: number, awakenLevel: number): number {
  const cap = getTier(tier)?.formCount ?? 2
  return Math.min(cap, Math.max(1, awakenLevel + 1))
}

/** "zhen,xun" → "震 + 巽"；"all" → "全属" */
export function trigramLabel(csv: string): string {
  if (!csv) return '—'
  if (csv === 'all') return '全属'
  return csv
    .split(',')
    .map((c) => getTrigram(c)?.name ?? c)
    .join(' + ')
}

/** "zhen,xun" → "☳☴"；"all" → "☯" */
export function trigramGlyphs(csv: string): string {
  if (!csv) return '·'
  if (csv === 'all') return '☯'
  return csv
    .split(',')
    .map((c) => getTrigram(c)?.symbol ?? '·')
    .join('')
}

/** 克制系数：对宫相冲（1.3 / 0.77 / 1.0），由配置推导，不写死四对常量 */
export function elementCoefficient(atk: string, def: string): number {
  if (atk === 'all' || def === 'all') return 1
  const a = getTrigram(atk)
  const d = getTrigram(def)
  if (!a || !d) return 1
  if (a.opposite === d.code) return 1.3
  if (d.opposite === a.code) return 0.77
  return 1
}

/**
 * 战力 = round(100 × 品阶系数 × 等级系数 × (1 + 觉醒加成))
 * 与 00-总纲 §6.3 一致；G7 系数只影响价格，不直接影响战力。
 */
export function calcPower(tier: number, level: number, awakenLevel: number): number {
  const t = getTier(tier)
  if (!t) return 0
  const levelCoef = 1 + ECONOMY.levelCoef * (Math.max(1, level) - 1)
  const awakenBonus = ECONOMY.awakenBonus[Math.min(awakenLevel, ECONOMY.awakenBonus.length - 1)] ?? 0
  return Math.round(ECONOMY.powerBase * t.powerCoef * levelCoef * (1 + awakenBonus))
}

/** 年级系数（G6 = 1.0 / G7 = 0.6），所有价格换算的唯一入口 */
export function priceFor(basePrice: number, grade: number): number {
  const coef = ECONOMY.gradeCoef[String(grade)] ?? 1
  return Math.max(1, Math.round(basePrice * coef))
}

/** 保底进度：返回还需多少抽必出 tier≥2 / tier≥3 */
export function pityRemain(pulls: number): { toTier2: number; toTier3: number } {
  const { pityTier2, pityTier3 } = ECONOMY.gacha
  return {
    toTier2: Math.max(0, pityTier2 - (pulls % pityTier2)),
    toTier3: Math.max(0, pityTier3 - (pulls % pityTier3)),
  }
}
