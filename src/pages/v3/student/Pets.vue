<template>
  <div class="v3-pets">
    <div class="page-header">
      <h1 class="page-title">我的宠物</h1>
      <div class="filter-bar">
        <button
          v-for="t in tierFilters"
          :key="t.value ?? 'all'"
          :class="['filter-btn', { active: currentFilter === t.value }]"
          :style="currentFilter === t.value ? { background: t.color, borderColor: t.color } : {}"
          @click="currentFilter = t.value"
        >{{ t.label }}</button>
      </div>
    </div>

    <!-- 战力总览 -->
    <div class="power-summary">
      <span>队伍总战力</span>
      <span class="power-value">{{ totalPower }}</span>
    </div>

    <!-- 宠物列表 -->
    <div class="pet-grid">
      <div
        v-for="pet in filteredPets"
        :key="pet.id"
        :class="['pet-card', { selected: selectedTeam.includes(pet.id) }]"
        :style="{ borderColor: getTrigramColor(pet.element) }"
        @click="toggleTeamSelect(pet.id)"
      >
        <!-- 品阶角标 -->
        <div class="tier-badge" :style="{ background: getTierColor(pet.tier) }">
          {{ getTierName(pet.tier) }}
        </div>

        <!-- 宠物图片区 -->
        <div class="pet-image-wrap" :style="{ background: getTrigramBg(pet.element) }">
          <img
            :src="getPetImage(pet)"
            :alt="pet.template_name"
            class="pet-image"
            @error="onImageError($event, pet)"
          />
          <!-- 形态光效 -->
          <div v-if="pet.form > 1" class="form-aura" :class="'form-' + pet.form"></div>
        </div>

        <!-- 信息区 -->
        <div class="pet-info">
          <div class="pet-name-row">
            <span class="pet-name">{{ pet.template_name }}</span>
            <span class="pet-pinyin">{{ getPinyin(pet.template_id) }}</span>
          </div>
          <div class="pet-meta-row">
            <span class="trigram-tag" :style="{ background: getTrigramColor(pet.element) }">
              {{ getTrigramGlyph(pet.element) }} {{ getTrigramName(pet.element) }}
            </span>
            <span class="form-tag">{{ getFormName(pet.form) }}</span>
            <span class="level-tag">Lv.{{ pet.level }}</span>
          </div>
          <div class="pet-stats">
            <span class="stat-power">⚡ {{ pet.power }}</span>
            <span class="stat-awaken">
              觉醒 {{ pet.awakening_level }}/{{ getMaxAwaken(pet.tier) }}
            </span>
          </div>
        </div>

        <!-- 觉醒按钮 -->
        <button
          v-if="pet.awakening_level < getMaxAwaken(pet.tier)"
          class="awaken-btn"
          :style="{ background: getTrigramColor(pet.element) }"
          @click.stop="handleAwaken(pet)"
        >
          觉醒 ({{ getAwakenCost(pet.tier) }}💰)
        </button>
        <div v-else class="max-awaken-label">已满觉</div>

        <!-- 选中指示 -->
        <div v-if="selectedTeam.includes(pet.id)" class="selected-mark">✓</div>
      </div>
    </div>

    <div v-if="filteredPets.length === 0" class="empty-state">
      <div class="empty-icon">🐾</div>
      <div class="empty-text">暂无宠物，去求签获取吧</div>
      <router-link to="/student/gacha" class="empty-link">前往求签 →</router-link>
    </div>

    <!-- 觉醒结果弹窗 -->
    <div v-if="awakenResult" class="modal-overlay" @click="awakenResult = null">
      <div class="modal-content" @click.stop>
        <div class="modal-title">觉醒成功</div>
        <div class="modal-body">
          <p>形态变为：<strong>{{ awakenResult.formName }}</strong></p>
          <p v-if="awakenResult.formChanged" class="form-change">🎉 形态进化！</p>
          <p>消耗：{{ awakenResult.cost }} 积分</p>
        </div>
        <button class="modal-close" @click="awakenResult = null">确认</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGameStore, type V3PlayerPet } from '@/stores/game'
import { getTier, getTrigram, tierName, formName, FORM_NAMES, ECONOMY } from '@/config/gameConfig'
import { getPetImageUrl, createImageFallbackChain } from '@/api/v3'

const gameStore = useGameStore()

const currentFilter = ref<number | null>(null)
const selectedTeam = ref<string[]>([])
const awakenResult = ref<any>(null)

const tierFilters = computed(() => {
  const filters: { value: number | null; label: string; color: string }[] = [{ value: null, label: '全部', color: '#8A8577' }]
  for (const t of gameStore.tiers) {
    if (t.is_gacha || t.tier <= 4) {
      filters.push({ value: t.tier, label: t.name, color: t.bezel_color })
    }
  }
  return filters
})

const filteredPets = computed(() => {
  if (currentFilter.value === null) return gameStore.myPets
  return gameStore.myPets.filter(p => p.tier === currentFilter.value)
})

const totalPower = computed(() => {
  return gameStore.myPets
    .filter(p => selectedTeam.value.includes(p.id))
    .reduce((sum, p) => sum + (p.power || 0), 0)
})

function getTierName(tier: number) { return tierName(tier) }
function getTierColor(tier: number) { return getTier(tier)?.bezelColor || '#8A8577' }
function getTrigramName(code: string) { return getTrigram(code)?.name || code }
function getTrigramColor(code: string) { return getTrigram(code)?.color || '#8A8577' }
function getTrigramGlyph(code: string) { return getTrigram(code)?.symbol || '☰' }
function getTrigramBg(code: string) {
  const c = getTrigram(code)?.color || '#8A8577'
  return `radial-gradient(circle at 50% 60%, ${c}22, ${c}08)`
}
function getFormName(form: number) { return FORM_NAMES[form - 1] || `第${form}相` }
function getMaxAwaken(tier: number) { return getTier(tier)?.awakenCap || 1 }
function getAwakenCost(tier: number) {
  const costs = ECONOMY.awaken as Record<string, number>
  return costs[`tier${tier}`] || tier * 30
}
function getPinyin(templateId: string) {
  // 从 gameConfig 的 PETS 中查找
  const pet = (window as any).__PETS__?.find?.((p: any) => p.id === templateId)
  return pet?.pinyin || ''
}

function getPetImage(pet: V3PlayerPet) {
  return getPetImageUrl(pet.template_id, pet.form, pet.formImages)
}

function onImageError(e: Event, pet: V3PlayerPet) {
  const handler = createImageFallbackChain(pet.template_id, pet.form)
  handler(e)
}

function toggleTeamSelect(petId: string) {
  const idx = selectedTeam.value.indexOf(petId)
  if (idx >= 0) {
    selectedTeam.value.splice(idx, 1)
  } else if (selectedTeam.value.length < 4) {
    selectedTeam.value.push(petId)
  }
}

async function handleAwaken(pet: V3PlayerPet) {
  try {
    const data = await gameStore.awakenPet(pet.id)
    awakenResult.value = {
      form: data.form,
      formName: formName(data.form),
      formChanged: data.formChanged,
      cost: data.cost
    }
  } catch (e: any) {
    alert(e.message || '觉醒失败')
  }
}

onMounted(async () => {
  await gameStore.loadConfig()
  await gameStore.loadMyPets()
})
</script>

<style scoped>
.v3-pets {
  min-height: 100vh;
  padding: 20px;
  background: #F2E8D5;
  font-family: 'Songti SC', 'STSong', serif;
  color: #1C1C24;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.page-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 24px;
  letter-spacing: 0.06em;
}
.filter-bar { display: flex; gap: 6px; flex-wrap: wrap; }
.filter-btn {
  padding: 4px 12px;
  border: 2px solid #8A8577;
  border-radius: 4px;
  background: transparent;
  color: #4A4A5A;
  font-size: 13px;
  cursor: pointer;
  font-family: 'KaiTi', 'STKaiti', serif;
  transition: all 0.12s;
}
.filter-btn:hover { border-color: #C0392B; color: #C0392B; }
.filter-btn.active { color: white; }

.power-summary {
  background: #E8DCC2;
  border: 2px solid #C9A227;
  border-radius: 8px;
  padding: 10px 16px;
  margin-bottom: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}
.power-value {
  font-family: Georgia, serif;
  font-size: 20px;
  font-weight: bold;
  color: #C9A227;
}

.pet-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
}
.pet-card {
  background: #E8DCC2;
  border: 2px solid;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.12s;
  position: relative;
}
.pet-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.pet-card.selected { border-width: 3px; box-shadow: 0 0 0 2px #C9A227; }

.tier-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 2px 8px;
  border-radius: 3px;
  color: white;
  font-size: 11px;
  font-weight: bold;
  z-index: 2;
}

.pet-image-wrap {
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}
.pet-image {
  max-height: 120px;
  max-width: 120px;
  object-fit: contain;
  position: relative;
  z-index: 1;
  animation: float 4.2s ease-in-out infinite;
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
.form-aura {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  opacity: 0.3;
  animation: rotate 48s linear infinite;
}
.form-2 { background: radial-gradient(circle, rgba(201,162,39,0.3), transparent 70%); }
.form-3 { background: radial-gradient(circle, rgba(192,57,43,0.3), transparent 70%); }
@keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.pet-info { padding: 10px 12px; }
.pet-name-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 4px;
}
.pet-name {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 16px;
  font-weight: bold;
}
.pet-pinyin {
  font-size: 11px;
  color: #8A8577;
}
.pet-meta-row {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.trigram-tag {
  padding: 1px 6px;
  border-radius: 3px;
  color: white;
  font-size: 11px;
  font-weight: bold;
}
.form-tag {
  padding: 1px 6px;
  border: 1px solid #C9A227;
  border-radius: 3px;
  font-size: 11px;
  color: #C9A227;
}
.level-tag {
  padding: 1px 6px;
  background: rgba(28,28,36,0.08);
  border-radius: 3px;
  font-size: 11px;
  color: #4A4A5A;
}
.pet-stats {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #4A4A5A;
}
.stat-power {
  font-family: Georgia, serif;
  font-weight: bold;
  color: #C9A227;
}

.awaken-btn {
  display: block;
  width: calc(100% - 24px);
  margin: 0 12px 12px;
  padding: 6px;
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  font-family: 'KaiTi', 'STKaiti', serif;
  letter-spacing: 0.06em;
  transition: all 0.12s;
}
.awaken-btn:hover { filter: brightness(1.1); }
.awaken-btn:active { transform: scale(0.97); }

.max-awaken-label {
  text-align: center;
  padding: 6px;
  font-size: 12px;
  color: #8A8577;
}

.selected-mark {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  background: #C9A227;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 14px;
  z-index: 2;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
}
.empty-icon { font-size: 48px; margin-bottom: 12px; }
.empty-text { font-size: 16px; color: #8A8577; margin-bottom: 16px; }
.empty-link {
  color: #C0392B;
  text-decoration: none;
  font-weight: bold;
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
  min-width: 280px;
  text-align: center;
}
.modal-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 20px;
  font-weight: bold;
  color: #C9A227;
  margin-bottom: 16px;
}
.modal-body { margin-bottom: 16px; line-height: 1.8; }
.form-change { color: #C0392B; font-weight: bold; font-size: 16px; }
.modal-close {
  padding: 8px 24px;
  background: #C0392B;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  font-family: 'KaiTi', 'STKaiti', serif;
}
.modal-close:hover { filter: brightness(1.1); }
</style>
