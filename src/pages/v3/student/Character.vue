<template>
  <div class="v3-character">
    <!-- 水墨山水背景 -->
    <div class="bg-scene">
      <div class="cloud cloud-1"></div>
      <div class="cloud cloud-2"></div>
      <div class="mountain"></div>
    </div>

    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">我的角色</h1>
    </div>

    <div v-if="!character" class="loading-state">加载中...</div>

    <div v-else class="char-layout">
      <!-- 左侧：角色形象 -->
      <div class="char-portrait">
        <div class="scroll-frame">
          <div class="scroll-top"></div>
          <div class="scroll-body portrait-body">
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
              <span class="name-title">{{ character.title || '初修' }}</span>
            </div>
            <div class="portrait-skin-label">
              当前装扮：{{ currentSkinName }}
            </div>
          </div>
          <div class="scroll-bottom"></div>
        </div>
      </div>

      <!-- 右侧：编辑区 -->
      <div class="char-editor">
        <!-- 昵称修改 -->
        <div class="editor-card">
          <div class="scroll-frame">
            <div class="scroll-top"></div>
            <div class="scroll-body">
              <h3 class="card-title">道号</h3>
              <div class="nickname-row">
                <input
                  v-model="newNickname"
                  type="text"
                  class="nickname-input"
                  placeholder="输入新道号..."
                  maxlength="12"
                  @keyup.enter="saveNickname"
                />
                <button class="save-btn" @click="saveNickname" :disabled="!canSaveNickname">
                  改名 ({{ renameCost }}💰)
                </button>
              </div>
              <div class="cost-hint">改名消耗 {{ renameCost }} 积分</div>
            </div>
            <div class="scroll-bottom"></div>
          </div>
        </div>

        <!-- 性别切换 -->
        <div class="editor-card">
          <div class="scroll-frame">
            <div class="scroll-top"></div>
            <div class="scroll-body">
              <h3 class="card-title">性别</h3>
              <div class="gender-row">
                <button
                  :class="['gender-btn', { active: character.gender === 'male' }]"
                  @click="changeGender('male')"
                >♂ 男</button>
                <button
                  :class="['gender-btn', { active: character.gender === 'female' }]"
                  @click="changeGender('female')"
                >♀ 女</button>
              </div>
            </div>
            <div class="scroll-bottom"></div>
          </div>
        </div>

        <!-- 皮肤列表 -->
        <div class="editor-card">
          <div class="scroll-frame">
            <div class="scroll-top"></div>
            <div class="scroll-body">
              <h3 class="card-title">皮肤收藏</h3>
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
                    <span class="skin-theme">{{ skin.theme || '通用' }}</span>
                    <span v-if="character.current_skin_id === skin.id" class="skin-badge equipped">穿戴中</span>
                    <span v-else-if="isOwned(skin.id)" class="skin-badge owned">已拥有</span>
                    <span v-else class="skin-price">{{ getDisplayPrice(skin) }}💰</span>
                  </div>
                </div>
              </div>
              <div v-if="skins.length === 0 && !loadingSkins" class="empty-hint">暂无可用皮肤</div>
              <div v-if="loadingSkins" class="empty-hint">加载中...</div>
            </div>
            <div class="scroll-bottom"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 购买确认弹窗 -->
    <div v-if="confirmSkin" class="modal-overlay" @click="confirmSkin = null">
      <div class="modal-content" @click.stop>
        <div class="modal-title">确认购买</div>
        <div class="modal-body">
          <p>确定花费 <strong class="price-highlight">{{ getDisplayPrice(confirmSkin) }}</strong> 积分
            购买「{{ confirmSkin.name }}」？
          </p>
        </div>
        <div class="modal-actions">
          <button class="modal-cancel" @click="confirmSkin = null">取消</button>
          <button class="modal-confirm" @click="doBuySkin">确认购买</button>
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
import { useAuthStore } from '@/stores/auth'
import { v3Character } from '@/api/v3'
import { ECONOMY, priceFor } from '@/config/gameConfig'

interface Skin {
  id: string
  name: string
  theme: string
  image: string
  price: number
  base_price?: number
  category?: string
}

const gameStore = useGameStore()
const authStore = useAuthStore()

const character = computed(() => gameStore.character)
const skins = ref<Skin[]>([])
const ownedSkinIds = ref<Set<string>>(new Set())
const newNickname = ref('')
const loadingSkins = ref(false)
const confirmSkin = ref<Skin | null>(null)
const toast = ref<{ message: string; type: 'success' | 'error' } | null>(null)

const renameCost = computed(() => ECONOMY.character?.nicknameChange || 15)
const grade = computed(() => authStore.user?.grade || 6)
const genderIcon = computed(() => character.value?.gender === 'female' ? '♀' : '♂')
const currentSkin = computed(() => character.value?.currentSkin)
const currentSkinName = computed(() => character.value?.currentSkin?.name || '默认')
const portraitBg = computed(() => {
  const g = character.value?.gender === 'female' ? '#C0392B' : '#2E5C8A'
  return `radial-gradient(circle at 50% 40%, ${g}22, #E8DCC2)`
})

const canSaveNickname = computed(() => {
  return newNickname.value.trim() && newNickname.value.trim() !== character.value?.nickname
})

// 皮肤分类基础价格
const skinCategoryBase: Record<string, number> = {
  school: ECONOMY.skin.school,
  hanfu: ECONOMY.skin.hanfu,
  season: ECONOMY.skin.season,
  graduate: ECONOMY.skin.graduate
}

function getBasePrice(skin: Skin): number {
  if (skin.base_price) return skin.base_price
  const cat = skin.category || 'school'
  return skinCategoryBase[cat] || ECONOMY.skin.school
}

function getDisplayPrice(skin: Skin): number {
  return priceFor(getBasePrice(skin), grade.value)
}

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

async function handleSkinClick(skin: Skin) {
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
    // 购买确认
    const price = getDisplayPrice(skin)
    const points = authStore.user?.gamePoints || 0
    if (points < price) {
      showToast(`积分不足，需要 ${price} 积分`, 'error')
      return
    }
    confirmSkin.value = skin
  }
}

async function doBuySkin() {
  if (!confirmSkin.value) return
  try {
    await v3Character.buySkin(confirmSkin.value.id)
    ownedSkinIds.value.add(confirmSkin.value.id)
    showToast('购买成功！')
    confirmSkin.value = null
    await authStore.refreshUser()
  } catch (e: any) {
    showToast(e.message || '购买失败', 'error')
  }
}

async function loadSkins() {
  loadingSkins.value = true
  try {
    const data = await v3Character.getSkins()
    skins.value = data.skins || []
    const owned = data.owned || []
    ownedSkinIds.value = new Set(owned)
  } catch (e: any) {
    console.error('加载皮肤失败:', e)
  } finally {
    loadingSkins.value = false
  }
}

onMounted(async () => {
  await gameStore.loadConfig()
  await gameStore.loadCharacter()
  newNickname.value = character.value?.nickname || ''
  await loadSkins()
})
</script>

<style scoped>
.v3-character {
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
  margin-bottom: 16px;
  position: relative;
  z-index: 1;
}
.page-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 24px;
  letter-spacing: 0.06em;
}
.loading-state {
  text-align: center;
  padding: 60px;
  color: #8A8577;
  position: relative;
  z-index: 1;
}

/* 布局 */
.char-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 20px;
  max-width: 900px;
  margin: 0 auto;
  position: relative;
  z-index: 1;
}

/* 卷轴框架 */
.scroll-frame {
  position: relative;
  margin-bottom: 0;
}
.scroll-top, .scroll-bottom {
  height: 12px;
  background: linear-gradient(to bottom, #8B6914, #C9A227, #8B6914);
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
.scroll-body {
  background: #E8DCC2;
  border-left: 3px solid #C9A227;
  border-right: 3px solid #C9A227;
  padding: 20px;
}

/* 左侧形象 */
.char-portrait { position: relative; }
.portrait-body { text-align: center; }
.portrait-frame {
  width: 220px;
  height: 280px;
  border: 3px solid #C9A227;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  background: #F2E8D5;
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
  font-size: 72px;
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
  margin-bottom: 8px;
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
.portrait-skin-label {
  font-size: 12px;
  color: #8A8577;
}

/* 右侧编辑 */
.char-editor {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.editor-card {
  position: relative;
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

/* 昵称 */
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
  transition: border-color 0.12s;
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

/* 性别 */
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

/* 皮肤网格 */
.skin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
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
.skin-card:hover { border-color: #C9A227; transform: translateY(-2px); box-shadow: 0 3px 8px rgba(0,0,0,0.08); }
.skin-card.equipped { border-color: #C9A227; border-width: 3px; box-shadow: 0 0 0 2px rgba(201,162,39,0.2); }
.skin-card.owned { border-color: #7FA88A; }
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
.skin-theme { font-size: 10px; color: #8A8577; }
.skin-badge {
  font-size: 10px;
  font-weight: bold;
}
.skin-badge.equipped { color: #C9A227; }
.skin-badge.owned { color: #7FA88A; }
.skin-price {
  font-size: 10px;
  color: #C0392B;
  font-family: Georgia, serif;
  font-weight: bold;
}
.empty-hint {
  text-align: center;
  padding: 20px;
  color: #8A8577;
  font-size: 14px;
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
.modal-body {
  margin-bottom: 16px;
  line-height: 1.8;
  font-size: 14px;
}
.price-highlight {
  font-family: Georgia, serif;
  font-size: 18px;
  color: #C0392B;
  font-weight: bold;
}
.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}
.modal-cancel {
  padding: 8px 20px;
  background: transparent;
  border: 2px solid #8A8577;
  border-radius: 6px;
  color: #4A4A5A;
  font-size: 14px;
  cursor: pointer;
  font-family: 'KaiTi', 'STKaiti', serif;
  transition: all 0.12s;
}
.modal-cancel:hover { border-color: #4A4A5A; }
.modal-confirm {
  padding: 8px 20px;
  background: #C0392B;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  font-family: 'KaiTi', 'STKaiti', serif;
  transition: all 0.12s;
}
.modal-confirm:hover { filter: brightness(1.1); }

/* Toast */
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
  .portrait-frame { width: 180px; height: 230px; }
}
</style>
