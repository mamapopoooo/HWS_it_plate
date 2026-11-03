<script setup lang="ts">
/**
 * 课业（任务，P4）
 * 任务定义来自 seeds/quests.json；进度暂为占位，M2 接 /api/v2/quests/daily|weekly。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { QUESTS, rewardText } from '@/config/contentConfig'
import { claimQuest, fetchQuests, fetchWallet } from '@/api/adapter'

const router = useRouter()

/** 进度与领取状态：由 adapter 填充（真接口优先，未就绪回落占位） */
const progress = ref<Record<string, number>>({})
const claimed = ref<Record<string, boolean>>({})
const wallet = ref(0)

async function load() {
  const [list, w] = await Promise.all([fetchQuests(), fetchWallet()])
  const p: Record<string, number> = {}
  const c: Record<string, boolean> = {}
  for (const item of list) {
    p[item.questId] = item.progress
    c[item.questId] = item.claimed
  }
  progress.value = p
  claimed.value = c
  wallet.value = w.points
}

onMounted(load)

const daily = computed(() => QUESTS.filter((q) => q.type === 'daily'))
const weekly = computed(() => QUESTS.filter((q) => q.type === 'weekly'))

function done(id: string): boolean {
  const q = QUESTS.find((x) => x.id === id)
  return !!q && (progress.value[id] ?? 0) >= q.cond.value
}

function finishedCount(list: typeof QUESTS): number {
  return list.filter((q) => done(q.id)).length
}

async function claim(qid: string) {
  if (!done(qid) || claimed.value[qid]) return
  const q = QUESTS.find((x) => x.id === qid)
  if (!q) return
  claimed.value = { ...claimed.value, [qid]: true }
  const res = await claimQuest(qid)
  // 接口成功则以服务端余额为准；占位模式按配置里的奖励金额本地累加
  if (res.ok && res.points > 0) {
    wallet.value += res.points
  } else {
    wallet.value += q.reward.reduce((sum, r) => (r.item === 'points' ? sum + r.amount : sum), 0)
  }
}

function claimAll(list: typeof QUESTS) {
  void Promise.all(list.map((q) => claim(q.id)))
}

function back() {
  void router.push('/lobby')
}
</script>

<template>
  <div class="qz gw-paper">
    <header class="qz__head">
      <button class="qz__back" @click="back">← 大厅</button>
      <div class="qz__title">
        <h1>课业</h1>
        <p>每日零时刷新 · 每周一刷新</p>
      </div>
      <div class="qz__wallet">⛁ <b class="num">{{ wallet }}</b></div>
    </header>

    <main class="qz__body">
      <!-- 每日卷 -->
      <section class="gw-scroll qz__scroll">
        <div class="gw-scroll-head">
          <span>每日课业</span>
          <em class="num">刷新 12:34:56 · {{ finishedCount(daily) }}/{{ daily.length }}</em>
        </div>

        <div v-for="q in daily" :key="q.id" class="task" :class="{ 'is-done': done(q.id), 'is-claimed': claimed[q.id] }">
          <i class="task__dot" />
          <span class="task__name">{{ q.name }}</span>
          <span class="task__progress num">{{ Math.min(progress[q.id] ?? 0, q.cond.value) }}/{{ q.cond.value }}</span>
          <span class="task__reward">{{ rewardText(q.reward) }}</span>
          <button class="gw-seal task__btn" :disabled="!done(q.id) || claimed[q.id]" @click="claim(q.id)">
            {{ claimed[q.id] ? '已领' : done(q.id) ? '领取' : '未完成' }}
          </button>
        </div>

        <div class="qz__bar"><i :style="{ width: (finishedCount(daily) / daily.length) * 100 + '%' }" /></div>
        <div class="qz__ops">
          <button class="gw-seal gw-seal--primary" :disabled="finishedCount(daily) === 0" @click="claimAll(daily)">
            领取全部
          </button>
        </div>
      </section>

      <!-- 每周卷 -->
      <section class="gw-scroll qz__scroll">
        <div class="gw-scroll-head">
          <span>每周课业</span>
          <em class="num">{{ finishedCount(weekly) }}/{{ weekly.length }}</em>
        </div>

        <div v-for="q in weekly" :key="q.id" class="task" :class="{ 'is-done': done(q.id), 'is-claimed': claimed[q.id] }">
          <i class="task__dot" />
          <span class="task__name">{{ q.name }}</span>
          <span class="task__progress num">{{ Math.min(progress[q.id] ?? 0, q.cond.value) }}/{{ q.cond.value }}</span>
          <span class="task__reward">{{ rewardText(q.reward) }}</span>
          <button class="gw-seal task__btn" :disabled="!done(q.id) || claimed[q.id]" @click="claim(q.id)">
            {{ claimed[q.id] ? '已领' : done(q.id) ? '领取' : '未完成' }}
          </button>
        </div>

        <div class="qz__bar"><i :style="{ width: (finishedCount(weekly) / weekly.length) * 100 + '%' }" /></div>
        <div class="qz__ops">
          <button class="gw-seal" :disabled="finishedCount(weekly) === 0" @click="claimAll(weekly)">领取全部</button>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.qz {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}
.qz__head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(28, 28, 36, 0.18);
  box-shadow: 0 2px 10px rgba(28, 28, 36, 0.07);
}
.qz__back {
  padding: 8px 14px;
  font-family: var(--font-title);
  font-size: 13px;
  color: var(--ink);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.qz__title h1 {
  margin: 0;
  font-family: var(--font-title);
  font-size: 22px;
  letter-spacing: 0.18em;
}
.qz__title p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--ink-2);
}
.qz__wallet {
  padding: 6px 14px;
  font-size: 13px;
  color: #8a6a0b;
  border: 1px solid rgba(201, 162, 39, 0.45);
  background: rgba(201, 162, 39, 0.12);
  border-radius: var(--r-sm);
}

.qz__body {
  display: grid;
  gap: 18px;
  padding: 18px 20px 30px;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
}
.qz__scroll {
  padding: 14px 16px;
}

.task {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  font-size: 13px;
  color: var(--ink-2);
  border-bottom: 1px dashed rgba(28, 28, 36, 0.1);
}
.task__dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  border: 1px solid rgba(28, 28, 36, 0.35);
}
.task.is-done .task__dot {
  background: var(--stone-green);
  border-color: var(--stone-green);
  box-shadow: 0 0 6px rgba(62, 124, 89, 0.6);
}
.task__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--ink);
}
.task.is-done .task__name {
  color: var(--ink-2);
}
.task__progress {
  font-size: 11px;
  color: var(--ink-3);
}
.task__reward {
  font-size: 11px;
  font-weight: 700;
  color: var(--cinnabar);
  white-space: nowrap;
}
.task__btn {
  min-height: 30px;
  padding: 4px 12px;
  font-size: 12px;
}
.task.is-claimed {
  opacity: 0.6;
}

.qz__bar {
  height: 6px;
  margin-top: 10px;
  border-radius: 999px;
  background: rgba(28, 28, 36, 0.12);
  overflow: hidden;
}
.qz__bar > i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--stone-green), var(--jade));
  transition: width var(--d-base) var(--e-out);
}
.qz__ops {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

@media (max-width: 720px) {
  .qz__head {
    grid-template-columns: auto 1fr;
    gap: 8px;
    padding: 10px 12px;
  }
  .qz__body {
    grid-template-columns: 1fr;
    padding: 12px;
  }
  .task__reward {
    display: none;
  }
}
</style>
