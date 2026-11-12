<script setup lang="ts">
/**
 * 造物审核（教师端）
 *
 * 学生提交的「无极」立绘 + 技能需教师审核后才会进入对战与图鉴。
 * 审核只审「名称/描述是否得体、是否抄袭同学、立绘是否合规」，不需要懂数值 ——
 * 数值由效果池固定，学生无法自填（总纲 §8.3）。
 *
 * 路由暂挂 /review（免登录便于演示）；M2 迁到 /admin/review 并加 role 守卫。
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CUSTOM_BUDGET, CUSTOM_SKILL_COUNT, SKILL_EFFECTS } from '@/config/contentConfig'
import { fetchSubmissions, reviewSubmission } from '@/api/adapter'

const router = useRouter()

type ReviewStatus = 'pending' | 'approved' | 'rejected'

interface Submission {
  id: string
  student: string
  nickname: string
  petName: string
  pinyin: string
  desc: string
  /** 效果池 code */
  skills: string[]
  submittedAt: string
  status: ReviewStatus
  note?: string
}

/** 待审队列：由 adapter 填充（真接口优先，未就绪回落占位） */
const submissions = ref<Submission[]>([])

async function load() {
  const list = await fetchSubmissions()
  submissions.value = list as Submission[]
  const first = list.find((s) => s.status === 'pending')
  if (first) activeId.value = first.id
}

onMounted(load)

const filter = ref<ReviewStatus | 'all'>('pending')
const activeId = ref('sub_001')
const note = ref('')

/** 未成年人内容合规（见 docs/内容安全红线.md）：四项全勾才允许通过 */
const compliance = ref({ adult: false, gore: false, horror: false, privacy: false })
const allClear = computed(
  () => compliance.value.adult && compliance.value.gore && compliance.value.horror && compliance.value.privacy,
)

function resetCompliance() {
  compliance.value = { adult: false, gore: false, horror: false, privacy: false }
}

const list = computed(() =>
  submissions.value.filter((s) => (filter.value === 'all' ? true : s.status === filter.value)),
)

const active = computed(() => submissions.value.find((s) => s.id === activeId.value) ?? list.value[0])

const stats = computed(() => ({
  pending: submissions.value.filter((s) => s.status === 'pending').length,
  approved: submissions.value.filter((s) => s.status === 'approved').length,
  rejected: submissions.value.filter((s) => s.status === 'rejected').length,
}))

/** 技能明细（把 code 翻成名字与消耗） */
const skillRows = computed(() =>
  (active.value?.skills ?? []).map((code) => {
    const e = SKILL_EFFECTS.find((x) => x.code === code)
    return { code, name: e?.name ?? code, cost: e?.cost ?? 0, desc: e?.description ?? '' }
  }),
)

const powerUsed = computed(() => skillRows.value.reduce((sum, r) => sum + r.cost, 0))
const overBudget = computed(() => powerUsed.value > CUSTOM_BUDGET)

function select(id: string) {
  activeId.value = id
  note.value = ''
  resetCompliance()
}

async function approve() {
  const item = active.value
  if (!item) return
  item.status = 'approved'
  item.note = note.value || '通过'
  const reason = item.note
  note.value = ''
  moveNext()
  await reviewSubmission(item.id, 'approve', reason)
}

async function reject() {
  const item = active.value
  if (!item) return
  if (!note.value.trim()) return // 驳回必须写理由
  item.status = 'rejected'
  item.note = note.value.trim()
  const reason = item.note
  note.value = ''
  moveNext()
  await reviewSubmission(item.id, 'reject', reason)
}

/** 审完自动跳到队列里下一条待审 */
function moveNext() {
  resetCompliance()
  const next = submissions.value.find((s) => s.status === 'pending')
  if (next) activeId.value = next.id
}

function back() {
  void router.push('/lobby')
}

const STATUS_NAME: Record<ReviewStatus, string> = {
  pending: '待审',
  approved: '已通过',
  rejected: '已驳回',
}
</script>

<template>
  <div class="rv gw-paper">
    <header class="rv__head">
      <button class="rv__back" @click="back">← 大厅</button>
      <div class="rv__title">
        <h1>造物审核</h1>
        <p>只审名称、描述与立绘是否得体；数值由效果池固定，学生不能自填</p>
      </div>
      <div class="rv__stats">
        <span class="rv__stat rv__stat--pending">待审 <b class="num">{{ stats.pending }}</b></span>
        <span class="rv__stat">已通过 <b class="num">{{ stats.approved }}</b></span>
        <span class="rv__stat">已驳回 <b class="num">{{ stats.rejected }}</b></span>
      </div>
    </header>

    <div class="rv__body">
      <!-- 队列 -->
      <aside class="rv__queue">
        <div class="rv__filters">
          <button :class="{ 'is-on': filter === 'pending' }" @click="filter = 'pending'">待审</button>
          <button :class="{ 'is-on': filter === 'approved' }" @click="filter = 'approved'">通过</button>
          <button :class="{ 'is-on': filter === 'rejected' }" @click="filter = 'rejected'">驳回</button>
          <button :class="{ 'is-on': filter === 'all' }" @click="filter = 'all'">全部</button>
        </div>

        <button
          v-for="s in list"
          :key="s.id"
          class="entry"
          :class="{ 'is-on': active?.id === s.id }"
          @click="select(s.id)"
        >
          <span class="entry__seal">{{ s.petName.slice(0, 1) }}</span>
          <span class="entry__main">
            <span class="entry__name">{{ s.petName }}</span>
            <span class="entry__sub">{{ s.pinyin }} · {{ s.nickname }}（{{ s.student }}）</span>
          </span>
          <span class="entry__time">{{ s.submittedAt }}</span>
        </button>

        <p v-if="list.length === 0" class="rv__empty">这个分类下没有记录。</p>
      </aside>

      <!-- 详情 -->
      <main v-if="active" class="rv__detail">
        <div class="rv__art">
          <span class="rv__glyph">☯</span>
          <span class="rv__art-hint">立绘预览位（1024² 透明底）</span>
        </div>

        <div class="rv__info">
          <h2 class="rv__pet">
            {{ active.petName }}
            <small>{{ active.pinyin }}</small>
          </h2>
          <p class="rv__desc">{{ active.desc || '（未填描述）' }}</p>
          <p class="rv__who">
            提交人：{{ active.nickname }}（{{ active.student }}）· {{ active.submittedAt }}
          </p>

          <h3 class="rv__sub">
            技能
            <span class="num" :class="{ 'is-over': overBudget }">
              灵力 {{ powerUsed }}/{{ CUSTOM_BUDGET }}
            </span>
          </h3>
          <div v-if="skillRows.length === 0" class="rv__empty">未配置技能</div>
          <ul v-else class="rv__skills">
            <li v-for="r in skillRows" :key="r.code">
              <span class="rv__skill-name">{{ r.name }}</span>
              <span class="rv__skill-cost num">{{ r.cost }}</span>
              <span class="rv__skill-desc">{{ r.desc }}</span>
            </li>
          </ul>
          <p class="rv__warn" v-if="overBudget">
            超出灵力预算（{{ powerUsed }} &gt; {{ CUSTOM_BUDGET }}），应驳回。
          </p>
          <p class="rv__warn" v-else-if="skillRows.length > CUSTOM_SKILL_COUNT">
            技能数超过上限 {{ CUSTOM_SKILL_COUNT }} 个，应驳回。
          </p>

          <template v-if="active.status === 'pending'">
            <!-- 未成年人内容合规：四项全勾才能通过（见 docs/内容安全红线.md） -->
            <div class="rv__safety">
              <div class="rv__safety-head">
                内容合规检查
                <span class="rv__safety-tip">面向 11–14 岁学生，四项必须全部确认</span>
              </div>
              <label class="rv__check">
                <input v-model="compliance.adult" type="checkbox" />
                不含色情或性暗示
              </label>
              <label class="rv__check">
                <input v-model="compliance.gore" type="checkbox" />
                不含血腥、暴力、内脏
              </label>
              <label class="rv__check">
                <input v-model="compliance.horror" type="checkbox" />
                不含恐怖惊悚元素
              </label>
              <label class="rv__check">
                <input v-model="compliance.privacy" type="checkbox" />
                不含本人或他人隐私信息
              </label>
            </div>

            <label class="rv__field">
              <span>审核意见（驳回必填，学生可见）</span>
              <textarea v-model="note" rows="3" placeholder="例：立绘角落有水印，请裁掉后重提" />
            </label>
            <div class="rv__ops">
              <button class="gw-seal gw-seal--primary" :disabled="!allClear" @click="approve">
                {{ allClear ? '通过' : '需先完成合规检查' }}
              </button>
              <button class="gw-seal" :disabled="!note.trim()" @click="reject">驳回</button>
              <span class="rv__tip">通过后立即进入图鉴「本命」位与对战</span>
            </div>
          </template>

          <div v-else class="rv__done" :data-status="active.status">
            <b>{{ STATUS_NAME[active.status] }}</b>
            <span v-if="active.note">意见：{{ active.note }}</span>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.rv {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

.rv__head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(28, 28, 36, 0.18);
  box-shadow: 0 2px 10px rgba(28, 28, 36, 0.07);
}
.rv__back {
  padding: 8px 14px;
  font-family: var(--font-title);
  font-size: 13px;
  color: var(--ink);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.rv__title h1 {
  margin: 0;
  font-family: var(--font-title);
  font-size: 22px;
  letter-spacing: 0.16em;
}
.rv__title p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--ink-2);
}
.rv__stats {
  display: flex;
  gap: 8px;
}
.rv__stat {
  padding: 5px 12px;
  font-size: 12px;
  color: var(--ink-2);
  background: rgba(255, 253, 246, 0.75);
  border: 1px solid rgba(28, 28, 36, 0.18);
  border-radius: var(--r-sm);
  white-space: nowrap;
}
.rv__stat--pending {
  color: #696969;
  border-color: rgba(160, 160, 160, 0.5);
  background: rgba(160, 160, 160, 0.12);
}

.rv__body {
  flex: 1;
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 0;
  min-height: 0;
}

/* ---------- 队列 ---------- */
.rv__queue {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 12px;
  border-right: 1px solid rgba(28, 28, 36, 0.14);
  overflow-y: auto;
}
.rv__filters {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}
.rv__filters button {
  flex: 1;
  padding: 5px 0;
  font-family: var(--font-title);
  font-size: 12px;
  color: var(--ink-2);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.18);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.rv__filters button.is-on {
  color: #f7f7f7;
  background: linear-gradient(180deg, #2b2b2b, var(--cinnabar-d));
  border-color: var(--cinnabar-d);
}

.entry {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  text-align: left;
  background: rgba(255, 253, 246, 0.6);
  border: 1px solid rgba(28, 28, 36, 0.14);
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: transform var(--d-quick) var(--e-out), box-shadow var(--d-quick);
}
.entry:hover {
  transform: translateX(2px);
  box-shadow: var(--sh-paper);
}
.entry.is-on {
  border-color: var(--gold);
  box-shadow: inset 0 0 0 2px rgba(160, 160, 160, 0.35);
}
.entry__seal {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex: none;
  font-family: var(--font-title);
  font-size: 16px;
  color: #f7f7f7;
  background: linear-gradient(160deg, #2b2b2b, var(--cinnabar-d));
  border-radius: 4px;
  transform: rotate(-3deg);
}
.entry__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.entry__name {
  font-family: var(--font-title);
  font-size: 14px;
  color: var(--ink);
}
.entry__sub {
  font-size: 10px;
  color: var(--ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.entry__time {
  font-size: 10px;
  color: var(--ink-3);
  white-space: nowrap;
}

/* ---------- 详情 ---------- */
.rv__detail {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 20px;
  padding: 18px 20px;
  align-content: start;
  overflow-y: auto;
}
.rv__art {
  display: grid;
  place-items: center;
  gap: 6px;
  aspect-ratio: 1;
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 2px dashed rgba(28, 28, 36, 0.22);
  border-radius: var(--r-md);
}
.rv__glyph {
  font-size: 64px;
  color: rgba(28, 28, 36, 0.16);
}
.rv__art-hint {
  font-size: 11px;
  color: var(--ink-3);
}

.rv__pet {
  margin: 0;
  font-family: var(--font-title);
  font-size: 26px;
  letter-spacing: 0.1em;
  color: var(--ink);
}
.rv__pet small {
  margin-left: 10px;
  font-family: var(--font-body);
  font-size: 13px;
  letter-spacing: 0;
  color: var(--ink-3);
}
.rv__desc {
  margin: 4px 0;
  font-size: 13px;
  color: var(--ink-2);
}
.rv__who {
  margin: 0 0 14px;
  font-size: 11px;
  color: var(--ink-3);
}

.rv__sub {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 8px;
  font-family: var(--font-title);
  font-size: 15px;
  letter-spacing: 0.1em;
  color: var(--ink);
  border-left: 3px solid var(--cinnabar);
  padding-left: 8px;
}
.rv__sub .num {
  font-family: var(--font-num);
  font-size: 12px;
  letter-spacing: 0;
  color: var(--stone-green);
}
.rv__sub .num.is-over {
  color: var(--cinnabar);
}

.rv__skills {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 4px;
}
.rv__skills li {
  display: grid;
  grid-template-columns: 96px 34px 1fr;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  font-size: 12px;
  background: rgba(255, 253, 246, 0.7);
  border: 1px solid rgba(28, 28, 36, 0.12);
  border-radius: var(--r-sm);
}
.rv__skill-name {
  font-family: var(--font-title);
  font-size: 13px;
  color: var(--ink);
}
.rv__skill-cost {
  color: var(--cinnabar);
  font-weight: 700;
}
.rv__skill-desc {
  color: var(--ink-3);
  font-size: 11px;
}

.rv__warn {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--cinnabar);
}

.rv__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 14px;
  font-size: 12px;
  color: var(--ink-2);
}

/* 内容合规检查 */
.rv__safety {
  display: grid;
  gap: 4px;
  margin-top: 14px;
  padding: 10px 12px;
  background: rgba(96, 96, 96, 0.05);
  border: 1px solid rgba(96, 96, 96, 0.25);
  border-radius: var(--r-sm);
}
.rv__safety-head {
  font-family: var(--font-title);
  font-size: 13px;
  letter-spacing: 0.08em;
  color: var(--cinnabar);
}
.rv__safety-tip {
  margin-left: 8px;
  font-family: var(--font-body);
  font-size: 11px;
  letter-spacing: 0;
  color: var(--ink-3);
}
.rv__check {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ink);
  cursor: pointer;
}
.rv__check input {
  accent-color: var(--cinnabar);
}
.rv__field textarea {
  padding: 8px 10px;
  font-family: var(--font-body);
  font-size: 13px;
  color: var(--ink);
  background: rgba(255, 253, 246, 0.85);
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
  resize: vertical;
}

.rv__ops {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
}
.rv__tip {
  font-size: 11px;
  color: var(--ink-3);
}

.rv__done {
  margin-top: 14px;
  padding: 10px 14px;
  font-size: 13px;
  border-radius: var(--r-sm);
  border: 1px solid rgba(28, 28, 36, 0.18);
  background: rgba(255, 253, 246, 0.7);
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.rv__done[data-status='approved'] {
  color: var(--stone-green);
  border-color: rgba(101, 101, 101, 0.45);
  background: rgba(101, 101, 101, 0.1);
}
.rv__done[data-status='rejected'] {
  color: var(--cinnabar);
  border-color: rgba(96, 96, 96, 0.45);
  background: rgba(96, 96, 96, 0.08);
}

.rv__empty {
  padding: 18px;
  font-size: 12px;
  color: var(--ink-3);
  text-align: center;
}

@media (max-width: 900px) {
  .rv__head {
    grid-template-columns: auto 1fr;
    gap: 8px;
    padding: 10px 12px;
  }
  .rv__stats {
    grid-column: 1 / -1;
  }
  .rv__body {
    grid-template-columns: 1fr;
  }
  .rv__queue {
    border-right: 0;
    border-bottom: 1px solid rgba(28, 28, 36, 0.14);
    max-height: 220px;
  }
  .rv__detail {
    grid-template-columns: 1fr;
    padding: 12px;
  }
  .rv__art {
    max-width: 220px;
  }
}
</style>
