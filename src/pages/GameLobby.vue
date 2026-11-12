<script setup lang="ts">
/**
 * 学生端主界面 · 太极盘大厅（M1 视觉切片）
 *
 * 当前数据为种子/占位：M2 接 /api/v2/trainer/me 与 /api/v2/pets/my 后，
 * 只需替换 buildDemoState 部分，模板与组件不动（00-总纲 P1）。
 */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchEvents, fetchProfile } from '@/api/adapter'
import { DEMO_PROFILE } from '@/api/demo'
import type { Profile } from '@/api/types'
import { activeEvents, eventPhase } from '@/config/contentConfig'
import type { EventDef } from '@/config/contentConfig'
import GameHud from '@/components/layout/GameHud.vue'
import GameDock, { type DockItem } from '@/components/layout/GameDock.vue'
import TaijiAltar from '@/components/pet/TaijiAltar.vue'
import NamePlate from '@/components/pet/NamePlate.vue'
import {
  TIERS,
  calcPower,
  formName,
  getPet,
  getTier,
  styleName,
  tierName,
  trigramGlyphs,
  trigramLabel,
} from '@/config/gameConfig'

const router = useRouter()

/** 玩家档案：由 adapter 填充（真接口优先，未就绪回落占位） */
const profile = ref<Profile>(DEMO_PROFILE)

/** 进行中的活动（右侧榜文面板） */
const activeEventList = ref<EventDef[]>(activeEvents())

onMounted(async () => {
  profile.value = await fetchProfile()
  const list = await fetchEvents()
  activeEventList.value = list.filter((e) => eventPhase(e) === 'active')
})

/* ---------------- 占位数据（M2 换接口） ---------------- */

/**
 * 占位数据：只写「玩家侧」的个体差异（等级/觉醒/立绘）。
 * 名称、注音、风格、卦属一律从宠物库（docs/seeds/pets.json → PETS）读取，
 * 不在组件里另存一份，避免与数据库不一致。
 */
interface DemoSlot {
  petId: string
  level: number
  awaken: number
  image: string
}

const DEMO_SLOTS: DemoSlot[] = [
  { petId: 'pet_jiuweihu', level: 3, awaken: 0, image: '/pet-garden/pets/white-tiger/lv1.png' },
  { petId: 'pet_baize', level: 4, awaken: 1, image: '/pet-garden/pets/white-tiger/lv4.png' },
  { petId: 'pet_baihu', level: 7, awaken: 3, image: '/pet-garden/pets/white-tiger/lv7.png' },
  { petId: 'pet_yinyu', level: 7, awaken: 4, image: '/pet-garden/pets/white-tiger/lv8.png' },
]

interface PetView {
  id: string
  name: string
  pinyin: string
  style: string
  tier: number
  trigram: string
  level: number
  awaken: number
  image: string
}

/** 宠物库 + 玩家实例合并；库中缺 id 时自动跳过，不产生半成品数据 */
const demoPets = computed<Record<number, PetView>>(() => {
  const map: Record<number, PetView> = {}
  for (const slot of DEMO_SLOTS) {
    const tpl = getPet(slot.petId)
    if (!tpl) continue
    map[tpl.tier] = {
      id: tpl.id,
      name: tpl.name,
      pinyin: tpl.pinyin,
      style: tpl.style,
      tier: tpl.tier,
      trigram: tpl.trigram,
      level: slot.level,
      awaken: slot.awaken,
      image: slot.image,
    }
  }
  return map
})

const dockItems: DockItem[] = [
  { key: 'battle', label: '斗法', glyph: '战' },
  { key: 'collection', label: '图鉴', glyph: '册' },
  { key: 'ranking', label: '封神榜', glyph: '榜' },
  { key: 'shop', label: '集市', glyph: '市' },
  { key: 'quests', label: '课业', glyph: '课' },
  { key: 'achievements', label: '功名册', glyph: '印' },
  { key: 'pets', label: '灵宠', glyph: '宠' },
]

/** 只给已建好的页面跳转，未建的按钮保持禁用（不留死链） */
const DOCK_ROUTES: Record<string, string> = {
  battle: '/duel',
  collection: '/collection',
  ranking: '/ranking',
  shop: '/shop',
  quests: '/quests',
  achievements: '/achievements',
  pets: '/student/pets',
}

function onDock(key: string) {
  const path = DOCK_ROUTES[key]
  if (path) void router.push(path)
}

const quests = [
  { text: '入馆签到', reward: '+5', done: true },
  { text: '喂食一次', reward: '+20', done: true },
  { text: '览封神榜', reward: '+10', done: true },
  { text: '斗法三场（1/3）', reward: '+30', done: false },
]

/* ---------------- 交互状态 ---------------- */

const activeTier = ref(3)
const happy = ref(false)
let happyTimer: ReturnType<typeof setTimeout> | undefined

const current = computed<PetView | null>(() => demoPets.value[activeTier.value] ?? null)
const currentTier = computed(() => getTier(activeTier.value))
const accent = computed(() => currentTier.value?.bezelColor ?? '#c9a227')
const aura = computed(() => Math.min(1, 0.2 + activeTier.value * 0.16))
const power = computed(() =>
  current.value ? calcPower(current.value.tier, current.value.level, current.value.awaken) : 0,
)

function selectTier(tier: number) {
  activeTier.value = tier
}

function onTouch() {
  happy.value = false
  void requestAnimationFrame(() => {
    happy.value = true
    if (happyTimer) clearTimeout(happyTimer)
    happyTimer = setTimeout(() => (happy.value = false), 1500)
  })
}

function goBattle() {
  void router.push('/duel')
}

function goGacha() {
  void router.push('/gacha')
}

onUnmounted(() => {
  if (happyTimer) clearTimeout(happyTimer)
})
</script>

<template>
  <div class="lobby gw-paper gw-lobby-bg">
    <!-- 云气层：两团极淡的云以不同速度横移，营造"云在走"的呼吸感（纯 CSS，无额外素材） -->
    <div class="lobby__fx" aria-hidden="true">
      <i class="cloud cloud--a" />
      <i class="cloud cloud--b" />
    </div>

    <GameHud
      :display-name="profile.displayName"
      :grade="profile.grade"
      :class-name="profile.className"
      :realm="profile.realm"
      :level="profile.trainerLevel"
      :points="profile.points"
      :today-points="profile.todayPoints"
      :duels-today="profile.duelsToday"
      :shards="profile.shards"
      :gender="profile.gender"
      @settings="() => {}"
      @avatar="() => router.push('/character')"
    />

    <div class="lobby__body">
      <GameDock :items="dockItems" active="battle" @select="onDock" />

      <main class="stage">
        <!-- 品阶切换（配置驱动，加第六阶会自动出现） -->
        <div class="stage__tabs">
          <button
            v-for="tier in TIERS"
            :key="tier.tier"
            class="stage__tab"
            :class="{ 'is-on': tier.tier === activeTier }"
            @click="selectTier(tier.tier)"
          >
            {{ tier.name }}
          </button>
        </div>

        <!-- 有宠物 -->
        <template v-if="current">
          <TaijiAltar
            :image="current.image"
            :alt="`${current.name} · ${formName(current.awaken + 1)}`"
            :tier="current.tier"
            :accent="accent"
            :aura="aura"
            :fallback-glyph="trigramGlyphs(current.trigram)"
            :happy="happy"
          />
          <NamePlate
            :name="current.name"
            :pinyin="current.pinyin"
            :tier-name="tierName(current.tier)"
            :trigram-text="`${trigramGlyphs(current.trigram)} ${trigramLabel(current.trigram)}`"
            :form-text="formName(current.awaken + 1)"
            :level="current.level"
            :accent="accent"
          />
          <div class="stage__meta">
            <span class="stage__style" :data-style="current.style">{{ styleName(current.style) }}</span>
            <span class="stage__power num">战力 {{ power }}</span>
            <button class="stage__touch" @click="onTouch">摸头</button>
            <span class="stage__tip">立绘为占位素材，正式美术按 §7 规范出图</span>
          </div>
        </template>

        <!-- 无极：尚未造物 -->
        <template v-else>
          <div class="stage__empty">
            <div class="stage__empty-glyph">☯</div>
            <p class="stage__empty-title">无极 · 尚待造物</p>
            <p class="stage__empty-desc">
              集齐阴鱼与阳鱼后，可开启「造物」，创作只属于你的一只神兽。
            </p>
            <button class="gw-seal gw-seal--primary" disabled>前往造物（待开放）</button>
          </div>
        </template>
      </main>

      <!-- 右侧卷轴 -->
      <aside class="side">
        <section class="gw-scroll side__panel">
          <div class="gw-scroll-head">
            <span>每日课业</span>
            <em class="side__reset num">03:21</em>
          </div>
          <div
            v-for="q in quests"
            :key="q.text"
            class="side__quest"
            :class="{ 'is-done': q.done }"
          >
            <i class="side__dot" />
            <span class="side__qtext">{{ q.text }}</span>
            <span class="side__reward num">{{ q.reward }}</span>
          </div>
          <div class="side__bar"><i style="width: 75%" /></div>
        </section>

        <section class="gw-scroll side__panel">
          <div class="gw-scroll-head">
            <span>节气榜文</span>
            <em>
              <a class="side__more" @click="router.push('/events')">全部 {{ activeEventList.length }} 个 →</a>
            </em>
          </div>
          <p v-if="activeEventList.length === 0" class="side__notice">暂无进行中的活动。</p>
          <p v-for="e in activeEventList.slice(0, 2)" :key="e.id" class="side__notice side__event">
            <b>{{ e.name }}</b>
            <span class="side__dates num">{{ e.endDate }}</span>
            <span class="side__edesc">{{ e.desc }}</span>
          </p>
        </section>

        <section class="gw-scroll side__panel side__panel--grow">
          <div class="gw-scroll-head"><span>同道</span><em>在线 6</em></div>
          <div class="side__quest"><i class="side__dot side__dot--green" /><span class="side__qtext">王小二 化相觉醒</span></div>
          <div class="side__quest"><i class="side__dot side__dot--purple" /><span class="side__qtext">张三 求签得八卦</span></div>
          <div class="side__quest"><i class="side__dot side__dot--blue" /><span class="side__qtext">赵六 升筑基五层</span></div>
        </section>
      </aside>
    </div>

    <footer class="cta">
      <button class="gw-seal gw-seal--primary" @click="goBattle">
        斗法<span class="gw-seal__hint">耗 1 卦力</span>
      </button>
      <button class="gw-seal" @click="goGacha">求签<span class="gw-seal__hint">十连 45 灵石</span></button>
      <button class="gw-seal" @click="() => router.push('/ranking')">封神榜</button>
    </footer>

    <!-- 水墨远山压在最底层 -->
    <div class="gw-mountain lobby__mt" aria-hidden="true" />
    <div class="gw-mountain gw-mountain--near lobby__mt" aria-hidden="true" />
  </div>
</template>

<style scoped>
.lobby {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  overflow: hidden;
}

/* ---------- 云气层 ---------- */
.lobby__fx {
  position: absolute;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}
.cloud {
  position: absolute;
  border-radius: 50%;
  filter: blur(30px);
  background: radial-gradient(closest-side, rgba(255, 253, 246, 0.92), rgba(255, 253, 246, 0));
  will-change: transform;
}
.cloud--a {
  width: 46%;
  height: 24%;
  left: -12%;
  top: 20%;
  opacity: 0.55;
  animation: cloud-drift-a 110s linear infinite;
}
.cloud--b {
  width: 34%;
  height: 16%;
  right: -10%;
  top: 54%;
  opacity: 0.38;
  animation: cloud-drift-b 150s linear infinite;
}
@keyframes cloud-drift-a {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(34vw, -2vh, 0);
  }
}
@keyframes cloud-drift-b {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(-28vw, 1.5vh, 0);
  }
}

/* 减少动态：关掉云气动画（系统级无障碍设置） */
@media (prefers-reduced-motion: reduce) {
  .cloud {
    animation: none;
  }
}

.lobby__mt {
  z-index: 0;
}

.lobby__body {
  position: relative;
  z-index: 2;
  flex: 1;
  display: grid;
  grid-template-columns: var(--dock-w) 1fr var(--side-w);
  min-height: 0;
}

/* ---------- 中央舞台 ---------- */
.stage {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 12px 18px;
  min-width: 0;
}

.stage__tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: rgba(255, 253, 246, 0.78);
  border: 1px solid rgba(28, 28, 36, 0.18);
  border-radius: 999px;
  box-shadow: var(--sh-inset);
}
.stage__tab {
  padding: 6px 15px;
  font-family: var(--font-title);
  font-size: 13px;
  letter-spacing: 0.1em;
  color: var(--ink-2);
  background: transparent;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  transition: color var(--d-quick), background var(--d-quick), box-shadow var(--d-quick);
}
.stage__tab:hover {
  color: var(--ink);
}
.stage__tab.is-on {
  color: #f7efe0;
  background: linear-gradient(180deg, #ce4436, var(--cinnabar-d));
  box-shadow: 0 2px 6px rgba(142, 42, 32, 0.3);
}

.stage__meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}
.stage__power {
  font-size: 13px;
  color: var(--cinnabar);
  font-weight: 700;
}

/* 风格标签：萌/俊/雅/奇 各一色，让学生一眼分得清路线 */
.stage__style {
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  border-radius: 999px;
  border: 1px solid currentColor;
  color: var(--ink-2);
}
.stage__style[data-style='meng'] {
  color: #b5637d;
  background: rgba(212, 84, 107, 0.1);
}
.stage__style[data-style='jun'] {
  color: var(--stone-blue);
  background: rgba(46, 92, 138, 0.1);
}
.stage__style[data-style='ya'] {
  color: var(--stone-green);
  background: rgba(62, 124, 89, 0.1);
}
.stage__style[data-style='qi'] {
  color: var(--trigram-zhen);
  background: rgba(109, 76, 159, 0.1);
}
.stage__touch {
  padding: 5px 14px;
  font-family: var(--font-title);
  font-size: 13px;
  letter-spacing: 0.1em;
  color: var(--ink);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: transform var(--d-instant) var(--e-out);
}
.stage__touch:active {
  transform: scale(0.96);
}
.stage__tip {
  font-size: 11px;
  color: var(--ink-3);
}

/* 无极空位 */
.stage__empty {
  flex: 1;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 8px;
  text-align: center;
}
.stage__empty-glyph {
  font-size: 76px;
  line-height: 1;
  color: rgba(28, 28, 36, 0.18);
  animation: gw-float 4.2s ease-in-out infinite;
}
.stage__empty-title {
  font-family: var(--font-title);
  font-size: 18px;
  letter-spacing: 0.12em;
  margin: 0;
}
.stage__empty-desc {
  max-width: 300px;
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--ink-2);
}

/* ---------- 右栏 ---------- */
.side {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 14px 18px 0;
  min-width: 0;
}
.side__panel {
  padding: 10px 12px;
}
.side__panel--grow {
  flex: 1;
}
.side__reset {
  font-style: normal;
  font-family: var(--font-num);
  font-size: 12px;
  color: var(--cinnabar);
}
.side__quest {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 3px 0;
  font-size: 12px;
  color: var(--ink-2);
}
.side__dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: 1px solid rgba(28, 28, 36, 0.35);
}
.side__quest.is-done .side__dot {
  background: var(--stone-green);
  border-color: var(--stone-green);
}
.side__dot--green {
  background: var(--stone-green);
}
.side__dot--purple {
  background: var(--trigram-zhen);
}
.side__dot--blue {
  background: var(--stone-blue);
}
.side__qtext {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.side__quest.is-done .side__qtext {
  color: var(--ink-3);
  text-decoration: line-through;
}
.side__reward {
  font-size: 11px;
  font-weight: 700;
  color: var(--cinnabar);
}
.side__bar {
  height: 5px;
  margin-top: 7px;
  border-radius: 999px;
  background: rgba(28, 28, 36, 0.12);
  overflow: hidden;
}
.side__bar > i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--stone-green), var(--jade));
}
.side__notice {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--ink-2);
}
.side__notice b {
  color: var(--cinnabar);
}
.side__event {
  display: block;
  margin: 0 0 6px;
  line-height: 1.5;
}
.side__dates {
  margin-left: 6px;
  font-size: 10px;
  color: var(--ink-3);
}
.side__edesc {
  display: block;
  font-size: 11px;
  color: var(--ink-2);
}
.side__more {
  font-size: 11px;
  color: var(--stone-blue);
  cursor: pointer;
  border-bottom: 1px dotted rgba(46, 92, 138, 0.5);
}

/* ---------- 底部 ---------- */
.cta {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 12px 18px;
  background: linear-gradient(0deg, rgba(232, 220, 194, 0.96), rgba(242, 232, 213, 0.4));
  border-top: 1px solid rgba(28, 28, 36, 0.16);
}

/* ---------- 窄屏 ---------- */
@media (max-width: 900px) {
  .lobby__body {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
  }
  .side {
    display: none;
  }
  .cta {
    flex-direction: column;
    gap: 8px;
    padding: 10px 14px 14px;
  }
  .cta .gw-seal {
    width: 100%;
  }
  .stage__tip {
    display: none;
  }
}
</style>
