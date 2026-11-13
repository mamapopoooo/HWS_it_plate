<script setup lang="ts">
/**
 * 求签演出（抽卡动画）
 *
 * 时间轴：0–800ms 摇签筒 → 800–1600ms 玉简升起 + 卷轴展开 → 1600–2400ms 光爆与显露
 * 800ms 后可点击/ESC 跳过（总纲 §4.4 决策 D4）。
 * 品阶配色来自配置（tier.bezelColor），组件内不写死颜色。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    tier: number
    tierName: string
    accent: string
    name: string
    pinyin: string
    duration?: number
    skipAfter?: number
  }>(),
  { duration: 2400, skipAfter: 800 },
)

const emit = defineEmits<{ (e: 'done'): void }>()

type Phase = 'idle' | 'shake' | 'reveal' | 'burst'
const phase = ref<Phase>('idle')
const canSkip = ref(false)
const finished = ref(false)

const timers: Array<ReturnType<typeof setTimeout>> = []

const tierStars = computed(() => '★'.repeat(Math.max(1, props.tier)) + '☆'.repeat(Math.max(0, 5 - props.tier)))

/** 粒子落点：在脚本里算好，避免依赖 CSS 三角函数（兼容性更稳） */
const particles = computed(() =>
  Array.from({ length: 12 }, (_, idx) => {
    const angle = (Math.PI * 2 * idx) / 12
    const radius = 200 + (idx % 3) * 20
    return {
      i: idx + 1,
      tx: `${Math.round(Math.cos(angle) * radius)}px`,
      ty: `${Math.round(Math.sin(angle) * radius)}px`,
    }
  }),
)

function finish() {
  if (finished.value) return
  finished.value = true
  timers.forEach(clearTimeout)
  timers.length = 0
  phase.value = 'burst'
  emit('done')
}

onMounted(() => {
  timers.push(setTimeout(() => (phase.value = 'shake'), 40))
  timers.push(setTimeout(() => (phase.value = 'reveal'), props.skipAfter))
  timers.push(setTimeout(() => (canSkip.value = true), props.skipAfter))
  timers.push(setTimeout(() => (phase.value = 'burst'), 1600))
  timers.push(setTimeout(finish, props.duration))
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  timers.forEach(clearTimeout)
  window.removeEventListener('keydown', onKey)
})

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') finish()
}
</script>

<template>
  <div class="gacha" :data-phase="phase" :style="{ '--accent': accent }" @click="finish">
    <div class="gacha__stage">
      <!-- 签筒 -->
      <div class="tube" aria-hidden="true">
        <span class="tube__lip" />
        <span class="tube__body" />
      </div>

      <!-- 玉简（签） -->
      <div class="slip" aria-hidden="true"><span /></div>

      <!-- 光爆 -->
      <div class="burst" aria-hidden="true" />

      <!-- 粒子 -->
      <div class="parts" aria-hidden="true">
        <i v-for="p in particles" :key="p.i" :style="{ '--i': p.i, '--tx': p.tx, '--ty': p.ty }" />
      </div>

      <!-- 结果卷轴 -->
      <div class="reveal">
        <div class="reveal__scroll">
          <div class="reveal__row">
            <span class="reveal__tier">{{ tierName }}</span>
            <span class="reveal__stars">{{ tierStars }}</span>
          </div>
          <div class="reveal__name">{{ name }}</div>
          <div class="reveal__pinyin">{{ pinyin }}</div>
        </div>
        <p class="reveal__hint">点击任意处继续</p>
      </div>
    </div>

    <button v-if="canSkip" class="gacha__skip" @click.stop="finish">点击跳过</button>
  </div>
</template>

<style scoped>
.gacha {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: grid;
  place-items: center;
  background: rgba(20, 16, 12, 0.62);
  backdrop-filter: blur(3px);
  cursor: pointer;
}

.gacha__stage {
  position: relative;
  display: grid;
  place-items: center;
  width: min(92vw, 420px);
  height: 420px;
}

/* ---------- 签筒 ---------- */
.tube {
  position: absolute;
  bottom: 96px;
  width: 92px;
  height: 128px;
  transition: opacity var(--d-base) var(--e-out), transform var(--d-base) var(--e-out);
}
.tube__body {
  position: absolute;
  inset: 10px 0 0;
  border-radius: 10px 10px 14px 14px;
  background: linear-gradient(100deg, #828282, #b7b7b7 42%, #6a6a6a);
  box-shadow: inset 0 0 0 2px rgba(242, 242, 242, 0.35), 0 10px 20px rgba(0, 0, 0, 0.35);
}
/* 竹节 */
.tube__body::after {
  content: '';
  position: absolute;
  inset: 30% 6% auto;
  height: 2px;
  background: rgba(65, 65, 65, 0.5);
  box-shadow: 0 30px 0 rgba(65, 65, 65, 0.5);
}
.tube__lip {
  position: absolute;
  top: 4px;
  left: 2px;
  right: 2px;
  height: 16px;
  border-radius: 8px;
  background: linear-gradient(180deg, #dbdbdb, #959595);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

/* ---------- 玉简 ---------- */
.slip {
  position: absolute;
  bottom: 150px;
  width: 22px;
  height: 96px;
  border-radius: 4px;
  background: linear-gradient(180deg, #eeeeee, #b1b1b1 60%, #7d7d7d);
  box-shadow: 0 0 18px rgba(174, 174, 174, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.7);
  opacity: 0;
  transform: translateY(20px);
}
.slip span {
  position: absolute;
  inset: 12px 6px;
  border-radius: 2px;
  background: repeating-linear-gradient(180deg, rgba(63, 63, 63, 0.35) 0 2px, transparent 2px 10px);
}

/* ---------- 光爆 ---------- */
.burst {
  position: absolute;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: radial-gradient(circle, #fff 0%, var(--accent) 45%, transparent 72%);
  opacity: 0;
  filter: blur(2px);
}

/* ---------- 粒子 ---------- */
.parts {
  position: absolute;
  inset: 0;
  pointer-events: none;
  opacity: 0;
}
.parts i {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 10px var(--accent);
  transform: translate(-50%, -50%);
}

/* ---------- 结果 ---------- */
.reveal {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 10px;
  opacity: 0;
  transform: translateY(12px) scale(0.94);
}
.reveal__scroll {
  min-width: 220px;
  padding: 16px 28px;
  text-align: center;
  background: linear-gradient(180deg, #f5f5f5, #dddddd);
  border-left: 6px solid #505050;
  border-right: 6px solid #505050;
  border-radius: 3px;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4), inset 0 0 0 2px rgba(251, 252, 250, 0.8);
}
.reveal__row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.reveal__tier {
  padding: 2px 8px;
  font-family: var(--font-title);
  font-size: 12px;
  letter-spacing: 0.1em;
  color: #f7f7f7;
  background: var(--accent);
  border-radius: 2px;
}
.reveal__stars {
  font-size: 13px;
  color: var(--accent);
  letter-spacing: 0.1em;
}
.reveal__name {
  margin-top: 6px;
  font-family: var(--font-title);
  font-size: 30px;
  letter-spacing: 0.16em;
  color: var(--ink);
  text-shadow: 0 0 16px color-mix(in srgb, var(--accent) 55%, transparent);
}
.reveal__pinyin {
  font-size: 12px;
  color: var(--ink-3);
}
.reveal__hint {
  margin: 0;
  font-size: 11px;
  color: rgba(251, 252, 250, 0.7);
}

.gacha__skip {
  position: absolute;
  right: 18px;
  bottom: 18px;
  padding: 6px 14px;
  font-size: 12px;
  color: #f5f5f5;
  background: rgba(251, 252, 250, 0.14);
  border: 1px solid rgba(251, 252, 250, 0.3);
  border-radius: 999px;
  cursor: pointer;
}

/* ---------- 阶段 ---------- */
.gacha[data-phase='shake'] .tube {
  animation: tube-shake 0.42s ease-in-out infinite;
}
@keyframes tube-shake {
  0%,
  100% {
    transform: rotate(-3deg) translateY(0);
  }
  50% {
    transform: rotate(3deg) translateY(-3px);
  }
}

.gacha[data-phase='reveal'] .tube,
.gacha[data-phase='burst'] .tube {
  opacity: 0;
  transform: translateY(14px);
}
.gacha[data-phase='reveal'] .slip {
  animation: slip-up 0.8s var(--e-out) forwards;
}
@keyframes slip-up {
  0% {
    opacity: 0;
    transform: translateY(26px) rotate(-6deg);
  }
  40% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(-120px) rotate(4deg) scale(0.9);
  }
}

.gacha[data-phase='reveal'] .reveal {
  opacity: 1;
  transform: translateY(0) scale(1);
  transition: opacity var(--d-base) var(--e-out), transform var(--d-base) var(--e-back);
}

.gacha[data-phase='burst'] .reveal {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.gacha[data-phase='burst'] .burst {
  animation: burst-out 700ms var(--e-out) forwards;
}
@keyframes burst-out {
  0% {
    width: 40px;
    height: 40px;
    opacity: 1;
  }
  100% {
    width: 560px;
    height: 560px;
    opacity: 0;
  }
}
.gacha[data-phase='burst'] .parts {
  opacity: 1;
}
.gacha[data-phase='burst'] .parts i {
  animation: part-fly 700ms var(--e-out) forwards;
  animation-delay: calc(var(--i) * 18ms);
}
@keyframes part-fly {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0.2);
    opacity: 0;
  }
}

@media (max-width: 720px) {
  .gacha__stage {
    height: 340px;
  }
  .reveal__name {
    font-size: 24px;
  }
}
</style>
