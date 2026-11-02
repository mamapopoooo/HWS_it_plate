import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api'

interface PetTemplate {
  id: string
  name: string
  element: string
  role: string
  description: string
  skills_json: string
  image_prefix: string
  rarity: number
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
}

export const usePetStore = defineStore('pets', () => {
  const templates = ref<PetTemplate[]>([])
  const myPets = ref<PlayerPet[]>([])
  const selectedTeam = ref<string[]>([])

  async function loadTemplates() {
    const data = await api.getPetTemplates()
    templates.value = data.pets
  }

  async function loadMyPets() {
    const data = await api.getMyPets()
    myPets.value = data.pets
  }

  async function obtainPet(templateId: string) {
    await api.obtainPet(templateId)
    await loadMyPets()
  }

  async function awakenPet(petId: string) {
    const data = await api.awakenPet(petId)
    await loadMyPets()
    return data
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

  return {
    templates, myPets, selectedTeam,
    loadTemplates, loadMyPets, obtainPet, awakenPet, equipSkin,
    toggleTeamSelect, clearTeam
  }
})
