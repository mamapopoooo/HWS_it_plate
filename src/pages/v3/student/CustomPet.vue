<template>
  <div class="v3-custom-pet">
    <!-- 水墨山水背景 -->
    <div class="bg-scene">
      <div class="cloud cloud-1"></div>
      <div class="cloud cloud-2"></div>
      <div class="mountain"></div>
    </div>

    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">无极造物</h1>
      <span class="page-subtitle">太极生两仪，两仪生四象，四象生八卦</span>
    </div>

    <!-- 加载状态 -->
    <div v-if="checking" class="loading-state">
      <div class="loading-spinner"></div>
      <div class="loading-text">感应中...</div>
    </div>

    <!-- 未解锁 -->
    <div v-else-if="!unlocked" class="locked-state">
      <div class="locked-scroll">
        <div class="scroll-top-bar"></div>
        <div class="scroll-body">
          <div class="locked-icon">☯</div>
          <div class="locked-title">造物之门未启</div>
          <div class="locked-desc">需同时拥有阴鱼·太阴和阳鱼·太阳方可造物</div>
          <div class="locked-hint">
            <span class="hint-item">阴鱼·太阴</span>
            <span class="hint-plus">+</span>
            <span class="hint-item">阳鱼·太阳</span>
            <span class="hint-eq">=</span>
            <span class="hint-result">无极造物</span>
          </div>
        </div>
        <div class="scroll-bottom-bar"></div>
      </div>
    </div>

    <!-- 已有造物 -->
    <div v-else-if="existingPet" class="existing-state">
      <div class="existing-scroll">
        <div class="scroll-top-bar"></div>
        <div class="scroll-body">
          <div class="existing-pet-card">
            <!-- 造物图片 -->
            <div class="existing-image-wrap">
              <div class="existing-image-placeholder">
                {{ existingPet.name?.charAt(0) || '造' }}
              </div>
            </div>

            <!-- 造物信息 -->
            <div class="existing-info">
              <div class="existing-name">{{ existingPet.name }}</div>
              <div class="existing-meta">
                <span v-if="existingPet.trigram" class="trigram-tag" :style="{ background: getTrigramColor(existingPet.trigram) }">
                  {{ getTrigramSymbol(existingPet.trigram) }} {{ getTrigramName(existingPet.trigram) }}
                </span>
              </div>

              <!-- 技能列表 -->
              <div class="existing-skills" v-if="existingPet.skills?.length">
                <div class="skills-title">技能</div>
                <div v-for="skill in existingPet.skills" :key="skill.code" class="skill-tag">
                  {{ skill.name || skill.code }}
                </div>
              </div>

              <!-- 审核状态 -->
              <div class="status-section">
                <div :class="['status-badge', 'status-' + existingPet.status]">
                  <span class="status-label">{{ statusLabel }}</span>
                </div>
                <div v-if="existingPet.reject_reason" class="reject-reason">
                  {{ existingPet.reject_reason }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="scroll-bottom-bar"></div>
      </div>
    </div>

    <!-- 造物表单 -->
    <div v-else class="creation-state">
      <div class="creation-scroll">
        <div class="scroll-top-bar"></div>
        <div class="scroll-body">
          <form class="creation-form" @submit.prevent="handleSubmit">
            <!-- 名称 -->
            <div class="form-section">
              <label class="form-label">造物之名</label>
              <input
                v-model="form.name"
                class="form-input"
                type="text"
                placeholder="为造物取名..."
                maxlength="6"
                required
              />
              <div class="char-count">{{ form.name.length }}/6</div>
            </div>

            <!-- 八卦选择 -->
            <div class="form-section">
              <label class="form-label">卦属</label>
              <div class="trigram-grid">
                <button
                  v-for="t in trigramList"
                  :key="t.code"
                  type="button"
                  :class="['trigram-option', { selected: form.trigram === t.code }]"
                  :style="form.trigram === t.code ? { borderColor: t.color, background: t.color + '18' } : {}"
                  @click="form.trigram = t.code"
                >
                  <span class="trigram-symbol" :style="{ color: t.color }">{{ t.symbol }}</span>
                  <span class="trigram-name">{{ t.name }}</span>
                  <span class="trigram-element">{{ t.element }}</span>
                </button>
              </div>
            </div>

            <!-- 技能选择 -->
            <div class="form-section">
              <label class="form-label">
                技能选择
                <span class="budget-info">
                  预算 <span :class="{ 'budget-over': totalCost > maxBudget }">{{ totalCost }}</span> / {{ maxBudget }}
                </span>
              </label>
              <div class="skill-list">
                <div
                  v-for="skill in skillEffects"
                  :key="skill.code"
                  :class="['skill-option', { selected: isSkillSelected(skill.code) }]"
                  @click="toggleSkill(skill)"
                >
                  <div class="skill-header">
                    <span class="skill-name">{{ skill.name }}</span>
                    <span class="skill-cost">{{ skill.cost }}点</span>
                  </div>
                  <div class="skill-desc">{{ skill.description }}</div>
                  <div v-if="isSkillSelected(skill.code)" class="skill-check">✓</div>
                </div>
              </div>
              <div v-if="totalCost > maxBudget" class="budget-warning">超出预算上限！请减少技能</div>
              <div class="selected-count">已选 {{ selectedSkills.length }}/{{ maxSkillCount }} 个技能</div>
            </div>

            <!-- 图片上传占位 -->
            <div class="form-section">
              <label class="form-label">造物图</label>
              <div class="upload-area">
                <div class="upload-placeholder">
                  <span class="upload-icon">🖌️</span>
                  <span class="upload-text">上传造物图</span>
                  <span class="upload-hint">点击上传图片（支持 PNG/JPG）</span>
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  class="upload-input"
                  @change="handleFileChange"
                />
              </div>
              <div v-if="uploadedFileName" class="uploaded-hint">已选择: {{ uploadedFileName }}</div>
            </div>

            <!-- 提交按钮 -->
            <button
              type="submit"
              class="submit-btn"
              :disabled="!canSubmit || submitting"
            >
              {{ submitting ? '造物中...' : '开炉造物' }}
            </button>
          </form>
        </div>
        <div class="scroll-bottom-bar"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useGameStore } from '@/stores/game'
import { v3Pets, v3CustomPets } from '@/api/v3'
import { getTrigram } from '@/config/gameConfig'
import skillEffectsData from '../../../../docs/seeds/skill_effects.json'

const gameStore = useGameStore()

// 状态
const checking = ref(true)
const unlocked = ref(false)
const existingPet = ref<any>(null)
const submitting = ref(false)
const uploadedFileName = ref('')
const uploadedImageData = ref('')

// 技能效果池
interface SkillEffect {
  code: string
  name: string
  cost: number
  description: string
  impl: string
  params: Record<string, any>
}

const skillEffects: SkillEffect[] = (skillEffectsData as any).effects || []
const maxBudget = (skillEffectsData as any).customBudget || 120
const maxSkillCount = (skillEffectsData as any).customSkillCount || 3

// 表单
const form = reactive({
  name: '',
  trigram: '',
  skills: [] as string[]
})

const selectedSkills = computed(() => {
  return form.skills.map(code => skillEffects.find(s => s.code === code)).filter(Boolean) as SkillEffect[]
})

const totalCost = computed(() => {
  return selectedSkills.value.reduce((sum, s) => sum + s.cost, 0)
})

const canSubmit = computed(() => {
  return (
    form.name.trim().length > 0 &&
    form.name.trim().length <= 6 &&
    form.trigram !== '' &&
    selectedSkills.value.length > 0 &&
    selectedSkills.value.length <= maxSkillCount &&
    totalCost.value <= maxBudget &&
    !submitting.value
  )
})

// 八卦列表
const trigramList = computed(() => {
  if (gameStore.trigrams.length > 0) {
    return gameStore.trigrams.map(t => ({
      code: t.code,
      name: t.name,
      symbol: t.symbol,
      element: t.element,
      color: t.color
    }))
  }
  // 回落默认值
  return [
    { code: 'qian', name: '乾', symbol: '☰', element: '天', color: '#2E5C8A' },
    { code: 'kun', name: '坤', symbol: '☷', element: '地', color: '#C8A165' },
    { code: 'zhen', name: '震', symbol: '☳', element: '雷', color: '#6D4C9F' },
    { code: 'xun', name: '巽', symbol: '☴', element: '风', color: '#3E7C59' },
    { code: 'kan', name: '坎', symbol: '☵', element: '水', color: '#1F4E79' },
    { code: 'li', name: '离', symbol: '☲', element: '火', color: '#C0392B' },
    { code: 'gen', name: '艮', symbol: '☶', element: '山', color: '#8C6239' },
    { code: 'dui', name: '兑', symbol: '☱', element: '泽', color: '#3E9E8F' }
  ]
})

// 审核状态标签
const statusLabel = computed(() => {
  const map: Record<string, string> = {
    pending: '审核中',
    approved: '已通过',
    rejected: '已驳回'
  }
  return map[existingPet.value?.status] || '未知'
})

function getTrigramColor(code: string): string {
  return getTrigram(code)?.color || '#8A8577'
}
function getTrigramSymbol(code: string): string {
  return getTrigram(code)?.symbol || '☰'
}
function getTrigramName(code: string): string {
  return getTrigram(code)?.name || code
}

function isSkillSelected(code: string): boolean {
  return form.skills.includes(code)
}

function toggleSkill(skill: SkillEffect) {
  const idx = form.skills.indexOf(skill.code)
  if (idx >= 0) {
    form.skills.splice(idx, 1)
  } else {
    if (form.skills.length >= maxSkillCount) {
      alert(`最多选择 ${maxSkillCount} 个技能`)
      return
    }
    // 检查预算
    const newCost = totalCost.value + skill.cost
    if (newCost > maxBudget) {
      alert(`超出预算上限（${maxBudget}点），无法添加此技能`)
      return
    }
    form.skills.push(skill.code)
  }
}

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploadedFileName.value = file.name
  // 读取为 base64
  const reader = new FileReader()
  reader.onload = () => {
    uploadedImageData.value = reader.result as string
  }
  reader.readAsDataURL(file)
}

async function handleSubmit() {
  if (!canSubmit.value) return
  submitting.value = true
  try {
    const payload: any = {
      name: form.name.trim(),
      trigram: form.trigram,
      skills: selectedSkills.value.map(s => ({
        code: s.code,
        name: s.name,
        impl: s.impl,
        params: s.params
      }))
    }
    if (uploadedImageData.value) {
      payload.image = uploadedImageData.value
    }
    await v3CustomPets.submit(payload)
    // 刷新造物状态
    await loadExistingPet()
  } catch (e: any) {
    alert(e.message || '造物失败，请重试')
  } finally {
    submitting.value = false
  }
}

async function loadExistingPet() {
  try {
    const data = await v3CustomPets.getMy()
    existingPet.value = data.pet || null
  } catch {
    existingPet.value = null
  }
}

onMounted(async () => {
  // 确保配置已加载
  await gameStore.loadConfig()

  // 检查隐藏位解锁
  try {
    const result = await v3Pets.checkHiddenUnlock()
    unlocked.value = result.unlocked === true
  } catch {
    unlocked.value = false
  }

  // 如果已解锁，检查是否已有造物
  if (unlocked.value) {
    await loadExistingPet()
  }

  checking.value = false
})
</script>

<style scoped>
.v3-custom-pet {
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
.cloud-1 { top: 15%; left: -200px; animation-delay: 0s; }
.cloud-2 { top: 30%; left: -200px; animation-delay: 15s; width: 300px; }
@keyframes drift {
  from { transform: translateX(0); }
  to { transform: translateX(calc(100vw + 400px)); }
}

/* 页面标题 */
.page-header {
  position: relative;
  z-index: 1;
  margin-bottom: 24px;
  text-align: center;
}
.page-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 28px;
  font-weight: bold;
  letter-spacing: 0.12em;
  color: #1C1C24;
  margin: 0;
}
.page-subtitle {
  display: block;
  font-size: 13px;
  color: #8A8577;
  margin-top: 6px;
  letter-spacing: 0.04em;
}

/* 卷轴框架通用 */
.scroll-top-bar,
.scroll-bottom-bar {
  height: 14px;
  background: linear-gradient(to bottom, #8B6914, #C9A227, #8B6914);
  border-radius: 7px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);
}
.scroll-body {
  background: #E8DCC2;
  border-left: 3px solid #C9A227;
  border-right: 3px solid #C9A227;
  padding: 24px;
}

/* 加载状态 */
.loading-state {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
}
.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(201,162,39,0.2);
  border-top-color: #C9A227;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 16px;
  color: #8A8577;
  letter-spacing: 0.1em;
}

/* 未解锁状态 */
.locked-state {
  position: relative;
  z-index: 1;
}
.locked-scroll {
  max-width: 420px;
  margin: 0 auto;
}
.locked-icon {
  font-size: 56px;
  text-align: center;
  margin-bottom: 16px;
  opacity: 0.6;
}
.locked-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 20px;
  font-weight: bold;
  text-align: center;
  letter-spacing: 0.08em;
  margin-bottom: 10px;
  color: #4A4A5A;
}
.locked-desc {
  font-size: 14px;
  color: #8A8577;
  text-align: center;
  line-height: 1.8;
  margin-bottom: 20px;
}
.locked-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}
.hint-item {
  padding: 4px 12px;
  background: rgba(28,28,36,0.06);
  border-radius: 4px;
  font-size: 13px;
  color: #4A4A5A;
  font-family: 'KaiTi', 'STKaiti', serif;
}
.hint-plus, .hint-eq {
  color: #8A8577;
  font-size: 14px;
}
.hint-result {
  padding: 4px 12px;
  background: rgba(201,162,39,0.12);
  border: 1px solid #C9A227;
  border-radius: 4px;
  font-size: 13px;
  color: #C9A227;
  font-weight: bold;
  font-family: 'KaiTi', 'STKaiti', serif;
}

/* 已有造物 */
.existing-state {
  position: relative;
  z-index: 1;
}
.existing-scroll {
  max-width: 480px;
  margin: 0 auto;
}
.existing-pet-card {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}
.existing-image-wrap {
  flex-shrink: 0;
}
.existing-image-placeholder {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(201,162,39,0.15), rgba(127,168,138,0.15));
  border: 2px solid #C9A227;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 32px;
  color: #C9A227;
  font-weight: bold;
}
.existing-info { flex: 1; min-width: 0; }
.existing-name {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 20px;
  font-weight: bold;
  letter-spacing: 0.06em;
  margin-bottom: 6px;
}
.existing-meta {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}
.trigram-tag {
  padding: 2px 10px;
  border-radius: 4px;
  color: white;
  font-size: 12px;
  font-weight: bold;
}
.existing-skills {
  margin-bottom: 12px;
}
.skills-title {
  font-size: 12px;
  color: #8A8577;
  margin-bottom: 4px;
}
.skill-tag {
  display: inline-block;
  padding: 2px 8px;
  margin: 2px 4px 2px 0;
  background: rgba(46,92,138,0.1);
  border: 1px solid rgba(46,92,138,0.25);
  border-radius: 4px;
  font-size: 12px;
  color: #2E5C8A;
}
.status-section { margin-top: 8px; }
.status-badge {
  display: inline-block;
  padding: 3px 14px;
  border-radius: 4px;
  font-size: 13px;
  font-weight: bold;
  font-family: 'KaiTi', 'STKaiti', serif;
  letter-spacing: 0.06em;
}
.status-pending {
  background: rgba(201,162,39,0.15);
  color: #C9A227;
  border: 1px solid #C9A227;
}
.status-approved {
  background: rgba(127,168,138,0.15);
  color: #7FA88A;
  border: 1px solid #7FA88A;
}
.status-rejected {
  background: rgba(192,57,43,0.1);
  color: #C0392B;
  border: 1px solid #C0392B;
}
.reject-reason {
  margin-top: 8px;
  font-size: 12px;
  color: #C0392B;
  line-height: 1.6;
}

/* 造物表单 */
.creation-state {
  position: relative;
  z-index: 1;
}
.creation-scroll {
  max-width: 520px;
  margin: 0 auto;
}
.creation-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.form-label {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 15px;
  font-weight: bold;
  letter-spacing: 0.06em;
  color: #1C1C24;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.budget-info {
  font-family: Georgia, serif;
  font-size: 13px;
  font-weight: normal;
  color: #8A8577;
}
.budget-over {
  color: #C0392B;
  font-weight: bold;
}

.form-input {
  padding: 10px 14px;
  border: 2px solid rgba(138,133,119,0.3);
  border-radius: 8px;
  background: rgba(242,232,213,0.6);
  font-family: 'Songti SC', 'STSong', serif;
  font-size: 15px;
  color: #1C1C24;
  outline: none;
  transition: border-color 0.15s;
}
.form-input:focus {
  border-color: #C9A227;
}
.form-input::placeholder {
  color: #8A8577;
}
.char-count {
  text-align: right;
  font-size: 11px;
  font-family: Georgia, serif;
  color: #8A8577;
}

/* 八卦选择器 */
.trigram-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.trigram-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 4px;
  border: 2px solid rgba(138,133,119,0.2);
  border-radius: 8px;
  background: rgba(242,232,213,0.4);
  cursor: pointer;
  transition: all 0.12s;
}
.trigram-option:hover {
  border-color: rgba(138,133,119,0.5);
  background: rgba(242,232,213,0.8);
}
.trigram-option.selected {
  border-width: 2px;
  background: rgba(242,232,213,0.9);
}
.trigram-symbol {
  font-size: 24px;
  line-height: 1;
}
.trigram-name {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 14px;
  font-weight: bold;
}
.trigram-element {
  font-size: 11px;
  color: #8A8577;
}

/* 技能列表 */
.skill-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.skill-option {
  padding: 10px 14px;
  border: 2px solid rgba(138,133,119,0.2);
  border-radius: 8px;
  background: rgba(242,232,213,0.4);
  cursor: pointer;
  transition: all 0.12s;
  position: relative;
}
.skill-option:hover {
  border-color: rgba(138,133,119,0.4);
}
.skill-option.selected {
  border-color: #C9A227;
  background: rgba(201,162,39,0.08);
}
.skill-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.skill-name {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 14px;
  font-weight: bold;
}
.skill-cost {
  font-family: Georgia, serif;
  font-size: 12px;
  color: #C9A227;
  font-weight: bold;
}
.skill-desc {
  font-size: 12px;
  color: #4A4A5A;
  line-height: 1.5;
}
.skill-check {
  position: absolute;
  top: 8px;
  right: 10px;
  color: #C9A227;
  font-weight: bold;
  font-size: 14px;
}
.budget-warning {
  font-size: 12px;
  color: #C0392B;
  font-weight: bold;
  text-align: center;
  padding: 4px;
}
.selected-count {
  font-size: 12px;
  color: #8A8577;
  text-align: right;
  font-family: Georgia, serif;
}

/* 上传区 */
.upload-area {
  position: relative;
}
.upload-placeholder {
  border: 2px dashed rgba(138,133,119,0.4);
  border-radius: 10px;
  padding: 30px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.15s;
  background: rgba(242,232,213,0.3);
}
.upload-placeholder:hover {
  border-color: #C9A227;
  background: rgba(201,162,39,0.05);
}
.upload-icon { font-size: 32px; }
.upload-text {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 15px;
  color: #4A4A5A;
}
.upload-hint {
  font-size: 12px;
  color: #8A8577;
}
.upload-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.uploaded-hint {
  font-size: 12px;
  color: #7FA88A;
  margin-top: 4px;
}

/* 提交按钮 */
.submit-btn {
  padding: 12px 0;
  background: #1C1C24;
  color: #F2E8D5;
  border: none;
  border-radius: 8px;
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 17px;
  font-weight: bold;
  letter-spacing: 0.12em;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 4px 12px rgba(28,28,36,0.2);
}
.submit-btn:hover:not(:disabled) {
  background: #2E5C8A;
  box-shadow: 0 4px 16px rgba(46,92,138,0.3);
}
.submit-btn:active:not(:disabled) {
  transform: scale(0.98);
}
.submit-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .v3-custom-pet { padding: 14px; }
  .page-title { font-size: 24px; }
  .scroll-body { padding: 18px 14px; }
  .trigram-grid { grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .existing-pet-card { flex-direction: column; align-items: center; text-align: center; }
}
</style>
