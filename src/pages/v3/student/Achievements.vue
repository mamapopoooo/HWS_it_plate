<template>
  <div class="v3-achievements">
    <!-- 水墨山水背景 -->
    <div class="bg-scene">
      <div class="cloud cloud-1"></div>
      <div class="cloud cloud-2"></div>
      <div class="mountain"></div>
    </div>

    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">功名册</h1>
      <span class="page-subtitle">功成名就，青史留名</span>
    </div>

    <!-- 统计概览 -->
    <div class="stats-bar">
      <div class="stat-item">
        <span class="stat-value">{{ unlockedCount }}</span>
        <span class="stat-label">已解锁</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-value">{{ totalCount }}</span>
        <span class="stat-label">全部成就</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat-item">
        <span class="stat-value">{{ claimedCount }}</span>
        <span class="stat-label">已领取</span>
      </div>
    </div>

    <!-- 分类筛选 -->
    <div class="category-bar" v-if="categories.length > 1">
      <button
        v-for="cat in categories"
        :key="cat.value"
        :class="['cat-btn', { active: activeCategory === cat.value }]"
        @click="activeCategory = cat.value"
      >{{ cat.label }}</button>
    </div>

    <!-- 成就网格 -->
    <div class="achievement-grid" v-if="filteredAchievements.length > 0">
      <div
        v-for="ach in filteredAchievements"
        :key="ach.id"
        :class="[
          'achievement-card',
          {
            locked: !ach.unlocked,
            unlocked: ach.unlocked && !ach.claimed,
            claimed: ach.claimed
          }
        ]"
      >
        <!-- 卡片头部 -->
        <div class="ach-header">
          <div class="ach-icon-wrap" :class="{ 'icon-locked': !ach.unlocked }">
            <span class="ach-icon">{{ getCategoryIcon(ach.category) }}</span>
          </div>
          <div class="ach-title-area">
            <div class="ach-name">{{ ach.name }}</div>
            <div class="ach-category">{{ getCategoryName(ach.category) }}</div>
          </div>
        </div>

        <!-- 描述 -->
        <div class="ach-desc">{{ ach.description }}</div>

        <!-- 奖励信息 -->
        <div class="ach-reward">
          <span class="reward-tag" v-if="ach.reward_points">
            +{{ ach.reward_points }} 积分
          </span>
          <span class="reward-tag reward-tag-exp" v-if="ach.reward_exp">
            +{{ ach.reward_exp }} 经验
          </span>
        </div>

        <!-- 状态区 -->
        <div class="ach-footer">
          <!-- 进度（如果有） -->
          <div v-if="ach.target > 0" class="ach-progress">
            <div class="ach-progress-bar-wrap">
              <div
                class="ach-progress-bar"
                :style="{ width: getAchProgress(ach) + '%' }"
              ></div>
            </div>
            <span class="ach-progress-text">
              {{ ach.current_progress || 0 }}/{{ ach.target }}
            </span>
          </div>

          <!-- 已领取印章 -->
          <div v-if="ach.claimed" class="claimed-stamp">已领</div>

          <!-- 领取按钮 -->
          <button
            v-else-if="ach.unlocked && !ach.claimed"
            class="claim-btn"
            :disabled="claimingId === ach.id"
            @click="handleClaim(ach.id)"
          >
            {{ claimingId === ach.id ? '...' : '领取' }}
          </button>

          <!-- 未解锁 -->
          <div v-else-if="!ach.unlocked" class="locked-hint">未解锁</div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <div class="empty-icon">🏅</div>
      <div class="empty-text">{{ loading ? '加载中...' : '暂无成就' }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '@/api'

interface Achievement {
  id: string
  name: string
  description: string
  category: string
  reward_points: number
  reward_exp: number
  target: number
  current_progress?: number
  unlocked: boolean
  claimed: boolean
}

const allAchievements = ref<Achievement[]>([])
const myAchievementIds = ref<Set<string>>(new Set())
const myClaimedIds = ref<Set<string>>(new Set())
const myProgressMap = ref<Record<string, number>>({})
const loading = ref(false)
const claimingId = ref<string | null>(null)
const activeCategory = ref('all')

// 合并成就数据
const achievements = computed(() => {
  return allAchievements.value.map(ach => {
    const unlocked = myAchievementIds.value.has(ach.id)
    const claimed = myClaimedIds.value.has(ach.id)
    const progress = myProgressMap.value[ach.id] || ach.current_progress || 0
    return { ...ach, unlocked, claimed, current_progress: progress }
  })
})

// 分类列表
const categories = computed(() => {
  const cats = new Set<string>()
  for (const ach of allAchievements.value) {
    if (ach.category) cats.add(ach.category)
  }
  const list = [{ value: 'all', label: '全部' }]
  for (const c of cats) {
    list.push({ value: c, label: getCategoryName(c) })
  }
  return list
})

// 筛选后的成就
const filteredAchievements = computed(() => {
  if (activeCategory.value === 'all') return achievements.value
  return achievements.value.filter(a => a.category === activeCategory.value)
})

// 统计
const totalCount = computed(() => allAchievements.value.length)
const unlockedCount = computed(() => achievements.value.filter(a => a.unlocked).length)
const claimedCount = computed(() => achievements.value.filter(a => a.claimed).length)

// 分类图标
const categoryIcons: Record<string, string> = {
  battle: '⚔️',
  collection: '📜',
  social: '🤝',
  pet: '🐾',
  quest: '📋',
  special: '✨',
  default: '🏅'
}

function getCategoryIcon(category: string): string {
  return categoryIcons[category] || categoryIcons.default
}

const categoryNames: Record<string, string> = {
  battle: '战斗',
  collection: '收集',
  social: '社交',
  pet: '宠物',
  quest: '任务',
  special: '特殊',
  default: '通用'
}

function getCategoryName(category: string): string {
  return categoryNames[category] || categoryNames.default || category
}

function getAchProgress(ach: Achievement): number {
  if (!ach.target) return 0
  return Math.min(100, Math.round(((ach.current_progress || 0) / ach.target) * 100))
}

async function loadAchievements() {
  try {
    const data = await api.getAchievements()
    allAchievements.value = data.achievements || []
  } catch (e) {
    console.error('加载成就列表失败:', e)
  }
}

async function loadMyAchievements() {
  try {
    const data = await api.getMyAchievements()
    const list = data.achievements || []
    const ids = new Set<string>()
    const claimedIds = new Set<string>()
    const progressMap: Record<string, number> = {}
    for (const item of list) {
      ids.add(item.achievement_id || item.id)
      if (item.claimed) claimedIds.add(item.achievement_id || item.id)
      if (item.current_progress != null) {
        progressMap[item.achievement_id || item.id] = item.current_progress
      }
    }
    myAchievementIds.value = ids
    myClaimedIds.value = claimedIds
    myProgressMap.value = progressMap
  } catch (e) {
    console.error('加载我的成就失败:', e)
  }
}

async function handleClaim(achievementId: string) {
  claimingId.value = achievementId
  try {
    await api.claimAchievement(achievementId)
    myClaimedIds.value.add(achievementId)
  } catch (e: any) {
    alert(e.message || '领取失败')
  } finally {
    claimingId.value = null
  }
}

onMounted(async () => {
  loading.value = true
  await Promise.all([loadAchievements(), loadMyAchievements()])
  loading.value = false
})
</script>

<style scoped>
.v3-achievements {
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

/* 统计概览 */
.stats-bar {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  background: #E8DCC2;
  border: 2px solid #C9A227;
  border-radius: 10px;
  padding: 14px 20px;
  margin-bottom: 18px;
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 1;
}
.stat-value {
  font-family: Georgia, serif;
  font-size: 22px;
  font-weight: bold;
  color: #C9A227;
}
.stat-label {
  font-size: 12px;
  color: #8A8577;
}
.stat-divider {
  width: 1px;
  height: 32px;
  background: rgba(201,162,39,0.3);
}

/* 分类筛选 */
.category-bar {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 18px;
}
.cat-btn {
  padding: 5px 14px;
  border: 1.5px solid #8A8577;
  border-radius: 20px;
  background: transparent;
  color: #4A4A5A;
  font-size: 13px;
  font-family: 'KaiTi', 'STKaiti', serif;
  cursor: pointer;
  transition: all 0.12s;
  letter-spacing: 0.04em;
}
.cat-btn:hover {
  border-color: #C0392B;
  color: #C0392B;
}
.cat-btn.active {
  background: #1C1C24;
  border-color: #1C1C24;
  color: #F2E8D5;
}

/* 成就网格 */
.achievement-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}

/* 成就卡片 */
.achievement-card {
  background: #E8DCC2;
  border: 2px solid #8A8577;
  border-radius: 10px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all 0.15s;
  position: relative;
  overflow: hidden;
}
.achievement-card.unlocked {
  border-color: #C9A227;
  box-shadow: 0 2px 10px rgba(201,162,39,0.15);
}
.achievement-card.claimed {
  border-color: #7FA88A;
}
.achievement-card.locked {
  opacity: 0.55;
  filter: grayscale(0.4);
}
.achievement-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(0,0,0,0.1);
}

/* 卡片头部 */
.ach-header {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ach-icon-wrap {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(201,162,39,0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ach-icon-wrap.icon-locked {
  background: rgba(138,133,119,0.15);
}
.ach-icon {
  font-size: 20px;
}
.ach-title-area { flex: 1; min-width: 0; }
.ach-name {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 15px;
  font-weight: bold;
  letter-spacing: 0.04em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ach-category {
  font-size: 11px;
  color: #8A8577;
  margin-top: 2px;
}

/* 描述 */
.ach-desc {
  font-size: 12px;
  color: #4A4A5A;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* 奖励 */
.ach-reward {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.reward-tag {
  padding: 2px 8px;
  background: rgba(201,162,39,0.15);
  border-radius: 4px;
  font-size: 11px;
  font-family: Georgia, serif;
  font-weight: bold;
  color: #C9A227;
}
.reward-tag-exp {
  background: rgba(127,168,138,0.15);
  color: #7FA88A;
}

/* 底部状态区 */
.ach-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
}
.ach-progress {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}
.ach-progress-bar-wrap {
  flex: 1;
  height: 6px;
  background: rgba(28,28,36,0.1);
  border-radius: 3px;
  overflow: hidden;
}
.ach-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #C9A227, #E8B33A);
  border-radius: 3px;
  transition: width 0.4s ease;
}
.ach-progress-text {
  font-size: 11px;
  font-family: Georgia, serif;
  color: #4A4A5A;
  white-space: nowrap;
}

.claimed-stamp {
  padding: 3px 12px;
  border: 2px solid #7FA88A;
  color: #7FA88A;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  font-family: 'KaiTi', 'STKaiti', serif;
  letter-spacing: 0.08em;
  transform: rotate(-3deg);
}

.claim-btn {
  padding: 4px 16px;
  background: #C0392B;
  color: white;
  border: none;
  border-radius: 5px;
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 13px;
  font-weight: bold;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: all 0.12s;
  box-shadow: 0 2px 6px rgba(192,57,43,0.25);
}
.claim-btn:hover:not(:disabled) {
  filter: brightness(1.1);
}
.claim-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.locked-hint {
  font-size: 12px;
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
  .v3-achievements { padding: 14px; }
  .page-title { font-size: 24px; }
  .achievement-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .achievement-card { padding: 12px; }
}

@media (max-width: 380px) {
  .achievement-grid {
    grid-template-columns: 1fr;
  }
}
</style>
