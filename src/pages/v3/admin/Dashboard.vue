<template>
  <div class="admin-dashboard">
    <!-- 水墨山水背景 -->
    <div class="bg-scene">
      <div class="cloud cloud-1"></div>
      <div class="cloud cloud-2"></div>
      <div class="mountain"></div>
    </div>

    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">管理概览</h1>
      <span class="page-sub">墨境 · 教师管理台</span>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <div class="loading-icon">墨</div>
      <div class="loading-text">载入中…</div>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-state">
      <div class="error-icon">✕</div>
      <div class="error-text">{{ error }}</div>
      <button class="retry-btn" @click="loadData">重试</button>
    </div>

    <template v-else>
      <!-- 四象统计卡片 -->
      <div class="stat-grid">
        <div v-for="s in statCards" :key="s.label" class="stat-card">
          <div class="scroll-frame">
            <div class="scroll-top"></div>
            <div class="scroll-body">
              <div class="stat-icon">{{ s.icon }}</div>
              <div class="stat-value">{{ s.value }}</div>
              <div class="stat-label">{{ s.label }}</div>
            </div>
            <div class="scroll-bottom"></div>
          </div>
        </div>
      </div>

      <!-- 待审造物 + 快捷入口 -->
      <div class="bottom-row">
        <!-- 待审造物 -->
        <div class="review-card">
          <div class="scroll-frame">
            <div class="scroll-top"></div>
            <div class="scroll-body">
              <h3 class="section-title">待审造物</h3>
              <div v-if="reviewLoading" class="inline-loading">加载中…</div>
              <div v-else-if="reviewError" class="inline-error">{{ reviewError }}</div>
              <div v-else class="review-count">
                <span class="review-num">{{ pendingCount }}</span>
                <span class="review-unit">件待审</span>
              </div>
              <router-link to="/admin/review" class="review-link">前往审核 →</router-link>
            </div>
            <div class="scroll-bottom"></div>
          </div>
        </div>

        <!-- 快捷入口 -->
        <div class="links-card">
          <div class="scroll-frame">
            <div class="scroll-top"></div>
            <div class="scroll-body">
              <h3 class="section-title">快捷入口</h3>
              <div class="link-grid">
                <router-link to="/admin/students" class="link-item">
                  <span class="link-icon">📋</span>
                  <span class="link-text">学生管理</span>
                </router-link>
                <router-link to="/admin/points" class="link-item">
                  <span class="link-icon">💰</span>
                  <span class="link-text">积分同步</span>
                </router-link>
                <router-link to="/admin/pets" class="link-item">
                  <span class="link-icon">🐾</span>
                  <span class="link-text">宠物管理</span>
                </router-link>
                <router-link to="/admin/skins" class="link-item">
                  <span class="link-icon">👘</span>
                  <span class="link-text">皮肤管理</span>
                </router-link>
                <router-link to="/admin/review" class="link-item">
                  <span class="link-icon">📜</span>
                  <span class="link-text">造物审核</span>
                </router-link>
              </div>
            </div>
            <div class="scroll-bottom"></div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '@/api'
import { v3Admin } from '@/api/v3'

const loading = ref(true)
const error = ref('')
const stats = ref<any>(null)

const reviewLoading = ref(true)
const reviewError = ref('')
const pendingCount = ref(0)

const statCards = computed(() => [
  { icon: '🎓', label: '学生数', value: stats.value?.students ?? '-' },
  { icon: '🐾', label: '宠物数', value: stats.value?.pets ?? '-' },
  { icon: '⚔️', label: '战斗数', value: stats.value?.battles ?? '-' },
  { icon: '💰', label: '总积分', value: stats.value?.totalPoints ?? '-' }
])

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    stats.value = await api.getStats()
  } catch (e: any) {
    error.value = e.message || '加载统计数据失败'
  } finally {
    loading.value = false
  }
}

async function loadPending() {
  reviewLoading.value = true
  reviewError.value = ''
  try {
    const data = await v3Admin.getPendingCustomPets()
    pendingCount.value = Array.isArray(data) ? data.length : (data?.count ?? 0)
  } catch (e: any) {
    reviewError.value = e.message || '加载待审数据失败'
  } finally {
    reviewLoading.value = false
  }
}

onMounted(() => {
  loadData()
  loadPending()
})
</script>

<style scoped>
.admin-dashboard {
  position: relative;
  min-height: 100vh;
  padding: 20px;
  font-family: 'Songti SC', 'STSong', 'Noto Serif SC', Georgia, serif;
  color: #1C1C24;
  background: #F2E8D5;
}

/* 水墨山水背景 */
.bg-scene {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}
.mountain {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40%;
  background: linear-gradient(to top, rgba(28,28,36,0.06), transparent);
  clip-path: polygon(0% 100%, 10% 60%, 25% 80%, 40% 40%, 55% 70%, 70% 30%, 85% 65%, 100% 45%, 100% 100%);
}
.cloud {
  position: absolute;
  width: 200px;
  height: 60px;
  background: radial-gradient(ellipse, rgba(28,28,36,0.04) 0%, transparent 70%);
  border-radius: 50%;
  animation: drift 30s linear infinite;
}
.cloud-1 { top: 15%; left: -200px; animation-delay: 0s; }
.cloud-2 { top: 30%; left: -200px; animation-delay: 15s; width: 300px; }
@keyframes drift {
  from { transform: translateX(0); }
  to { transform: translateX(calc(100vw + 400px)); }
}

/* 页面标题 */
.page-header {
  position: relative;
  z-index: 1;
  margin-bottom: 24px;
  text-align: center;
}
.page-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 28px;
  font-weight: bold;
  letter-spacing: 0.1em;
  color: #1C1C24;
  margin: 0;
}
.page-sub {
  font-size: 13px;
  color: #8A8577;
  letter-spacing: 0.06em;
}

/* 卷轴框架 */
.scroll-frame {
  position: relative;
}
.scroll-top, .scroll-bottom {
  height: 14px;
  background: linear-gradient(to bottom, #8B6914, #C9A227, #8B6914);
  border-radius: 7px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.18);
}
.scroll-body {
  background: #E8DCC2;
  border-left: 3px solid #C9A227;
  border-right: 3px solid #C9A227;
  padding: 20px;
}

/* 统计卡片网格 */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
  position: relative;
  z-index: 1;
}
.stat-card .scroll-body {
  text-align: center;
  padding: 16px 12px;
}
.stat-icon {
  font-size: 28px;
  margin-bottom: 6px;
}
.stat-value {
  font-family: Georgia, serif;
  font-size: 32px;
  font-weight: bold;
  color: #C9A227;
  line-height: 1.2;
}
.stat-label {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 14px;
  color: #4A4A5A;
  letter-spacing: 0.06em;
  margin-top: 4px;
}

/* 底部双栏 */
.bottom-row {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 20px;
  position: relative;
  z-index: 1;
}

/* 待审造物 */
.section-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 17px;
  font-weight: bold;
  letter-spacing: 0.06em;
  margin: 0 0 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(201,162,39,0.3);
}
.review-count {
  text-align: center;
  padding: 12px 0;
}
.review-num {
  font-family: Georgia, serif;
  font-size: 42px;
  font-weight: bold;
  color: #C0392B;
}
.review-unit {
  font-size: 14px;
  color: #4A4A5A;
  margin-left: 4px;
}
.review-link {
  display: block;
  text-align: center;
  margin-top: 12px;
  color: #C9A227;
  text-decoration: none;
  font-size: 13px;
  font-family: 'KaiTi', 'STKaiti', serif;
  letter-spacing: 0.06em;
  transition: color 0.12s;
}
.review-link:hover { color: #C0392B; }

/* 内联加载/错误 */
.inline-loading, .inline-error {
  text-align: center;
  padding: 16px;
  font-size: 13px;
}
.inline-loading { color: #8A8577; }
.inline-error { color: #C0392B; }

/* 快捷入口 */
.link-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.link-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 8px;
  background: #F2E8D5;
  border: 2px solid #C9A227;
  border-radius: 8px;
  text-decoration: none;
  color: #1C1C24;
  transition: all 0.12s;
  cursor: pointer;
}
.link-item:hover {
  transform: scale(0.97);
  border-color: #C0392B;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.link-icon { font-size: 24px; }
.link-text {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 13px;
  font-weight: bold;
  letter-spacing: 0.04em;
}

/* 全局加载/错误状态 */
.loading-state, .error-state {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 80px 20px;
}
.loading-icon {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 48px;
  color: #C9A227;
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.loading-text {
  margin-top: 12px;
  font-size: 14px;
  color: #8A8577;
}
.error-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #C0392B;
  color: white;
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
}
.error-text {
  font-size: 14px;
  color: #4A4A5A;
  margin-bottom: 16px;
}
.retry-btn {
  padding: 8px 24px;
  background: #C9A227;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-family: 'KaiTi', 'STKaiti', serif;
  cursor: pointer;
  transition: all 0.12s;
}
.retry-btn:hover { filter: brightness(1.1); }

@media (max-width: 768px) {
  .stat-grid { grid-template-columns: repeat(2, 1fr); }
  .bottom-row { grid-template-columns: 1fr; }
  .link-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
