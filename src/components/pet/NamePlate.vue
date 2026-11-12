<script setup lang="ts">
/**
 * 名称牌（挂轴）：名字 + 品阶 + 卦象 + 形态 + 等级
 * 品阶文案一律由外部传入（来自配置），组件内不写死"四象"等字面量。
 */
defineProps<{
  name: string
  /** 注音：生僻字必须显示（学生 11–14 岁） */
  pinyin: string
  tierName: string
  trigramText: string
  formText: string
  level: number
  accent: string
}>()
</script>

<template>
  <div class="plate" :style="{ '--accent': accent }">
    <span class="plate__who">
      <b class="plate__name">{{ name }}</b>
      <small class="plate__pinyin">{{ pinyin }}</small>
    </span>
    <span class="plate__tier">{{ tierName }}</span>
    <span class="plate__tri">{{ trigramText }}</span>
    <span class="plate__form">{{ formText }}</span>
    <span class="plate__lv num">Lv.{{ level }}</span>
  </div>
</template>

<style scoped>
.plate {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 22px;
  background: linear-gradient(180deg, var(--paper-light), var(--paper-2));
  border: 1px solid rgba(28, 28, 36, 0.3);
  border-radius: var(--r-sm);
  box-shadow: inset 0 0 0 2px rgba(255, 253, 246, 0.8), 0 3px 10px rgba(28, 28, 36, 0.14);
}
.plate__who {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.15;
}
.plate__name {
  font-family: var(--font-title);
  font-size: 19px;
  letter-spacing: 0.12em;
  color: var(--ink);
}
/* 注音：小一号、低对比，但不能小到看不清 */
.plate__pinyin {
  font-family: var(--font-body);
  font-size: 11px;
  letter-spacing: 0.04em;
  color: var(--ink-3);
}
.plate__tier {
  font-family: var(--font-title);
  font-size: 11px;
  letter-spacing: 0.1em;
  color: #f7f7f7;
  padding: 2px 7px;
  border-radius: 2px;
  background: var(--accent);
}
.plate__tri {
  font-family: var(--font-title);
  font-size: 13px;
  color: var(--accent);
}
.plate__form {
  font-size: 12px;
  color: var(--ink-2);
}
.plate__lv {
  font-size: 12px;
  color: var(--ink-3);
}

@media (max-width: 900px) {
  .plate {
    gap: 7px;
    padding: 7px 14px;
  }
  .plate__name {
    font-size: 16px;
  }
}
</style>
