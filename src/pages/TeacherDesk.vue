<script setup lang="ts">
/**
 * 教师工作台（v3 国风皮肤）
 *
 * 与学生在的游戏大厅不同：教师端要的是「找到人 → 点一下加分」，
 * 所以保留卡片网格与信息密度，只把外壳换成国风（00-总纲 §3.6）。
 *
 * 路由暂挂 /teacher（免登录便于验收），M2 迁到 /admin 并加 role 守卫。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { fetchTeacherStudents, syncPoints } from '@/api/adapter'
import { DEMO_STUDENTS } from '@/api/demo'
import type { PointsRecord, TeacherStudent } from '@/api/types'

const router = useRouter()

const students = ref<TeacherStudent[]>(DEMO_STUDENTS)
const className = ref('G6-1 班')
const todayDelta = ref(0)
const pending = ref<PointsRecord[]>([])
const flash = ref<string | null>(null)

async function load() {
  students.value = await fetchTeacherStudents()
}

onMounted(load)

const totalPoints = computed(() => students.value.reduce((s, x) => s + x.points, 0))
const avgPoints = computed(() =>
  students.value.length === 0 ? 0 : Math.round(totalPoints.value / students.value.length),
)

/** 加减分：本地即时反馈 + 进待同步队列 */
function addPoints(s: TeacherStudent, delta: number) {
  s.points = Math.max(0, s.points + delta)
  todayDelta.value += delta
  pending.value.push({ studentNo: s.studentNo, amount: delta, reason: delta > 0 ? '课堂表现' : '扣分' })
  flash.value = `${s.name} ${delta > 0 ? '+' : ''}${delta}`
  setTimeout(() => (flash.value = null), 900)
}

/** 批量提交（接口未就绪时返回 false，队列保留） */
async function flush() {
  if (pending.value.length === 0) return
  const ok = await syncPoints(pending.value)
  if (ok) pending.value = []
}

function goReview() {
  void router.push('/review')
}

function back() {
  void router.push('/lobby')
}
</script>

<template>
  <div class="td gw-paper">
    <header class="td__head">
      <button class="td__back" @click="back">← 学生端</button>
      <div class="td__title">
        <h1>{{ className }}</h1>
        <p>教师工作台 · 加减分即时生效，联网后批量同步</p>
      </div>
      <div class="td__stats">
        <span class="td__stat">人数 <b class="num">{{ students.length }}</b></span>
        <span class="td__stat">人均 <b class="num">{{ avgPoints }}</b></span>
        <span class="td__stat td__stat--hot">今日 <b class="num">{{ todayDelta > 0 ? '+' : '' }}{{ todayDelta }}</b></span>
        <button class="gw-seal td__flush" :disabled="pending.length === 0" @click="flush">
          待同步 <span class="num">{{ pending.length }}</span>
        </button>
        <button class="gw-seal" @click="goReview">造物审核</button>
      </div>
    </header>

    <main class="td__grid">
      <article v-for="s in students" :key="s.id" class="stu">
        <div class="stu__top">
          <span class="stu__seal">{{ s.name.slice(-1) }}</span>
          <div class="stu__who">
            <span class="stu__name">{{ s.name }}</span>
            <span class="stu__no num">{{ s.studentNo }}</span>
          </div>
          <span class="stu__points num">{{ s.points }}</span>
        </div>

        <div class="stu__pet">
          <span class="stu__pet-name">{{ s.petName }}</span>
          <span class="stu__pet-lv num">Lv.{{ s.petLevel }}</span>
        </div>

        <div class="stu__ops">
          <button class="stu__btn stu__btn--minus" @click="addPoints(s, -1)">−1</button>
          <button class="stu__btn" @click="addPoints(s, 1)">+1</button>
          <button class="stu__btn" @click="addPoints(s, 3)">+3</button>
          <button class="stu__btn stu__btn--plus" @click="addPoints(s, 5)">+5</button>
        </div>
      </article>
    </main>

    <transition name="fade">
      <div v-if="flash" class="td__flash">{{ flash }}</div>
    </transition>
  </div>
</template>

<style scoped>
.td {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding-bottom: 30px;
}

.td__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14px;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(28, 28, 36, 0.18);
  box-shadow: 0 2px 10px rgba(28, 28, 36, 0.07);
}
.td__back {
  padding: 7px 14px;
  font-family: var(--font-title);
  font-size: 13px;
  color: var(--ink);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.td__title h1 {
  margin: 0;
  font-family: var(--font-title);
  font-size: 20px;
  letter-spacing: 0.12em;
}
.td__title p {
  margin: 1px 0 0;
  font-size: 11px;
  color: var(--ink-2);
}
.td__stats {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.td__stat {
  padding: 5px 12px;
  font-size: 12px;
  color: var(--ink-2);
  background: rgba(255, 253, 246, 0.75);
  border: 1px solid rgba(28, 28, 36, 0.18);
  border-radius: var(--r-sm);
  white-space: nowrap;
}
.td__stat--hot {
  color: var(--cinnabar);
  border-color: rgba(192, 57, 43, 0.35);
  background: rgba(192, 57, 43, 0.08);
}
.td__flush {
  min-height: 32px;
  padding: 4px 12px;
  font-size: 12px;
}

/* 卡片网格：保留教师端的信息密度 */
.td__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(188px, 1fr));
  gap: 10px;
  padding: 14px 20px 0;
}

.stu {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.18);
  border-radius: var(--r-md);
  box-shadow: var(--sh-inset), var(--sh-paper);
  transition: transform var(--d-quick) var(--e-out);
}
.stu:hover {
  transform: translateY(-2px);
  box-shadow: var(--sh-lift);
}

.stu__top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.stu__seal {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  flex: none;
  font-family: var(--font-title);
  font-size: 14px;
  color: #f7efe0;
  background: linear-gradient(160deg, #ce4436, var(--cinnabar-d));
  border-radius: 4px;
  transform: rotate(-3deg);
}
.stu__who {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.stu__name {
  font-family: var(--font-title);
  font-size: 15px;
  color: var(--ink);
}
.stu__no {
  font-size: 10px;
  color: var(--ink-3);
}
.stu__points {
  margin-left: auto;
  font-size: 17px;
  font-weight: 700;
  color: var(--cinnabar);
}

.stu__pet {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 11px;
  color: var(--ink-2);
}
.stu__pet-lv {
  color: var(--ink-3);
}

.stu__ops {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}
.stu__btn {
  padding: 6px 0;
  font-family: var(--font-num);
  font-size: 13px;
  color: var(--ink);
  background: rgba(255, 253, 246, 0.85);
  border: 1px solid rgba(28, 28, 36, 0.2);
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: transform var(--d-instant) var(--e-out), background var(--d-quick);
}
.stu__btn:active {
  transform: scale(0.95);
}
.stu__btn--plus {
  color: #f7efe0;
  background: linear-gradient(180deg, #ce4436, var(--cinnabar-d));
  border-color: var(--cinnabar-d);
}
.stu__btn--minus {
  color: var(--stone-blue);
  border-color: rgba(46, 92, 138, 0.35);
}

/* 飘字反馈 */
.td__flash {
  position: fixed;
  left: 50%;
  top: 18%;
  transform: translateX(-50%);
  padding: 8px 20px;
  font-family: var(--font-title);
  font-size: 18px;
  color: #f7efe0;
  background: rgba(142, 42, 32, 0.92);
  border-radius: 999px;
  box-shadow: 0 8px 20px rgba(142, 42, 32, 0.35);
  pointer-events: none;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--d-quick) var(--e-out);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 720px) {
  .td__head {
    padding: 10px 12px;
    gap: 8px;
  }
  .td__stats {
    margin-left: 0;
    width: 100%;
    flex-wrap: wrap;
  }
  .td__grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    padding: 12px;
  }
}
</style>
