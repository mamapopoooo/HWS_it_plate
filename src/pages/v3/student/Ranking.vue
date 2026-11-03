<template>
  <div class="v3-ranking">
    <!-- 水墨山水背景 -->
    <div class="bg-scene">
      <div class="cloud cloud-1"></div>
      <div class="cloud cloud-2"></div>
      <div class="mountain"></div>
    </div>

    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">封神榜</h1>
      <p class="page-subtitle">群英荟萃，谁与争锋</p>
    </div>

    <!-- 三个标签页 -->
    <div class="tab-bar">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-btn', { active: activeTab === tab.id }]"
        @click="switchTab(tab.id)"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </div>

    <!-- 卷轴榜单 -->
    <div class="scroll-frame">
      <div class="scroll-top"></div>
      <div class="scroll-body">
        <!-- 加载态 -->
        <div v-if="loading" class="state-box">
          <div class="loading-circle"></div>
          <div class="state-text">榜单加载中...</div>
        </div>

        <!-- 错误态 -->
        <div v-else-if="error" class="state-box">
          <div class="state-icon">⚠️</div>
          <div class="state-text error-text">{{ error }}</div>
          <button class="retry-btn" @click="loadRankingData">重新加载</button>
        </div>

        <!-- 空态 -->
        <div v-else-if="rankingList.length === 0" class="state-box">
          <div class="state-icon">📜</div>
          <div class="state-text">暂无排行数据</div>
        </div>

        <!-- 榜单内容 -->
        <template v-else>
          <!-- 前三名领奖台 -->
          <div v-if="topThree.length > 0" class="podium">
            <div
              v-for="entry in topThree"
              :key="entry.rank"
              :class="['podium-item', 'podium-' + entry.rank]"
            >
              <div class="podium-badge">{{ rankBadge(entry.rank) }}</div>
              <div class="podium-name">{{ entry.real_name || entry.name || '无名' }}</div>
              <div class="podium-grade">{{ gradeLabel(entry.grade) }}</div>
              <div class="podium-value">{{ formatValue(entry.value) }}</div>
            </div>
          </div>

          <!-- 分隔线 -->
          <div v-if="topThree.length > 0" class="divider">
            <span class="divider-line"></span>
            <span class="divider-text">以下为完整榜单</span>
            <span class="divider-line"></span>
          </div>

          <!-- 完整排行列表 -->
          <div class="ranking-list">
            <div
              v-for="entry in rankingList"
              :key="entry.rank"
              :class="['rank-row', { 'is-me': isCurrentUser(entry) }, { 'is-top3': entry.rank <= 3 }]"
            >
              <div class="rank-num-wrap">
                <span v-if="entry.rank <= 3" class="rank-medal">{{ rankBadge(entry.rank) }}</span>
                <span v-else class="rank-number">{{ entry.rank }}</span>
              </div>
              <div class="rank-info">
                <span class="rank-name">
                  {{ entry.real_name || entry.name || '无名' }}
                  <span v-if="isCurrentUser(entry)" class="me-tag">我</span>
                </span>
                <span class="rank-grade">{{ gradeLabel(entry.grade) }}</span>
              </div>
              <div class="rank-value">{{ formatValue(entry.value) }}</div>
            </div>
          </div>
        </template>
      </div>
      <div class="scroll-bottom"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGameStore } from '@/stores/game'
import { useAuthStore } from '@/stores/auth'
import { v3Rankings } from '@/api/v3'

const gameStore = useGameStore()
const authStore = useAuthStore()

// --- 标签页配置 ---
const tabs = [
  { id: 'points', label: '积分榜', icon: '🏅' },
  { id: 'power', label: '战力榜', icon: '⚔️' },
  { id: 'collection', label: '收集榜', icon: '📖' },
]

const activeTab = ref('points')
const loading = ref(false)
const error = ref('')
const rankingList = ref<any[]>([])

// --- 计算 ---
const topThree = computed(() => rankingList.value.filter(e => e.rank <= 3))

function rankBadge(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return String(rank)
}

function gradeLabel(grade: number | string): string {
  const g = Number(grade)
  if (g === 6) return 'G6'
  if (g === 7) return 'G7'
  return grade ? `${grade}年级` : ''
}

function formatValue(value: any): string {
  if (typeof value === 'number') {
    return value.toLocaleString()
  }
  return String(value || '0')
}

function isCurrentUser(entry: any): boolean {
  const me = authStore.user
  if (!me) return false
  return entry.user_id === me.id || entry.userId === me.id || entry.username === me.username
}

// --- 数据加载 ---
async function loadRankingData() {
  loading.value = true
  error.value = ''
  rankingList.value = []

  try {
    const grade = authStore.user?.grade
    const data = await v3Rankings.get(activeTab.value, grade)
    rankingList.value = data.rankings || data.list || data || []
    // 确保是数组
    if (!Array.isArray(rankingList.value)) {
      rankingList.value = []
    }
  } catch (e: any) {
    error.value = e.message || '加载榜单失败'
    rankingList.value = []
  } finally {
    loading.value = false
  }
}

function switchTab(tabId: string) {
  if (activeTab.value === tabId) return
  activeTab.value = tabId
  loadRankingData()
}

// --- 生命周期 ---
onMounted(async () => {
  await gameStore.loadConfig()
  loadRankingData()
})
</script>

<style scoped>
.v3-ranking {
  position: relative;
  min-height: 100vh;
  padding: 20px;
  font-family: 'Songti SC', 'STSong', 'Noto Serif SC', Georgia, serif;
  color: #1C1C24;
  background: #F2E8D5;
}

/* ===== 水墨山水背景 ===== */
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

/* ===== 页面标题 ===== */
.page-header {
  text-align: center;
  margin-bottom: 16px;
  position: relative;
  z-index: 1;
}
.page-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 32px;
  font-weight: bold;
  letter-spacing: 0.15em;
  color: #1C1C24;
  margin: 0;
}
.page-subtitle {
  font-size: 13px;
  color: #8A8577;
  margin: 4px 0 0;
  letter-spacing: 0.1em;
}

/* ===== 标签栏 ===== */
.tab-bar {
  display: flex;
  gap: 0;
  margin-bottom: 16px;
  position: relative;
  z-index: 1;
  background: #E8DCC2;
  border-radius: 8px;
  border: 2px solid #C9A227;
  overflow: hidden;
}
.tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 10px 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 15px;
  font-weight: bold;
  letter-spacing: 0.06em;
  color: #4A4A5A;
  transition: all 0.15s ease;
  position: relative;
}
.tab-btn:not(:last-child)::after {
  content: '';
  position: absolute;
  right: 0;
  top: 20%;
  height: 60%;
  width: 1px;
  background: rgba(201,162,39,0.3);
}
.tab-btn:hover {
  background: rgba(201,162,39,0.1);
  color: #1C1C24;
}
.tab-btn.active {
  background: #C9A227;
  color: white;
}
.tab-icon {
  font-size: 16px;
}
.tab-label {
  font-size: 14px;
}

/* ===== 卷轴框架 ===== */
.scroll-frame {
  position: relative;
  z-index: 1;
}
.scroll-top, .scroll-bottom {
  height: 16px;
  background: linear-gradient(to bottom, #8B6914, #C9A227, #8B6914);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
.scroll-body {
  background: #F2E8D5;
  border-left: 3px solid #C9A227;
  border-right: 3px solid #C9A227;
  padding: 16px;
  min-height: 300px;
}

/* ===== 状态提示 ===== */
.state-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  gap: 12px;
}
.state-icon {
  font-size: 40px;
}
.state-text {
  font-size: 15px;
  color: #8A8577;
}
.error-text {
  color: #C0392B;
}
.loading-circle {
  width: 40px;
  height: 40px;
  border: 3px solid #E8DCC2;
  border-top-color: #C9A227;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.retry-btn {
  margin-top: 8px;
  padding: 8px 20px;
  background: #C9A227;
  color: white;
  border: none;
  border-radius: 6px;
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.12s;
}
.retry-btn:hover {
  background: #B8921F;
}

/* ===== 前三名领奖台 ===== */
.podium {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 20px;
  padding: 12px 0;
}
.podium-item {
  flex: 1;
  max-width: 140px;
  background: #E8DCC2;
  border: 2px solid #C9A227;
  border-radius: 10px;
  padding: 14px 8px;
  text-align: center;
  position: relative;
  transition: transform 0.15s;
}
.podium-item:hover {
  transform: translateY(-2px);
}
.podium-1 {
  border-color: #C9A227;
  background: linear-gradient(135deg, #F2E8D5, #F5EDD4);
  box-shadow: 0 4px 12px rgba(201,162,39,0.25);
  order: 2;
  transform: scale(1.05);
}
.podium-1:hover {
  transform: scale(1.05) translateY(-2px);
}
.podium-2 {
  border-color: #A0A0A0;
  order: 1;
}
.podium-3 {
  border-color: #CD7F32;
  order: 3;
}
.podium-badge {
  font-size: 28px;
  line-height: 1;
  margin-bottom: 6px;
}
.podium-name {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 15px;
  font-weight: bold;
  color: #1C1C24;
  letter-spacing: 0.04em;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.podium-grade {
  font-size: 11px;
  color: #8A8577;
  margin-bottom: 4px;
}
.podium-value {
  font-family: Georgia, serif;
  font-size: 18px;
  font-weight: bold;
  color: #C9A227;
}

/* ===== 分隔线 ===== */
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}
.divider-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(201,162,39,0.4), transparent);
}
.divider-text {
  font-size: 12px;
  color: #8A8577;
  white-space: nowrap;
}

/* ===== 排行列表 ===== */
.ranking-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.rank-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 6px;
  transition: background 0.12s;
}
.rank-row:hover {
  background: rgba(232,220,194,0.6);
}
.rank-row.is-top3 {
  background: rgba(232,220,194,0.4);
}
.rank-row.is-me {
  background: rgba(201,162,39,0.15);
  border: 1px solid rgba(201,162,39,0.4);
}
.rank-row.is-me:hover {
  background: rgba(201,162,39,0.22);
}

.rank-num-wrap {
  width: 36px;
  text-align: center;
  flex-shrink: 0;
}
.rank-medal {
  font-size: 22px;
  line-height: 1;
}
.rank-number {
  font-family: Georgia, serif;
  font-size: 16px;
  font-weight: bold;
  color: #4A4A5A;
}

.rank-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.rank-name {
  font-size: 14px;
  font-weight: bold;
  color: #1C1C24;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.me-tag {
  display: inline-block;
  background: #C0392B;
  color: white;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  font-weight: bold;
  margin-left: 4px;
  vertical-align: middle;
}
.rank-grade {
  font-size: 11px;
  color: #8A8577;
  flex-shrink: 0;
}

.rank-value {
  font-family: Georgia, serif;
  font-size: 16px;
  font-weight: bold;
  color: #C9A227;
  flex-shrink: 0;
  min-width: 50px;
  text-align: right;
}

/* ===== 响应式 ===== */
@media (max-width: 640px) {
  .podium {
    gap: 8px;
  }
  .podium-item {
    padding: 10px 6px;
  }
  .podium-1 {
    transform: scale(1.02);
  }
  .podium-1:hover {
    transform: scale(1.02) translateY(-2px);
  }
  .podium-name {
    font-size: 13px;
  }
  .podium-value {
    font-size: 15px;
  }
  .rank-row {
    padding: 8px 10px;
    gap: 8px;
  }
  .rank-value {
    font-size: 14px;
    min-width: 40px;
  }
}
</style>
