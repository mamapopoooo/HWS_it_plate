<template>
  <div class="v3-character">
    <h1 class="page-title">我的角色</h1>

    <div v-if="!character" class="loading-state">加载中...</div>

    <div v-else class="char-layout">
      <!-- 左侧：角色形象 -->
      <div class="char-portrait">
        <div class="portrait-frame">
          <div class="portrait-bg" :style="{ background: portraitBg }"></div>
          <div class="portrait-avatar">
            <span class="avatar-char">{{ genderIcon }}</span>
          </div>
          <div class="portrait-skin" v-if="currentSkin">
            <img :src="currentSkin.image" :alt="currentSkin.name" class="skin-preview" @error="onSkinError" />
          </div>
        </div>
        <div class="portrait-name">
          <span class="name-text">{{ character.nickname || '无名' }}</span>
          <span class="name-title">{{ character.title || '新手修行者' }}</span>
        </div>
      </div>

      <!-- 右侧：编辑区 -->
      <div class="char-editor">
        <!-- 昵称修改 -->
        <div class="editor-card">
          <h3 class="card-title">道号</h3>
          <div class="nickname-row">
            <input
              v-model="newNickname"
              type="text"
              class="nickname-input"
              placeholder="输入新道号..."
              maxlength="12"
            />
            <button class="save-btn" @click="saveNickname" :disabled="!canSaveNickname">
              改名 ({{ renameCost }}💰)
            </button>
          </div>
          <div class="cost-hint">改名消耗 {{ renameCost }} 积分</div>
        </div>

        <!-- 性别切换 -->
        <div class="editor-card">
          <h3 class="card-title">性别</h3>
          <div class="gender-row">
            <button
              :class="['gender-btn', { active: character.gender === 'male' }]"
              @click="changeGender('male')"
            >男</button>
            <button
              :class="['gender-btn', { active: character.gender === 'female' }]"
              @click="changeGender('female')"
            >女</button>
          </div>
        </div>

        <!-- 皮肤列表 -->
        <div class="editor-card">
          <h3 class="card-title">皮肤</h3>
          <div class="skin-grid">
            <div
              v-for="skin in skins"
              :key="skin.id"
              :class="['skin-card', { owned: isOwned(skin.id), equipped: character.current_skin_id === skin.id }]"
              @click="handleSkinClick(skin)"
            >
              <div class="skin-preview-small">
                <img :src="skin.image" :alt="skin.name" @error="onSkinError" />
              </div>
              <div class="skin-info">
                <span class="skin-name">{{ skin.name }}</span>
                <span v-if="character.current_skin_id === skin.id" class="skin-badge">穿戴中</span>
                <span v-else-if="isOwned(skin.id)" class="skin-badge owned">已拥有</span>
                <span v-else class="skin-price">{{ skin.price }}💰</span>
              </div>
            </div>
          </div>
          <div v-if="skins.length === 0" class="empty-hint">暂无可用皮肤</div>
        </div>
      </div>
    </div>

    <!-- 提示弹窗 -->
    <div v-if="toast" class="toast" :class="toast.type">{{ toast.message }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGameStore } from '@/stores/game'
import { v3Character } from '@/api/v3'
import { ECONOMY } from '@/config/gameConfig'

const gameStore = useGameStore()

const character = computed(() => gameStore.character)
const skins = ref<any[]>([])
const ownedSkinIds = ref<Set<string>>(new Set())
const newNickname = ref('')
const toast = ref<{ message: string; type: 'success' | 'error' } | null>(null)

const renameCost = computed(() => ECONOMY.character?.nicknameChange || 15)
const genderIcon = computed(() => character.value?.gender === 'female' ? '♀' : '♂')
const currentSkin = computed(() => character.value?.currentSkin)
const portraitBg = computed(() => {
  const g = character.value?.gender === 'female' ? '#C0392B' : '#2E5C8A'
  return `radial-gradient(circle at 50% 40%, ${g}22, #E8DCC2)`
})

const canSaveNickname = computed(() => {
  return newNickname.value.trim() && newNickname.value.trim() !== character.value?.nickname
})

function isOwned(skinId: string) {
  return ownedSkinIds.value.has(skinId)
}

function showToast(message: string, type: 'success' | 'error' = 'success') {
  toast.value = { message, type }
  setTimeout(() => { toast.value = null }, 2000)
}

function onSkinError(e: Event) {
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
}

async function saveNickname() {
  if (!canSaveNickname.value) return
  try {
    await gameStore.updateCharacter({ nickname: newNickname.value.trim() })
    showToast('道号已更新')
  } catch (e: any) {
    showToast(e.message || '改名失败', 'error')
  }
}

async function changeGender(gender: string) {
  try {
    await gameStore.updateCharacter({ gender })
    showToast('性别已切换')
  } catch (e: any) {
    showToast(e.message || '操作失败', 'error')
  }
}

async function handleSkinClick(skin: any) {
  if (character.value?.current_skin_id === skin.id) return

  if (isOwned(skin.id)) {
    // 穿戴
    try {
      await v3Character.equipSkin(skin.id)
      await gameStore.loadCharacter()
      showToast('皮肤已穿戴')
    } catch (e: any) {
      showToast(e.message || '穿戴失败', 'error')
    }
  } else {
    // 购买
    try {
      await v3Character.buySkin(skin.id)
      ownedSkinIds.value.add(skin.id)
      await gameStore.loadCharacter()
      showToast('购买成功！')
    } catch (e: any) {
      showToast(e.message || '购买失败', 'error')
    }
  }
}

onMounted(async () => {
  await gameStore.loadConfig()
  await gameStore.loadCharacter()
  newNickname.value = character.value?.nickname || ''

  try {
    const data = await v3Character.getSkins()
    skins.value = data.skins || []
  } catch {}
})
</script>

<style scoped>
.v3-character {
  min-height: 100vh;
  padding: 20px;
  background: #F2E8D5;
  font-family: 'Songti SC', serif;
  color: #1C1C24;
}
.page-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 28px;
  text-align: center;
  margin-bottom: 24px;
  color: #2E5C8A;
  letter-spacing: 0.1em;
}
.loading-state {
  text-align: center;
  padding: 60px;
  color: #8A8577;
}

.char-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 24px;
  max-width: 900px;
  margin: 0 auto;
}

/* 左侧形象 */
.char-portrait { text-align: center; }
.portrait-frame {
  width: 240px;
  height: 300px;
  border: 3px solid #C9A227;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  background: #E8DCC2;
  margin: 0 auto 16px;
}
.portrait-bg {
  position: absolute;
  inset: 0;
}
.portrait-avatar {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-char {
  font-size: 80px;
  color: #4A4A5A;
  opacity: 0.6;
}
.portrait-skin {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.skin-preview {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.portrait-name {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.name-text {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 22px;
  font-weight: bold;
  letter-spacing: 0.06em;
}
.name-title {
  font-size: 13px;
  color: #C9A227;
}

/* 右侧编辑 */
.char-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.editor-card {
  background: #E8DCC2;
  border: 2px solid #C9A227;
  border-radius: 10px;
  padding: 16px;
}
.card-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 12px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(201,162,39,0.3);
  letter-spacing: 0.06em;
}

.nickname-row {
  display: flex;
  gap: 8px;
}
.nickname-input {
  flex: 1;
  padding: 8px 12px;
  border: 2px solid #C9A227;
  border-radius: 6px;
  background: #F2E8D5;
  font-size: 15px;
  font-family: 'Songti SC', serif;
  color: #1C1C24;
  outline: none;
}
.nickname-input:focus { border-color: #C0392B; }
.save-btn {
  padding: 8px 16px;
  background: #C0392B;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-family: 'KaiTi', 'STKaiti', serif;
  cursor: pointer;
  transition: all 0.12s;
  white-space: nowrap;
}
.save-btn:hover:not(:disabled) { filter: brightness(1.1); }
.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.cost-hint {
  margin-top: 6px;
  font-size: 12px;
  color: #8A8577;
}

.gender-row { display: flex; gap: 8px; }
.gender-btn {
  flex: 1;
  padding: 10px;
  border: 2px solid #C9A227;
  border-radius: 6px;
  background: transparent;
  font-size: 16px;
  font-family: 'KaiTi', 'STKaiti', serif;
  cursor: pointer;
  transition: all 0.15s;
  color: #4A4A5A;
}
.gender-btn:hover { background: rgba(201,162,39,0.1); }
.gender-btn.active {
  background: #C9A227;
  color: white;
  border-color: #8B6914;
}

.skin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 10px;
}
.skin-card {
  border: 2px solid rgba(201,162,39,0.3);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.12s;
  background: #F2E8D5;
}
.skin-card:hover { border-color: #C9A227; transform: translateY(-2px); }
.skin-card.equipped { border-color: #7FA88A; border-width: 3px; }
.skin-card.owned { border-color: #C9A227; }
.skin-preview-small {
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(28,28,36,0.03);
}
.skin-preview-small img {
  max-height: 70px;
  max-width: 70px;
  object-fit: contain;
}
.skin-info {
  padding: 6px 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
 gap: 2px;
}
.skin-name { font-size: 12px; font-weight: bold; }
.skin-badge {
  font-size: 10px;
  color: #7FA88A;
  font-weight: bold;
}
.skin-badge.owned { color: #C9A227; }
.skin-price {
  font-size: 10px;
  color: #C0392B;
  font-family: Georgia, serif;
}
.empty-hint {
  text-align: center;
  padding: 20px;
  color: #8A8577;
  font-size: 14px;
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
  z-index: 100;
  animation: toast-in 0.3s ease;
}
.toast.success { background: #7FA88A; color: white; }
.toast.error { background: #C0392B; color: white; }
@keyframes toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

@media (max-width: 768px) {
  .char-layout { grid-template-columns: 1fr; }
  .portrait-frame { width: 200px; height: 250px; }
}
</style>
