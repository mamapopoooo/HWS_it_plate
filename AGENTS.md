# AGENTS.md — 王宠课堂 2.0（v3）

> 本文件是**所有 AI Agent 的入场指南**。动手前先读完这一页，再读 `docs/00-总纲-架构基线与内容扩展规范.md`（权威基线）。
> 冲突时优先级：**直接用户指令 > 本文件 > 00-总纲 > 其他文档 > 历史提示词**。

---

## 一、项目一句话

面向中小学课堂的**积分 + 养成 + 对战**平台：教师课堂加分为唯一货币，学生抽签集宠、斗法、冲榜。
v3 起改为**中国风水墨**、**五阶品阶**、**八卦八属性**。

---

## 二、命令（先看这条，本机有坑）

本机 PowerShell 执行策略会拦 `npx` 与 `npm.ps1`，**用 `node` 直跑二进制**：

```powershell
node node_modules\vue-tsc\bin\vue-tsc.js --noEmit    # 类型检查（必须 0 错误）
node node_modules\vitest\vitest.mjs run              # 单测（45 条必须全绿）
node node_modules\vite\bin\vite.js                   # 开发服务器（3001）
node node_modules\vite\bin\vite.js build             # 构建
node scripts\verify-build.mjs                        # 产物自检
node docs\seeds\_validate.mjs                        # 种子数据一致性
node server\index.js                                 # 后端（3002）
```

---

## 三、目录与职责边界

```
src/api/          types.ts 契约 · demo.ts 占位数据 · adapter.ts 取数（接口优先、失败回落）
src/config/       gameConfig.ts 规则数值 · contentConfig.ts 内容访问
src/pages/        v3 页面（学生端 12 + 教师端 5）；v2 旧页面已于 2026-11-04 全部删除
src/components/   layout/ · pet/ · gacha/
src/utils/        gacha.ts · duel.ts（纯函数 + 单测）
src/styles/       tokens.css（国风令牌）· game.css · battle.css
docs/seeds/       全部内容数据（唯一来源）
server/           Express；算法与迁移归 KIMI / Qoder
```

**分工（2026-11-12 起调整）：**

| Agent | 职责 | 只改 |
|---|---|---|
| **GPT** | **总审核把控** + **美工**（出图、立绘、背景素材） | 审阅所有分支与 PR；产出 `public/` 下的美术资源；不改业务代码 |
| **Codex** | **最终整合与修正**（合分支、解冲突、修 P0） | 以整合分支为准，统一收口 `server/` 与 `src/api/` 的契约 |
| **DSH**（本角色） | UI/UX 实现 | `src/pages/` `src/components/` `src/styles/` `docs/` 设计稿 |
| **KIMI** | 算法 | `server/game/` 与 `src/utils/*.ts` 的算法与测试 |
| **Qoder** | 名单 / 教师端功能（已交接） | 成果在 `origin/dev-qoder`，等 Codex 合并 |

**协作要点：**

- 各人提交在自己的 `dev-xxx` 分支，**由 Codex 统一合并**；不要直接在 `dev` / `main` 上改。
- 交接与技术决策写在 `docs/` 下的交接清单里（见 `docs/交接-Codex总审核清单.md`）。
- **P0 待决**：学生登录存在三套实现（`auth.js` / `game-v2.js` / qoder 的 roster 版），合并前必须统一，否则名单登录失效、同一学生会生成两条 `users` 行。

---

## 四、六条架构铁律（违反会被人骂）

1. **内容即数据** —— 加宠物 / 活动 / 皮肤 / 任务 / 成就 / 榜种，只插 `docs/seeds/*.json` 一行，不改代码。
2. **枚举集中** —— 品阶、八卦、形态、价格、概率只在 `src/config/` 与 seeds 定义，其他地方引用。
3. **只加不删** —— 数据库迁移只 `CREATE`/`ADD COLUMN`；API 字段只增不删（旧字段标 `deprecated`）。
4. **前端不硬编码内容** —— 组件里**不许出现**「四象」「万象」等中文字面量，一律 `tierName(tier)`；图鉴分卷用 `TIERS.map()`。
5. **表现层可替换** —— 战斗外壳是 Vue+CSS，特效层走 `play(type, side)` 接口，换 PixiJS/Rive 不动流程。
6. **数值与文档不许漂移** —— 改一条规则，同时改 00-总纲 与同步清单。

---

## 五、数据怎么流

```
docs/seeds/*.json → src/config/*.ts（类型化 + 计算）→ src/api/adapter.ts → 页面
```

- 页面**只调 adapter**，不许直接 `axios`、不许自带 `DEMO_*` 常量；
- `adapter.ts` 每个函数都是「先打 `/v2` 接口，1.5s 内失败则回落 `api/demo.ts`」；
- 接口字段不一致时，**只改 adapter 里的 pick 函数**，页面不动。

**加一只宠物（0 行代码）：** `pets.json` 插一项（`tier`/`trigram`/`style`/`pinyin`）+ 放图 `public/pets/{id}/form{N}.png` → 刷新，图鉴自动分卷、抽签池自动包含。

---

## 六、代码风格

**Vue SFC 顺序：** `<script setup lang="ts">` 内按「导入 → 类型 → 状态 → 计算属性 → 函数 → 生命周期」排列，然后 `<template>`，最后 `<style scoped>`。

- TypeScript 严格模式（`noUnusedLocals`/`noUnusedParameters` 开着，未使用的变量会直接报错）；
- **注释与 UI 文案用中文**；
- 命名：组件 PascalCase，变量/函数 camelCase，常量 SCREAMING_SNAKE_CASE；
- 样式：新页面优先用 `var(--ink)` 等国风令牌，不要写死色值；
- 缺图兜底是硬要求：立绘缺失要退化卦象字符 / 姓氏印章，**不许出现破图**。

---

## 七、验收门槛（每次提交前）

```powershell
node node_modules\vue-tsc\bin\vue-tsc.js --noEmit   # 0 错误
node node_modules\vitest\vitest.mjs run             # 45 条全绿
node node_modules\vite\bin\vite.js build            # 通过
node scripts\verify-build.mjs                       # "通过：构建产物可用于部署"
```

涉及 seeds 时额外跑 `node docs\seeds\_validate.mjs`。

---

## 八、明确不要做的事

| 不要 | 原因 |
|---|---|
| 在共享目录 `class-pet-garden` 里切分支提交 | 已发生两次分支互踩、未提交改动被冲掉。**各开 worktree**：`git worktree add ..\pet-garden-xxx dev-xxx` |
| 恢复 v2 的 `src/pages/v2/`、`/student`、`/admin` | 已于 2026-11-04 全部下线，功能已被 v3 覆盖；如需旧代码看 git 历史 |
| 给属性克制加回 ×0.77 | 对宫 `opposite` 互指，那条分支永远不可达（2026-11-03 单测发现） |
| 把价格/概率写进组件或接口 | 唯一来源是 `docs/seeds/economy.json` 与 `tiers.json` |
| 让学生自填技能数值 | 造物只能用效果池 + 120 灵力预算，防「一击必杀」 |
| 绕过 UGC 图片检测 | 上传必须走 `src/utils/nsfw.ts` 的 `checkImage()`；红线见 `docs/内容安全红线.md` |
| 引入 Phaser / Cocos | 回合制无物理需求，且与 Vue 状态双份维护。见 `docs/战斗引擎选型.md` |
| 删改 v1 遗留的 `server/routes/`（v1 部分） | 还在服务旧数据，迁移完成后再清 |

---

## 九、文档索引

| 文档 | 用途 |
|---|---|
| `docs/文档状态总表.md` | **先看这张**：现行 / 归档文档一览，避免照旧文档做 |
| `docs/00-总纲-架构基线与内容扩展规范.md` | **权威基线**（原则 / 分层 / 扩展点 / 数值 / 契约） |
| `docs/品阶体系改造-各Agent同步清单.md` | 各 Agent 改造清单 + adapter 期望字段 |
| `docs/品阶体系-v3-中国风设计规范.md` | 视觉语言、风格光谱、美术生产规范 |
| `docs/战斗引擎选型.md` | 战斗表现层选型论证 |
| `提示词-KIMI.md` / `提示词-DSH.md` | 角色提示词（v3） |
| `docs/seeds/*.json` | 全部内容数据 |
| `各Agent完整提示词-新人版.md` | 历史版（v2 内容），仅作背景参考 |
