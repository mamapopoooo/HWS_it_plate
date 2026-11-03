<script setup lang="ts">
/**
 * 功名册（成就，P4）
 * 印章式徽章：未解锁灰化并给进度，解锁后朱砂上色 + 盖章动画。
 * 定义来自 seeds/achievements.json；解锁状态暂为占位。
 */
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ACHIEVEMENTS, rewardText } from '@/config/contentConfig'

const router = useRouter()

/** 分类（从数据里推导，加分类不用改代码） */
const categories = computed(() => {
  const map = new Map<string, string>()
  for (const a of ACHIEVEMENTS) map.set(a.category, CATEGORY_NAMES[a.category] ?? a.category)
  return [...map.entries()].map(([key, name]) => ({ key, name }))
})

const CATEGORY_NAMES: Record<string, string> = {
  battle: '斗法',
  growth: '养成',
  collect: '收集',
  special: '特殊',
}

const activeCat = ref(categories.value[0]?.key ?? 'battle')

/** 占位：已解锁与进度 */
const unlocked = reactive<Record<string, boolean>>({
  ach_first_win: true,
  ach_streak5: true,
  ach_collect20: false,
  ach_draw50: true,
})

const progress = reactive<Record<string, number>>({
  ach_streak5: 5,
  ach_battle100: 45,
  ach_collect20: 18,
  ach_collect_all: 18,
  ach_draw50: 50,
  ach_awaken4: 1,
  ach_class_top3: 6,
})

const list = computed(() => ACHIEVEMENTS.filter((a) => a.category === activeCat.value))

const total = computed(() => ACHIEVEMENTS.length)
const doneCount = computed(() => ACHIEVEMENTS.filter((a) => unlocked[a.id]).length)
const percent = computed(() => Math.round((doneCount.value / total.value) * 100))

/** 解锁动画：刚点开的那个 */
const animating = ref<string | null>(null)

function toggle(id: string) {
  if (unlocked[id]) return
  unlocked[id] = true
  animating.value = id
  setTimeout(() => (animating.value = null), 700)
}

function back() {
  void router.push('/lobby')
}
</script>

<template>
  <div class="ach gw-paper">
    <header class="ach__head">
      <button class="ach__back" @click="back">← 大厅</button>
      <div class="ach__title">
        <h1>功名册</h1>
        <p>已完成 <b class="num">{{ doneCount }}</b> / {{ total }}（{{ percent }}%）</p>
      </div>
      <div class="ach__ring" :style="{ '--p': percent + '%' }">
        <span class="num">{{ percent }}%</span>
      </div>
    </header>

    <nav class="ach__tabs">
      <button
        v-for="c in categories"
        :key="c.key"
        :class="{ 'is-on': c.key === activeCat }"
        @click="activeCat = c.key"
      >
        {{ c.name }}
      </button>
    </nav>

    <main class="ach__grid">
      <button
        v-for="a in list"
        :key="a.id"
        class="seal"
        :class="{ 'is-locked': !unlocked[a.id], 'is-anim': animating === a.id }"
        :title="a.desc"
        @click="toggle(a.id)"
      >
        <span class="seal__body">
          <span class="seal__glyph">{{ a.seal }}</span>
        </span>
        <span class="seal__name">{{ a.name }}</span>
        <span class="seal__desc">{{ a.desc }}</span>
        <span class="seal__foot">
          <span v-if="!unlocked[a.id]" class="num">
            {{ Math.min(progress[a.id] ?? 0, a.cond.value) }}/{{ a.cond.value }}
          </span>
          <span v-else class="seal__reward">{{ rewardText(a.reward) }}</span>
        </span>
      </button>
    </main>

    <footer class="ach__foot">
      未解锁的成就会显示进度；点亮后不可撤销，印在功名册上。
    </footer>
  </div>
</template>

<style scoped>
.ach {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding-bottom: 28px;
}

.ach__head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(28, 28, 36, 0.18);
  box-shadow: 0 2px 10px rgba(28, 28, 36, 0.07);
}
.ach__back {
  padding: 8px 14px;
  font-family: var(--font-title);
  font-size: 13px;
  color: var(--ink);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.ach__title h1 {
  margin: 0;
  font-family: var(--font-title);
  font-size: 22px;
  letter-spacing: 0.18em;
}
.ach__title p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--ink-2);
}
.ach__title b {
  color: var(--cinnabar);
}

/* 总完成度：环形进度 */
.ach__ring {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  font-size: 12px;
  color: var(--ink);
  background:
    conic-gradient(var(--stone-green) var(--p), rgba(28, 28, 36, 0.12) 0) border-box;
  -webkit-mask: radial-gradient(circle, transparent 58%, #000 60%);
  mask: radial-gradient(circle, transparent 58%, #000 60%);
}

.ach__tabs {
  display: flex;
  gap: 8px;
  padding: 12px 20px 0;
}
.ach__tabs button {
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
.ach__tabs button.is-on {
  color: #f7efe0;
  background: linear-gradient(180deg, #ce4436, var(--cinnabar-d));
  border-color: var(--cinnabar-d);
}

.ach__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 14px;
  padding: 18px 20px;
}

/* ---------- 印章徽章 ---------- */
.seal {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 14px 10px 12px;
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.2);
  border-radius: var(--r-md);
  box-shadow: var(--sh-inset), var(--sh-paper);
  cursor: pointer;
  transition: transform var(--d-quick) var(--e-out), box-shadow var(--d-quick);
}
.seal:hover {
  transform: translateY(-3px);
  box-shadow: var(--sh-lift);
}

.seal__body {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 6px;
  color: #f7efe0;
  background: linear-gradient(160deg, #ce4436, var(--cinnabar-d));
  box-shadow: inset 0 0 0 2px rgba(247, 239, 224, 0.4), 0 4px 10px rgba(142, 42, 32, 0.3);
  transform: rotate(-3deg);
}
.seal__glyph {
  font-family: var(--font-title);
  font-size: 28px;
  line-height: 1;
}

.seal__name {
  margin-top: 4px;
  font-family: var(--font-title);
  font-size: 14px;
  letter-spacing: 0.06em;
  color: var(--ink);
}
.seal__desc {
  font-size: 11px;
  line-height: 1.4;
  color: var(--ink-3);
  text-align: center;
  min-height: 30px;
}
.seal__foot {
  font-size: 11px;
  color: var(--ink-2);
}
.seal__reward {
  color: var(--cinnabar);
  font-weight: 700;
}

/* 未解锁：灰化 + 虚线 */
.seal.is-locked .seal__body {
  color: #b9b2a2;
  background: linear-gradient(180deg, #efe9dc, #e2d8c4);
  box-shadow: inset 0 0 0 2px rgba(28, 28, 36, 0.12);
  filter: grayscale(1);
}
.seal.is-locked .seal__name {
  color: var(--ink-2);
}

/* 盖章动画 */
.seal.is-anim .seal__body {
  animation: stamp 600ms var(--e-back);
}
@keyframes stamp {
  0% {
    transform: rotate(0) scale(1.5);
    opacity: 0.4;
  }
  60% {
    transform: rotate(-6deg) scale(0.94);
    opacity: 1;
  }
  100% {
    transform: rotate(-3deg) scale(1);
  }
}

.ach__foot {
  padding: 0 20px;
  font-size: 11px;
  color: var(--ink-3);
}

@media (max-width: 720px) {
  .ach__head {
    grid-template-columns: auto 1fr;
    gap: 8px;
    padding: 10px 12px;
  }
  .ach__grid {
    grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
    gap: 10px;
    padding: 12px;
  }
  .ach__tabs {
    padding: 10px 12px 0;
  }
}
</style>
