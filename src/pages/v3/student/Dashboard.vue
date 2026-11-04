<template>
  <div class="v3-dashboard">
    <!-- 水墨山水背景 -->
    <div class="bg-scene">
      <div class="cloud cloud-1"></div>
      <div class="cloud cloud-2"></div>
      <div class="mountain"></div>
    </div>

    <!-- 顶部：修行者信息 -->
    <div class="trainer-card">
      <div class="scroll-frame">
        <div class="scroll-top"></div>
        <div class="scroll-body">
          <div class="trainer-info">
            <div class="avatar-ring" :style="{ borderColor: tierColor }">
              <div class="avatar-icon">修</div>
            </div>
            <div class="trainer-text">
              <div class="trainer-name">
                {{ character?.nickname || authStore.user?.realName || '无名' }}
                <span class="pinyin">{{ character?.title || tierLabel }}</span>
              </div>
              <div class="trainer-meta">
                <span class="trigram-badge" :style="{ background: tierColor }">
                  {{ trigramGlyph }} {{ trigramLabel }}
                </span>
                <span class="level-badge">Lv.{{ trainerLevel }}</span>
                <span class="points-badge">💰 {{ pointsStore.totalPoints }}</span>
              </div>
              <!-- 经验条 -->
              <div class="exp-bar-wrap">
                <div class="exp-bar" :style="{ width: expPercent + '%' }"></div>
                <span class="exp-text">{{ expCurrent }}/{{ expNeeded }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="scroll-bottom"></div>
      </div>
    </div>

    <!-- 快捷入口 -->
    <div class="quick-grid">
      <router-link to="/student/pets" class="quick-card">
        <div class="quick-icon">🐾</div>
        <div class="quick-label">我的宠物</div>
        <div class="quick-value">{{ myPetsCount }} 只</div>
      </router-link>
      <router-link to="/student/gacha" class="quick-card">
        <div class="quick-icon">🎋</div>
        <div class="quick-label">求签</div>
        <div class="quick-value">保底 {{ pityRemain }} 抽</div>
      </router-link>
      <router-link to="/student/collection" class="quick-card">
        <div class="quick-icon">📜</div>
        <div class="quick-label">图鉴</div>
        <div class="quick-value">{{ collectionCount }}/38</div>
      </router-link>
      <router-link to="/student/ranking" class="quick-card">
        <div class="quick-icon">🏆</div>
        <div class="quick-label">封神榜</div>
        <div class="quick-value">查看</div>
      </router-link>
      <router-link to="/student/character" class="quick-card">
        <div class="quick-icon">👘</div>
        <div class="quick-label">角色</div>
        <div class="quick-value">换装</div>
      </router-link>
      <router-link to="/student/battle" class="quick-card">
        <div class="quick-icon">⚔️</div>
        <div class="quick-label">斗法</div>
        <div class="quick-value">开始</div>
      </router-link>
    </div>

    <!-- 灵纹碎片 + 最近动态 -->
    <div class="bottom-row">
      <div class="fragments-card">
        <h3 class="section-title">灵纹碎片</h3>
        <div class="fragment-list">
          <div v-for="f in fragments" :key="f.tier" class="fragment-item">
            <span class="frag-dot" :style="{ background: f.color }"></span>
            <span class="frag-name">{{ f.name }}</span>
            <span class="frag-count">{{ f.count }}</span>
          </div>
          <div v-if="fragments.length === 0" class="empty-hint">暂无碎片</div>
        </div>
      </div>
      <div class="events-card">
        <h3 class="section-title">近期动态</h3>
        <div v-if="activeEvents.length === 0" class="empty-hint">暂无活动</div>
        <div v-for="ev in activeEvents" :key="ev.id" class="event-item">
          <span class="event-name">{{ ev.name }}</span>
          <span class="event-desc">{{ ev.description }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { usePointsStore } from '@/stores/points'
import { useGameStore } from '@/stores/game'
import { tierName, trigramGlyphs, getTier, getTrigram, FORM_NAMES } from '@/config/gameConfig'

const authStore = useAuthStore()
const pointsStore = usePointsStore()
const gameStore = useGameStore()

const character = ref<any>(null)
const myPetsCount = ref(0)
const collectionCount = ref(0)
const pityRemain = ref(20)
const fragments = ref<any[]>([])
const activeEvents = ref<any[]>([])
const trainerLevel = ref(1)
const expCurrent = ref(0)
const expNeeded = ref(100)

const tierLabel = computed(() => tierName(1))
const trigramLabel = computed(() => '乾')
const trigramGlyph = computed(() => '☰')
const tierColor = computed(() => getTier(1)?.bezelColor || '#8A8577')
const expPercent = computed(() => Math.min(100, (expCurrent.value / expNeeded.value) * 100))

onMounted(async () => {
  await gameStore.loadConfig()
  await pointsStore.loadPoints()

  // 加载角色
  try {
    await gameStore.loadCharacter()
    character.value = gameStore.character
  } catch {}

  // 加载我的宠物
  try {
    await gameStore.loadMyPets()
    myPetsCount.value = gameStore.myPets.length
  } catch {}

  // 加载活动
  try {
    await gameStore.loadEvents()
    activeEvents.value = gameStore.activeEvents
  } catch {}

  // 碎片信息
  const tierNames = ['万象', '八卦', '四象', '太极']
  const tierColors = ['#8A8577', '#3E7C59', '#C9A227', '#2E5C8A']
  for (let i = 1; i <= 4; i++) {
    fragments.value.push({
      tier: i,
      name: tierNames[i - 1],
      color: tierColors[i - 1],
      count: 0
    })
  }
})
</script>

<style scoped>
.v3-dashboard {
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

/* 卷轴框架 */
.scroll-frame {
  position: relative;
  margin-bottom: 20px;
}
.scroll-top, .scroll-bottom {
  height: 16px;
  background: linear-gradient(to bottom, #8B6914, #C9A227, #8B6914);
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
.scroll-body {
  background: #E8DCC2;
  border-left: 3px solid #C9A227;
  border-right: 3px solid #C9A227;
  padding: 20px;
}

/* 修行者信息 */
.trainer-info {
  display: flex;
  align-items: center;
  gap: 20px;
}
.avatar-ring {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 3px solid;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #F2E8D5;
  flex-shrink: 0;
}
.avatar-icon {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 28px;
  color: #1C1C24;
  font-weight: bold;
}
.trainer-text { flex: 1; }
.trainer-name {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 22px;
  font-weight: bold;
  letter-spacing: 0.06em;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.pinyin {
  font-size: 12px;
  color: #8A8577;
  font-family: 'Songti SC', serif;
}
.trainer-meta {
  display: flex;
  gap: 8px;
  margin-top: 6px;
  align-items: center;
}
.trigram-badge {
  padding: 2px 10px;
  border-radius: 4px;
  color: white;
  font-size: 13px;
  font-weight: bold;
}
.level-badge {
  background: #C9A227;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}
.points-badge {
  font-size: 13px;
  color: #4A4A5A;
}

/* 经验条 */
.exp-bar-wrap {
  margin-top: 8px;
  height: 14px;
  background: rgba(28,28,36,0.1);
  border-radius: 7px;
  position: relative;
  overflow: hidden;
}
.exp-bar {
  height: 100%;
  background: linear-gradient(90deg, #C9A227, #E8B33A);
  border-radius: 7px;
  transition: width 0.5s ease;
}
.exp-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #1C1C24;
  font-weight: bold;
}

/* 快捷入口 */
.quick-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
  position: relative;
  z-index: 1;
}
.quick-card {
  background: #E8DCC2;
  border: 2px solid #C9A227;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  text-decoration: none;
  color: #1C1C24;
  transition: all 0.12s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
.quick-card:hover {
  transform: scale(0.97);
  box-shadow: 0 1px 4px rgba(0,0,0,0.12);
  border-color: #C0392B;
}
.quick-icon { font-size: 28px; margin-bottom: 6px; }
.quick-label {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 15px;
  font-weight: bold;
  letter-spacing: 0.06em;
}
.quick-value {
  font-size: 12px;
  color: #8A8577;
  margin-top: 2px;
}

/* 底部双栏 */
.bottom-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  position: relative;
  z-index: 1;
}
.fragments-card, .events-card {
  background: #E8DCC2;
  border: 2px solid #C9A227;
  border-radius: 8px;
  padding: 16px;
}
.section-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 16px;
  font-weight: bold;
  letter-spacing: 0.06em;
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(201,162,39,0.3);
}
.fragment-list { display: flex; flex-direction: column; gap: 8px; }
.fragment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.frag-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.frag-name { flex: 1; }
.frag-count {
  font-weight: bold;
  color: #C9A227;
  font-family: Georgia, serif;
}
.empty-hint {
  font-size: 13px;
  color: #8A8577;
  text-align: center;
  padding: 12px;
}
.event-item {
  padding: 8px 0;
  border-bottom: 1px solid rgba(28,28,36,0.06);
}
.event-name {
  font-weight: bold;
  font-size: 14px;
}
.event-desc {
  font-size: 12px;
  color: #4A4A5A;
}

@media (max-width: 640px) {
  .quick-grid { grid-template-columns: repeat(2, 1fr); }
  .bottom-row { grid-template-columns: 1fr; }
}
</style>
