<template>
  <div class="min-h-screen bg-gray-900 text-white">
    <nav class="bg-gray-800 border-b border-gray-700 px-4 py-3">
      <div class="max-w-6xl mx-auto flex justify-between items-center">
        <div class="flex items-center gap-4">
          <router-link to="/admin" class="text-lg font-bold text-red-400">管理后台</router-link>
          <span class="text-sm text-gray-400">{{ authStore.user?.realName }}</span>
        </div>
        <div class="flex gap-3">
          <router-link to="/admin" class="text-sm text-gray-300 hover:text-white">概览</router-link>
          <router-link to="/admin/students" class="text-sm text-gray-300 hover:text-white">学生</router-link>
          <router-link to="/admin/points" class="text-sm text-gray-300 hover:text-white">积分</router-link>
          <router-link to="/admin/pets" class="text-sm text-gray-300 hover:text-white">宠物</router-link>
          <router-link to="/admin/skins" class="text-sm text-gray-300 hover:text-white">皮肤</router-link>
          <router-link to="/admin/quests" class="text-sm text-gray-300 hover:text-white">任务</router-link>
          <router-link to="/admin/achievements" class="text-sm text-gray-300 hover:text-white">成就</router-link>
          <button @click="authStore.logout(); router.push('/')" class="text-sm text-red-400 hover:text-red-300">退出</button>
        </div>
      </div>
    </nav>
    <main class="max-w-6xl mx-auto p-4">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
</script>
