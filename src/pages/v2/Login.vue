<template>
  <div class="min-h-screen bg-gray-900 text-white flex items-center justify-center">
    <div class="bg-gray-800 rounded-xl p-8 max-w-md w-full mx-4">
      <h1 class="text-2xl font-bold text-center mb-6 text-orange-400">王宠课堂</h1>

      <!-- 登录方式切换 -->
      <div class="flex gap-2 mb-6">
        <button
          class="flex-1 py-2 rounded-lg font-bold transition"
          :class="mode === 'student' ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-400'"
          @click="mode = 'student'"
        >学生登录</button>
        <button
          class="flex-1 py-2 rounded-lg font-bold transition"
          :class="mode === 'admin' ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-400'"
          @click="mode = 'admin'"
        >管理员登录</button>
      </div>

      <!-- 学生登录 -->
      <div v-if="mode === 'student'" class="space-y-4">
        <input v-model="studentNo" type="text" placeholder="学号" class="w-full bg-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500" />
        <input v-model="realName" type="text" placeholder="姓名" class="w-full bg-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500" />
        <button :disabled="!studentNo || !realName || loading" class="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 text-white font-bold py-3 rounded-lg transition" @click="handleStudentLogin">
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </div>

      <!-- 管理员登录 -->
      <div v-if="mode === 'admin'" class="space-y-4">
        <input v-model="username" type="text" placeholder="账号" class="w-full bg-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
        <input v-model="password" type="password" placeholder="密码" class="w-full bg-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500" />
        <button :disabled="!username || !password || loading" class="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-600 text-white font-bold py-3 rounded-lg transition" @click="handleAdminLogin">
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </div>

      <div v-if="error" class="mt-4 text-red-400 text-sm text-center">{{ error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const mode = ref<'student' | 'admin'>('student')
const studentNo = ref('')
const realName = ref('')
const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleStudentLogin() {
  loading.value = true
  error.value = ''
  try {
    await authStore.studentLogin(studentNo.value, realName.value)
    router.push('/student')
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function handleAdminLogin() {
  loading.value = true
  error.value = ''
  try {
    await authStore.adminLogin(username.value, password.value)
    router.push('/admin')
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>
