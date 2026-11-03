<template>
  <div class="admin-pets">
    <!-- 水墨山水背景 -->
    <div class="bg-scene">
      <div class="cloud cloud-1"></div>
      <div class="cloud cloud-2"></div>
      <div class="mountain"></div>
    </div>

    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">宠物图鉴管理</h1>
      <span class="page-subtitle">共 {{ filteredTemplates.length }} 只宠物模板</span>
    </div>

    <!-- 品阶筛选标签 -->
    <div class="filter-bar">
      <button
        v-for="tab in tierTabs"
        :key="tab.value"
        :class="['filter-btn', { active: currentTier === tab.value }]"
        :style="currentTier === tab.value ? { background: tab.color, borderColor: tab.color, color: '#fff' } : {}"
        @click="currentTier = tab.value"
      >{{ tab.label }}</button>
    </div>

    <!-- 加载 / 错误 / 空态 -->
    <div v-if="loading" class="state-box">
      <div class="ink-spinner"></div>
      <span>载入图鉴中…</span>
    </div>
    <div v-else-if="error" class="state-box error">
      <span>⚠ {{ error }}</span>
      <button class="retry-btn" @click="loadData">重试</button>
    </div>
    <div v-else-if="filteredTemplates.length === 0" class="state-box">
      <span class="empty-icon">📜</span>
      <span>此品阶暂无宠物模板</span>
    </div>

    <!-- 宠物卡片网格 -->
    <div v-else class="pet-grid">
      <div
        v-for="pet in filteredTemplates"
        :key="pet.id"
        class="pet-card"
        :style="{ borderColor: getTrigramColor(pet.trigram) }"
        @click="openEdit(pet)"
      >
        <!-- 品阶角标 -->
        <div class="tier-badge" :style="{ background: getTierColor(pet.tier) }">
          {{ getTierName(pet.tier) }}
        </div>

        <!-- 图片占位 -->
        <div class="pet-image-wrap" :style="{ background: getTrigramBg(pet.trigram) }">
          <div class="image-placeholder">
            <span class="placeholder-glyph">{{ getTrigramGlyph(pet.trigram) }}</span>
          </div>
        </div>

        <!-- 信息区 -->
        <div class="pet-info">
          <div class="pet-name-row">
            <span class="pet-name">{{ pet.name }}</span>
            <span class="pet-pinyin">{{ pet.pinyin }}</span>
          </div>
          <div class="pet-meta-row">
            <span class="trigram-tag" :style="{ background: getTrigramColor(pet.trigram) }">
              {{ getTrigramGlyph(pet.trigram) }} {{ getTrigramName(pet.trigram) }}
            </span>
            <span class="role-tag">{{ pet.role || '—' }}</span>
          </div>
          <div class="pet-source">来源：{{ pet.source || '未知' }}</div>
        </div>
      </div>
    </div>

    <!-- 编辑弹窗 -->
    <Teleport to="body">
      <div v-if="editModal" class="modal-overlay" @click.self="editModal = null">
        <div class="modal-scroll">
          <div class="scroll-top"></div>
          <div class="scroll-body">
            <div class="modal-header">
              <h2 class="modal-title">编辑宠物模板</h2>
              <button class="modal-close" @click="editModal = null">✕</button>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">名称</label>
                <input v-model="editForm.name" class="form-input" placeholder="宠物名称" />
              </div>
              <div class="form-group">
                <label class="form-label">拼音</label>
                <input :value="editForm.pinyin" class="form-input" disabled />
              </div>
              <div class="form-group">
                <label class="form-label">品阶</label>
                <select v-model.number="editForm.tier" class="form-input">
                  <option v-for="t in tierOptions" :key="t.value" :value="t.value">{{ t.label }}</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">卦属</label>
                <select v-model="editForm.trigram" class="form-input">
                  <option v-for="g in trigramOptions" :key="g.value" :value="g.value">
                    {{ g.symbol }} {{ g.label }}
                  </option>
                </select>
              </div>
              <div class="form-group full-width">
                <label class="form-label">角色定位</label>
                <input v-model="editForm.role" class="form-input" placeholder="如：攻击/辅助/防御" />
              </div>
              <div class="form-group full-width">
                <label class="form-label">描述</label>
                <textarea v-model="editForm.description" class="form-input form-textarea" rows="3" placeholder="宠物描述…"></textarea>
              </div>
            </div>

            <div class="modal-actions">
              <button class="btn btn-ghost" @click="editModal = null">取消</button>
              <button class="btn btn-primary" :disabled="saving" @click="saveEdit">
                {{ saving ? '保存中…' : '保存修改' }}
              </button>
            </div>
          </div>
          <div class="scroll-bottom"></div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { v3Pets } from '@/api/v3'
import { useGameStore, type V3PetTemplate } from '@/stores/game'
import { tierName, getTier, getTrigram, trigramGlyphs } from '@/config/gameConfig'

const gameStore = useGameStore()

// ========== 状态 ==========
const loading = ref(false)
const error = ref('')
const currentTier = ref(0) // 0 = 全部
const templates = ref<V3PetTemplate[]>([])
const editModal = ref<V3PetTemplate | null>(null)
const saving = ref(false)
const editForm = ref({ name: '', pinyin: '', tier: 1, trigram: '', role: '', description: '' })

// ========== 品阶标签 ==========
const tierTabs = [
  { label: '全部', value: 0, color: '#8A8577' },
  { label: '万象', value: 1, color: '#8A8577' },
  { label: '八卦', value: 2, color: '#7FA88A' },
  { label: '四象', value: 3, color: '#C9A227' },
  { label: '太极', value: 4, color: '#C0392B' },
]

const tierOptions = [
  { label: '万象 (Tier 1)', value: 1 },
  { label: '八卦 (Tier 2)', value: 2 },
  { label: '四象 (Tier 3)', value: 3 },
  { label: '太极 (Tier 4)', value: 4 },
]

const trigramOptions = computed(() =>
  gameStore.trigrams.map(g => ({ value: g.code, label: g.name, symbol: g.symbol }))
)

// ========== 计算 ==========
const filteredTemplates = computed(() => {
  if (currentTier.value === 0) return templates.value
  return templates.value.filter(p => p.tier === currentTier.value)
})

// ========== 辅助函数 ==========
function getTierName(tier: number): string {
  return tierName(tier)
}

function getTierColor(tier: number): string {
  return getTier(tier)?.bezelColor || '#8A8577'
}

function getTrigramName(code: string): string {
  if (!code) return '—'
  const first = code.split(',')[0]
  return getTrigram(first)?.name || first
}

function getTrigramGlyph(code: string): string {
  return trigramGlyphs(code)
}

function getTrigramColor(code: string): string {
  if (!code) return '#8A8577'
  const first = code.split(',')[0]
  return getTrigram(first)?.color || '#8A8577'
}

function getTrigramBg(code: string): string {
  const color = getTrigramColor(code)
  return `linear-gradient(135deg, ${color}18, ${color}08)`
}

// ========== 数据加载 ==========
async function loadData() {
  loading.value = true
  error.value = ''
  try {
    await gameStore.loadConfig()
    const data = await v3Pets.getTemplates()
    templates.value = data.pets || data.templates || []
  } catch (e: any) {
    error.value = e.message || '加载失败'
  } finally {
    loading.value = false
  }
}

// ========== 编辑 ==========
function openEdit(pet: V3PetTemplate) {
  editForm.value = {
    name: pet.name,
    pinyin: pet.pinyin,
    tier: pet.tier,
    trigram: pet.trigram,
    role: pet.role || '',
    description: pet.description || '',
  }
  editModal.value = pet
}

async function saveEdit() {
  if (!editModal.value) return
  saving.value = true
  try {
    // TODO: 调用后端 API 保存修改（当前 v3 API 未提供 update 接口）
    // 暂时更新本地数据
    const idx = templates.value.findIndex(p => p.id === editModal.value!.id)
    if (idx >= 0) {
      templates.value[idx] = {
        ...templates.value[idx],
        name: editForm.value.name,
        tier: editForm.value.tier,
        trigram: editForm.value.trigram,
        role: editForm.value.role,
        description: editForm.value.description,
      }
    }
    editModal.value = null
  } catch (e: any) {
    error.value = e.message || '保存失败'
  } finally {
    saving.value = false
  }
}

// ========== 生命周期 ==========
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.admin-pets {
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

/* 筛选栏 */
.filter-bar {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.filter-btn {
  padding: 6px 18px;
  border: 2px solid #C9A227;
  border-radius: 6px;
  background: #E8DCC2;
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 14px;
  color: #4A4A5A;
  cursor: pointer;
  transition: all 0.15s ease;
  letter-spacing: 0.04em;
}
.filter-btn:hover {
  border-color: #C0392B;
  color: #1C1C24;
}
.filter-btn.active {
  color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
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
.empty-icon { font-size: 40px; opacity: 0.5; }
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

/* 宠物网格 */
.pet-grid {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
}

/* 宠物卡片 */
.pet-card {
  background: #E8DCC2;
  border: 2px solid #C9A227;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  position: relative;
}
.pet-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  border-color: #C0392B;
}

/* 品阶角标 */
.tier-badge {
  position: absolute;
  top: 8px; left: 8px;
  padding: 2px 8px;
  border-radius: 4px;
  color: #fff;
  font-size: 11px;
  font-weight: bold;
  z-index: 2;
  letter-spacing: 0.04em;
}

/* 图片区 */
.pet-image-wrap {
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(138,133,119,0.1), rgba(138,133,119,0.05));
  border-bottom: 1px solid rgba(201,162,39,0.2);
}
.image-placeholder {
  width: 72px; height: 72px;
  border-radius: 50%;
  background: rgba(28,28,36,0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}
.placeholder-glyph {
  font-size: 32px;
  opacity: 0.5;
}

/* 信息区 */
.pet-info {
  padding: 12px;
}
.pet-name-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 6px;
}
.pet-name {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 16px;
  font-weight: bold;
  letter-spacing: 0.04em;
}
.pet-pinyin {
  font-size: 11px;
  color: #8A8577;
}
.pet-meta-row {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.trigram-tag {
  padding: 1px 8px;
  border-radius: 3px;
  color: #fff;
  font-size: 11px;
  font-weight: bold;
}
.role-tag {
  padding: 1px 8px;
  border-radius: 3px;
  background: rgba(28,28,36,0.08);
  font-size: 11px;
  color: #4A4A5A;
}
.pet-source {
  font-size: 11px;
  color: #8A8577;
}

/* ========== 弹窗 ========== */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(28,28,36,0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.modal-scroll {
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
}
.modal-scroll .scroll-top,
.modal-scroll .scroll-bottom {
  height: 14px;
  background: linear-gradient(to bottom, #8B6914, #C9A227, #8B6914);
  border-radius: 7px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
.modal-scroll .scroll-body {
  background: #E8DCC2;
  border-left: 3px solid #C9A227;
  border-right: 3px solid #C9A227;
  padding: 24px;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.modal-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 20px;
  font-weight: bold;
  letter-spacing: 0.06em;
}
.modal-close {
  width: 32px; height: 32px;
  border: none;
  background: transparent;
  font-size: 18px;
  color: #8A8577;
  cursor: pointer;
  border-radius: 4px;
}
.modal-close:hover {
  background: rgba(28,28,36,0.08);
  color: #C0392B;
}

/* 表单 */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.form-group { display: flex; flex-direction: column; gap: 4px; }
.form-group.full-width { grid-column: 1 / -1; }
.form-label {
  font-size: 13px;
  color: #4A4A5A;
  font-weight: bold;
}
.form-input {
  padding: 8px 12px;
  border: 1px solid rgba(201,162,39,0.4);
  border-radius: 6px;
  background: #F2E8D5;
  font-family: 'Songti SC', serif;
  font-size: 14px;
  color: #1C1C24;
  outline: none;
  transition: border-color 0.15s;
}
.form-input:focus {
  border-color: #C9A227;
}
.form-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.form-textarea {
  resize: vertical;
  min-height: 60px;
}

/* 按钮 */
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}
.btn {
  padding: 8px 24px;
  border-radius: 6px;
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;
  border: 2px solid transparent;
}
.btn-ghost {
  background: transparent;
  border-color: #8A8577;
  color: #4A4A5A;
}
.btn-ghost:hover {
  border-color: #4A4A5A;
}
.btn-primary {
  background: #C9A227;
  border-color: #C9A227;
  color: #fff;
}
.btn-primary:hover {
  background: #b8931f;
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .pet-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
  .form-grid { grid-template-columns: 1fr; }
  .form-group.full-width { grid-column: 1; }
}
</style>
