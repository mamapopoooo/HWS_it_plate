<script setup lang="ts">
import { ref, computed } from 'vue'

const emit = defineEmits<{
  save: [data: { name: string; images: Record<string, string> }]
  cancel: []
}>()

const petName = ref('')
const levelImages = ref<Record<number, string>>({})
const activeLevel = ref(1)
const isDrawing = ref(false)
const brushColor = ref('#F97316')
const brushSize = ref(8)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let lastX = 0
let lastY = 0

const levelLabels = ['1 幼崽', '2 少年', '3 青年', '4 壮年', '5 王者', '6 神兽', '7 究极']

function initCanvas() {
  const canvas = canvasRef.value
  if (!canvas) return
  // 如果已有内容，先保存
  const existingData = levelImages.value[activeLevel.value]
  canvas.width = 400
  canvas.height = 400
  ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 400, 400)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    // 加载已有图片
    if (existingData) {
      const img = new Image()
      img.onload = () => {
        ctx!.drawImage(img, 0, 0, 400, 400)
      }
      img.src = existingData
    }
  }
}

function switchLevel(level: number) {
  // 保存当前画布
  saveCurrentCanvas()
  activeLevel.value = level
  setTimeout(initCanvas, 50)
}

function saveCurrentCanvas() {
  if (canvasRef.value && ctx) {
    levelImages.value[activeLevel.value] = canvasRef.value.toDataURL('image/png')
  }
}

function getCanvasPos(e: MouseEvent | TouchEvent): { x: number; y: number } {
  const canvas = canvasRef.value!
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  if ('touches' in e) {
    return {
      x: (e.touches[0].clientX - rect.left) * scaleX,
      y: (e.touches[0].clientY - rect.top) * scaleY
    }
  }
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  }
}

function startDraw(e: MouseEvent | TouchEvent) {
  e.preventDefault()
  isDrawing.value = true
  const pos = getCanvasPos(e)
  lastX = pos.x
  lastY = pos.y
}

function draw(e: MouseEvent | TouchEvent) {
  if (!isDrawing.value || !ctx) return
  e.preventDefault()
  const pos = getCanvasPos(e)
  ctx.strokeStyle = brushColor.value
  ctx.lineWidth = brushSize.value
  ctx.beginPath()
  ctx.moveTo(lastX, lastY)
  ctx.lineTo(pos.x, pos.y)
  ctx.stroke()
  lastX = pos.x
  lastY = pos.y
}

function stopDraw() {
  isDrawing.value = false
}

function clearCanvas() {
  if (!ctx || !canvasRef.value) return
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 400, 400)
}

function handleFileUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (ev) => {
    const dataUrl = ev.target?.result as string
    levelImages.value[activeLevel.value] = dataUrl
    // 在画布上显示
    setTimeout(() => {
      if (ctx && canvasRef.value) {
        const img = new Image()
        img.onload = () => {
          ctx!.fillStyle = '#ffffff'
          ctx!.fillRect(0, 0, 400, 400)
          // 居中缩放
          const scale = Math.min(400 / img.width, 400 / img.height)
          const w = img.width * scale
          const h = img.height * scale
          ctx!.drawImage(img, (400 - w) / 2, (400 - h) / 2, w, h)
        }
        img.src = dataUrl
      }
    }, 50)
  }
  reader.readAsDataURL(file)
  input.value = ''
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  const file = e.dataTransfer?.files[0]
  if (!file || !file.type.startsWith('image/')) return

  const reader = new FileReader()
  reader.onload = (ev) => {
    const dataUrl = ev.target?.result as string
    levelImages.value[activeLevel.value] = dataUrl
    setTimeout(() => {
      if (ctx && canvasRef.value) {
        const img = new Image()
        img.onload = () => {
          ctx!.fillStyle = '#ffffff'
          ctx!.fillRect(0, 0, 400, 400)
          const scale = Math.min(400 / img.width, 400 / img.height)
          const w = img.width * scale
          const h = img.height * scale
          ctx!.drawImage(img, (400 - w) / 2, (400 - h) / 2, w, h)
        }
        img.src = dataUrl
      }
    }, 50)
  }
  reader.readAsDataURL(file)
}

function allowDrop(e: DragEvent) {
  e.preventDefault()
}

const completedCount = computed(() => Object.keys(levelImages.value).length)
const canSave = computed(() => petName.value.trim() && completedCount.value >= 7)

function handleSave() {
  saveCurrentCanvas()
  // 确保7级都有
  const images: Record<string, string> = {}
  for (let i = 1; i <= 7; i++) {
    if (levelImages.value[i]) {
      images[String(i)] = levelImages.value[i]
    }
  }
  if (Object.keys(images).length < 7) {
    alert('请完成全部7个等级的图片')
    return
  }
  emit('save', { name: petName.value.trim(), images })
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="emit('cancel')">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
      <!-- 头部 -->
      <div class="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
        <div>
          <h2 class="text-xl font-bold text-gray-800">创建自定义宠物</h2>
          <p class="text-sm text-gray-500 mt-1">绘制或导入7张进化形态图</p>
        </div>
        <button @click="emit('cancel')" class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-xl">&times;</button>
      </div>

      <div class="p-6">
        <!-- 名称输入 -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">宠物名称</label>
          <input
            v-model="petName"
            type="text"
            placeholder="给你的宠物起个名字..."
            class="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none text-lg"
            maxlength="20"
          />
        </div>

        <!-- 等级选择器 -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">选择等级</label>
          <div class="flex gap-2 flex-wrap">
            <button
              v-for="(label, idx) in levelLabels"
              :key="idx + 1"
              @click="switchLevel(idx + 1)"
              class="px-3 py-2 rounded-lg text-sm font-medium transition-all"
              :class="activeLevel === idx + 1
                ? 'bg-orange-500 text-white shadow-md'
                : levelImages[idx + 1]
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
            >
              Lv.{{ label }}
              <span v-if="levelImages[idx + 1]" class="ml-1">✓</span>
            </button>
          </div>
          <p class="text-xs text-gray-400 mt-2">已完成 {{ completedCount }}/7 张</p>
        </div>

        <!-- 画布 + 工具栏 -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <!-- 画布区域 -->
          <div class="md:col-span-2">
            <div
              class="border-2 border-dashed rounded-xl overflow-hidden bg-white"
              :class="levelImages[activeLevel] ? 'border-green-300' : 'border-gray-300'"
              @drop="handleDrop"
              @dragover="allowDrop"
            >
              <canvas
                ref="canvasRef"
                class="w-full cursor-crosshair touch-none"
                style="aspect-ratio: 1"
                @mousedown="startDraw"
                @mousemove="draw"
                @mouseup="stopDraw"
                @mouseleave="stopDraw"
                @touchstart="startDraw"
                @touchmove="draw"
                @touchend="stopDraw"
              />
            </div>
            <p class="text-xs text-gray-400 mt-2 text-center">支持鼠标绘制、触屏绘制、拖拽图片导入</p>
          </div>

          <!-- 工具栏 -->
          <div class="space-y-4">
            <!-- 画笔颜色 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">画笔颜色</label>
              <div class="flex gap-2 flex-wrap">
                <button
                  v-for="color in ['#000000', '#F97316', '#EF4444', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#FACC15']"
                  :key="color"
                  @click="brushColor = color"
                  class="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
                  :class="brushColor === color ? 'border-gray-800 scale-110' : 'border-gray-200'"
                  :style="{ backgroundColor: color }"
                />
              </div>
              <input type="color" v-model="brushColor" class="mt-2 w-full h-8 rounded cursor-pointer" />
            </div>

            <!-- 画笔大小 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">画笔大小: {{ brushSize }}px</label>
              <input type="range" v-model.number="brushSize" min="2" max="40" class="w-full" />
            </div>

            <!-- 操作按钮 -->
            <div class="space-y-2">
              <label class="block text-sm font-medium text-gray-700">导入图片</label>
              <label class="block w-full px-4 py-2.5 bg-blue-50 text-blue-600 rounded-xl text-center cursor-pointer hover:bg-blue-100 transition-colors text-sm font-medium">
                选择图片文件
                <input type="file" accept="image/*" class="hidden" @change="handleFileUpload" />
              </label>
              <button @click="clearCanvas" class="w-full px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium">
                清空画布
              </button>
            </div>

            <!-- 预览 -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">当前等级预览</label>
              <div v-if="levelImages[activeLevel]" class="w-full aspect-square rounded-xl overflow-hidden border bg-gray-50">
                <img :src="levelImages[activeLevel]" class="w-full h-full object-contain" />
              </div>
              <div v-else class="w-full aspect-square rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 text-sm">
                暂无图片
              </div>
            </div>
          </div>
        </div>

        <!-- 7级缩略图预览 -->
        <div class="mt-6">
          <label class="block text-sm font-medium text-gray-700 mb-2">全部等级预览</label>
          <div class="grid grid-cols-7 gap-2">
            <div
              v-for="i in 7"
              :key="i"
              @click="switchLevel(i)"
              class="aspect-square rounded-lg overflow-hidden border-2 cursor-pointer transition-all hover:scale-105"
              :class="activeLevel === i ? 'border-orange-500 ring-2 ring-orange-200' : levelImages[i] ? 'border-green-300' : 'border-gray-200 bg-gray-50'"
            >
              <img v-if="levelImages[i]" :src="levelImages[i]" class="w-full h-full object-contain" />
              <div v-else class="w-full h-full flex items-center justify-center text-gray-300 text-xs">Lv.{{ i }}</div>
            </div>
          </div>
        </div>

        <!-- 保存按钮 -->
        <div class="mt-6 flex justify-end gap-3">
          <button @click="emit('cancel')" class="px-6 py-2.5 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
            取消
          </button>
          <button
            @click="handleSave"
            :disabled="!canSave"
            class="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-pink-500 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            保存宠物 ({{ completedCount }}/7)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
