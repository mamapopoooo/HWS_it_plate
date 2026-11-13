# AGENTS.md — 墨境课堂 2.0（v3）

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

**分工（2026-11-13 更新，以本轮用户重分工为准）：**

| Agent | 职责 | 默认修改范围 |
|---|---|---|
| **Codex** | 技术统筹、整合方案、最终整合与修正、技术验收 | 独立整合分支；统一认证与 `src/api/` 契约、跨模块冲突 |
| **GPT-ART** | 美术负责人、出图、视觉审核 | `public/` 美术资源、`docs/art/` 交付单；不改业务代码 |
| **DSH** | UI/UX、页面组件、样式动效与素材接入 | `src/pages/` `src/components/` `src/styles/` `src/layouts/` |
| **KIMI** | 算法、战斗数据链路核查与回归 | `server/game/` 算法与 `src/utils/`；跨路由修复由 Codex 分配 |
| **Qoder** | 名单与教师业务、平台后端 | 名单路由、迁移及测试；候选教师页由 Codex 整合后移交 DSH |
| **CODEX-CONTROL** | 机房管控客户端与积分接入 | 管控仓库客户端；本仓库限 `CODEX_CONTROL_*` 文档 |

**必须阅读：**
- [构建反馈区](docs/构建反馈区/README.md)：各Agent独写自己的 REPORT，Codex在对应 FEEDBACK 逐项给审核与复验要求；当前接续基线见该索引。
- [Agent分工与工作区规范-20261113](docs/Agent分工与工作区规范-20261113.md)：文件归属、独立工作区、端口/数据库隔离、当前阻塞与执行顺序。
- [各Agent当前任务提示词-20261113](docs/各Agent当前任务提示词-20261113.md)：公共前缀与各角色任务。

**工作区与交接硬要求：**
- 每个 Agent（包括同角色不同聊天）使用独立 clone/worktree、任务分支与运行资源；开工先核对绝对目录、分支、基线 SHA 和 git status。
- 禁止在共享目录切分支、清理/暂存/覆盖他人改动、强推或重写共享历史；只暂存明确属于本批任务的路径。
- `src/api/`、认证收口、共享配置和公共规范由 Codex 统一；跨归属先登记交接，避免同时修改。
- 各人写 `docs/handoffs/<角色>-<日期>.md`，记录提交、检查证据、未验证项与依赖；Codex 在整合分支三方解决冲突。
- `dev-qoder` 的交接清单包含 P0 三套登录冲突与已确认名单缺陷；main 尚无该清单，必须指定 ref 阅读。
- 保留生产冻结、真实名单不入 Git、同步上传默认关闭；本次分工不等于上线授权。

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
| 恢复 v2 的 `src/pages/v2/` 或旧业务实现 | 当前源码仍有 `/student`、`/admin` 的 v3 嵌套路由，整合期间保留；不要据历史“已删除”描述误删现行页面 |
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
