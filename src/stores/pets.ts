import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api'
import { useGameStore } from './game'

interface PetTemplate {
  id: string
  name: string
  element: string
  role: string
  description: string
  skills_json: string
  image_prefix: string
  rarity: number
  // v3 新增
  tier?: number
  trigram?: string
  style?: string
  pinyin?: string
  source?: string
  formImages?: Record<number, string>
  formCount?: number
  tierName?: string
  base_hp?: number
  base_attack?: number
  base_defense?: number
  base_speed?: number
}

interface PlayerPet {
  id: string
  user_id: string
  template_id: string
  nickname: string
  level: number
  exp: number
  equipped_skills: string
  awakening_level: number
  equipped_skin_id: string
  template_name: string
  element: string
  role: string
  // v3 新增
  tier?: number
  trigram?: string
  style?: string
  source?: string
  form?: number
  power?: number
  tier_name?: string
  formImages?: Record<number, string>
}

export const usePetStore = defineStore('pets', () => {
  const templates = ref<PetTemplate[]>([])
  const myPets = ref<PlayerPet[]>([])
  const selectedTeam = ref<string[]>([])

  // v3: 品阶筛选
  const filterTier = ref<number | null>(null)
  const filterTrigram = ref<string>('')

  const gameStore = useGameStore()

  // v3: 按品阶分组
  const groupedByTier = computed(() => {
    const groups: Record<number, PetTemplate[]> = {}
    for (const p of templates.value) {
      const tier = p.tier || 1
      if (!groups[tier]) groups[tier] = []
      groups[tier].push(p)
    }
    return groups
  })

  async function loadTemplates() {
    // 优先使用 v3 API
    if (gameStore.configLoaded) {
      await gameStore.loadPetTemplates()
      templates.value = gameStore.petTemplates as any[]
    } else {
      const data = await api.getPetTemplates()
      templates.value = data.pets
    }
  }

  async function loadMyPets() {
    // 优先使用 v3 API
    try {
      await gameStore.loadMyPets()
      myPets.value = gameStore.myPets as any[]
    } catch {
      const data = await api.getMyPets()
      myPets.value = data.pets
    }
  }

  async function obtainPet(templateId: string) {
    await api.obtainPet(templateId)
    await loadMyPets()
  }

  async function awakenPet(petId: string) {
    try {
      const data = await gameStore.awakenPet(petId)
      myPets.value = gameStore.myPets as any[]
      return data
    } catch {
      const data = await api.awakenPet(petId)
      await loadMyPets()
      return data
    }
  }

  async function equipSkin(petId: string, skinId: string) {
    await api.equipSkin(petId, skinId)
    await loadMyPets()
  }

  function toggleTeamSelect(petId: string) {
    const idx = selectedTeam.value.indexOf(petId)
    if (idx >= 0) {
      selectedTeam.value.splice(idx, 1)
    } else if (selectedTeam.value.length < 4) {
      selectedTeam.value.push(petId)
    }
  }

  function clearTeam() {
    selectedTeam.value = []
  }

  function setFilter(tier: number | null, trigram?: string) {
    filterTier.value = tier
    filterTrigram.value = trigram || ''
  }

  return {
    templates, myPets, selectedTeam,
    filterTier, filterTrigram, groupedByTier,
    loadTemplates, loadMyPets, obtainPet, awakenPet, equipSkin,
    toggleTeamSelect, clearTeam, setFilter
  }
})
