<template>
  <div class="v3-battle">
    <h1 class="page-title">斗法</h1>

    <!-- 模式选择 -->
    <div class="mode-tabs">
      <button :class="['mode-btn', { active: mode === 'pve' }]" @click="mode = 'pve'">
        <span>⚔️</span> 副本挑战
      </button>
      <button :class="['mode-btn', { active: mode === 'pvp' }]" @click="mode = 'pvp'">
        <span>🤝</span> 切磋对战
      </button>
      <button :class="['mode-btn', { active: mode === 'class' }]" @click="mode = 'class'">
        <span>🏰</span> 班级战
      </button>
    </div>

    <!-- 队伍选择 -->
    <div class="team-section">
      <h2 class="section-title">出战队伍 <span class="team-count">({{ team.length }}/4)</span></h2>

      <div class="team-slots">
        <div v-for="i in 4" :key="i" class="team-slot" :class="{ filled: team[i-1] }">
          <template v-if="team[i-1]">
            <div class="slot-pet" :style="{ borderColor: getPetColor(team[i-1]) }">
              <span class="slot-name">{{ getPetName(team[i-1]) }}</span>
              <span class="slot-power">⚡{{ getPetPower(team[i-1]) }}</span>
              <button class="slot-remove" @click="removeFromTeam(i-1)">×</button>
            </div>
          </template>
          <template v-else>
            <div class="slot-empty">空位 {{ i }}</div>
          </template>
        </div>
      </div>

      <!-- 可选宠物 -->
      <div class="pet-pool">
        <h3 class="pool-title">可用宠物</h3>
        <div class="pool-grid">
          <button
            v-for="pet in availablePets"
            :key="pet.id"
            :class="['pool-pet', { disabled: team.includes(pet.id) }]"
            :style="{ borderColor: getPetColor(pet) }"
            :disabled="team.length >= 4 || team.includes(pet.id)"
            @click="addToTeam(pet.id)"
          >
            <span class="pool-name">{{ pet.template_name }}</span>
            <span class="pool-tier">{{ pet.tier_name }}</span>
            <span class="pool-power">⚡{{ pet.power }}</span>
          </button>
        </div>
        <div v-if="availablePets.length === 0" class="pool-empty">
          暂无宠物，先去求签获取吧
        </div>
      </div>
    </div>

    <!-- 开始按钮 -->
    <div class="action-area">
      <button
        class="start-btn"
        :disabled="team.length === 0 || battleLoading"
        @click="startBattle"
      >
        {{ battleLoading ? '匹配中...' : '开始斗法' }}
      </button>
      <div class="total-power">
        队伍总战力：<strong>{{ teamTotalPower }}</strong>
      </div>
    </div>

    <!-- 战斗日志区 -->
    <div class="battle-log-section">
      <h2 class="section-title">战斗记录</h2>
      <div class="log-frame">
        <div class="scroll-top"></div>
        <div class="scroll-body">
          <div v-if="battleLog.length === 0" class="log-empty">
            <div class="log-icon">📜</div>
            <div>战斗引擎加载中...</div>
            <div class="log-hint">等待 KIMI 完成战斗系统对接</div>
          </div>
          <div v-else class="log-list">
            <div v-for="(log, i) in battleLog" :key="i" class="log-entry">
              <span class="log-turn">第{{ log.turn }}回合</span>
              <span class="log-text">{{ log.text }}</span>
            </div>
          </div>
        </div>
        <div class="scroll-bottom"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGameStore, type V3PlayerPet } from '@/stores/game'
import { getTier, getTrigram } from '@/config/gameConfig'

const gameStore = useGameStore()

const mode = ref<'pve' | 'pvp' | 'class'>('pve')
const team = ref<string[]>([])
const battleLog = ref<any[]>([])
const battleLoading = ref(false)

const availablePets = computed(() => gameStore.myPets)

const teamTotalPower = computed(() => {
  return gameStore.myPets
    .filter(p => team.value.includes(p.id))
    .reduce((sum, p) => sum + (p.power || 0), 0)
})

function getPetName(pet: V3PlayerPet) { return pet.template_name || '未知' }
function getPetPower(pet: V3PlayerPet) { return pet.power || 0 }
function getPetColor(pet: V3PlayerPet) {
  return getTrigram(pet.element)?.color || '#8A8577'
}

function addToTeam(petId: string) {
  if (team.value.length < 4 && !team.value.includes(petId)) {
    team.value.push(petId)
  }
}

function removeFromTeam(index: number) {
  team.value.splice(index, 1)
}

async function startBattle() {
  if (team.value.length === 0) return
  battleLoading.value = true

  // 模拟战斗（等待 KIMI 战斗引擎）
  setTimeout(() => {
    battleLoading.value = false
    battleLog.value = [
      { turn: 1, text: `你的${team.value.length}只宠物进入了${mode.value === 'pve' ? '副本' : '切磋场'}...` },
      { turn: 2, text: '战斗系统正在对接中，敬请期待！' }
    ]
  }, 1500)
}

onMounted(async () => {
  await gameStore.loadConfig()
  await gameStore.loadMyPets()
})
</script>

<style scoped>
.v3-battle {
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
  margin-bottom: 20px;
  color: #C0392B;
  letter-spacing: 0.1em;
}

.mode-tabs {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin-bottom: 24px;
}
.mode-btn {
  padding: 10px 24px;
  border: 2px solid #C9A227;
  border-radius: 8px;
  background: transparent;
  color: #4A4A5A;
  font-size: 15px;
  font-family: 'KaiTi', 'STKaiti', serif;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
}
.mode-btn:hover { background: rgba(201,162,39,0.1); }
.mode-btn.active {
  background: #C0392B;
  color: white;
  border-color: #801F15;
}

.section-title {
  font-family: 'KaiTi', 'STKaiti', serif;
  font-size: 18px;
  margin-bottom: 12px;
  letter-spacing: 0.06em;
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.team-count {
  font-size: 14px;
  color: #8A8577;
  font-family: Georgia, serif;
}

.team-section { margin-bottom: 24px; }
.team-slots {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}
.team-slot {
  aspect-ratio: 1;
  border: 2px dashed #C9A227;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(232,220,194,0.5);
}
.team-slot.filled { border-style: solid; }
.slot-empty {
  color: #8A8577;
  font-size: 14px;
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
}

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
}
.pool-pet:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.pool-pet:disabled { opacity: 0.4; cursor: not-allowed; }
.pool-name { font-size: 13px; font-weight: bold; }
.pool-tier { font-size: 11px; color: #8A8577; }
.pool-power { font-size: 11px; color: #C9A227; font-family: Georgia, serif; }
.pool-empty {
  text-align: center;
  padding: 20px;
  color: #8A8577;
}

.action-area {
  text-align: center;
  margin-bottom: 24px;
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
.start-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 5px 0 #8B1A10, 0 8px 16px rgba(192,57,43,0.4);
}
.start-btn:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: 0 2px 0 #8B1A10, 0 3px 8px rgba(192,57,43,0.3);
}
.start-btn:disabled { opacity: 0.5; cursor: not-allowed; }
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

.log-frame { margin-top: 8px; }
.scroll-top, .scroll-bottom {
  height: 10px;
  background: linear-gradient(to bottom, #8B6914, #C9A227, #8B6914);
  border-radius: 5px;
}
.scroll-body {
  background: #E8DCC2;
  border-left: 2px solid #C9A227;
  border-right: 2px solid #C9A227;
  padding: 16px;
  min-height: 150px;
}
.log-empty {
  text-align: center;
  padding: 30px;
  color: #8A8577;
}
.log-icon { font-size: 36px; margin-bottom: 8px; }
.log-hint { font-size: 12px; margin-top: 4px; color: #aaa; }
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
</style>
