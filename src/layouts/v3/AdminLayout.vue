<template>
  <div class="v3-admin-layout">
    <!-- 水墨背景 -->
    <div class="ink-bg">
      <div class="ink-mountain"></div>
    </div>

    <!-- 侧边栏 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-brand">墨境</div>
        <div class="sidebar-subtitle">教师管理</div>
      </div>
      <nav class="sidebar-nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          :class="['sidebar-link', { active: isActive(item.path) }]"
        >
          <span class="link-icon">{{ item.icon }}</span>
          <span class="link-label">{{ item.label }}</span>
        </router-link>
      </nav>
      <div class="sidebar-footer">
        <div class="footer-user">{{ authStore.user?.realName || '管理员' }}</div>
        <button class="footer-logout" @click="handleLogout">退出</button>
      </div>
    </aside>

    <!-- 主内容区 -->
    <div class="main-area">
      <header class="top-bar">
        <h1 class="page-title">{{ currentPageTitle }}</h1>
        <div class="top-right">
          <span class="points-display">💰 {{ pointsStore.totalPoints }}</span>
        </div>
      </header>
      <main class="main-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePointsStore } from '@/stores/points'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const pointsStore = usePointsStore()

const navItems = [
  { path: '/admin', icon: '📊', label: '概览' },
  { path: '/admin/students', icon: '👥', label: '学生' },
  { path: '/admin/points', icon: '💰', label: '积分' },
  { path: '/admin/pets', icon: '🐾', label: '宠物' },
  { path: '/admin/skins', icon: '👘', label: '皮肤' },
  { path: '/admin/review', icon: '📝', label: '审核' }
]

const currentPageTitle = computed(() => {
  const item = navItems.find(i => isActive(i.path))
  return item?.label || '管理'
})

function isActive(path: string) {
  if (path === '/admin') return route.path === '/admin'
  return route.path.startsWith(path)
}

function handleLogout() {
  authStore.logout()
  router.push('/login')
}

pointsStore.loadPoints()
</script>

<style scoped>
.v3-admin-layout {
  display: flex;
  min-height: 100vh;
  background: #f2f2f2;
  font-family: 'Songti SC', 'STSong', serif;
  color: #111111;
  position: relative;
}

.ink-bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}
.ink-mountain {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 40%;
  height: 50%;
  background: linear-gradient(to top, rgba(28,28,36,0.04), transparent);
  clip-path: polygon(100% 100%, 100% 30%, 80% 55%, 60% 20%, 40% 50%, 20% 10%, 0% 45%, 0% 100%);
}

/* 侧边栏 */
.sidebar {
  width: 200px;
  background: #e4e4e4;
  border-right: 2px solid #8a8a8a;
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
}
.sidebar-header {
  padding: 20px 16px;
  border-bottom: 1px solid rgba(201,162,39,0.3);
  text-align: center;
}
.sidebar-brand {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 20px;
  font-weight: bold;
  color: #1f1f1f;
  letter-spacing: 0.1em;
}
.sidebar-subtitle {
  font-size: 12px;
  color: #767676;
  margin-top: 4px;
}
.sidebar-nav {
  flex: 1;
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sidebar-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 6px;
  text-decoration: none;
  color: #3a3a3a;
  font-size: 14px;
  transition: all 0.15s;
  border: 1px solid transparent;
}
.sidebar-link:hover {
  background: rgba(201,162,39,0.1);
  color: #111111;
}
.sidebar-link.active {
  background: #8a8a8a;
  color: white;
  border-color: #2b2b2b;
  font-weight: bold;
}
.link-icon { font-size: 18px; }
.link-label {
  font-family: 'KaiTi', 'STKaiti', serif;
  letter-spacing: 0.06em;
}
.sidebar-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(201,162,39,0.3);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.footer-user {
  font-size: 13px;
  color: #3a3a3a;
}
.footer-logout {
  padding: 4px 10px;
  background: transparent;
  border: 1px solid #1f1f1f;
  border-radius: 4px;
  color: #1f1f1f;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.12s;
}
.footer-logout:hover {
  background: #1f1f1f;
  color: white;
}

/* 主区域 */
.main-area {
  flex: 1;
  margin-left: 200px;
  position: relative;
  z-index: 1;
}
.top-bar {
  padding: 12px 24px;
  background: rgba(232,220,194,0.9);
  border-bottom: 2px solid #8a8a8a;
  display: flex;
  justify-content: space-between;
  align-items: center;
  backdrop-filter: blur(8px);
  position: sticky;
  top: 0;
  z-index: 10;
}
.page-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 20px;
  font-weight: bold;
  letter-spacing: 0.06em;
}
.points-display {
  font-family: Georgia, serif;
  font-size: 16px;
  font-weight: bold;
  color: #8a8a8a;
}
.main-content {
  padding: 24px;
}

@media (max-width: 768px) {
  .sidebar { width: 60px; }
  .sidebar-header { padding: 12px 8px; }
  .sidebar-brand { font-size: 14px; }
  .sidebar-subtitle { display: none; }
  .link-label { display: none; }
  .sidebar-link { justify-content: center; padding: 10px; }
  .sidebar-footer { flex-direction: column; gap: 8px; }
  .footer-user { display: none; }
  .main-area { margin-left: 60px; }
}
</style>
