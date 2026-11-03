# 品阶体系改造 · 各 Agent 同步清单（v2，对齐 00-总纲）

> **生效：** 2026-11-03 · **分支：** `dev-dsh`
> **权威基线：** [`00-总纲-架构基线与内容扩展规范.md`](./00-总纲-架构基线与内容扩展规范.md)
> **本文件只做一件事：告诉你"改哪里、按什么契约改"。** 与总纲冲突时以总纲为准。

---

## 0. 一句话

宠物体系从「6 属性 + 1–6 星 + 深空科幻」改成「**8 卦属性 + 五阶品阶 + 中国风水墨**」，新增**角色与皮肤系统**、**无极造物（UGC）**、**三榜排行榜**；并且**一切内容必须能靠插数据行扩展，不许写死在代码里**。

---

## 1. 👨‍💻 KIMI —— 算法与数值

### 1.1 属性：6 → 8（读配置，不写死）

```ts
// 从 GET /api/v2/config 拿 trigrams，不要在代码里写死八对常量
// trigram_config: { code, name, symbol, color, opposite, sort_order }
export function getCoefficient(cfg: TrigramConfig, atk: string, def: string): number {
  if (cfg[atk].opposite === def) return 1.3
  if (cfg[def].opposite === atk) return 0.77
  return 1.0
}
```

- 四象**双属性**（青龙=震+巽、白虎=乾+兑、朱雀=离、玄武=坎）：防御取两者最优；
- 太极**全属性**：不受克制（恒 1.0），自带 15% 常驻减伤；
- 旧 6 属性迁移映射：`fire→离, water→坎, grass→巽, electric→震, light→乾, dark→坤`（艮/兑为新增）。

### 1.2 品阶与战力

| tier | 名称 | 战力系数 | 形态 | 觉醒上限 | 技能数 | 抽卡率 |
|---|---|---|---|---|---|---|
| 1 | 万象 | 1.00 | 2 | 1 | 2 | 70% |
| 2 | 八卦 | 1.12 | 3 | 2 | 3 | 22% |
| 3 | 四象 | 1.25 | 4 | 3 | 4 | 6.5% |
| 4 | 太极 | 1.40 | 5 | 4 | 5 | 1.5% |
| 5 | 无极 | 1.57 | 6 | 5 | 6 | 0（造物） |

```
属性 = 基础 × 品阶系数 × (1 + 0.05×(等级−1)) × (1 + 觉醒加成)
觉醒加成 = [0, 0.10, 0.25, 0.50, 1.00, 1.50]   // 0–5 阶，按品阶封顶
战力 = round(100 × 品阶系数 × 等级系数 × (1 + 觉醒加成))
```

### 1.3 抽卡与保底

- 概率走 `tier_config.gacha_rate`（配置驱动，不写死）；
- 保底：**20 抽内必出 tier≥2**，**60 抽内必出 tier≥3**；太极无保底（活动为主）；
- 价格：单抽 5 / 十连 45（`economy_config`）；
- **年级系数 G6=1.0 / G7=0.6**，所有价格换算后取整。

### 1.4 重复与碎片

重复宠物 → 灵纹碎片：`20 / 60 / 200 / 500`（按品阶）；碎片最多抵扣觉醒费用的 **50%**（`fragment.pay_ratio`）。

### 1.5 造物技能校验

- 灵力预算 **120 点**，效果 cost 从 `skill_effects.cost` 读；
- 超预算 / 技能数超 `tier_config.skill_slots` / 名称含敏感词 → 拒绝；
- 审核通过后进入对战，但**不得改写学生给的数值以外的东西**（数值本身就是系统给的）。

### 1.6 必补测试

- 8×8 属性克制矩阵（对宫 1.3 / 反向 0.77 / 其余 1.0）
- 四象双属性防御取最优、太极无弱点
- 抽卡 10000 次 tier 命中率 ±0.5%
- 保底 20/60 抽必触发
- 战力公式边界（Lv.1 觉醒 0 / Lv.7 觉醒满）
- G7 系数 0.6 下价格取整不出现 0 元

---

## 2. 💻 Qoder —— 库表、接口、种子

### 2.1 迁移（只加不删）

```
003_tier_trigram.sql     pets_template += tier / trigram / form_images / unlock_cond / source
004_character.sql        characters / skins / player_skins
005_custom_pet.sql       custom_pets += status / review_note / power_points_used；新建 custom_pet_skills
006_events_config.sql    events / ranking_config / economy_config / seasons 补字段
007_schema_migrations.sql 迁移版本表
```

> `pet_skins` 表**不删**，加注释 `-- deprecated: 皮肤已迁到角色端`。

### 2.2 接口

| 端点 | 变更 |
|---|---|
| `GET /api/v2/config` | 🆕 一次返回 tiers/trigrams/forms/economy，前端启动缓存 |
| `GET /pets/templates` | 加 `tier/trigram/formImages/source` |
| `GET /pets/my` | 加 `form/power` |
| `POST /pets/:id/awaken` | 返回 `form`、`formChanged` |
| `POST /gacha/draw` | 返回 `tier/trigram`，`rarity` 标 deprecated |
| `GET /collection` | 按 tier 分组，含隐藏位（无极 = 本命） |
| `POST /pets/hidden/check` | 🆕 双鱼齐 → 解锁造物权 |
| `GET/POST /character/*` | 🆕 角色、皮肤、昵称 |
| `GET/POST /custom-pets/*` | 🆕 提交造物 / 我的造物（含审核状态） |
| `GET/POST /admin/custom-pets/*` | 🆕 教师待审队列 / 审核 |
| `GET /rankings/:id` | 改：`metric` 读 `ranking_config`，支持 points/power/collection |
| `GET /events/active`、`POST /events/:id/claim` | 🆕 活动 |

### 2.3 种子（唯一内容入口）

`docs/seeds/` 下 `tiers.json`、`trigrams.json`、`pets.json`（38 只）、`skill_effects.json`、`skins.json`、`economy.json`，**按 id upsert、可重复执行**。

**加一只宠物 = 种子文件加一项 + 传图**，不写代码。

### 2.4 图片回落链

```
form_images[N] → 同 tier 策略映射的 lv 图 → lv1.png
```
缺图不报错，前端降级显示。

---

## 3. 🎨 DSH —— 我负责的

### 3.1 视觉

- 令牌换国风：`--paper/--ink/--cinnabar/--gold/--jade` + 八卦八色 + 四象四色；
- 组件：`TaijiAltar`（太极盘）、`TrigramRing`（卦象环）、`ScrollPanel`（卷轴）、`SealButton`（印章按钮）、`TierBezel`（五阶外框）、`FormSwitch`（换图演出）；
- 页面：Lobby / Collection（五阶分卷）/ PetDetail / Gacha（求签）/ Shop / Ranking / Battle / Quests / Achievements / Character / CustomPet / AdminReview。

### 3.2 硬约束

**组件里不出现"四象""万象"等中文字面量**，一律 `config.tierName(tier)`；图鉴分卷用 `config.tiers.map()`。否则加第六阶又要改前端。

### 3.3 不碰

数据库、算法、API 逻辑。

---

## 4. 协作契约（数据形状）

```jsonc
// 宠物
{ "id":"pet_jiuweihu", "name":"九尾狐", "tier":1, "tierName":"万象",
  "trigram":"离", "form":2, "level":5, "awakeningLevel":1, "power":143,
  "formImages":{"1":"...","2":"..."}, "source":"南山经" }

// 角色
{ "userId":"u42ab1", "gender":"female", "nickname":"小狐仙",
  "skinId":"skin_hanfu_f", "displayName":"小狐仙 · 李四" }

// 排行项
{ "rank":1, "userId":"u42ab1", "displayName":"小狐仙 · 李四",
  "value":1250, "pose":"full", "character":{"gender":"female","skinId":"skin_hanfu_f"} }

// 造物提交
{ "image":"/uploads/custom/u42ab1.png",
  "skills":[{"name":"混沌初开","effectCode":"damage_single","params":{"power":100}}],
  "powerUsed":100 }
```

**约定**：`tier` 用 1–5 数字；`tierName` 只给展示用，前端**不做字符串判断**。

---

## 5. 上传 git

我这边 shell 是低完整性级别，**无法执行 `git add/commit/push`**（写 `.git` 被系统拒绝）。请在普通 PowerShell 执行：

```powershell
cd d:\课件\platform\class-pet-garden
git status
git add docs/00-总纲-架构基线与内容扩展规范.md `
        docs/品阶体系改造-各Agent同步清单.md `
        docs/品阶体系-v3-中国风设计规范.md `
        docs/design-preview-v3.html `
        各Agent完整提示词-新人版.md
git commit -m "docs(arch): 冻结 v1 架构基线与内容扩展规范

- 新增 00-总纲：五阶品阶/八卦八属性/三轴成长/经济/G7系数/角色皮肤/无极造物/三榜排行
- 扩展点清单：加宠物、加品阶、加属性、加活动、加榜均为插数据行，0 代码
- 重写各 Agent 同步清单 v2，对齐总纲数值与契约
- 补齐视觉稿 design-preview-v3.html"
git push -u origin dev-dsh
```

| Agent | 分支 | 只改这些 |
|---|---|---|
| KIMI | `dev-kimi` | `server/game/` 算法与测试 |
| Qoder | `dev-qoder` | `server/` 迁移、路由、`docs/seeds/` |
| DSH | `dev-dsh` | `src/` 组件页面、`docs/` 设计 |

---

## 6. 变更速查（给赶时间的 Agent）

| 维度 | 旧 | 新 |
|---|---|---|
| 属性 | 6 个 | **8 卦** |
| 克制 | 三对 | **对宫相冲（配置驱动）** |
| 稀有度 | 1–6 星 | **五阶品阶** |
| 宠物皮肤 | 有 | **删除，迁到角色** |
| 角色 | 无 | **男女各 1 套 + 皮肤** |
| 最高阶 | 官方 1 只 | **每人自制 1 只（无极造物，老师审核）** |
| 排行榜 | 单一 | **三榜 + 三档展示** |
| 年级 | 同价 | **G6 ×1.0 / G7 ×0.6，分榜** |
| 扩展方式 | 改代码 | **插数据行** |
