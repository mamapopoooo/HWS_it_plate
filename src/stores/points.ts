import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api'

export const usePointsStore = defineStore('points', () => {
  const totalPoints = ref(0)
  const history = ref<any[]>([])

  async function loadPoints() {
    try {
      const data = await api.getMe()
      totalPoints.value = data.user.gamePoints || 0
    } catch {}
  }

  async function refresh() {
    await loadPoints()
  }

  return { totalPoints, history, loadPoints, refresh }
})
