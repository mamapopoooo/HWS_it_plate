<script setup lang="ts">
/**
 * 角色（修行者）页面：性别、皮肤穿戴、昵称
 *
 * 皮肤从宠物端整体迁到这里（总纲 §7）：纯装饰、不加属性，G7 不买也不影响战力。
 * 定义来自 seeds/skins.json，价格按 theme 读 economy.json —— 组件不写死数量与价格。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { type Gender, SKINS, skinPrice } from '@/config/contentConfig'
import { ECONOMY } from '@/config/gameConfig'
import { fetchCharacter, fetchWallet, saveSkin } from '@/api/adapter'

const router = useRouter()

const grade = ref(6)
const nickname = ref('')
const realname = ref('')
const gender = ref<Gender>('female')
const wallet = ref(0)

/** 已拥有与当前穿戴（由 adapter 填充） */
const owned = ref<Set<string>>(new Set())
const wearing = ref('')

async function load() {
  const [ch, w] = await Promise.all([fetchCharacter(), fetchWallet()])
  nickname.value = ch.nickname
  realname.value = ch.realName
  gender.value = ch.gender
  wearing.value = ch.skinId
  owned.value = new Set(ch.ownedSkinIds)
  wallet.value = w.points
}

onMounted(load)

const list = computed(() =>
  SKINS.filter((s) => s.gender === gender.value).sort((a, b) => a.sortOrder - b.sortOrder),
)

const current = computed(() => SKINS.find((s) => s.id === wearing.value))

/**
 * 立绘加载状态：缺图或加载失败时退回姓氏印章，不出破图。
 * 美术分批交付期间这是常态（seeds 里的 image 路径可能还没有文件）。
 */
const portraitFailed = ref(false)
watch(current, () => { portraitFailed.value = false })

const canWear = (id: string) => owned.value.has(id)

function priceOf(id: string): number {
  const skin = SKINS.find((s) => s.id === id)
  return skin ? skinPrice(skin, grade.value) : 0
}

async function buyOrWear(id: string) {
  if (canWear(id)) {
    wearing.value = id
    void saveSkin(id)
    return
  }
  const price = priceOf(id)
  if (price === 0) return // 0 元皮肤靠解锁，不卖
  if (wallet.value < price) return
  wallet.value -= price
  owned.value = new Set([...owned.value, id])
  wearing.value = id
  void saveSkin(id)
}

function switchGender(g: Gender) {
  gender.value = g
  // 换性别时自动切到该性别的基础形象，避免出现「男角色穿女装」的错配
  const base = `skin_base_${g === 'male' ? 'm' : 'f'}`
  if (owned.value.has(base)) {
    wearing.value = base
    void saveSkin(base)
  }
}

const displayName = computed(() =>
  realname.value ? `${nickname.value} · ${realname.value}` : nickname.value,
)

function back() {
  void router.push('/lobby')
}
</script>

<template>
  <div class="chr gw-paper">
    <header class="chr__head">
      <button class="chr__back" @click="back">← 大厅</button>
      <div class="chr__title">
        <h1>修行者</h1>
        <p>{{ displayName }} · 皮肤只改外观，不加属性</p>
      </div>
      <div class="chr__wallet">⛁ <b class="num">{{ wallet }}</b></div>
    </header>

    <main class="chr__body">
      <!-- 当前形象 -->
      <section class="chr__stage">
        <div class="chr__avatar" :class="`chr__avatar--${gender}`">
          <img
            v-if="current?.image && !portraitFailed"
            class="chr__img"
            :src="current.image"
            :alt="current.name"
            @error="portraitFailed = true"
          />
          <template v-else>
            <span class="chr__seal">{{ realname.slice(-1) || '生' }}</span>
            <span class="chr__pose">{{ current?.image ? '立绘加载失败 · 占位' : '立绘未交付 · 占位' }}</span>
          </template>
        </div>
        <div class="chr__meta">
          <span class="chr__name">{{ displayName }}</span>
          <span class="chr__skin">{{ current?.name ?? '未着装' }}</span>
        </div>

        <div class="chr__gender">
          <button :class="{ 'is-on': gender === 'female' }" @click="switchGender('female')">女</button>
          <button :class="{ 'is-on': gender === 'male' }" @click="switchGender('male')">男</button>
        </div>
      </section>

      <!-- 皮肤货架 -->
      <section class="chr__shop">
        <h2 class="chr__sub">衣橱<span class="chr__hint">价格随年级系数换算</span></h2>

        <div class="chr__grid">
          <button
            v-for="skin in list"
            :key="skin.id"
            class="skin"
            :class="{ 'is-wearing': wearing === skin.id, 'is-owned': canWear(skin.id) }"
            @click="buyOrWear(skin.id)"
          >
            <span class="skin__swatch" :data-theme="skin.theme" />
            <span class="skin__name">{{ skin.name }}</span>
            <span class="skin__price num">
              <template v-if="wearing === skin.id">穿戴中</template>
              <template v-else-if="canWear(skin.id)">穿戴</template>
              <template v-else-if="priceOf(skin.id) === 0">未解锁</template>
              <template v-else>⛁ {{ priceOf(skin.id) }}</template>
            </span>
          </button>
        </div>

        <p class="chr__note">
          校服与汉服可在集市购买；节气皮肤为赛季限定；结业服在 G6 两年期满后自动发放，不出售。
        </p>
      </section>

      <!-- 昵称 -->
      <section class="chr__side">
        <h2 class="chr__sub">名号</h2>
        <label class="chr__field">
          <span>昵称</span>
          <input v-model="nickname" maxlength="10" />
        </label>
        <p class="chr__fine">
          姓名来自花名册，不可修改。改昵称花费 <b class="num">{{ ECONOMY.character.nicknameChange }}</b> 灵石。
        </p>
      </section>
    </main>
  </div>
</template>

<style scoped>
.chr {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding-bottom: 30px;
}

.chr__head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(28, 28, 36, 0.18);
  box-shadow: 0 2px 10px rgba(28, 28, 36, 0.07);
}
.chr__back {
  padding: 8px 14px;
  font-family: var(--font-title);
  font-size: 13px;
  color: var(--ink);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.chr__title h1 {
  margin: 0;
  font-family: var(--font-title);
  font-size: 22px;
  letter-spacing: 0.18em;
}
.chr__title p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--ink-2);
}
.chr__wallet {
  padding: 6px 14px;
  font-size: 13px;
  color: #696969;
  border: 1px solid rgba(160, 160, 160, 0.45);
  background: rgba(160, 160, 160, 0.12);
  border-radius: var(--r-sm);
}

.chr__body {
  display: grid;
  grid-template-columns: 300px 1fr 260px;
  gap: 16px;
  padding: 18px 20px 0;
}

/* ---------- 当前形象 ---------- */
.chr__stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px;
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.2);
  border-radius: var(--r-md);
  box-shadow: var(--sh-inset), var(--sh-paper);
}
.chr__avatar {
  position: relative;
  display: grid;
  place-items: center;
  width: 180px;
  height: 260px;
  border-radius: 10px;
  box-shadow: inset 0 0 0 3px rgba(255, 253, 246, 0.4), 0 8px 20px rgba(28, 28, 36, 0.18);
}
/* 立绘缺失时的占位：姓氏印章，尺寸就是正式立绘的预留位 */
.chr__avatar--female {
  background: linear-gradient(180deg, #a3a3a3, #4a4a4a);
}
.chr__avatar--male {
  background: linear-gradient(180deg, #8b8b8b, #3e3e3e);
}
.chr__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.chr__seal {
  font-family: var(--font-title);
  font-size: 72px;
  color: rgba(255, 253, 246, 0.92);
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
}
.chr__pose {
  position: absolute;
  bottom: 8px;
  font-size: 10px;
  color: rgba(255, 253, 246, 0.7);
}
.chr__meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.chr__name {
  font-family: var(--font-title);
  font-size: 16px;
  letter-spacing: 0.06em;
  color: var(--ink);
}
.chr__skin {
  font-size: 12px;
  color: var(--ink-3);
}
.chr__gender {
  display: flex;
  gap: 4px;
  padding: 3px;
  background: rgba(255, 253, 246, 0.75);
  border: 1px solid rgba(28, 28, 36, 0.18);
  border-radius: 999px;
}
.chr__gender button {
  padding: 5px 20px;
  font-family: var(--font-title);
  font-size: 14px;
  color: var(--ink-2);
  background: transparent;
  border: 0;
  border-radius: 999px;
  cursor: pointer;
}
.chr__gender button.is-on {
  color: #f7f7f7;
  background: linear-gradient(180deg, #2b2b2b, var(--cinnabar-d));
}

/* ---------- 衣橱 ---------- */
.chr__sub {
  margin: 0 0 10px;
  font-family: var(--font-title);
  font-size: 15px;
  letter-spacing: 0.12em;
  color: var(--ink);
  border-left: 3px solid var(--cinnabar);
  padding-left: 8px;
}
.chr__hint {
  margin-left: 8px;
  font-family: var(--font-body);
  font-size: 11px;
  letter-spacing: 0;
  color: var(--ink-3);
}

.chr__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
}
.skin {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 12px 8px 10px;
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.18);
  border-radius: var(--r-md);
  box-shadow: var(--sh-inset), var(--sh-paper);
  cursor: pointer;
  transition: transform var(--d-quick) var(--e-out), box-shadow var(--d-quick);
}
.skin:hover {
  transform: translateY(-3px);
  box-shadow: var(--sh-lift);
}
.skin.is-wearing {
  border-color: var(--gold);
  box-shadow: inset 0 0 0 2px rgba(160, 160, 160, 0.45);
}
.skin__swatch {
  width: 44px;
  height: 58px;
  border-radius: 6px;
  background: linear-gradient(180deg, #d3d3d3, #aeaeae);
  box-shadow: inset 0 0 0 2px rgba(255, 253, 246, 0.5);
}
.skin__swatch[data-theme='base'] {
  background: linear-gradient(180deg, #dfdfdf, #b9b9b9);
}
.skin__swatch[data-theme='school'] {
  background: linear-gradient(180deg, #aaaaaa, #636363);
}
.skin__swatch[data-theme='hanfu'] {
  background: linear-gradient(180deg, #c8c8c8, #656565);
}
.skin__swatch[data-theme='season'] {
  background: linear-gradient(180deg, #cbcbcb, #a0a0a0);
}
.skin__swatch[data-theme='graduate'] {
  background: linear-gradient(180deg, #c4c4c4, #5f5f5f);
}
.skin__name {
  font-family: var(--font-title);
  font-size: 13px;
  color: var(--ink);
}
.skin__price {
  font-size: 11px;
  color: var(--ink-3);
}
.skin.is-wearing .skin__price {
  color: #696969;
  font-weight: 700;
}

.chr__note {
  margin: 12px 0 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--ink-3);
}

/* ---------- 名号 ---------- */
.chr__side {
  padding: 16px;
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.2);
  border-radius: var(--r-md);
  box-shadow: var(--sh-inset), var(--sh-paper);
  align-self: start;
}
.chr__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--ink-2);
}
.chr__field input {
  padding: 8px 10px;
  font-family: var(--font-body);
  font-size: 14px;
  color: var(--ink);
  background: rgba(255, 253, 246, 0.85);
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
}
.chr__fine {
  margin: 10px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--ink-3);
}
.chr__fine b {
  color: var(--cinnabar);
}

@media (max-width: 900px) {
  .chr__body {
    grid-template-columns: 1fr;
    padding: 12px;
  }
  .chr__avatar {
    width: 140px;
    height: 200px;
  }
  .chr__seal {
    font-size: 54px;
  }
  .chr__head {
    grid-template-columns: auto 1fr;
    gap: 8px;
    padding: 10px 12px;
  }
  .chr__wallet {
    grid-column: 1 / -1;
    justify-self: start;
  }
}
</style>
