# 墨境 2.0 — UI/UX 设计规范 v1（DSH 交付）

> **状态：** 草案，等待教师确认后才编码（遵循提示词工作流「先设计 → 确认 → 编码」）
> **作者：** DSH（UI/UX 工程师） · **日期：** 2026-11-02 · **分支：** `dev-dsh`
> **配套设计稿（可直接双击打开看真实特效）：** [`design-preview.html`](./design-preview.html)

---

## 0. 先对齐现实：提示词 vs 仓库实况

在动手前我先核对了代码，有 5 处与提示词描述不一致，需要你确认后我才好定稿：

| 项 | 提示词写的 | 仓库实况 | 我的处理建议 |
|---|---|---|---|
| 分支 | `dev-dsh`（GitHub HWS_it_plate） | 原来只有 `main`，我已新建 `dev-dsh` | 已在 `dev-dsh` 上工作 |
| 宠物体系 | 6 只属性宠物（焰尾狐…影幽狼）+ 觉醒 0-4 阶 | **两套并存**：`src/data/pets.ts` 有 **26 只**（19 普通 + 7 神兽，按等级换图 lv1-8）；`public/pets/pet_*` 另有一套 6 只属性宠物，只服务于 `Battle.vue` | UI 分两条轨道：**养成轨（26 只/7 级）** 与 **对战轨（6 只/属性）** |
| 等级 | 觉醒 0-4 阶 | `LEVEL_CONFIG = [40×6]`，**Lv.1-7**，每级 40 分 | 觉醒是「额外一层装饰」，不替代等级 |
| 组件目录 | `src/components/` 下直接放 | 现在只有 7 个通用组件（AuthModal/ConfirmDialog/PetImage/Toast…），无子目录 | 新建 `components/pet|gacha|game` 子目录 |
| 页面 | 8 个页面（Dashboard…ClassBattle） | 只有 3 条路由：`/`(Home) `/preview` `/battle` | 新增页面按 3 批接入，先不删现有 Home |

> 另外：现在 `Home.vue` 是**教师端**（班级学生卡片 + 加减分 + 弹窗），学生端首页还没有。本规范里的 `Dashboard.vue` 是**学生端首页**，与教师端 Home 并列，不冲突。

---

## 1. 设计原则

1. **一张卡一屏能读懂**：宠物、等级、星级、觉醒阶、稀有度全部靠「颜色 + 形状」双通道编码，不依赖小字。
2. **光效只加不减**：任何特效都不能降低文字对比度；特效层 `aria-hidden` + `pointer-events:none`。
3. **只用 transform / opacity / filter 做动画**，不用 width/height/top/left —— 保证 30fps 以上，旧平板上也稳。
4. **移动优先**：课件场景大量是学生手机/平板竖屏（`Battle.vue` 现在就是 `100dvh` 竖屏），桌面是增强而非基线。

---

## 2. 设计令牌（Design Tokens）

全部写进 `src/styles/tokens.css` 的 CSS 变量，Tailwind 里用 `theme.extend` 映射一份，**组件只引用令牌，不写死色值**。

### 2.1 品牌与语义色（沿用现有，不改）

| 令牌 | 值 | 用途 |
|---|---|---|
| `--c-primary` | `#FF9F43` | 主按钮、选中态、积分 |
| `--c-secondary` | `#26DE81` | 成功、升级、血条满 |
| `--c-danger` | `#EF4444` | 扣分、失败、羁绊 |
| `--c-warning` | `#F59E0B` | 提醒、倒计时 |
| `--c-accent-pink/purple/blue/cyan/emerald` | `#FF6B9D` `#A855F7` `#3B82F6` `#06B6D4` `#10B981` | 装饰渐变、标签 |

### 2.2 属性色（对战轨，收自 `Battle.vue` 里散落的硬编码）

| 属性 | 主色 | 深色（描边/背景） | 图标 |
|---|---|---|---|
| 火 fire | `#E85D3A` | `#8C2F1B` | 🔥 |
| 水 water | `#3A8FE8` | `#1B4C8C` | 💧 |
| 草 grass | `#4CAF50` | `#245C27` | 🌿 |
| 电 electric | `#FFD600` | `#8C7500` | ⚡ |
| 光 light | `#FFC107` | `#8C6A00` | ✨ |
| 暗 dark | `#7B1FA2` | `#3F1053` | 🌑

> 现状问题：这 6 个色值在 `Battle.vue` 里以 `elementColor()` / `createPlaceholderCircle()` 重复写了 3 遍，改造时统一收进 `tokens.css` + `src/data/elements.ts`。

### 2.3 稀有度（星级）色板 — 新增

| 星级 | 名称 | 主色 | 外光 `--halo` | 抽卡演出光 |
|---|---|---|---|---|
| 1★ | 普通 | `#9CA3AF` | 无 | 白光 |
| 2★ | 优秀 | `#26DE81` | `rgba(38,222,129,.35)` | 白光 |
| 3★ | 精良 | `#3B82F6` | `rgba(59,130,246,.40)` | 白光 |
| 4★ | 稀有 | `#A855F7` | `rgba(168,85,247,.45)` | 蓝光 |
| 5★ | 史诗 | `#F59E0B` | `rgba(245,158,11,.50)` | 紫光 |
| 6★ | 传说 | 彩虹流金 | `rgba(255,215,0,.60)` | 金光 / 彩虹 |

### 2.4 觉醒阶色板 — 新增

| 阶 | 名称 | 光环色 | 光强 | 动效节奏 |
|---|---|---|---|---|
| 0 | 原初 | 无 | 0 | 静止 |
| 1 | 觉醒 | `#FFD700` | 12px | 呼吸 3s |
| 2 | 共鸣 | `#FFB020` | 20px | 呼吸 2s + 6 粒子上浮 |
| 3 | 爆发 | 暖金→橙红 | 30px | 旋转 8s + 12 粒子 + 星芒 0.9s |
| 4 | 究极 | 金→紫双环 | 40px | 双环反向 6s + 24 粒子 + 边缘流光 |

### 2.5 圆角 / 阴影 / 间距 / 字阶

```
圆角：卡 --r-card 16px（rounded-2xl）、模态 --r-modal 24px（rounded-3xl）、
      小控件 --r-sm 10px、胶囊 999px
阴影：--sh-card 0 2px 8px rgba(0,0,0,.08)
      --sh-hover 0 8px 25px rgba(0,0,0,.15)
      --sh-glow 0 0 24px var(--halo)
间距：4px 栅格；卡片内边距 p-4 / sm:p-6；区块间距 space-y-4 / sm:space-y-6
字阶：12 / 14 / 16 / 18 / 20 / 24 / 30 / 40
      标题 clamp(20px, 4.5vw, 30px)；数字一律 font-variant-numeric: tabular-nums
```

### 2.6 动效令牌

```
--d-instant 120ms  （按钮按下、勾选）
--d-quick   200ms  （hover、tooltip、徽章解锁起步）
--d-base    300ms  （模态入场、卡片切换）
--d-slow    600ms  （升级、页面转场）
--d-gacha   2400ms （单抽完整演出，800ms 后可点击跳过）
缓动：--e-out cubic-bezier(.22,1,.36,1)   --e-in-out cubic-bezier(.4,0,.2,1)
      --e-back cubic-bezier(.34,1.56,.64,1)  （弹入用）
```

---

## 3. 关键设计决策：觉醒滤镜不能整体 `hue-rotate`

提示词模块 2 的原始方案是给整张宠物图 `filter: hue-rotate(60deg) brightness(1.5)`。实测问题很明确：

- 焰尾狐本体是橙毛，`hue-rotate(180deg)` 会变成「青毛狗」，学生第一眼认不出自己的宠物；
- 6 阶叠加上 `brightness(1.5~2)` 后，浅色背景上羽毛细节全糊，且 Safari 上 `filter` + `box-shadow` 同时动画会掉帧。

**我的方案（双通道）：本体只调明度/饱和度，色彩变化只作用于「外发光副本」。**

```css
/* 本体：可读性优先 */
.pet-body { filter: saturate(var(--aw-sat)) brightness(var(--aw-bri)); }

/* 外发光副本：同一张图的模糊副本，用色相偏移造出"觉醒色" */
.pet-aura {
  filter: blur(12px) saturate(2) hue-rotate(var(--aw-hue));
  opacity: var(--aw-aura-op);
  mix-blend-mode: screen;
  transform: scale(1.06);
  pointer-events: none;
}
```

| 阶 | `--aw-sat` | `--aw-bri` | `--aw-hue` | `--aw-aura-op` | 额外层 |
|---|---|---|---|---|---|
| 0 | 1 | 1 | 0 | 0 | — |
| 1 | 1.15 | 1.0 | 10deg | .35 | 金色细环（2px）+ 呼吸 |
| 2 | 1.30 | 1.03 | 25deg | .45 | 双环 + 6 粒子上浮 |
| 3 | 1.50 | 1.08 | 40deg | .55 | 旋转锥形光 + 12 粒子 + 星芒 |
| 4 | 1.70 | 1.15 | 60deg | .70 | 双环反向 + 24 粒子 + 边缘流光 + 背景光斑 |

> **这一条是本规范最需要你拍板的（见 §9 D1）。** 你可以在 `design-preview.html` 的「觉醒 0-4 阶」区块里直接对比「我的方案」和「提示词原方案」并排效果。

### 3.1 粒子实现（不依赖图片）

- 用 CSS 自定义属性在 1 个元素上生成 N 个 `radial-gradient` 点，`background-size` 分桶，避免创建 N 个 DOM 节点；
- 粒子数量按设备分档：`桌面 24 / 平板 16 / 手机 10 / 低端（`navigator.hardwareConcurrency<=4`）6`；
- 全部 `transform: translate3d()`，`will-change: transform` 只在演出期间加，结束即移除。

---

## 4. 组件规格（模块 1）

统一约定：`<script setup lang="ts">` + 中文注释；尺寸档 `sm | md | lg` 对应移动/平板/桌面；所有组件 `defineProps` 显式声明类型，不用 `any`。

### 4.1 PetCard.vue

```ts
interface Props {
  pet: PlayerPet            // { id, name, level, exp, awakeningLevel, element, rarity, image, skinId }
  size?: 'sm' | 'md' | 'lg' // sm=学生列表 96px, md=图鉴 160px, lg=详情页 240px
  selected?: boolean
  disabled?: boolean
  showProgress?: boolean    // 显示等级进度条
}
// emit: click, awaken, equip-skin, detail
```

- 结构：`图片区（含 AwakeningEffect 覆盖层）→ 等级徽章（左上）→ 稀有度星标（右上）→ 名称 → 进度条 → 操作按钮`
- 状态：默认 / hover（`-translate-y-1` + `--sh-hover`）/ 选中（2px primary 描边 + 勾选角标）/ 禁用（`.55` 透明 + 无 hover）/ 蛋形态（未领养，`wiggle` 2s）
- 无障碍：`role="button"` `tabindex="0"`，`Enter/Space` 触发 `click`；图片 `alt` 用「{宠物名} Lv.{等级}」

### 4.2 AwakeningEffect.vue

```ts
interface Props {
  level: 0 | 1 | 2 | 3 | 4
  element?: ElementKey
  size?: number             // 基础半径，用于换算环半径
  reduceMotion?: boolean    // 跟随系统 prefers-reduced-motion
}
```

- 纯装饰层：`aria-hidden="true"` `pointer-events:none`，绝对定位在图片容器内
- 分层渲染：`aura`（L≥1）/ `ring`（L≥1）/ `particles`（L≥2）/ `spark`（L≥3）/ `ultimate`（L=4）
- `reduceMotion` 时：粒子与旋转关闭，仅保留静态光环（不闪不转）

### 4.3 SkinPreview.vue

```ts
interface Props { pet: PlayerPet; skins: Skin[]; ownedIds: string[] }
// Skin[] = { id, name, cssClass, price, isLimited }
// emit: equip(skinId), preview(skinId)
```

- 左：大图实时预览（皮肤 `cssClass` 直接加在 `<img>` 上，**不重载图片**）
- 右：皮肤宫格（4 列 / 移动 3 列），未拥有显示价格 + 锁图标，限定皮肤加「限定」角标
- 切换动效：`--d-quick` 交叉淡入（两张图叠放，透明度互换），避免闪白

### 4.4 GachaAnimation.vue

```ts
interface Props { rarity: 1|2|3|4|5|6; autoPlay?: boolean; skipAfter?: number /* 默认 800 */ }
// emit: done, skip
```

**时间轴（总 2400ms）：**

| 阶段 | 时间 | 画面 |
|---|---|---|
| 蓄力 | 0–800ms | 蛋体呼吸 + 抖动，屏幕轻微暗场（遮罩 `rgba(0,0,0,.55)`） |
| 光柱 | 800–1600ms | 由蛋心射出光柱，颜色按星级（白/蓝/紫/金/彩虹），光圈扩散 0→300px |
| 爆发 | 1600–2400ms | 粒子向外飞散（24 个）+ 稀有度文字弹入 + 星级逐颗点亮（每颗 120ms） |

- 800ms 后出现「点击跳过」，跳过时直接跳到爆发末帧（不再重播）
- 6 星：光柱用 `conic-gradient` 彩虹 + 持续流光，区别于 5 星单色金

### 4.5 AchievementBadge.vue

```ts
interface Props { achievement: Achievement; unlocked: boolean; size?: 'sm'|'md'|'lg' }
// emit: click
```

- 未解锁：灰度（`filter: grayscale(1) opacity(.45)`）+ 虚线边框 + 进度 `2/4`
- 已解锁：彩色 + `--sh-glow` + 首次解锁播「旋转 360° 收束 → 光晕绽放 300ms」
- 60×60 / 80×80 / 104×104 三档；圆形徽章内是 emoji 或 SVG 图标

### 4.6 QuestList.vue

```ts
interface Props { quests: Quest[]; type: 'daily' | 'weekly'; resetAt?: number }
// emit: claim(questId), claim-all
```

- 行结构：`状态勾 | 标题 | 进度 (1/3) | 奖励（+30 积分）`
- 完成但未领取：整行 `bg-amber-50` + 「领取」脉冲按钮；已领取：`.6` 透明 + 灰勾
- 顶部进度条 + 「完成度 2/4」+ 倒计时（`tabular-nums`，每秒刷新，卸载时清 timer）

### 4.7 RankingBoard.vue

```ts
interface Props { items: RankingItem[]; mode: 'points'|'pvp'|'class'; myId?: string }
// emit: tab-change(mode)
```

- 前三名：金/银/铜渐变大号 + 皇冠（🥇🥈🥉）；4 名以后常规行
- 我的那一行：`bg-primary/10` + 左侧 4px primary 竖条，并 `sticky bottom-0` 固定在列表底部（长列表不丢自己）
- 空榜：EmptyState「还没有人上榜，做第一个吧」

### 4.8 BattleAnimation.vue

命令式 API，供 `Battle.vue` 直接调用，不侵入现有 PixiJS 逻辑：

```ts
// useBattleAnimation() → { play(type): Promise<void> }
type EffectType = 'hit' | 'crit' | 'miss' | 'heal' | 'shield' | 'buff' | 'switch' | 'skill'
```

| 类型 | 表现 | 时长 |
|---|---|---|
| hit | 受击方抖动 3px + 白闪 1 帧 | 200ms |
| crit | 抖动 6px + 红闪 + 屏幕轻微缩放 1.02 + 伤害数字放大 1.4 | 300ms |
| miss | 受击方变半透明 + 虚影右移 12px 淡出 | 240ms |
| heal | 绿色上浮粒子 + 数字绿色上飘 | 500ms |
| shield | 半透明六边形描边由中心扩出 | 320ms |
| switch | 原宠缩小淡出 → 新宠从下方弹入（`--e-back`） | 400ms |

> 这些效果全部用 DOM 覆盖层实现，**不改 PixiJS 渲染管线**，后续 KIMI/Qoder 换引擎也不受影响。

---

## 5. 页面骨架与响应式（模块 3）

### 5.1 网格规则

| 断点 | 宽度 | 列数 | 说明 |
|---|---|---|---|
| 手机 | < 640px | 1（列表）/ 2（宫格） | 底部 Tab 导航，操作按钮 ≥44px |
| 平板 | 640–1024px | 2 / 3 | 顶部导航，模态居中 |
| 桌面 | ≥ 1024px | 4 / 5 | 左侧边栏 + 内容区，最大宽 1280px 居中 |

战斗页特殊：`< 900px` 用竖屏布局（现状）；`≥ 900px` 切横版 16:9（双方分屏左右，操作区在下方通栏）。

### 5.2 学生首页 Dashboard.vue

```
┌───────────────────────────────────────┐
│ 👤 学号 20260112 · 李四    ⭐ 1,250    │ ← 顶部信息条（sticky，玻璃拟态）
├───────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐             │
│  │ 🐾 我的  │  │ ⚔️ 开始  │             │  ← 2×2 大按钮（移动端）
│  │   宠物   │  │   战斗   │             │
│  └─────────┘  └─────────┘             │
│  ┌─────────┐  ┌─────────┐             │
│  │ 🛒 商城  │  │ 🏆 排行榜│             │
│  └─────────┘  └─────────┘             │
├───────────────────────────────────────┤
│ 当前出战：焰尾狐 Lv.5 · 觉醒3阶        │ ← 常驻卡片（点击进详情）
├───────────────────────────────────────┤
│ 最近积分变动                           │
│  ├ 回答问题        +3   10:24          │
│  ├ 作业优秀        +5   昨天           │
│  └ 迟到            -1   昨天           │
└───────────────────────────────────────┘
```

桌面：4 个大按钮一行；左下「我的战力/队伍」卡，右侧「积分变动」时间线。

### 5.3 其余 7 页骨架（要点）

| 页面 | 关键区块 | 响应式要点 |
|---|---|---|
| PetDetail | 大图（含觉醒特效+光晕背景）→ 属性 4 宫格 → 皮肤条 → 技能列表 → 底部操作条 | 桌面左右分栏 3:2；操作条移动端吸底 |
| Shop | 积分头 → 分类 Tab（道具/宠物蛋/皮肤）→ 宫格 | 宫格 2/3/4 列；价格按 G6/G7 自动换算 |
| Gacha | 积分头 → 3 个蛋卡（普通/稀有/传说，逐档光效递增）→ 单抽 / 10 连 | 蛋卡移动端横滑轮播 |
| Achievements | 总进度环 → 分类 Tab → 徽章宫格 | 徽章 3/4/6 列 |
| Quests | 每日卡 + 每周卡（各带倒计时） | 桌面双列并排 |
| Ranking | 顶部 3 Tab → 前三名领奖台 → 列表（自己 sticky） | 领奖台移动端压缩为 3 列小卡 |
| ClassBattle | 班级 VS 头图 → 比分条（双色对抗）→ 我的贡献 → 剩余次数 → 开战 | 比分行用对角切分双色块，移动端纵向 |

### 5.4 统一交互细节

- 所有按钮：按下 `scale(.97)` 120ms；禁用 `opacity:.5` + `cursor-not-allowed`
- 金额/积分变化：数字滚动 300ms（`tabular-nums` 防抖位置跳动）
- 列表空态：统一 `EmptyState`（图标 + 一句人话 + 主按钮）
- 加载：骨架屏（`shimmer`，shimmer 关键帧已有）；宠物图加载用现有 `PetLoading.vue`

---

## 6. 与现有代码的接入方案

```
src/
├── styles/
│   ├── tokens.css        # §2 全部令牌（新）
│   └── effects.css       # §3 觉醒/皮肤/战斗/抽卡特效（新，纯 CSS）
├── data/
│   └── elements.ts       # 6 属性色/图标映射（新，从 Battle.vue 抽出）
├── components/
│   ├── pet/PetCard.vue  AwakeningEffect.vue  SkinPreview.vue
│   ├── gacha/GachaAnimation.vue
│   └── game/AchievementBadge.vue  QuestList.vue  RankingBoard.vue  BattleAnimation.vue
└── pages/
    └── Dashboard.vue  PetDetail.vue  Shop.vue  Gacha.vue
        Achievements.vue  Quests.vue  Ranking.vue  ClassBattle.vue
```

**接入顺序（不破坏现有功能）：**

1. 先加 `tokens.css` + `effects.css`（纯新增，零风险）
2. 再做 `AwakeningEffect` + `PetCard`，先在 `/preview` 页试装
3. `Battle.vue` 只做两处轻改：属性色改用 `elements.ts`；接入 `BattleAnimation` 覆盖层
4. `Home.vue` 顶部导航加一个「我的宠物园 / 学生视角」入口，跳 `Dashboard`
5. 新页面路由：`/dashboard` `/pet/:id` `/shop` `/gacha` `/achievements` `/quests` `/ranking` `/class-battle`

---

## 7. 性能与可访问性硬指标

| 项 | 指标 |
|---|---|
| 帧率 | 安卓中端机（骁龙 6 系）特效期间 ≥30fps，桌面 ≥55fps |
| 首屏 | 新增 CSS ≤ 18KB（未压缩），无新增图片资源 |
| 主线程 | 无 `setInterval` 驱动的动画（倒计时除外，1s 间隔） |
| 降级 | `prefers-reduced-motion: reduce` → 关闭粒子/旋转/闪烁，保留静态光环；低端机粒子减半 |
| 对比度 | 正文 ≥4.5:1，大字号 ≥3:1；金色文字仅用于 ≥18px 粗体 |
| 触控 | 所有可点区域 ≥44×44px |
| 键盘 | 卡片/徽章/列表行可 Tab 聚焦，`:focus-visible` 2px primary 外描边 |

---

## 8. 里程碑

| 阶段 | 内容 | 产出 |
|---|---|---|
| M1（2 天） | 令牌 + 特效层 + `AwakeningEffect` / `PetCard` / `AchievementBadge` | 可在 `/preview` 看到 |
| M2（3 天） | `GachaAnimation` / `QuestList` / `RankingBoard` / `BattleAnimation` + 学生端 4 页 | `Dashboard`/`Gacha`/`Quests`/`Ranking` 可跑 |
| M3（3 天） | `SkinPreview` + 剩余页面 + 响应式打磨 + 降级策略验证 | 全部 8 页 |

每阶段提交到 `dev-dsh`，提交信息用 `style(awakening): …` / `feat(pet-card): …` 格式。

---

## 9. 待你确认的 7 件事

| 编号 | 问题 | 我的推荐 |
|---|---|---|
| **D1** | 觉醒色相：整体 `hue-rotate`（提示词原方案）还是「本体不变色 + 外发光变色」（§3 方案） | **双通道**，理由是宠物识别度 |
| D2 | 6★ 演出：彩虹流光 vs 单色金光 | **彩虹流光**。传说蛋 70% 出 6★，单色金会迅速廉价化 |
| D3 | 两套宠物体系（26 只/7 级 vs 6 只属性/觉醒）如何呈现 | **分轨**：养成轨用 26 只，对战轨用 6 只，UI 上不混排 |
| D4 | 抽卡演出 2.4s 是否允许跳过 | **800ms 后可跳过**，避免 10 连抽时等待过长 |
| D5 | 战斗页移动端：竖屏优先 vs 强制横屏 | **竖屏优先**（现状如此，学生单手可玩） |
| D6 | 令牌层：CSS 变量 vs 直接写 Tailwind 类 | **CSS 变量**（觉醒/星级参数要动态改，直接写类无法插值） |
| D7 | 编码顺序：先组件库还是先特效层 | **先特效层**（`effects.css` 是组件的依赖） |

> 确认方式：直接回复「D1 选双通道，D2 彩虹，其余按推荐」这类即可。确认后我按 M1 开始编码，先给你 `/preview` 页的实物效果。
