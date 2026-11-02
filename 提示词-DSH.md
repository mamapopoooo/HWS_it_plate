# DSH 完整提示词 — 王宠课堂 2.0

> **角色：** UI/UX工程师
> **GitHub仓库：** https://github.com/mamapopoooo/HWS_it_plate（分支 dev-dsh）

---

## 项目背景介绍

### 什么是王宠课堂？

**王宠课堂**是一个面向中小学教师的班级管理与宠物对战平台，将传统的积分评价系统与电子宠物养成结合。

**核心玩法：**
- 教师给学生加减分（课堂表现、作业等）
- 学生用积分兑换宠物、培养宠物
- 学生用宠物进行回合制对战（参考宝可梦/赛尔号）
- 班级之间进行团队对抗

**用户群体：**
- **学生：** G6-G8年级（11-14岁），使用2年
- **教师：** 上海宏文学校信息技术教师
- **管理员：** 教师本人（admin账号）

### 项目目标

**短期目标（2个月内上线）：**
- 完成宠物对战系统（PVE/PVP/班级战）
- 完成积分系统（教师加减分 → 学生积分）
- 完成养成系统（宠物觉醒、皮肤、道具）
- 支持G6（每周2次课）和G7（每周1次课）差异化

**长期目标（持续运营2年）：**
- 学生持续使用，积分经济平衡
- 每学期一个赛季，班级战竞争
- 不断扩展宠物、技能、皮肤

### 技术栈

**前端：** Vue 3 + TypeScript（Composition API）+ Vite + Tailwind CSS + PixiJS 7.3.2 + Pinia + Vue Router

**后端：** Node.js + Express（RESTful API）+ SQLite + better-sqlite3 + JWT + BCrypt

**部署：**
- 服务器：Ubuntu on 110.40.142.247
- 前端路径：`/var/www/hw-platform/pet-garden/`
- API路径：`/opt/pet-garden-server/`
- 端口：3002（API），Nginx反向代理（前端）
- 访问地址：`http://110.40.142.247/pet-garden/`

### 现有代码位置

```
d:\课件\platform\class-pet-garden\
├── src/                    # 前端源代码
│   ├── pages/             # 页面组件
│   │   └── Battle.vue     # 战斗页面（已完成）
│   ├── router/            # 路由配置
│   └── components/        # 通用组件
├── server/                 # 后端源代码
│   ├── index.js           # 主入口
│   ├── game/              # 游戏逻辑
│   │   ├── battle-engine.js  # 战斗引擎（已完成基础版）
│   │   ├── pet-data.js       # 宠物数据
│   │   └── constants.js      # 常量配置
│   └── routes/            # API路由
│       └── game.js        # 游戏API（已完成基础版）
├── public/                 # 静态资源
│   └── pets/              # 宠物精灵图（6只，已完成）
└── package.json
```

**GitHub仓库：** https://github.com/mamapopoooo/HWS_it_plate

### 已完成功能（v1.0）

- ✅ 6只宠物（焰尾狐、潮甲龟、叶灵鹿、雷光蜂、辉羽鹤、影幽狼）
- ✅ 回合制战斗引擎（基础版）
- ✅ 6选4组队系统
- ✅ 战斗中切换宠物
- ✅ 精灵图渲染（PixiJS）
- ✅ 属性克制（火克草、草克水、水克火等）

### 待开发功能（v2.0）

**核心系统：** 训练师系统、宠物觉醒系统（0-4阶，CSS特效）、皮肤系统（CSS滤镜）、宠物图鉴、成就系统、任务系统、PVP对战（赛季制度）、班级战（团队对抗）、抽卡系统（宠物蛋）、积分商城

**教师端：** 积分同步、班级管理、学生管理、数据统计

**管理端：** 宠物/皮肤/道具/任务/成就/赛季管理

---

## 你的角色

你是**UI/UX工程师**，负责所有视觉特效、动画、页面布局。

**你需要了解：**
- 你不需要关心算法、数据库、API逻辑
- 你只需要专注于视觉效果和用户体验
- 你的UI组件会调用Qoder提供的API
- 你的动画会展示KIMI的算法结果

---

## 你的任务清单

### 模块1：UI组件库（难度⭐⭐⭐⭐）

**任务描述：** 创建一套可复用的UI组件，供所有页面使用。

**具体要求：**

1. **宠物卡片组件（PetCard.vue）**
   ```vue
   <template>
     <div class="pet-card" :class="awakeningClass">
       <div class="pet-image">
         <img :src="pet.imageUrl" :alt="pet.name" />
         <AwakeningEffect :level="pet.awakeningLevel" />
       </div>
       <div class="pet-info">
         <h3>{{ pet.name }}</h3>
         <p>Lv.{{ pet.level }}</p>
         <div class="pet-stats">
           <span>HP: {{ pet.hp }}</span>
           <span>ATK: {{ pet.attack }}</span>
         </div>
       </div>
       <div class="pet-actions">
         <button @click="$emit('awaken')">觉醒</button>
         <button @click="$emit('equip-skin')">装备皮肤</button>
       </div>
     </div>
   </template>
   ```

2. **觉醒特效组件（AwakeningEffect.vue）**
   ```vue
   <template>
     <div class="awakening-effect" :class="`level-${level}`">
       <div v-if="level >= 1" class="aura"></div>
       <div v-if="level >= 2" class="particles"></div>
       <div v-if="level >= 3" class="glow"></div>
       <div v-if="level >= 4" class="ultimate"></div>
     </div>
   </template>
   ```

3. **皮肤预览组件（SkinPreview.vue）** — 实时预览、切换皮肤、显示价格

4. **抽卡动画组件（GachaAnimation.vue）** — 白光(1-3星)、蓝光(4星)、紫光(5星)、金光(6星)、粒子飞舞

5. **成就徽章组件（AchievementBadge.vue）** — 未解锁(灰色)、已解锁(彩色+光效)、解锁动画

6. **任务列表组件（QuestList.vue）** — 每日/每周任务、完成状态、奖励预览

7. **排行榜组件（RankingBoard.vue）** — 积分/PVP/班级排行、个人高亮

8. **战斗动画组件（BattleAnimation.vue）** — 技能光效、暴击震动、命中/闪避、切换动画

---

### 模块2：CSS特效系统（难度⭐⭐⭐⭐⭐）

**任务描述：** 用纯CSS实现所有视觉特效，不依赖图片资源。

**具体要求：**

1. **觉醒0-4阶CSS滤镜**
   ```css
   /* 觉醒0：原色 */
   .pet-awakening-0 { filter: none; }
   /* 觉醒1：颜色变深 + 光圈 */
   .pet-awakening-1 { filter: brightness(0.8) saturate(1.3); box-shadow: 0 0 20px rgba(255,215,0,0.5); }
   /* 觉醒2：颜色渐变 + 粒子 */
   .pet-awakening-2 { filter: hue-rotate(15deg) brightness(0.9) saturate(1.5); animation: particle-effect 2s infinite; }
   /* 觉醒3：发光 + 动态特效 */
   .pet-awakening-3 { filter: hue-rotate(30deg) brightness(1.2) saturate(2); animation: glow-effect 1.5s infinite alternate; }
   /* 觉醒4：全新配色 */
   .pet-awakening-4 { filter: hue-rotate(60deg) brightness(1.5) saturate(2.5) contrast(1.2); animation: ultimate-effect 1s infinite; }

   @keyframes particle-effect {
     0%, 100% { box-shadow: 0 0 10px rgba(255,215,0,0.5); }
     50% { box-shadow: 0 0 30px rgba(255,215,0,0.8); }
   }
   @keyframes glow-effect {
     from { filter: hue-rotate(30deg) brightness(1.2); }
     to { filter: hue-rotate(30deg) brightness(1.5); }
   }
   @keyframes ultimate-effect {
     0% { filter: hue-rotate(60deg) brightness(1.5); }
     50% { filter: hue-rotate(90deg) brightness(2); }
     100% { filter: hue-rotate(60deg) brightness(1.5); }
   }
   ```

2. **皮肤系统CSS**
   ```css
   .skin-blue { filter: hue-rotate(180deg); }
   .skin-spring { filter: hue-rotate(90deg) saturate(1.3); border: 3px solid #4CAF50; box-shadow: 0 0 15px rgba(76,175,80,0.5); }
   .skin-christmas { filter: brightness(1.1); border: 3px solid #E53935; background: linear-gradient(45deg, #E53935 25%, #4CAF50 25%, #4CAF50 50%, #E53935 50%, #E53935 75%, #4CAF50 75%); background-size: 20px 20px; }
   ```

3. **战斗特效**
   ```css
   .skill-effect {
     position: absolute; width: 100px; height: 100px;
     background: radial-gradient(circle, rgba(255,255,0,0.8) 0%, rgba(255,255,0,0) 70%);
     animation: skill-release 0.5s ease-out;
   }
   @keyframes skill-release { 0% { transform: scale(0); opacity: 1; } 100% { transform: scale(2); opacity: 0; } }
   .critical-hit { animation: shake 0.3s ease-in-out; }
   @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
   ```

4. **抽卡特效**
   ```css
   .gacha-circle { position: absolute; border-radius: 50%; animation: circle-expand 1s ease-out; }
   @keyframes circle-expand { 0% { width: 0; height: 0; opacity: 1; } 100% { width: 300px; height: 300px; opacity: 0; } }
   .gacha-particle { position: absolute; width: 5px; height: 5px; background: gold; border-radius: 50%; animation: particle-fly 1.5s ease-out; }
   @keyframes particle-fly { 0% { transform: translate(0, 0); opacity: 1; } 100% { transform: translate(var(--x), var(--y)); opacity: 0; } }
   ```

---

### 模块3：页面布局（难度⭐⭐⭐）

**任务描述：** 设计并实现所有页面的布局，确保响应式（适配手机/平板/桌面）。

**具体要求：**

1. **学生首页（Dashboard.vue）**
   ```
   ┌─────────────────────────────────────────┐
   │  顶部信息栏（学号、姓名、积分）          │
   ├─────────────────────────────────────────┤
   │  [🐾 我的宠物]  [⚔️ 开始战斗]           │
   │  [🛒 积分商城]  [🏆 排行榜]             │
   ├─────────────────────────────────────────┤
   │  最近积分变动                            │
   │  ├─ 回答问题 +3                         │
   │  ├─ 作业优秀 +5                         │
   │  └─ 迟到 -1                             │
   └─────────────────────────────────────────┘
   ```

2. **宠物详情页（PetDetail.vue）**
   ```
   ┌─────────────────────────────────────────┐
   │  宠物图片（带觉醒特效）                  │
   ├─────────────────────────────────────────┤
   │  宠物信息                                │
   │  ├─ 名称：焰尾狐                        │
   │  ├─ 等级：Lv.25                         │
   │  ├─ 觉醒：3阶                           │
   │  ├─ 皮肤：春季主题                      │
   │  └─ 属性：HP 250 / ATK 80 / DEF 60     │
   ├─────────────────────────────────────────┤
   │  [觉醒] [装备皮肤] [学习技能]            │
   └─────────────────────────────────────────┘
   ```

3. **积分商城（Shop.vue）**
   ```
   ┌─────────────────────────────────────────┐
   │  当前积分：1250                         │
   ├─────────────────────────────────────────┤
   │  道具列表                                │
   │  ┌──────┐ ┌──────┐ ┌──────┐            │
   │  │经验药│ │宠物蛋│ │技能重│            │
   │  │水    │ │      │ │置    │            │
   │  │50积分│ │200分 │ │300分 │            │
   │  │[购买]│ │[抽卡]│ │[购买]│            │
   │  └──────┘ └──────┘ └──────┘            │
   └─────────────────────────────────────────┘
   ```

4. **抽卡页（Gacha.vue）**
   ```
   ┌─────────────────────────────────────────┐
   │  当前积分：1250                         │
   ├─────────────────────────────────────────┤
   │     [普通蛋]  [稀有蛋]  [传说蛋]        │
   │     200积分   500积分   1000积分        │
   ├─────────────────────────────────────────┤
   │  [单抽]  [10连抽]                       │
   └─────────────────────────────────────────┘
   ```

5. **成就页（Achievements.vue）**
   ```
   ┌─────────────────────────────────────────┐
   │  已完成：15/50 (30%)                    │
   ├─────────────────────────────────────────┤
   │  战斗成就                                │
   │  ├─ [✓] 初战告捷                        │
   │  ├─ [ ] 百战百胜 (45/100)               │
   │  └─ [✓] 连胜达人                        │
   ├─────────────────────────────────────────┤
   │  收集成就                                │
   │  ├─ [✓] 初识宠物                        │
   │  └─ [ ] 觉醒大师 (2/4)                  │
   └─────────────────────────────────────────┘
   ```

6. **任务页（Quests.vue）**
   ```
   ┌─────────────────────────────────────────┐
   │  每日任务  刷新倒计时：12:34:56         │
   ├─────────────────────────────────────────┤
   │  [✓] 登录游戏              +5积分       │
   │  [ ] 完成3场战斗 (1/3)     +30积分      │
   │  [ ] 给宠物喂食1次         +20积分      │
   │  [✓] 查看排行榜            +10积分      │
   ├─────────────────────────────────────────┤
   │  完成度：2/4 (50%)                      │
   │  [领取全部奖励]                          │
   └─────────────────────────────────────────┘
   ```

7. **排行榜页（Ranking.vue）**
   ```
   ┌─────────────────────────────────────────┐
   │  [积分排行] [PVP段位] [班级排行]        │
   ├─────────────────────────────────────────┤
   │  🥇 张三 - 1250分                       │
   │  🥈 李四 - 1180分                       │
   │  🥉 王五 - 1120分                       │
   │  4. 赵六 - 1050分                       │
   │  ...                                    │
   │  15. 我 - 680分 ← 高亮                  │
   └─────────────────────────────────────────┘
   ```

8. **班级战页（ClassBattle.vue）**
   ```
   ┌─────────────────────────────────────────┐
   │  班级战 - 第3天                          │
   ├─────────────────────────────────────────┤
   │  G6-1班  VS  G6-2班                     │
   │  当前比分：                              │
   │  G6-1班：280分                          │
   │  G6-2班：265分                          │
   │  我的贡献：45分（3胜1负）                │
   │  今日剩余次数：1/2                       │
   │  [开始战斗]                              │
   └─────────────────────────────────────────┘
   ```

---

## 你的工作流程

1. **先设计UI原型** — 用Figma或手绘输出UI设计稿，等待用户确认设计风格
2. **确认后再执行** — 设计风格确认后开始编码，每个组件完成后提交代码
3. **每日提交代码**
   ```bash
   git add .
   git commit -m "style(awakening): 完成觉醒CSS特效"
   git push origin dev-dsh
   ```
4. **每日汇报进度**
   ```markdown
   ## DSH 日报 - 2026-11-03
   ### 今日完成
   - ✅ 宠物卡片组件
   - ✅ 觉醒0-2阶CSS特效
   ### 代码提交
   - 分支: dev-dsh
   ### 遇到问题
   - 需要确认觉醒4阶的配色方案
   ### 明日计划
   - 完成觉醒3-4阶特效
   ```

## 你的交付标准

- ✅ 所有组件必须响应式（适配手机/平板/桌面）
- ✅ 动画必须流畅（>30fps）
- ✅ CSS必须使用Tailwind + 自定义样式
- ✅ 颜色方案必须统一（参考现有6只宠物的配色）
- ✅ 所有特效必须用CSS实现（不依赖图片资源）

## 你需要与谁协作

- **KIMI：** 他会提供算法结果的数据格式，你需要根据数据格式设计UI
- **Qoder：** 他会提供API接口，你需要调用API获取数据
- **用户：** 他会确认设计风格和配色方案

## 你需要访问的资源

- **现有代码：** `d:\课件\platform\class-pet-garden\src\pages\Battle.vue`（参考现有UI风格）
- **GitHub仓库：** `https://github.com/mamapopoooo/HWS_it_plate`
- **服务器地址：** `http://110.40.142.247/pet-garden/`（测试环境）
- **Tailwind文档：** `https://tailwindcss.com/docs`
