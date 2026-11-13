// 墨境课堂 v3 游戏状态管理
// 统一管理品阶/八卦/经济/排行配置缓存，以及角色/图鉴/造物状态

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  fetchConfig,
  v3Pets,
  v3Collection,
  v3Character,
  v3CustomPets,
  v3Events,
  v3Rankings,
  v3Gacha
} from '@/api/v3'

// ========== 类型定义 ==========

export interface TierConfig {
  tier: number
  code: string
  name: string
  subtitle: string
  power_coef: number
  form_count: number
  awaken_cap: number
  skill_slots: number
  gacha_rate: number
  bezel_color: string
  is_gacha: number
  is_custom: number
  sort_order: number
}

export interface TrigramConfig {
  code: string
  name: string
  symbol: string
  element: string
  color: string
  color_dark: string
  opposite: string
  sort_order: number
}

export interface V3PetTemplate {
  id: string
  name: string
  pinyin: string
  element: string      // 八卦属性（qian/kun/...）
  role: string
  description: string
  tier: number
  trigram: string      // 卦属（可能含逗号表示双属）
  style: string        // meng/jun/ya/qi
  source: string
  form_images: string  // JSON string
  formImages: Record<number, string>
  base_hp: number
  base_attack: number
  base_defense: number
  base_speed: number
  tierName: string
  formCount: number
}

export interface V3PlayerPet {
  id: string
  user_id: string
  template_id: string
  nickname: string
  level: number
  exp: number
  equipped_skills: string
  awakening_level: number
  form: number
  power: number
  template_name: string
  element: string
  role: string
  tier: number
  trigram: string
  source: string
  style: string
  tier_name: string
  formImages: Record<number, string>
}

export interface CharacterInfo {
  id: string
  user_id: string
  gender: string
  nickname: string
  title: string
  current_skin_id: string
  currentSkin: { id: string; name: string; image: string } | null
}

export interface CollectionTier {
  tier: number
  name: string
  subtitle: string
  bezelColor: string
  unlocked?: boolean
  pets: Array<{
    id: string
    name: string
    trigram?: string
    source?: string
    owned: boolean
    isCustom?: boolean
    isHidden?: boolean
    formImages?: Record<number, string>
  }>
}

// ========== Store ==========

export const useGameStore = defineStore('game', () => {
  // --- 配置缓存 ---
  const tiers = ref<TierConfig[]>([])
  const trigrams = ref<TrigramConfig[]>([])
  const economy = ref<Record<string, any>>({})
  const rankings = ref<any[]>([])
  const configLoaded = ref(false)

  // --- 角色 ---
  const character = ref<CharacterInfo | null>(null)

  // --- 宠物 ---
  const petTemplates = ref<V3PetTemplate[]>([])
  const myPets = ref<V3PlayerPet[]>([])

  // --- 图鉴 ---
  const collection = ref<Record<string, CollectionTier>>({})

  // --- 造物 ---
  const customPet = ref<any>(null)

  // --- 活动 ---
  const activeEvents = ref<any[]>([])

  // --- 排行 ---
  const rankingData = ref<Record<string, any>>({})

  // --- 抽卡 ---
  const gachaResults = ref<any[]>([])
  const pityCount = ref(0)

  // ========== Computed ==========

  const tierMap = computed(() => {
    const map: Record<number, TierConfig> = {}
    for (const t of tiers.value) map[t.tier] = t
    return map
  })

  const trigramMap = computed(() => {
    const map: Record<string, TrigramConfig> = {}
    for (const g of trigrams.value) map[g.code] = g
    return map
  })

  const petsByTier = computed(() => {
    const map: Record<number, V3PetTemplate[]> = {}
    for (const p of petTemplates.value) {
      if (!map[p.tier]) map[p.tier] = []
      map[p.tier].push(p)
    }
    return map
  })

  // ========== Actions ==========

  /** 加载并缓存全局配置 */
  async function loadConfig() {
    if (configLoaded.value) return
    const data = await fetchConfig()
    tiers.value = data.tiers || []
    trigrams.value = data.trigrams || []
    economy.value = data.economy || {}
    rankings.value = data.rankings || []
    configLoaded.value = true
  }

  /** 加载宠物模板 */
  async function loadPetTemplates(params?: { tier?: number; trigram?: string }) {
    const data = await v3Pets.getTemplates(params)
    petTemplates.value = data.pets || []
  }

  /** 加载我的宠物 */
  async function loadMyPets() {
    const data = await v3Pets.getMyPets()
    myPets.value = data.pets || []
  }

  /** 觉醒宠物 */
  async function awakenPet(petId: string) {
    const data = await v3Pets.awakenPet(petId)
    await loadMyPets()
    return data
  }

  /** 加载图鉴 */
  async function loadCollection() {
    const data = await v3Collection.get()
    collection.value = data.collection || {}
  }

  /** 加载角色信息 */
  async function loadCharacter() {
    try {
      const data = await v3Character.getMe()
      character.value = data.character || null
    } catch {
      character.value = null
    }
  }

  /** 更新角色 */
  async function updateCharacter(data: { nickname?: string; gender?: string }) {
    await v3Character.update(data)
    await loadCharacter()
  }

  /** 加载造物 */
  async function loadCustomPet() {
    const data = await v3CustomPets.getMy()
    customPet.value = data.pet || null
  }

  /** 加载活动 */
  async function loadEvents() {
    const data = await v3Events.getActive()
    activeEvents.value = data.events || []
  }

  /** 加载排行榜 */
  async function loadRanking(id: string, grade?: number) {
    const data = await v3Rankings.get(id, grade)
    rankingData.value[id] = data
    return data
  }

  /** 抽卡 */
  async function drawGacha(count: number = 1) {
    const data = await v3Gacha.draw(count)
    gachaResults.value = data.results || []
    pityCount.value = data.pityCount || 0
    return data
  }

  /** 获取抽卡概率 */
  async function loadGachaRates() {
    return await v3Gacha.getRates()
  }

  return {
    // state
    tiers, trigrams, economy, rankings, configLoaded,
    character, petTemplates, myPets, collection,
    customPet, activeEvents, rankingData,
    gachaResults, pityCount,
    // computed
    tierMap, trigramMap, petsByTier,
    // actions
    loadConfig, loadPetTemplates, loadMyPets, awakenPet,
    loadCollection, loadCharacter, updateCharacter,
    loadCustomPet, loadEvents, loadRanking,
    drawGacha, loadGachaRates
  }
})
