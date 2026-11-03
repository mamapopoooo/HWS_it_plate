<script setup lang="ts">
/**
 * 太极盘站台：立绘 + 太极底纹 + 卦象环 + 金线台座 + 漂浮动效
 * 换品阶/换形态时播一次「水墨晕开」；happy 时飘爱心（摸头交互）。
 */
import { computed, ref, watch } from 'vue'
import { TRIGRAMS } from '@/config/gameConfig'

const props = defineProps<{
  image: string
  alt: string
  tier: number
  /** 品阶强调色，由调用方按 tier 取 */
  accent: string
  /** 0–1，光晕强度 */
  aura: number
  /** 立绘加载失败时显示的卦象字符 */
  fallbackGlyph: string
  happy?: boolean
}>()

/** 八个卦象均匀分布在环上（角度 → 百分比坐标） */
const ringGlyphs = computed(() =>
  TRIGRAMS.map((t, i) => {
    const angle = (i / TRIGRAMS.length) * Math.PI * 2
    return {
      code: t.code,
      symbol: t.symbol,
      left: 50 + 45 * Math.sin(angle),
      top: 50 - 45 * Math.cos(angle),
    }
  }),
)

const blooming = ref(false)
const failed = ref(false)
let bloomTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => [props.tier, props.image],
  () => {
    failed.value = false
    blooming.value = false
    // 强制重播：先移除再在下一帧加回
    void requestAnimationFrame(() => {
      blooming.value = true
      if (bloomTimer) clearTimeout(bloomTimer)
      bloomTimer = setTimeout(() => (blooming.value = false), 760)
    })
  },
)

const styleVars = computed(() => ({
  '--accent': props.accent,
  '--aura': String(props.aura),
}))
</script>

<template>
  <div class="altar" :style="styleVars">
    <!-- 太极底纹 -->
    <div class="gw-taiji altar__disc" aria-hidden="true" />

    <!-- 八卦方位环 -->
    <div class="altar__ring" aria-hidden="true">
      <span
        v-for="g in ringGlyphs"
        :key="g.code"
        class="altar__glyph"
        :style="{ left: g.left + '%', top: g.top + '%' }"
        >{{ g.symbol }}</span
      >
    </div>

    <!-- 金线台座 -->
    <div class="gw-dais altar__dais" aria-hidden="true" />

    <!-- 立绘 -->
    <div class="altar__holder">
      <img
        v-if="!failed"
        :src="image"
        :alt="alt"
        class="altar__img"
        @error="failed = true"
      />
      <div v-else class="altar__placeholder" :title="alt">{{ fallbackGlyph }}</div>
    </div>

    <!-- 摸头爱心 -->
    <div v-if="happy" class="altar__hearts" aria-hidden="true">
      <i style="--d: 0s">❤</i>
      <i style="--d: 0.18s">❤</i>
      <i style="--d: 0.36s">❤</i>
    </div>

    <!-- 水墨晕开 -->
    <div class="gw-ink-bloom" :class="{ 'gw-ink-bloom--on': blooming }" aria-hidden="true" />
  </div>
</template>

<style scoped>
.altar {
  position: relative;
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: end center;
  width: 100%;
}

.altar__disc {
  position: absolute;
  left: 50%;
  bottom: 6%;
  width: 46%;
  aspect-ratio: 1;
  transform: translateX(-50%);
  opacity: 0.13;
  z-index: 0;
}

.altar__ring {
  position: absolute;
  left: 50%;
  bottom: 7%;
  width: 52%;
  aspect-ratio: 1;
  transform: translateX(-50%);
  z-index: 1;
  animation: gw-ring-turn 72s linear infinite;
  opacity: 0.8;
}
@keyframes gw-ring-turn {
  from {
    transform: translateX(-50%) rotate(0deg);
  }
  to {
    transform: translateX(-50%) rotate(360deg);
  }
}
.altar__glyph {
  position: absolute;
  font-family: var(--font-title);
  font-size: clamp(14px, 2.2vw, 22px);
  line-height: 1;
  color: var(--ink-2);
  transform: translate(-50%, -50%);
  opacity: 0.85;
}

.altar__dais {
  position: absolute;
  left: 50%;
  bottom: 3%;
  width: 44%;
  height: 11%;
  transform: translateX(-50%);
  z-index: 2;
}

.altar__holder {
  position: relative;
  z-index: 4;
  display: grid;
  place-items: end center;
  width: 100%;
  height: 100%;
  padding-bottom: 8%;
  pointer-events: none;
  animation: gw-float 4.2s ease-in-out infinite;
}

.altar__img {
  max-width: 78%;
  max-height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 10px 18px rgba(28, 28, 36, 0.26))
    drop-shadow(0 0 calc(var(--aura) * 26px) color-mix(in srgb, var(--accent) 55%, transparent));
  -webkit-mask-image: radial-gradient(ellipse 60% 62% at 50% 48%, #000 56%, transparent 82%);
  mask-image: radial-gradient(ellipse 60% 62% at 50% 48%, #000 56%, transparent 82%);
  transition: filter var(--d-slow) var(--e-out), opacity var(--d-base) var(--e-out),
    transform var(--d-base) var(--e-out);
}

/* 缺图兜底：显示卦象字符，不出现破图 */
.altar__placeholder {
  display: grid;
  place-items: center;
  width: 120px;
  height: 120px;
  font-family: var(--font-title);
  font-size: 52px;
  color: color-mix(in srgb, var(--accent) 70%, var(--ink));
  background: radial-gradient(circle at 50% 45%, rgba(255, 253, 246, 0.9), var(--paper-2));
  border: 1px dashed color-mix(in srgb, var(--accent) 45%, transparent);
  border-radius: 50%;
}

.altar__hearts {
  position: absolute;
  left: 50%;
  bottom: 42%;
  z-index: 6;
  pointer-events: none;
}
.altar__hearts i {
  position: absolute;
  left: 0;
  font-size: 18px;
  font-style: normal;
  color: #d4546b;
  animation: gw-heart 1.4s var(--e-out) var(--d) forwards;
}

@media (max-width: 900px) {
  .altar__disc {
    width: 76%;
  }
  .altar__ring {
    width: 86%;
    bottom: 9%;
  }
  .altar__dais {
    width: 74%;
    height: 14%;
  }
  .altar__holder {
    padding-bottom: 12%;
  }
  .altar__img {
    max-width: 82%;
  }
}
</style>
