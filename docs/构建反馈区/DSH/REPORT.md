# DSH 汇报区

维护者：DSH。每条追加一节，保留历史，不覆盖旧结论。

---

## DS-R4 / 按第四轮指令完成 rowPlans 展示与批次语义 / 2026-11-13

- 状态：**待复验**
- 基线：整合分支 `1c8af2e`（含 Qoder S2 rowPlans 与 Codex 代理修正）
- 补丁提交：见本轮推送 SHA（`fix(dsh): 预演按服务端 plan 判定 + 完整批次提交`）
- 本批文件：`src/pages/v3/admin/Students.vue`、本报告
- **未改** `src/api/`、`vite.config.ts`、后端；已删除上一轮的临时双代理配置

### 一、按指令逐条落实

| 指令 | 实现 |
|---|---|
| rowTag 优先读 `plan.action` | 有 plan 时：`reject`→「拒绝」、`update`→「更新」、其余→「新增」；无 plan 才降级用 `existingNos` 仅作参考 |
| reject 展示 errors 与 warnings | 每行渲染 `plan.warnings`（橙）与 `plan.errors`（红加粗） |
| 不把服务端拒绝行标成新增/更新 | 由上一行保证；`reject` 单独分类 |
| 展示 unchanged | 预览汇总新增「无变化 N」；提交 toast 也带 `无变化 N 人` |
| created=0/updated=0 不当失败 | toast 改为拼接式「导入完成：新增 X 人，更新 Y 人，无变化 Z 人，N 行被拒绝」，0 也正常显示 |
| 原批次完整发送、不过滤空白姓名行 | `importable` 改为 `imp.rows.length`；`doImport` 仍提交 `imp.rows` 全量，逐行拒绝交给服务端 |
| 只用完整方案才可确认 | 保留 Codex 的 `hasRowPlans` 双重阻断（按钮 disabled + 函数内 return） |

### 二、实测证据（隔离端口 3004 + 本工作区数据库，虚构学号 9900xx）

**A. 简表（只有学号 + 姓名）**

```
total=2 create=0 update=0 unchanged=1 invalid=1
990001 action=update write=[] skip=[name,nameEn,gender,class,course] warn=1
990002 action=reject write=[] skip=[] err=1  →「该学号存在身份冲突，请先核对旧账号…」
```

**B. 空白列保留**

```
action=update write=[] skip=[name,nameEn,gender,class,course]
warnings: 英文名列为空，本次保留原值 / 班级列为空，本次保留原值 / 本次没有需要更新的列，档案保持原样
```

**C. 同一批重复学号**

```
invalid=2，两行均 action=reject
errors：「同一份表格里这个学号出现多次，请合并成一行后重传」
```

**D. 新生缺必要信息**

```
990006 → action=reject，errors：「新增学生必须有中文名」「新增学生必须有班级」
```

**E. 转班 / 改学号**

```
PUT /api/v3/roster/students/:id { classId }  → success
PUT /api/v3/roster/students/:id { studentNo: '990007'→'990008' } → success
DB 核对：students.student_no=990008，users.username=990008，users.class_id_ref 同步
```

**F. 混合提交（新增/无变化/拒绝）**

```
rows = [990020 新, 990001 无变化, 990012 缺姓名]
返回：created=0 updated=0 unchanged=1 rejected=2
```

### 三、两条后端发现（不属我职责，供 Codex/Qoder 判断）

1. **导入的「班级」是班级名，不是 classId**。传 `classId` 会被忽略并报「新增学生必须有班级」；必须传 `class: '六年级A班'`。页面已按表头 `class` 字符串提交，符合契约；但接口若同时接受 id 会更稳。
2. **新生年级推导在当前库失败**：`classes` 表没有 `grade` 列（`PRAGMA` 报 `no such column: grade`）。即使班级名是「六年级A班」且 `parseGrade('', '六年级A班') === 6`，规划仍返回
   「无法从班级或课程确定年级，请补全「班级」（如七年级B班）或「课程」（如信息技术 G7）后重传」。
   用 `course: '信息技术 G6'` 同样被「新增学生必须有班级」拦下。
   → 结果：**新建学生这条路径目前无法通过导入完成**（更新既有学生正常）。建议 Qoder 检查 `plan.writes.class_name` 在规划阶段是否真的被写入。

### 四、检查结果

| 检查 | 结果 |
|---|---|
| `vue-tsc --noEmit` | ✅ 0 错误 |
| `vitest run` | ✅ 20 文件 / **294 测试**通过 |
| `vite build` | ✅ 通过 |
| `verify-build` | ✅ 通过 |
| 代理修正 | ✅ 前端已改为 `API_ROOT='/api'`；我用 `API_PROXY_TARGET=http://localhost:3004` 启动预览，未改 `vite.config.ts` |

### 五、页面证据的限制（必须说明）

本环境**无法截图**（无浏览器自动化）。我能提供的是：接口级实测、DB 核对、逐行 plan 原始返回，以及可复现的操作步骤。
Codex 要求「记录截图或可复现浏览器证据」，我需要：① 你给我一张页面截图，或 ② 授权我安装 Playwright 截图（会增加 devDependency，属共享配置，需你同意）。

### 六、/duel 本地演练

`Duel.vue` 结果页已写「本场为本地演练，暂不计入正式战绩或奖励」，`reportBattle` 为 fire-and-forget 且失败不影响结算文案；不会暗示已保存正式战绩。正式权威流程等 KIMI/Codex 契约。


---

## DS-BLK-03 / 前端 API 前缀与 dev 代理不一致（新发现，需 Codex 处理）/ 2026-11-13

- 状态：**待审核（P1，阻断页面级登录验收）**
- 基线：`5ab3057` 之后的本地测试运行；工作区/分支同上
- 归属：`src/api/index.ts` 与 `vite.config.ts` 都属 Codex 收口范围，我**没有改**

### 现象

前端实际请求路径是 **`/pet-garden/api/...`**：

```ts
// src/api/index.ts
export const API_ROOT = `${import.meta.env.BASE_URL}api`.replace(/\/+$/, '')   // = /pet-garden/api
```

而 `vite.config.ts` 的代理规则只有 **`'/api'`**，且 `deploy.sh` 的断言也是 `/api/*`：

```ts
proxy: { '/api': { target: 'http://localhost:3002', changeOrigin: true } }
```

### 实测证据（同一后端，只改代理规则）

| 代理规则 | 请求路径 | 结果 |
|---|---|---|
| 仅 `/api`（**仓库现状**） | `POST /api/auth/admin/login` | **200 JSON** ✓ |
| 仅 `/api`（**仓库现状**） | `POST /pet-garden/api/auth/admin/login` | **404** ❌ |
| 两前缀都代理（我本地临时配置） | `POST /pet-garden/api/auth/admin/login` | 200 JSON ✓ |

即：**按仓库现有配置，登录页发出的请求必然 404**（生产环境则是落到 SPA 兜底页拿到 HTML，正是 deploy.sh 里记录的 2026-11-12 那次事故）。

### 影响

- 页面级无法验登录（我的接口级 L1–L8 是直接打 `/api` 的，所以没暴露这条）
- 生产 Nginx 只转 `/api`，同一问题会重现

### 建议（二选一，需 Codex 定）

1. **改前端**：`API_ROOT = '/api'`（不拼 BASE_URL），与 dev 代理和 `deploy.sh` 对齐 —— 我倾向这条，最小改动
2. **改配置**：vite 代理与 Nginx 同时接受 `/pet-garden/api`（保留前缀），但要同步 `deploy.sh` 断言

我本地为继续验收临时用了「两前缀都代理」的配置（`vite.dsh-test.config.ts`，**不入库、测完删除**），**没有提交、没有改 `vite.config.ts`**。

### 同一轮的其它实测（供 Codex 参考，均非我职责）

| 项 | 结果 |
|---|---|
| 名单导入预演 `POST /api/v3/roster/import`（dryRun） | 200，返回 `dryRun/total/wouldCreate/wouldUpdate/invalid/garbled/existingNos`；**无 `rowPlans`** |
| 因此页面表现 | 显示「详细预演尚不支持」，不伪造计划（符合契约） |
| `trainer/me` 的 `today_points` | 200，种子 5+3 → **8** ✓（数据源是 `game_points_records`） |
| `trainer/me` 的 `grade` | **返回 0**（`students.grade=0`）⚠️ 契约要求"不写 grade=0"；适配层回落成 6 所以 HUD 不显示 0，但后端数据不对，建议归 Qoder 排查 |
| `today_battles` | 0（IN-07 未修，已知） |

---

## DS-R3 / 解除 DS-BLK-01 并按 S2 落实前端补丁 / 2026-11-13（第三轮）

- 状态：**待复验**
- 绝对工作区 / 分支 / 基线：`D:\课件\platform\pet-garden-dsh` / `dev-dsh` / `5ab3057`（已同步整合分支）
- 补丁提交：见本轮推送 SHA（`fix(dsh): 名单导入保留列存在信息 + 名单入口`）
- 本批拥有文件：`src/pages/v3/admin/Students.vue`、`src/pages/TeacherDesk.vue`、`docs/art/素材清单-DSH-20261113.md`、本报告

### 一、DS-BLK-01 已解除（实际安装结果）

按你的要求，在自己的工作区独立安装，**未共享 node_modules、未换镜像、未 vendor**。

| 项 | 值 |
|---|---|
| Node | `v24.18.1` |
| npm | `11.16.0`（`C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js`） |
| 安装目录 | `D:\课件\platform\pet-garden-dsh`（本工作区，node_modules 非 junction） |
| 命令 | `node <npm-cli> ci --no-audit --no-fund` |
| 结果 | **exit 0**，317 个包目录；`xlsx 0.20.3` 可用；`better-sqlite3` 原生绑定可用 |

**过程中遇到一次 EPERM，已定位并解决（不是环境缺陷）**：

```
npm error EPERM: operation not permitted, unlink
  ...\node_modules\better-sqlite3\build\Release\better_sqlite3.node
```

原因：我自己昨天起的 `PORT=3003` 后端（PID 131580，监听 3003）仍在运行并加载了该 `.node` 文件。
处理：只停自己的 131580（qoder 的 135572 保持不动），随后 `npm ci` 一次通过。
**不需要替换依赖，也不需要改 package.json。**

### 二、DS-02：Students.vue 已改为从 adapter 导入

```ts
// 改前
} from '@/api/roster'
// 改后
} from '@/api/adapter'
```

类型同样改从 `@/api/adapter` 导入，并补充 `RosterImportField`、`RosterImportPlan`。

### 三、DS-03 / R5：表头保留列存在信息

按《名单导入契约》，前端只提交**表格里实际出现过的列**：

- `mapHeader()` 结果存入 `imp.cols`，作为"列存在性"的唯一依据
- 构造行时可选列只在 `cols[field] !== undefined` 时写入；**缺席列保持 `undefined`**，不预填空串
- 预览表把三种情况分开显示：`未提供`（列不存在）/ `空`（列存在但空）/ 具体值
- 顶部新增提示：「本次表格没有这些列：…（保留原值，不会被清空）」
- `rowPlans` 存在时逐行显示 `写入：…` / `保留：…` / 警告；**不存在时显示「详细预演尚不支持」**，不自行拼计划

### 四、/teacher 名单入口（按你的指示）

在 `TeacherDesk.vue` 头部加「名单管理」按钮 → `router.push('/admin/students')`。
**未新建第二份名单页，未删除旧链接。**

### 五、素材清单已按你的口径调整

第一批改为 **3 张**：`pet_qinglong` form1 + `skin_base_m` + `skin_base_f`。
白虎/朱雀/玄武移入"下一批候选"，并注明"样稿阶段不扩量"。

### 六、本轮实际执行的检查

| 检查 | 命令 | 结果 |
|---|---|---|
| 依赖安装 | `node npm-cli ci` | ✅ exit 0（317 包） |
| 类型检查 | `vue-tsc --noEmit` | ✅ **0 错误**（此前 xlsx 报错消失） |
| 单测 | `vitest run` | ✅ 13 文件 / **233 测试**通过 |
| 构建 | `vite build` | ✅ 通过 |
| 产物自检 | `verify-build.mjs` | ✅ 通过 |

### 七、未验证 / 仍待

- **页面截图**：无头环境无法截图，登录矩阵 H1–H8 与名单页仍需人工在浏览器点一遍；我可在你要求下启动 3001 预览并给出逐步操作清单
- 名单导入预演的真实 `rowPlans`：需 Qoder 后端实现后才能端到端验（当前走"尚不支持"分支）
- `today_battles` 真数：等 IN-07
- DS-BLK-02（乱码脚本）按你的判定归 QD-05，我未改

### 八、需要 Codex 复验

1. `vue-tsc`/`build` 是否在你侧同样通过（我已附 Node/npm 版本与命令）
2. `Students.vue` 缺席列语义是否与契约一致（我按"不写该键"实现）
3. `/teacher` → `/admin/students` 入口是否符合预期


---

## DS-R2 / 路由核查、登录验收与首批素材清单 / 2026-11-13（第二轮）

- 状态：**待审核**（含 2 项阻塞请示）
- 绝对工作区 / 分支 / 基线：`D:\课件\platform\pet-garden-dsh` / `dev-dsh` / 已同步 `origin/dev-codex-integration-20261113` @ `24a939e`（代码接续 `bbb030e`）
- 涉及文件：`docs/构建反馈区/DSH/REPORT.md`、`docs/验收矩阵-DSH-20261113.md`、`docs/art/素材清单-DSH-20261113.md`、`docs/handoffs/DSH-20261113.md`

### 回应 DS-01（路由真实性）

实测 `src/router/index.ts`：**34 条路由记录，四组并存**。

| 组 | 路径 | 页面 | 是否可达 |
|---|---|---|---|
| A | `/lobby` `/collection` `/pet/:id` `/gacha` `/ranking` `/shop` `/quests` `/achievements` `/character` `/custom` `/events` `/duel` | `src/pages/*.vue`（DSH） | 登录后落地 |
| B | `/student` + 9 子路由 | `src/pages/v3/student/*`（Qoder） | 手输 URL 可达 |
| C | `/teacher` `/review` `/teacher/content` | `src/pages/*.vue`（DSH） | 管理员落地 |
| D | `/admin` + 5 子路由 | `src/pages/v3/admin/*`（Qoder） | 手输 URL 可达 |

**不擅自删改**：按 DS-01，我不据旧文档删 `/student`、`/admin`。请 Codex 明确两点：

1. B/D 是否长期保留？若保留，**同一学生从 A 与 B 进来数据口径不同**（B 走 `stores/game.ts`、`stores/points.ts`，A 走 `adapter.ts`）。
2. `/admin/students` 是当前唯一名单管理界面，整合后是迁到 `/teacher/students` 还是保留原位？我按结论再动 UI。

### 回应 DS-05（素材缺口）

`node scripts/check-art.mjs` 实跑：**宠物 0/98、角色 0/10**。
已产出 [`docs/art/素材清单-DSH-20261113.md`](../art/素材清单-DSH-20261113.md)：第一批只出 **6 张**（四象 4 只首形态 + 男女素衣），含真实 ID、精确路径（`public/pets/qinglong/form1.png`）、尺寸与构图。
另注明：`public/pets/` 下 33 个目录是 v1 遗留素材，**不算已交付**。

### 回应 DS-04（登录与 HUD 验收）

详见 [`docs/验收矩阵-DSH-20261113.md`](../验收矩阵-DSH-20261113.md)。接口侧 8 条登录用例全通过：

```
L1 中文名 200        L2 英文名 200        L3 大小写+空格 200   L4 姓名错 401
L5 学号不存在 401    L6 空姓名 400        L7 legacy stu_* 409  L8 教师占学号 409
```

`GET /api/v2/trainer/me` 已返回 `real_name / name_en / character_nickname / class_name / game_points / today_points / today_battles / fragment_total / roster_gender`，HUD 映射字段齐全。

**页面截图仍缺**：门禁不过（见 DS-BLK-01）+ 无截图环境；H4「今日斗法」在 IN-07 修好前只能验显示链路。

### 阻塞请示（需要 Codex 决定）

**DS-BLK-01：`xlsx` 依赖导致类型门禁失败**

- 复现：`node node_modules\vue-tsc\bin\vue-tsc.js --noEmit` →
  `src/pages/v3/admin/Students.vue(211,23): Cannot find module 'xlsx'`，另有 458/466 行隐式 any
- 现状：`package.json` 声明 `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`，我的工作区未安装（且依赖不应共用他人 node_modules）
- 影响：`vue-tsc` 与 `vite build` 均红，前端门禁不可用；而 `Students.vue` 已按 DS-02 移交我维护
- 请定：① vendoring 进仓库 ② 换内网镜像 ③ 换轻量解析（仅 csv/粘贴文本）。定完我改 import 并补隐式 any

**DS-BLK-02：乱码门禁脚本在缺文件时崩溃**

- 复现：`node scripts\check-mojibake.mjs` → `ENOENT: docs/seeds/students-real.json`
- 原因：真实名单按规范不入库，脚本未做存在性判断
- 影响：门禁无法复跑（任何 Agent 都会踩）
- 建议：缺失时跳过并提示「无真实名单，跳过」

### 本轮实际执行的检查

| 检查 | 命令 | 结果 |
|---|---|---|
| 基线同步 | `git merge origin/dev-codex-integration-20261113` | 无冲突 |
| 类型检查 | `vue-tsc --noEmit` | ❌ 见 DS-BLK-01 |
| 单测 | `vitest run` | ✅ 12 文件 / 231 通过 |
| 乱码门禁 | `check-mojibake.mjs` | ❌ 见 DS-BLK-02 |
| 服务启动 | `PORT=3004 node server/index.js` | ✅ health 200、教师登录 200 |
| 登录矩阵 | 见验收矩阵 L1–L8 | ✅ 8/8 |
| trainer/me | 学生 token 请求 | ✅ 19 字段齐全 |

### 未验证

页面级截图（H1–H8、R1–R5）、`vite build`、名单导入预演（等 IN-04 契约）、转班/改学号（等 IN-06）、素材（等 GPT-ART）。

### 需要 Codex 接棒/知会

- DS-BLK-01、DS-BLK-02
- DS-01 的两个问题（B/D 长期去留、`/admin/students` 落点）
- 一条供身份盘点用的事实：`POST /api/v3/roster/students` 建学生时会**同时创建 `users` 行**（`username=学号`、`role=student`），所以"教师占学号"冲突需手工构造才能复现
