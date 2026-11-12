<script setup lang="ts">
/**
 * 顶部 HUD（横向卷轴）
 * 只负责展示；数据由页面传入，组件不请求接口。
 */
defineProps<{
  displayName: string
  grade: number
  realm: string
  level: number
  points: number
  shards: number
  gender: 'male' | 'female'
}>()

const emit = defineEmits<{ (e: 'settings'): void; (e: 'avatar'): void }>()

const onSettings = () => emit('settings')
const onAvatar = () => emit('avatar')
</script>

<template>
  <header class="hud gw-paper">
    <div
      class="hud__seal"
      :class="`hud__seal--${gender}`"
      role="button"
      tabindex="0"
      title="查看角色"
      @click="onAvatar"
      @keyup.enter="onAvatar"
    >
      {{ displayName.slice(-1) }}
      <b class="num">{{ level }}</b>
    </div>

    <div class="hud__who">
      <div class="hud__name">{{ displayName }} · G{{ grade }} 班</div>
      <div class="hud__sub">修行境界 <em>{{ realm }}</em> · 今日功名 +38</div>
    </div>

    <div class="hud__spacer" />

    <div class="hud__stats">
      <div class="hud__stat hud__stat--gold">
        <span>⛁</span><b class="num">{{ points }}</b>灵石
      </div>
      <div class="hud__stat"><span>◈</span>灵纹 <span class="num">{{ shards }}</span></div>
      <div class="hud__stat"><span>✧</span>斗法 <span class="num">3</span>/3</div>
    </div>

    <button class="hud__gear" title="设置" @click="onSettings">⚙</button>
  </header>
</template>

<style scoped>
.hud {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 18px;
  border-bottom: 1px solid rgba(28, 28, 36, 0.18);
  box-shadow: 0 2px 10px rgba(28, 28, 36, 0.07);
}

/* 落款印章式头像 */
.hud__seal {
  position: relative;
  flex: none;
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  font-family: var(--font-title);
  font-size: 22px;
  line-height: 1;
  color: #f7f7f7;
  border-radius: 5px;
  transform: rotate(-3deg);
  box-shadow: inset 0 0 0 2px rgba(240, 240, 240, 0.4), 0 2px 6px rgba(71, 71, 71, 0.3);
}
.hud__seal--male {
  background: linear-gradient(160deg, #636363, #3e3e3e);
}
.hud__seal--female {
  background: linear-gradient(160deg, #878787, #4a4a4a);
}
.hud__seal b {
  position: absolute;
  right: -6px;
  bottom: -6px;
  padding: 0 5px;
  font-family: var(--font-num);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.4;
  color: #1f1f1f;
  background: var(--gold);
  border: 1px solid rgba(255, 255, 255, 0.55);
  border-radius: 999px;
}

.hud__who {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.hud__name {
  font-family: var(--font-title);
  font-size: 17px;
  letter-spacing: 0.06em;
  color: var(--ink);
  white-space: nowrap;
}
.hud__sub {
  font-size: 12px;
  color: var(--ink-2);
}
.hud__sub em {
  font-style: normal;
  color: var(--stone-green);
}

.hud__spacer {
  flex: 1;
}

.hud__stats {
  display: flex;
  gap: 8px;
}
.hud__stat {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--ink);
  background: rgba(255, 253, 246, 0.72);
  border: 1px solid rgba(28, 28, 36, 0.16);
  border-radius: var(--r-sm);
  box-shadow: var(--sh-inset);
  white-space: nowrap;
}
.hud__stat--gold {
  color: #696969;
  background: rgba(160, 160, 160, 0.12);
  border-color: rgba(160, 160, 160, 0.45);
}

.hud__gear {
  flex: none;
  width: 34px;
  height: 34px;
  font-size: 15px;
  color: var(--ink);
  background: rgba(255, 253, 246, 0.72);
  border: 1px solid rgba(28, 28, 36, 0.2);
  border-radius: var(--r-sm);
  cursor: pointer;
  transition: transform var(--d-quick) var(--e-out), box-shadow var(--d-quick);
}
.hud__gear:hover {
  transform: translateY(-2px);
  box-shadow: var(--sh-lift);
}

@media (max-width: 720px) {
  .hud {
    gap: 10px;
    padding: 8px 12px;
  }
  .hud__sub {
    display: none;
  }
  .hud__stats .hud__stat:nth-child(n + 3) {
    display: none;
  }
}
</style>
