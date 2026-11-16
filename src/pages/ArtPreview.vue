<script setup lang="ts">
/**
 * 美术候选预览（开发用）
 *
 * 目的：在**真实组件尺寸**下验 GPT 候选图（青龙、男女素衣）接入是否可用：
 * - 宠物立绘走 TaijiAltar（与大厅同一组件），并给 64px 缩略
 * - 角色立绘放在角色页同样的 180×260 框里，浅底/深底各一次
 * - 附一张故意写错的路径，验证缺图回退（不出破图）
 *
 * 候选图在 public/art-review/20261113/，**不是正式资源**；
 * 正式接入需 GPT 交付处理后版本再放 public/pets|characters。
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import TaijiAltar from '@/components/pet/TaijiAltar.vue'
import { getPet, getTier, tierName, formImage } from '@/config/gameConfig'

const router = useRouter()

const CANDIDATE_DIR = `${import.meta.env.BASE_URL}art-review/20261113`
const candidate = (file: string) => `${CANDIDATE_DIR}/${file}`

const qinglong = getPet('pet_qinglong')!
const accent = computed(() => getTier(qinglong.tier)?.bezelColor ?? '#8a8a8a')

const items = computed(() => [
  {
    id: 'qinglong',
    title: `${qinglong.name}（${tierName(qinglong.tier)}·首形态）`,
    note: '候选 1254×1254 · 正式目标 1024×1024 · 目标路径 public/pets/qinglong/form1.png',
    src: candidate('qinglong-form1.png'),
    formal: formImage(qinglong, 1),
  },
  {
    id: 'base_m',
    title: '素衣·男（基础形象）',
    note: '候选 1024×1536 · 目标路径 public/characters/base_m.png',
    src: candidate('base_m-plain.png'),
    formal: '/pet-garden/characters/base_m.png',
  },
  {
    id: 'base_f',
    title: '素衣·女（基础形象）',
    note: '候选 1024×1536 · 目标路径 public/characters/base_f.png',
    src: candidate('base_f-plain.png'),
    formal: '/pet-garden/characters/base_f.png',
  },
])

/** 故意不存在的路径，用来观察回退 */
const brokenSrc = `${CANDIDATE_DIR}/__not-exist__.png`
const brokenFailed = ref(false)

function back() {
  void router.push('/teacher')
}
</script>

<template>
  <div class="ap gw-paper">
    <header class="ap__head">
      <button class="ap__back" @click="back">← 教师端</button>
      <div class="ap__title">
        <h1>美术候选预览</h1>
        <p>候选图不做正式资源；仅验证真实尺寸下的接入、缺图回退与黑白底适配</p>
      </div>
    </header>

    <main class="ap__body">
      <!-- 宠物：真实组件 -->
      <section class="ap__stage gw-scroll">
        <div class="gw-scroll-head"><span>宠物 · 大厅同款站台</span><em>{{ tierName(qinglong.tier) }}</em></div>
        <TaijiAltar
          :image="candidate('qinglong-form1.png')"
          :alt="qinglong.name"
          :tier="qinglong.tier"
          :accent="accent"
          :aura="0.6"
          fallback-glyph="震"
        />
        <div class="ap__thumbs">
          <figure>
            <img :src="candidate('qinglong-form1.png')" alt="64px 缩略" width="64" height="64" />
            <figcaption>64px</figcaption>
          </figure>
          <p class="ap__hint">缩到 64px 仍能认出云纹与龙首轮廓，才算过缩略可辨。</p>
        </div>
      </section>

      <!-- 角色：180×260 框 -->
      <section class="ap__chars">
        <div v-for="it in items.filter((x) => x.id !== 'qinglong')" :key="it.id" class="ap__char-card gw-scroll">
          <div class="gw-scroll-head"><span>{{ it.title }}</span></div>
          <div class="ap__char-row">
            <div class="ap__frame ap__frame--light">
              <img :src="it.src" :alt="it.title" />
            </div>
            <div class="ap__frame ap__frame--dark">
              <img :src="it.src" :alt="it.title" />
            </div>
            <div class="ap__frame ap__frame--light">
              <img :src="it.src" :alt="it.title" width="64" height="64" class="ap__mini" />
            </div>
          </div>
          <p class="ap__hint">{{ it.note }}</p>
          <p class="ap__hint">目标路径：{{ it.formal }}</p>
        </div>
      </section>

      <!-- 缺图回退 -->
      <section class="ap__fallback gw-scroll">
        <div class="gw-scroll-head"><span>缺图回退（故意写错路径）</span></div>
        <div class="ap__char-row">
          <div class="ap__frame ap__frame--light">
            <img v-if="!brokenFailed" :src="brokenSrc" alt="应加载失败" @error="brokenFailed = true" />
            <span v-else class="ap__seal">印</span>
          </div>
          <p class="ap__hint">
            立绘加载失败时退回姓氏印章 + 文案，**不出现破图**。角色页与站台都走同一回退。
          </p>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.ap {
  min-height: 100dvh;
  padding-bottom: 32px;
}
.ap__head {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 20px;
  border-bottom: 1px solid rgba(28, 28, 36, 0.18);
}
.ap__back {
  padding: 7px 14px;
  font-family: var(--font-title);
  font-size: 13px;
  color: var(--ink);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.ap__title h1 {
  margin: 0;
  font-family: var(--font-title);
  font-size: 20px;
  letter-spacing: 0.12em;
}
.ap__title p {
  margin: 2px 0 0;
  font-size: 11px;
  color: var(--ink-2);
}

.ap__body {
  display: grid;
  gap: 16px;
  padding: 16px 20px 0;
  grid-template-columns: minmax(320px, 1fr) minmax(340px, 1.2fr);
  align-items: start;
}
.ap__stage {
  padding: 12px 14px;
}
.ap__thumbs {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}
.ap__thumbs figure {
  margin: 0;
  text-align: center;
}
.ap__thumbs figcaption {
  font-size: 10px;
  color: var(--ink-3);
}

.ap__chars {
  display: grid;
  gap: 12px;
}
.ap__char-card {
  padding: 12px 14px;
}
.ap__char-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.ap__frame {
  width: 180px;
  height: 260px;
  display: grid;
  place-items: center;
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
  overflow: hidden;
}
.ap__frame--light {
  background: var(--paper-light);
}
.ap__frame--dark {
  background: #2b2b2b;
}
.ap__frame img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.ap__mini {
  width: 64px;
  height: 64px;
}
.ap__seal {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  font-family: var(--font-title);
  font-size: 22px;
  color: #f7f7f7;
  background: linear-gradient(160deg, #4a4a4a, #111);
  border-radius: 6px;
}
.ap__hint {
  margin: 8px 0 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--ink-3);
}
.ap__fallback {
  grid-column: 1 / -1;
  padding: 12px 14px;
}

@media (max-width: 900px) {
  .ap__body {
    grid-template-columns: 1fr;
  }
}
</style>
