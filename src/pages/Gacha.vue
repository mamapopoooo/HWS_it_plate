<script setup lang="ts">
/**
 * 求签（抽卡）页面（P3）
 *
 * 数据：概率、保底、价格全部来自配置（utils/gacha.ts → seeds）。
 * 抽卡的随机与记账暂在本页（占位钱包），M2 换成 POST /api/v2/gacha/draw。
 */
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import GachaAnimation from '@/components/gacha/GachaAnimation.vue'
import { ECONOMY, getTier, tierName } from '@/config/gameConfig'
import { drawMany, drawOnce, drawPrice, pityProgress, rateTable, type DrawResult, type DrawState } from '@/utils/gacha'

const router = useRouter()

/** 占位：已持有（与图鉴保持一致的演示数据） */
const DEMO_OWNED = [
  'pet_jiuweihu',
  'pet_tiangou',
  'pet_huan',
  'pet_qitu',
  'pet_qianyang',
  'pet_changyou',
  'pet_baize',
  'pet_lushu',
  'pet_diting',
  'pet_baihu',
]

const grade = ref(6)
const wallet = ref(1250)
const fragments = ref(0)

const state = reactive<DrawState>({
  pulls: 0,
  owned: new Set<string>(DEMO_OWNED),
})

const results = ref<DrawResult[]>([])
const playing = ref<DrawResult | null>(null)

const prices = computed(() => ({
  single: drawPrice('single', grade.value),
  ten: drawPrice('ten', grade.value),
}))

const pity = computed(() => pityProgress(state.pulls))
const rates = computed(() => rateTable())
const ownedCount = computed(() => state.owned.size)

/** 十连时把最高品阶的那只拿出来演出 */
function bestOf(list: DrawResult[]): DrawResult {
  return list.reduce((best, item) => (item.tier > best.tier ? item : best), list[0])
}

function play(kind: 'single' | 'ten') {
  const cost = kind === 'single' ? prices.value.single : prices.value.ten
  if (wallet.value < cost || playing.value) return

  wallet.value -= cost
  const drawn = kind === 'single' ? [drawOnce(state)] : drawMany(state, 10)

  results.value = drawn
  fragments.value += drawn.reduce((sum, r) => sum + r.fragments, 0)
  playing.value = bestOf(drawn)
}

function onDone() {
  playing.value = null
}

function back() {
  void router.push('/lobby')
}

function accentOf(tier: number): string {
  return getTier(tier)?.bezelColor ?? '#8a8577'
}
</script>

<template>
  <div class="gk gw-paper">
    <header class="gk__head">
      <button class="gk__back" @click="back">← 大厅</button>
      <div class="gk__title">
        <h1>求签</h1>
        <p>卦象有灵，一签一缘 · 已收集 <b class="num">{{ ownedCount }}</b> 只</p>
      </div>
      <div class="gk__wallet">
        <span class="gk__coin">⛁ <b class="num">{{ wallet }}</b> 灵石</span>
        <span class="gk__shard">◈ <b class="num">{{ fragments }}</b> 灵纹碎片</span>
      </div>
    </header>

    <!-- 保底进度 -->
    <section class="gk__pity">
      <div class="gk__pity-item">
        <span>距「八卦」保底</span>
        <b class="num">{{ pity.toTier2 }}</b>
        <i class="gk__bar"><em :style="{ width: (100 - (pity.toTier2 / ECONOMY.gacha.pityTier2) * 100) + '%' }" /></i>
      </div>
      <div class="gk__pity-item">
        <span>距「四象」保底</span>
        <b class="num">{{ pity.toTier3 }}</b>
        <i class="gk__bar gk__bar--gold"><em :style="{ width: (100 - (pity.toTier3 / ECONOMY.gacha.pityTier3) * 100) + '%' }" /></i>
      </div>
      <div class="gk__pity-note">已抽 <b class="num">{{ state.pulls }}</b> 次 · 太极无保底（靠两仪活动）</div>
    </section>

    <!-- 主操作 -->
    <section class="gk__actions">
      <button class="gw-seal gw-seal--primary gk__draw" :disabled="wallet < prices.single || !!playing" @click="play('single')">
        单签<span class="gw-seal__hint">{{ prices.single }} 灵石</span>
      </button>
      <button class="gw-seal gk__draw" :disabled="wallet < prices.ten || !!playing" @click="play('ten')">
        十连<span class="gw-seal__hint">{{ prices.ten }} 灵石 · 省 5</span>
      </button>
      <button class="gw-seal gk__draw" disabled>祈福（待开放）</button>
    </section>

    <!-- 最近结果 -->
    <section class="gk__result">
      <h2 class="gk__sub">最近一签</h2>
      <div v-if="results.length === 0" class="gk__empty">还没有开签。点上方「单签」或「十连」。</div>
      <div v-else class="gk__grid">
        <div
          v-for="(r, i) in results"
          :key="r.pet.id + '-' + i"
          class="gk__card"
          :class="{ 'is-dup': !r.isNew }"
          :style="{ '--accent': accentOf(r.tier) }"
        >
          <span class="gk__tier">{{ tierName(r.tier) }}</span>
          <span class="gk__glyph">☯</span>
          <span class="gk__name">{{ r.pet.name }}</span>
          <span class="gk__pinyin">{{ r.pet.pinyin }}</span>
          <span class="gk__tag">{{ r.isNew ? '新获得' : `重复 +${r.fragments} 碎片` }}</span>
        </div>
      </div>
    </section>

    <!-- 概率公示 -->
    <section class="gk__rates">
      <h2 class="gk__sub">概率公示</h2>
      <div class="gk__rate-row">
        <span v-for="r in rates" :key="r.tier" class="gk__rate" :style="{ '--accent': r.color }">
          <i />{{ r.name }} <b class="num">{{ (r.rate * 100).toFixed(1) }}%</b>
        </span>
      </div>
      <p class="gk__fine">
        保底：{{ ECONOMY.gacha.pityTier2 }} 抽内必出「八卦」及以上，{{ ECONOMY.gacha.pityTier3 }} 抽内必出「四象」及以上；
        最高阶「无极」不进抽卡池，需集齐阴鱼与阳鱼后自行造物。
      </p>
    </section>

    <GachaAnimation
      v-if="playing"
      :tier="playing.tier"
      :tier-name="tierName(playing.tier)"
      :accent="accentOf(playing.tier)"
      :name="playing.pet.name"
      :pinyin="playing.pet.pinyin"
      @done="onDone"
    />
  </div>
</template>

<style scoped>
.gk {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 100dvh;
  padding-bottom: 28px;
}

/* ---------- 头部 ---------- */
.gk__head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(28, 28, 36, 0.18);
  box-shadow: 0 2px 10px rgba(28, 28, 36, 0.07);
}
.gk__back {
  padding: 8px 14px;
  font-family: var(--font-title);
  font-size: 13px;
  color: var(--ink);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.gk__title h1 {
  margin: 0;
  font-family: var(--font-title);
  font-size: 22px;
  letter-spacing: 0.18em;
}
.gk__title p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--ink-2);
}
.gk__title b {
  color: var(--cinnabar);
}
.gk__wallet {
  display: flex;
  gap: 8px;
  font-size: 12px;
}
.gk__coin,
.gk__shard {
  padding: 6px 12px;
  border-radius: var(--r-sm);
  border: 1px solid rgba(201, 162, 39, 0.45);
  background: rgba(201, 162, 39, 0.12);
  color: #8a6a0b;
  white-space: nowrap;
}
.gk__shard {
  border-color: rgba(62, 124, 89, 0.4);
  background: rgba(62, 124, 89, 0.1);
  color: var(--stone-green);
}

/* ---------- 保底 ---------- */
.gk__pity {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  align-items: center;
  padding: 0 20px;
}
.gk__pity-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--ink-2);
}
.gk__pity-item b {
  color: var(--cinnabar);
  font-weight: 700;
}
.gk__bar {
  display: block;
  width: 110px;
  height: 6px;
  border-radius: 999px;
  background: rgba(28, 28, 36, 0.12);
  overflow: hidden;
}
.gk__bar > em {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--stone-green), var(--jade));
  transition: width var(--d-base) var(--e-out);
}
.gk__bar--gold > em {
  background: linear-gradient(90deg, var(--gold), #e8c766);
}
.gk__pity-note {
  font-size: 11px;
  color: var(--ink-3);
}

/* ---------- 操作 ---------- */
.gk__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 0 20px;
}
.gk__draw {
  min-width: 140px;
}

/* ---------- 结果 ---------- */
.gk__result,
.gk__rates {
  padding: 0 20px;
}
.gk__sub {
  margin: 4px 0 10px;
  font-family: var(--font-title);
  font-size: 15px;
  letter-spacing: 0.12em;
  color: var(--ink);
  border-left: 3px solid var(--cinnabar);
  padding-left: 8px;
}
.gk__empty {
  padding: 24px;
  text-align: center;
  font-size: 12px;
  color: var(--ink-3);
  background: rgba(255, 253, 246, 0.5);
  border: 1px dashed rgba(28, 28, 36, 0.2);
  border-radius: var(--r-md);
}
.gk__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 10px;
}
.gk__card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 12px 8px 10px;
  text-align: center;
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.18);
  border-top: 3px solid var(--accent);
  border-radius: var(--r-md);
  box-shadow: var(--sh-inset), var(--sh-paper);
  animation: card-in var(--d-base) var(--e-back) both;
}
@keyframes card-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.96);
  }
}
.gk__card.is-dup {
  opacity: 0.72;
}
.gk__tier {
  padding: 1px 6px;
  font-family: var(--font-title);
  font-size: 10px;
  color: #f7efe0;
  background: var(--accent);
  border-radius: 2px;
}
.gk__glyph {
  font-size: 26px;
  line-height: 1.2;
  color: color-mix(in srgb, var(--accent) 65%, var(--ink));
}
.gk__name {
  font-family: var(--font-title);
  font-size: 14px;
  color: var(--ink);
}
.gk__pinyin {
  font-size: 10px;
  color: var(--ink-3);
}
.gk__tag {
  margin-top: 2px;
  font-size: 10px;
  color: var(--ink-2);
}

/* ---------- 概率 ---------- */
.gk__rate-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.gk__rate {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  font-size: 12px;
  color: var(--ink);
  background: rgba(255, 253, 246, 0.7);
  border: 1px solid rgba(28, 28, 36, 0.16);
  border-radius: 999px;
}
.gk__rate i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
}
.gk__rate b {
  color: var(--ink-2);
  font-weight: 700;
}
.gk__fine {
  margin: 10px 0 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--ink-3);
}

@media (max-width: 720px) {
  .gk__head {
    grid-template-columns: auto 1fr;
    gap: 10px;
    padding: 10px 12px;
  }
  .gk__wallet {
    grid-column: 1 / -1;
    justify-content: space-between;
  }
  .gk__actions,
  .gk__result,
  .gk__rates,
  .gk__pity {
    padding: 0 12px;
  }
  .gk__draw {
    flex: 1;
    min-width: 0;
  }
}
</style>
