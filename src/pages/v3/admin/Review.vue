<template>
  <div class="admin-review">
    <!-- 水墨山水背景 -->
    <div class="bg-scene">
      <div class="cloud cloud-1"></div>
      <div class="cloud cloud-2"></div>
      <div class="mountain"></div>
    </div>

    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">造物审核</h1>
      <span class="page-subtitle" v-if="!loading && !error">
        待审核 {{ pendingItems.length }} 件
      </span>
    </div>

    <!-- 加载 / 错误 -->
    <div v-if="loading" class="state-box">
      <div class="ink-spinner"></div>
      <span>载入审核队列…</span>
    </div>
    <div v-else-if="error" class="state-box error">
      <span>⚠ {{ error }}</span>
      <button class="retry-btn" @click="loadData">重试</button>
    </div>

    <!-- 空态 -->
    <div v-else-if="pendingItems.length === 0" class="empty-state">
      <div class="empty-scroll">
        <div class="scroll-top"></div>
        <div class="scroll-body">
          <div class="empty-content">
            <span class="empty-icon">📜</span>
            <p class="empty-text">暂无待审核造物</p>
            <p class="empty-hint">学生提交的自定义宠物将在此显示</p>
          </div>
        </div>
        <div class="scroll-bottom"></div>
      </div>
    </div>

    <!-- 审核卡片列表 -->
    <div v-else class="review-list">
      <div
        v-for="item in pendingItems"
        :key="item.id"
        class="review-card"
      >
        <!-- 状态徽章 -->
        <div class="status-badge" :class="item.status">
          {{ statusLabel(item.status) }}
        </div>

        <div class="card-body">
          <!-- 左侧：宠物图片 -->
          <div class="card-image">
            <div class="image-placeholder">
              <span class="placeholder-glyph">{{ getTrigramGlyph(item.trigram) }}</span>
            </div>
          </div>

          <!-- 右侧：信息 -->
          <div class="card-info">
            <div class="info-header">
              <span class="student-name">{{ item.student_name || '未知学生' }}</span>
              <span class="submit-time">{{ formatTime(item.created_at) }}</span>
            </div>
            <div class="pet-name-row">
              <span class="pet-name">{{ item.name }}</span>
              <span class="trigram-tag" :style="{ background: getTrigramColor(item.trigram) }">
                {{ getTrigramGlyph(item.trigram) }} {{ getTrigramName(item.trigram) }}
              </span>
            </div>

            <!-- 技能列表 -->
            <div v-if="item.skills && item.skills.length" class="skills-section">
              <span class="skills-label">技能：</span>
              <span
                v-for="(skill, idx) in item.skills"
                :key="idx"
                class="skill-chip"
              >{{ skill.name || skill }}</span>
            </div>

            <!-- 战力点数 -->
            <div class="power-row">
              <span class="power-label">消耗点数</span>
              <span class="power-value">{{ item.power_points ?? '—' }}</span>
            </div>
          </div>
        </div>

        <!-- 审核操作区 -->
        <div v-if="item.status === 'pending'" class="card-actions">
          <div class="note-input-wrap">
            <input
              v-model="notes[item.id]"
              class="note-input"
              placeholder="审核备注（可选）…"
            />
          </div>
          <div class="action-btns">
            <button
              class="btn btn-approve"
              :disabled="processing[item.id]"
              @click="handleReview(item, true)"
            >
              {{ processing[item.id] ? '…' : '✓ 通过' }}
            </button>
            <button
              class="btn btn-reject"
              :disabled="processing[item.id]"
              @click="handleReview(item, false)"
            >
              {{ processing[item.id] ? '…' : '✕ 驳回' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { v3Admin } from '@/api/v3'
import { getTrigram } from '@/config/gameConfig'

// ========== 类型 ==========
interface PendingPet {
  id: string
  student_name?: string
  name: string
  trigram?: string
  image?: string
  skills?: Array<{ name: string } | string>
  power_points?: number
  status: 'pending' | 'approved' | 'rejected'
  created_at?: string
  review_note?: string
}

// ========== 状态 ==========
const loading = ref(false)
const error = ref('')
const pendingItems = ref<PendingPet[]>([])
const notes = reactive<Record<string, string>>({})
const processing = reactive<Record<string, boolean>>({})

// ========== 辅助函数 ==========
function statusLabel(status: string): string {
  switch (status) {
    case 'pending': return '待审核'
    case 'approved': return '已通过'
    case 'rejected': return '已驳回'
    default: return status
  }
}

function getTrigramName(code?: string): string {
  if (!code) return '—'
  const first = code.split(',')[0]
  return getTrigram(first)?.name || first
}

function getTrigramGlyph(code?: string): string {
  if (!code) return '·'
  if (code === 'all') return '☯'
  return code
    .split(',')
    .map(c => getTrigram(c)?.symbol || '·')
    .join('')
}

function getTrigramColor(code?: string): string {
  if (!code) return '#8A8577'
  const first = code.split(',')[0]
  return getTrigram(first)?.color || '#8A8577'
}

function formatTime(dateStr?: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    const month = d.getMonth() + 1
    const day = d.getDate()
    const h = String(d.getHours()).padStart(2, '0')
    const m = String(d.getMinutes()).padStart(2, '0')
    return `${month}/${day} ${h}:${m}`
  } catch {
    return ''
  }
}

// ========== 数据加载 ==========
async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const data = await v3Admin.getPendingCustomPets()
    const items = data.pets || data.items || data || []
    pendingItems.value = (Array.isArray(items) ? items : []).map((p: any) => ({
      id: p.id,
      student_name: p.student_name || p.studentName || p.user_name || '',
      name: p.name || '未命名',
      trigram: p.trigram || p.element || '',
      image: p.image || p.image_url || '',
      skills: p.skills || [],
      power_points: p.power_points ?? p.powerPoints ?? null,
      status: p.status || 'pending',
      created_at: p.created_at || p.createdAt || '',
      review_note: p.review_note || '',
    }))
  } catch (e: any) {
    error.value = e.message || '加载审核队列失败'
  } finally {
    loading.value = false
  }
}

// ========== 审核操作 ==========
async function handleReview(item: PendingPet, approved: boolean) {
  processing[item.id] = true
  try {
    await v3Admin.reviewCustomPet(item.id, approved, notes[item.id] || undefined)
    item.status = approved ? 'approved' : 'rejected'
    item.review_note = notes[item.id] || ''
  } catch (e: any) {
    error.value = e.message || '审核操作失败'
  } finally {
    processing[item.id] = false
  }
}

// ========== 生命周期 ==========
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.admin-review {
  position: relative;
  min-height: 100vh;
  padding: 24px 20px;
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
  bottom: 0; left: 0; right: 0;
  height: 40%;
  background: linear-gradient(to top, rgba(28,28,36,0.06), transparent);
  clip-path: polygon(0% 100%, 10% 60%, 25% 80%, 40% 40%, 55% 70%, 70% 30%, 85% 65%, 100% 45%, 100% 100%);
}
.cloud {
  position: absolute;
  width: 200px; height: 60px;
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
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 20px;
}
.page-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 26px;
  font-weight: bold;
  letter-spacing: 0.08em;
  color: #1C1C24;
}
.page-subtitle {
  font-size: 14px;
  color: #8A8577;
}

/* 状态提示 */
.state-box {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 20px;
  color: #8A8577;
  font-size: 15px;
}
.state-box.error { color: #C0392B; }
.ink-spinner {
  width: 32px; height: 32px;
  border: 3px solid #E8DCC2;
  border-top-color: #C9A227;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.retry-btn {
  padding: 6px 20px;
  border: 1px solid #C0392B;
  border-radius: 4px;
  background: transparent;
  color: #C0392B;
  cursor: pointer;
  font-size: 13px;
}

/* 空态 */
.empty-state {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: center;
  padding: 40px 20px;
}
.empty-scroll {
  width: 100%;
  max-width: 400px;
}
.empty-scroll .scroll-top,
.empty-scroll .scroll-bottom {
  height: 14px;
  background: linear-gradient(to bottom, #8B6914, #C9A227, #8B6914);
  border-radius: 7px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
.empty-scroll .scroll-body {
  background: #E8DCC2;
  border-left: 3px solid #C9A227;
  border-right: 3px solid #C9A227;
  padding: 40px 24px;
}
.empty-content {
  text-align: center;
}
.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 12px;
  opacity: 0.5;
}
.empty-text {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 18px;
  font-weight: bold;
  color: #4A4A5A;
  margin: 0 0 6px;
}
.empty-hint {
  font-size: 13px;
  color: #8A8577;
  margin: 0;
}

/* ========== 审核卡片列表 ========== */
.review-list {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.review-card {
  background: #E8DCC2;
  border: 2px solid #C9A227;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  position: relative;
}

/* 状态徽章 */
.status-badge {
  position: absolute;
  top: 12px; right: 12px;
  padding: 3px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  letter-spacing: 0.04em;
  z-index: 2;
}
.status-badge.pending {
  background: rgba(201,162,39,0.2);
  color: #C9A227;
  border: 1px solid rgba(201,162,39,0.4);
}
.status-badge.approved {
  background: rgba(127,168,138,0.2);
  color: #5A8A64;
  border: 1px solid rgba(127,168,138,0.4);
}
.status-badge.rejected {
  background: rgba(192,57,43,0.15);
  color: #C0392B;
  border: 1px solid rgba(192,57,43,0.3);
}

/* 卡片主体 */
.card-body {
  display: flex;
  gap: 16px;
  padding: 16px;
}

/* 图片占位 */
.card-image {
  width: 80px; height: 80px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid rgba(201,162,39,0.3);
}
.image-placeholder {
  width: 100%; height: 100%;
  background: linear-gradient(135deg, rgba(138,133,119,0.12), rgba(138,133,119,0.05));
  display: flex;
  align-items: center;
  justify-content: center;
}
.placeholder-glyph {
  font-size: 32px;
  opacity: 0.5;
}

/* 信息区 */
.card-info {
  flex: 1;
  min-width: 0;
}
.info-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.student-name {
  font-size: 13px;
  color: #8A8577;
}
.submit-time {
  font-size: 12px;
  color: #8A8577;
  font-family: Georgia, serif;
}
.pet-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.pet-name {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 18px;
  font-weight: bold;
  letter-spacing: 0.04em;
}
.trigram-tag {
  padding: 2px 8px;
  border-radius: 3px;
  color: #fff;
  font-size: 11px;
  font-weight: bold;
}

/* 技能 */
.skills-section {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.skills-label {
  font-size: 12px;
  color: #4A4A5A;
}
.skill-chip {
  padding: 2px 8px;
  border-radius: 3px;
  background: rgba(28,28,36,0.06);
  font-size: 11px;
  color: #4A4A5A;
  border: 1px solid rgba(28,28,36,0.1);
}

/* 战力点数 */
.power-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.power-label {
  font-size: 12px;
  color: #8A8577;
}
.power-value {
  font-family: Georgia, serif;
  font-size: 16px;
  font-weight: bold;
  color: #C9A227;
}

/* ========== 审核操作区 ========== */
.card-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-top: 1px solid rgba(201,162,39,0.2);
  background: rgba(242,232,213,0.5);
}
.note-input-wrap { flex: 1; }
.note-input {
  width: 100%;
  padding: 6px 12px;
  border: 1px solid rgba(201,162,39,0.3);
  border-radius: 6px;
  background: #F2E8D5;
  font-family: 'Songti SC', serif;
  font-size: 13px;
  color: #1C1C24;
  outline: none;
  transition: border-color 0.15s;
}
.note-input:focus {
  border-color: #C9A227;
}
.note-input::placeholder {
  color: #8A8577;
}
.action-btns {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.btn {
  padding: 6px 18px;
  border-radius: 6px;
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.15s;
  border: 2px solid transparent;
  letter-spacing: 0.04em;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-approve {
  background: #7FA88A;
  border-color: #7FA88A;
  color: #fff;
}
.btn-approve:hover:not(:disabled) {
  background: #6d9677;
}
.btn-reject {
  background: transparent;
  border-color: #C0392B;
  color: #C0392B;
}
.btn-reject:hover:not(:disabled) {
  background: rgba(192,57,43,0.08);
}

@media (max-width: 640px) {
  .card-body { flex-direction: column; }
  .card-image { width: 100%; height: 100px; }
  .card-actions { flex-direction: column; }
  .action-btns { width: 100%; justify-content: flex-end; }
}
</style>
