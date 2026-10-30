<template>
  <div class="min-h-screen bg-gray-900 text-white overflow-x-hidden">
    <!-- 宠物选择界面 -->
    <div v-if="phase === 'select'" class="flex flex-col items-center min-h-screen p-3 sm:p-4">
      <h1 class="text-xl sm:text-3xl font-bold mb-2 sm:mb-4 text-orange-400">组建你的战队</h1>
      <p class="text-xs sm:text-sm text-gray-400 mb-3 sm:mb-4">从 6 只宠物中选择最多 4 只出战</p>

      <div class="grid grid-cols-3 sm:grid-cols-3 gap-2 sm:gap-4 w-full max-w-2xl mb-4">
        <div
          v-for="template in petTemplates"
          :key="template.id"
          class="relative bg-gray-800 rounded-lg p-2 sm:p-3 cursor-pointer transition border-2"
          :class="selectedIds.includes(template.id) ? 'border-orange-400 bg-gray-700' : 'border-transparent hover:border-gray-600'"
          @click="toggleSelect(template.id)"
        >
          <!-- 选中角标 -->
          <div
            v-if="selectedIds.includes(template.id)"
            class="absolute top-1 right-1 w-5 h-5 sm:w-6 sm:h-6 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold"
          >
            {{ selectedIds.indexOf(template.id) + 1 }}
          </div>

          <div class="h-20 sm:h-28 flex items-center justify-center mb-1">
            <img
              v-if="getPetSelectImage(template.name)"
              :src="getPetSelectImage(template.name)"
              :alt="template.name"
              class="max-h-full max-w-full object-contain"
            />
            <span v-else class="text-2xl sm:text-4xl" :style="{ color: elementColor(template.element) }">{{ elementEmoji(template.element) }}</span>
          </div>
          <h3 class="font-bold text-xs sm:text-sm text-center">{{ template.name }}</h3>
          <div class="flex justify-center mt-1">
            <span class="text-xs px-1.5 py-0.5 rounded" :class="roleColor(template.role)">{{ roleName(template.role) }}</span>
          </div>
        </div>
      </div>

      <div class="text-sm text-gray-400 mb-3">
        已选择 <span class="text-orange-400 font-bold">{{ selectedIds.length }}</span> / 4
      </div>

      <div class="flex gap-3">
        <button
          v-if="selectedIds.length > 0"
          class="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 sm:py-3 px-6 sm:px-8 rounded-lg text-sm sm:text-lg transition"
          @click="startBattle"
        >
          开始战斗！
        </button>
        <button
          v-if="selectedIds.length > 0"
          class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 sm:py-3 px-4 sm:px-6 rounded-lg text-sm transition"
          @click="selectedIds = []"
        >
          清空
        </button>
      </div>
    </div>

    <!-- 战斗界面 -->
    <div v-if="phase === 'battle'" class="flex flex-col" style="height: 100dvh;">
      <!-- 战斗画布区域 -->
      <div ref="canvasContainer" class="flex-1 relative bg-gradient-to-b from-blue-900 to-green-900 min-h-0 overflow-hidden">
        <canvas ref="battleCanvas" class="absolute inset-0 w-full h-full"></canvas>

        <!-- HP 条覆盖层 -->
        <div class="absolute top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-4 flex justify-between gap-2">
          <!-- 玩家 HP -->
          <div class="bg-gray-800/80 rounded-lg p-2 sm:p-3 flex-1 max-w-[45%]">
            <div class="flex justify-between items-center mb-1">
              <span class="font-bold text-xs sm:text-sm truncate">{{ battleState?.player?.petName }}</span>
              <span class="text-xs text-gray-400 shrink-0 ml-1">Lv.{{ battleState?.player?.level }}</span>
            </div>
            <div class="w-full bg-gray-700 rounded-full h-2 sm:h-3">
              <div class="bg-green-500 h-2 sm:h-3 rounded-full transition-all duration-500" :style="{ width: playerHpPercent + '%' }"></div>
            </div>
            <div class="text-xs text-right mt-0.5 sm:mt-1">{{ battleState?.player?.hp }} / {{ battleState?.player?.maxHp }}</div>
          </div>
          <!-- 对手 HP -->
          <div class="bg-gray-800/80 rounded-lg p-2 sm:p-3 flex-1 max-w-[45%]">
            <div class="flex justify-between items-center mb-1">
              <span class="font-bold text-xs sm:text-sm truncate">{{ battleState?.opponent?.petName }}</span>
              <span class="text-xs text-gray-400 shrink-0 ml-1">AI</span>
            </div>
            <div class="w-full bg-gray-700 rounded-full h-2 sm:h-3">
              <div class="bg-red-500 h-2 sm:h-3 rounded-full transition-all duration-500" :style="{ width: opponentHpPercent + '%' }"></div>
            </div>
            <div class="text-xs text-right mt-0.5 sm:mt-1">{{ battleState?.opponent?.hp }} / {{ battleState?.opponent?.maxHp }}</div>
          </div>
        </div>

        <!-- 回合信息 -->
        <div class="absolute top-2 left-1/2 -translate-x-1/2 sm:top-4 bg-gray-800/80 rounded-full px-3 sm:px-4 py-0.5 sm:py-1">
          <span class="text-xs sm:text-sm">回合 {{ battleState?.turn }}</span>
        </div>

        <!-- 切换宠物遮罩层 -->
        <div v-if="showSwitchOverlay" class="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
          <div class="bg-gray-800 rounded-xl p-4 sm:p-6 max-w-sm w-full mx-4">
            <h3 class="text-lg font-bold text-center mb-3" :class="switchReason === 'fainted' ? 'text-red-400' : 'text-blue-400'">
              {{ switchReason === 'fainted' ? '宠物被击败了！选择下一只出战' : '选择要切换的宠物' }}
            </h3>
            <div class="space-y-2">
              <div
                v-for="member in switchableTeam"
                :key="member.index"
                class="flex items-center gap-3 bg-gray-700 rounded-lg p-2 sm:p-3 cursor-pointer hover:bg-gray-600 transition"
                @click="doSwitch(member.index)"
              >
                <div class="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center bg-gray-600 rounded">
                  <img
                    v-if="getPetSelectImage(member.petName)"
                    :src="getPetSelectImage(member.petName)"
                    class="max-h-full max-w-full object-contain"
                  />
                  <span v-else class="text-lg" :style="{ color: elementColor(member.element) }">{{ elementEmoji(member.element) }}</span>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-bold text-sm truncate">{{ member.petName }}</div>
                  <div class="text-xs text-gray-400">HP: {{ member.hp }} / {{ member.maxHp }}</div>
                  <div class="w-full bg-gray-600 rounded-full h-1.5 mt-1">
                    <div class="bg-green-500 h-1.5 rounded-full" :style="{ width: (member.hp / member.maxHp * 100) + '%' }"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作区 -->
      <div class="bg-gray-800 p-2 sm:p-3 shrink-0">
        <!-- 队伍状态条 -->
        <div class="flex gap-1.5 sm:gap-2 mb-2 sm:mb-3">
          <div
            v-for="member in playerTeam"
            :key="member.index"
            class="flex-1 rounded-lg p-1.5 sm:p-2 text-center transition"
            :class="member.isActive ? 'bg-orange-900/50 border border-orange-500' : member.alive ? 'bg-gray-700/50 border border-gray-600' : 'bg-gray-800/50 border border-gray-700 opacity-50'"
          >
            <div class="text-xs font-bold truncate">{{ member.petName }}</div>
            <div class="w-full bg-gray-600 rounded-full h-1 sm:h-1.5 mt-1">
              <div
                class="h-1 sm:h-1.5 rounded-full transition-all"
                :class="member.alive ? 'bg-green-500' : 'bg-gray-500'"
                :style="{ width: member.alive ? (member.hp / member.maxHp * 100) + '%' : '0%' }"
              ></div>
            </div>
            <div class="text-xs text-gray-400 mt-0.5">{{ member.alive ? member.hp : '---' }}</div>
          </div>
        </div>

        <!-- 战斗日志 -->
        <div class="mb-2 sm:mb-3 h-10 sm:h-14 overflow-y-auto bg-gray-900 rounded p-1.5 sm:p-2 text-xs sm:text-sm">
          <div v-for="(log, i) in battleLog" :key="i" class="text-gray-300 leading-tight">{{ log }}</div>
        </div>

        <!-- 技能按钮 + 切换按钮 -->
        <div v-if="battleState?.battleStatus === 'active'" class="grid grid-cols-5 gap-1.5 sm:gap-2">
          <button
            v-for="skill in battleState?.player?.skills"
            :key="skill.id"
            :disabled="!skill.canUse"
            class="col-span-2 py-1.5 sm:py-2 px-1 sm:px-3 rounded-lg font-bold transition text-xs sm:text-sm"
            :class="skill.canUse ? 'bg-orange-500 hover:bg-orange-600 text-white active:bg-orange-700' : 'bg-gray-600 text-gray-400 cursor-not-allowed'"
            @click="useSkill(skill.id)"
          >
            {{ skill.name }}
            <span v-if="skill.cooldown > 0" class="text-xs opacity-70">(CD:{{ skill.cooldown }})</span>
          </button>
          <button
            class="col-span-1 py-1.5 sm:py-2 px-1 sm:px-2 rounded-lg font-bold transition text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 text-white"
            @click="requestSwitch"
          >
            切换
          </button>
        </div>

        <!-- 战斗结束 -->
        <div v-else-if="battleState?.battleStatus === 'finished'" class="text-center py-2">
          <div class="text-xl sm:text-2xl font-bold mb-2 sm:mb-3" :class="battleState?.winner === 'player' ? 'text-green-400' : 'text-red-400'">
            {{ battleState?.winner === 'player' ? '胜利！' : '失败...' }}
          </div>
          <div class="flex justify-center gap-3">
            <button class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 sm:px-6 rounded-lg transition text-sm sm:text-base" @click="resetBattle">再来一局</button>
            <button class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 sm:px-6 rounded-lg transition text-sm sm:text-base" @click="goHome">返回</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import * as PIXI from 'pixi.js'

// 宠物图片路径映射
const PET_BACK_IMAGE_MAP: Record<string, string> = {
  '焰尾狐': '/pet-garden/pets/pet_fire_fox/back_stand.png',
  '潮甲龟': '/pet-garden/pets/pet_water_turtle/back_stand.png',
  '叶灵鹿': '/pet-garden/pets/pet_grass_deer/back_stand.png',
  '雷光蜂': '/pet-garden/pets/pet_electric_bee/back_stand.png',
  '辉羽鹤': '/pet-garden/pets/pet_light_crane/back_stand.png',
  '影幽狼': '/pet-garden/pets/pet_dark_wolf/back_stand.png'
}

const PET_FRONT_IMAGE_MAP: Record<string, string> = {
  '焰尾狐': '/pet-garden/pets/pet_fire_fox/front_stand.png',
  '潮甲龟': '/pet-garden/pets/pet_water_turtle/front_stand.png',
  '叶灵鹿': '/pet-garden/pets/pet_grass_deer/front_stand.png',
  '雷光蜂': '/pet-garden/pets/pet_electric_bee/front_stand.png',
  '辉羽鹤': '/pet-garden/pets/pet_light_crane/front_stand.png',
  '影幽狼': '/pet-garden/pets/pet_dark_wolf/front_stand.png'
}

const PET_BACK_ATTACK_MAP: Record<string, string> = {
  '焰尾狐': '/pet-garden/pets/pet_fire_fox/back_attack.png',
  '潮甲龟': '/pet-garden/pets/pet_water_turtle/back_attack.png',
  '叶灵鹿': '/pet-garden/pets/pet_grass_deer/back_attack.png',
  '雷光蜂': '/pet-garden/pets/pet_electric_bee/back_attack.png',
  '辉羽鹤': '/pet-garden/pets/pet_light_crane/back_attack.png',
  '影幽狼': '/pet-garden/pets/pet_dark_wolf/back_attack.png'
}

const PET_FRONT_ATTACK_MAP: Record<string, string> = {
  '焰尾狐': '/pet-garden/pets/pet_fire_fox/front_attack.png',
  '潮甲龟': '/pet-garden/pets/pet_water_turtle/front_attack.png',
  '叶灵鹿': '/pet-garden/pets/pet_grass_deer/front_attack.png',
  '雷光蜂': '/pet-garden/pets/pet_electric_bee/front_attack.png',
  '辉羽鹤': '/pet-garden/pets/pet_light_crane/front_attack.png',
  '影幽狼': '/pet-garden/pets/pet_dark_wolf/front_attack.png'
}

const router = useRouter()

// 状态
const phase = ref<'select' | 'battle'>('select')
const petTemplates = ref<any[]>([])
const selectedIds = ref<string[]>([])
const battleState = ref<any>(null)
const battleLog = ref<string[]>([])
const battleId = ref('')
const userId = '6e9294ca-723b-43e1-acc6-36a06def29b9'
const playerTeam = ref<any[]>([])
const lastActivePetName = ref('')

// 切换相关
const showSwitchOverlay = ref(false)
const switchReason = ref<'fainted' | 'voluntary'>('voluntary')

// PixiJS
const canvasContainer = ref<HTMLElement>()
const battleCanvas = ref<HTMLCanvasElement>()
let app: PIXI.Application | null = null
let playerSprite: PIXI.Container | null = null
let opponentSprite: PIXI.Container | null = null
let playerSpriteChild: PIXI.Sprite | null = null
let opponentSpriteChild: PIXI.Sprite | null = null

// 计算属性
const playerHpPercent = computed(() => {
  if (!battleState.value?.player) return 100
  return (battleState.value.player.hp / battleState.value.player.maxHp) * 100
})
const opponentHpPercent = computed(() => {
  if (!battleState.value?.opponent) return 100
  return (battleState.value.opponent.hp / battleState.value.opponent.maxHp) * 100
})

const switchableTeam = computed(() => {
  if (!battleState.value?.playerTeam) return []
  return battleState.value.playerTeam.filter((m: any) => m.alive && !m.isActive)
})

// 工具函数
const elementColor = (el: string) => {
  const colors: Record<string, string> = { fire: '#E85D3A', water: '#3A8FE8', grass: '#4CAF50', electric: '#FFD600', light: '#FFC107', dark: '#7B1FA2' }
  return colors[el] || '#fff'
}
const elementEmoji = (el: string) => {
  const emojis: Record<string, string> = { fire: '🔥', water: '', grass: '🌿', electric: '⚡', light: '✨', dark: '🌑' }
  return emojis[el] || '?'
}
const roleName = (role: string) => {
  const names: Record<string, string> = { tank: '坦克', speed: '速攻', balance: '均衡', control: '控制' }
  return names[role] || role
}
const roleColor = (role: string) => {
  const colors: Record<string, string> = { tank: 'bg-blue-600', speed: 'bg-yellow-600', balance: 'bg-green-600', control: 'bg-purple-600' }
  return colors[role] || 'bg-gray-600'
}
const getPetSelectImage = (petName: string) => PET_FRONT_IMAGE_MAP[petName] || undefined

// API
const apiBase = '/api/game'

async function loadPetTemplates() {
  const res = await fetch(`${apiBase}/pets`)
  const data = await res.json()
  petTemplates.value = data.pets
}

function toggleSelect(templateId: string) {
  const idx = selectedIds.value.indexOf(templateId)
  if (idx >= 0) {
    selectedIds.value.splice(idx, 1)
  } else if (selectedIds.value.length < 4) {
    selectedIds.value.push(templateId)
  }
}

async function startBattle() {
  if (selectedIds.value.length === 0) return

  // 确保选中的宠物已创建（调用 choose 接口）
  const myPetsRes = await fetch(`${apiBase}/my-pets/${userId}`)
  const myPetsData = await myPetsRes.json()
  const myPets = myPetsData.pets || []

  // 为每个选中的模板确保有对应的宠物实例
  const teamPetIds: string[] = []
  for (const templateId of selectedIds.value) {
    const existing = myPets.find((p: any) => p.templateId === templateId)
    if (existing) {
      teamPetIds.push(existing.id)
    } else {
      // 创建新宠物
      const chooseRes = await fetch(`${apiBase}/pets/choose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: userId, petTemplateId: templateId })
      })
      const chooseData = await chooseRes.json()
      if (chooseData.pet) {
        teamPetIds.push(chooseData.pet.id)
      }
    }
  }

  // 开始战斗
  const res = await fetch(`${apiBase}/battle/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId: userId, teamPetIds })
  })
  const data = await res.json()

  if (data.error) {
    alert(data.error)
    return
  }

  battleId.value = data.battleId
  battleState.value = data
  playerTeam.value = data.playerTeam || []
  lastActivePetName.value = data.player?.petName || ''
  battleLog.value = [`战斗开始！${data.player.petName} vs ${data.opponent.petName}`]
  phase.value = 'battle'

  await nextTick()
  initBattleCanvas()
}

async function useSkill(skillId: string) {
  if (!battleId.value || !battleState.value || battleState.value.battleStatus !== 'active') return

  const res = await fetch(`${apiBase}/battle/${battleId.value}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skillId })
  })
  const data = await res.json()

  processBattleResponse(data)
}

function requestSwitch() {
  if (!battleState.value || battleState.value.battleStatus !== 'active') return
  if (switchableTeam.value.length === 0) return
  switchReason.value = 'voluntary'
  showSwitchOverlay.value = true
}

async function doSwitch(petIndex: number) {
  showSwitchOverlay.value = false

  const res = await fetch(`${apiBase}/battle/${battleId.value}/switch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ petIndex })
  })
  const data = await res.json()

  if (data.error) {
    alert(data.error)
    return
  }

  processBattleResponse(data)
}

function processBattleResponse(data: any) {
  // 记录日志
  if (data.actions && data.actions.length > 0) {
    for (const action of data.actions) {
      if (action.message) {
        battleLog.value.push(action.message)
      }
    }
  }

  battleState.value = data
  playerTeam.value = data.playerTeam || []

  // 检查是否需要切换
  if (data.battleStatus === 'switch_required' && data.switchSide === 'player') {
    switchReason.value = 'fainted'
    showSwitchOverlay.value = true
  }

  // 仅当出战宠物变化时刷新画布
  const newActivePet = data.player?.petName
  if (newActivePet && newActivePet !== lastActivePetName.value) {
    lastActivePetName.value = newActivePet
    nextTick(() => initBattleCanvas())
  }

  // 播放攻击动画
  if (data.actions && data.actions.length > 0) {
    playAttackAnimation(data.actions)
  }
}

function resetBattle() {
  battleState.value = null
  battleId.value = ''
  battleLog.value = []
  playerTeam.value = []
  phase.value = 'select'
}

function goHome() {
  router.push('/')
}

// PixiJS 战斗画布
async function initBattleCanvas() {
  if (!battleCanvas.value || !canvasContainer.value || !battleState.value) return

  if (app) {
    app.destroy(true)
    app = null
  }

  const w = canvasContainer.value.clientWidth
  const h = canvasContainer.value.clientHeight

  app = new PIXI.Application({
    view: battleCanvas.value,
    width: w,
    height: h,
    backgroundColor: 0x1a3a5c,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true
  })

  // 地面
  const ground = new PIXI.Graphics()
  ground.beginFill(0x2d5a27)
  ground.drawRect(0, h * 0.7, w, h * 0.3)
  ground.endFill()
  app.stage.addChild(ground)

  // 玩家宠物（背面 - 中位线以下）
  const playerImagePath = PET_BACK_IMAGE_MAP[battleState.value.player.petName]
  playerSprite = await createPetSprite(playerImagePath, battleState.value.player.petName, battleState.value.player.element || 'fire', true)
  playerSprite.x = w * 0.3
  playerSprite.y = h * 0.72
  app.stage.addChild(playerSprite)

  // 对手宠物（正面 - 中位线以上）
  const opponentImagePath = PET_FRONT_IMAGE_MAP[battleState.value.opponent.petName]
  opponentSprite = await createPetSprite(opponentImagePath, battleState.value.opponent.petName, battleState.value.opponent.element || 'water', false)
  opponentSprite.x = w * 0.7
  opponentSprite.y = h * 0.38
  app.stage.addChild(opponentSprite)
}

async function createPetSprite(imagePath: string | undefined, petName: string, element: string, isPlayer: boolean): Promise<PIXI.Container> {
  const container = new PIXI.Container()

  if (imagePath) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('Image load failed'))
        image.src = imagePath
      })

      const baseTexture = PIXI.BaseTexture.from(img)
      const texture = new PIXI.Texture(baseTexture)
      const sprite = new PIXI.Sprite(texture)

      const targetHeight = 120
      const scale = targetHeight / sprite.height
      sprite.scale.set(scale)
      sprite.anchor.set(0.5, 1)
      container.addChild(sprite)

      if (isPlayer) {
        playerSpriteChild = sprite
      } else {
        opponentSpriteChild = sprite
      }
    } catch {
      container.addChild(createPlaceholderCircle(element, 50))
    }
  } else {
    container.addChild(createPlaceholderCircle(element, 50))
  }

  const nameText = new PIXI.Text(petName, {
    fontSize: 14,
    fill: 0xffffff,
    align: 'center'
  })
  nameText.anchor.set(0.5)
  nameText.y = 80
  container.addChild(nameText)

  return container
}

function createPlaceholderCircle(element: string, radius: number): PIXI.Graphics {
  const colors: Record<string, number> = { fire: 0xE85D3A, water: 0x3A8FE8, grass: 0x4CAF50, electric: 0xFFD600, light: 0xFFC107, dark: 0x7B1FA2 }
  const color = colors[element] || 0xffffff

  const body = new PIXI.Graphics()
  body.beginFill(color)
  body.drawCircle(0, 0, radius)
  body.endFill()
  return body
}

function playAttackAnimation(actions: any[]) {
  if (!playerSprite || !opponentSprite || !app) return

  for (const action of actions) {
    if (action.damage > 0 || action.action === 'knockout') {
      const isPlayerAttacking = action.actor === 'A'
      const attacker = isPlayerAttacking ? playerSprite : opponentSprite
      const attackerChild = isPlayerAttacking ? playerSpriteChild : opponentSpriteChild
      const target = isPlayerAttacking ? opponentSprite : playerSprite

      const attackMap = isPlayerAttacking ? PET_BACK_ATTACK_MAP : PET_FRONT_ATTACK_MAP
      const standMap = isPlayerAttacking ? PET_BACK_IMAGE_MAP : PET_FRONT_IMAGE_MAP
      const petName = isPlayerAttacking ? battleState.value?.player?.petName : battleState.value?.opponent?.petName
      const attackImagePath = attackMap[petName || '']
      const standImagePath = standMap[petName || '']

      if (attackerChild && attackImagePath) {
        swapSpriteTexture(attackerChild, attackImagePath)
      }

      const origX = attacker.x
      const targetX = target.x + (isPlayerAttacking ? -60 : 60)

      app.ticker.add(function animate() {
        attacker.x += (targetX - attacker.x) * 0.2
        if (Math.abs(attacker.x - targetX) < 5) {
          app!.ticker.remove(animate)
          target.alpha = 0.3
          setTimeout(() => { if (target) target.alpha = 1 }, 100)
          setTimeout(() => { if (target) target.alpha = 0.3 }, 200)
          setTimeout(() => { if (target) target.alpha = 1 }, 300)
          setTimeout(() => {
            attacker.x = origX
            if (attackerChild && standImagePath) {
              swapSpriteTexture(attackerChild, standImagePath)
            }
          }, 400)
        }
      })
    }
  }
}

async function swapSpriteTexture(sprite: PIXI.Sprite, imagePath: string) {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Image load failed'))
      image.src = imagePath
    })
    const baseTexture = PIXI.BaseTexture.from(img)
    const texture = new PIXI.Texture(baseTexture)
    sprite.texture = texture
  } catch {
    // 加载失败，保持原纹理
  }
}

function handleResize() {
  if (phase.value === 'battle') {
    initBattleCanvas()
  }
}

onMounted(async () => {
  await loadPetTemplates()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (app) {
    app.destroy(true)
    app = null
  }
})
</script>
