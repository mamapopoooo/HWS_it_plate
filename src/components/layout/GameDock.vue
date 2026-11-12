<script setup lang="ts">
/**
 * 左侧功能栏（木轴挂牌）
 * items 由页面传入，组件不写死菜单项 —— 以后加页面只需改调用方数组。
 */
export interface DockItem {
  key: string
  label: string
  glyph: string
  disabled?: boolean
}

defineProps<{
  items: DockItem[]
  active: string
}>()

const emit = defineEmits<{ (e: 'select', key: string): void }>()
</script>

<template>
  <nav class="dock">
    <button
      v-for="item in items"
      :key="item.key"
      class="dock__btn"
      :class="{ 'is-on': item.key === active }"
      :disabled="item.disabled"
      :title="item.label"
      @click="emit('select', item.key)"
    >
      {{ item.glyph }}
    </button>
  </nav>
</template>

<style scoped>
.dock {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 16px 10px;
  background: linear-gradient(90deg, rgba(228, 228, 228, 0.95), rgba(233, 233, 233, 0.35));
  border-right: 1px solid rgba(28, 28, 36, 0.14);
}

.dock__btn {
  display: grid;
  place-items: center;
  width: 44px;
  height: 52px;
  font-family: var(--font-title);
  font-size: 19px;
  line-height: 1;
  color: var(--ink-2);
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.22);
  border-radius: var(--r-sm);
  box-shadow: var(--sh-inset), 0 2px 5px rgba(28, 28, 36, 0.1);
  cursor: pointer;
  transition: transform var(--d-quick) var(--e-out), color var(--d-quick), box-shadow var(--d-quick);
}
.dock__btn:hover:not(:disabled) {
  transform: translateY(-3px);
  color: var(--ink);
  box-shadow: var(--sh-lift);
}
.dock__btn.is-on {
  color: #f7f7f7;
  background: linear-gradient(180deg, #2b2b2b, var(--cinnabar-d));
  border-color: var(--cinnabar-d);
  box-shadow: inset 0 0 0 1.5px rgba(240, 240, 240, 0.35), 0 3px 10px rgba(71, 71, 71, 0.35);
}
.dock__btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* 窄屏：底栏横排 */
@media (max-width: 900px) {
  .dock {
    flex-direction: row;
    justify-content: space-around;
    padding: 10px 8px;
    border-right: 0;
    border-top: 1px solid rgba(28, 28, 36, 0.14);
    background: linear-gradient(0deg, rgba(228, 228, 228, 0.9), rgba(233, 233, 233, 0.4));
  }
  .dock__btn {
    width: 52px;
    height: 52px;
    font-size: 21px;
  }
}
</style>
