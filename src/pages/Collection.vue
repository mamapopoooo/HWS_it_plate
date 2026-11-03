<script setup lang="ts">
/**
 * 灵宠图鉴 · 五阶分卷（P2）
 *
 * 分卷数量由配置决定（TIERS.map），加第六阶不需要改本文件 —— 这是 00-总纲 §10 的验收点。
 * 数据：宠物库 PETS（含名称/注音/风格/卦属/出处）；持有情况走 api/adapter（接口未就绪自动回落占位）。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import PetCard from '@/components/pet/PetCard.vue'
import { PETS, TIERS, getTier, styleName } from '@/config/gameConfig'
import type { PetTemplate } from '@/config/gameConfig'
import { fetchOwned } from '@/api/adapter'
import { DEMO_OWNED } from '@/api/demo'
import type { OwnedMap } from '@/api/types'

const router = useRouter()

/** 持有情况：先用占位垫一帧避免闪烁，随后由 adapter 覆盖（真接口优先） */
const owned = ref<OwnedMap>({ ...DEMO_OWNED })

onMounted(async () => {
  owned.value = await fetchOwned()
})

/** 是否已解锁造物（阴阳鱼齐）——占位 */
const canCreate = ref(false)

const activeTier = ref(1)

const tierList = computed(() => TIERS)

const list = computed<PetTemplate[]>(() =>
  PETS.filter((p) => p.tier === activeTier.value).sort((a, b) => a.sortOrder - b.sortOrder),
)

function ownedLevel(id: string): number | undefined {
  return owned.value[id]
}

function tierOwned(tier: number): number {
  return PETS.filter((p) => p.tier === tier && owned.value[p.id]).length
}

function tierTotal(tier: number): number {
  return PETS.filter((p) => p.tier === tier).length
}

const totalOwned = computed(() => Object.keys(owned.value).length)
const totalAll = computed(() => PETS.length)
const percent = computed(() => Math.round((totalOwned.value / totalAll.value) * 100))

const currentTier = computed(() => getTier(activeTier.value))

/** 风格分布：让"图鉴里萌俊雅奇都有"变成可见的事实 */
const styleSummary = computed(() => {
  const map: Record<string, number> = {}
  for (const p of list.value) map[p.style] = (map[p.style] ?? 0) + 1
  return Object.entries(map).map(([code, n]) => ({ code, name: styleName(code), count: n }))
})

function back() {
  void router.push('/lobby')
}

function goCreate() {
  void router.push('/custom')
}

function onSelect(pet: PetTemplate) {
  void router.push(`/pet/${pet.id}`)
}
</script>

<template>
  <div class="col gw-paper">
    <header class="col__head">
      <button class="col__back" @click="back">← 大厅</button>
      <div class="col__title">
        <h1>灵宠图鉴</h1>
        <p>共 {{ totalAll }} 只 · 已收集 <b class="num">{{ totalOwned }}</b> 只（{{ percent }}%）</p>
      </div>
      <div class="col__bar">
        <i :style="{ width: percent + '%' }" />
      </div>
    </header>

    <!-- 五阶分卷：由配置生成，不写死卷数 -->
    <nav class="col__tabs">
      <button
        v-for="(tier, index) in tierList"
        :key="tier.tier"
        class="col__tab"
        :class="{ 'is-on': tier.tier === activeTier }"
        @click="activeTier = tier.tier"
      >
        <span class="col__tab-name">卷{{ ['一', '二', '三', '四', '五', '六'][index] ?? index + 1 }} · {{ tier.name }}</span>
        <span class="col__tab-sub num">
          {{ tier.tier === 5 ? '本命' : `${tierOwned(tier.tier)}/${tierTotal(tier.tier)}` }}
        </span>
      </button>
    </nav>

    <main class="col__body">
      <!-- 一至四阶：常规宫格 -->
      <div v-if="activeTier !== 5" class="col__grid">
        <PetCard
          v-for="pet in list"
          :key="pet.id"
          :pet="pet"
          :owned="Boolean(ownedLevel(pet.id))"
          :level="ownedLevel(pet.id) ?? 1"
          @select="onSelect"
        />
      </div>

      <!-- 五阶：本命位（学生自造） -->
      <div v-else class="col__custom">
        <div class="col__custom-glyph" :class="{ 'is-on': canCreate }">☯</div>
        <h2>{{ canCreate ? '你的本命' : '本命位 · 尚未开启' }}</h2>
        <p v-if="!canCreate">
          集齐<b>阴鱼</b>与<b>阳鱼</b>后开启「造物」，你可以自己捏一只、画一只，或让 AI 生成一只，<br />
          技能也从效果池里自己配 —— 审核通过后，全班只有你有这一只。
        </p>
        <p v-else>前往造物，给自己的神兽命名、配技能。</p>
        <button class="gw-seal gw-seal--primary" @click="goCreate">
          {{ canCreate ? '前往造物' : '预览造物界面' }}
        </button>
      </div>

      <footer class="col__foot">
        <span>{{ currentTier?.subtitle }}</span>
        <span v-if="activeTier !== 5" class="col__styles">
          本卷风格：
          <em v-for="s in styleSummary" :key="s.code" :data-style="s.code">{{ s.name }} {{ s.count }}</em>
        </span>
      </footer>
    </main>
  </div>
</template>

<style scoped>
.col {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

/* ---------- 头部 ---------- */
.col__head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(28, 28, 36, 0.18);
  box-shadow: 0 2px 10px rgba(28, 28, 36, 0.07);
}
.col__back {
  padding: 8px 14px;
  font-family: var(--font-title);
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--ink);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.col__back:hover {
  box-shadow: var(--sh-lift);
}
.col__title h1 {
  margin: 0;
  font-family: var(--font-title);
  font-size: 22px;
  letter-spacing: 0.14em;
}
.col__title p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--ink-2);
}
.col__title b {
  color: var(--cinnabar);
}
.col__bar {
  width: 180px;
  height: 8px;
  border-radius: 999px;
  background: rgba(28, 28, 36, 0.12);
  overflow: hidden;
}
.col__bar > i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--stone-green), var(--jade));
  transition: width var(--d-slow) var(--e-out);
}

/* ---------- 分卷 ---------- */
.col__tabs {
  display: flex;
  gap: 8px;
  padding: 12px 20px 0;
  overflow-x: auto;
}
.col__tab {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 16px;
  white-space: nowrap;
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.2);
  border-bottom: 0;
  border-radius: var(--r-sm) var(--r-sm) 0 0;
  cursor: pointer;
  transition: transform var(--d-quick) var(--e-out);
}
.col__tab:hover {
  transform: translateY(-2px);
}
.col__tab-name {
  font-family: var(--font-title);
  font-size: 14px;
  letter-spacing: 0.08em;
  color: var(--ink-2);
}
.col__tab-sub {
  font-size: 11px;
  color: var(--ink-3);
}
.col__tab.is-on {
  background: linear-gradient(180deg, #fffdf6, var(--paper-light));
  border-color: var(--cinnabar);
  box-shadow: inset 0 3px 0 var(--cinnabar);
}
.col__tab.is-on .col__tab-name {
  color: var(--ink);
}

/* ---------- 宫格 ---------- */
.col__body {
  flex: 1;
  padding: 16px 20px 24px;
  background: linear-gradient(180deg, rgba(255, 253, 246, 0.5), transparent);
  border-top: 1px solid rgba(28, 28, 36, 0.14);
}
.col__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 12px;
}

/* ---------- 本命位 ---------- */
.col__custom {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 40px 16px;
  text-align: center;
}
.col__custom-glyph {
  font-size: 88px;
  line-height: 1;
  color: rgba(28, 28, 36, 0.16);
  animation: gw-float 4.2s ease-in-out infinite;
}
.col__custom-glyph.is-on {
  color: var(--gold);
}
.col__custom h2 {
  margin: 0;
  font-family: var(--font-title);
  font-size: 20px;
  letter-spacing: 0.14em;
}
.col__custom p {
  margin: 0 0 6px;
  max-width: 460px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--ink-2);
}
.col__custom b {
  color: var(--cinnabar);
}

/* ---------- 页脚 ---------- */
.col__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  font-size: 12px;
  color: var(--ink-2);
  border-top: 1px solid rgba(28, 28, 36, 0.12);
}
.col__styles {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ink-3);
}
.col__styles em {
  font-style: normal;
  padding: 1px 8px;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-size: 11px;
}
.col__styles em[data-style='meng'] {
  color: #b5637d;
}
.col__styles em[data-style='jun'] {
  color: var(--stone-blue);
}
.col__styles em[data-style='ya'] {
  color: var(--stone-green);
}
.col__styles em[data-style='qi'] {
  color: var(--trigram-zhen);
}

@media (max-width: 720px) {
  .col__head {
    grid-template-columns: auto 1fr;
    gap: 10px;
    padding: 10px 12px;
  }
  .col__bar {
    display: none;
  }
  .col__title h1 {
    font-size: 18px;
  }
  .col__grid {
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
    gap: 8px;
  }
  .col__body {
    padding: 12px;
  }
}
</style>
