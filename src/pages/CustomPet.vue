<script setup lang="ts">
/**
 * 造物（无极）编辑器
 *
 * 规则（总纲 §8）：集齐阴鱼 + 阳鱼后解锁；形象可上传（拼装模式待开放）；
 * 技能只能从效果池里挑，灵力预算 120，最多 3 个；名称与注音由学生填，教师审核读音与含义。
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  CUSTOM_BUDGET,
  CUSTOM_DESC_MAX,
  CUSTOM_NAME_MAX,
  CUSTOM_SKILL_COUNT,
  SKILL_EFFECTS,
} from '@/config/contentConfig'
import { checkImage } from '@/utils/nsfw'

const router = useRouter()

/** 占位：是否已集齐双鱼（M2 由 /api/v2/pets/hidden/check 决定） */
const unlocked = ref(true)

const petName = ref('')
const pinyin = ref('')
const picked = ref<string[]>([])
const preview = ref('')
const status = ref<'idle' | 'pending' | 'approved' | 'rejected'>('idle')

/** 图片检测（NSFW）：上传后先在本机跑一遍，未通过则不允许提交 */
const checking = ref(false)
const checkMsg = ref('')
const checkPassed = ref(false)

const used = computed(() =>
  picked.value.reduce((sum, code) => sum + (SKILL_EFFECTS.find((e) => e.code === code)?.cost ?? 0), 0),
)
const remain = computed(() => CUSTOM_BUDGET - used.value)

const nameError = computed(() => (petName.value.trim().length > CUSTOM_NAME_MAX ? '名称过长' : ''))
const overBudget = computed(() => remain.value < 0)

const canSubmit = computed(
  () =>
    unlocked.value &&
    status.value === 'idle' &&
    petName.value.trim().length > 0 &&
    pinyin.value.trim().length > 0 &&
    picked.value.length > 0 &&
    Boolean(preview.value) &&
    checkPassed.value &&
    !overBudget.value,
)

function toggle(code: string) {
  if (status.value !== 'idle') return
  const idx = picked.value.indexOf(code)
  if (idx >= 0) {
    picked.value.splice(idx, 1)
    return
  }
  if (picked.value.length >= CUSTOM_SKILL_COUNT) return
  picked.value.push(code)
}

async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  checking.value = true
  checkPassed.value = false
  checkMsg.value = '正在检测图片…'

  const verdict = await checkImage(file)
  checking.value = false

  if (!verdict.ok) {
    checkMsg.value = verdict.reason ?? '图片未通过检测，请换一张'
    input.value = ''
    return
  }

  checkPassed.value = true
  checkMsg.value = verdict.checked
    ? '图片检测通过'
    : (verdict.reason ?? '已跳过本地检测，交由老师审核')
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = URL.createObjectURL(file)
}

function submit() {
  if (!canSubmit.value) return
  status.value = 'pending'
}

const STATUS_TEXT: Record<string, string> = {
  idle: '尚未提交',
  pending: '已提交，等待老师审核',
  approved: '审核通过 · 已进入图鉴「本命」位',
  rejected: '被驳回，可修改后重新提交',
}

function back() {
  void router.push('/collection')
}
</script>

<template>
  <div class="cp gw-paper">
    <header class="cp__head">
      <button class="cp__back" @click="back">← 图鉴</button>
      <div class="cp__title">
        <h1>造物</h1>
        <p>集齐阴阳鱼者可创造只属于自己的一只神兽 · 全班唯一</p>
      </div>
      <div class="cp__status" :data-status="status">{{ STATUS_TEXT[status] }}</div>
    </header>

    <main class="cp__body">
      <!-- 立绘 -->
      <section class="cp__art">
        <div class="cp__frame">
          <img v-if="preview" :src="preview" alt="造物立绘预览" />
          <div v-else class="cp__empty">
            <span class="cp__glyph">☯</span>
            <span class="cp__hint">立绘位</span>
          </div>
        </div>

        <label class="gw-seal cp__upload">
          {{ checking ? '检测中…' : preview ? '更换立绘' : '上传立绘' }}
          <input
            type="file"
            accept="image/png,image/webp"
            hidden
            :disabled="status !== 'idle' || checking"
            @change="onFile"
          />
        </label>

        <p v-if="checkMsg" class="cp__check" :class="{ 'is-ok': checkPassed, 'is-bad': !checkPassed && !checking }">
          {{ checkMsg }}
        </p>

        <ul class="cp__rules">
          <li>1024×1024，PNG 透明底</li>
          <li>主体高占 72%，底部留 8%</li>
          <li>无水印、无文字、无场景</li>
          <li>拼装模式（部件库）待开放</li>
        </ul>
      </section>

      <!-- 名称与技能 -->
      <section class="cp__form">
        <h2 class="cp__sub">名与音</h2>
        <label class="cp__field">
          <span>名称（不超过 {{ CUSTOM_NAME_MAX }} 字）</span>
          <input v-model="petName" :maxlength="CUSTOM_NAME_MAX" :disabled="status !== 'idle'" placeholder="例：混沌" />
          <em v-if="nameError">{{ nameError }}</em>
        </label>
        <label class="cp__field">
          <span>注音（老师会核对读音）</span>
          <input v-model="pinyin" maxlength="24" :disabled="status !== 'idle'" placeholder="例：hùn dùn" />
        </label>
        <label class="cp__field">
          <span>一句描述（选填，不超过 {{ CUSTOM_DESC_MAX }} 字）</span>
          <input maxlength="40" :disabled="status !== 'idle'" placeholder="例：混沌未分，天地一气" />
        </label>

        <h2 class="cp__sub">
          技能
          <span class="cp__budget num" :class="{ 'is-over': overBudget }">
            灵力 {{ used }}/{{ CUSTOM_BUDGET }}
          </span>
        </h2>
        <div class="cp__bar"><i :style="{ width: Math.min(100, (used / CUSTOM_BUDGET) * 100) + '%' }" /></div>

        <div class="cp__effects">
          <button
            v-for="e in SKILL_EFFECTS"
            :key="e.code"
            class="effect"
            :class="{ 'is-picked': picked.includes(e.code) }"
            :disabled="status !== 'idle'"
            :title="e.description"
            @click="toggle(e.code)"
          >
            <span class="effect__name">{{ e.name }}</span>
            <span class="effect__cost num">{{ e.cost }}</span>
            <span class="effect__desc">{{ e.description }}</span>
          </button>
        </div>

        <p class="cp__fine">
          已选 <b class="num">{{ picked.length }}</b> / {{ CUSTOM_SKILL_COUNT }} 个技能。
          数值由系统给出，<b>不能自己填</b> —— 这是防止「一击必杀」的硬约束。
        </p>

        <div class="cp__ops">
          <button class="gw-seal gw-seal--primary" :disabled="!canSubmit" @click="submit">
            {{ status === 'idle' ? '提交审核' : '已提交' }}
          </button>
          <span v-if="!unlocked" class="cp__lock">尚未集齐阴鱼与阳鱼</span>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.cp {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding-bottom: 30px;
}

.cp__head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(28, 28, 36, 0.18);
  box-shadow: 0 2px 10px rgba(28, 28, 36, 0.07);
}
.cp__back {
  padding: 8px 14px;
  font-family: var(--font-title);
  font-size: 13px;
  color: var(--ink);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.cp__title h1 {
  margin: 0;
  font-family: var(--font-title);
  font-size: 22px;
  letter-spacing: 0.2em;
}
.cp__title p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--ink-2);
}
.cp__status {
  padding: 6px 12px;
  font-size: 12px;
  color: var(--ink-2);
  background: rgba(255, 253, 246, 0.75);
  border: 1px solid rgba(28, 28, 36, 0.18);
  border-radius: var(--r-sm);
  white-space: nowrap;
}
.cp__status[data-status='pending'] {
  color: #696969;
  border-color: rgba(160, 160, 160, 0.5);
  background: rgba(160, 160, 160, 0.12);
}
.cp__status[data-status='approved'] {
  color: var(--stone-green);
  border-color: rgba(101, 101, 101, 0.5);
  background: rgba(101, 101, 101, 0.12);
}

.cp__body {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 18px;
  padding: 18px 20px 0;
}

/* ---------- 立绘 ---------- */
.cp__art {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.cp__frame {
  display: grid;
  place-items: center;
  width: 100%;
  aspect-ratio: 1;
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 2px dashed rgba(28, 28, 36, 0.22);
  border-radius: var(--r-md);
  overflow: hidden;
}
.cp__frame img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.cp__empty {
  display: grid;
  place-items: center;
  gap: 4px;
}
.cp__glyph {
  font-size: 56px;
  color: rgba(28, 28, 36, 0.16);
}
.cp__hint {
  font-size: 12px;
  color: var(--ink-3);
}
.cp__upload {
  cursor: pointer;
}
.cp__check {
  margin: 0;
  padding: 5px 10px;
  font-size: 11px;
  line-height: 1.6;
  text-align: center;
  color: var(--ink-3);
  background: rgba(255, 253, 246, 0.75);
  border: 1px solid rgba(28, 28, 36, 0.16);
  border-radius: var(--r-sm);
}
.cp__check.is-ok {
  color: var(--stone-green);
  border-color: rgba(101, 101, 101, 0.3);
  background: rgba(101, 101, 101, 0.08);
}
.cp__check.is-bad {
  color: var(--cinnabar);
  border-color: rgba(96, 96, 96, 0.3);
  background: rgba(96, 96, 96, 0.08);
}
.cp__rules {
  margin: 0;
  padding-left: 18px;
  font-size: 11px;
  line-height: 1.8;
  color: var(--ink-3);
  align-self: stretch;
}

/* ---------- 表单 ---------- */
.cp__sub {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 8px;
  font-family: var(--font-title);
  font-size: 15px;
  letter-spacing: 0.12em;
  color: var(--ink);
  border-left: 3px solid var(--cinnabar);
  padding-left: 8px;
}
.cp__sub:not(:first-child) {
  margin-top: 18px;
}
.cp__budget {
  font-family: var(--font-num);
  font-size: 12px;
  letter-spacing: 0;
  color: var(--stone-green);
}
.cp__budget.is-over {
  color: var(--cinnabar);
}

.cp__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
  font-size: 12px;
  color: var(--ink-2);
}
.cp__field input {
  padding: 8px 10px;
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--ink);
  background: rgba(255, 253, 246, 0.85);
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
}
.cp__field em {
  font-style: normal;
  font-size: 11px;
  color: var(--cinnabar);
}

.cp__bar {
  height: 6px;
  margin-bottom: 10px;
  border-radius: 999px;
  background: rgba(28, 28, 36, 0.12);
  overflow: hidden;
}
.cp__bar > i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--stone-green), var(--jade));
  transition: width var(--d-base) var(--e-out);
}

.cp__effects {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 8px;
}
.effect {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px;
  text-align: left;
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.18);
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: transform var(--d-quick) var(--e-out), border-color var(--d-quick);
}
.effect:hover:not(:disabled) {
  transform: translateY(-2px);
}
.effect.is-picked {
  border-color: var(--gold);
  box-shadow: inset 0 0 0 2px rgba(160, 160, 160, 0.4);
}
.effect:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.effect__name {
  font-family: var(--font-title);
  font-size: 14px;
  color: var(--ink);
}
.effect__cost {
  position: absolute;
  align-self: flex-end;
  font-size: 11px;
  color: var(--cinnabar);
}
.effect__desc {
  font-size: 10px;
  line-height: 1.5;
  color: var(--ink-3);
}

.cp__fine {
  margin: 10px 0 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--ink-3);
}
.cp__fine b {
  color: var(--ink);
}

.cp__ops {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 14px;
}
.cp__lock {
  font-size: 12px;
  color: var(--cinnabar);
}

@media (max-width: 900px) {
  .cp__head {
    grid-template-columns: auto 1fr;
    gap: 8px;
    padding: 10px 12px;
  }
  .cp__status {
    grid-column: 1 / -1;
    justify-self: start;
  }
  .cp__body {
    grid-template-columns: 1fr;
    padding: 12px;
  }
  .cp__frame {
    max-width: 260px;
  }
}
</style>
