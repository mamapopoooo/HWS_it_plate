<script setup lang="ts">
/**
 * 封神榜（排行榜，P4）
 *
 * 展示规则（00-总纲 §9）：前三 = 领奖台 + 角色放大立绘；4–7 = 全身缩小图；8+ = 只显示名字。
 * 名字格式：昵称 · 姓名；按年级分组；全部公开。
 * 数据暂为占位，M2 接 GET /api/v2/rankings/:id（metric 读 ranking_config）。
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

interface RankEntry {
  id: string
  nickname: string
  realname: string
  gender: 'male' | 'female'
  points: number
  power: number
  collection: number
  /** 收集率（0-1），用于收集榜 */
  rate: number
  me?: boolean
}

type Metric = 'points' | 'power' | 'collection'

const metric = ref<Metric>('points')
const grade = ref(6)

const METRICS: Array<{ key: Metric; name: string; unit: string }> = [
  { key: 'points', name: '积分榜', unit: '灵石' },
  { key: 'power', name: '战力榜', unit: '战力' },
  { key: 'collection', name: '收集榜', unit: '收集率' },
]

/** 占位数据（G6） */
const DEMO: RankEntry[] = [
  { id: 'u1', nickname: '小狐仙', realname: '李四', gender: 'female', points: 1250, power: 244, collection: 18, rate: 0.47, me: true },
  { id: 'u2', nickname: '玄鸟', realname: '王小二', gender: 'male', points: 1180, power: 268, collection: 22, rate: 0.58 },
  { id: 'u3', nickname: '云中君', realname: '张三', gender: 'male', points: 1120, power: 231, collection: 16, rate: 0.42 },
  { id: 'u4', nickname: '白露', realname: '赵六', gender: 'female', points: 1050, power: 198, collection: 14, rate: 0.37 },
  { id: 'u5', nickname: '南山雪', realname: '陈七', gender: 'female', points: 980, power: 187, collection: 13, rate: 0.34 },
  { id: 'u6', nickname: '小鱼干', realname: '周八', gender: 'male', points: 940, power: 176, collection: 12, rate: 0.32 },
  { id: 'u7', nickname: '青丘', realname: '吴九', gender: 'female', points: 905, power: 170, collection: 11, rate: 0.29 },
  { id: 'u8', nickname: '风息', realname: '郑十', gender: 'male', points: 860, power: 163, collection: 10, rate: 0.26 },
  { id: 'u9', nickname: '叶上秋', realname: '孙一', gender: 'female', points: 820, power: 152, collection: 9, rate: 0.24 },
  { id: 'u10', nickname: '雷泽', realname: '马二', gender: 'male', points: 760, power: 141, collection: 8, rate: 0.21 },
  { id: 'u11', nickname: '素问', realname: '朱三', gender: 'female', points: 700, power: 133, collection: 7, rate: 0.18 },
  { id: 'u12', nickname: '石中火', realname: '胡四', gender: 'male', points: 650, power: 120, collection: 6, rate: 0.16 },
]

/** G7 用同一份数据做小幅偏移，仅用于演示分组 */
const DEMO_G7: RankEntry[] = DEMO.map((e, i) => ({
  ...e,
  points: Math.max(50, Math.round(e.points * 0.62) + i * 7),
  power: Math.round(e.power * 0.95),
  collection: Math.max(1, e.collection - 2),
  rate: Math.max(0.03, e.rate - 0.05),
  me: i === 2,
}))

const rows = computed(() => (grade.value === 6 ? DEMO : DEMO_G7))

const sorted = computed(() => {
  const key = metric.value
  return [...rows.value].sort((a, b) => (key === 'collection' ? b.rate - a.rate : b[key] - a[key]))
})

const top3 = computed(() => sorted.value.slice(0, 3))
const mid = computed(() => sorted.value.slice(3, 7))
const rest = computed(() => sorted.value.slice(7))

/** 领奖台顺序：2 - 1 - 3 */
const podiumOrder = computed(() => [top3.value[1], top3.value[0], top3.value[2]].filter(Boolean))

const unit = computed(() => METRICS.find((m) => m.key === metric.value)?.unit ?? '')

function valueOf(e: RankEntry): string {
  if (metric.value === 'points') return `${e.points}`
  if (metric.value === 'power') return `${e.power}`
  return `${Math.round(e.rate * 100)}%`
}

function fullName(e: RankEntry): string {
  return `${e.nickname} · ${e.realname}`
}

function back() {
  void router.push('/lobby')
}
</script>

<template>
  <div class="rk gw-paper">
    <header class="rk__head">
      <button class="rk__back" @click="back">← 大厅</button>
      <div class="rk__title">
        <h1>封神榜</h1>
        <p>全部公开 · 按年级分组 · 名字为「昵称 · 姓名」</p>
      </div>
      <div class="rk__grades">
        <button :class="{ 'is-on': grade === 6 }" @click="grade = 6">G6</button>
        <button :class="{ 'is-on': grade === 7 }" @click="grade = 7">G7</button>
      </div>
    </header>

    <nav class="rk__tabs">
      <button
        v-for="m in METRICS"
        :key="m.key"
        :class="{ 'is-on': metric === m.key }"
        @click="metric = m.key"
      >
        {{ m.name }}
      </button>
    </nav>

    <!-- 前三：领奖台 -->
    <section class="podium">
      <div
        v-for="e in podiumOrder"
        :key="e.id"
        class="podium__item"
        :class="[`podium__item--${sorted.indexOf(e) + 1}`, { 'is-me': e.me }]"
      >
        <div class="podium__avatar" :class="`podium__avatar--${e.gender}`">
          {{ e.realname.slice(-1) }}
        </div>
        <div class="podium__name">{{ fullName(e) }}</div>
        <div class="podium__value num">{{ valueOf(e) }} <small>{{ unit }}</small></div>
        <div class="podium__medal">{{ ['🥇', '🥈', '🥉'][sorted.indexOf(e)] }}</div>
      </div>
    </section>

    <!-- 4–7：全身缩小图 -->
    <section class="mid">
      <div v-for="(e, i) in mid" :key="e.id" class="mid__row" :class="{ 'is-me': e.me }">
        <span class="mid__rank num">{{ i + 4 }}</span>
        <div class="mid__avatar" :class="`mid__avatar--${e.gender}`">{{ e.realname.slice(-1) }}</div>
        <div class="mid__info">
          <span class="mid__name">{{ fullName(e) }}</span>
          <span class="mid__sub">收集 {{ e.collection }} 只 · 战力 {{ e.power }}</span>
        </div>
        <span class="mid__value num">{{ valueOf(e) }} <small>{{ unit }}</small></span>
      </div>
    </section>

    <!-- 8+：只显示名字 -->
    <section class="rest">
      <div v-for="(e, i) in rest" :key="e.id" class="rest__row" :class="{ 'is-me': e.me }">
        <span class="rest__rank num">{{ i + 8 }}</span>
        <span class="rest__name">{{ fullName(e) }}</span>
        <span class="rest__value num">{{ valueOf(e) }}</span>
      </div>
    </section>

    <!-- 自己（长榜不丢自己） -->
    <section v-if="sorted.findIndex((e) => e.me) >= 7" class="me">
      <span class="me__rank num">我 · 第 {{ sorted.findIndex((e) => e.me) + 1 }} 名</span>
      <span class="me__name">{{ fullName(sorted.find((e) => e.me)!) }}</span>
      <span class="me__value num">{{ valueOf(sorted.find((e) => e.me)!) }} {{ unit }}</span>
    </section>

    <footer class="rk__foot">
      榜单每 {{ metric === 'points' ? '赛季' : '日' }}刷新 · 角色形象来自「皮肤」系统，未换装时显示基础形象
    </footer>
  </div>
</template>

<style scoped>
.rk {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 100dvh;
  padding-bottom: 40px;
}

/* ---------- 头部 ---------- */
.rk__head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(28, 28, 36, 0.18);
  box-shadow: 0 2px 10px rgba(28, 28, 36, 0.07);
}
.rk__back {
  padding: 8px 14px;
  font-family: var(--font-title);
  font-size: 13px;
  color: var(--ink);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.rk__title h1 {
  margin: 0;
  font-family: var(--font-title);
  font-size: 22px;
  letter-spacing: 0.18em;
}
.rk__title p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--ink-2);
}
.rk__grades {
  display: flex;
  gap: 4px;
  padding: 3px;
  background: rgba(255, 253, 246, 0.7);
  border: 1px solid rgba(28, 28, 36, 0.18);
  border-radius: 999px;
}
.rk__grades button {
  padding: 5px 16px;
  font-family: var(--font-title);
  font-size: 13px;
  color: var(--ink-2);
  background: transparent;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}
.rk__grades button.is-on {
  color: #f7efe0;
  background: linear-gradient(180deg, #ce4436, var(--cinnabar-d));
}

/* ---------- 榜单切换 ---------- */
.rk__tabs {
  display: flex;
  gap: 8px;
  padding: 0 20px;
}
.rk__tabs button {
  padding: 8px 18px;
  font-family: var(--font-title);
  font-size: 14px;
  letter-spacing: 0.08em;
  color: var(--ink-2);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.2);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.rk__tabs button.is-on {
  color: #f7efe0;
  background: linear-gradient(180deg, #ce4436, var(--cinnabar-d));
  border-color: var(--cinnabar-d);
}

/* ---------- 领奖台 ---------- */
.podium {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 18px;
  padding: 12px 20px 0;
}
.podium__item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 18px 18px;
  width: 168px;
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.2);
  border-radius: var(--r-lg) var(--r-lg) 0 0;
  box-shadow: var(--sh-inset), var(--sh-paper);
}
/* 名次高度差 */
.podium__item--1 {
  padding-bottom: 30px;
  border-top: 4px solid var(--gold);
}
.podium__item--2 {
  padding-bottom: 22px;
  border-top: 4px solid #b8b8a8;
}
.podium__item--3 {
  border-top: 4px solid #b87333;
}

/* 角色放大立绘位（无美术时用姓氏印章代替，尺寸就是最终立绘的预留尺寸） */
.podium__avatar {
  display: grid;
  place-items: center;
  width: 120px;
  height: 120px;
  font-family: var(--font-title);
  font-size: 44px;
  color: #f7efe0;
  border-radius: 50%;
  box-shadow: inset 0 0 0 3px rgba(255, 253, 246, 0.4), 0 8px 18px rgba(28, 28, 36, 0.22);
}
.podium__avatar--male {
  background: linear-gradient(160deg, #3f6d8f, #24455c);
}
.podium__avatar--female {
  background: linear-gradient(160deg, #ce6772, #8e2a3f);
}
.podium__item--1 .podium__avatar {
  width: 140px;
  height: 140px;
  font-size: 52px;
  box-shadow: inset 0 0 0 3px rgba(255, 215, 0, 0.6), 0 0 26px rgba(201, 162, 39, 0.45);
}

.podium__name {
  font-family: var(--font-title);
  font-size: 14px;
  letter-spacing: 0.06em;
  color: var(--ink);
  text-align: center;
}
.podium__value {
  font-size: 15px;
  font-weight: 700;
  color: var(--cinnabar);
}
.podium__value small {
  font-size: 10px;
  color: var(--ink-3);
  font-weight: 400;
}
.podium__medal {
  position: absolute;
  top: -12px;
  right: 10px;
  font-size: 22px;
}

/* ---------- 4–7 ---------- */
.mid {
  display: grid;
  gap: 8px;
  padding: 0 20px;
}
.mid__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  background: rgba(255, 253, 246, 0.66);
  border: 1px solid rgba(28, 28, 36, 0.14);
  border-radius: var(--r-md);
}
.mid__rank {
  width: 22px;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink-2);
  text-align: center;
}
/* 全身缩小图位 80px */
.mid__avatar {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  font-family: var(--font-title);
  font-size: 18px;
  color: #f7efe0;
  border-radius: 50%;
  box-shadow: inset 0 0 0 2px rgba(255, 253, 246, 0.35);
}
.mid__avatar--male {
  background: linear-gradient(160deg, #3f6d8f, #24455c);
}
.mid__avatar--female {
  background: linear-gradient(160deg, #ce6772, #8e2a3f);
}
.mid__info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.mid__name {
  font-family: var(--font-title);
  font-size: 14px;
  color: var(--ink);
}
.mid__sub {
  font-size: 11px;
  color: var(--ink-3);
}
.mid__value {
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
}
.mid__value small {
  font-size: 10px;
  color: var(--ink-3);
  font-weight: 400;
}

/* ---------- 8+ ---------- */
.rest {
  display: grid;
  gap: 4px;
  padding: 0 20px;
  max-height: 260px;
  overflow-y: auto;
}
.rest__row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 14px;
  font-size: 12px;
  color: var(--ink-2);
  border-bottom: 1px dashed rgba(28, 28, 36, 0.12);
}
.rest__rank {
  width: 22px;
  text-align: center;
  color: var(--ink-3);
}
.rest__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rest__value {
  font-weight: 700;
  color: var(--ink-2);
}

/* 自己高亮 */
.is-me {
  background: rgba(201, 162, 39, 0.14);
  border-color: rgba(201, 162, 39, 0.5);
  box-shadow: inset 3px 0 0 var(--gold);
}
.rest__row.is-me {
  background: rgba(201, 162, 39, 0.12);
}

/* 底部固定的"我" */
.me {
  position: sticky;
  bottom: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 8px 20px 0;
  padding: 10px 16px;
  background: linear-gradient(180deg, #fff7e2, #f3e6c4);
  border: 1px solid var(--gold);
  border-radius: var(--r-md);
  box-shadow: 0 6px 18px rgba(201, 162, 39, 0.28);
}
.me__rank {
  font-size: 12px;
  font-weight: 700;
  color: var(--cinnabar);
}
.me__name {
  flex: 1;
  font-family: var(--font-title);
  font-size: 14px;
}
.me__value {
  font-weight: 700;
  color: var(--ink);
}

.rk__foot {
  padding: 0 20px;
  font-size: 11px;
  color: var(--ink-3);
}

@media (max-width: 720px) {
  .rk__head {
    grid-template-columns: auto 1fr;
    gap: 8px;
    padding: 10px 12px;
  }
  .rk__grades {
    grid-column: 1 / -1;
    justify-self: start;
  }
  .rk__tabs,
  .podium,
  .mid,
  .rest,
  .rk__foot {
    padding-left: 12px;
    padding-right: 12px;
  }
  .podium {
    gap: 8px;
  }
  .podium__item {
    width: 33%;
    padding: 10px 8px 14px;
  }
  .podium__avatar {
    width: 72px;
    height: 72px;
    font-size: 26px;
  }
  .podium__item--1 .podium__avatar {
    width: 84px;
    height: 84px;
    font-size: 30px;
  }
  .podium__name {
    font-size: 12px;
  }
  .me {
    margin: 8px 12px 0;
  }
}
</style>
