<template>
  <div class="v3-shop">
    <!-- 水墨山水背景 -->
    <div class="bg-scene">
      <div class="cloud cloud-1"></div>
      <div class="cloud cloud-2"></div>
      <div class="mountain"></div>
    </div>

    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">集市</h1>
      <div class="points-display">
        <span class="points-label">余额</span>
        <span class="points-value">{{ myPoints }}</span>
      </div>
    </div>

    <!-- 标签切换 -->
    <div class="tab-bar">
      <button
        :class="['tab-btn', { active: activeTab === 'props' }]"
        @click="activeTab = 'props'"
      >道具</button>
      <button
        :class="['tab-btn', { active: activeTab === 'skins' }]"
        @click="activeTab = 'skins'"
      >皮肤</button>
    </div>

    <!-- 道具标签（预留） -->
    <div v-if="activeTab === 'props'" class="props-section">
      <div class="scroll-frame">
        <div class="scroll-top"></div>
        <div class="scroll-body">
          <div class="props-grid">
            <div class="prop-card" v-for="prop in propItems" :key="prop.id">
              <div class="prop-icon">{{ prop.icon }}</div>
              <div class="prop-name">{{ prop.name }}</div>
              <div class="prop-desc">{{ prop.desc }}</div>
              <button class="prop-buy-btn" @click="buyProp(prop)">
                {{ prop.price }} 积分
              </button>
            </div>
          </div>
          <div v-if="propItems.length === 0" class="empty-hint">
            道具商铺即将开放，敬请期待
          </div>
        </div>
        <div class="scroll-bottom"></div>
      </div>
    </div>

    <!-- 皮肤标签 -->
    <div v-if="activeTab === 'skins'" class="skins-section">
      <div class="scroll-frame">
        <div class="scroll-top"></div>
        <div class="scroll-body">
          <div class="skin-grid">
            <div
              v-for="skin in skins"
              :key="skin.id"
              :class="['skin-card', { owned: isOwned(skin.id), equipped: isEquipped(skin.id) }]"
            >
              <!-- 皮肤图片 -->
              <div class="skin-image-wrap">
                <img
                  :src="skin.image || '/pet-garden/pets/_placeholder.png'"
                  :alt="skin.name"
                  class="skin-image"
                  @error="(e: Event) => (e.target as HTMLImageElement).src = '/pet-garden/pets/_placeholder.png'"
                />
                <!-- 已拥有角标 -->
                <div v-if="isOwned(skin.id)" class="owned-badge">已拥有</div>
                <!-- 穿戴中角标 -->
                <div v-if="isEquipped(skin.id)" class="equipped-badge">穿戴中</div>
              </div>

              <!-- 皮肤信息 -->
              <div class="skin-info">
                <div class="skin-name">{{ skin.name }}</div>
                <div class="skin-theme">{{ skin.theme || '通用' }}</div>
                <div class="skin-price-row">
                  <span class="skin-price">{{ getDisplayPrice(skin) }}</span>
                  <span v-if="hasDiscount" class="skin-original-price">{{ skin.base_price || getBasePrice(skin) }}</span>
                  <span v-if="hasDiscount" class="discount-tag">G7优惠</span>
                </div>
              </div>

              <!-- 操作按钮 -->
              <div class="skin-action">
                <button
                  v-if="isEquipped(skin.id)"
                  class="action-btn equipped-btn"
                  disabled
                >穿戴中</button>
                <button
                  v-else-if="isOwned(skin.id)"
                  class="action-btn equip-btn"
                  @click="handleEquip(skin.id)"
                >穿戴</button>
                <button
                  v-else
                  class="action-btn buy-btn"
                  @click="handleBuy(skin)"
                >购买</button>
              </div>
            </div>
          </div>

          <div v-if="skins.length === 0 && !loading" class="empty-hint">
            暂无皮肤上架
          </div>
          <div v-if="loading" class="loading-hint">
            加载中...
          </div>
        </div>
        <div class="scroll-bottom"></div>
      </div>
    </div>

    <!-- 购买确认弹窗 -->
    <div v-if="confirmSkin" class="modal-overlay" @click="confirmSkin = null">
      <div class="modal-content" @click.stop>
        <div class="modal-title">确认购买</div>
        <div class="modal-body">
          <p>确定花费 <strong class="price-highlight">{{ getDisplayPrice(confirmSkin) }}</strong> 积分
            <span v-if="hasDiscount" class="discount-note">（G7优惠价）</span>
            购买「{{ confirmSkin.name }}」？
          </p>
          <p class="balance-note">当前余额：{{ myPoints }} 积分</p>
        </div>
        <div class="modal-actions">
          <button class="modal-cancel" @click="confirmSkin = null">取消</button>
          <button class="modal-confirm" @click="doBuySkin">确认购买</button>
        </div>
      </div>
    </div>
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

const activeTab = ref<'props' | 'skins'>('skins')
const skins = ref<Skin[]>([])
const loading = ref(false)
const confirmSkin = ref<Skin | null>(null)
const ownedSkinIds = ref<string[]>([])

// 道具列表（预留）
const propItems = ref<Array<{ id: string; name: string; icon: string; desc: string; price: number }>>([])

// 当前年级
const grade = computed(() => authStore.user?.grade || 6)

// G7 折扣
const hasDiscount = computed(() => grade.value === 7)

// 积分余额
const myPoints = computed(() => authStore.user?.gamePoints || 0)

// 当前装备皮肤 ID
const equippedSkinId = computed(() => gameStore.character?.current_skin_id || '')

// 皮肤分类基础价格映射
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
  const base = getBasePrice(skin)
  return priceFor(base, grade.value)
}

function isOwned(skinId: string): boolean {
  return ownedSkinIds.value.includes(skinId)
}

function isEquipped(skinId: string): boolean {
  return equippedSkinId.value === skinId
}

async function loadSkins() {
  loading.value = true
  try {
    const data = await v3Character.getSkins()
    skins.value = data.skins || []
    ownedSkinIds.value = data.owned || []
  } catch (e: any) {
    alert('加载皮肤列表失败：' + (e.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

async function handleBuy(skin: Skin) {
  const price = getDisplayPrice(skin)
  if (myPoints.value < price) {
    alert(`积分不足，需要 ${price} 积分，当前余额 ${myPoints.value} 积分`)
    return
  }
  confirmSkin.value = skin
}

async function doBuySkin() {
  if (!confirmSkin.value) return
  try {
    await v3Character.buySkin(confirmSkin.value.id)
    ownedSkinIds.value.push(confirmSkin.value.id)
    alert(`成功购买「${confirmSkin.value.name}」`)
    confirmSkin.value = null
    // 刷新用户积分
    await authStore.refreshUser()
  } catch (e: any) {
    alert('购买失败：' + (e.message || '未知错误'))
  }
}

async function handleEquip(skinId: string) {
  try {
    await v3Character.equipSkin(skinId)
    await gameStore.loadCharacter()
    alert('穿戴成功')
  } catch (e: any) {
    alert('穿戴失败：' + (e.message || '未知错误'))
  }
}

function buyProp(prop: { id: string; name: string; price: number }) {
  if (myPoints.value < prop.price) {
    alert(`积分不足，需要 ${prop.price} 积分`)
    return
  }
  alert(`「${prop.name}」道具功能即将开放`)
}

onMounted(async () => {
  await gameStore.loadConfig()
  await gameStore.loadCharacter()
  await loadSkins()
})
</script>

<style scoped>
.v3-shop {
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  position: relative;
  z-index: 1;
}
.page-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 24px;
  letter-spacing: 0.06em;
}
.points-display {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #E8DCC2;
  border: 2px solid #C9A227;
  border-radius: 8px;
  padding: 6px 14px;
}
.points-label {
  font-size: 13px;
  color: #8A8577;
}
.points-value {
  font-family: Georgia, serif;
  font-size: 18px;
  font-weight: bold;
  color: #C9A227;
}

/* 标签栏 */
.tab-bar {
  display: flex;
  gap: 0;
  margin-bottom: 16px;
  position: relative;
  z-index: 1;
}
.tab-btn {
  flex: 1;
  padding: 10px 0;
  border: 2px solid #C9A227;
  background: #E8DCC2;
  color: #4A4A5A;
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 15px;
  font-weight: bold;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: all 0.12s;
}
.tab-btn:first-child {
  border-radius: 8px 0 0 8px;
  border-right: 1px solid #C9A227;
}
.tab-btn:last-child {
  border-radius: 0 8px 8px 0;
  border-left: 1px solid #C9A227;
}
.tab-btn.active {
  background: #C9A227;
  color: white;
  border-color: #C9A227;
}
.tab-btn:hover:not(.active) {
  background: rgba(201,162,39,0.15);
}

/* 卷轴框架 */
.scroll-frame {
  position: relative;
  margin-bottom: 20px;
}
.scroll-top, .scroll-bottom {
  height: 14px;
  background: linear-gradient(to bottom, #8B6914, #C9A227, #8B6914);
  border-radius: 7px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}
.scroll-body {
  background: #E8DCC2;
  border-left: 3px solid #C9A227;
  border-right: 3px solid #C9A227;
  padding: 20px;
  min-height: 200px;
}

/* 道具网格 */
.props-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 14px;
}
.prop-card {
  background: #F2E8D5;
  border: 2px solid rgba(201,162,39,0.4);
  border-radius: 8px;
  padding: 16px 12px;
  text-align: center;
}
.prop-icon { font-size: 32px; margin-bottom: 8px; }
.prop-name {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 15px;
  font-weight: bold;
  margin-bottom: 4px;
}
.prop-desc {
  font-size: 12px;
  color: #4A4A5A;
  margin-bottom: 10px;
  line-height: 1.5;
}
.prop-buy-btn {
  padding: 6px 16px;
  background: #C9A227;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-family: 'KaiTi', 'STKaiti', serif;
  cursor: pointer;
  transition: all 0.12s;
}
.prop-buy-btn:hover { filter: brightness(1.1); }
.prop-buy-btn:active { transform: scale(0.97); }

/* 皮肤网格 */
.skin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}
.skin-card {
  background: #F2E8D5;
  border: 2px solid rgba(201,162,39,0.4);
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.12s;
  position: relative;
}
.skin-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  border-color: #C9A227;
}
.skin-card.owned {
  border-color: #7FA88A;
}
.skin-card.equipped {
  border-color: #C9A227;
  border-width: 3px;
  box-shadow: 0 0 0 2px rgba(201,162,39,0.3);
}

/* 皮肤图片 */
.skin-image-wrap {
  height: 160px;
  background: radial-gradient(circle at 50% 60%, rgba(201,162,39,0.08), rgba(242,232,213,0.5));
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}
.skin-image {
  max-height: 140px;
  max-width: 140px;
  object-fit: contain;
}
.owned-badge, .equipped-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 10px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
  color: white;
}
.owned-badge {
  background: #7FA88A;
}
.equipped-badge {
  background: #C9A227;
}

/* 皮肤信息 */
.skin-info {
  padding: 10px 12px 6px;
}
.skin-name {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 2px;
}
.skin-theme {
  font-size: 12px;
  color: #8A8577;
  margin-bottom: 6px;
}
.skin-price-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.skin-price {
  font-family: Georgia, serif;
  font-size: 16px;
  font-weight: bold;
  color: #C9A227;
}
.skin-original-price {
  font-family: Georgia, serif;
  font-size: 12px;
  color: #8A8577;
  text-decoration: line-through;
}
.discount-tag {
  padding: 1px 6px;
  background: #C0392B;
  color: white;
  border-radius: 3px;
  font-size: 10px;
  font-weight: bold;
}

/* 操作按钮 */
.skin-action {
  padding: 0 12px 12px;
}
.action-btn {
  display: block;
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: bold;
  font-family: 'KaiTi', 'STKaiti', serif;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: all 0.12s;
}
.action-btn:hover { filter: brightness(1.1); }
.action-btn:active { transform: scale(0.97); }
.action-btn:disabled {
  cursor: default;
  filter: none;
}
.buy-btn {
  background: #C0392B;
  color: white;
}
.equip-btn {
  background: #2E5C8A;
  color: white;
}
.equipped-btn {
  background: rgba(28,28,36,0.08);
  color: #8A8577;
}

/* 空状态 */
.empty-hint, .loading-hint {
  text-align: center;
  padding: 40px 20px;
  font-size: 14px;
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
.discount-note {
  font-size: 12px;
  color: #8A8577;
}
.balance-note {
  font-size: 12px;
  color: #8A8577;
  margin-top: 4px;
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

@media (max-width: 640px) {
  .skin-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
  .skin-image-wrap { height: 120px; }
  .skin-image { max-height: 100px; }
}
</style>
