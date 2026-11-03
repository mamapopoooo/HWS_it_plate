<script setup lang="ts">
/**
 * 斗法（v3 重做）
 *
 * 外壳：Vue + CSS（国风水墨战场）；战斗逻辑在 utils/duel.ts（纯函数、可单测）。
 * 特效层目前用 CSS 实现，签名已按 docs/战斗引擎选型.md §5 预留，
 * 后续换 PixiJS / Rive 只替换特效层，不动本页流程。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { calcPower, formName, tierName, trigramGlyphs, trigramLabel } from '@/config/gameConfig'
import { fetchOpponent, reportBattle } from '@/api/adapter'
import { DEMO_OPPONENT } from '@/api/demo'
import {
  createFighter,
  endTurn,
  pickEnemySkill,
  resolveSkill,
  type DuelEvent,
  type DuelFighter,
  type Side,
} from '@/utils/duel'

const router = useRouter()

const PLAYER_PET = 'pet_baihu'
const PLAYER_LEVEL = 7
const PLAYER_AWAKEN = 3

const player = ref<DuelFighter>(createFighter(PLAYER_PET, PLAYER_LEVEL, PLAYER_AWAKEN)!)
const enemy = ref<DuelFighter>(createFighter(DEMO_OPPONENT.petId, DEMO_OPPONENT.level, DEMO_OPPONENT.awakenLevel)!)

const turn = ref(1)
const log = ref<DuelEvent[]>([])
const busy = ref(false)
const over = ref(false)
const winner = ref<Side | null>(null)

/** 飘字与受击抖动（表现层） */
interface FloatText {
  id: number
  side: Side
  text: string
  kind: DuelEvent['kind']
}
const floats = ref<FloatText[]>([])
const shaking = ref<Side | null>(null)
let floatSeq = 0

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const playerHpPercent = computed(() => Math.max(0, (player.value.hp / player.value.maxHp) * 100))
const enemyHpPercent = computed(() => Math.max(0, (enemy.value.hp / enemy.value.maxHp) * 100))

function floatOf(e: DuelEvent) {
  const map: Record<DuelEvent['kind'], string> = {
    hit: `-${e.value}`,
    crit: `-${e.value}!`,
    miss: 'MISS',
    heal: `+${e.value}`,
    shield: `护盾 +${e.value}`,
    buff: `攻击 +${e.value}%`,
    ko: '倒下',
  }
  return map[e.kind]
}

/** 表现层：飘字 + 抖动（换引擎时只改这个函数） */
async function playFx(e: DuelEvent) {
  const target: Side = e.kind === 'heal' || e.kind === 'shield' || e.kind === 'buff' ? e.side : e.side === 'player' ? 'enemy' : 'player'
  const id = ++floatSeq
  floats.value.push({ id, side: target, text: floatOf(e), kind: e.kind })
  if (e.kind === 'hit' || e.kind === 'crit' || e.kind === 'ko') {
    shaking.value = target
    setTimeout(() => (shaking.value = null), 260)
  }
  setTimeout(() => {
    floats.value = floats.value.filter((f) => f.id !== id)
  }, 900)
  await sleep(340)
}

async function runEvents(events: DuelEvent[]) {
  for (const e of events) {
    log.value.push(e)
    await playFx(e)
  }
}

/** 对手参数：先按占位创建，匹配接口返回后替换 */
const opponentSpec = ref({
  petId: DEMO_OPPONENT.petId,
  level: DEMO_OPPONENT.level,
  awakenLevel: DEMO_OPPONENT.awakenLevel,
})

function makeEnemy(): DuelFighter {
  const s = opponentSpec.value
  return createFighter(s.petId, s.level, s.awakenLevel) ?? createFighter(DEMO_OPPONENT.petId, 7, 3)!
}

onMounted(async () => {
  const myPower = calcPower(player.value.tier, player.value.level, player.value.awaken)
  const opp = await fetchOpponent(myPower)
  opponentSpec.value = { petId: opp.petId, level: opp.level, awakenLevel: opp.awakenLevel }
  enemy.value = makeEnemy()
})

function checkOver() {
  if (enemy.value.hp <= 0) {
    over.value = true
    winner.value = 'player'
    void reportBattle({ winner: 'player', turns: turn.value, playerPetId: PLAYER_PET })
    return true
  }
  if (player.value.hp <= 0) {
    over.value = true
    winner.value = 'enemy'
    void reportBattle({ winner: 'enemy', turns: turn.value, playerPetId: PLAYER_PET })
    return true
  }
  return false
}

/** 玩家出手 → 敌方反击 → 回合结束 */
async function cast(skillCode: string) {
  if (busy.value || over.value) return
  busy.value = true

  const pEvents = resolveSkill(player.value, enemy.value, skillCode, 'player')
  await runEvents(pEvents)

  if (!checkOver()) {
    await sleep(260)
    const enemySkill = pickEnemySkill(enemy.value)
    const eEvents = resolveSkill(enemy.value, player.value, enemySkill, 'enemy')
    await runEvents(eEvents)
    checkOver()
  }

  if (!over.value) {
    endTurn(player.value)
    endTurn(enemy.value)
    turn.value += 1
  }
  busy.value = false
}

function restart() {
  player.value = createFighter(PLAYER_PET, PLAYER_LEVEL, PLAYER_AWAKEN)!
  enemy.value = makeEnemy()
  turn.value = 1
  log.value = []
  floats.value = []
  over.value = false
  winner.value = null
  busy.value = false
}

function back() {
  void router.push('/lobby')
}
</script>

<template>
  <div class="duel gw-paper">
    <div class="gw-mountain duel__mt" aria-hidden="true" />
    <div class="gw-mountain gw-mountain--near duel__mt" aria-hidden="true" />

    <header class="duel__head">
      <button class="duel__back" @click="back">← 大厅</button>
      <div class="duel__turn">
        <span class="duel__turn-label">第</span>
        <b class="num">{{ turn }}</b>
        <span class="duel__turn-label">回合</span>
      </div>
      <div class="duel__hint">对宫互冲 ×1.3 · 暴击 12% · 闪避 8%</div>
    </header>

    <main class="duel__field">
      <!-- 敌方 -->
      <section class="fighter fighter--enemy" :class="{ 'is-hit': shaking === 'enemy' }">
        <div class="fighter__card">
          <div class="fighter__row">
            <span class="fighter__name">{{ enemy.name }}</span>
            <span class="fighter__tier">{{ tierName(enemy.tier) }}</span>
          </div>
          <div class="fighter__pinyin">{{ enemy.pinyin }}</div>
          <div class="fighter__bar">
            <i :style="{ width: enemyHpPercent + '%' }" />
          </div>
          <div class="fighter__nums num">{{ enemy.hp }} / {{ enemy.maxHp }}</div>
          <div class="fighter__tags">
            <span>{{ trigramGlyphs(enemy.trigram) }} {{ trigramLabel(enemy.trigram) }}</span>
            <span v-if="enemy.shield > 0">护盾 {{ enemy.shield }}</span>
          </div>
        </div>

        <div class="fighter__avatar">
          <span class="fighter__glyph">{{ trigramGlyphs(enemy.trigram) }}</span>
          <span class="fighter__form">{{ formName(enemy.awaken + 1) }}</span>
        </div>

        <div v-for="f in floats.filter((x) => x.side === 'enemy')" :key="f.id" class="float" :data-kind="f.kind">
          {{ f.text }}
        </div>
      </section>

      <!-- 场地中心 -->
      <div class="duel__center">
        <div class="duel__seal">斗</div>
        <div class="duel__ground" />
      </div>

      <!-- 我方 -->
      <section class="fighter fighter--player" :class="{ 'is-hit': shaking === 'player' }">
        <div class="fighter__avatar">
          <span class="fighter__glyph">{{ trigramGlyphs(player.trigram) }}</span>
          <span class="fighter__form">{{ formName(player.awaken + 1) }}</span>
        </div>

        <div class="fighter__card">
          <div class="fighter__row">
            <span class="fighter__name">{{ player.name }}</span>
            <span class="fighter__tier">{{ tierName(player.tier) }}</span>
          </div>
          <div class="fighter__pinyin">{{ player.pinyin }} · Lv.{{ player.level }}</div>
          <div class="fighter__bar fighter__bar--jade">
            <i :style="{ width: playerHpPercent + '%' }" />
          </div>
          <div class="fighter__nums num">{{ player.hp }} / {{ player.maxHp }}</div>
          <div class="fighter__tags">
            <span>{{ trigramGlyphs(player.trigram) }} {{ trigramLabel(player.trigram) }}</span>
            <span v-if="player.shield > 0">护盾 {{ player.shield }}</span>
            <span v-if="player.buffTurns > 0">攻击 +{{ Math.round(player.atkBuff * 100) }}%</span>
          </div>
        </div>

        <div v-for="f in floats.filter((x) => x.side === 'player')" :key="f.id" class="float" :data-kind="f.kind">
          {{ f.text }}
        </div>
      </section>
    </main>

    <!-- 操作与日志 -->
    <footer class="duel__foot">
      <div class="ops">
        <button
          v-for="s in player.skills"
          :key="s.code"
          class="gw-seal ops__skill"
          :disabled="busy || over || s.remain > 0"
          @click="cast(s.code)"
        >
          {{ s.name }}
          <span v-if="s.remain > 0" class="ops__cd num">CD {{ s.remain }}</span>
          <span v-else class="ops__cost num">{{ s.cost }} 灵力</span>
        </button>
        <button class="gw-seal ops__skill" disabled>切换（待开放）</button>
      </div>

      <div class="log gw-scroll">
        <div class="log__head">
          战况
          <span class="num">{{ log.length }} 条</span>
        </div>
        <div class="log__body">
          <p v-if="log.length === 0" class="log__empty">选一个技能开始斗法。</p>
          <p v-for="(e, i) in log" :key="i" :data-kind="e.kind">{{ e.message }}</p>
        </div>
      </div>
    </footer>

    <!-- 结算 -->
    <div v-if="over" class="result">
      <div class="result__card">
        <h2>{{ winner === 'player' ? '胜' : '败' }}</h2>
        <p>{{ winner === 'player' ? `${player.name} 站到了最后` : `${enemy.name} 赢了这一场` }}</p>
        <p class="result__fine">共 {{ turn }} 回合 · 战斗逻辑与表现层已解耦，可换服务端权威结算</p>
        <div class="result__ops">
          <button class="gw-seal gw-seal--primary" @click="restart">再来一局</button>
          <button class="gw-seal" @click="back">返回大厅</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.duel {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  overflow: hidden;
}

.duel__mt {
  z-index: 0;
}

.duel__head {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(28, 28, 36, 0.16);
  background: linear-gradient(180deg, rgba(242, 232, 213, 0.96), rgba(242, 232, 213, 0.6));
}
.duel__back {
  padding: 7px 14px;
  font-family: var(--font-title);
  font-size: 13px;
  color: var(--ink);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.duel__turn {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-family: var(--font-title);
  color: var(--ink);
}
.duel__turn b {
  font-size: 20px;
  color: var(--cinnabar);
}
.duel__turn-label {
  font-size: 12px;
  color: var(--ink-2);
}
.duel__hint {
  margin-left: auto;
  font-size: 11px;
  color: var(--ink-3);
}

/* ---------- 战场 ---------- */
.duel__field {
  position: relative;
  z-index: 2;
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 200px 1fr;
  align-items: center;
  gap: 10px;
  padding: 18px 24px;
  min-height: 0;
}

.fighter {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
}
.fighter--enemy {
  flex-direction: row-reverse;
  text-align: right;
}
.fighter.is-hit {
  animation: duel-shake 0.26s ease-in-out;
}
@keyframes duel-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  75% { transform: translateX(6px); }
}

/* 立绘位：缺图时用卦象字符，尺寸按正式立绘预留 */
.fighter__avatar {
  position: relative;
  display: grid;
  place-items: center;
  width: 168px;
  height: 200px;
  flex: none;
  background: radial-gradient(circle at 50% 45%, rgba(255, 253, 246, 0.9), rgba(232, 220, 194, 0.5));
  border: 1px solid rgba(28, 28, 36, 0.16);
  border-radius: 10px;
  box-shadow: inset 0 0 0 3px rgba(255, 253, 246, 0.45);
}
.fighter__glyph {
  font-family: var(--font-title);
  font-size: 62px;
  color: rgba(28, 28, 36, 0.22);
}
.fighter__form {
  position: absolute;
  bottom: 6px;
  font-size: 10px;
  color: var(--ink-3);
}

.fighter__card {
  flex: 1;
  min-width: 0;
  padding: 10px 14px;
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.2);
  border-radius: var(--r-md);
  box-shadow: var(--sh-inset), var(--sh-paper);
}
.fighter__row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.fighter--enemy .fighter__row {
  flex-direction: row-reverse;
}
.fighter__name {
  font-family: var(--font-title);
  font-size: 17px;
  letter-spacing: 0.06em;
  color: var(--ink);
}
.fighter__tier {
  padding: 1px 6px;
  font-family: var(--font-title);
  font-size: 10px;
  color: #f7efe0;
  background: var(--cinnabar);
  border-radius: 2px;
}
.fighter--enemy .fighter__tier {
  background: var(--stone-blue);
}
.fighter__pinyin {
  font-size: 10px;
  color: var(--ink-3);
}
.fighter__bar {
  height: 9px;
  margin: 6px 0 3px;
  border-radius: 999px;
  background: rgba(28, 28, 36, 0.14);
  overflow: hidden;
}
.fighter__bar > i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #b8402f, #d9745f);
  transition: width var(--d-base) var(--e-out);
}
.fighter__bar--jade > i {
  background: linear-gradient(90deg, #5f9a7c, #9ccbb0);
}
.fighter__nums {
  font-size: 11px;
  color: var(--ink-2);
}
.fighter__tags {
  display: flex;
  gap: 6px;
  font-size: 10px;
  color: var(--ink-3);
}
.fighter--enemy .fighter__tags {
  justify-content: flex-end;
}

/* 飘字 */
.float {
  position: absolute;
  top: 18%;
  font-family: var(--font-title);
  font-size: 26px;
  font-weight: 700;
  color: var(--cinnabar);
  text-shadow: 0 2px 6px rgba(255, 253, 246, 0.8);
  animation: float-up 900ms var(--e-out) forwards;
  pointer-events: none;
}
.fighter--enemy .float {
  left: 30%;
}
.fighter--player .float {
  right: 30%;
}
.float[data-kind='heal'] {
  color: var(--stone-green);
}
.float[data-kind='shield'],
.float[data-kind='buff'] {
  color: var(--stone-blue);
  font-size: 18px;
}
.float[data-kind='crit'] {
  font-size: 34px;
  color: #8e2a20;
}
.float[data-kind='miss'] {
  color: var(--ink-3);
  font-size: 18px;
}
@keyframes float-up {
  0% { opacity: 0; transform: translateY(10px) scale(0.9); }
  25% { opacity: 1; transform: translateY(0) scale(1.05); }
  100% { opacity: 0; transform: translateY(-46px) scale(1); }
}

/* 场地中心 */
.duel__center {
  position: relative;
  display: grid;
  place-items: center;
  height: 100%;
}
.duel__seal {
  display: grid;
  place-items: center;
  width: 86px;
  height: 86px;
  font-family: var(--font-title);
  font-size: 40px;
  color: #f7efe0;
  background: linear-gradient(160deg, #ce4436, #8e2a20);
  border-radius: 8px;
  transform: rotate(-6deg);
  box-shadow: inset 0 0 0 3px rgba(247, 239, 224, 0.4), 0 10px 24px rgba(142, 42, 32, 0.3);
  opacity: 0.9;
}
.duel__ground {
  position: absolute;
  bottom: 6%;
  width: 100%;
  height: 26px;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(28, 28, 36, 0.16), transparent 70%);
}

/* ---------- 操作与日志 ---------- */
.duel__foot {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 14px;
  padding: 0 20px 18px;
}

.ops {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 8px;
}
.ops__skill {
  min-height: 46px;
  padding: 8px 18px;
  font-size: 14px;
  flex-direction: column;
  gap: 1px;
}
.ops__cd {
  font-size: 10px;
  color: var(--cinnabar);
}
.ops__cost {
  font-size: 10px;
  opacity: 0.7;
}

.log {
  max-height: 168px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.log__head {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-title);
  font-size: 12px;
  letter-spacing: 0.1em;
  color: var(--ink);
  padding-bottom: 6px;
  margin-bottom: 6px;
  border-bottom: 1px solid rgba(28, 28, 36, 0.14);
}
.log__body {
  flex: 1;
  overflow-y: auto;
  font-size: 11px;
  line-height: 1.7;
  color: var(--ink-2);
}
.log__body p {
  margin: 0;
}
.log__body p[data-kind='crit'] {
  color: var(--cinnabar);
  font-weight: 700;
}
.log__body p[data-kind='ko'] {
  color: var(--cinnabar);
}
.log__empty {
  color: var(--ink-3);
}

/* ---------- 结算 ---------- */
.result {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  background: rgba(20, 16, 12, 0.55);
  backdrop-filter: blur(2px);
}
.result__card {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 26px 34px;
  background: linear-gradient(180deg, #fbf5e8, #e8dcc2);
  border: 1px solid rgba(28, 28, 36, 0.3);
  border-radius: var(--r-lg);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
  text-align: center;
}
.result__card h2 {
  margin: 0;
  font-family: var(--font-title);
  font-size: 46px;
  letter-spacing: 0.2em;
  color: var(--cinnabar);
}
.result__card p {
  margin: 0;
  font-size: 13px;
  color: var(--ink-2);
}
.result__fine {
  font-size: 11px;
  color: var(--ink-3);
}
.result__ops {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}

@media (max-width: 900px) {
  .duel__field {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
    padding: 12px;
    gap: 6px;
  }
  .duel__center {
    display: none;
  }
  .fighter,
  .fighter--enemy {
    flex-direction: row;
    text-align: left;
  }
  .fighter__avatar {
    width: 96px;
    height: 116px;
  }
  .fighter__glyph {
    font-size: 38px;
  }
  .duel__foot {
    grid-template-columns: 1fr;
    padding: 0 12px 14px;
  }
  .ops__skill {
    flex: 1;
    min-width: 45%;
  }
  .log {
    max-height: 120px;
  }
  .duel__hint {
    display: none;
  }
}
</style>
