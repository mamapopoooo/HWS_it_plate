<template>
  <div class="admin-students">
    <!-- 水墨山水背景 -->
    <div class="bg-scene" aria-hidden="true">
      <div class="cloud cloud-1"></div>
      <div class="cloud cloud-2"></div>
      <div class="mountain"></div>
    </div>

    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">学生名单</h1>
      <p class="page-sub">学号即密码 · 中文名或英文名都能登录</p>
    </div>

    <!-- 工具条 -->
    <div class="toolbar">
      <select v-model="classFilter" class="tb-select" @change="loadStudents">
        <option value="">全部班级</option>
        <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}（{{ c.studentCount }}）</option>
      </select>

      <div class="tb-search">
        <input v-model.trim="searchQuery" type="text" placeholder="学号 / 中文名 / 英文名…" @keyup.enter="loadStudents" />
        <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''; loadStudents()">✕</button>
        <button class="tb-btn" @click="loadStudents">搜索</button>
      </div>

      <div class="tb-actions">
        <button class="tb-btn" @click="openCreate">＋ 新增学生</button>
        <button class="tb-btn tb-btn--primary" @click="pickFile">⇪ 上传表格</button>
        <button class="tb-btn" :disabled="!selected.size" @click="openMove">移动所选（{{ selected.size }}）</button>
        <button class="tb-btn tb-btn--danger" :disabled="!selected.size" @click="confirmBulkDelete">删除所选（{{ selected.size }}）</button>
      </div>
    </div>

    <p v-if="toast" class="flash flash--ok" @click="toast = ''">{{ toast }} ✕</p>
    <p v-if="dupTip" class="flash flash--warn" @click="dupTip = ''">{{ dupTip }} ✕</p>
    <p v-if="error" class="flash flash--err">{{ error }}</p>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <div class="loading-icon">墨</div>
      <div class="loading-text">载入名单…</div>
    </div>

    <!-- 名单表格 -->
    <div v-else class="table-wrap">
      <div class="scroll-frame">
        <div class="scroll-top"></div>
        <div class="scroll-body table-body">
          <table class="student-table">
            <thead>
              <tr>
                <th class="table-th col-check">
                  <input type="checkbox" :checked="allChecked" @change="toggleAll" />
                </th>
                <th class="table-th">学号</th>
                <th class="table-th">中文名</th>
                <th class="table-th">英文名</th>
                <th class="table-th">班级</th>
                <th class="table-th">性别</th>
                <th class="table-th th-num">积分</th>
                <th class="table-th th-num">宠物</th>
                <th class="table-th">登录</th>
                <th class="table-th">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in students" :key="s.id" class="table-row">
                <td class="table-td col-check">
                  <input type="checkbox" :checked="selected.has(s.id)" @change="toggleOne(s.id)" />
                </td>
                <td class="table-td">{{ s.studentNo }}</td>
                <td class="table-td"><span class="student-name">{{ s.name }}</span></td>
                <td class="table-td td-en">{{ s.nameEn || '—' }}</td>
                <td class="table-td">{{ s.className || '未分班' }}</td>
                <td class="table-td">{{ s.gender || '—' }}</td>
                <td class="table-td num">{{ s.gamePoints }}</td>
                <td class="table-td num">{{ s.petCount }}</td>
                <td class="table-td">
                  <span class="badge" :class="s.loggedIn ? 'badge--ok' : 'badge--off'">
                    {{ s.loggedIn ? '已登录' : '未登录' }}
                  </span>
                </td>
                <td class="table-td td-ops">
                  <button class="link" @click.stop="openEdit(s)">编辑</button>
                  <button class="link link--danger" @click.stop="confirmDelete(s)">删除</button>
                </td>
              </tr>
              <tr v-if="students.length === 0">
                <td colspan="10" class="table-empty">没有匹配的学生，换个关键词或清空班级筛选试试</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="scroll-bottom"></div>
      </div>
      <div class="table-footer">
        本页 <strong>{{ students.length }}</strong> 人 · 筛选结果共 <strong>{{ total }}</strong> 人
      </div>
    </div>

    <!-- 新增 / 编辑 -->
    <div v-if="editor.open" class="mask" @click.self="editor.open = false">
      <div class="dialog">
        <h3>{{ editor.isNew ? '新增学生' : `编辑 · ${editor.row.name}` }}</h3>
        <div class="form-grid">
          <label>学号<input v-model.trim="editor.form.studentNo" placeholder="7 位学号，同时是登录密码" /></label>
          <label>中文名<input v-model.trim="editor.form.name" /></label>
          <label>英文名<input v-model.trim="editor.form.nameEn" placeholder="可留空" /></label>
          <label>性别
            <select v-model="editor.form.gender">
              <option value=""></option>
              <option>男</option>
              <option>女</option>
            </select>
          </label>
          <label>班级<input v-model.trim="editor.form.className" list="class-options" placeholder="填新名字会自动建班" /></label>
          <label>课程<input v-model.trim="editor.form.course" placeholder="如 信息技术 G7" /></label>
        </div>
        <datalist id="class-options">
          <option v-for="c in classes" :key="c.id" :value="c.name"></option>
        </datalist>
        <p v-if="editor.isNew" class="dialog-note">学生用「学号 + 中文名或英文名」登录，不需要单独设密码。</p>
        <p v-else-if="editor.form.studentNo !== editor.row.studentNo" class="dialog-warn">
          学号将由 {{ editor.row.studentNo }} 改为 {{ editor.form.studentNo }}：该生下次起用新学号登录，宠物与积分不受影响。
        </p>
        <p v-if="editor.error" class="flash flash--err">{{ editor.error }}</p>
        <div class="dialog-foot">
          <button class="tb-btn" @click="editor.open = false">取消</button>
          <button class="tb-btn tb-btn--primary" :disabled="editor.saving" @click="saveEditor">
            {{ editor.saving ? '保存中…' : '保存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 批量移动 -->
    <div v-if="mover.open" class="mask" @click.self="mover.open = false">
      <div class="dialog">
        <h3>把 {{ selected.size }} 名学生移动到…</h3>
        <select v-model="mover.classId" class="tb-select tb-select--full">
          <option value="">请选择班级</option>
          <option v-for="c in classes" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <p v-if="mover.error" class="flash flash--err">{{ mover.error }}</p>
        <div class="dialog-foot">
          <button class="tb-btn" @click="mover.open = false">取消</button>
          <button class="tb-btn tb-btn--primary" :disabled="!mover.classId || mover.busy" @click="doMove">
            {{ mover.busy ? '移动中…' : '确认移动' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 表格导入预览 -->
    <div v-if="imp.open" class="mask" @click.self="closeImport">
      <div class="dialog dialog--wide">
        <h3>导入预览 · {{ imp.fileName }}</h3>
        <div v-if="imp.preview" class="imp-summary">
          <span>读到 {{ imp.preview.total }} 行</span>
          <span class="tag tag--new">新增 {{ imp.preview.wouldCreate }}</span>
          <span class="tag tag--upd">更新 {{ imp.preview.wouldUpdate }}</span>
          <span class="tag tag--bad">无效 {{ imp.preview.invalid }}</span>
        </div>
        <p v-if="imp.preview && imp.preview.garbled" class="imp-warn">
          有 {{ imp.preview.garbled }} 行含乱码字符，通常是表格被另存成了非 UTF-8 编码。
          这种行服务端会拒绝写入，请先修正原表再导入。
        </p>
        <p class="dialog-note">
          按学号比对：学号已存在只更新档案，不会重置积分、宠物与抽卡记录；同一份表重复导入结果一致。
        </p>
        <div v-if="imp.rows.length" class="imp-scroll">
          <table class="student-table imp-table">
            <thead>
              <tr>
                <th class="table-th">判定</th><th class="table-th">学号</th><th class="table-th">中文名</th>
                <th class="table-th">英文名</th><th class="table-th">性别</th><th class="table-th">班级</th><th class="table-th">课程</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in imp.rows" :key="i">
                <td class="table-td"><span class="tag" :class="rowTag(r).cls">{{ rowTag(r).text }}</span></td>
                <td class="table-td">{{ r.studentNo || '—' }}</td>
                <td class="table-td">{{ r.name || '—' }}</td>
                <td class="table-td td-en">{{ r.nameEn || '—' }}</td>
                <td class="table-td">{{ r.gender || '—' }}</td>
                <td class="table-td">{{ r.class || '—' }}</td>
                <td class="table-td">{{ r.course || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="imp.error" class="flash flash--err">{{ imp.error }}</p>
        <div class="dialog-foot">
          <button class="tb-btn" @click="closeImport">取消</button>
          <button class="tb-btn tb-btn--primary" :disabled="!importable || imp.busy" @click="doImport">
            {{ imp.busy ? '导入中…' : `确认导入 ${importable} 行` }}
          </button>
        </div>
      </div>
    </div>

    <input ref="fileInput" type="file" accept=".xlsx,.xls" hidden @change="onFile" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import * as XLSX from 'xlsx'
import {
  bulkDelete, bulkMove, commitImport, createRosterStudent, deleteRosterStudent,
  fetchDuplicateNames, fetchRosterClasses, fetchRosterStudents, previewImport, updateRosterStudent,
} from '@/api/roster'
import type { DryRunResult, RosterClass, RosterRow, RosterStudent } from '@/api/roster'

const classes = ref<RosterClass[]>([])
const students = ref<RosterStudent[]>([])
const total = ref(0)
const loading = ref(true)
const error = ref('')
const toast = ref('')
const dupTip = ref('')
const searchQuery = ref('')
const classFilter = ref('')
const selected = ref<Set<string>>(new Set())
const fileInput = ref<HTMLInputElement | null>(null)

async function loadClasses() {
  classes.value = (await fetchRosterClasses()).classes
}

async function loadStudents() {
  loading.value = true
  error.value = ''
  try {
    const data = await fetchRosterStudents({
      classId: classFilter.value || undefined,
      q: searchQuery.value || undefined,
    })
    students.value = data.students
    total.value = data.total
    selected.value = new Set()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '名单加载失败'
  } finally {
    loading.value = false
  }
}

async function refresh() {
  await Promise.all([loadStudents(), loadClasses()])
}

const allChecked = computed(
  () => students.value.length > 0 && students.value.every(s => selected.value.has(s.id)),
)

function toggleAll() {
  selected.value = allChecked.value ? new Set() : new Set(students.value.map(s => s.id))
}

function toggleOne(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

/* ---------------- 新增 / 编辑 / 删除 ---------------- */

const emptyForm = () => ({ studentNo: '', name: '', nameEn: '', gender: '', className: '', course: '' })

const editor = reactive({
  open: false,
  isNew: true,
  saving: false,
  error: '',
  row: {} as RosterStudent,
  form: emptyForm(),
})

function openCreate() {
  editor.isNew = true
  editor.error = ''
  editor.row = {} as RosterStudent
  editor.form = { ...emptyForm(), className: classes.value.find(c => c.id === classFilter.value)?.name || '' }
  editor.open = true
}

function openEdit(s: RosterStudent) {
  editor.isNew = false
  editor.error = ''
  editor.row = s
  editor.form = {
    studentNo: s.studentNo, name: s.name, nameEn: s.nameEn,
    gender: s.gender, className: s.className, course: s.course,
  }
  editor.open = true
}

async function saveEditor() {
  editor.saving = true
  editor.error = ''
  try {
    if (editor.isNew) await createRosterStudent(editor.form)
    else await updateRosterStudent(editor.row.id, editor.form)
    editor.open = false
    toast.value = `已${editor.isNew ? '新增' : '保存'} ${editor.form.name}`
    await refresh()
  } catch (e) {
    editor.error = e instanceof Error ? e.message : '保存失败'
  } finally {
    editor.saving = false
  }
}

async function confirmDelete(s: RosterStudent) {
  const ok = window.confirm(
    `删除 ${s.name}（${s.studentNo}）会一并清空该生的宠物、抽卡和积分记录，且不可恢复。确认删除？`,
  )
  if (!ok) return
  try {
    const r = await deleteRosterStudent(s.id)
    toast.value = `已删除 ${s.name}，同时清理 ${r.dataRows} 条游戏数据`
    await refresh()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '删除失败'
  }
}

/* ---------------- 批量移动 / 删除 ---------------- */

const mover = reactive({ open: false, busy: false, error: '', classId: '' })

function openMove() {
  mover.error = ''
  mover.classId = ''
  mover.open = true
}

async function doMove() {
  mover.busy = true
  mover.error = ''
  try {
    const r = await bulkMove([...selected.value], mover.classId)
    mover.open = false
    toast.value = `已移动 ${r.moved} 名学生`
    await refresh()
  } catch (e) {
    mover.error = e instanceof Error ? e.message : '移动失败'
  } finally {
    mover.busy = false
  }
}

async function confirmBulkDelete() {
  const ids = [...selected.value]
  const names = students.value.filter(s => ids.includes(s.id)).map(s => s.name).slice(0, 10)
  const ok = window.confirm(
    `将删除 ${ids.length} 名学生：${names.join('、')}${ids.length > 10 ? ' 等' : ''}\n` +
    `这些学生的宠物、抽卡与积分记录会一并清空，且不可恢复。确认？`,
  )
  if (!ok) return
  try {
    const r = await bulkDelete(ids)
    toast.value = `已删除 ${r.deleted} 名学生，清理 ${r.dataRows} 条游戏数据`
    await refresh()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '批量删除失败'
  }
}

/* ---------------- 表格上传 ---------------- */

// 表头别名：各校表头写法不统一，命中任一即认该列
const HEADER_ALIAS: Record<keyof RosterRow, string[]> = {
  studentNo: ['学号', '学籍号', 'studentno', 'student_no', '编号'],
  name: ['中文名', '中文姓名', '学生姓名', '姓名', 'name'],
  nameEn: ['英文名', '英文姓名', 'englishname', 'english', 'nameen', 'name_en'],
  gender: ['性别', 'gender', 'sex'],
  class: ['班级', '行政班', '班级名称', 'classname', 'class'],
  course: ['课程', '科目', '课程名称', 'course'],
}

const norm = (v: unknown) => String(v ?? '').replace(/\s/g, '').toLowerCase()

/** 在前 10 行里找同时含学号列和姓名列的那一行当表头 */
function mapHeader(matrix: unknown[][]) {
  for (let i = 0; i < Math.min(matrix.length, 10); i++) {
    const cols: Partial<Record<keyof RosterRow, number>> = {}
    matrix[i].forEach((cell, j) => {
      const key = norm(cell)
      if (!key) return
      for (const field of Object.keys(HEADER_ALIAS) as Array<keyof RosterRow>) {
        if (cols[field] !== undefined) continue
        if (HEADER_ALIAS[field].some(a => key === a || key.includes(a))) cols[field] = j
      }
    })
    if (cols.studentNo !== undefined && cols.name !== undefined) return { rowIdx: i, cols }
  }
  return null
}

const imp = reactive({
  open: false,
  busy: false,
  error: '',
  fileName: '',
  rows: [] as RosterRow[],
  preview: null as DryRunResult | null,
})

const importable = computed(() => imp.rows.filter(r => r.studentNo.trim() && r.name.trim()).length)

const knownNos = computed(() => new Set(imp.preview?.existingNos ?? []))

function rowTag(r: RosterRow) {
  if (!r.studentNo.trim() || !r.name.trim()) return { text: '无效', cls: 'tag--bad' }
  // 判定依据来自服务端预演，不能用 students.value：页面可能正被班级/关键词筛着，
  // 那样会把库里已有的学生标成「新增」，教师会被误导。
  return knownNos.value.has(r.studentNo.trim())
    ? { text: '更新', cls: 'tag--upd' }
    : { text: '新增', cls: 'tag--new' }
}

function pickFile() {
  fileInput.value?.click()
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  imp.error = ''
  imp.fileName = file.name
  imp.rows = []
  imp.preview = null
  imp.open = true

  try {
    const book = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    const sheet = book.Sheets[book.SheetNames[0]]
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: '' })
    const header = mapHeader(matrix)
    if (!header) {
      imp.error = '没认出表头。表格前 10 行里需要同时有「学号」列和「姓名」列，可在 Excel 补一行表头后重新上传。'
      return
    }
    const cell = (line: unknown[], field: keyof RosterRow) =>
      header.cols[field] === undefined ? '' : String(line[header.cols[field]!] ?? '').trim()

    imp.rows = matrix
      .slice(header.rowIdx + 1)
      .map(line => ({
        studentNo: cell(line, 'studentNo'),
        name: cell(line, 'name'),
        nameEn: cell(line, 'nameEn'),
        gender: cell(line, 'gender'),
        class: cell(line, 'class'),
        course: cell(line, 'course'),
      }))
      .filter(r => Object.values(r).some(v => v))

    if (!imp.rows.length) {
      imp.error = '表头以下没有读到数据行'
      return
    }
    imp.preview = await previewImport(imp.rows)
  } catch (err) {
    imp.error = err instanceof Error ? `解析失败：${err.message}` : '解析失败，请确认是 xlsx / xls 文件'
  }
}

function closeImport() {
  imp.open = false
  imp.rows = []
  imp.preview = null
  imp.error = ''
}

async function doImport() {
  imp.busy = true
  imp.error = ''
  try {
    const rows = imp.rows.filter(r => r.studentNo.trim() && r.name.trim())
    const r = await commitImport(rows)
    closeImport()
    const skipped = r.rejected.length ? `，${r.rejected.length} 行被跳过` : ''
    toast.value = `导入完成：新增 ${r.created} 人，更新 ${r.updated} 人${skipped}`
    await refresh()
  } catch (e) {
    imp.error = e instanceof Error ? e.message : '导入失败'
  } finally {
    imp.busy = false
  }
}

/* ---------------- 英文名重名提醒 ---------------- */

async function checkDuplicates() {
  try {
    const d = await fetchDuplicateNames()
    if (d.english.length) {
      dupTip.value = `提示：${d.english.map(e => `${e.name}（学号 ${e.studentNos.replace(/,/g, '、')}）`).join('；')} 英文名重复，学生须用学号区分`
    }
  } catch {
    // 只是提醒，取不到不值得打扰教师
  }
}

onMounted(async () => {
  try {
    await loadClasses()
    await loadStudents()
    checkDuplicates()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '页面初始化失败'
    loading.value = false
  }
})
</script>

<style scoped>
.admin-students {
  position: relative;
  min-height: 100vh;
  padding: 20px;
  font-family: 'Songti SC', 'STSong', 'Noto Serif SC', Georgia, serif;
  color: #1C1C24;
  background: #F2E8D5;
}

/* 水墨山水背景 */
.bg-scene { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
.mountain {
  position: absolute; bottom: 0; left: 0; right: 0; height: 40%;
  background: linear-gradient(to top, rgba(28,28,36,0.06), transparent);
  clip-path: polygon(0% 100%, 10% 60%, 25% 80%, 40% 40%, 55% 70%, 70% 30%, 85% 65%, 100% 45%, 100% 100%);
}
.cloud {
  position: absolute; width: 200px; height: 60px;
  background: radial-gradient(ellipse, rgba(28,28,36,0.04) 0%, transparent 70%);
  border-radius: 50%; animation: drift 30s linear infinite;
}
.cloud-1 { top: 15%; left: -200px; }
.cloud-2 { top: 30%; left: -200px; animation-delay: 15s; width: 300px; }
@keyframes drift { from { transform: translateX(0); } to { transform: translateX(calc(100vw + 400px)); } }

/* 标题 */
.page-header { position: relative; z-index: 1; margin-bottom: 14px; text-align: center; }
.page-title {
  font-family: 'KaiTi', 'STKaiti', serif; font-size: 28px; font-weight: bold;
  letter-spacing: 0.1em; color: #1C1C24; margin: 0;
}
.page-sub { margin: 4px 0 0; font-size: 12px; color: #8A8577; }

/* 工具条 */
.toolbar {
  position: relative; z-index: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  padding: 10px 14px; margin-bottom: 12px;
  background: #E8DCC2; border: 1px solid #C9A227; border-radius: 8px;
}
.tb-select {
  padding: 7px 10px; font-family: inherit; font-size: 13px; color: #1C1C24;
  background: #FFFDf6; border: 1px solid rgba(28,28,36,0.22); border-radius: 6px;
}
.tb-select--full { width: 100%; }
.tb-search { display: flex; align-items: center; gap: 6px; }
.tb-search input {
  min-width: 200px; padding: 7px 10px; font-family: inherit; font-size: 14px; color: #1C1C24;
  background: #FFFDf6; border: 1px solid rgba(28,28,36,0.22); border-radius: 6px; outline: none;
}
.tb-search input:focus { border-color: #C9A227; }
.tb-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-left: auto; }
.tb-btn {
  padding: 7px 13px; font-family: 'KaiTi', 'STKaiti', serif; font-size: 13px; letter-spacing: 0.04em;
  color: #4A4A5A; background: #FFFDf6; border: 1px solid #C9A227; border-radius: 6px;
  cursor: pointer; transition: background 0.12s;
}
.tb-btn:hover:not(:disabled) { background: #F2E8D5; }
.tb-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.tb-btn--primary { color: #FFFBEF; background: #C9A227; }
.tb-btn--primary:hover:not(:disabled) { background: #B8931F; }
.tb-btn--danger { color: #C0392B; border-color: rgba(192,57,43,0.55); }
.search-clear { background: none; border: none; color: #8A8577; font-size: 14px; cursor: pointer; }
.search-clear:hover { color: #C0392B; }

/* 提示条 */
.flash { position: relative; z-index: 1; margin: 0 0 10px; padding: 8px 12px; font-size: 13px; border-radius: 6px; }
.flash--ok { cursor: pointer; color: #3E7C59; background: rgba(62,124,89,0.1); border: 1px solid rgba(62,124,89,0.45); }
.flash--warn { cursor: pointer; color: #8B6914; background: rgba(201,162,39,0.16); border: 1px solid rgba(139,105,20,0.4); }
.flash--err { color: #C0392B; background: rgba(192,57,43,0.08); border: 1px solid rgba(192,57,43,0.35); }

/* 加载 */
.loading-state { position: relative; z-index: 1; text-align: center; padding: 80px 20px; }
.loading-icon {
  font-family: 'KaiTi', 'STKaiti', serif; font-size: 48px; color: #C9A227;
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.loading-text { margin-top: 12px; font-size: 14px; color: #8A8577; }

/* 卷轴 + 表格 */
.table-wrap { position: relative; z-index: 1; }
.scroll-frame { position: relative; }
.scroll-top, .scroll-bottom {
  height: 14px; background: linear-gradient(to bottom, #8B6914, #C9A227, #8B6914);
  border-radius: 7px; box-shadow: 0 2px 4px rgba(0,0,0,0.18);
}
.scroll-body { background: #E8DCC2; border-left: 3px solid #C9A227; border-right: 3px solid #C9A227; padding: 0; }
.table-body { overflow-x: auto; padding: 0 !important; }
.student-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.table-th {
  padding: 12px 14px; text-align: left; white-space: nowrap; user-select: none;
  font-family: 'KaiTi', 'STKaiti', serif; font-weight: bold; font-size: 14px; letter-spacing: 0.04em;
  color: #4A4A5A; border-bottom: 2px solid #C9A227; background: rgba(201,162,39,0.08);
}
.th-num { text-align: right; }
.table-td { padding: 10px 14px; border-bottom: 1px solid rgba(28,28,36,0.06); white-space: nowrap; }
.table-row:hover { background: rgba(201,162,39,0.08); }
.table-td.num { font-family: Georgia, serif; text-align: right; font-weight: bold; }
.student-name { font-weight: bold; }
.td-en { font-style: italic; color: #4A4A5A; }
.col-check { width: 36px; text-align: center; }
.td-ops { display: flex; gap: 10px; }
.link { border: 0; background: none; padding: 0; cursor: pointer; font-family: inherit; font-size: 13px; color: #3E7C59; }
.link:hover { text-decoration: underline; }
.link--danger { color: #C0392B; }
.table-footer { margin-top: 10px; text-align: right; font-size: 13px; color: #8A8577; padding: 0 4px; }
.table-footer strong { color: #C9A227; font-family: Georgia, serif; }
.table-empty { text-align: center; padding: 40px 14px !important; color: #8A8577; font-size: 14px; }

.badge, .tag { padding: 2px 8px; font-size: 11px; border-radius: 999px; white-space: nowrap; }
.badge--ok { color: #3E7C59; background: rgba(62,124,89,0.14); }
.badge--off { color: #8A8577; background: rgba(28,28,36,0.07); }
.tag--new { color: #3E7C59; background: rgba(62,124,89,0.16); }
.tag--upd { color: #8B6914; background: rgba(201,162,39,0.24); }
.tag--bad { color: #C0392B; background: rgba(192,57,43,0.12); }

/* 弹窗 */
.mask {
  position: fixed; inset: 0; z-index: 20; display: grid; place-items: center;
  padding: 16px; background: rgba(28,28,36,0.5);
}
.dialog {
  width: min(94vw, 500px); padding: 20px; background: #F2E8D5;
  border: 2px solid #C9A227; border-radius: 10px; box-shadow: 0 14px 44px rgba(28,28,36,0.35);
}
.dialog--wide { width: min(96vw, 880px); }
.dialog h3 {
  margin: 0 0 14px; font-family: 'KaiTi', 'STKaiti', serif; font-size: 19px;
  letter-spacing: 0.08em; color: #1C1C24;
}
.dialog-note { margin: 12px 0 0; font-size: 12px; line-height: 1.7; color: #8A8577; }
.dialog-warn {
  margin: 12px 0 0; padding: 8px 10px; font-size: 12px; color: #8B6914;
  background: rgba(201,162,39,0.18); border: 1px solid rgba(139,105,20,0.4); border-radius: 6px;
}
.dialog-foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
.form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
.form-grid label { display: grid; gap: 4px; font-size: 12px; color: #4A4A5A; }
.form-grid input, .form-grid select {
  padding: 8px 10px; font-family: inherit; font-size: 14px; color: #1C1C24;
  background: #FFFDf6; border: 1px solid rgba(28,28,36,0.22); border-radius: 6px; outline: none;
}
.form-grid input:focus, .form-grid select:focus { border-color: #C9A227; }
.imp-summary { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 13px; color: #4A4A5A; }
.imp-warn {
  margin: 10px 0 0; padding: 8px 12px; font-size: 12px; line-height: 1.7;
  color: #C0392B; background: rgba(192,57,43,0.08);
  border-left: 3px solid #C0392B; border-radius: 4px;
}
.imp-scroll {
  max-height: 46vh; margin-top: 12px; overflow: auto;
  background: #FFFDf6; border: 1px solid rgba(201,162,39,0.6); border-radius: 8px;
}
.imp-table { font-size: 12px; }
.imp-table .table-td { padding: 7px 10px; }

@media (max-width: 640px) {
  .admin-students { padding: 12px; }
  .student-table { font-size: 13px; }
  .table-th, .table-td { padding: 8px 10px; }
  .tb-actions { margin-left: 0; width: 100%; }
  .tb-search { flex: 1; }
  .tb-search input { min-width: 0; width: 100%; }
}
</style>
