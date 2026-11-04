<template>
  <div class="admin-skins">
    <!-- 水墨山水背景 -->
    <div class="bg-scene">
      <div class="cloud cloud-1"></div>
      <div class="cloud cloud-2"></div>
      <div class="mountain"></div>
    </div>

    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">角色皮肤管理</h1>
      <button class="btn btn-primary" @click="showCreate = true">+ 新增皮肤</button>
    </div>

    <!-- 加载 / 错误 / 空态 -->
    <div v-if="loading" class="state-box">
      <div class="ink-spinner"></div>
      <span>载入皮肤列表…</span>
    </div>
    <div v-else-if="error" class="state-box error">
      <span>⚠ {{ error }}</span>
      <button class="retry-btn" @click="loadData">重试</button>
    </div>
    <div v-else-if="skins.length === 0" class="state-box">
      <span class="empty-icon">👘</span>
      <span>暂无皮肤数据</span>
    </div>

    <!-- 皮肤列表（卷轴风格） -->
    <div v-else class="scroll-frame">
      <div class="scroll-top"></div>
      <div class="scroll-body">
        <div class="skin-list">
          <div
            v-for="skin in skins"
            :key="skin.id"
            class="skin-row"
          >
            <!-- 皮肤缩略图 -->
            <div class="skin-thumb">
              <div class="thumb-placeholder">
                <span>👘</span>
              </div>
            </div>

            <!-- 信息区 -->
            <div class="skin-info">
              <div class="skin-name-row">
                <span class="skin-name">{{ skin.name }}</span>
                <span class="skin-theme">{{ skin.theme || '—' }}</span>
              </div>
              <div class="skin-meta-row">
                <span class="gender-tag" :class="skin.gender">
                  {{ skin.gender === 'male' ? '男' : skin.gender === 'female' ? '女' : '通用' }}
                </span>
                <span class="price-tag">💰 {{ skin.price ?? '—' }}</span>
                <span v-if="skin.unlock_condition" class="unlock-tag">
                  🔒 {{ skin.unlock_condition }}
                </span>
              </div>
            </div>

            <!-- 状态开关 -->
            <div class="skin-actions">
              <button
                :class="['status-toggle', { active: skin.active }]"
                @click="toggleActive(skin)"
              >
                {{ skin.active ? '已上架' : '已下架' }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="scroll-bottom"></div>
    </div>

    <!-- 新增皮肤弹窗 -->
    <Teleport to="body">
      <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
        <div class="modal-scroll">
          <div class="scroll-top"></div>
          <div class="scroll-body">
            <div class="modal-header">
              <h2 class="modal-title">新增皮肤</h2>
              <button class="modal-close" @click="showCreate = false">✕</button>
            </div>

            <div class="form-grid">
              <div class="form-group">
                <label class="form-label">名称</label>
                <input v-model="createForm.name" class="form-input" placeholder="皮肤名称" />
              </div>
              <div class="form-group">
                <label class="form-label">主题</label>
                <input v-model="createForm.theme" class="form-input" placeholder="如：书院/仙侠/节日" />
              </div>
              <div class="form-group">
                <label class="form-label">性别</label>
                <select v-model="createForm.gender" class="form-input">
                  <option value="unisex">通用</option>
                  <option value="male">男</option>
                  <option value="female">女</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">价格</label>
                <input v-model.number="createForm.price" type="number" class="form-input" placeholder="0" />
              </div>
              <div class="form-group full-width">
                <label class="form-label">图片 URL</label>
                <input v-model="createForm.image" class="form-input" placeholder="https://..." />
              </div>
              <div class="form-group">
                <label class="form-label">解锁条件</label>
                <select v-model="createForm.unlockType" class="form-input">
                  <option value="none">无</option>
                  <option value="level">等级</option>
                  <option value="achievement">成就</option>
                  <option value="purchase">购买</option>
                </select>
              </div>
              <div class="form-group" v-if="createForm.unlockType !== 'none'">
                <label class="form-label">解锁值</label>
                <input v-model="createForm.unlockValue" class="form-input" placeholder="如：Lv.5" />
              </div>
            </div>

            <div class="modal-actions">
              <button class="btn btn-ghost" @click="showCreate = false">取消</button>
              <button class="btn btn-primary" :disabled="creating" @click="createSkin">
                {{ creating ? '创建中…' : '确认创建' }}
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
import { ref, onMounted } from 'vue'
import { v3Character } from '@/api/v3'

// ========== 类型 ==========
interface Skin {
  id: string
  name: string
  theme?: string
  gender?: string
  price?: number
  image?: string
  unlock_condition?: string
  active: boolean
}

// ========== 状态 ==========
const loading = ref(false)
const error = ref('')
const skins = ref<Skin[]>([])
const showCreate = ref(false)
const creating = ref(false)

const createForm = ref({
  name: '',
  theme: '',
  gender: 'unisex',
  price: 0,
  image: '',
  unlockType: 'none',
  unlockValue: '',
})

// ========== 数据加载 ==========
async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const data = await v3Character.getSkins()
    skins.value = (data.skins || data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      theme: s.theme || s.category || '',
      gender: s.gender || 'unisex',
      price: s.price ?? s.cost ?? 0,
      image: s.image || s.image_url || '',
      unlock_condition: s.unlock_condition || s.unlockCondition || '',
      active: s.active !== false && s.enabled !== 0,
    }))
  } catch (e: any) {
    error.value = e.message || '加载皮肤列表失败'
  } finally {
    loading.value = false
  }
}

// ========== 上架/下架 ==========
async function toggleActive(skin: Skin) {
  const prev = skin.active
  skin.active = !prev
  try {
    // TODO: 调用后端 API 持久化状态变更
    // await v3Admin.updateSkinStatus(skin.id, skin.active)
  } catch (e: any) {
    skin.active = prev // 回滚
    error.value = e.message || '状态更新失败'
  }
}

// ========== 新增皮肤 ==========
async function createSkin() {
  if (!createForm.value.name.trim()) {
    error.value = '请填写皮肤名称'
    return
  }
  creating.value = true
  error.value = ''
  try {
    // TODO: 调用后端 API 创建皮肤
    // const data = await v3Admin.createSkin(createForm.value)
    // 暂时本地添加
    const newSkin: Skin = {
      id: 'skin_' + Date.now(),
      name: createForm.value.name,
      theme: createForm.value.theme,
      gender: createForm.value.gender,
      price: createForm.value.price,
      image: createForm.value.image,
      unlock_condition: createForm.value.unlockType !== 'none'
        ? `${createForm.value.unlockType}:${createForm.value.unlockValue}`
        : '',
      active: true,
    }
    skins.value.unshift(newSkin)
    showCreate.value = false
    // 重置表单
    createForm.value = {
      name: '', theme: '', gender: 'unisex', price: 0,
      image: '', unlockType: 'none', unlockValue: '',
    }
  } catch (e: any) {
    error.value = e.message || '创建失败'
  } finally {
    creating.value = false
  }
}

// ========== 生命周期 ==========
onMounted(() => {
  loadData()
})
</script>

<style scoped>
.admin-skins {
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
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}
.page-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 26px;
  font-weight: bold;
  letter-spacing: 0.08em;
  color: #1C1C24;
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

/* 卷轴框架 */
.scroll-frame {
  position: relative;
  z-index: 1;
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
  padding: 16px 20px;
}

/* 皮肤列表 */
.skin-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.skin-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(201,162,39,0.2);
  transition: background 0.12s;
}
.skin-row:last-child { border-bottom: none; }
.skin-row:hover { background: rgba(201,162,39,0.06); }

/* 缩略图 */
.skin-thumb {
  width: 56px; height: 56px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid rgba(201,162,39,0.3);
}
.thumb-placeholder {
  width: 100%; height: 100%;
  background: linear-gradient(135deg, #F2E8D5, #E8DCC2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

/* 信息区 */
.skin-info { flex: 1; min-width: 0; }
.skin-name-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}
.skin-name {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 16px;
  font-weight: bold;
  letter-spacing: 0.04em;
}
.skin-theme {
  font-size: 12px;
  color: #8A8577;
  padding: 1px 6px;
  border: 1px solid rgba(138,133,119,0.3);
  border-radius: 3px;
}
.skin-meta-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.gender-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: bold;
}
.gender-tag.male { background: rgba(46,92,138,0.15); color: #2E5C8A; }
.gender-tag.female { background: rgba(192,57,43,0.12); color: #C0392B; }
.gender-tag.unisex { background: rgba(127,168,138,0.15); color: #5A8A64; }
.price-tag {
  font-size: 12px;
  color: #C9A227;
  font-family: Georgia, serif;
  font-weight: bold;
}
.unlock-tag {
  font-size: 11px;
  color: #4A4A5A;
}

/* 状态开关 */
.skin-actions { flex-shrink: 0; }
.status-toggle {
  padding: 4px 14px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.15s;
  border: 2px solid;
}
.status-toggle.active {
  background: rgba(127,168,138,0.2);
  border-color: #7FA88A;
  color: #5A8A64;
}
.status-toggle:not(.active) {
  background: rgba(138,133,119,0.1);
  border-color: #8A8577;
  color: #8A8577;
}
.status-toggle:hover {
  opacity: 0.8;
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
  .skin-row { flex-wrap: wrap; }
  .skin-actions { width: 100%; text-align: right; padding-top: 8px; }
  .form-grid { grid-template-columns: 1fr; }
  .form-group.full-width { grid-column: 1; }
}
</style>
