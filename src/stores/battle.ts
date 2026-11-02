import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api'

interface BattleState {
  battleId: string
  turn: number
  battleStatus: string
  player: any
  opponent: any
  playerTeam: any[]
  actions: any[]
}

export const useBattleStore = defineStore('battle', () => {
  const battleState = ref<BattleState | null>(null)
  const battleLog = ref<string[]>([])
  const isLoading = ref(false)

  async function startPVE(teamPetIds: string[]) {
    isLoading.value = true
    try {
      const data = await api.startPVE(teamPetIds)
      battleState.value = data
      battleLog.value = ['战斗开始！']
      return data
    } finally {
      isLoading.value = false
    }
  }

  async function matchPVP() {
    isLoading.value = true
    try {
      const data = await api.matchPVP()
      return data
    } finally {
      isLoading.value = false
    }
  }

  function addLog(message: string) {
    battleLog.value.push(message)
  }

  function resetBattle() {
    battleState.value = null
    battleLog.value = []
  }

  return { battleState, battleLog, isLoading, startPVE, matchPVP, addLog, resetBattle }
})
