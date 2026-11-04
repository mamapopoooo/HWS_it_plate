<template>
  <div class="v3-gacha">
    <!-- 水墨山水背景 -->
    <div class="bg-scene">
      <div class="cloud cloud-1"></div>
      <div class="cloud cloud-2"></div>
      <div class="mountain"></div>
    </div>

    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">求签</h1>
      <p class="page-subtitle">心诚则灵，签文天定</p>
    </div>

    <!-- 积分余额 -->
    <div class="balance-bar">
      <span class="balance-label">积分余额</span>
      <span class="balance-value">{{ pointsStore.totalPoints }} 💰</span>
    </div>

    <!-- 三支玉简 -->
    <div class="sign-tubes">
      <!-- 单签 -->
      <div
        :class="['tube', { disabled: !canAfford(singlePrice) || drawing }]"
        @click="handleDraw(1)"
      >
        <div class="tube-visual single">
          <div class="tube-rod"></div>
          <div class="tube-tip"></div>
        </div>
        <div class="tube-label">单签</div>
        <div class="tube-price">
          <span v-if="gradeCoef < 1" class="price-original">{{ ECONOMY.gacha.single }}💰</span>
          {{ singlePrice }}💰
        </div>
      </div>

      <!-- 十连 -->
      <div
        :class="['tube', { disabled: !canAfford(tenPrice) || drawing }]"
        @click="handleDraw(10)"
      >
        <div class="tube-visual ten">
          <div class="tube-rod"></div>
          <div class="tube-tip"></div>
        </div>
        <div class="tube-label">十连</div>
        <div class="tube-price">
          <span v-if="gradeCoef < 1" class="price-original">{{ ECONOMY.gacha.ten }}💰</span>
          {{ tenPrice }}💰
        </div>
        <div class="tube-save" v-if="gradeCoef < 1">
          省 {{ ECONOMY.gacha.ten - tenPrice }}💰
        </div>
      </div>

      <!-- 概率公示 -->
      <div class="tube rates-tube" @click="showRates = !showRates">
        <div class="tube-visual info">
          <div class="rates-icon">☰</div>
        </div>
        <div class="tube-label">概率</div>
        <div class="tube-price">公示</div>
      </div>
    </div>

    <!-- 保底进度 -->
    <div class="pity-section">
      <div class="pity-item">
        <span class="pity-dot" style="background: #7FA88A"></span>
        <span class="pity-text">距八卦保底还需 <strong>{{ pityToTier2 }}</strong> 抽</span>
      </div>
      <div class="pity-item">
        <span class="pity-dot" style="background: #C9A227"></span>
        <span class="pity-text">距四象保底还需 <strong>{{ pityToTier3 }}</strong> 抽</span>
      </div>
    </div>

    <!-- 概率公示面板 -->
    <div v-if="showRates" class="rates-panel">
      <div class="scroll-frame">
        <div class="scroll-top"></div>
        <div class="scroll-body">
          <h3 class="rates-title">签文概率</h3>
          <div v-if="ratesLoading" class="rates-loading">加载中...</div>
          <div v-else-if="ratesError" class="rates-error">{{ ratesError }}</div>
          <div v-else class="rates-list">
            <div v-for="tier in ratesTiers" :key="tier.tier" class="rate-row">
              <span class="rate-dot" :style="{ background: tier.color }"></span>
              <span class="rate-name">{{ tier.name }}</span>
              <span class="rate-pct">{{ tier.rate }}</span>
            </div>
          </div>
        </div>
        <div class="scroll-bottom"></div>
      </div>
    </div>

    <!-- 抽签动画 + 结果展示 -->
    <div v-if="hasResults" :class="['results-section', { 'sign-reveal': showReveal }]">
      <div class="results-grid" :class="'count-' + lastCount">
        <div
          v-for="(r, i) in results"
          :key="i"
          :class="['result-card', 'tier-' + r.tier]"
          :style="{ animationDelay: (i * 0.08) + 's' }"
        >
          <div class="card-bezel" :style="{ borderColor: tierColor(r.tier) }">
            <div class="card-tier-tag" :style="{ background: tierColor(r.tier) }">
              {{ tierName(r.tier) }}
            </div>
            <div class="card-glyph" :style="{ color: tierColor(r.tier) }">
              {{ trigramGlyphs(r.trigram) }}
            </div>
            <div class="card-name">{{ r.name }}</div>
            <div class="card-trigram">{{ trigramName(r.trigram) }}</div>
            <div v-if="r.isNew" class="card-new">新获</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 加载提示 -->
    <div v-if="drawing" class="draw-overlay">
      <div class="draw-anim">
        <div class="draw-circle"></div>
        <div class="draw-text">签文展开中...</div>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="drawError" class="error-toast" @click="drawError = ''">
      {{ drawError }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGameStore } from '@/stores/game'
import { useAuthStore } from '@/stores/auth'
import { usePointsStore } from '@/stores/points'
import { v3Gacha } from '@/api/v3'
import { ECONOMY, tierName, trigramGlyphs, getTrigram } from '@/config/gameConfig'

const gameStore = useGameStore()
const authStore = useAuthStore()
const pointsStore = usePointsStore()

// --- 状态 ---
const results = ref<any[]>([])
const lastCount = ref(1)
const drawing = ref(false)
const showReveal = ref(false)
const showRates = ref(false)
const ratesLoading = ref(false)
const ratesError = ref('')
const ratesTiers = ref<any[]>([])
const drawError = ref('')
const pityToTier2 = ref(20)
const pityToTier3 = ref(60)

// --- 计算 ---
const hasResults = computed(() => results.value.length > 0)

const gradeCoef = computed(() => {
  const grade = String(authStore.user?.grade || 6)
  return (ECONOMY.gradeCoef as Record<string, number>)[grade] ?? 1
})

const singlePrice = computed(() => Math.max(1, Math.round(ECONOMY.gacha.single * gradeCoef.value)))
const tenPrice = computed(() => Math.max(1, Math.round(ECONOMY.gacha.ten * gradeCoef.value)))

function canAfford(price: number): boolean {
  return pointsStore.totalPoints >= price
}

const TIER_COLORS: Record<number, string> = {
  1: '#8A8577',   // 万象 — stone
  2: '#7FA88A',   // 八卦 — jade
  3: '#C9A227',   // 四象 — gold
  4: '#2E5C8A',   // 太极 — stone-blue
}

function tierColor(tier: number): string {
  return TIER_COLORS[tier] || '#8A8577'
}

function trigramName(code: string): string {
  if (!code) return ''
  if (code === 'all') return '全属'
  return code
    .split(',')
    .map(c => getTrigram(c)?.name || c)
    .join(' + ')
}

// --- 抽签 ---
async function handleDraw(count: number) {
  const price = count === 1 ? singlePrice.value : tenPrice.value
  if (!canAfford(price) || drawing.value) return

  drawing.value = true
  showReveal.value = false
  drawError.value = ''

  // 等动画帧后显示加载态
  await new Promise(r => setTimeout(r, 50))

  try {
    const data = await v3Gacha.draw(count)
    results.value = data.results || []
    lastCount.value = count

    // 更新保底进度
    if (data.pityCount !== undefined) {
      gameStore.pityCount = data.pityCount
    }
    pityToTier2.value = Math.max(0, ECONOMY.gacha.pityTier2 - ((data.pityCount || 0) % ECONOMY.gacha.pityTier2))
    pityToTier3.value = Math.max(0, ECONOMY.gacha.pityTier3 - ((data.pityCount || 0) % ECONOMY.gacha.pityTier3))

    // 刷新积分
    await pointsStore.loadPoints()

    // 触发签文展开动画
    drawing.value = false
    await nextTick()
    showReveal.value = true
  } catch (e: any) {
    drawError.value = e.message || '求签失败，请重试'
    drawing.value = false
  }
}

// --- 概率公示 ---
async function loadRates() {
  ratesLoading.value = true
  ratesError.value = ''
  try {
    const data = await v3Gacha.getRates()
    const rates = data.rates || data
    // 将 rates 映射为展示列表
    if (Array.isArray(rates)) {
      ratesTiers.value = rates.map((r: any) => ({
        tier: r.tier,
        name: tierName(r.tier),
        color: tierColor(r.tier),
        rate: typeof r.rate === 'number' ? (r.rate * 100).toFixed(1) + '%' : r.rate,
      }))
    } else {
      // 回落：从本地配置构建
      ratesTiers.value = [
        { tier: 1, name: '万象', color: TIER_COLORS[1], rate: '70.0%' },
        { tier: 2, name: '八卦', color: TIER_COLORS[2], rate: '22.0%' },
        { tier: 3, name: '四象', color: TIER_COLORS[3], rate: '6.5%' },
        { tier: 4, name: '太极', color: TIER_COLORS[4], rate: '1.5%' },
      ]
    }
  } catch (e: any) {
    ratesError.value = e.message || '加载失败'
    // 回落本地配置
    ratesTiers.value = [
      { tier: 1, name: '万象', color: TIER_COLORS[1], rate: '70.0%' },
      { tier: 2, name: '八卦', color: TIER_COLORS[2], rate: '22.0%' },
      { tier: 3, name: '四象', color: TIER_COLORS[3], rate: '6.5%' },
      { tier: 4, name: '太极', color: TIER_COLORS[4], rate: '1.5%' },
    ]
  } finally {
    ratesLoading.value = false
  }
}

// --- 辅助 ---
function nextTick() {
  return new Promise(r => setTimeout(r, 16))
}

onMounted(async () => {
  await gameStore.loadConfig()
  await pointsStore.loadPoints()
  loadRates()
})
</script>

<style scoped>
.v3-gacha {
  position: relative;
  min-height: 100vh;
  padding: 20px;
  font-family: 'Songti SC', 'STSong', 'Noto Serif SC', Georgia, serif;
  color: #1C1C24;
  background: #F2E8D5;
  overflow-x: hidden;
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

/* ===== 积分余额 ===== */
.balance-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #E8DCC2;
  border: 2px solid #C9A227;
  border-radius: 8px;
  padding: 10px 16px;
  margin-bottom: 20px;
  position: relative;
  z-index: 1;
}
.balance-label {
  font-size: 14px;
  color: #4A4A5A;
}
.balance-value {
  font-family: Georgia, serif;
  font-size: 18px;
  font-weight: bold;
  color: #C9A227;
}

/* ===== 玉简选项 ===== */
.sign-tubes {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 20px;
  position: relative;
  z-index: 1;
}
.tube {
  flex: 1;
  max-width: 140px;
  background: #E8DCC2;
  border: 2px solid #C9A227;
  border-radius: 10px;
  padding: 16px 8px 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
}
.tube:hover:not(.disabled) {
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(0,0,0,0.1);
  border-color: #C0392B;
}
.tube:active:not(.disabled) {
  transform: translateY(0);
}
.tube.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* 玉简图形 */
.tube-visual {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 10px;
  height: 64px;
  justify-content: flex-end;
}
.tube-rod {
  width: 8px;
  border-radius: 4px 4px 2px 2px;
  background: linear-gradient(to bottom, #C9A227, #8B6914);
  transition: height 0.3s ease;
}
.tube-visual.single .tube-rod { height: 40px; }
.tube-visual.ten .tube-rod { height: 52px; }
.tube-tip {
  width: 14px;
  height: 6px;
  background: #C0392B;
  border-radius: 2px;
  margin-top: -1px;
}
.tube-visual.info {
  justify-content: center;
}
.rates-icon {
  font-size: 32px;
  color: #C9A227;
  line-height: 1;
}

.tube-label {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 16px;
  font-weight: bold;
  letter-spacing: 0.08em;
  color: #1C1C24;
  margin-bottom: 4px;
}
.tube-price {
  font-family: Georgia, serif;
  font-size: 14px;
  color: #4A4A5A;
}
.price-original {
  text-decoration: line-through;
  color: #8A8577;
  font-size: 12px;
  margin-right: 4px;
}
.tube-save {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #C0392B;
  color: white;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: bold;
}

/* ===== 保底进度 ===== */
.pity-section {
  background: #E8DCC2;
  border: 2px solid #C9A227;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  z-index: 1;
}
.pity-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.pity-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.pity-text {
  color: #4A4A5A;
}
.pity-text strong {
  font-family: Georgia, serif;
  color: #1C1C24;
  font-size: 16px;
}

/* ===== 概率公示面板 ===== */
.rates-panel {
  margin-bottom: 20px;
  position: relative;
  z-index: 1;
  animation: fadeSlideIn 0.3s ease;
}
.scroll-frame {
  position: relative;
}
.scroll-top, .scroll-bottom {
  height: 14px;
  background: linear-gradient(to bottom, #8B6914, #C9A227, #8B6914);
  border-radius: 7px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
.scroll-body {
  background: #E8DCC2;
  border-left: 3px solid #C9A227;
  border-right: 3px solid #C9A227;
  padding: 16px 20px;
}
.rates-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 18px;
  font-weight: bold;
  letter-spacing: 0.08em;
  text-align: center;
  margin: 0 0 12px;
  color: #1C1C24;
}
.rates-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rate-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(28,28,36,0.06);
}
.rate-row:last-child { border-bottom: none; }
.rate-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}
.rate-name {
  flex: 1;
  font-size: 14px;
}
.rate-pct {
  font-family: Georgia, serif;
  font-size: 15px;
  font-weight: bold;
  color: #1C1C24;
}
.rates-loading, .rates-error {
  text-align: center;
  padding: 12px;
  font-size: 14px;
  color: #8A8577;
}
.rates-error { color: #C0392B; }

/* ===== 抽签结果 ===== */
.results-section {
  position: relative;
  z-index: 1;
  margin-bottom: 20px;
}
.results-section.sign-reveal .result-card {
  animation: signUnfurl 0.5s ease both;
}
.results-grid {
  display: grid;
  gap: 12px;
}
.results-grid.count-1 {
  grid-template-columns: 1fr;
  max-width: 240px;
  margin: 0 auto;
}
.results-grid.count-10 {
  grid-template-columns: repeat(5, 1fr);
}

@keyframes signUnfurl {
  0% {
    opacity: 0;
    transform: scaleY(0.3) scaleX(0.8);
    filter: blur(4px);
  }
  60% {
    opacity: 1;
    transform: scaleY(1.05) scaleX(1.02);
    filter: blur(0);
  }
  100% {
    opacity: 1;
    transform: scaleY(1) scaleX(1);
    filter: blur(0);
  }
}

.result-card {
  background: #E8DCC2;
  border-radius: 10px;
  overflow: hidden;
  opacity: 0;
}
.card-bezel {
  border: 3px solid;
  border-radius: 10px;
  padding: 16px 8px;
  text-align: center;
  position: relative;
  background: linear-gradient(135deg, #F2E8D5 0%, #E8DCC2 100%);
}
.card-tier-tag {
  position: absolute;
  top: 6px;
  left: 6px;
  padding: 2px 8px;
  border-radius: 3px;
  color: white;
  font-size: 10px;
  font-weight: bold;
  letter-spacing: 0.04em;
}
.card-glyph {
  font-size: 36px;
  line-height: 1;
  margin: 8px 0 6px;
}
.card-name {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 16px;
  font-weight: bold;
  color: #1C1C24;
  letter-spacing: 0.06em;
  margin-bottom: 2px;
}
.card-trigram {
  font-size: 12px;
  color: #8A8577;
}
.card-new {
  position: absolute;
  top: 6px;
  right: 6px;
  background: #C0392B;
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: bold;
}

/* ===== 抽签加载遮罩 ===== */
.draw-overlay {
  position: fixed;
  inset: 0;
  background: rgba(242,232,213,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}
.draw-anim {
  text-align: center;
}
.draw-circle {
  width: 60px;
  height: 60px;
  border: 4px solid #E8DCC2;
  border-top-color: #C9A227;
  border-radius: 50%;
  margin: 0 auto 16px;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.draw-text {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 18px;
  color: #4A4A5A;
  letter-spacing: 0.1em;
}

/* ===== 错误提示 ===== */
.error-toast {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  background: #C0392B;
  color: white;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 60;
  cursor: pointer;
  animation: fadeSlideIn 0.3s ease;
}

@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ===== 响应式 ===== */
@media (max-width: 640px) {
  .sign-tubes {
    gap: 8px;
  }
  .tube {
    max-width: none;
    padding: 12px 6px 10px;
  }
  .results-grid.count-10 {
    grid-template-columns: repeat(5, 1fr);
    gap: 8px;
  }
  .card-glyph {
    font-size: 28px;
  }
  .card-name {
    font-size: 13px;
  }
}

@media (max-width: 400px) {
  .results-grid.count-10 {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
