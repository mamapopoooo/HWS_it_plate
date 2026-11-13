<script setup lang="ts">
/**
 * 教师工作台（v3 国风皮肤）
 *
 * 与学生在的游戏大厅不同：教师端要的是「找到人 → 点一下加分」，
 * 所以保留卡片网格与信息密度，只把外壳换成国风（00-总纲 §3.6）。
 *
 * 路由暂挂 /teacher（免登录便于验收），M2 迁到 /admin 并加 role 守卫。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { fetchClassStudents, fetchClasses, fetchEvaluations, importStudents, syncPoints, updateStudent, deleteStudent } from '@/api/adapter'
import { DEMO_CLASSES } from '@/api/demo'
import type { ClassRow, EvaluationRow, ImportRow, PointsRecord, TeacherStudent } from '@/api/types'

const router = useRouter()

const classes = ref<ClassRow[]>(DEMO_CLASSES)
const activeClassId = ref(DEMO_CLASSES[0]?.id ?? '')
const students = ref<TeacherStudent[]>([])
const todayDelta = ref(0)
const pending = ref<PointsRecord[]>([])
const flash = ref<string | null>(null)

/** 导入面板 */
const showImport = ref(false)
const importText = ref('')
const importMsg = ref('')
const importing = ref(false)

const className = computed(
  () => classes.value.find((c) => c.id === activeClassId.value)?.name ?? '未选择班级',
)

async function loadClasses() {
  classes.value = await fetchClasses()
  if (!activeClassId.value || !classes.value.some((c) => c.id === activeClassId.value)) {
    activeClassId.value = classes.value[0]?.id ?? ''
  }
}

async function loadStudents() {
  if (!activeClassId.value) return
  students.value = await fetchClassStudents(activeClassId.value)
}

onMounted(async () => {
  await loadClasses()
  await loadStudents()
})

watch(activeClassId, loadStudents)

/**
 * 解析粘贴名单：每行「学号 姓名」或只有「姓名」。
 * 用空白或逗号分隔，忽略空行与 # 开头的注释行。
 */
function parseRows(text: string): ImportRow[] {
  const rows: ImportRow[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const parts = line.split(/[\s,，、\t]+/).filter(Boolean)
    if (parts.length === 0) continue
    // 学号一般是数字；若第一段是纯数字就当学号，否则整行都是姓名
    const [first, rest] = parts
    if (/^\d{4,}$/.test(first)) {
      rows.push({ studentNo: first, name: rest })
    } else {
      rows.push({ name: parts.join(' ') })
    }
  }
  return rows
}

async function doImport() {
  const rows = parseRows(importText.value)
  if (rows.length === 0) {
    importMsg.value = '没解析出学生，请每行一个「学号 姓名」'
    return
  }
  importing.value = true
  importMsg.value = ''
  const count = await importStudents(activeClassId.value, rows)
  importing.value = false

  if (count > 0) {
    importMsg.value = `成功导入 ${count} 人`
    await loadStudents()
  } else {
    // 接口未就绪：本地追加，便于教师端先行试用
    let added = 0
    for (const r of rows) {
      if (!r.name) continue
      students.value.push({
        id: `local-${Date.now()}-${added}`,
        name: r.name,
        studentNo: r.studentNo ?? '',
        points: 0,
        petName: '—',
        petLevel: 1,
      })
      added += 1
    }
    importMsg.value = `接口未就绪，已在本地追加 ${added} 人（联网后请重新导入）`
  }
  importText.value = ''
  setTimeout(() => {
    if (importMsg.value.startsWith('成功')) showImport.value = false
  }, 900)
}

const totalPoints = computed(() => students.value.reduce((s, x) => s + x.points, 0))
const avgPoints = computed(() =>
  students.value.length === 0 ? 0 : Math.round(totalPoints.value / students.value.length),
)
const maxPoints = computed(() => (students.value.length ? Math.max(...students.value.map((s) => s.points)) : 0))
const minPoints = computed(() => (students.value.length ? Math.min(...students.value.map((s) => s.points)) : 0))

/* ---------- 积分流水 ---------- */

const showFlow = ref(false)
const flow = ref<EvaluationRow[]>([])
const flowLoading = ref(false)

async function toggleFlow() {
  showFlow.value = !showFlow.value
  if (!showFlow.value) return
  flowLoading.value = true
  flow.value = await fetchEvaluations(activeClassId.value, 12)
  flowLoading.value = false
}

function fmtTime(ts: number): string {
  if (!ts) return '—'
  const d = new Date(ts)
  const today = new Date()
  const sameDay =
    d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate()
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return sameDay ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`
}

/* ---------- 编辑 / 删除学生 ---------- */

const editingId = ref<string | null>(null)
const editName = ref('')
const editNo = ref('')
const confirmDeleteId = ref<string | null>(null)

function startEdit(s: TeacherStudent) {
  editingId.value = s.id
  editName.value = s.name
  editNo.value = s.studentNo
  confirmDeleteId.value = null
}

function cancelEdit() {
  editingId.value = null
  confirmDeleteId.value = null
}

async function saveEdit(s: TeacherStudent) {
  const name = editName.value.trim()
  if (!name) return
  const studentNo = editNo.value.trim()
  // 本地先改，再尝试同步（离线也能用）
  s.name = name
  s.studentNo = studentNo
  await updateStudent(s.id, { name, studentNo })
  cancelEdit()
}

async function removeStudent(s: TeacherStudent) {
  // 第一下只做确认，第二下才删，避免误触
  if (confirmDeleteId.value !== s.id) {
    confirmDeleteId.value = s.id
    return
  }
  await deleteStudent(s.id)
  students.value = students.value.filter((x) => x.id !== s.id)
  cancelEdit()
}

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
        <span class="td__stat">最高 <b class="num">{{ maxPoints }}</b></span>
        <span class="td__stat">最低 <b class="num">{{ minPoints }}</b></span>
        <span class="td__stat td__stat--hot">今日 <b class="num">{{ todayDelta > 0 ? '+' : '' }}{{ todayDelta }}</b></span>
        <button class="gw-seal td__flush" :disabled="pending.length === 0" @click="flush">
          待同步 <span class="num">{{ pending.length }}</span>
        </button>
        <button class="gw-seal" @click="toggleFlow">{{ showFlow ? '收起流水' : '积分流水' }}</button>
        <button class="gw-seal" @click="showImport = true">导入学生</button>
        <!-- 名单管理复用现有 /admin/students 页，不新建第二份名单页（Codex 2026-11-13 指示） -->
        <button class="gw-seal" @click="router.push('/admin/students')">名单管理</button>
        <button class="gw-seal" @click="goReview">造物审核</button>
        <button class="gw-seal" @click="router.push('/teacher/content')">内容台账</button>
      </div>
    </header>

    <!-- 班级切换 -->
    <nav class="td__classes">
      <span class="td__classes-label">班级</span>
      <button
        v-for="c in classes"
        :key="c.id"
        class="td__class"
        :class="{ 'is-on': c.id === activeClassId }"
        @click="activeClassId = c.id"
      >
        {{ c.name }}
        <span class="num">{{ c.id === activeClassId ? students.length : '' }}</span>
      </button>
    </nav>

    <!-- 导入面板 -->
    <section v-if="showImport" class="import gw-scroll">
      <div class="gw-scroll-head">
        <span>批量导入学生 · {{ className }}</span>
        <em class="import__hint">每行一个「学号 姓名」，也可只写姓名</em>
      </div>
      <textarea
        v-model="importText"
        rows="6"
        placeholder="20260101 李四&#10;20260102 王小二&#10;张三"
      />
      <div class="import__ops">
        <button class="gw-seal gw-seal--primary" :disabled="importing" @click="doImport">
          {{ importing ? '导入中…' : '确认导入' }}
        </button>
        <button class="gw-seal" @click="showImport = false; importMsg = ''">取消</button>
        <span v-if="importMsg" class="import__msg">{{ importMsg }}</span>
      </div>
    </section>

    <!-- 积分流水 -->
    <section v-if="showFlow" class="flow gw-scroll">
      <div class="gw-scroll-head">
        <span>最近积分流水 · {{ className }}</span>
        <em class="flow__hint">{{ flowLoading ? '加载中…' : `共 ${flow.length} 条` }}</em>
      </div>
      <p v-if="flow.length === 0" class="flow__empty">这个班还没有加分记录。</p>
      <div v-for="r in flow" :key="r.id" class="flow__row">
        <span class="flow__time num">{{ fmtTime(r.timestamp) }}</span>
        <span class="flow__name">{{ r.studentName }}</span>
        <span class="flow__reason">{{ r.reason }}</span>
        <span class="flow__points num" :class="r.points >= 0 ? 'is-plus' : 'is-minus'">
          {{ r.points > 0 ? '+' : '' }}{{ r.points }}
        </span>
      </div>
    </section>

    <main class="td__grid">
      <article v-for="s in students" :key="s.id" class="stu">
        <div class="stu__top">
          <span class="stu__seal">{{ s.name.slice(-1) }}</span>
          <button class="stu__who" title="点击编辑学生" @click="startEdit(s)">
            <span class="stu__name">{{ s.name }}</span>
            <span class="stu__no num">{{ s.studentNo || '—' }}</span>
          </button>
          <span class="stu__points num">{{ s.points }}</span>
        </div>

        <!-- 编辑态：改名 / 改学号 / 删除 -->
        <div v-if="editingId === s.id" class="stu__edit">
          <input v-model="editName" class="stu__input" placeholder="姓名" />
          <input v-model="editNo" class="stu__input num" placeholder="学号" />
          <div class="stu__edit-ops">
            <button class="stu__btn" @click="saveEdit(s)">保存</button>
            <button class="stu__btn" @click="cancelEdit">取消</button>
            <button class="stu__btn stu__btn--danger" @click="removeStudent(s)">
              {{ confirmDeleteId === s.id ? '确认删除？' : '删除' }}
            </button>
          </div>
        </div>

        <template v-else>
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
        </template>
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
  border-color: rgba(96, 96, 96, 0.35);
  background: rgba(96, 96, 96, 0.08);
}
.td__flush {
  min-height: 32px;
  padding: 4px 12px;
  font-size: 12px;
}

/* 班级切换 */
.td__classes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 10px 20px 0;
}
.td__classes-label {
  font-family: var(--font-title);
  font-size: 12px;
  color: var(--ink-3);
  letter-spacing: 0.1em;
}
.td__class {
  padding: 5px 14px;
  font-family: var(--font-title);
  font-size: 13px;
  color: var(--ink-2);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.18);
  border-radius: 999px;
  cursor: pointer;
}
.td__class.is-on {
  color: #f7f7f7;
  background: linear-gradient(180deg, #2b2b2b, var(--cinnabar-d));
  border-color: var(--cinnabar-d);
}
.td__class .num {
  margin-left: 4px;
  font-size: 11px;
  opacity: 0.8;
}

/* 导入面板 */
.import {
  margin: 12px 20px 0;
  padding: 12px 14px;
}
.import__hint {
  font-style: normal;
  font-family: var(--font-body);
  font-size: 11px;
  color: var(--ink-3);
}
.import textarea {
  width: 100%;
  padding: 10px 12px;
  font-family: ui-monospace, Consolas, monospace;
  font-size: 13px;
  line-height: 1.7;
  color: var(--ink);
  background: rgba(255, 253, 246, 0.9);
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
  resize: vertical;
}
.import__ops {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}
.import__msg {
  font-size: 12px;
  color: var(--cinnabar);
}

.stu__who {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  min-width: 0;
  padding: 0;
  background: none;
  border: 0;
  cursor: pointer;
  text-align: left;
}
.stu__who:hover .stu__name {
  color: var(--cinnabar);
}

/* 编辑态 */
.stu__edit {
  display: grid;
  gap: 4px;
}
.stu__input {
  padding: 5px 8px;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--ink);
  background: rgba(255, 253, 246, 0.92);
  border: 1px solid rgba(28, 28, 36, 0.24);
  border-radius: var(--r-sm);
}
.stu__edit-ops {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 4px;
}
.stu__btn--danger {
  color: var(--cinnabar);
  border-color: rgba(96, 96, 96, 0.45);
}

/* 积分流水面板 */
.flow {
  margin: 12px 20px 0;
  padding: 12px 14px;
}
.flow__hint {
  font-style: normal;
  font-family: var(--font-body);
  font-size: 11px;
  color: var(--ink-3);
}
.flow__row {
  display: grid;
  grid-template-columns: 62px 76px 1fr 44px;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
  color: var(--ink-2);
  border-bottom: 1px dashed rgba(28, 28, 36, 0.1);
}
.flow__time {
  font-size: 11px;
  color: var(--ink-3);
}
.flow__name {
  font-family: var(--font-title);
  color: var(--ink);
}
.flow__reason {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.flow__points {
  text-align: right;
  font-weight: 700;
}
.flow__points.is-plus {
  color: var(--stone-green);
}
.flow__points.is-minus {
  color: var(--cinnabar);
}
.flow__empty {
  margin: 0;
  padding: 10px 0;
  font-size: 12px;
  color: var(--ink-3);
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
  color: #f7f7f7;
  background: linear-gradient(160deg, #2b2b2b, var(--cinnabar-d));
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
  color: #f7f7f7;
  background: linear-gradient(180deg, #2b2b2b, var(--cinnabar-d));
  border-color: var(--cinnabar-d);
}
.stu__btn--minus {
  color: var(--stone-blue);
  border-color: rgba(83, 83, 83, 0.35);
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
  color: #f7f7f7;
  background: rgba(71, 71, 71, 0.92);
  border-radius: 999px;
  box-shadow: 0 8px 20px rgba(71, 71, 71, 0.35);
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
