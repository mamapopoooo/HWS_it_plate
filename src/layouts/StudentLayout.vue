<template>
  <div class="min-h-screen bg-gray-900 text-white">
    <!-- 顶部导航 -->
    <nav class="bg-gray-800 border-b border-gray-700 px-4 py-3">
      <div class="max-w-6xl mx-auto flex justify-between items-center">
        <div class="flex items-center gap-4">
          <router-link to="/student" class="text-lg font-bold text-orange-400">王宠课堂</router-link>
          <span class="text-sm text-gray-400">{{ authStore.user?.realName }}</span>
          <span class="text-sm text-yellow-400">{{ pointsStore.totalPoints }} 积分</span>
        </div>
        <div class="flex gap-3">
          <router-link to="/student" class="text-sm text-gray-300 hover:text-white">首页</router-link>
          <router-link to="/student/pets" class="text-sm text-gray-300 hover:text-white">宠物</router-link>
          <router-link to="/student/battle" class="text-sm text-gray-300 hover:text-white">战斗</router-link>
          <router-link to="/student/shop" class="text-sm text-gray-300 hover:text-white">商城</router-link>
          <router-link to="/student/gacha" class="text-sm text-gray-300 hover:text-white">抽卡</router-link>
          <router-link to="/student/ranking" class="text-sm text-gray-300 hover:text-white">排行</router-link>
          <button @click="authStore.logout(); router.push('/')" class="text-sm text-red-400 hover:text-red-300">退出</button>
        </div>
      </div>
    </nav>
    <!-- 内容区 -->
    <main class="max-w-6xl mx-auto p-4">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePointsStore } from '@/stores/points'

const router = useRouter()
const authStore = useAuthStore()
const pointsStore = usePointsStore()
pointsStore.loadPoints()
</script>
