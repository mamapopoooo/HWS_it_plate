<script setup lang="ts">
/**
 * 宠物图鉴卡片
 * - 名称与注音一律来自宠物库（PetTemplate），组件内不写死
 * - 未获得：剪影 + 「?」，不泄露形象
 * - 缺图：退化为卦象字符占位，不出现破图
 */
import { computed, ref, watch } from 'vue'
import { formImage, getTier, styleName, trigramGlyphs } from '@/config/gameConfig'
import type { PetTemplate } from '@/config/gameConfig'

const props = withDefaults(
  defineProps<{
    pet: PetTemplate
    owned?: boolean
    level?: number
  }>(),
  { owned: false, level: 1 },
)

const emit = defineEmits<{ (e: 'select', pet: PetTemplate): void }>()

const failed = ref(false)
watch(
  () => props.pet.id,
  () => (failed.value = false),
)

const tier = computed(() => getTier(props.pet.tier))
const glyph = computed(() => trigramGlyphs(props.pet.trigram))
const image = computed(() => formImage(props.pet, 1))
const bezel = computed(() => `tier-${props.pet.tier}`)

function onClick() {
  emit('select', props.pet)
}
</script>

<template>
  <button class="card" :class="[`card--${bezel}`, { 'is-locked': !owned }]" @click="onClick">
    <span class="card__badge">{{ tier?.name }}</span>

    <div class="card__pic">
      <img
        v-if="!failed && owned"
        :src="image"
        :alt="`${pet.name} ${pet.pinyin}`"
        loading="lazy"
        @error="failed = true"
      />
      <span v-else class="card__glyph">{{ owned ? glyph : '?' }}</span>
    </div>

    <div class="card__name">{{ owned ? pet.name : '未获得' }}</div>
    <!-- 注音与名字绑定在同一份数据里，未获得时也不显示（避免剧透） -->
    <div class="card__pinyin">{{ owned ? pet.pinyin : '　' }}</div>

    <div class="card__meta">
      <span class="card__tri">{{ glyph }}</span>
      <span class="card__style" :data-style="pet.style">{{ styleName(pet.style) }}</span>
      <span v-if="owned" class="card__lv num">Lv.{{ level }}</span>
    </div>

    <span class="card__src">{{ pet.source }}</span>
  </button>
</template>

<style scoped>
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 12px 10px 10px;
  text-align: center;
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.2);
  border-top: 3px solid var(--bezel, var(--ink-3));
  border-radius: var(--r-md);
  box-shadow: var(--sh-inset), var(--sh-paper);
  cursor: pointer;
  transition: transform var(--d-quick) var(--e-out), box-shadow var(--d-quick);
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--sh-lift);
}
.card:active {
  transform: translateY(-1px) scale(0.99);
}

/* 五阶外框色（配置里的 bezelColor 映射到令牌） */
.card--tier-1 {
  --bezel: var(--tier-1);
}
.card--tier-2 {
  --bezel: var(--tier-2);
}
.card--tier-3 {
  --bezel: var(--tier-3);
}
.card--tier-4 {
  --bezel: var(--tier-4);
}
.card--tier-5 {
  --bezel: var(--tier-5);
}

.card__badge {
  position: absolute;
  top: 6px;
  left: 6px;
  padding: 1px 6px;
  font-family: var(--font-title);
  font-size: 10px;
  color: #f7efe0;
  background: var(--bezel, var(--ink-3));
  border-radius: 2px;
}

.card__pic {
  display: grid;
  place-items: center;
  width: 100%;
  height: 84px;
  margin-bottom: 2px;
}
.card__pic img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 4px 6px rgba(28, 28, 36, 0.22));
}
/* 占位：卦象字符，带一点纸感，不显破图 */
.card__glyph {
  display: grid;
  place-items: center;
  width: 60px;
  height: 60px;
  font-family: var(--font-title);
  font-size: 26px;
  color: color-mix(in srgb, var(--bezel, var(--ink-3)) 70%, var(--ink));
  background: radial-gradient(circle at 50% 45%, #fffdf6, var(--paper-3));
  border: 1px dashed color-mix(in srgb, var(--bezel, var(--ink-3)) 45%, transparent);
  border-radius: 50%;
}

.card__name {
  font-family: var(--font-title);
  font-size: 15px;
  letter-spacing: 0.06em;
  color: var(--ink);
}
.card__pinyin {
  min-height: 14px;
  font-size: 10px;
  color: var(--ink-3);
}

.card__meta {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
  font-size: 10px;
  color: var(--ink-2);
}
.card__style {
  padding: 0 5px;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-size: 9px;
}
.card__style[data-style='meng'] {
  color: #b5637d;
}
.card__style[data-style='jun'] {
  color: var(--stone-blue);
}
.card__style[data-style='ya'] {
  color: var(--stone-green);
}
.card__style[data-style='qi'] {
  color: var(--trigram-zhen);
}
.card__lv {
  color: var(--cinnabar);
  font-weight: 700;
}
.card__src {
  margin-top: 2px;
  font-size: 9px;
  color: var(--ink-3);
}

/* 未获得：剪影感 */
.is-locked {
  background: linear-gradient(180deg, #efe9dc, #e2d8c4);
}
.is-locked .card__name {
  color: var(--ink-3);
}
.is-locked .card__glyph {
  color: rgba(28, 28, 36, 0.22);
  border-color: rgba(28, 28, 36, 0.14);
  background: radial-gradient(circle at 50% 45%, #f3ecdd, #e4dac6);
}
</style>
