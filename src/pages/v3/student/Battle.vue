<template>
  <div class="v3-battle">
    <!-- 水墨山水背景 -->
    <div class="bg-scene">
      <div class="cloud cloud-1"></div>
      <div class="cloud cloud-2"></div>
      <div class="mountain"></div>
      <!-- 战斗擂台背景 -->
      <div class="arena-bg"></div>
    </div>

    <!-- 页面标题 -->
    <div class="page-header">
      <h1 class="page-title">斗法</h1>
      <div class="battle-info-badge">
        <span class="battle-free">今日免费 {{ freeBattles }}/{{ maxFreeBattles }}</span>
      </div>
    </div>

    <!-- 模式选择 -->
    <div class="mode-section">
      <div class="scroll-frame">
        <div class="scroll-top"></div>
        <div class="scroll-body">
          <div class="mode-grid">
            <div
              :class="['mode-card', { active: selectedMode === 'pve' }]"
              @click="selectedMode = 'pve'"
            >
              <div class="mode-icon">🏔️</div>
              <div class="mode-name">副本</div>
              <div class="mode-desc">挑战妖塔关卡<br/>获取修行资源</div>
              <div class="mode-tag">PVE</div>
            </div>
            <div
              :class="['mode-card', { active: selectedMode === 'pvp' }]"
              @click="selectedMode = 'pvp'"
            >
              <div class="mode-icon">⚔️</div>
              <div class="mode-name">切磋</div>
              <div class="mode-desc">与其他修行者<br/>一决高下</div>
              <div class="mode-tag">PVP</div>
            </div>
          </div>
        </div>
        <div class="scroll-bottom"></div>
      </div>
    </div>

    <!-- 队伍选择 -->
    <div class="team-section">
      <div class="section-header">
        <h2 class="section-title">出战队伍</h2>
        <span class="team-count">{{ team.length }}/4</span>
      </div>

      <!-- 已选队伍槽位 -->
      <div class="team-slots">
        <div v-for="i in 4" :key="i" :class="['team-slot', { filled: team[i-1] }]">
          <template v-if="team[i-1]">
            <div class="slot-pet" :style="{ borderColor: getPetColor(team[i-1]) }">
              <span class="slot-name">{{ getPetName(team[i-1]) }}</span>
              <span class="slot-power">⚡{{ getPetPower(team[i-1]) }}</span>
              <button class="slot-remove" @click="removeFromTeam(i-1)">×</button>
            </div>
          </template>
          <template v-else>
            <div class="slot-empty">
              <span class="slot-empty-icon">+</span>
              <span class="slot-empty-text">空位</span>
            </div>
          </template>
        </div>
      </div>

      <!-- 宠物选择池 -->
      <div class="pet-pool">
        <h3 class="pool-title">点击宠物加入队伍</h3>
        <div class="pool-grid">
          <button
            v-for="pet in availablePets"
            :key="pet.id"
            :class="['pool-pet', { selected: team.some(p => p.id === pet.id) }]"
            :style="{ borderColor: getPetColor(pet) }"
            :disabled="team.length >= 4 && !team.some(p => p.id === pet.id)"
            @click="toggleTeamSelect(pet.id)"
          >
            <span class="pool-name">{{ pet.template_name }}</span>
            <span class="pool-tier">{{ pet.tier_name }}</span>
            <span class="pool-power">⚡{{ pet.power }}</span>
            <div v-if="team.some(p => p.id === pet.id)" class="pool-check">✓</div>
          </button>
        </div>
        <div v-if="availablePets.length === 0" class="pool-empty">
          暂无宠物，先去求签获取吧
        </div>
      </div>
    </div>

    <!-- 开始战斗按钮 -->
    <div class="action-area">
      <button
        :class="['start-btn', { disabled: !canStartBattle }]"
        :disabled="!canStartBattle"
        @click="startBattle"
      >
        {{ battleButtonText }}
      </button>
      <div class="total-power">
        队伍总战力：<strong>{{ teamTotalPower }}</strong>
      </div>
    </div>

    <!-- 战斗日志区域 -->
    <div class="log-section">
      <div class="scroll-frame">
        <div class="scroll-top"></div>
        <div class="scroll-body">
          <div class="log-header">
            <h2 class="section-title">战斗记录</h2>
          </div>
          <div class="log-content">
            <div v-if="battleLog.length === 0" class="log-placeholder">
              <div class="log-icon">⏳</div>
              <div class="log-text">战斗引擎加载中...</div>
              <div class="log-sub">等待KIMI完成</div>
            </div>
            <div v-else class="log-list">
              <div v-for="(log, i) in battleLog" :key="i" class="log-entry">
                <span class="log-turn">第{{ log.turn }}回合</span>
                <span class="log-text">{{ log.text }}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="scroll-bottom"></div>
      </div>
    </div>

    <!-- 班级对战信息 -->
    <div class="class-battle-section">
      <div class="scroll-frame">
        <div class="scroll-top"></div>
        <div class="scroll-body">
          <h2 class="section-title">班级战况</h2>
          <div class="class-info">
            <div class="class-stat">
              <span class="stat-label">班级排名</span>
              <span class="stat-value">--</span>
            </div>
            <div class="class-stat">
              <span class="stat-label">本周胜场</span>
              <span class="stat-value">0</span>
            </div>
            <div class="class-stat">
              <span class="stat-label">胜率</span>
              <span class="stat-value">--%</span>
            </div>
          </div>
          <div class="class-hint">班级对战功能即将开放</div>
        </div>
        <div class="scroll-bottom"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGameStore, type V3PlayerPet } from '@/stores/game'
import { getTrigram, ECONOMY } from '@/config/gameConfig'

const gameStore = useGameStore()

const selectedMode = ref<'pve' | 'pvp'>('pve')
const team = ref<V3PlayerPet[]>([])
const battleLog = ref<any[]>([])
const freeBattles = ref(0)
const maxFreeBattles = ECONOMY.misc.battleFreePerDay

const availablePets = computed(() => gameStore.myPets)

const teamTotalPower = computed(() => {
  return team.value.reduce((sum, p) => sum + (p.power || 0), 0)
})

const canStartBattle = computed(() => team.value.length > 0)

const battleButtonText = computed(() => {
  if (team.value.length === 0) return '请先选择出战宠物'
  if (selectedMode.value === 'pve') return '进入副本'
  return '开始切磋'
})

function getPetName(pet: V3PlayerPet) { return pet.template_name || '未知' }
function getPetPower(pet: V3PlayerPet) { return pet.power || 0 }
function getPetColor(pet: V3PlayerPet) {
  return getTrigram(pet.element)?.color || '#8A8577'
}

function toggleTeamSelect(petId: string) {
  const pet = availablePets.value.find(p => p.id === petId)
  if (!pet) return

  const idx = team.value.findIndex(p => p.id === petId)
  if (idx >= 0) {
    team.value.splice(idx, 1)
  } else if (team.value.length < 4) {
    team.value.push(pet)
  } else {
    alert('队伍已满，最多4只宠物')
  }
}

function removeFromTeam(index: number) {
  team.value.splice(index, 1)
}

function startBattle() {
  if (!canStartBattle.value) return
  if (freeBattles.value >= maxFreeBattles) {
    const cost = ECONOMY.misc.battleRefill
    if (!confirm(`今日免费次数已用完，是否花费 ${cost} 积分继续？`)) return
  }
  // 战斗引擎尚未实现
  battleLog.value = [
    { turn: 1, text: `你的${team.value.length}只宠物进入了${selectedMode.value === 'pve' ? '副本' : '切磋场'}...` },
    { turn: 2, text: '战斗系统正在对接中，敬请期待！' }
  ]
}

onMounted(async () => {
  await gameStore.loadConfig()
  await gameStore.loadMyPets()
})
</script>

<style scoped>
.v3-battle {
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
.arena-bg {
  position: absolute;
  bottom: 10%;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  height: 200px;
  background: radial-gradient(ellipse at 50% 100%, rgba(46,92,138,0.08) 0%, transparent 70%);
  border-radius: 50%;
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
.battle-info-badge {
  background: #E8DCC2;
  border: 2px solid #C9A227;
  border-radius: 8px;
  padding: 6px 14px;
}
.battle-free {
  font-size: 13px;
  color: #4A4A5A;
  font-family: Georgia, serif;
}

/* 卷轴框架 */
.scroll-frame {
  position: relative;
  margin-bottom: 16px;
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
}

/* 模式选择 */
.mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.mode-card {
  background: #F2E8D5;
  border: 2px solid rgba(201,162,39,0.4);
  border-radius: 10px;
  padding: 20px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.12s;
  position: relative;
}
.mode-card:hover {
  border-color: #C9A227;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
.mode-card.active {
  border-color: #C0392B;
  border-width: 3px;
  box-shadow: 0 0 0 2px rgba(192,57,43,0.2);
}
.mode-icon { font-size: 36px; margin-bottom: 8px; }
.mode-name {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 6px;
}
.mode-desc {
  font-size: 12px;
  color: #4A4A5A;
  line-height: 1.6;
}
.mode-tag {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 8px;
  background: rgba(28,28,36,0.08);
  border-radius: 4px;
  font-size: 10px;
  color: #8A8577;
  font-weight: bold;
}

/* 队伍区域 */
.team-section {
  position: relative;
  z-index: 1;
  margin-bottom: 16px;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.section-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 16px;
  font-weight: bold;
  letter-spacing: 0.06em;
}
.team-count {
  font-family: Georgia, serif;
  font-size: 14px;
  color: #C9A227;
  font-weight: bold;
}

/* 队伍槽位 */
.team-slots {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}
.team-slot {
  aspect-ratio: 1;
  border: 2px dashed #C9A227;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(232,220,194,0.5);
  transition: all 0.12s;
}
.team-slot.filled { border-style: solid; }
.slot-empty {
  text-align: center;
  color: #8A8577;
}
.slot-empty-icon {
  display: block;
  font-size: 24px;
  margin-bottom: 2px;
}
.slot-empty-text {
  font-size: 11px;
}
.slot-pet {
  padding: 10px;
  text-align: center;
  border: 2px solid;
  border-radius: 8px;
  background: #E8DCC2;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  position: relative;
}
.slot-name {
  font-weight: bold;
  font-size: 14px;
}
.slot-power {
  font-family: Georgia, serif;
  font-size: 12px;
  color: #C9A227;
}
.slot-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border: none;
  background: #C0392B;
  color: white;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition: all 0.12s;
}
.slot-remove:hover { filter: brightness(1.1); }

/* 宠物选择池 */
.pet-pool {
  background: #E8DCC2;
  border: 2px solid #C9A227;
  border-radius: 10px;
  padding: 16px;
}
.pool-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 15px;
  margin-bottom: 10px;
  color: #4A4A5A;
}
.pool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}
.pool-pet {
  padding: 8px;
  border: 2px solid;
  border-radius: 6px;
  background: #F2E8D5;
  cursor: pointer;
  text-align: center;
  transition: all 0.12s;
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: relative;
}
.pool-pet:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.pool-pet:disabled { opacity: 0.4; cursor: not-allowed; }
.pool-pet.selected { border-width: 3px; box-shadow: 0 0 0 2px rgba(201,162,39,0.3); }
.pool-name { font-size: 13px; font-weight: bold; }
.pool-tier { font-size: 11px; color: #8A8577; }
.pool-power { font-size: 11px; color: #C9A227; font-family: Georgia, serif; }
.pool-check {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  background: #C9A227;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: bold;
}
.pool-empty {
  text-align: center;
  padding: 20px;
  color: #8A8577;
}

/* 开始战斗区域 */
.action-area {
  text-align: center;
  margin-bottom: 24px;
  position: relative;
  z-index: 1;
}
.start-btn {
  padding: 14px 48px;
  background: #C0392B;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 18px;
  font-family: 'KaiTi', 'STKaiti', serif;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.12s;
  box-shadow: 0 4px 0 #8B1A10, 0 6px 12px rgba(192,57,43,0.3);
}
.start-btn:hover:not(.disabled) {
  transform: translateY(-1px);
  box-shadow: 0 5px 0 #8B1A10, 0 8px 16px rgba(192,57,43,0.4);
}
.start-btn:active:not(.disabled) {
  transform: translateY(2px);
  box-shadow: 0 2px 0 #8B1A10, 0 3px 8px rgba(192,57,43,0.3);
}
.start-btn.disabled {
  background: #8A8577;
  box-shadow: 0 4px 0 #5A5550, 0 6px 12px rgba(0,0,0,0.15);
  cursor: not-allowed;
}
.total-power {
  margin-top: 10px;
  font-size: 14px;
  color: #4A4A5A;
}
.total-power strong {
  font-family: Georgia, serif;
  color: #C9A227;
  font-size: 18px;
}

/* 战斗日志 */
.log-section {
  position: relative;
  z-index: 1;
}
.log-header { margin-bottom: 10px; }
.log-content { min-height: 120px; }
.log-placeholder {
  text-align: center;
  padding: 30px 20px;
}
.log-icon {
  font-size: 36px;
  margin-bottom: 10px;
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
.log-text {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 16px;
  font-weight: bold;
  color: #4A4A5A;
  margin-bottom: 4px;
}
.log-sub {
  font-size: 12px;
  color: #8A8577;
}
.log-list { display: flex; flex-direction: column; gap: 6px; }
.log-entry {
  display: flex;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(28,28,36,0.06);
  font-size: 14px;
}
.log-turn {
  color: #C9A227;
  font-weight: bold;
  flex-shrink: 0;
  font-family: Georgia, serif;
}

/* 班级对战 */
.class-battle-section {
  position: relative;
  z-index: 1;
  margin-top: 16px;
}
.class-info {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}
.class-stat {
  text-align: center;
  padding: 10px;
  background: #F2E8D5;
  border-radius: 8px;
  border: 1px solid rgba(201,162,39,0.3);
}
.stat-label {
  display: block;
  font-size: 12px;
  color: #8A8577;
  margin-bottom: 4px;
}
.stat-value {
  display: block;
  font-family: Georgia, serif;
  font-size: 20px;
  font-weight: bold;
  color: #C9A227;
}
.class-hint {
  text-align: center;
  font-size: 12px;
  color: #8A8577;
  padding: 8px;
}

@media (max-width: 640px) {
  .team-slots {
    grid-template-columns: repeat(2, 1fr);
  }
  .mode-grid {
    grid-template-columns: 1fr;
  }
  .pool-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
