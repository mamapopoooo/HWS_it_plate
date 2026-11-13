<script setup lang="ts">
/**
 * 活动（节气榜文）
 *
 * 定义来自 seeds/events.json；进行中/即将开始/已结束由日期推导，不写死。
 * 领奖走 adapter（POST /v2/events/:id/claim），未就绪时本地记一次。
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { EVENTS, eventPhase, rewardText, todayIso } from '@/config/contentConfig'
import type { EventDef } from '@/config/contentConfig'
import { fetchEvents } from '@/api/adapter'

const router = useRouter()

const events = ref<EventDef[]>(EVENTS)
const claimed = ref<Record<string, boolean>>({})
const activeFilter = ref<'active' | 'upcoming' | 'ended'>('active')

async function load() {
  const list = await fetchEvents()
  if (list.length > 0) events.value = list
}

void load()

const list = computed(() =>
  events.value
    .filter((e) => eventPhase(e) === activeFilter.value)
    .sort((a, b) => a.sortOrder - b.sortOrder),
)

const counts = computed(() => ({
  active: events.value.filter((e) => eventPhase(e) === 'active').length,
  upcoming: events.value.filter((e) => eventPhase(e) === 'upcoming').length,
  ended: events.value.filter((e) => eventPhase(e) === 'ended').length,
}))

const PHASE_NAME = { active: '进行中', upcoming: '即将开始', ended: '已结束' } as const

function claim(e: EventDef) {
  if (eventPhase(e) !== 'active' || claimed.value[e.id]) return
  claimed.value = { ...claimed.value, [e.id]: true }
}

function back() {
  void router.push('/lobby')
}
</script>

<template>
  <div class="ev gw-paper">
    <header class="ev__head">
      <button class="ev__back" @click="back">← 大厅</button>
      <div class="ev__title">
        <h1>节气榜文</h1>
        <p>今日 {{ todayIso() }} · 活动按日期自动上下架</p>
      </div>
      <div class="ev__tabs">
        <button :class="{ 'is-on': activeFilter === 'active' }" @click="activeFilter = 'active'">
          进行中 <b class="num">{{ counts.active }}</b>
        </button>
        <button :class="{ 'is-on': activeFilter === 'upcoming' }" @click="activeFilter = 'upcoming'">
          即将开始 <b class="num">{{ counts.upcoming }}</b>
        </button>
        <button :class="{ 'is-on': activeFilter === 'ended' }" @click="activeFilter = 'ended'">
          已结束 <b class="num">{{ counts.ended }}</b>
        </button>
      </div>
    </header>

    <main class="ev__body">
      <p v-if="list.length === 0" class="ev__empty">这个分类下暂时没有活动。</p>

      <article v-for="e in list" :key="e.id" class="card" :data-phase="eventPhase(e)">
        <div class="card__banner" :style="e.banner ? { backgroundImage: `url(${e.banner})` } : {}">
          <span class="card__phase">{{ PHASE_NAME[eventPhase(e)] }}</span>
        </div>

        <div class="card__body">
          <h2>{{ e.name }}</h2>
          <p class="card__desc">{{ e.desc }}</p>
          <div class="card__meta">
            <span class="num">{{ e.startDate }} ~ {{ e.endDate }}</span>
            <span v-if="e.reward.length > 0" class="card__reward">
              奖励：{{ rewardText(e.reward as never) }}
            </span>
          </div>
        </div>

        <div class="card__ops">
          <button
            class="gw-seal"
            :class="{ 'gw-seal--primary': eventPhase(e) === 'active' && !claimed[e.id] }"
            :disabled="eventPhase(e) !== 'active' || claimed[e.id] || e.reward.length === 0"
            @click="claim(e)"
          >
            {{
              eventPhase(e) === 'ended'
                ? '已结束'
                : eventPhase(e) === 'upcoming'
                  ? '未开始'
                  : claimed[e.id]
                    ? '已领取'
                    : e.reward.length === 0
                      ? '无奖励'
                      : '领取'
            }}
          </button>
        </div>
      </article>
    </main>
  </div>
</template>

<style scoped>
.ev {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding-bottom: 30px;
}

.ev__head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(28, 28, 36, 0.18);
  box-shadow: 0 2px 10px rgba(28, 28, 36, 0.07);
}
.ev__back {
  padding: 8px 14px;
  font-family: var(--font-title);
  font-size: 13px;
  color: var(--ink);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.ev__title h1 {
  margin: 0;
  font-family: var(--font-title);
  font-size: 22px;
  letter-spacing: 0.16em;
}
.ev__title p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--ink-2);
}
.ev__tabs {
  display: flex;
  gap: 4px;
  padding: 3px;
  background: rgba(251, 252, 250, 0.75);
  border: 1px solid rgba(28, 28, 36, 0.18);
  border-radius: 999px;
}
.ev__tabs button {
  padding: 5px 12px;
  font-family: var(--font-title);
  font-size: 12px;
  color: var(--ink-2);
  background: transparent;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}
.ev__tabs button.is-on {
  color: #f7f7f7;
  background: linear-gradient(180deg, #2b2b2b, var(--cinnabar-d));
}
.ev__tabs b {
  font-weight: 700;
}

.ev__body {
  display: grid;
  gap: 14px;
  padding: 18px 20px 0;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}
.ev__empty {
  grid-column: 1 / -1;
  padding: 30px;
  text-align: center;
  font-size: 13px;
  color: var(--ink-3);
}

.card {
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.2);
  border-radius: var(--r-md);
  overflow: hidden;
  box-shadow: var(--sh-inset), var(--sh-paper);
}
.card[data-phase='ended'] {
  opacity: 0.62;
}

/* 横幅位：图未到位时显示渐变占位 */
.card__banner {
  position: relative;
  height: 96px;
  background-image: linear-gradient(120deg, #cacaca, #a9a9a9);
  background-size: cover;
  background-position: center;
  border-bottom: 1px solid rgba(28, 28, 36, 0.14);
}
.card__phase {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 2px 10px;
  font-family: var(--font-title);
  font-size: 11px;
  color: #f7f7f7;
  background: rgba(71, 71, 71, 0.9);
  border-radius: 2px;
}
.card[data-phase='upcoming'] .card__phase {
  background: rgba(83, 83, 83, 0.9);
}
.card[data-phase='ended'] .card__phase {
  background: rgba(76, 76, 76, 0.85);
}

.card__body {
  flex: 1;
  padding: 12px 14px 6px;
}
.card__body h2 {
  margin: 0;
  font-family: var(--font-title);
  font-size: 17px;
  letter-spacing: 0.1em;
  color: var(--ink);
}
.card__desc {
  margin: 6px 0 8px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--ink-2);
}
.card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 11px;
  color: var(--ink-3);
}
.card__reward {
  color: var(--cinnabar);
}

.card__ops {
  display: flex;
  justify-content: flex-end;
  padding: 0 14px 12px;
}
.card__ops .gw-seal {
  min-height: 34px;
  padding: 5px 16px;
  font-size: 13px;
}

@media (max-width: 720px) {
  .ev__head {
    grid-template-columns: auto 1fr;
    gap: 8px;
    padding: 10px 12px;
  }
  .ev__tabs {
    grid-column: 1 / -1;
    justify-self: start;
  }
  .ev__body {
    grid-template-columns: 1fr;
    padding: 12px;
  }
}
</style>
