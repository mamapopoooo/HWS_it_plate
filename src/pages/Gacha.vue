<script setup lang="ts">
/**
 * 求签（抽卡）页面
 *
 * 服务端权威：结果与扣款由 `drawWithReceipt` 一次返回，页面**只展示回执**，
 * 不本地随机、不预扣钱包、失败不回落、不自动重试（Codex 2026-11-13 指令）。
 * 失败或超时会提示"待核对"——因为请求可能已在服务端生效。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import GachaAnimation from '@/components/gacha/GachaAnimation.vue'
import { ECONOMY, getPet, getTier, tierName, type PetTemplate } from '@/config/gameConfig'
import { drawPrice, pityProgress, rateTable } from '@/utils/gacha'
import { drawWithReceipt, fetchOwned, fetchProfile, fetchWallet } from '@/api/adapter'

const router = useRouter()

/** 展示模型：服务端只回 tier/petId/isNew/fragments，名字与注音从宠物库取 */
interface Shown {
  pet: PetTemplate
  tier: number
  isNew: boolean
  fragments: number
}

const grade = ref<6 | 7>(6)
const wallet = ref(0)
const fragments = ref(0)
const pulls = ref(0)
const owned = ref<Set<string>>(new Set())
const busy = ref(false)
const error = ref('')
/** 请求未确认：可能已扣款/已发放，必须让用户去核对，不能当失败重试 */
const pendingCheck = ref(false)

onMounted(async () => {
  const [profile, ownedMap, w] = await Promise.all([fetchProfile(), fetchOwned(), fetchWallet()])
  grade.value = profile.grade
  owned.value = new Set(Object.keys(ownedMap))
  wallet.value = w.points
  fragments.value = w.shards
})

const results = ref<Shown[]>([])
const playing = ref<Shown | null>(null)

const prices = computed(() => ({
  single: drawPrice('single', grade.value),
  ten: drawPrice('ten', grade.value),
}))

const pity = computed(() => pityProgress(pulls.value))
const rates = computed(() => rateTable())
const ownedCount = computed(() => owned.value.size)

/** 十连时把最高品阶的那只拿出来演出 */
function bestOf(list: Shown[]): Shown {
  return list.reduce((best, item) => (item.tier > best.tier ? item : best), list[0])
}

function toShown(rows: Array<{ tier: number; petId: string; isNew: boolean; fragments: number }>): Shown[] {
  const out: Shown[] = []
  for (const r of rows) {
    const pet = getPet(r.petId)
    if (!pet) continue // 服务端返回了库外 id，宁可少显示也不崩
    out.push({ pet, tier: r.tier, isNew: r.isNew, fragments: r.fragments })
  }
  return out
}

async function play(kind: 'single' | 'ten') {
  if (busy.value || playing.value) return
  const cost = kind === 'single' ? prices.value.single : prices.value.ten
  if (wallet.value < cost) {
    error.value = '灵石不足，去找老师加分吧'
    return
  }

  busy.value = true
  error.value = ''
  pendingCheck.value = false
  try {
    const receipt = await drawWithReceipt(kind)
    // 一切以回执为准：余额、累计抽数、结果
    wallet.value = receipt.points
    pulls.value = receipt.pulls
    const shown = toShown(receipt.results)
    if (shown.length === 0) {
      pendingCheck.value = true
      error.value = '回执里没有可识别的宠物，请到图鉴核对是否已发放'
      return
    }
    results.value = shown
    for (const r of shown) owned.value.add(r.pet.id)
    playing.value = bestOf(shown)
  } catch {
    // 超时/网络错误：不重试、不本地回落
    pendingCheck.value = true
    error.value = '请求未确认：可能已扣款或已发放，请到「图鉴 / 封神榜」核对后再操作'
  } finally {
    busy.value = false
  }
}

function onDone() {
  playing.value = null
}

function back() {
  void router.push('/lobby')
}

function accentOf(tier: number): string {
  return getTier(tier)?.bezelColor ?? '#858585'
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
      <div class="gk__pity-note">已抽 <b class="num">{{ pulls }}</b> 次 · 太极无保底（靠两仪活动）</div>
    </section>

    <!-- 主操作 -->
    <section class="gk__actions">
      <button
        class="gw-seal gw-seal--primary gk__draw"
        :disabled="busy || !!playing || wallet < prices.single"
        @click="play('single')"
      >
        {{ busy ? '开签中…' : '单签' }}<span class="gw-seal__hint">{{ prices.single }} 灵石</span>
      </button>
      <button
        class="gw-seal gk__draw"
        :disabled="busy || !!playing || wallet < prices.ten"
        @click="play('ten')"
      >
        {{ busy ? '开签中…' : '十连' }}<span class="gw-seal__hint">{{ prices.ten }} 灵石 · 省 5</span>
      </button>
      <button class="gw-seal gk__draw" disabled>祈福（待开放）</button>
    </section>

    <!-- 请求未确认 / 余额不足等提示：不重试、不回落，让用户去核对 -->
    <p v-if="error" class="gk__err" :class="{ 'gk__err--pending': pendingCheck }">
      {{ error }}
      <span v-if="pendingCheck">（未自动重试，避免重复扣款）</span>
    </p>

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
  border: 1px solid rgba(160, 160, 160, 0.45);
  background: rgba(160, 160, 160, 0.12);
  color: #696969;
  white-space: nowrap;
}
.gk__shard {
  border-color: rgba(101, 101, 101, 0.4);
  background: rgba(101, 101, 101, 0.1);
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
  background: linear-gradient(90deg, var(--gold), #c6c6c6);
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
.gk__err {
  margin: 10px 0 0;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.7;
  color: #1f1f1f;
  background: rgba(31, 31, 31, 0.06);
  border-left: 3px solid #1f1f1f;
  border-radius: var(--r-sm);
}
.gk__err--pending {
  background: rgba(31, 31, 31, 0.1);
  font-weight: 600;
}
.gk__empty {
  padding: 24px;
  text-align: center;
  font-size: 12px;
  color: var(--ink-3);
  background: rgba(255, 253, 246, 0.5);  border: 1px dashed rgba(28, 28, 36, 0.2);
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
  color: #f7f7f7;
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
