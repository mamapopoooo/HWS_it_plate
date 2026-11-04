<template>
  <div class="admin-students">
    <!-- 水墨山水背景 -->
    <div class="bg-scene">
      <div class="cloud cloud-1"></div>
      <div class="cloud cloud-2"></div>
      <div class="mountain"></div>
    </div>

    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">学生管理</h1>
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <div class="scroll-frame">
        <div class="scroll-top"></div>
        <div class="scroll-body search-body">
          <span class="search-icon">🔍</span>
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="搜索学号或姓名…"
          />
          <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">✕</button>
        </div>
        <div class="scroll-bottom"></div>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <div class="loading-icon">墨</div>
      <div class="loading-text">载入中…</div>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-state">
      <div class="error-icon">✕</div>
      <div class="error-text">{{ error }}</div>
      <button class="retry-btn" @click="loadStudents">重试</button>
    </div>

    <!-- 学生表格 -->
    <div v-else class="table-wrap">
      <div class="scroll-frame">
        <div class="scroll-top"></div>
        <div class="scroll-body table-body">
          <table class="student-table">
            <thead>
              <tr>
                <th
                  v-for="col in columns"
                  :key="col.key"
                  class="table-th"
                  :class="{ sortable: col.sortable }"
                  @click="col.sortable && toggleSort(col.key)"
                >
                  <span>{{ col.label }}</span>
                  <span v-if="col.sortable" class="sort-indicator">
                    <template v-if="sortKey === col.key">
                      {{ sortDir === 'asc' ? '▲' : '▼' }}
                    </template>
                    <template v-else>⇅</template>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="student in sortedStudents" :key="student.id">
                <tr
                  class="table-row"
                  :class="{ expanded: expandedId === student.id }"
                  @click="toggleExpand(student.id)"
                >
                  <td class="table-td">{{ student.studentNo }}</td>
                  <td class="table-td">
                    <span class="student-name">{{ student.realName }}</span>
                    <span v-if="student.tier" class="tier-dot" :style="{ background: getTierColor(student.tier) }"></span>
                  </td>
                  <td class="table-td">{{ student.grade || '-' }}</td>
                  <td class="table-td num">{{ student.points ?? '-' }}</td>
                  <td class="table-td num">{{ student.petCount ?? '-' }}</td>
                  <td class="table-td num">{{ student.power ?? '-' }}</td>
                </tr>
                <!-- 展开行：宠物列表 -->
                <tr v-if="expandedId === student.id" class="expand-row">
                  <td :colspan="columns.length">
                    <div class="expand-content">
                      <div class="expand-title">宠物列表</div>
                      <div v-if="student._petsLoading" class="expand-loading">加载中…</div>
                      <div v-else-if="student._petsError" class="expand-error">{{ student._petsError }}</div>
                      <div v-else-if="!student.pets || student.pets.length === 0" class="expand-empty">暂无宠物</div>
                      <div v-else class="pet-list">
                        <div v-for="pet in student.pets" :key="pet.id" class="pet-chip">
                          <span class="pet-chip-tier" :style="{ background: getTierColor(pet.tier) }">
                            {{ pet.tier ? 'T' + pet.tier : '' }}
                          </span>
                          <span class="pet-chip-name">{{ pet.template_name || pet.template_id }}</span>
                          <span class="pet-chip-lv">Lv.{{ pet.level || 1 }}</span>
                          <span class="pet-chip-power">⚡{{ pet.power || 0 }}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
              <tr v-if="sortedStudents.length === 0">
                <td :colspan="columns.length" class="table-empty">
                  {{ searchQuery ? '未找到匹配的学生' : '暂无学生数据' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="scroll-bottom"></div>
      </div>
      <div class="table-footer">
        共 <strong>{{ sortedStudents.length }}</strong> 名学生
        <span v-if="searchQuery">（已筛选，总计 {{ students.length }} 名）</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { api } from '@/api'

interface StudentRow {
  id: string
  studentNo: string
  realName: string
  grade?: string
  points?: number
  petCount?: number
  power?: number
  tier?: number
  pets?: any[]
  _petsLoading?: boolean
  _petsError?: string
}

const columns = [
  { key: 'studentNo', label: '学号', sortable: true },
  { key: 'realName', label: '姓名', sortable: true },
  { key: 'grade', label: '年级', sortable: true },
  { key: 'points', label: '积分', sortable: true },
  { key: 'petCount', label: '宠物数', sortable: true },
  { key: 'power', label: '战力', sortable: true }
]

const loading = ref(true)
const error = ref('')
const students = ref<StudentRow[]>([])
const searchQuery = ref('')
const sortKey = ref('studentNo')
const sortDir = ref<'asc' | 'desc'>('asc')
const expandedId = ref<string | null>(null)

// 品阶颜色映射
const TIER_COLORS: Record<number, string> = {
  1: '#8A8577',
  2: '#7FA88A',
  3: '#3E7C59',
  4: '#C9A227',
  5: '#C0392B',
  6: '#2E5C8A',
  7: '#6B3FA0',
  8: '#1C1C24'
}

function getTierColor(tier?: number): string {
  return tier ? (TIER_COLORS[tier] || '#8A8577') : '#8A8577'
}

// 搜索过滤
const filteredStudents = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return students.value
  return students.value.filter(s =>
    s.realName.toLowerCase().includes(q) ||
    s.studentNo.toLowerCase().includes(q)
  )
})

// 排序
const sortedStudents = computed(() => {
  const list = [...filteredStudents.value]
  const key = sortKey.value as keyof StudentRow
  const dir = sortDir.value === 'asc' ? 1 : -1
  return list.sort((a, b) => {
    const va = a[key] ?? ''
    const vb = b[key] ?? ''
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
    return String(va).localeCompare(String(vb), 'zh-CN') * dir
  })
})

function toggleSort(key: string) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

function toggleExpand(id: string) {
  if (expandedId.value === id) {
    expandedId.value = null
    return
  }
  expandedId.value = id

  // 懒加载宠物列表
  const student = students.value.find(s => s.id === id)
  if (student && !student.pets && !student._petsLoading) {
    student._petsLoading = true
    api.get(`/teacher/students/${id}/pets`)
      .then((data: any) => {
        student.pets = Array.isArray(data) ? data : (data?.pets || [])
      })
      .catch((e: any) => {
        student._petsError = e.message || '加载失败'
      })
      .finally(() => {
        student._petsLoading = false
      })
  }
}

async function loadStudents() {
  loading.value = true
  error.value = ''
  try {
    const data = await api.getStudents()
    const list = Array.isArray(data) ? data : (data?.students || [])
    students.value = list.map((s: any) => ({
      id: s.id,
      studentNo: s.studentNo || s.student_no || '',
      realName: s.realName || s.real_name || s.name || '',
      grade: s.grade || s.className || '',
      points: s.points ?? s.totalPoints ?? 0,
      petCount: s.petCount ?? s.pet_count ?? 0,
      power: s.power ?? s.totalPower ?? 0,
      tier: s.tier
    }))
  } catch (e: any) {
    error.value = e.message || '加载学生数据失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadStudents()
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
.bg-scene {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}
.mountain {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40%;
  background: linear-gradient(to top, rgba(28,28,36,0.06), transparent);
  clip-path: polygon(0% 100%, 10% 60%, 25% 80%, 40% 40%, 55% 70%, 70% 30%, 85% 65%, 100% 45%, 100% 100%);
}
.cloud {
  position: absolute;
  width: 200px;
  height: 60px;
  background: radial-gradient(ellipse, rgba(28,28,36,0.04) 0%, transparent 70%);
  border-radius: 50%;
  animation: drift 30s linear infinite;
}
.cloud-1 { top: 15%; left: -200px; }
.cloud-2 { top: 30%; left: -200px; animation-delay: 15s; width: 300px; }
@keyframes drift {
  from { transform: translateX(0); }
  to { transform: translateX(calc(100vw + 400px)); }
}

/* 页面标题 */
.page-header {
  position: relative;
  z-index: 1;
  margin-bottom: 20px;
  text-align: center;
}
.page-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 28px;
  font-weight: bold;
  letter-spacing: 0.1em;
  color: #1C1C24;
  margin: 0;
}

/* 搜索栏 */
.search-bar {
  position: relative;
  z-index: 1;
  margin-bottom: 20px;
}
.search-body {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px !important;
}
.search-icon { font-size: 16px; flex-shrink: 0; }
.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 15px;
  font-family: 'Songti SC', 'STSong', serif;
  color: #1C1C24;
  outline: none;
}
.search-input::placeholder { color: #8A8577; }
.search-clear {
  background: none;
  border: none;
  color: #8A8577;
  font-size: 14px;
  cursor: pointer;
  padding: 2px 6px;
  transition: color 0.12s;
}
.search-clear:hover { color: #C0392B; }

/* 卷轴框架 */
.scroll-frame { position: relative; }
.scroll-top, .scroll-bottom {
  height: 14px;
  background: linear-gradient(to bottom, #8B6914, #C9A227, #8B6914);
  border-radius: 7px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.18);
}
.scroll-body {
  background: #E8DCC2;
  border-left: 3px solid #C9A227;
  border-right: 3px solid #C9A227;
  padding: 0;
}

/* 表格 */
.table-wrap {
  position: relative;
  z-index: 1;
}
.table-body {
  overflow-x: auto;
  padding: 0 !important;
}
.student-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.table-th {
  padding: 12px 14px;
  text-align: left;
  font-family: 'KaiTi', 'STKaiti', serif;
  font-weight: bold;
  font-size: 14px;
  color: #4A4A5A;
  letter-spacing: 0.04em;
  border-bottom: 2px solid #C9A227;
  background: rgba(201,162,39,0.08);
  white-space: nowrap;
  user-select: none;
}
.table-th.sortable { cursor: pointer; }
.table-th.sortable:hover { color: #C0392B; }
.sort-indicator {
  margin-left: 4px;
  font-size: 11px;
  color: #8A8577;
}
.table-row {
  cursor: pointer;
  transition: background 0.1s;
}
.table-row:hover { background: rgba(201,162,39,0.08); }
.table-row.expanded { background: rgba(201,162,39,0.14); }
.table-td {
  padding: 10px 14px;
  border-bottom: 1px solid rgba(28,28,36,0.06);
  white-space: nowrap;
}
.table-td.num {
  font-family: Georgia, serif;
  text-align: right;
  font-weight: bold;
}
.student-name {
  font-weight: bold;
}
.tier-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-left: 6px;
  vertical-align: middle;
}

/* 展开行 */
.expand-row td {
  padding: 0 !important;
  border-bottom: 2px solid #C9A227;
}
.expand-content {
  padding: 16px 20px;
  background: #F2E8D5;
}
.expand-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 14px;
  font-weight: bold;
  color: #4A4A5A;
  margin-bottom: 10px;
  letter-spacing: 0.04em;
}
.expand-loading, .expand-error, .expand-empty {
  font-size: 13px;
  color: #8A8577;
  padding: 8px 0;
}
.expand-error { color: #C0392B; }
.pet-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.pet-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #E8DCC2;
  border: 1px solid #C9A227;
  border-radius: 6px;
  font-size: 13px;
}
.pet-chip-tier {
  padding: 1px 5px;
  border-radius: 3px;
  color: white;
  font-size: 10px;
  font-weight: bold;
}
.pet-chip-name {
  font-weight: bold;
  color: #1C1C24;
}
.pet-chip-lv {
  color: #C9A227;
  font-family: Georgia, serif;
  font-size: 12px;
}
.pet-chip-power {
  color: #4A4A5A;
  font-family: Georgia, serif;
  font-size: 12px;
}

/* 表格底部 */
.table-footer {
  margin-top: 10px;
  text-align: right;
  font-size: 13px;
  color: #8A8577;
  padding: 0 4px;
}
.table-footer strong {
  color: #C9A227;
  font-family: Georgia, serif;
}
.table-empty {
  text-align: center;
  padding: 40px 14px !important;
  color: #8A8577;
  font-size: 14px;
}

/* 加载/错误状态 */
.loading-state, .error-state {
  position: relative;
  z-index: 1;
  text-align: center;
  padding: 80px 20px;
}
.loading-icon {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 48px;
  color: #C9A227;
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.loading-text {
  margin-top: 12px;
  font-size: 14px;
  color: #8A8577;
}
.error-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #C0392B;
  color: white;
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
}
.error-text {
  font-size: 14px;
  color: #4A4A5A;
  margin-bottom: 16px;
}
.retry-btn {
  padding: 8px 24px;
  background: #C9A227;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-family: 'KaiTi', 'STKaiti', serif;
  cursor: pointer;
  transition: all 0.12s;
}
.retry-btn:hover { filter: brightness(1.1); }

@media (max-width: 640px) {
  .student-table { font-size: 13px; }
  .table-th, .table-td { padding: 8px 10px; }
}
</style>
