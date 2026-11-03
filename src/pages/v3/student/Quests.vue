<template>
  <div class="v3-quests">
    <!-- 水墨山水背景 -->
    <div class="bg-scene">
      <div class="cloud cloud-1"></div>
      <div class="cloud cloud-2"></div>
      <div class="mountain"></div>
    </div>

    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">任务</h1>
      <span class="page-subtitle">日积月累，功不唐捐</span>
    </div>

    <!-- 标签页切换 -->
    <div class="tab-bar">
      <button
        :class="['tab-btn', { active: activeTab === 'daily' }]"
        @click="activeTab = 'daily'"
      >
        每日
        <span v-if="unclaimedDaily > 0" class="tab-badge">{{ unclaimedDaily }}</span>
      </button>
      <button
        :class="['tab-btn', { active: activeTab === 'weekly' }]"
        @click="activeTab = 'weekly'"
      >
        每周
        <span v-if="unclaimedWeekly > 0" class="tab-badge">{{ unclaimedWeekly }}</span>
      </button>
    </div>

    <!-- 任务卷轴列表 -->
    <div class="quest-list" v-if="currentQuests.length > 0">
      <div
        v-for="quest in currentQuests"
        :key="quest.id"
        class="scroll-frame"
      >
        <div class="scroll-top-bar"></div>
        <div class="scroll-body">
          <div class="quest-content">
            <!-- 任务信息 -->
            <div class="quest-info">
              <div class="quest-name-row">
                <span class="quest-name">{{ quest.name }}</span>
                <span v-if="quest.claimed" class="claimed-stamp">已领取</span>
              </div>
              <div class="quest-desc">{{ quest.description }}</div>
            </div>

            <!-- 进度条 -->
            <div class="progress-section">
              <div class="progress-bar-wrap">
                <div
                  class="progress-bar"
                  :style="{ width: getProgressPercent(quest) + '%' }"
                ></div>
              </div>
              <div class="progress-text">
                <span>{{ quest.current_progress || 0 }} / {{ quest.target }}</span>
                <span class="progress-percent">{{ getProgressPercent(quest) }}%</span>
              </div>
            </div>

            <!-- 奖励 + 领取按钮 -->
            <div class="quest-bottom">
              <div class="reward-info">
                <span class="reward-item reward-points">+{{ quest.reward_points || 0 }} 积分</span>
                <span class="reward-item reward-exp">+{{ quest.reward_exp || 0 }} 经验</span>
              </div>
              <button
                v-if="isCompletable(quest) && !quest.claimed"
                class="claim-btn"
                :disabled="claimingId === quest.id"
                @click="handleClaim(quest.id)"
              >
                {{ claimingId === quest.id ? '领取中...' : '领取' }}
              </button>
              <div v-else-if="quest.claimed" class="claimed-hint">已完成</div>
              <div v-else class="incomplete-hint">未完成</div>
            </div>
          </div>
        </div>
        <div class="scroll-bottom-bar"></div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <div class="empty-icon">📜</div>
      <div class="empty-text">{{ loading ? '加载中...' : '暂无任务' }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { api } from '@/api'

interface Quest {
  id: string
  name: string
  description: string
  target: number
  current_progress?: number
  reward_points: number
  reward_exp: number
  claimed: boolean
  type: 'daily' | 'weekly'
}

const activeTab = ref<'daily' | 'weekly'>('daily')
const dailyQuests = ref<Quest[]>([])
const weeklyQuests = ref<Quest[]>([])
const loading = ref(false)
const claimingId = ref<string | null>(null)

const currentQuests = computed(() => {
  return activeTab.value === 'daily' ? dailyQuests.value : weeklyQuests.value
})

const unclaimedDaily = computed(() => {
  return dailyQuests.value.filter(q => isCompletable(q) && !q.claimed).length
})

const unclaimedWeekly = computed(() => {
  return weeklyQuests.value.filter(q => isCompletable(q) && !q.claimed).length
})

function getProgressPercent(quest: Quest): number {
  const current = quest.current_progress || 0
  if (!quest.target) return 0
  return Math.min(100, Math.round((current / quest.target) * 100))
}

function isCompletable(quest: Quest): boolean {
  return (quest.current_progress || 0) >= quest.target
}

async function loadDailyQuests() {
  try {
    const data = await api.getDailyQuests()
    dailyQuests.value = data.quests || []
  } catch (e) {
    console.error('加载每日任务失败:', e)
  }
}

async function loadWeeklyQuests() {
  try {
    const data = await api.getWeeklyQuests()
    weeklyQuests.value = data.quests || []
  } catch (e) {
    console.error('加载每周任务失败:', e)
  }
}

async function handleClaim(questId: string) {
  claimingId.value = questId
  try {
    await api.claimQuest(questId)
    // 刷新任务列表
    await loadDailyQuests()
    await loadWeeklyQuests()
  } catch (e: any) {
    alert(e.message || '领取失败')
  } finally {
    claimingId.value = null
  }
}

watch(activeTab, () => {
  // 切换标签时确保数据已加载
  if (activeTab.value === 'daily' && dailyQuests.value.length === 0) {
    loadDailyQuests()
  } else if (activeTab.value === 'weekly' && weeklyQuests.value.length === 0) {
    loadWeeklyQuests()
  }
})

onMounted(async () => {
  loading.value = true
  await Promise.all([loadDailyQuests(), loadWeeklyQuests()])
  loading.value = false
})
</script>

<style scoped>
.v3-quests {
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
  margin-bottom: 20px;
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
.page-subtitle {
  display: block;
  font-size: 13px;
  color: #8A8577;
  margin-top: 4px;
  letter-spacing: 0.05em;
}

/* 标签栏 */
.tab-bar {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 0;
  margin-bottom: 20px;
  border-bottom: 2px solid rgba(201,162,39,0.3);
}
.tab-btn {
  flex: 1;
  padding: 10px 0;
  border: none;
  background: transparent;
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 16px;
  color: #8A8577;
  cursor: pointer;
  position: relative;
  transition: color 0.15s;
  letter-spacing: 0.06em;
}
.tab-btn:hover { color: #4A4A5A; }
.tab-btn.active {
  color: #1C1C24;
  font-weight: bold;
}
.tab-btn.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 20%;
  right: 20%;
  height: 3px;
  background: #C0392B;
  border-radius: 2px;
}
.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  margin-left: 6px;
  background: #C0392B;
  color: white;
  border-radius: 9px;
  font-size: 11px;
  font-family: Georgia, serif;
  font-weight: bold;
  vertical-align: middle;
}

/* 卷轴框架 */
.scroll-frame {
  position: relative;
  z-index: 1;
  margin-bottom: 16px;
}
.scroll-top-bar,
.scroll-bottom-bar {
  height: 14px;
  background: linear-gradient(to bottom, #8B6914, #C9A227, #8B6914);
  border-radius: 7px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);
}
.scroll-body {
  background: #E8DCC2;
  border-left: 3px solid #C9A227;
  border-right: 3px solid #C9A227;
  padding: 16px 18px;
}

/* 任务内容 */
.quest-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.quest-info { display: flex; flex-direction: column; gap: 4px; }
.quest-name-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.quest-name {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 17px;
  font-weight: bold;
  letter-spacing: 0.04em;
}
.claimed-stamp {
  display: inline-block;
  padding: 2px 10px;
  border: 2px solid #7FA88A;
  color: #7FA88A;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  font-family: 'KaiTi', 'STKaiti', serif;
  letter-spacing: 0.08em;
  transform: rotate(-3deg);
  opacity: 0.85;
}
.quest-desc {
  font-size: 13px;
  color: #4A4A5A;
  line-height: 1.6;
}

/* 进度条 */
.progress-section { display: flex; flex-direction: column; gap: 4px; }
.progress-bar-wrap {
  height: 12px;
  background: rgba(28,28,36,0.1);
  border-radius: 6px;
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #C9A227, #E8B33A);
  border-radius: 6px;
  transition: width 0.4s ease;
  min-width: 0;
}
.progress-text {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #4A4A5A;
}
.progress-percent {
  font-family: Georgia, serif;
  font-weight: bold;
  color: #C9A227;
}

/* 底部：奖励 + 按钮 */
.quest-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.reward-info {
  display: flex;
  gap: 10px;
}
.reward-item {
  font-size: 13px;
  font-weight: bold;
  font-family: Georgia, serif;
}
.reward-points { color: #C9A227; }
.reward-exp { color: #7FA88A; }

.claim-btn {
  padding: 6px 20px;
  background: #C0392B;
  color: white;
  border: none;
  border-radius: 6px;
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 14px;
  font-weight: bold;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: all 0.12s;
  box-shadow: 0 2px 6px rgba(192,57,43,0.3);
}
.claim-btn:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}
.claim-btn:active:not(:disabled) {
  transform: translateY(0);
}
.claim-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.claimed-hint {
  font-size: 13px;
  color: #7FA88A;
  font-weight: bold;
}
.incomplete-hint {
  font-size: 13px;
  color: #8A8577;
}

/* 空状态 */
.empty-state {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 80px 20px;
}
.empty-icon { font-size: 48px; margin-bottom: 12px; }
.empty-text {
  font-size: 16px;
  color: #8A8577;
  font-family: 'KaiTi', 'STKaiti', serif;
  letter-spacing: 0.06em;
}

@media (max-width: 640px) {
  .v3-quests { padding: 14px; }
  .page-title { font-size: 24px; }
  .scroll-body { padding: 14px; }
}
</style>
