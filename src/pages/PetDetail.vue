<script setup lang="ts">
/**
 * 宠物详情（/pet/:id）
 *
 * 名称/注音/卦属/风格/出处全部来自宠物库；数值用配置计算，不写死。
 * 技能暂未入库（seeds/skills 待 KIMI 定稿），这里只留位并说明。
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ECONOMY,
  TRIGRAMS,
  calcPower,
  formFromAwaken,
  formImage,
  formName,
  getPet,
  getTier,
  getTrigram,
  styleName,
  tierName,
  trigramGlyphs,
  trigramLabel,
} from '@/config/gameConfig'

const route = useRoute()
const router = useRouter()

const pet = computed(() => getPet(String(route.params.id)))
const tier = computed(() => (pet.value ? getTier(pet.value.tier) : undefined))

/** 占位：玩家个体数据（M2 由 /api/v2/pets/my 提供） */
const level = ref(5)
const awaken = ref(1)

const formCount = computed(() => tier.value?.formCount ?? 1)
const form = computed(() => formFromAwaken(pet.value?.tier ?? 1, awaken.value))
const power = computed(() =>
  pet.value ? calcPower(pet.value.tier, level.value, awaken.value) : 0,
)

const failed = ref(false)
watch(
  () => [pet.value?.id, form.value],
  () => (failed.value = false),
)

const image = computed(() => (pet.value ? formImage(pet.value, form.value) : ''))
const accent = computed(() => tier.value?.bezelColor ?? '#8a8577')

/** 觉醒一次的价格（按品阶） */
const awakenCost = computed(() => {
  const key = `tier${pet.value?.tier ?? 1}`
  return (ECONOMY.awaken as Record<string, number>)[key] ?? 0
})

/** 卦象盘：高亮自身属性与对宫（相冲） */
const panel = computed(() => {
  const self = pet.value?.trigram ?? ''
  const codes = self === 'all' ? [] : self.split(',')
  return TRIGRAMS.map((t) => ({
    code: t.code,
    name: t.name,
    symbol: t.symbol,
    color: t.color,
    isSelf: codes.includes(t.code),
    isOpposite: codes.some((c) => getTrigram(c)?.opposite === t.code),
  }))
})

function back() {
  void router.push('/collection')
}
</script>

<template>
  <div class="pd gw-paper">
    <header class="pd__head">
      <button class="pd__back" @click="back">← 图鉴</button>
      <div class="pd__title">
        <h1>{{ pet?.name ?? '未找到' }}</h1>
        <p v-if="pet">{{ pet.pinyin }} · {{ pet.source }}</p>
      </div>
      <div class="pd__tags" v-if="pet">
        <span class="pd__tag" :style="{ background: accent }">{{ tierName(pet.tier) }}</span>
        <span class="pd__tag pd__tag--ghost">{{ styleName(pet.style) }}</span>
      </div>
    </header>

    <main v-if="pet" class="pd__body">
      <!-- 立绘 + 形态 -->
      <section class="pd__art">
        <div class="pd__frame" :style="{ '--accent': accent }">
          <img v-if="!failed" :src="image" :alt="`${pet.name} ${formName(form)}`" @error="failed = true" />
          <span v-else class="pd__glyph">{{ trigramGlyphs(pet.trigram) }}</span>
        </div>

        <div class="pd__forms">
          <button
            v-for="n in formCount"
            :key="n"
            class="pd__form"
            :class="{ 'is-on': n === form }"
            :disabled="n > formCount"
            @click="awaken = n - 1"
          >
            {{ formName(n) }}
          </button>
        </div>
        <p class="pd__form-hint">
          形态 = 觉醒阶 + 1（当前觉醒 {{ awaken }} 阶 · 上限 {{ tier?.awakenCap ?? 0 }} 阶）
        </p>
      </section>

      <!-- 属性与卦象盘 -->
      <section class="pd__stats">
        <div class="pd__grid">
          <div class="pd__cell">
            <span>等级</span><b class="num">Lv.{{ level }}</b>
          </div>
          <div class="pd__cell">
            <span>战力</span><b class="num">{{ power }}</b>
          </div>
          <div class="pd__cell">
            <span>觉醒</span><b class="num">{{ awaken }} / {{ tier?.awakenCap ?? 0 }}</b>
          </div>
          <div class="pd__cell">
            <span>技能位</span><b class="num">{{ tier?.skillSlots ?? 0 }}</b>
          </div>
        </div>

        <h2 class="pd__sub">卦象盘 <span>{{ trigramGlyphs(pet.trigram) }} {{ trigramLabel(pet.trigram) }}</span></h2>
        <div class="pd__bagua">
          <div
            v-for="g in panel"
            :key="g.code"
            class="pd__gua"
            :class="{ 'is-self': g.isSelf, 'is-foe': g.isOpposite }"
            :style="{ '--gc': g.color }"
          >
            <span class="pd__gua-sym">{{ g.symbol }}</span>
            <span class="pd__gua-name">{{ g.name }}</span>
          </div>
        </div>
        <p class="pd__note">
          对宫互冲：本命属性与对宫交战伤害 ×{{ 1.3.toFixed(1) }}（双向），其余 ×1.0。
          <template v-if="pet.trigram === 'all'">该宠为全属，不受克制。</template>
        </p>
      </section>

      <!-- 操作 -->
      <section class="pd__side">
        <h2 class="pd__sub">养成</h2>
        <p class="pd__desc">{{ pet.description }}</p>

        <button class="gw-seal gw-seal--primary pd__act" :disabled="awaken >= (tier?.awakenCap ?? 0)">
          {{ awaken >= (tier?.awakenCap ?? 0) ? '已达觉醒上限' : `觉醒（${awakenCost} 灵石）` }}
        </button>
        <button class="gw-seal pd__act" disabled>学习技能（待开放）</button>

        <p class="pd__fine">
          觉醒费用按品阶固定，可用灵纹碎片抵扣最多
          {{ Math.round((ECONOMY.fragment.payRatio ?? 0.5) * 100) }}%。
        </p>
      </section>
    </main>

    <div v-else class="pd__missing">
      <p>没有找到 id 为 <code>{{ route.params.id }}</code> 的宠物。</p>
      <button class="gw-seal" @click="back">返回图鉴</button>
    </div>
  </div>
</template>

<style scoped>
.pd {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

.pd__head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(28, 28, 36, 0.18);
  box-shadow: 0 2px 10px rgba(28, 28, 36, 0.07);
}
.pd__back {
  padding: 8px 14px;
  font-family: var(--font-title);
  font-size: 13px;
  color: var(--ink);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.pd__title h1 {
  margin: 0;
  font-family: var(--font-title);
  font-size: 24px;
  letter-spacing: 0.12em;
}
.pd__title p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--ink-3);
}
.pd__tags {
  display: flex;
  gap: 6px;
}
.pd__tag {
  padding: 3px 10px;
  font-family: var(--font-title);
  font-size: 12px;
  color: #f7efe0;
  border-radius: 3px;
}
.pd__tag--ghost {
  color: var(--ink-2);
  background: rgba(255, 253, 246, 0.75);
  border: 1px solid rgba(28, 28, 36, 0.2);
}

.pd__body {
  flex: 1;
  display: grid;
  grid-template-columns: 320px 1fr 260px;
  gap: 18px;
  padding: 18px 20px 30px;
  align-items: start;
}

/* ---------- 立绘 ---------- */
.pd__art {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.pd__frame {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  background: radial-gradient(circle at 50% 40%, #fffdf6, var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.18);
  border-top: 4px solid var(--accent);
  border-radius: var(--r-md);
  box-shadow: var(--sh-inset), var(--sh-paper);
  overflow: hidden;
}
.pd__frame img {
  max-width: 88%;
  max-height: 92%;
  object-fit: contain;
  -webkit-mask-image: radial-gradient(ellipse 60% 62% at 50% 48%, #000 56%, transparent 82%);
  mask-image: radial-gradient(ellipse 60% 62% at 50% 48%, #000 56%, transparent 82%);
}
.pd__glyph {
  font-family: var(--font-title);
  font-size: 64px;
  color: color-mix(in srgb, var(--accent) 60%, var(--ink-3));
}
.pd__forms {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.pd__form {
  flex: 1;
  min-width: 52px;
  padding: 6px 4px;
  font-family: var(--font-title);
  font-size: 12px;
  color: var(--ink-2);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.18);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.pd__form.is-on {
  color: #f7efe0;
  background: linear-gradient(180deg, #ce4436, var(--cinnabar-d));
  border-color: var(--cinnabar-d);
}
.pd__form-hint {
  margin: 0;
  font-size: 11px;
  color: var(--ink-3);
}

/* ---------- 数值与卦象盘 ---------- */
.pd__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.pd__cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 6px;
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.16);
  border-radius: var(--r-sm);
  font-size: 11px;
  color: var(--ink-3);
}
.pd__cell b {
  font-family: var(--font-num);
  font-size: 17px;
  color: var(--ink);
}

.pd__sub {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 18px 0 10px;
  font-family: var(--font-title);
  font-size: 15px;
  letter-spacing: 0.12em;
  color: var(--ink);
  border-left: 3px solid var(--cinnabar);
  padding-left: 8px;
}
.pd__sub span {
  font-family: var(--font-body);
  font-size: 12px;
  letter-spacing: 0;
  color: var(--ink-3);
}

.pd__bagua {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.pd__gua {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 8px 4px;
  background: rgba(255, 253, 246, 0.7);
  border: 1px solid rgba(28, 28, 36, 0.14);
  border-top: 3px solid var(--gc);
  border-radius: var(--r-sm);
  opacity: 0.55;
}
/* 本命属性高亮，对宫描红 */
.pd__gua.is-self {
  opacity: 1;
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--gc) 55%, transparent);
}
.pd__gua.is-foe {
  opacity: 1;
  border-color: var(--cinnabar);
  border-top-color: var(--cinnabar);
}
.pd__gua-sym {
  font-family: var(--font-title);
  font-size: 18px;
  color: var(--gc);
}
.pd__gua-name {
  font-family: var(--font-title);
  font-size: 12px;
  color: var(--ink);
}
.pd__note {
  margin: 10px 0 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--ink-3);
}

/* ---------- 操作 ---------- */
.pd__side {
  padding: 14px;
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.2);
  border-radius: var(--r-md);
  box-shadow: var(--sh-inset), var(--sh-paper);
}
.pd__side .pd__sub {
  margin-top: 0;
}
.pd__desc {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--ink-2);
}
.pd__act {
  width: 100%;
  margin-bottom: 8px;
  font-size: 13px;
}
.pd__fine {
  margin: 6px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--ink-3);
}

.pd__missing {
  display: grid;
  place-items: center;
  gap: 10px;
  padding: 60px 20px;
  font-size: 13px;
  color: var(--ink-2);
}

@media (max-width: 900px) {
  .pd__head {
    grid-template-columns: auto 1fr;
    gap: 8px;
    padding: 10px 12px;
  }
  .pd__tags {
    grid-column: 1 / -1;
  }
  .pd__body {
    grid-template-columns: 1fr;
    padding: 12px;
  }
  .pd__grid,
  .pd__bagua {
    grid-template-columns: repeat(4, 1fr);
  }
}
</style>
