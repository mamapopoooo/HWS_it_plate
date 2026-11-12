<script setup lang="ts">
/**
 * 内容台账（教师端 · v3）
 *
 * 宠物 / 皮肤 / 任务 / 成就 四类内容的总览与检查工具。
 * 内容源是 docs/seeds/*.json，本页只读，不做假写入 —— 但提供"立绘缺失检查"这类实用诊断。
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ACHIEVEMENTS,
  QUESTS,
  SHOP_ITEMS,
  SKINS,
  rewardText,
  skinPrice,
} from '@/config/contentConfig'
import {
  PETS,
  TIERS,
  formImage,
  getTier,
  styleName,
  trigramGlyphs,
  trigramLabel,
} from '@/config/gameConfig'
import type { PetTemplate } from '@/config/gameConfig'

const router = useRouter()

type Tab = 'pets' | 'skins' | 'quests' | 'achievements'
const tab = ref<Tab>('pets')

const TABS: Array<{ key: Tab; name: string; count: number }> = [
  { key: 'pets', name: '宠物', count: PETS.length },
  { key: 'skins', name: '角色皮肤', count: SKINS.length },
  { key: 'quests', name: '任务', count: QUESTS.length },
  { key: 'achievements', name: '成就', count: ACHIEVEMENTS.length },
]

/* ---------- 宠物 ---------- */

const keyword = ref('')
const tierFilter = ref<number | 0>(0)

const pets = computed<PetTemplate[]>(() =>
  PETS.filter((p) => (tierFilter.value === 0 ? true : p.tier === tierFilter.value))
    .filter((p) => {
      const k = keyword.value.trim()
      if (!k) return true
      return p.name.includes(k) || p.pinyin.includes(k) || p.source.includes(k)
    })
    .sort((a, b) => a.sortOrder - b.sortOrder),
)

/** 立绘缺失检查：点按钮才去请求图片，避免每次进页面刷 38 个 404 */
const checked = ref(false)
const missing = ref<Set<string>>(new Set())
const checking = ref(false)

async function checkArt() {
  checking.value = true
  checked.value = true
  const miss = new Set<string>()
  await Promise.all(
    PETS.map(
      (p) =>
        new Promise<void>((resolve) => {
          const img = new Image()
          img.onload = () => resolve()
          img.onerror = () => {
            miss.add(p.id)
            resolve()
          }
          img.src = formImage(p, 1)
        }),
    ),
  )
  missing.value = miss
  checking.value = false
}

/* ---------- 皮肤 / 任务 / 成就 ---------- */

const skins = computed(() => [...SKINS].sort((a, b) => a.sortOrder - b.sortOrder))
const dailyQuests = computed(() => QUESTS.filter((q) => q.type === 'daily'))
const weeklyQuests = computed(() => QUESTS.filter((q) => q.type === 'weekly'))

const pendingArt = computed(() => (checked.value ? missing.value.size : null))

function tierLabel(tier: number): string {
  return getTier(tier)?.name ?? `第${tier}阶`
}

function condText(cond: { type: string; value: number }): string {
  return `${cond.type} ≥ ${cond.value}`
}

function back() {
  void router.push('/teacher')
}
</script>

<template>
  <div class="ca gw-paper">
    <header class="ca__head">
      <button class="ca__back" @click="back">← 教师端</button>
      <div class="ca__title">
        <h1>内容台账</h1>
        <p>宠物 {{ PETS.length }} · 皮肤 {{ SKINS.length }} · 任务 {{ QUESTS.length }} · 成就 {{ ACHIEVEMENTS.length }} · 商品 {{ SHOP_ITEMS.length }}</p>
      </div>
      <div class="ca__actions">
        <button class="gw-seal" :disabled="checking" @click="checkArt">
          {{ checking ? '检查中…' : '检查立绘缺失' }}
        </button>
        <span v-if="pendingArt !== null" class="ca__badge" :class="{ 'is-ok': pendingArt === 0 }">
          {{ pendingArt === 0 ? '立绘齐全' : `缺 ${pendingArt} 张立绘` }}
        </span>
      </div>
    </header>

    <nav class="ca__tabs">
      <button
        v-for="t in TABS"
        :key="t.key"
        class="ca__tab"
        :class="{ 'is-on': tab === t.key }"
        @click="tab = t.key"
      >
        {{ t.name }} <b class="num">{{ t.count }}</b>
      </button>
    </nav>

    <!-- 宠物 -->
    <main v-if="tab === 'pets'" class="ca__body">
      <div class="ca__filters">
        <input v-model="keyword" class="ca__search" placeholder="搜名称 / 注音 / 出处" />
        <button class="ca__chip" :class="{ 'is-on': tierFilter === 0 }" @click="tierFilter = 0">全部品阶</button>
        <button
          v-for="t in TIERS"
          :key="t.tier"
          class="ca__chip"
          :class="{ 'is-on': tierFilter === t.tier }"
          @click="tierFilter = t.tier"
        >
          {{ t.name }}
        </button>
        <span class="ca__count num">{{ pets.length }} 只</span>
      </div>

      <table class="ca__table">
        <thead>
          <tr>
            <th>名称</th><th>注音</th><th>品阶</th><th>卦属</th><th>风格</th><th>出处</th><th>立绘</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in pets" :key="p.id">
            <td class="ca__name">{{ p.name }}</td>
            <td class="ca__pinyin">{{ p.pinyin }}</td>
            <td>{{ tierLabel(p.tier) }}</td>
            <td>{{ trigramGlyphs(p.trigram) }} {{ trigramLabel(p.trigram) }}</td>
            <td>{{ styleName(p.style) }}</td>
            <td class="ca__src">{{ p.source }}</td>
            <td>
              <span v-if="!checked" class="ca__muted">未检查</span>
              <span v-else-if="missing.has(p.id)" class="ca__miss">缺</span>
              <span v-else class="ca__ok">有</span>
            </td>
          </tr>
        </tbody>
      </table>
    </main>

    <!-- 皮肤 -->
    <main v-else-if="tab === 'skins'" class="ca__body">
      <table class="ca__table">
        <thead>
          <tr><th>名称</th><th>性别</th><th>主题</th><th>价格（G6）</th><th>获取方式</th></tr>
        </thead>
        <tbody>
          <tr v-for="s in skins" :key="s.id">
            <td class="ca__name">{{ s.name }}</td>
            <td>{{ s.gender === 'male' ? '男' : '女' }}</td>
            <td>{{ s.theme }}</td>
            <td class="num">{{ skinPrice(s, 6) === 0 ? '—' : skinPrice(s, 6) }}</td>
            <td class="ca__muted">{{ s.unlock ? `解锁：${s.unlock.type}` : skinPrice(s, 6) === 0 ? '默认/毕业发放' : '集市购买' }}</td>
          </tr>
        </tbody>
      </table>
    </main>

    <!-- 任务 -->
    <main v-else-if="tab === 'quests'" class="ca__body">
      <section class="ca__group">
        <h2>每日（{{ dailyQuests.length }}）</h2>
        <table class="ca__table">
          <thead><tr><th>名称</th><th>条件</th><th>奖励</th></tr></thead>
          <tbody>
            <tr v-for="q in dailyQuests" :key="q.id">
              <td class="ca__name">{{ q.name }}</td>
              <td>{{ condText(q.cond) }}</td>
              <td>{{ rewardText(q.reward) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="ca__group">
        <h2>每周（{{ weeklyQuests.length }}）</h2>
        <table class="ca__table">
          <thead><tr><th>名称</th><th>条件</th><th>奖励</th></tr></thead>
          <tbody>
            <tr v-for="q in weeklyQuests" :key="q.id">
              <td class="ca__name">{{ q.name }}</td>
              <td>{{ condText(q.cond) }}</td>
              <td>{{ rewardText(q.reward) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>

    <!-- 成就 -->
    <main v-else class="ca__body">
      <table class="ca__table">
        <thead><tr><th>印章</th><th>名称</th><th>分类</th><th>说明</th><th>条件</th><th>奖励</th></tr></thead>
        <tbody>
          <tr v-for="a in ACHIEVEMENTS" :key="a.id">
            <td class="ca__seal">{{ a.seal }}</td>
            <td class="ca__name">{{ a.name }}</td>
            <td>{{ a.category }}</td>
            <td class="ca__muted">{{ a.desc }}</td>
            <td>{{ condText(a.cond) }}</td>
            <td>{{ rewardText(a.reward) }}</td>
          </tr>
        </tbody>
      </table>
    </main>

    <footer class="ca__foot">
      内容源在 <code>docs/seeds/*.json</code>：新增一条 = 插一行 + 传图，前端自动生效。
      价格为 G6 基准，G7 按 {{ 60 }}% 结算。
    </footer>
  </div>
</template>

<style scoped>
.ca {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding-bottom: 30px;
}

.ca__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(28, 28, 36, 0.18);
  box-shadow: 0 2px 10px rgba(28, 28, 36, 0.07);
}
.ca__back {
  padding: 7px 14px;
  font-family: var(--font-title);
  font-size: 13px;
  color: var(--ink);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.ca__title h1 {
  margin: 0;
  font-family: var(--font-title);
  font-size: 20px;
  letter-spacing: 0.12em;
}
.ca__title p {
  margin: 1px 0 0;
  font-size: 11px;
  color: var(--ink-2);
}
.ca__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.ca__badge {
  padding: 4px 10px;
  font-size: 11px;
  color: var(--cinnabar);
  border: 1px solid rgba(96, 96, 96, 0.35);
  background: rgba(96, 96, 96, 0.08);
  border-radius: var(--r-sm);
}
.ca__badge.is-ok {
  color: var(--stone-green);
  border-color: rgba(101, 101, 101, 0.35);
  background: rgba(101, 101, 101, 0.08);
}

.ca__tabs {
  display: flex;
  gap: 6px;
  padding: 12px 20px 0;
}
.ca__tab {
  padding: 7px 16px;
  font-family: var(--font-title);
  font-size: 14px;
  letter-spacing: 0.08em;
  color: var(--ink-2);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.18);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.ca__tab.is-on {
  color: #f7f7f7;
  background: linear-gradient(180deg, #2b2b2b, var(--cinnabar-d));
  border-color: var(--cinnabar-d);
}
.ca__tab b {
  font-weight: 700;
  opacity: 0.8;
}

.ca__body {
  flex: 1;
  padding: 12px 20px 0;
}
.ca__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}
.ca__search {
  width: 220px;
  padding: 6px 10px;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--ink);
  background: rgba(255, 253, 246, 0.9);
  border: 1px solid rgba(28, 28, 36, 0.2);
  border-radius: var(--r-sm);
}
.ca__chip {
  padding: 5px 12px;
  font-family: var(--font-title);
  font-size: 12px;
  color: var(--ink-2);
  background: rgba(255, 253, 246, 0.75);
  border: 1px solid rgba(28, 28, 36, 0.18);
  border-radius: 999px;
  cursor: pointer;
}
.ca__chip.is-on {
  color: #f7f7f7;
  background: linear-gradient(180deg, #2b2b2b, var(--cinnabar-d));
  border-color: var(--cinnabar-d);
}
.ca__count {
  margin-left: auto;
  font-size: 11px;
  color: var(--ink-3);
}

.ca__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  background: rgba(255, 253, 246, 0.6);
  border: 1px solid rgba(28, 28, 36, 0.14);
}
.ca__table th,
.ca__table td {
  padding: 7px 10px;
  text-align: left;
  border-bottom: 1px solid rgba(28, 28, 36, 0.08);
}
.ca__table th {
  font-family: var(--font-title);
  font-weight: 600;
  color: var(--ink);
  background: rgba(228, 228, 228, 0.8);
  white-space: nowrap;
}
.ca__table tr:last-child td {
  border-bottom: 0;
}
.ca__name {
  font-family: var(--font-title);
  font-size: 13px;
  color: var(--ink);
}
.ca__pinyin {
  color: var(--ink-2);
  font-size: 11px;
}
.ca__src,
.ca__muted {
  color: var(--ink-3);
}
.ca__miss {
  color: var(--cinnabar);
  font-weight: 700;
}
.ca__ok {
  color: var(--stone-green);
}
.ca__seal {
  font-family: var(--font-title);
  color: var(--cinnabar);
}

.ca__group {
  margin-bottom: 16px;
}
.ca__group h2 {
  margin: 0 0 6px;
  font-family: var(--font-title);
  font-size: 14px;
  letter-spacing: 0.1em;
  color: var(--ink);
  border-left: 3px solid var(--cinnabar);
  padding-left: 8px;
}

.ca__foot {
  padding: 14px 20px 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--ink-3);
}
.ca__foot code {
  padding: 1px 5px;
  background: rgba(28, 28, 36, 0.07);
  border-radius: 3px;
}

@media (max-width: 720px) {
  .ca__head {
    padding: 10px 12px;
  }
  .ca__actions {
    width: 100%;
    margin-left: 0;
  }
  .ca__body,
  .ca__tabs,
  .ca__foot {
    padding-left: 12px;
    padding-right: 12px;
  }
  .ca__table {
    display: block;
    overflow-x: auto;
  }
}
</style>
