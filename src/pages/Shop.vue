<script setup lang="ts">
/**
 * 集市（商城，P4）
 * 商品与价格全部来自 seeds：shop.json 提供条目，价格经 priceKey 指向 economy.json。
 * 购买暂为本地占位，M2 接 POST /api/v2/shop/buy。
 */
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { SHOP_CATEGORIES, SHOP_ITEMS, itemPrice } from '@/config/contentConfig'

const router = useRouter()

const grade = ref(6)
const wallet = ref(1250)
const activeCat = ref('utility')

/** 已购买次数（限购用） */
const bought = reactive<Record<string, number>>({})

const list = computed(() => SHOP_ITEMS.filter((i) => i.category === activeCat.value))

function priceOf(id: string): number {
  const item = SHOP_ITEMS.find((i) => i.id === id)
  return item ? itemPrice(item, grade.value) : 0
}

function leftOf(id: string): number | null {
  const item = SHOP_ITEMS.find((i) => i.id === id)
  if (!item?.limit) return null
  return Math.max(0, item.limit - (bought[id] ?? 0))
}

function canBuy(id: string): boolean {
  const left = leftOf(id)
  return wallet.value >= priceOf(id) && (left === null || left > 0)
}

function buy(id: string) {
  if (!canBuy(id)) return
  wallet.value -= priceOf(id)
  bought[id] = (bought[id] ?? 0) + 1
}

function back() {
  void router.push('/lobby')
}
</script>

<template>
  <div class="sp gw-paper">
    <header class="sp__head">
      <button class="sp__back" @click="back">← 大厅</button>
      <div class="sp__title">
        <h1>集市</h1>
        <p>货郎担上的东西有限，先到先得</p>
      </div>
      <div class="sp__wallet">⛁ <b class="num">{{ wallet }}</b> 灵石</div>
    </header>

    <nav class="sp__tabs">
      <button
        v-for="c in SHOP_CATEGORIES"
        :key="c.key"
        :class="{ 'is-on': c.key === activeCat }"
        @click="activeCat = c.key"
      >
        {{ c.name }}
      </button>
    </nav>

    <main class="sp__grid">
      <article v-for="item in list" :key="item.id" class="goods">
        <div class="goods__icon">{{ item.glyph }}</div>
        <h2 class="goods__name">{{ item.name }}</h2>
        <p class="goods__desc">{{ item.desc }}</p>

        <!-- 铜钱价签 -->
        <div class="goods__price">
          <span class="goods__coin">⛁</span>
          <b class="num">{{ priceOf(item.id) }}</b>
        </div>

        <div class="goods__foot">
          <span v-if="leftOf(item.id) !== null" class="goods__limit num">限购 {{ leftOf(item.id) }}</span>
          <span v-else class="goods__limit">不限购</span>
          <button class="gw-seal goods__buy" :disabled="!canBuy(item.id)" @click="buy(item.id)">
            {{ leftOf(item.id) === 0 ? '已售罄' : wallet < priceOf(item.id) ? '灵石不足' : '购买' }}
          </button>
        </div>
      </article>
    </main>

    <footer class="sp__foot">
      价格为 G6 基准价，G7 按 {{ (0.6 * 10).toFixed(0) }} 折结算 · 装饰类不加属性，只改变外观
    </footer>
  </div>
</template>

<style scoped>
.sp {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  padding-bottom: 30px;
}

.sp__head {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid rgba(28, 28, 36, 0.18);
  box-shadow: 0 2px 10px rgba(28, 28, 36, 0.07);
}
.sp__back {
  padding: 8px 14px;
  font-family: var(--font-title);
  font-size: 13px;
  color: var(--ink);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.sp__title h1 {
  margin: 0;
  font-family: var(--font-title);
  font-size: 22px;
  letter-spacing: 0.18em;
}
.sp__title p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--ink-2);
}
.sp__wallet {
  padding: 6px 14px;
  font-size: 13px;
  color: #8a6a0b;
  border: 1px solid rgba(201, 162, 39, 0.45);
  background: rgba(201, 162, 39, 0.12);
  border-radius: var(--r-sm);
  white-space: nowrap;
}

.sp__tabs {
  display: flex;
  gap: 8px;
  padding: 12px 20px 0;
}
.sp__tabs button {
  padding: 8px 18px;
  font-family: var(--font-title);
  font-size: 14px;
  letter-spacing: 0.08em;
  color: var(--ink-2);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.2);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.sp__tabs button.is-on {
  color: #f7efe0;
  background: linear-gradient(180deg, #ce4436, var(--cinnabar-d));
  border-color: var(--cinnabar-d);
}

.sp__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  padding: 16px 20px;
}

.goods {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.2);
  border-radius: var(--r-md);
  box-shadow: var(--sh-inset), var(--sh-paper);
}
.goods__icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  font-family: var(--font-title);
  font-size: 24px;
  color: #f7efe0;
  background: linear-gradient(160deg, #8a7a5c, #5c4d36);
  border-radius: 8px;
  box-shadow: inset 0 0 0 2px rgba(255, 253, 246, 0.3);
}
.goods__name {
  margin: 2px 0 0;
  font-family: var(--font-title);
  font-size: 16px;
  letter-spacing: 0.08em;
  color: var(--ink);
}
.goods__desc {
  margin: 0;
  min-height: 34px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--ink-2);
}

/* 铜钱价签 */
.goods__price {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  padding: 3px 10px;
  color: #8a6a0b;
  background: radial-gradient(circle at 30% 30%, #fff6d8, #f0dfa8);
  border: 1px solid rgba(201, 162, 39, 0.55);
  border-radius: 999px;
  font-size: 13px;
}
.goods__coin {
  font-size: 12px;
}

.goods__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 2px;
}
.goods__limit {
  font-size: 11px;
  color: var(--ink-3);
}
.goods__buy {
  min-height: 36px;
  padding: 6px 16px;
  font-size: 13px;
}

.sp__foot {
  padding: 0 20px;
  font-size: 11px;
  color: var(--ink-3);
}

@media (max-width: 720px) {
  .sp__head {
    grid-template-columns: auto 1fr;
    gap: 8px;
    padding: 10px 12px;
  }
  .sp__wallet {
    grid-column: 1 / -1;
    justify-self: start;
  }
  .sp__grid {
    grid-template-columns: 1fr;
    padding: 12px;
  }
  .sp__tabs {
    padding: 10px 12px 0;
  }
}
</style>
