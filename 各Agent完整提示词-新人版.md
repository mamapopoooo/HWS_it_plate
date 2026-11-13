# 墨境 2.0 - 各Agent完整提示词（新人版）

> **状态：历史文件（v2 内容）。** 2026-11-04 起 v3 已全面落地，本文件正文只作背景参考，**不要照着做**。
> 各 Agent 的现行提示词见：`提示词-KIMI.md`、`提示词-DSH.md`，以及 `docs/品阶体系改造-各Agent同步清单.md`。

---

> ## ⚠️ 先读这段：v3 现状（2026-11-04）
>
> 宠物体系已改为「**8 卦属性 + 五阶品阶 + 中国风水墨**」，并且**前端 14 个页面已全部实现**。
> 本文件中与 **属性、稀有度、宠物皮肤、排行榜、经济数值、页面清单** 相关的描述**已过时**。
>
> **现行结论：**
>
> - 五阶：**无极（隐藏/学生自造）> 太极（阴阳鱼）> 四象（四方神兽）> 八卦（八属之灵）> 万象（山海异兽）**
> - 属性：**乾 坤 震 巽 坎 离 艮 兑**；克制为**对宫互冲 ×1.3（双向）** —— 旧的「被克 ×0.77」已废弃（对宫互指，那条分支不可达）
> - 成长三轴：**品阶**（物种定死）+ **等级** Lv.1–7 + **觉醒**（上限随品阶递增，形态 = 觉醒 + 1）
> - **宠物皮肤已删除**，装饰迁到**角色端**（男女各一套基础形象）
> - 最高阶「无极」= 学生**自创造物**（立绘 + 效果池技能），**教师审核**，每人 1 只
> - 经济：单一货币「积分」，单抽 5 分、十连 45；**G6 系数 1.0 / G7 系数 0.6**，排行榜与对战按年级分组
> - **v1 已下线**：`Home.vue`、`PetPreview.vue`、旧 `Battle.vue` 与 26 只现代宠物数据均已删除；`/` → `/lobby`，`/battle` → `/duel`
>
> **权威文件（冲突时以此为准）：**
> - 架构基线：[`docs/00-总纲-架构基线与内容扩展规范.md`](docs/00-总纲-架构基线与内容扩展规范.md)
> - 各 Agent 改什么 + 接口字段：[`docs/品阶体系改造-各Agent同步清单.md`](docs/品阶体系改造-各Agent同步清单.md)
> - 视觉与美术：[`docs/品阶体系-v3-中国风设计规范.md`](docs/品阶体系-v3-中国风设计规范.md)
> - 视觉稿：[`docs/design-preview-v3.html`](docs/design-preview-v3.html)
> - 入场指南：[`AGENTS.md`](AGENTS.md)
>
> **最重要的一条：** 新增宠物 / 活动 / 皮肤 / 任务 / 成就 / 品阶 / 排行榜，**一律靠插数据行完成**，
> 不许写死在代码里（见总纲 §10 扩展点清单）。

---

## 📖 项目背景介绍（所有Agent必读）


### 1. 什么是墨境？

**墨境**是一个面向中小学教师的班级管理与宠物对战平台，将传统的积分评价系统与电子宠物养成结合。

**核心玩法：**
- 教师给学生加减分（课堂表现、作业等）
- 学生用积分兑换宠物、培养宠物
- 学生用宠物进行回合制对战（参考宝可梦/赛尔号）
- 班级之间进行团队对抗

**用户群体：**
- **学生：** G6-G8年级（11-14岁），使用2年
- **教师：** 上海宏文学校信息技术教师（就是你）
- **管理员：** 教师本人（admin账号）

### 2. 项目目标

**短期目标（2个月内上线）：**
- 完成宠物对战系统（PVE/PVP/班级战）
- 完成积分系统（教师加减分 → 学生积分）
- 完成养成系统（宠物觉醒、皮肤、道具）
- 支持G6（每周2次课）和G7（每周1次课）差异化

**长期目标（持续运营2年）：**
- 学生持续使用，积分经济平衡
- 每学期一个赛季，班级战竞争
- 不断扩展宠物、技能、皮肤

### 3. 技术栈

**前端：**
- Vue 3 + TypeScript（Composition API）
- Vite（构建工具）
- Tailwind CSS（样式框架）
- PixiJS 7.3.2（战斗动画渲染）
- Pinia（状态管理）
- Vue Router（路由管理）

**后端：**
- Node.js + Express（RESTful API）
- SQLite + better-sqlite3（轻量级数据库）
- JWT（身份认证）
- BCrypt（密码加密）

**部署：**
- 服务器：Ubuntu on 110.40.142.247
- 前端路径：`/var/www/hw-platform/pet-garden/`
- API路径：`/opt/pet-garden-server/`
- 端口：3002（API），Nginx反向代理（前端）
- 访问地址：`http://110.40.142.247/pet-garden/`

### 4. 现有代码位置

**本地开发目录：**
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
│       ├── pet_fire_fox/  # 焰尾狐
│       ├── pet_water_turtle/  # 潮甲龟
│       ├── pet_grass_deer/  # 叶灵鹿
│       ├── pet_electric_bee/  # 雷光蜂
│       ├── pet_light_crane/  # 辉羽鹤
│       └── pet_dark_wolf/  # 影幽狼
└── package.json
```

**GitHub仓库：**
- 地址：`https://github.com/mamapopoooo/class-pet-garden`
- 当前分支：`master`（已有基础功能）
- 开发分支：`dev`（2.0版本开发）

### 5. 已完成功能（v1.0）

- ✅ 6只宠物（焰尾狐、潮甲龟、叶灵鹿、雷光蜂、辉羽鹤、影幽狼）
- ✅ 回合制战斗引擎（基础版）
- ✅ 6选4组队系统
- ✅ 战斗中切换宠物
- ✅ 精灵图渲染（PixiJS）
- ✅ 属性克制（火克草、草克水、水克火等）

### 6. 待开发功能（v2.0）

**核心系统：**
- 训练师系统（玩家等级、经验、称号）
- 宠物觉醒系统（0-4阶，CSS特效替代进化）
- 皮肤系统（纯装饰，CSS滤镜实现）
- 宠物图鉴（收集驱动）
- 成就系统（长期目标）
- 任务系统（每日/每周引导）
- PVP对战（赛季制度）
- 班级战（团队对抗）
- 抽卡系统（宠物蛋）
- 积分商城（道具兑换）

**教师端：**
- 积分同步（教师端Python程序 → 网页端API）
- 班级管理
- 学生管理
- 数据统计

**管理端：**
- 宠物模板管理
- 皮肤管理
- 道具管理
- 任务/成就管理
- 赛季管理

---

## 👨‍💻 KIMI 完整提示词

### 你的角色

你是**核心算法工程师**，负责难度最高的战斗引擎、PVP匹配、数值平衡等核心模块。

**你需要了解：**
- 你不需要关心UI、数据库、API接口
- 你只需要专注于算法和逻辑
- 你的代码会被Qoder集成到API中
- 你的算法会被DSH用UI展示

### 你的任务清单

#### 模块1：战斗引擎核心（难度⭐⭐⭐⭐⭐）

**任务描述：**
实现一个完整的回合制战斗系统，参考宝可梦/赛尔号的战斗逻辑。

**具体要求：**

1. **战斗状态机**
   ```typescript
   enum BattleStatus {
     WAITING = 'waiting',           // 等待开始
     ACTIVE = 'active',             // 战斗进行中
     SWITCH_REQUIRED = 'switch_required', // 需要切换宠物
     FINISHED = 'finished'          // 战斗结束
   }
   ```

2. **技能效果处理器**
   - 伤害技能：基础威力 × 属性克制 × 暴击倍率
   - 治疗技能：恢复HP（固定值或百分比）
   - 护盾技能：吸收伤害（固定值或百分比）
   - BUFF技能：提升属性（攻击/防御/速度，持续N回合）
   - DEBUFF技能：降低属性（攻击/防御/速度，持续N回合）
   - 控制技能：眩晕/冰冻/麻痹（跳过N回合）
   - 闪避技能：提升闪避率（N%概率躲避攻击）

3. **属性克制系统**
   ```typescript
   const ELEMENT_ADVANTAGE = {
     fire: ['grass'],      // 火克草
     water: ['fire'],      // 水克火
     grass: ['water'],     // 草克水
     electric: ['water'],  // 电克水
     light: ['dark'],      // 光克暗
     dark: ['light']       // 暗克光
   }
   
   function getElementCoefficient(attacker: string, defender: string): number {
     if (ELEMENT_ADVANTAGE[attacker]?.includes(defender)) return 1.25
     if (ELEMENT_ADVANTAGE[defender]?.includes(attacker)) return 0.8
     return 1.0
   }
   ```

4. **速度排序算法**
   - 比较双方宠物的速度属性
   - 速度高者先手
   - 优先级技能（如"先制之爪"）无视速度
   - 同速度时随机决定先后手

5. **暴击/闪避/命中计算**
   ```typescript
   function calculateHit(attacker: Fighter, defender: Fighter): boolean {
     const hitRate = attacker.accuracy - defender.dodgeChance
     return Math.random() * 100 < hitRate
   }
   
   function calculateCrit(attacker: Fighter): boolean {
     return Math.random() * 100 < attacker.critRate
   }
   ```

6. **状态效果叠加与冲突处理**
   - 同类型状态效果不叠加（取最高值）
   - 不同类型状态效果可共存（如灼烧+冰冻）
   - 状态效果每回合结束递减持续时间
   - 某些状态互斥（如冰冻和灼烧不能同时存在）

7. **战斗日志生成**
   ```typescript
   interface BattleLog {
     turn: number
     actions: ActionLog[]
   }
   
   interface ActionLog {
     actor: 'A' | 'B'
     pet: string
     skill: string
     target: string
     damage?: number
     heal?: number
     isCrit?: boolean
     elementCoeff?: number
     effects?: string[]
     message: string
   }
   ```

**交付物：**
```typescript
// src/engine/BattleEngine.ts
export class BattleEngine {
  constructor(state: BattleState)
  init(): BattleState
  executeTurn(actionA: Action, actionB: Action): TurnResult
  switchPet(side: 'A' | 'B', petIndex: number): boolean
  executeSkill(actor: Fighter, target: Fighter, skillId: string): ActionResult
}

// src/engine/SkillProcessor.ts
export class SkillProcessor {
  processDamage(actor: Fighter, target: Fighter, skill: Skill): DamageResult
  processHeal(actor: Fighter, skill: Skill): HealResult
  processShield(actor: Fighter, skill: Skill): ShieldResult
  processBuff(actor: Fighter, skill: Skill): BuffResult
  processDebuff(target: Fighter, skill: Skill): DebuffResult
  processCC(target: Fighter, skill: Skill): CCResult
}

// src/engine/ElementSystem.ts
export class ElementSystem {
  getCoefficient(attacker: string, defender: string): number
  getAdvantage(element: string): string[]
  getDisadvantage(element: string): string[]
}

// src/engine/PVPMatcher.ts
export class PVPMatcher {
  calculateELO(winnerRating: number, loserRating: number): { newWinnerRating: number, newLoserRating: number }
  matchPlayer(player: Player, candidates: Player[]): Player | null
  preventSmurf(player: Player, opponent: Player): boolean
}

// src/engine/BalanceCalculator.ts
export class BalanceCalculator {
  calculatePetStats(level: number, baseStats: BaseStats): Stats
  calculateAwakeningBonus(awakeningLevel: number, baseStats: Stats): Stats
  calculateSkillDamage(attacker: Fighter, target: Fighter, skill: Skill): number
  calculatePrice(basePrice: number, grade: number): number
}

// src/engine/GachaSystem.ts
export class GachaSystem {
  draw(eggType: 'normal' | 'rare' | 'legendary'): GachaResult
  checkPity(pityCount: number, eggType: string): { guaranteed: boolean, rarity: number }
  generateResult(probabilities: Probability[]): GachaResult
}
```

**测试要求：**
- 所有算法必须有单元测试（Jest）
- 战斗引擎测试：1000次模拟战斗，验证数值平衡
- PVP匹配测试：100个玩家模拟匹配，验证ELO计算
- 抽卡测试：10000次抽卡，验证概率和保底机制

#### 模块2：PVP匹配算法（难度⭐⭐⭐⭐⭐）

**任务描述：**
实现一个公平的PVP匹配系统，参考英雄联盟/王者荣耀的匹配机制。

**具体要求：**

1. **ELO积分计算**
   ```typescript
   const K_FACTOR = 32  // K因子（影响积分变化幅度）
   const INITIAL_RATING = 1000  // 初始积分
   
   function calculateELO(winnerRating: number, loserRating: number): {
     newWinnerRating: number
     newLoserRating: number
   } {
     const expectedWinner = 1 / (1 + Math.pow(10, (loserRating - winnerRating) / 400))
     const expectedLoser = 1 - expectedWinner
     
     const newWinnerRating = winnerRating + K_FACTOR * (1 - expectedWinner)
     const newLoserRating = loserRating + K_FACTOR * (0 - expectedLoser)
     
     return { newWinnerRating, newLoserRating }
   }
   ```

2. **段位系统**
   ```typescript
   enum Tier {
     BRONZE = 'bronze',       // 青铜：0-500分
     SILVER = 'silver',       // 白银：500-1000分
     GOLD = 'gold',           // 黄金：1000-1500分
     PLATINUM = 'platinum',   // 铂金：1500-2000分
     DIAMOND = 'diamond',     // 钻石：2000-2500分
     MASTER = 'master'        // 大师：2500+分
   }
   
   function getTier(rating: number): Tier {
     if (rating < 500) return Tier.BRONZE
     if (rating < 1000) return Tier.SILVER
     if (rating < 1500) return Tier.GOLD
     if (rating < 2000) return Tier.PLATINUM
     if (rating < 2500) return Tier.DIAMOND
     return Tier.MASTER
   }
   ```

3. **匹配逻辑**
   - 按段位匹配（青铜匹配青铜，白银匹配白银）
   - 积分相近优先（±200分以内）
   - 等待时间超过30秒，扩大匹配范围（±500分）
   - 防止重复匹配（24小时内不匹配同一人）

4. **防刷分机制**
   - 检测异常胜率（>80%触发人工审核）
   - 检测频繁匹配（同一对玩家24小时内最多匹配3次）
   - 检测积分异常波动（单场积分变化>100触发审核）

#### 模块3：数值平衡（难度⭐⭐⭐⭐）

**任务描述：**
设计整个游戏的数值体系，确保经济平衡、战斗公平。

**具体要求：**

1. **宠物属性成长曲线**
   ```typescript
   // Lv.1-50，每级+5%属性
   function calculatePetStats(level: number, baseStats: BaseStats): Stats {
     const multiplier = 1 + (level - 1) * 0.05
     return {
       hp: Math.floor(baseStats.hp * multiplier),
       attack: Math.floor(baseStats.attack * multiplier),
       defense: Math.floor(baseStats.defense * multiplier),
       speed: Math.floor(baseStats.speed * multiplier)
     }
   }
   ```

2. **觉醒属性加成**
   ```typescript
   // 0-4阶：+0%/+10%/+25%/+50%/+100%
   function calculateAwakeningBonus(awakeningLevel: number, baseStats: Stats): Stats {
     const bonuses = [0, 0.1, 0.25, 0.5, 1.0]
     const bonus = bonuses[awakeningLevel]
     return {
       hp: Math.floor(baseStats.hp * (1 + bonus)),
       attack: Math.floor(baseStats.attack * (1 + bonus)),
       defense: Math.floor(baseStats.defense * (1 + bonus)),
       speed: Math.floor(baseStats.speed * (1 + bonus))
     }
   }
   ```

3. **积分经济平衡**
   ```typescript
   // G6学生：每月获取1620-2860分
   // G7学生：每月获取1450-2670分
   // 消耗目标：每月消耗1400-3500分
   
   const ECONOMIC_BALANCE = {
     G6_MONTHLY_INCOME: { min: 1620, max: 2860 },
     G7_MONTHLY_INCOME: { min: 1450, max: 2670 },
     MONTHLY_EXPENSE: { min: 1400, max: 3500 }
   }
   ```

4. **价格公式**
   ```typescript
   // G6原价，G7打8折
   function calculatePrice(basePrice: number, grade: number): number {
     return grade === 7 ? Math.floor(basePrice * 0.8) : basePrice
   }
   ```

#### 模块4：班级战积分结算（难度⭐⭐⭐⭐）

**任务描述：**
实现班级战的积分结算算法，按贡献度分配奖励。

**具体要求：**

1. **贡献度计算**
   ```typescript
   function calculateContribution(
     studentScore: number,
     classTotalScore: number
   ): number {
     return studentScore / classTotalScore
   }
   ```

2. **奖励分配**
   ```typescript
   function calculateRewards(
     battle: ClassBattle,
     student: Student
   ): {
     baseReward: number
     contributionReward: number
     rankReward: number
     totalReward: number
   } {
     const isWinner = student.classId === battle.winnerClassId
     const contribution = calculateContribution(student.score, battle.classTotalScore)
     const rank = getStudentRank(battle.id, student.id)
     
     const baseReward = isWinner ? 200 : 50
     const contributionReward = Math.floor(contribution * 500)
     const rankReward = rank <= 3 ? 100 : 0
     
     return {
       baseReward,
       contributionReward,
       rankReward,
       totalReward: baseReward + contributionReward + rankReward
     }
   }
   ```

#### 模块5：抽卡概率算法（难度⭐⭐⭐）

**任务描述：**
实现抽卡系统的概率计算和保底机制。

**具体要求：**

1. **概率配置**
   ```typescript
   const GACHA_PROBABILITIES = {
     normal: {  // 普通蛋（200积分）
       1: 0.6,  // 60%概率出1星
       2: 0.3,  // 30%概率出2星
       3: 0.1   // 10%概率出3星
     },
     rare: {    // 稀有蛋（500积分）
       3: 0.4,  // 40%概率出3星
       4: 0.4,  // 40%概率出4星
       5: 0.2   // 20%概率出5星
     },
     legendary: {  // 传说蛋（1000积分）
       5: 0.3,     // 30%概率出5星
       6: 0.7      // 70%概率出6星
     }
   }
   ```

2. **保底机制**
   ```typescript
   const PITY_SYSTEM = {
     guaranteed4Star: 10,    // 10连必出4星
     guaranteed5Star: 50,    // 50连必出5星
     guaranteed6Star: 100    // 100连必出6星
   }
   
   function checkPity(pityCount: number, eggType: string): {
     guaranteed: boolean
     minRarity: number
   } {
     if (pityCount >= PITY_SYSTEM.guaranteed6Star) {
       return { guaranteed: true, minRarity: 6 }
     }
     if (pityCount >= PITY_SYSTEM.guaranteed5Star) {
       return { guaranteed: true, minRarity: 5 }
     }
     if (pityCount >= PITY_SYSTEM.guaranteed4Star) {
       return { guaranteed: true, minRarity: 4 }
     }
     return { guaranteed: false, minRarity: 1 }
   }
   ```

### 你的工作流程

1. **先规划架构**
   - 输出技术设计文档（架构图、数据流、算法伪代码）
   - 等待Qoder和用户确认架构设计

2. **确认后再执行**
   - 架构确认后开始编码
   - 每个模块完成后提交代码

3. **每日提交代码**
   ```bash
   git add .
   git commit -m "feat(battle): 实现技能效果处理器
   
   - 支持伤害/治疗/护盾计算
   - 实现属性克制系统
   - 添加暴击/闪避逻辑
   
   Closes #12"
   git push origin dev-kimi
   ```

4. **每日汇报进度**
   ```markdown
   ## KIMI 日报 - 2026-11-03
   
   ### 今日完成
   - ✅ 战斗引擎核心状态机
   - ✅ 技能效果处理器（伤害/治疗）
   - ✅ 属性克制计算
   
   ### 代码提交
   - commit: abc1234
   - 分支: dev-kimi
   - 文件: src/engine/BattleEngine.ts
   
   ### 遇到问题
   - 状态效果叠加逻辑需要讨论
   
   ### 明日计划
   - 完成BUFF/DEBUFF系统
   - 实现速度排序算法
   ```

### 你的交付标准

- ✅ 所有算法必须有单元测试（覆盖率>90%）
- ✅ 代码必须有清晰的注释（每个函数都要说明用途）
- ✅ 性能要求：战斗计算 <50ms
- ✅ 数值平衡：提供Excel计算表（验证经济平衡）
- ✅ 文档完整：每个模块都要有README说明

### 你需要与谁协作

- **Qoder：** 他会将你的算法集成到API中，你需要提供清晰的接口文档
- **DSH：** 她会用UI展示你的算法结果，你需要告诉她数据格式
- **用户：** 他会测试你的算法，你需要根据反馈调整数值

### 你需要访问的资源

- **现有代码：** `d:\课件\platform\class-pet-garden\server\game\battle-engine.js`（基础版战斗引擎）
- **GitHub仓库：** `https://github.com/mamapopoooo/class-pet-garden`
- **服务器地址：** `http://110.40.142.247/pet-garden/`（测试环境）
- **API文档：** 等待Qoder提供

---

## 🎨 DSH 完整提示词

### 你的角色

你是**UI/UX工程师**，负责所有视觉特效、动画、页面布局。

**你需要了解：**
- 你不需要关心算法、数据库、API逻辑
- 你只需要专注于视觉效果和用户体验
- 你的UI组件会调用Qoder提供的API
- 你的动画会展示KIMI的算法结果

### 你的任务清单

#### 模块1：UI组件库（难度⭐⭐⭐⭐）

**任务描述：**
创建一套可复用的UI组件，供所有页面使用。

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

3. **皮肤预览组件（SkinPreview.vue）**
   - 实时预览皮肤效果
   - 支持切换不同皮肤
   - 显示皮肤价格

4. **抽卡动画组件（GachaAnimation.vue）**
   - 白光（1-3星）
   - 蓝光（4星）
   - 紫光（5星）
   - 金光（6星）
   - 粒子飞舞效果

5. **成就徽章组件（AchievementBadge.vue）**
   - 未解锁状态（灰色）
   - 已解锁状态（彩色+光效）
   - 解锁动画（徽章旋转+光效绽放）

6. **任务列表组件（QuestList.vue）**
   - 每日任务列表
   - 每周任务列表
   - 完成状态标记
   - 奖励预览

7. **排行榜组件（RankingBoard.vue）**
   - 积分排行榜
   - PVP段位排行
   - 班级排行
   - 个人排名高亮

8. **战斗动画组件（BattleAnimation.vue）**
   - 技能释放光效
   - 暴击震动效果
   - 命中/闪避动画
   - 宠物切换动画

#### 模块2：CSS特效系统（难度⭐⭐⭐⭐⭐）

**任务描述：**
用纯CSS实现所有视觉特效，不依赖图片资源。

**具体要求：**

1. **觉醒0-4阶CSS滤镜**
   ```css
   /* 觉醒0：原色 */
   .pet-awakening-0 {
     filter: none;
   }
   
   /* 觉醒1：颜色变深 + 光圈 */
   .pet-awakening-1 {
     filter: brightness(0.8) saturate(1.3);
     box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
   }
   
   /* 觉醒2：颜色渐变 + 粒子 */
   .pet-awakening-2 {
     filter: hue-rotate(15deg) brightness(0.9) saturate(1.5);
     animation: particle-effect 2s infinite;
   }
   
   /* 觉醒3：发光 + 动态特效 */
   .pet-awakening-3 {
     filter: hue-rotate(30deg) brightness(1.2) saturate(2);
     animation: glow-effect 1.5s infinite alternate;
   }
   
   /* 觉醒4：全新配色 */
   .pet-awakening-4 {
     filter: hue-rotate(60deg) brightness(1.5) saturate(2.5) contrast(1.2);
     animation: ultimate-effect 1s infinite;
   }
   
   @keyframes particle-effect {
     0%, 100% { box-shadow: 0 0 10px rgba(255, 215, 0, 0.5); }
     50% { box-shadow: 0 0 30px rgba(255, 215, 0, 0.8); }
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
   /* 颜色皮肤：蓝色焰尾狐 */
   .skin-blue {
     filter: hue-rotate(180deg);
   }
   
   /* 季节皮肤：春季主题 */
   .skin-spring {
     filter: hue-rotate(90deg) saturate(1.3);
     border: 3px solid #4CAF50;
     box-shadow: 0 0 15px rgba(76, 175, 80, 0.5);
   }
   
   /* 节日皮肤：圣诞主题 */
   .skin-christmas {
     filter: brightness(1.1);
     border: 3px solid #E53935;
     background: linear-gradient(45deg, #E53935 25%, #4CAF50 25%, #4CAF50 50%, #E53935 50%, #E53935 75%, #4CAF50 75%);
     background-size: 20px 20px;
   }
   ```

3. **战斗特效**
   ```css
   /* 技能释放光效 */
   .skill-effect {
     position: absolute;
     width: 100px;
     height: 100px;
     background: radial-gradient(circle, rgba(255,255,0,0.8) 0%, rgba(255,255,0,0) 70%);
     animation: skill-release 0.5s ease-out;
   }
   
   @keyframes skill-release {
     0% { transform: scale(0); opacity: 1; }
     100% { transform: scale(2); opacity: 0; }
   }
   
   /* 暴击震动 */
   .critical-hit {
     animation: shake 0.3s ease-in-out;
   }
   
   @keyframes shake {
     0%, 100% { transform: translateX(0); }
     25% { transform: translateX(-5px); }
     75% { transform: translateX(5px); }
   }
   ```

4. **抽卡特效**
   ```css
   /* 光圈扩散 */
   .gacha-circle {
     position: absolute;
     border-radius: 50%;
     animation: circle-expand 1s ease-out;
   }
   
   @keyframes circle-expand {
     0% { width: 0; height: 0; opacity: 1; }
     100% { width: 300px; height: 300px; opacity: 0; }
   }
   
   /* 粒子飞舞 */
   .gacha-particle {
     position: absolute;
     width: 5px;
     height: 5px;
     background: gold;
     border-radius: 50%;
     animation: particle-fly 1.5s ease-out;
   }
   
   @keyframes particle-fly {
     0% { transform: translate(0, 0); opacity: 1; }
     100% { transform: translate(var(--x), var(--y)); opacity: 0; }
   }
   ```

#### 模块3：页面布局（难度⭐⭐⭐）

**任务描述：**
设计并实现所有页面的布局，确保响应式（适配手机/平板/桌面）。

**具体要求：**

1. **学生首页（Dashboard.vue）**
   ```
   ┌─────────────────────────────────────────┐
   │  顶部信息栏（学号、姓名、积分）          │
   ├─────────────────────────────────────────┤
   │                                         │
   │  [🐾 我的宠物]  [⚔️ 开始战斗]           │
   │  [🛒 积分商城]  [🏆 排行榜]             │
   │                                         │
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
   │                                         │
   │     [普通蛋]  [稀有蛋]  [传说蛋]        │
   │     200积分   500积分   1000积分        │
   │                                         │
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
   │                                         │
   │  当前比分：                              │
   │  G6-1班：280分                          │
   │  G6-2班：265分                          │
   │                                         │
   │  我的贡献：45分（3胜1负）                │
   │  今日剩余次数：1/2                       │
   │                                         │
   │  [开始战斗]                              │
   └─────────────────────────────────────────┘
   ```

### 你的工作流程

1. **先设计UI原型**
   - 用Figma或手绘输出UI设计稿
   - 等待用户确认设计风格

2. **确认后再执行**
   - 设计风格确认后开始编码
   - 每个组件完成后提交代码

3. **每日提交代码**
   ```bash
   git add .
   git commit -m "style(awakening): 完成觉醒CSS特效
   
   - 0-4阶滤镜效果
   - 粒子动画
   - 光圈特效
   "
   git push origin dev-dsh
   ```

4. **每日汇报进度**
   ```markdown
   ## DSH 日报 - 2026-11-03
   
   ### 今日完成
   - ✅ 宠物卡片组件
   - ✅ 觉醒0-2阶CSS特效
   - ✅ 皮肤系统CSS框架
   
   ### 代码提交
   - commit: ghi9012
   - 分支: dev-dsh
   - 文件: src/components/PetCard.vue, src/styles/awakening.css
   
   ### 遇到问题
   - 需要确认觉醒4阶的配色方案
   
   ### 明日计划
   - 完成觉醒3-4阶特效
   - 开始战斗特效
   ```

### 你的交付标准

- ✅ 所有组件必须响应式（适配手机/平板/桌面）
- ✅ 动画必须流畅（>30fps）
- ✅ CSS必须使用Tailwind + 自定义样式
- ✅ 颜色方案必须统一（参考现有6只宠物的配色）
- ✅ 所有特效必须用CSS实现（不依赖图片资源）

### 你需要与谁协作

- **KIMI：** 他会提供算法结果的数据格式，你需要根据数据格式设计UI
- **Qoder：** 他会提供API接口，你需要调用API获取数据
- **用户：** 他会确认设计风格和配色方案

### 你需要访问的资源

- **现有代码：** `d:\课件\platform\class-pet-garden\src\pages\Battle.vue`（参考现有UI风格）
- **GitHub仓库：** `https://github.com/mamapopoooo/class-pet-garden`
- **服务器地址：** `http://110.40.142.247/pet-garden/`（测试环境）
- **Tailwind文档：** `https://tailwindcss.com/docs`

---

## 💻 Qoder 完整提示词

### 你的角色

你是**全栈工程师**，负责数据库设计、API接口、前端框架、集成测试、最终汇总。

**你需要了解：**
- 你是项目的技术负责人
- 你需要协调KIMI和DSH的工作
- 你需要将他们的代码集成到一起
- 你需要确保整个系统能正常运行

### 你的任务清单

#### 模块1：数据库设计（难度⭐⭐⭐）

**任务描述：**
设计21张数据库表，存储所有游戏数据。

**具体要求：**

1. **用户相关（4张表）**
   ```sql
   -- 用户基础信息
   CREATE TABLE users (
     id TEXT PRIMARY KEY,
     username TEXT UNIQUE NOT NULL,  -- 学号（学生）或工号（管理员）
     password_hash TEXT,
     role TEXT NOT NULL DEFAULT 'student',
     real_name TEXT NOT NULL,
     class_id TEXT,
     grade INTEGER,
     total_points INTEGER DEFAULT 0,
     created_at INTEGER,
     last_login_at INTEGER
   );
   
   -- 训练师信息
   CREATE TABLE trainers (
     user_id TEXT PRIMARY KEY,
     level INTEGER DEFAULT 1,
     exp INTEGER DEFAULT 0,
     title TEXT DEFAULT '新手训练师',
     avatar TEXT DEFAULT '👤',
     attack_bonus INTEGER DEFAULT 0,
     defense_bonus INTEGER DEFAULT 0,
     luck_bonus INTEGER DEFAULT 0,
     FOREIGN KEY (user_id) REFERENCES users(id)
   );
   
   -- 班级信息
   CREATE TABLE classes (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     teacher_id TEXT,
     grade INTEGER,
     created_at INTEGER
   );
   
   -- 积分记录
   CREATE TABLE points_records (
     id TEXT PRIMARY KEY,
     student_id TEXT NOT NULL,
     teacher_id TEXT,
     amount INTEGER NOT NULL,
     reason TEXT,
     category TEXT,
     created_at INTEGER
   );
   ```

2. **宠物相关（5张表）**
   ```sql
   -- 宠物模板
   CREATE TABLE pets_template (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     element TEXT NOT NULL,
     role TEXT NOT NULL,
     description TEXT,
     skills_json TEXT,
     image_prefix TEXT,
     sort_order INTEGER DEFAULT 0,
     is_active BOOLEAN DEFAULT 1
   );
   
   -- 玩家宠物
   CREATE TABLE player_pets (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     template_id TEXT NOT NULL,
     level INTEGER DEFAULT 1,
     exp INTEGER DEFAULT 0,
     equipped_skills TEXT,
     obtained_at INTEGER
   );
   
   -- 宠物觉醒
   CREATE TABLE pet_awakening (
     pet_id TEXT PRIMARY KEY,
     awakening_level INTEGER DEFAULT 0,
     FOREIGN KEY (pet_id) REFERENCES player_pets(id)
   );
   
   -- 宠物技能
   CREATE TABLE pet_skills (
     id TEXT PRIMARY KEY,
     pet_id TEXT NOT NULL,
     skill_id TEXT NOT NULL,
     learned_at INTEGER
   );
   
   -- 宠物皮肤
   CREATE TABLE pet_skins (
     id TEXT PRIMARY KEY,
     pet_id TEXT NOT NULL,
     skin_id TEXT NOT NULL,
     equipped BOOLEAN DEFAULT 0,
     obtained_at INTEGER
   );
   ```

3. **皮肤相关（2张表）**
   ```sql
   -- 皮肤模板
   CREATE TABLE skins_template (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     pet_id TEXT NOT NULL,
     type TEXT NOT NULL,
     price INTEGER DEFAULT 0,
     css_class TEXT NOT NULL,
     description TEXT,
     is_limited BOOLEAN DEFAULT 0,
     release_date INTEGER,
     expire_date INTEGER
   );
   
   -- 玩家皮肤
   CREATE TABLE player_skins (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     skin_id TEXT NOT NULL,
     equipped BOOLEAN DEFAULT 0,
     obtained_at INTEGER
   );
   ```

4. **战斗相关（4张表）**
   ```sql
   -- 战斗记录
   CREATE TABLE battle_records (
     id TEXT PRIMARY KEY,
     battle_type TEXT NOT NULL,
     player_a_id TEXT,
     player_b_id TEXT,
     winner_id TEXT,
     turn_count INTEGER,
     log_json TEXT,
     created_at INTEGER
   );
   
   -- PVP段位
   CREATE TABLE pvp_rankings (
     user_id TEXT,
     season_id TEXT,
     points INTEGER DEFAULT 0,
     tier TEXT DEFAULT 'bronze',
     wins INTEGER DEFAULT 0,
     losses INTEGER DEFAULT 0,
     PRIMARY KEY (user_id, season_id)
   );
   
   -- 班级战
   CREATE TABLE class_battles (
     id TEXT PRIMARY KEY,
     class_a_id TEXT NOT NULL,
     class_b_id TEXT NOT NULL,
     start_date INTEGER NOT NULL,
     end_date INTEGER NOT NULL,
     status TEXT DEFAULT 'active',
     class_a_score INTEGER DEFAULT 0,
     class_b_score INTEGER DEFAULT 0,
     winner_class_id TEXT
   );
   
   -- 班级战记录
   CREATE TABLE class_battle_records (
     id TEXT PRIMARY KEY,
     battle_id TEXT NOT NULL,
     user_id TEXT NOT NULL,
     opponent_id TEXT NOT NULL,
     result TEXT NOT NULL,
     score INTEGER NOT NULL,
     created_at INTEGER
   );
   ```

5. **系统相关（6张表）**
   ```sql
   -- 成就模板
   CREATE TABLE achievements (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     category TEXT NOT NULL,
     description TEXT,
     condition_json TEXT,
     reward_points INTEGER DEFAULT 0,
     reward_title TEXT,
     reward_skin TEXT
   );
   
   -- 玩家成就
   CREATE TABLE player_achievements (
     user_id TEXT,
     achievement_id TEXT,
     completed_at INTEGER,
     PRIMARY KEY (user_id, achievement_id)
   );
   
   -- 任务模板
   CREATE TABLE quests (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     type TEXT NOT NULL,
     description TEXT,
     condition_json TEXT,
     reward_points INTEGER DEFAULT 0,
     reward_exp INTEGER DEFAULT 0,
     is_active BOOLEAN DEFAULT 1
   );
   
   -- 玩家任务进度
   CREATE TABLE player_quests (
     user_id TEXT,
     quest_id TEXT,
     progress INTEGER DEFAULT 0,
     completed BOOLEAN DEFAULT 0,
     last_reset INTEGER,
     PRIMARY KEY (user_id, quest_id)
   );
   
   -- 抽卡记录
   CREATE TABLE gacha_records (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     egg_type TEXT NOT NULL,
     pet_id TEXT,
     skin_id TEXT,
     is_rare BOOLEAN DEFAULT 0,
     created_at INTEGER
   );
   
   -- 兑换记录
   CREATE TABLE exchange_records (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     item_id TEXT NOT NULL,
     cost_points INTEGER NOT NULL,
     result_json TEXT,
     created_at INTEGER
   );
   ```

**交付物：**
```sql
-- src/server/schema.sql
-- 包含所有21张表的CREATE语句
-- 包含所有必要的索引
-- 包含初始数据（管理员账号、宠物模板等）
```

#### 模块2：后端API（难度⭐⭐⭐）

**任务描述：**
实现46个API接口，供前端调用。

**具体要求：**

1. **认证接口（3个）**
   ```javascript
   // POST /api/auth/student/login
   // 学生登录（学号+姓名免密）
   router.post('/student/login', (req, res) => {
     const { studentNumber, realName } = req.body
     const user = db.prepare('SELECT * FROM users WHERE username = ? AND role = "student"').get(studentNumber)
     
     if (!user) {
       return res.status(404).json({ error: '学生不存在' })
     }
     
     if (user.real_name !== realName) {
       return res.status(401).json({ error: '姓名不匹配' })
     }
     
     const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
     
     res.json({ success: true, token, user })
   })
   
   // POST /api/auth/admin/login
   // 管理员登录（账号+密码）
   router.post('/admin/login', (req, res) => {
     const { username, password } = req.body
     const user = db.prepare('SELECT * FROM users WHERE username = ? AND role = "admin"').get(username)
     
     if (!user || !bcrypt.compareSync(password, user.password_hash)) {
       return res.status(401).json({ error: '账号或密码错误' })
     }
     
     const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
     
     res.json({ success: true, token, user })
   })
   
   // POST /api/auth/logout
   // 登出
   router.post('/logout', requireAuth, (req, res) => {
     res.json({ success: true })
   })
   ```

2. **训练师接口（4个）**
   ```javascript
   // GET /api/trainer/me
   // 获取我的训练师信息
   router.get('/me', requireAuth, (req, res) => {
     const trainer = db.prepare('SELECT * FROM trainers WHERE user_id = ?').get(req.user.userId)
     res.json({ trainer })
   })
   
   // POST /api/trainer/level-up
   // 训练师升级
   router.post('/level-up', requireAuth, (req, res) => {
     const trainer = db.prepare('SELECT * FROM trainers WHERE user_id = ?').get(req.user.userId)
     const requiredExp = calculateRequiredExp(trainer.level)
     
     if (trainer.exp < requiredExp) {
       return res.status(400).json({ error: '经验不足' })
     }
     
     trainer.exp -= requiredExp
     trainer.level += 1
     
     db.prepare('UPDATE trainers SET level = ?, exp = ? WHERE user_id = ?')
       .run(trainer.level, trainer.exp, req.user.userId)
     
     res.json({ success: true, trainer })
   })
   
   // POST /api/trainer/update-title
   // 更新称号
   router.post('/update-title', requireAuth, (req, res) => {
     const { title } = req.body
     db.prepare('UPDATE trainers SET title = ? WHERE user_id = ?')
       .run(title, req.user.userId)
     res.json({ success: true })
   })
   
   // GET /api/trainer/stats
   // 查看属性
   router.get('/stats', requireAuth, (req, res) => {
     const trainer = db.prepare('SELECT * FROM trainers WHERE user_id = ?').get(req.user.userId)
     res.json({ stats: trainer })
   })
   ```

3. **宠物接口（8个）**
   ```javascript
   // GET /api/pets
   // 获取宠物模板列表
   router.get('/', (req, res) => {
     const pets = db.prepare('SELECT * FROM pets_template WHERE is_active = 1 ORDER BY sort_order').all()
     res.json({ pets })
   })
   
   // GET /api/pets/my
   // 获取我的宠物
   router.get('/my', requireAuth, (req, res) => {
     const pets = db.prepare(`
       SELECT pp.*, pt.name, pt.element, pt.role, pa.awakening_level
       FROM player_pets pp
       JOIN pets_template pt ON pp.template_id = pt.id
       LEFT JOIN pet_awakening pa ON pp.id = pa.pet_id
       WHERE pp.user_id = ?
     `).all(req.user.userId)
     res.json({ pets })
   })
   
   // POST /api/pets/:id/awaken
   // 宠物觉醒
   router.post('/:id/awaken', requireAuth, (req, res) => {
     const pet = db.prepare('SELECT * FROM player_pets WHERE id = ? AND user_id = ?')
       .get(req.params.id, req.user.userId)
     
     if (!pet) {
       return res.status(404).json({ error: '宠物不存在' })
     }
     
     const awakening = db.prepare('SELECT * FROM pet_awakening WHERE pet_id = ?').get(pet.id)
     const currentLevel = awakening?.awakening_level || 0
     
     if (currentLevel >= 4) {
       return res.status(400).json({ error: '已达最高觉醒等级' })
     }
     
     const cost = getAwakeningCost(currentLevel + 1)
     const user = db.prepare('SELECT total_points FROM users WHERE id = ?').get(req.user.userId)
     
     if (user.total_points < cost) {
       return res.status(400).json({ error: '积分不足' })
     }
     
     // 扣除积分
     db.prepare('UPDATE users SET total_points = total_points - ? WHERE id = ?')
       .run(cost, req.user.userId)
     
     // 更新觉醒等级
     if (awakening) {
       db.prepare('UPDATE pet_awakening SET awakening_level = ? WHERE pet_id = ?')
         .run(currentLevel + 1, pet.id)
     } else {
       db.prepare('INSERT INTO pet_awakening (pet_id, awakening_level) VALUES (?, ?)')
         .run(pet.id, 1)
     }
     
     res.json({ success: true, newLevel: currentLevel + 1, cost })
   })
   
   // POST /api/pets/:id/equip-skin
   // 装备皮肤
   router.post('/:id/equip-skin', requireAuth, (req, res) => {
     const { skinId } = req.body
     const pet = db.prepare('SELECT * FROM player_pets WHERE id = ? AND user_id = ?')
       .get(req.params.id, req.user.userId)
     
     if (!pet) {
       return res.status(404).json({ error: '宠物不存在' })
     }
     
     const skin = db.prepare('SELECT * FROM player_skins WHERE id = ? AND user_id = ?')
       .get(skinId, req.user.userId)
     
     if (!skin) {
       return res.status(404).json({ error: '皮肤不存在' })
     }
     
     // 取消其他皮肤的装备状态
     db.prepare('UPDATE player_skins SET equipped = 0 WHERE pet_id = ?').run(pet.id)
     
     // 装备新皮肤
     db.prepare('UPDATE player_skins SET equipped = 1 WHERE id = ?').run(skinId)
     
     res.json({ success: true })
   })
   
   // GET /api/pets/:id/skills
   // 获取技能
   router.get('/:id/skills', requireAuth, (req, res) => {
     const skills = db.prepare('SELECT * FROM pet_skills WHERE pet_id = ?').all(req.params.id)
     res.json({ skills })
   })
   
   // POST /api/pets/:id/learn-skill
   // 学习技能
   router.post('/:id/learn-skill', requireAuth, (req, res) => {
     const { skillId } = req.body
     db.prepare('INSERT INTO pet_skills (id, pet_id, skill_id, learned_at) VALUES (?, ?, ?, ?)')
       .run(uuidv4(), req.params.id, skillId, Date.now())
     res.json({ success: true })
   })
   
   // POST /api/pets/:id/forget-skill
   // 遗忘技能
   router.post('/:id/forget-skill', requireAuth, (req, res) => {
     const { skillId } = req.body
     db.prepare('DELETE FROM pet_skills WHERE pet_id = ? AND skill_id = ?')
       .run(req.params.id, skillId)
     res.json({ success: true })
   })
   
   // GET /api/pets/collection
   // 宠物图鉴
   router.get('/collection', requireAuth, (req, res) => {
     const collection = db.prepare(`
       SELECT pt.*, COUNT(pp.id) as count
       FROM pets_template pt
       LEFT JOIN player_pets pp ON pt.id = pp.template_id AND pp.user_id = ?
       WHERE pt.is_active = 1
       GROUP BY pt.id
     `).all(req.user.userId)
     res.json({ collection })
   })
   ```

4. **战斗接口（6个）**
   ```javascript
   // POST /api/battle/pve/start
   // 开始PVE战斗
   router.post('/pve/start', requireAuth, (req, res) => {
     const { teamPetIds } = req.body
     const playerTeam = teamPetIds.map(petId => {
       const pet = db.prepare('SELECT * FROM player_pets WHERE id = ?').get(petId)
       return { playerId: req.user.userId, petId: pet.template_id, level: pet.level }
     })
     
     const aiTeam = generateAITeam(playerTeam)
     const battleState = new BattleState(playerTeam, aiTeam)
     const engine = new BattleEngine(battleState)
     engine.init()
     
     activeBattles.set(battleState.id, { state: battleState, engine })
     
     res.json({ battleId: battleState.id, state: battleState })
   })
   
   // POST /api/battle/pve/action
   // PVE战斗操作
   router.post('/pve/action', requireAuth, (req, res) => {
     const { battleId, skillId } = req.body
     const battle = activeBattles.get(battleId)
     
     if (!battle) {
       return res.status(404).json({ error: '战斗不存在' })
     }
     
     const result = battle.engine.executeTurn({ skillId }, generateAIAction(battle.state))
     
     res.json({ result })
   })
   
   // POST /api/battle/pvp/match
   // PVP匹配
   router.post('/pvp/match', requireAuth, (req, res) => {
     const player = db.prepare('SELECT * FROM pvp_rankings WHERE user_id = ? AND season_id = ?')
       .get(req.user.userId, currentSeasonId)
     
     const candidates = db.prepare(`
       SELECT * FROM pvp_rankings 
       WHERE season_id = ? AND user_id != ?
       AND ABS(points - ?) <= 200
     `).all(currentSeasonId, req.user.userId, player.points)
     
     const opponent = matchPlayer(player, candidates)
     
     if (!opponent) {
       return res.status(404).json({ error: '未找到匹配对手' })
     }
     
     res.json({ opponent })
   })
   
   // POST /api/battle/pvp/action
   // PVP战斗操作
   router.post('/pvp/action', requireAuth, (req, res) => {
     // 类似PVE，但需要记录战斗结果到pvp_rankings
   })
   
   // POST /api/battle/class/start
   // 班级战开始
   router.post('/class/start', requireAuth, requireRole('teacher'), (req, res) => {
     const { classAId, classBId } = req.body
     const battleId = uuidv4()
     
     db.prepare(`
       INSERT INTO class_battles (id, class_a_id, class_b_id, start_date, end_date, status)
       VALUES (?, ?, ?, ?, ?, 'active')
     `).run(battleId, classAId, classBId, Date.now(), Date.now() + 5 * 24 * 60 * 60 * 1000)
     
     res.json({ battleId })
   })
   
   // POST /api/battle/class/action
   // 班级战操作
   router.post('/class/action', requireAuth, (req, res) => {
     // 记录战斗结果，更新class_battles积分
   })
   ```

5. **商城接口（4个）**
   ```javascript
   // GET /api/shop/items
   // 获取商品列表
   router.get('/items', (req, res) => {
     const items = db.prepare('SELECT * FROM items_template WHERE is_active = 1').all()
     res.json({ items })
   })
   
   // POST /api/shop/buy
   // 购买商品
   router.post('/buy', requireAuth, (req, res) => {
     const { itemId } = req.body
     const item = db.prepare('SELECT * FROM items_template WHERE id = ?').get(itemId)
     const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId)
     
     const price = calculatePrice(item.cost_points, user.grade)
     
     if (user.total_points < price) {
       return res.status(400).json({ error: '积分不足' })
     }
     
     db.prepare('UPDATE users SET total_points = total_points - ? WHERE id = ?')
       .run(price, req.user.userId)
     
     db.prepare(`
       INSERT INTO exchange_records (id, user_id,, item_id, cost_points, created_at)
       VALUES (?, ?, ?, ?, ?)
     `).run(uuidv4(), req.user.userId, itemId, price, Date.now())
     
     res.json({ success: true, newPoints: user.total_points - price })
   })
   
   // GET /api/shop/skins
   // 获取皮肤列表
   router.get('/skins', (req, res) => {
     const skins = db.prepare('SELECT * FROM skins_template WHERE is_active = 1').all()
     res.json({ skins })
   })
   
   // POST /api/shop/skins/buy
   // 购买皮肤
   router.post('/skins/buy', requireAuth, (req, res) => {
     const { skinId } = req.body
     const skin = db.prepare('SELECT * FROM skins_template WHERE id = ?').get(skinId)
     const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId)
     
     const price = calculatePrice(skin.price, user.grade)
     
     if (user.total_points < price) {
       return res.status(400).json({ error: '积分不足' })
     }
     
     db.prepare('UPDATE users SET total_points = total_points - ? WHERE id = ?')
       .run(price, req.user.userId)
     
     db.prepare(`
       INSERT INTO player_skins (id, user_id, skin_id, equipped, obtained_at)
       VALUES (?, ?, ?, 0, ?)
     `).run(uuidv4(), req.user.userId, skinId, Date.now())
     
     res.json({ success: true, newPoints: user.total_points - price })
   })
   ```

6. **抽卡接口（3个）**
   ```javascript
   // POST /api/gacha/draw
   // 抽卡
   router.post('/draw', requireAuth, (req, res) => {
     const { eggType, count } = req.body
     const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId)
     
     const eggPrices = { normal: 200, rare: 500, legendary: 1000 }
     const totalPrice = eggPrices[eggType] * count
     
     if (user.total_points < totalPrice) {
       return res.status(400).json({ error: '积分不足' })
     }
     
     db.prepare('UPDATE users SET total_points = total_points - ? WHERE id = ?')
       .run(totalPrice, req.user.userId)
     
     const results = []
     for (let i = 0; i < count; i++) {
       const result = gachaSystem.draw(eggType)
       results.push(result)
       
       db.prepare(`
         INSERT INTO gacha_records (id, user_id, egg_type, pet_id, skin_id, is_rare, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
       `).run(uuidv4(), req.user.userId, eggType, result.petId, result.skinId, result.isRare, Date.now())
     }
     
     res.json({ results, newPoints: user.total_points - totalPrice })
   })
   
   // GET /api/gacha/records
   // 抽卡记录
   router.get('/records', requireAuth, (req, res) => {
     const records = db.prepare(`
       SELECT gr.*, pt.name as pet_name, st.name as skin_name
       FROM gacha_records gr
       LEFT JOIN pets_template pt ON gr.pet_id = pt.id
       LEFT JOIN skins_template st ON gr.skin_id = st.id
       WHERE gr.user_id = ?
       ORDER BY gr.created_at DESC
       LIMIT 100
     `).all(req.user.userId)
     res.json({ records })
   })
   
   // GET /api/gacha/rates
   // 概率公示
   router.get('/rates', (req, res) => {
     res.json({
       normal: { 1: 0.6, 2: 0.3, 3: 0.1 },
       rare: { 3: 0.4, 4: 0.4, 5: 0.2 },
       legendary: { 5: 0.3, 6: 0.7 }
     })
   })
   ```

7. **任务接口（4个）**
   ```javascript
   // GET /api/quests/daily
   // 获取每日任务
   router.get('/daily', requireAuth, (req, res) => {
     const quests = db.prepare('SELECT * FROM quests WHERE type = "daily" AND is_active = 1').all()
     const progress = db.prepare(`
       SELECT quest_id, progress, completed
       FROM player_quests
       WHERE user_id = ? AND last_reset = ?
     `).all(req.user.userId, getTodayStart())
     
     res.json({ quests, progress })
   })
   
   // GET /api/quests/weekly
   // 获取每周任务
   router.get('/weekly', requireAuth, (req, res) => {
     const quests = db.prepare('SELECT * FROM quests WHERE type = "weekly" AND is_active = 1').all()
     const progress = db.prepare(`
       SELECT quest_id, progress, completed
       FROM player_quests
       WHERE user_id = ? AND last_reset = ?
     `).all(req.user.userId, getWeekStart())
     
     res.json({ quests, progress })
   })
   
   // POST /api/quests/:id/claim
   // 领取奖励
   router.post('/:id/claim', requireAuth, (req, res) => {
     const quest = db.prepare('SELECT * FROM quests WHERE id = ?').get(req.params.id)
     const progress = db.prepare('SELECT * FROM player_quests WHERE user_id = ? AND quest_id = ?')
       .get(req.user.userId, req.params.id)
     
     if (!progress || !progress.completed) {
       return res.status(400).json({ error: '任务未完成' })
     }
     
     db.prepare('UPDATE users SET total_points = total_points + ? WHERE id = ?')
       .run(quest.reward_points, req.user.userId)
     
     db.prepare('UPDATE player_quests SET completed = 1 WHERE user_id = ? AND quest_id = ?')
       .run(req.user.userId, req.params.id)
     
     res.json({ success: true, reward: quest.reward_points })
   })
   
   // GET /api/quests/progress
   // 任务进度
   router.get('/progress', requireAuth, (req, res) => {
     const progress = db.prepare(`
       SELECT pq.*, q.name, q.type, q.reward_points
       FROM player_quests pq
       JOIN quests q ON pq.quest_id = q.id
       WHERE pq.user_id = ?
     `).all(req.user.userId)
     res.json({ progress })
   })
   ```

8. **成就接口（3个）**
   ```javascript
   // GET /api/achievements
   // 成就列表
   router.get('/', (req, res) => {
     const achievements = db.prepare('SELECT * FROM achievements').all()
     res.json({ achievements })
   })
   
   // GET /api/achievements/my
   // 我的成就
   router.get('/my', requireAuth, (req, res) => {
     const achievements = db.prepare(`
       SELECT a.*, pa.completed_at
       FROM achievements a
       LEFT JOIN player_achievements pa ON a.id = pa.achievement_id AND pa.user_id = ?
     `).all(req.user.userId)
     res.json({ achievements })
   })
   
   // POST /api/achievements/:id/claim
   // 领取奖励
   router.post('/:id/claim', requireAuth, (req, res) => {
     const achievement = db.prepare('SELECT * FROM achievements WHERE id = ?').get(req.params.id)
     const completed = db.prepare('SELECT * FROM player_achievements WHERE user_id = ? AND achievement_id = ?')
       .get(req.user.userId, req.params.id)
     
     if (!completed) {
       return res.status(400).json({ error: '成就未解锁' })
     }
     
     db.prepare('UPDATE users SET total_points = total_points + ? WHERE id = ?')
       .run(achievement.reward_points, req.user.userId)
     
     res.json({ success: true, reward: achievement.reward_points })
   })
   ```

9. **排行榜接口（3个）**
   ```javascript
   // GET /api/ranking/points
   // 积分排行榜
   router.get('/points', (req, res) => {
     const rankings = db.prepare(`
       SELECT u.username, u.real_name, u.total_points,
              RANK() OVER (ORDER BY u.total_points DESC) as rank
       FROM users u
       WHERE u.role = 'student'
       ORDER BY u.total_points DESC
       LIMIT 100
     `).all()
     res.json({ rankings })
   })
   
   // GET /api/ranking/pvp
   // PVP排行榜
   router.get('/pvp', (req, res) => {
     const rankings = db.prepare(`
       SELECT u.username, u.real_name, pr.points, pr.tier, pr.wins, pr.losses,
              RANK() OVER (ORDER BY pr.points DESC) as rank
       FROM pvp_rankings pr
       JOIN users u ON pr.user_id = u.id
       WHERE pr.season_id = ?
       ORDER BY pr.points DESC
       LIMIT 100
     `).all(currentSeasonId)
     res.json({ rankings })
   })
   
   // GET /api/ranking/class
   // 班级排行榜
   router.get('/class', (req, res) => {
     const rankings = db.prepare(`
       SELECT c.name, SUM(u.total_points) as total_points,
              RANK() OVER (ORDER BY SUM(u.total_points) DESC) as rank
       FROM classes c
       JOIN users u ON c.id = u.class_id
       WHERE u.role = 'student'
       GROUP BY c.id
       ORDER BY total_points DESC
     `).all()()
     res.json({ rankings }
   })
   ```

10. **教师端接口（3个）**
    ```javascript
    // POST /api/teacher/points/submit
    // 提交积分
    router.post('/points/submit', requireAuth, requireRole('teacher'), (req, res) => {
      const { records } = req.body
      
      records.forEach(record => {
        db.prepare(`
          INSERT INTO points_records (id, student_id, teacher_id, amount, reason, category, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), record.studentId, req.user.userId, record.amount, record.reason, record.category, record.timestamp)
        
        db.prepare('UPDATE users SET total_points = total_points + ? WHERE username = ?')
          .run(record.amount, record.studentId)
      })
      
      res.json({ success: true })
    })
    
    // GET /api/teacher/students
    // 获取学生列表
    router.get('/students', requireAuth, requireRole('teacher'), (req, res) => {
      const students = db.prepare(`
        SELECT u.username, u.real_name, u.class_id, u.total_points
        FROM users u
        WHERE u.role = 'student'
        ORDER BY u.class_id, u.username
      `).all()
      res.json({ students })
    })
    
    // POST /api/teacher/class-battle/start
    // 开启班级战
    router.post('/class-battle/start', requireAuth, requireRole('teacher'), (req, res) => {
      const { classAId, classBId } = req.body
      const battleId = uuidv4()
      
      db.prepare(`
        INSERT INTO class_battles (id, class_a_id, class_b_id, start_date, end_date, status)
        VALUES (?, ?, ?, ?, ?, 'active')
      `).run(battleId, classAId, classBId, Date.now(), Date.now() + 5 * 24 * 60 * 60 * 1000)
      
      res.json({ battleId })
    })
    ```

11. **管理端接口（5个）**
    ```javascript
    // GET /api/admin/stats
    // 数据统计
    router.get('/stats', requireAuth, requireRole('admin'), (req, res) => {
      const stats = {
        totalUsers: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
        totalPets: db.prepare('SELECT COUNT(*) as count FROM player_pets').get().count,
        totalBattles: db.prepare('SELECT COUNT(*) as count FROM battle_records').get().count,
        totalPoints: db.prepare('SELECT SUM(total_points) as sum FROM users').get().sum
      }
      res.json({ stats })
    })
    
    // POST /api/admin/pets/create
    // 创建宠物
    router.post('/pets/create', requireAuth, requireRole('admin'), (req, res) => {
      const { id, name, element, role, description, skillsJson } = req.body
      db.prepare(`
        INSERT INTO pets_template (id, name, element, role, description, skills_json, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
      `).run(id, name, element, role, description, skillsJson)
      res.json({ success: true })
    })
    
    // POST /api/admin/skins/create
    // 创建皮肤
    router.post('/skins/create', requireAuth, requireRole('admin'), (req, res) => {
      const { id, name, petId, type, price, cssClass, description } = req.body
      db.prepare(`
        INSERT INTO skins_template (id, name, pet_id, type, price, css_class, description, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).run(id, name, petId, type, price, cssClass, description)
      res.json({ success: true })
    })
    
    // POST /api/admin/quests/create
    // 创建任务
    router.post('/quests/create', requireAuth, requireRole('admin'), (req, res) => {
      const { id, name, type, description, conditionJson, rewardPoints, rewardExp } = req.body
      db.prepare(`
        INSERT INTO quests (id, name, type, description, condition_json, reward_points, reward_exp, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `).run(id, name, type, description, conditionJson, rewardPoints, rewardExp)
      res.json({ success: true })
    })
    
    // POST /api/admin/achievements/create
    // 创建成就
    router.post('/achievements/create', requireAuth, requireRole('admin'), (req, res) => {
      const { id, name, category, description, conditionJson, rewardPoints, rewardTitle, rewardSkin } = req.body
      db.prepare(`
        INSERT INTO achievements (id, name, category, description, condition_json, reward_points, reward_title, reward_skin)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, name, category, description, conditionJson, rewardPoints, rewardTitle, rewardSkin)
      res.json({ success: true })
    })
    ```

**交付物：**
```javascript
// src/server/routes/
// 包含所有11个路由文件
// 每个文件都有完整的API实现
```

#### 模块3：前端框架（难度⭐⭐⭐）

**任务描述：**
搭建前端框架，包括路由配置、状态管理、权限守卫。

**具体要求：**

1. **路由配置**
   ```typescript
   // src/client/router/index.ts
   import { createRouter, createWebHistory } from 'vue-router'
   
   const router = createRouter({
     history: createWebHistory('/pet-garden/'),
     routes: [
       // 公共路由
       { path: '/login', name: 'login', component: () => import('@/pages/Login.vue') },
       
       // 学生路由
       {
         path: '/student',
         component: () => import('@/layouts/StudentLayout.vue'),
         meta: { requiresAuth: true, role: 'student' },
         children: [
           { path: '', name: 'student-dashboard', component: () => import('@/pages/student/Dashboard.vue') },
           { path: 'pets', name: 'student-pets', component: () => import('@/pages/student/Pets.vue') },
           { path: 'battle', name: 'student-battle', component: () => import('@/pages/student/Battle.vue') },
           { path: 'shop', name: 'student-shop', component: () => import('@/pages/student/Shop.vue') },
           { path: 'gacha', name: 'student-gacha', component: () => import('@/pages/student/Gacha.vue') },
           { path: 'achievements', name: 'student-achievements', component: () => import('@/pages/student/Achievements.vue') },
           { path: 'quests', name: 'student-quests', component: () => import('@/pages/student/Quests.vue') },
           { path: 'ranking', name: 'student-ranking', component: () => import('@/pages/student/Ranking.vue') }
         ]
       },
       
       // 教师路由
       {
         path: '/teacher',
         component: () => import('@/layouts/TeacherLayout.vue'),
         meta: { requiresAuth: true, role: 'teacher' },
         children: [
           { path: '', name: 'teacher-dashboard', component: () => import('@/pages/teacher/Dashboard.vue') },
           { path: 'students', name: 'teacher-students', component: () => import('@/pages/teacher/Students.vue') },
           { path: 'points', name: 'teacher-points', component: () => import('@/pages/teacher/Points.vue') },
           { path: 'class-battle', name: 'teacher-class-battle', component: () => import('@/pages/teacher/ClassBattle.vue') }
         ]
       },
       
       // 管理员路由
       {
         path: '/admin',
         component: () => import('@/layouts/AdminLayout.vue'),
         meta: { requiresAuth: true, role: 'admin' },
         children: [
           { path: '', name: 'admin-dashboard', component: () => import('@/pages/admin/Dashboard.vue') },
           { path: 'pets', name: 'admin-pets', component: () => import('@/pages/admin/Pets.vue') },
           { path: 'skins', name: 'admin-skins', component: () => import('@/pages/admin/Skins.vue') },
           { path: 'quests', name: 'admin-quests', component: () => import('@/pages/admin/Quests.vue') },
           { path: 'achievements', name: 'admin-achievements', component: () => import('@/pages/admin/Achievements.vue') }
         ]
       }
     ]
   })
   
   // 路由守卫
   router.beforeEach((to, from, next) => {
     const authStore = useAuthStore()
     
     if (to.meta.requiresAuth && !authStore.isLoggedIn) {
       next('/login')
     } else if (to.meta.role && authStore.user?.role !== to.meta.role) {
       next('/')
     } else {
       next()
     }
   })
   
   export default router
   ```

2. **Pinia状态管理**
   ```typescript
   // src/client/stores/auth.ts
   import { defineStore } from 'pinia'
   
   export const useAuthStore = defineStore('auth', {
     state: () => ({
       user: null as User | null,
       token: localStorage.getItem('token') || null
     }),
     getters: {
       isLoggedIn: (state) => !!state.token,
       isAdmin: (state) => state.user?.role === 'admin',
       isTeacher: (state) => state.user?.role === 'teacher',
       isStudent: (state) => state.user?.role === 'student'
     },
     actions: {
       async loginAsStudent(studentNumber: string, realName: string) {
         const res = await fetch('/api/auth/student/login', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ studentNumber, realName })
         })
         const data = await res.json()
         if (data.success) {
           this.user = data.user
           this.token = data.token
           localStorage.setItem('token', data.token)
         }
         return data.success
       },
       async loginAsAdmin(username: string, password: string) {
         const res = await fetch('/api/auth/admin/login', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ username, password })
         })
         const data = await res.json()
         if (data.success) {
           this.user = data.user
           this.token = data.token
           localStorage.setItem('token', data.token)
         }
         return data.success
       },
       async logout() {
         await fetch('/api/auth/logout', { method: 'POST' })
         this.user = null
         this.token = null
         localStorage.removeItem('token')
       }
     }
   })
   
   // src/client/stores/pets.ts
   export const usePetStore = defineStore('pets', {
     state: () => ({
       templates: [] as PetTemplate[],
       myPets: [] as PlayerPet[],
       selectedTeam: [] as string[]
     }),
     actions: {
       async loadTemplates() {
         const res = await fetch('/api/pets')
         const data = await res.json()
         this.templates = data.pets
       },
       async loadMyPets() {
         const res = await fetch('/api/pets/my')
         const data = await res.json()
         this.myPets = data.pets
       },
       async awakenPet(petId: string) {
         const res = await fetch(`/api/pets/${petId}/awaken`, { method: 'POST' })
         const data = await res.json()
         if (data.success) {
           await this.loadMyPets()
         }
         return data
       }
     }
   })
   
   // src/client/stores/battle.ts
   export const useBattleStore = defineStore('battle', {
     state: () => ({
       battleState: null as BattleState | null,
       battleLog: [] as string[]
     }),
     actions: {
       async startPVE(teamPetIds: string[]) {
         const res = await fetch('/api/battle/pve/start', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ teamPetIds })
         })
         const data = await res.json()
         this.battleState = data.state
         return data
       },
       async useSkill(skillId: string) {
         const res = await fetch('/api/battle/pve/action', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ battleId: this.battleState.id, skillId })
         })
         const data = await res.json()
         this.battleState = data.result.state
         this.battleLog.push(...data.result.log)
         return data
       }
     }
   })
   
   // src/client/stores/points.ts
   export const usePointsStore = defineStore('points', {
     state: () => ({
       totalPoints: 0,
       history: [] as PointsRecord[]
     }),
     actions: {
       async loadPoints() {
         const res = await fetch('/api/points/me')
         const data = await res.json()
         this.totalPoints = data.totalPoints
         this.history = data.history
       }
     }
   })
   ```

3. **API封装层**
   ```typescript
   // src/client/api/index.ts
   import axios from 'axios'
   
   const api = axios.create({
     baseURL: '/api',
     timeout: 5000
   })
   
   // 请求拦截器
   api.interceptors.request.use((config) => {
     const token = localStorage.getItem('token')
     if (token) {
       config.headers.Authorization = `Bearer ${token}`
     }
     return config
   })
   
   // 响应拦截器
   api.interceptors.response.use(
     (response) => response.data,
     (error) => {
       if (error.response?.status === 401) {
         localStorage.removeItem('token')
         window.location.href = '/login'
       }
       return Promise.reject(error)
     }
   )
   
   export default api
   ```

4. **权限守卫**
   ```typescript
   // src/server/middleware/auth.ts
   import { Request, Response, NextFunction } from 'express'
   import jwt from 'jsonwebtoken'
   
   export function requireAuth(req: Request, res: Response, next: NextFunction) {
     const token = req.headers.authorization?.replace('Bearer ', '')
     
     if (!token) {
       return res.status(401).json({ error: '未登录' })
     }
     
     try {
       const decoded = jwt.verify(token, JWT_SECRET) as any
       req.user = decoded
       next()
     } catch {
       return res.status(401).json({ error: 'Token无效' })
     }
   }
   
   export function requireRole(...roles: string[]) {
     return (req: Request, res: Response, next: NextFunction) => {
       if (!roles.includes(req.user.role)) {
         return res.status(403).json({ error: '权限不足' })
       }
       next()
     }
   }
   ```

**交付物：**
```typescript
// src/client/
// router/index.ts
// stores/auth.ts, pets.ts, battle.ts, points.ts
// api/index.ts
// middleware/auth.ts
```

#### 模块4：集成测试与汇总（难度⭐⭐⭐）

**任务描述：**
确保整个系统能正常运行，修复Bug，部署上线。

**具体要求：**

1. **单元测试**
   ```javascript
   // tests/api/auth.test.js
   describe('Auth API', () => {
     test('学生登录成功', async () => {
       const res = await request(app)
         .post('/api/auth/student/login')
         .send({ studentNumber: '2026001', realName: '张三' })
       expect(res.status).toBe(200)
       expect(res.body.success).toBe(true)
     })
     
     test('管理员登录成功', async () => {
       const res = await request(app)
         .post('/api/auth/admin/login')
         .send({ username: 'admin', password: '123456' })
       expect(res.status).toBe(200)
       expect(res.body.success).toBe(true)
     })
   })
   ```

2. **端到端测试**
   ```javascript
   // tests/e2e/battle.test.js
   describe('战斗系统', () => {
     test('完整战斗流程', async () => {
       // 1. 登录
       // 2. 选择宠物
       // 3. 开始战斗
       // 4. 使用技能
       // 5. 验证结果
     })
   })
   ```

3. **性能测试**
   ```javascript
   // tests/performance/api.test.js
   describe('API性能', () => {
     test('并发100用户', async () => {
       const promises = Array(100).fill(null).map(() => 
         request(app).get('/api/pets')
       )
       const results = await Promise.all(promises)
       expect(results.every(r => r.status === 200)).toBe(true)
     })
   })
   ```

4. **代码合并**
   ```bash
   # 合并KIMI的代码
   git checkout dev
   git merge dev-kimi
   # 解决冲突
   git push origin dev
   
   # 合并DSH的代码
   git checkout dev
   git merge dev-dsh
   # 解决冲突
   git push origin dev
   ```

5. **部署上线**
   ```bash
   # 构建前端
   npm run build
   
   # 上传到服务器
   scp -r dist/* ubuntu@110.40.142.247:/var/www/hw-platform/pet-garden/
   
   # 重启后端
   ssh ubuntu@110.40.142.247 "cd /opt/pet-garden-server && pm2 restart all"
   ```

**交付物：**
- 完整的测试报告
- 部署文档
- 用户手册

### 你的工作流程

1. **先规划架构**
   - 输出数据库ER图
   - 输出API接口文档
   - 输出前端路由结构
   - 等待KIMI和DSH确认

2. **确认后再执行**
   - 架构确认后开始编码
   - 每个模块完成后提交代码

3. **每日提交代码**
   ```bash
   git add .
   git commit -m "feat(api): 添加宠物觉醒接口
   
   - POST /api/pets/:id/awaken
   - 支持0-4阶觉醒
   - 消耗积分扣减
   
   Closes #15"
   git push origin dev-qoder
   ```

4. **每日检查其他Agent代码**
   ```bash
   # 审查KIMI的代码
   git checkout dev-kimi
   # 阅读代码，检查质量
   # 提出问题或建议
   
   # 审查DSH的代码
   git checkout dev-dsh
   # 阅读代码，检查质量
   # 提出问题或建议
   ```

5. **每日汇报进度**
   ```markdown
   ## Qoder 日报 - 2026-11-03
   
   ### 今日完成
   - ✅ 数据库表结构设计（15张表）
   - ✅ 用户认证API
   - ✅ 训练师API
   
   ### 代码提交
   - commit: def5678
   - 分支: dev-qoder
   - 文件: src/server/schema.sql, src/server/routes/auth.ts
   
   ### 代码审查
   - KIMI: 战斗引擎代码质量良好，无问题
   - DSH: 觉醒CSS特效需要优化性能
   
   ### 遇到问题
   - 无
   
   ### 明日计划
   - 完成宠物API
   - 开始前端路由配置
   ```

### 你的交付标准

- ✅ 所有API必须有输入验证
- ✅ 数据库必须有索引优化
- ✅ 前端必须有错误处理
- ✅ 必须有单元测试（覆盖率>80%）
- ✅ 必须有完整的文档

### 你需要与谁协作

- **KIMI：** 审查他的算法代码，集成到API中
- **DSH：** 审查她的UI代码，确保能正常调用API
- **用户：** 确认架构设计，测试功能

### 你需要访问的资源

- **现有代码：** `d:\课件\platform\class-pet-garden\`
- **GitHub仓库：** `https://github.com/mamapopoooo/class-pet-garden`
- **服务器地址：** `http://110.40.142.247/pet-garden/`
- **SSH访问：** `ssh ubuntu@110.40.142.247`

---

## 📝 用户（你）完整提示词

### 你的角色

你是**产品经理和美工师**，负责需求确认、美工资源、最终测试。

### 你的任务清单

1. **需求确认**
   - 审核KIMI的架构设计
   - 审核DSH的UI设计
   - 审核Qoder的数据库/API设计
   - 确认后立即反馈

2. **美工资源**
   - 用Midjourney/DALL-E生成12只新宠物图片
   - 生成UI素材（背景、图标、徽章）
   - 上传到GitHub仓库

3. **功能测试**
   - 每日测试各Agent提交的功能
   - 反馈Bug和改进建议

4. **最终验收**
   - 确认所有功能符合要求
   - 确认系统稳定运行

### 你的工作流程

1. **每日审核架构设计**
   - 10:00前审核KIMI的设计文档
   - 10:00前审核DSH的设计稿
   - 10:00前审核Qoder的架构文档
   - 立即反馈确认或修改意见

2. **每日生成美工资源**
   - 15:00前上传宠物图片
   - 15:00前上传UI素材

3. **每日功能测试**
   - 17:00前测试KIMI的算法
   - 17:00前测试DSH的UI
   - 17:00前测试Qoder的API

4. **每日汇报进度**
   ```markdown
   ## 用户日报 - 2026-11-03
   
   ### 审核结果
   - KIMI: 架构设计合理，确认通过
   - DSH: UI设计需要调整配色方案
   - Qoder: API设计完整，确认通过
   
   ### 测试发现的问题
   - Bug #1: 战斗引擎属性克制计算错误（指派给KIMI）
   - Bug #2: 觉醒特效动画卡顿（指派给DSH）
   
   ### 美工资源
   - 已上传：12只新宠物图片
   - 已上传：5张背景图
   
   ### 明日计划
   - 继续测试新功能
   - 生成更多UI素材
   ```

### 你需要访问的资源

- **GitHub仓库：** `https://github.com/mamapopoooo/class-pet-garden`
- **测试环境：** `http://110.40.142.247/pet-garden/`
- **美工工具：** Midjourney / DALL-E

---

## 🚀 下一步行动

**各Agent立即开始：**

1. **KIMI：** 输出战斗引擎架构设计文档
2. **DSH：** 输出UI设计稿
3. **Qoder：** 创建GitHub仓库，初始化项目结构
4. **用户：** 准备美工资源，审核架构设计

**每日汇报时间：** 18:30

**方案确认后，立即开始工作！** 🎯
