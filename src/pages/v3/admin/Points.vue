<template>
  <div class="v3-points">
    <h1 class="page-title">积分管理</h1>

    <div class="points-layout">
      <!-- 左侧：快速加减分 -->
      <div class="quick-panel">
        <div class="panel-card">
          <h3 class="card-title">快速操作</h3>

          <!-- 学生选择 -->
          <div class="student-select">
            <label>选择学生：</label>
            <select v-model="selectedStudent" class="select-input">
              <option value="">-- 请选择 --</option>
              <option v-for="s in students" :key="s.id" :value="s.id">
                {{ s.real_name || s.username }} ({{ s.student_no || s.id.slice(0,6) }})
              </option>
            </select>
          </div>

          <!-- 快捷按钮 -->
          <div class="preset-btns">
            <button v-for="p in presets" :key="p.value"
              :class="['preset-btn', p.value > 0 ? 'positive' : 'negative']"
              @click="applyPreset(p.value)"
              :disabled="!selectedStudent"
            >{{ p.label }}</button>
          </div>

          <!-- 自定义分值 -->
          <div class="custom-row">
            <input v-model.number="customPoints" type="number" class="points-input" placeholder="自定义分值" />
            <input v-model="reason" type="text" class="reason-input" placeholder="原因（选填）" />
            <button class="apply-btn" @click="applyCustom" :disabled="!selectedStudent || !customPoints">
              确认
            </button>
          </div>
        </div>

        <!-- 批量导入 -->
        <div class="panel-card">
          <h3 class="card-title">批量同步</h3>
          <textarea
            v-model="batchText"
            class="batch-textarea"
            placeholder="每行一条，格式：学号 分值 原因&#10;例：&#10;G70101 +3 作业优秀&#10;G70102 -1 迟到&#10;G70103 +5 测验满分"
            rows="6"
          ></textarea>
          <div class="batch-actions">
            <button class="parse-btn" @click="parseBatch">解析预览</button>
            <button class="submit-btn" @click="submitBatch" :disabled="batchRecords.length === 0 || submitting">
              {{ submitting ? '提交中...' : `提交 ${batchRecords.length} 条` }}
            </button>
          </div>
        </div>
      </div>

      <!-- 右侧：操作记录 -->
      <div class="history-panel">
        <div class="panel-card">
          <h3 class="card-title">最近操作</h3>
          <div v-if="history.length === 0" class="empty-hint">暂无操作记录</div>
          <div v-else class="history-list">
            <div v-for="(h, i) in history" :key="i" :class="['history-item', h.points > 0 ? 'pos' : 'neg']">
              <span class="h-student">{{ h.studentName }}</span>
              <span class="h-points">{{ h.points > 0 ? '+' : '' }}{{ h.points }}</span>
              <span class="h-reason">{{ h.reason || '—' }}</span>
              <span class="h-time">{{ formatTime(h.time) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 确认弹窗 -->
    <div v-if="confirmDialog" class="modal-overlay" @click="confirmDialog = null">
      <div class="modal-content" @click.stop>
        <div class="modal-title">确认提交</div>
        <div class="modal-body">
          <p>将要对 <strong>{{ confirmDialog.records.length }}</strong> 条记录进行积分操作</p>
          <div class="confirm-list">
            <div v-for="(r, i) in confirmDialog.records.slice(0, 10)" :key="i" class="confirm-row">
              <span>{{ r.studentName || r.studentNo }}</span>
              <span :class="r.points > 0 ? 'pos' : 'neg'">{{ r.points > 0 ? '+' : '' }}{{ r.points }}</span>
              <span class="confirm-reason">{{ r.reason }}</span>
            </div>
            <div v-if="confirmDialog.records.length > 10" class="confirm-more">
              ...还有 {{ confirmDialog.records.length - 10 }} 条
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="cancel-btn" @click="confirmDialog = null">取消</button>
          <button class="ok-btn" @click="doSubmit">确认提交</button>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div v-if="toast" class="toast" :class="toast.type">{{ toast.message }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { api } from '@/api'

const students = ref<any[]>([])
const selectedStudent = ref('')
const customPoints = ref<number | null>(null)
const reason = ref('')
const batchText = ref('')
const batchRecords = ref<any[]>([])
const history = ref<any[]>([])
const submitting = ref(false)
const confirmDialog = ref<{ records: any[] } | null>(null)
const toast = ref<{ message: string; type: 'success' | 'error' } | null>(null)

const presets = [
  { label: '+1', value: 1 },
  { label: '+2', value: 2 },
  { label: '+3', value: 3 },
  { label: '+5', value: 5 },
  { label: '-1', value: -1 },
  { label: '-2', value: -2 },
  { label: '-3', value: -3 },
  { label: '-5', value: -5 }
]

function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.value = { message, type }
  setTimeout(() => { toast.value = null }, 2000)
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function getStudentName(id: string) {
  const s = students.value.find(s => s.id === id)
  return s?.real_name || s?.username || id.slice(0, 6)
}

function applyPreset(points: number) {
  if (!selectedStudent.value) return
  addHistory(selectedStudent.value, points, presets.find(p => p.value === points)?.label || '')
  doSync([{ studentId: selectedStudent.value, points, reason: '快捷操作' }])
}

function applyCustom() {
  if (!selectedStudent.value || !customPoints.value) return
  addHistory(selectedStudent.value, customPoints.value, reason.value)
  doSync([{ studentId: selectedStudent.value, points: customPoints.value, reason: reason.value }])
  customPoints.value = null
  reason.value = ''
}

function parseBatch() {
  const lines = batchText.value.trim().split('\n').filter(l => l.trim())
  const records: any[] = []

  for (const line of lines) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 2) continue

    const studentNo = parts[0]
    const pointsStr = parts[1]
    const points = parseInt(pointsStr.replace('+', ''))
    if (isNaN(points)) continue

    const studentReason = parts.slice(2).join(' ')
    const student = students.value.find(s => s.student_no === studentNo || s.username === studentNo)

    records.push({
      studentNo,
      studentId: student?.id || '',
      studentName: student?.real_name || studentNo,
      points,
      reason: studentReason || '批量同步'
    })
  }

  batchRecords.value = records
  if (records.length === 0) {
    showToast('未解析到有效记录', 'error')
  }
}

function submitBatch() {
  confirmDialog.value = { records: batchRecords.value }
}

async function doSubmit() {
  if (!confirmDialog.value) return
  const records = confirmDialog.value.records
  confirmDialog.value = null

  const syncRecords = records
    .filter(r => r.studentId)
    .map(r => ({ studentId: r.studentId, points: r.points, reason: r.reason }))

  if (syncRecords.length > 0) {
    await doSync(syncRecords)
    for (const r of records) {
      if (r.studentId) addHistory(r.studentId, r.points, r.reason)
    }
  }

  batchText.value = ''
  batchRecords.value = []
}

async function doSync(records: any[]) {
  submitting.value = true
  try {
    await api.syncPoints(records)
    showToast(`成功同步 ${records.length} 条记录`)
  } catch (e: any) {
    showToast(e.message || '同步失败', 'error')
  } finally {
    submitting.value = false
  }
}

function addHistory(studentId: string, points: number, reason: string) {
  history.value.unshift({
    studentName: getStudentName(studentId),
    points,
    reason,
    time: Date.now()
  })
  if (history.value.length > 20) history.value.pop()
}

onMounted(async () => {
  try {
    const data = await api.getStudents()
    students.value = data.students || data || []
  } catch {}
})
</script>

<style scoped>
.v3-points {
  min-height: 100vh;
  padding: 20px;
  background: #F2E8D5;
  font-family: 'Songti SC', serif;
  color: #1C1C24;
}
.page-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 24px;
  margin-bottom: 20px;
  color: #C9A227;
  letter-spacing: 0.06em;
}

.points-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.panel-card {
  background: #E8DCC2;
  border: 2px solid #C9A227;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 16px;
}
.card-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(201,162,39,0.3);
}

.student-select {
  margin-bottom: 12px;
}
.student-select label {
  font-size: 13px;
  color: #4A4A5A;
  margin-right: 8px;
}
.select-input {
  width: 100%;
  padding: 8px 12px;
  border: 2px solid #C9A227;
  border-radius: 6px;
  background: #F2E8D5;
  font-size: 14px;
  font-family: 'Songti SC', serif;
  color: #1C1C24;
  margin-top: 4px;
}

.preset-btns {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.preset-btn {
  padding: 6px 14px;
  border: 2px solid;
  border-radius: 6px;
  font-size: 14px;
  font-weight: bold;
  font-family: Georgia, serif;
  cursor: pointer;
  transition: all 0.12s;
}
.preset-btn.positive {
  border-color: #7FA88A;
  color: #7FA88A;
  background: transparent;
}
.preset-btn.positive:hover:not(:disabled) { background: #7FA88A; color: white; }
.preset-btn.negative {
  border-color: #C0392B;
  color: #C0392B;
  background: transparent;
}
.preset-btn.negative:hover:not(:disabled) { background: #C0392B; color: white; }
.preset-btn:disabled { opacity: 0.4; cursor: not-allowed; }

.custom-row {
  display: flex;
  gap: 8px;
}
.points-input, .reason-input {
  padding: 8px 12px;
  border: 2px solid #C9A227;
  border-radius: 6px;
  background: #F2E8D5;
  font-size: 14px;
  font-family: 'Songti SC', serif;
}
.points-input { width: 100px; }
.reason-input { flex: 1; }
.apply-btn {
  padding: 8px 16px;
  background: #C0392B;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  font-family: 'KaiTi', 'STKaiti', serif;
}
.apply-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.batch-textarea {
  width: 100%;
  padding: 10px;
  border: 2px solid #C9A227;
  border-radius: 6px;
  background: #F2E8D5;
  font-size: 13px;
  font-family: monospace;
  resize: vertical;
  margin-bottom: 10px;
}
.batch-actions {
  display: flex;
  gap: 8px;
}
.parse-btn {
  padding: 8px 16px;
  border: 2px solid #C9A227;
  border-radius: 6px;
  background: transparent;
  color: #4A4A5A;
  cursor: pointer;
  font-family: 'KaiTi', 'STKaiti', serif;
}
.submit-btn {
  padding: 8px 16px;
  background: #C9A227;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-family: 'KaiTi', 'STKaiti', serif;
}
.submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.history-list { display: flex; flex-direction: column; gap: 6px; }
.history-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(242,232,213,0.5);
  font-size: 13px;
}
.h-student { font-weight: bold; min-width: 60px; }
.h-points {
  font-family: Georgia, serif;
  font-weight: bold;
  min-width: 40px;
  text-align: right;
}
.history-item.pos .h-points { color: #7FA88A; }
.history-item.neg .h-points { color: #C0392B; }
.h-reason { flex: 1; color: #4A4A5A; }
.h-time { color: #8A8577; font-size: 12px; }
.empty-hint {
  text-align: center;
  padding: 20px;
  color: #8A8577;
}

/* 弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(28,28,36,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal-content {
  background: #E8DCC2;
  border: 3px solid #C9A227;
  border-radius: 12px;
  padding: 24px;
  min-width: 360px;
  max-width: 500px;
}
.modal-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 18px;
  font-weight: bold;
  color: #C9A227;
  margin-bottom: 16px;
  text-align: center;
}
.confirm-list {
  max-height: 200px;
  overflow-y: auto;
  margin: 12px 0;
}
.confirm-row {
  display: flex;
  gap: 10px;
  padding: 4px 0;
  font-size: 13px;
  border-bottom: 1px solid rgba(28,28,36,0.06);
}
.confirm-row .pos { color: #7FA88A; font-weight: bold; }
.confirm-row .neg { color: #C0392B; font-weight: bold; }
.confirm-reason { color: #8A8577; flex: 1; }
.confirm-more { text-align: center; color: #8A8577; font-size: 12px; padding: 8px; }
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}
.cancel-btn {
  padding: 8px 16px;
  border: 2px solid #8A8577;
  border-radius: 6px;
  background: transparent;
  color: #4A4A5A;
  cursor: pointer;
}
.ok-btn {
  padding: 8px 16px;
  background: #C0392B;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-family: 'KaiTi', 'STKaiti', serif;
}

.toast {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: bold;
  z-index: 200;
}
.toast.success { background: #7FA88A; color: white; }
.toast.error { background: #C0392B; color: white; }

@media (max-width: 768px) {
  .points-layout { grid-template-columns: 1fr; }
}
</style>
