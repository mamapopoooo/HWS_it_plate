import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api'

interface User {
  id: string
  username: string
  realName: string
  nameEn?: string
  role: 'student' | 'admin'
  grade?: number
  className?: string
  gamePoints?: number
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('token'))

  const isLoggedIn = computed(() => !!token.value)
  const isStudent = computed(() => user.value?.role === 'student')
  const isAdmin = computed(() => user.value?.role === 'admin')

  function loadFromStorage() {
    const stored = localStorage.getItem('user')
    if (stored) {
      try { user.value = JSON.parse(stored) } catch {}
    }
  }

  async function studentLogin(studentNo: string, realName: string) {
    const data = await api.studentLogin(studentNo, realName)
    token.value = data.token
    user.value = data.user
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    return data
  }

  async function adminLogin(username: string, password: string) {
    const data = await api.adminLogin(username, password)
    token.value = data.token
    user.value = data.user
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    return data
  }

  async function refreshUser() {
    if (!token.value) return
    try {
      const data = await api.getMe()
      user.value = data.user
      localStorage.setItem('user', JSON.stringify(data.user))
    } catch {}
  }

  function logout() {
    user.value = null
    token.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  // 初始化时从 localStorage 恢复
  loadFromStorage()

  return { user, token, isLoggedIn, isStudent, isAdmin, studentLogin, adminLogin, refreshUser, logout }
})
