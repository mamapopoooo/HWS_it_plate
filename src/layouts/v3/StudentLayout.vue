<template>
  <div class="v3-student-layout">
    <!-- 水墨背景 -->
    <div class="ink-bg">
      <div class="ink-mountain"></div>
      <div class="ink-cloud c1"></div>
      <div class="ink-cloud c2"></div>
    </div>

    <!-- 顶部导航栏 -->
    <nav class="top-nav">
      <div class="nav-inner">
        <div class="nav-left">
          <router-link to="/student" class="nav-brand">墨境课堂</router-link>
          <span class="nav-divider">·</span>
          <span class="nav-user">{{ authStore.user?.realName || '修行者' }}</span>
        </div>
        <div class="nav-center">
          <router-link
            v-for="item in navItems"
            :key="item.path"
            :to="item.path"
            :class="['nav-link', { active: isActive(item.path) }]"
          >
            <span class="nav-icon">{{ item.icon }}</span>
            <span class="nav-label">{{ item.label }}</span>
          </router-link>
        </div>
        <div class="nav-right">
          <span class="nav-points">💰 {{ pointsStore.totalPoints }}</span>
          <button class="nav-logout" @click="handleLogout">退出</button>
        </div>
      </div>
    </nav>

    <!-- 内容区 -->
    <main class="main-content">
      <router-view />
    </main>

    <!-- 底部印章 -->
    <div class="footer-seal">
      <div class="seal-stamp">宏文</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePointsStore } from '@/stores/points'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const pointsStore = usePointsStore()

const navItems = [
  { path: '/student', icon: '🏠', label: '首页' },
  { path: '/student/pets', icon: '🐾', label: '宠物' },
  { path: '/student/gacha', icon: '🎋', label: '求签' },
  { path: '/student/collection', icon: '📜', label: '图鉴' },
  { path: '/student/battle', icon: '⚔️', label: '斗法' },
  { path: '/student/shop', icon: '🏪', label: '集市' },
  { path: '/student/ranking', icon: '🏆', label: '封神榜' },
  { path: '/student/character', icon: '👘', label: '角色' },
  { path: '/student/quests', icon: '📋', label: '任务' },
  { path: '/student/achievements', icon: '🎖️', label: '功名' }
]

function isActive(path: string) {
  if (path === '/student') return route.path === '/student'
  return route.path.startsWith(path)
}

function handleLogout() {
  authStore.logout()
  router.push('/login')
}

pointsStore.loadPoints()
</script>

<style scoped>
.v3-student-layout {
  min-height: 100vh;
  background: #F2E8D5;
  font-family: 'Songti SC', 'STSong', 'Noto Serif SC', Georgia, serif;
  color: #1C1C24;
  position: relative;
}

/* 水墨背景 */
.ink-bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}
.ink-mountain {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 30%;
  background: linear-gradient(to top, rgba(28,28,36,0.05), transparent);
  clip-path: polygon(0% 100%, 15% 55%, 30% 75%, 50% 35%, 70% 65%, 85% 40%, 100% 60%, 100% 100%);
}
.ink-cloud {
  position: absolute;
  width: 250px;
  height: 50px;
  background: radial-gradient(ellipse, rgba(28,28,36,0.03) 0%, transparent 70%);
  border-radius: 50%;
  animation: cloud-drift 35s linear infinite;
}
.c1 { top: 12%; left: -250px; }
.c2 { top: 25%; left: -250px; width: 350px; animation-delay: 18s; animation-duration: 45s; }
@keyframes cloud-drift {
  from { transform: translateX(0); }
  to { transform: translateX(calc(100vw + 500px)); }
}

/* 顶部导航 */
.top-nav {
  position: sticky;
  top: 0;
  z-index: 50;
  background: linear-gradient(to bottom, #E8DCC2, #E8DCC2ee);
  border-bottom: 2px solid #C9A227;
  backdrop-filter: blur(8px);
}
.nav-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.nav-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.nav-brand {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 18px;
  font-weight: bold;
  color: #C0392B;
  text-decoration: none;
  letter-spacing: 0.1em;
}
.nav-divider { color: #C9A227; }
.nav-user {
  font-size: 13px;
  color: #4A4A5A;
}
.nav-center {
  display: flex;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
}
.nav-center::-webkit-scrollbar { display: none; }
.nav-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 10px;
  border-radius: 6px;
  text-decoration: none;
  color: #4A4A5A;
  font-size: 12px;
  transition: all 0.15s;
  white-space: nowrap;
  border: 1px solid transparent;
}
.nav-link:hover {
  background: rgba(201,162,39,0.1);
  color: #1C1C24;
}
.nav-link.active {
  background: #C9A227;
  color: white;
  border-color: #8B6914;
}
.nav-icon { font-size: 16px; line-height: 1; }
.nav-label {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 11px;
  margin-top: 1px;
}
.nav-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.nav-points {
  font-family: Georgia, serif;
  font-size: 14px;
  font-weight: bold;
  color: #C9A227;
}
.nav-logout {
  padding: 4px 12px;
  background: transparent;
  border: 1px solid #C0392B;
  border-radius: 4px;
  color: #C0392B;
  font-size: 12px;
  cursor: pointer;
  font-family: 'KaiTi', 'STKaiti', serif;
  transition: all 0.12s;
}
.nav-logout:hover {
  background: #C0392B;
  color: white;
}

/* 内容区 */
.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  position: relative;
  z-index: 1;
}

/* 底部印章 */
.footer-seal {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 10;
  pointer-events: none;
}
.seal-stamp {
  width: 40px;
  height: 40px;
  background: #C0392B;
  color: #F2E8D5;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 16px;
  font-weight: bold;
  transform: rotate(-6deg);
  opacity: 0.6;
  box-shadow: 0 2px 4px rgba(192,57,43,0.3);
}

@media (max-width: 768px) {
  .nav-left { display: none; }
  .nav-right { gap: 6px; }
  .nav-points { font-size: 12px; }
  .nav-link { padding: 4px 6px; }
}
</style>
