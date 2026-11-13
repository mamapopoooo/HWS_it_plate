# DSH 汇报区

维护者：DSH。每条追加一节，保留历史，不覆盖旧结论。

---

## DS-R6 / 求签接通服务端回执 + 集市明确未开通 / 2026-11-13（第五轮）

- 状态：**待复验**
- 基线：整合分支 `458ce7c`（含 Codex 的教师余额修复 `03ae4b4`）
- 补丁提交：见本轮推送 SHA
- 本批文件：`src/pages/Gacha.vue`、`src/pages/Shop.vue`、`docs/集市商品映射核对-DSH-20261113.md`、`docs/测试证据/09–13`

### 一、求签：已改为服务端权威（按指令 1/3）

| 要求 | 实现 |
|---|---|
| 用 `drawWithReceipt(kind)` | ✅ 余额/抽数/结果全部取回执 `points/pulls/results` |
| 不再本地 `drawOnce/drawMany` | ✅ 已移除；`utils/gacha` 只保留价格、保底进度、概率表 |
| 不再预扣钱包 | ✅ 点按钮不扣款，等回执后再更新余额 |
| grade 来自真实档案 | ✅ `fetchProfile()` → `profile.grade`（不再写死 6） |
| 加载已有次数/资产 | ✅ `fetchOwned()` + 回执 `pulls` 刷新"已抽 N 次"与保底进度 |
| 动画只展示回执 | ✅ `playing` 只由回执结果挑选最高品阶 |
| 失败/超时不重试、不回落 | ✅ catch 里只置 `pendingCheck=true` 并提示「可能已扣款或已发放，请到图鉴核对」「未自动重试，避免重复扣款」 |
| v2 `{kind}` 与 v2 旧 `eggType` 不混用 | ✅ 只发 `{ kind: 'single' | 'ten' }` |

**实测证据（`09/10/11` 三张）**

```
单抽前 33 → 单抽后 28（cost 5）
结果卡：万象 · 赤鱬 · 重复 +20 碎片（服务端真实结果）
保底条：距「八卦」18、距「四象」38，来自回执 pityCount
已抽次数：22 → 与回执 pityCount 一致
```

接口侧另验：`POST /api/v2/gacha/draw {kind:'single'}` → `newPoints=123 pityCount=1 cost=5`；`{kind:'ten'}` → `results=10 newPoints=33 pityCount=21 cost=45`，与 adapter 的归一化（`newPoints→points`、`pityCount→pulls`）一致。

### 二、集市：禁用假成交（按指令 2）

- 删除本地 `buy()` 扣钱包逻辑，按钮恒为禁用，文案区分「未开通 / 灵石不足」
- 顶部常驻说明：「集市成交尚未开通：当前只展示价目，不会扣灵石」
- 映射核对见 [`docs/集市商品映射核对-DSH-20261113.md`](../集市商品映射核对-DSH-20261113.md)：
  **配置 9 条（签券/改名符/称号/换卦符/补卦力/皮肤/灵纹匣）与后端 8 条（`item_1..8` 经验药水/宠物蛋）没有语义交集，`/shop/skins` 返回空** → 用配置 id 下单必然买错，故禁用是唯一正确处置，未猜 id

### 三、教师卡片余额（按指令 5 复验）

`13-教师端余额核对.png`：测试甲卡片 **28**，顶栏「人均 5 / 最高 28」，与求签后 HUD 的 28 一致 → Codex 的 `game_points` 修复生效。
另：负数加减分与批次幂等仍属待实现部分，截图只证明「余额口径一致」，不等于同步可靠性已验收。

### 四、Layout 黑白迁移（指令 4，未做）

按「优先级低于真实交易接入」，本轮未动 `layouts/v3/*`。`06/07/08` 三张里名单页仍是黄棕旧配色，待后续单独一轮处理。

### 五、检查结果

| 检查 | 结果 |
|---|---|
| `vue-tsc --noEmit` | ✅ 0 错误 |
| `vitest run` | ✅ 20 文件 / 294 测试 |
| `vite build` / `verify-build` | ✅ 通过 |
| 页面截图 | ✅ 新增 `09–13` 五张（求签抽前/演出中/结果、集市未开通、教师余额核对） |

### 六、需要 Codex 回复

1. 集市要开通，后端需要「按 v3 seeds 重建商品表」或「提供 v3 商城接口」二选一（详见映射核对文档）
2. 求签回执 `newPoints/pityCount` 字段名与 `GachaReceipt.points/pulls` 的映射目前压在 adapter 里，是否要在 API 文档固定字段名，避免两套命名
3. 是否下一轮做 `layouts/v3` 黑白迁移（纯视觉）


---

## DS-R5 / 页面级截图取证（8 张）+ 两项页面发现 / 2026-11-13

- 状态：**待复验**
- 基线：`1c8af2e` + 本轮 UI 补丁（`a90798c`）
- 截图目录：`docs/测试证据/`（8 张，1440×900，共 3.0MB）
- 截图方式：**Playwright 驱动系统 Edge**（`channel: 'msedge'`，不下载 chromium）
  - 安装方式：`npm install --no-save playwright` —— **未改 `package.json` / `package-lock.json`**，属本地取证工具
  - 驱动：`API_PROXY_TARGET=http://localhost:3004` 启动 vite（官方机制，无临时双代理）

### 一、截图与对应验收项

| 文件 | 验收点 | 观察结果 |
|---|---|---|
| `01-登录页.png` | 登录页双 Tab、学号/姓名输入 | 黑白主题、卷轴卡、无假山；文案正确 |
| `02-学生大厅HUD.png` | **H1/H2/H3/H5/H6/H7/H8** | 「测试甲 · 六年级A班」、修为「新手训练师」、**今日功名 +8**、**灵石 128**、灵纹 0、今日斗法 0；白虎·监兵 四象 战力 244、注音 `bái hǔ · jiān bīng` 正常；右侧课业/榜文/同道渲染正常 |
| `03-英文名登录.png` | L2/L3 英文名与归一化 | 用 `TestJia` 登录成功，落到 `/lobby`，HUD 同上 |
| `04-登录报错不跳转.png` | L4 错误登录 | 红条「姓名和学号对不上」，**URL 仍停在 `/pet-garden/login`**，未刷新、未白屏 |
| `05-教师端.png` | 教师工作台 + 名单入口 | 顶栏出现「名单管理」；班级 chips「六年级A班 6」；卡片 −1/+1/+3/+5 正常 |
| `06-名单页.png` | 名单页加载 | `/admin/students` 正常渲染（此前白屏是 dev 依赖缓存过期所致，见第四节） |
| `07-导入预演-简表.png` | **R5 缺席列 + 拒绝对比** | 「读到 2 行 / 新增 0 / 更新 0 / **无变化 1** / 无效 1」；提示「本次表格没有这些列：英文名、性别、班级、课程 —— 按服务端方案保留原值」；990001 判定**更新**、`写入：无`、`保留：中文名/英文名/性别/班级/课程`、警告「本次没有需要更新的列」；990002 判定**拒绝**并红字显示「该学号存在身份冲突，请先核对旧账号，不能自动关联资产」 |
| `08-导入预演-含列.png` | 含英文名/班级的表格 | 列不再提示缺席，逐行方案与写入字段正常 |

**结论**：DS-04 的页面项（登录/HUD 真值/名单导入预演/错误登录不跳转）已具备可复现的浏览器证据；`today_battles=0` 仍是 IN-07 未修，只验到显示链路。

### 二、页面发现（两条，均非本轮改动引入）

1. **教师端卡片积分与 HUD 不一致**（`05-教师端.png`）
   测试甲在 HUD 显示灵石 **128**，但教师卡片显示 **0**，顶栏「人均 0 / 最高 0」。
   原因推断：教师端 `fetchClassStudents` 走 v1 `/api/classes/:id/students` 的 `total_points`，而 HUD 走 v3 `users.game_points` —— 两套数据源未统一。
   → 属 adapter/接口契约范围（Codex），我只做了记录，未改。

2. **`/admin/*` 仍是旧配色**（`06/07/08` 张）
   名单页与导入弹窗是黄棕暖色 + 旧版左侧导航（「班级宠物园 / 教师管理」），与全站黑白墨色不一致。
   原因：这些页面挂在 `layouts/v3/AdminLayout.vue`，该布局未做黑白迁移。
   → 这属我范围（`src/layouts/`），**但按 Codex「不做无关迁移」的要求，我先请示**：是否授权我把 v3 两个 Layout 换成黑白令牌？

### 三、dev 环境两个坑（已解决，记录备查）

1. **安装依赖后必须重启 vite**：我 `npm install playwright` 后，旧 dev server 仍持旧预打包依赖，页面报
   `504 (Outdated Optimize Dep)` → 动态 import 失败 → `/admin/students` 白屏。
   解决：停掉旧进程 + 删除 `node_modules/.vite` + 重启。
2. **旧 vite 进程会占着 3001 不放**：`job_kill` 只结束外层 pwsh，子进程 `vite.js` 仍在。
   必须按 PID 核对命令行再停（我只停了自己启动的 `vite.js`，未动 3002 的进程）。

### 四、检查结果

| 检查 | 结果 |
|---|---|
| `vue-tsc --noEmit` | ✅ 0 错误 |
| `vitest run` | ✅ 20 文件 / 294 测试 |
| `vite build` / `verify-build` | ✅ 通过 |
| 页面截图 | ✅ 8 张（如上） |

### 五、需要 Codex 回复

1. 教师端卡片积分/HUD 数据源不一致（v1 `total_points` vs v3 `game_points`）由谁统一？
2. 是否授权把 `layouts/v3/AdminLayout.vue`、`StudentLayout.vue` 迁到黑白令牌（纯视觉，不动结构/权限）？
3. 截图取证工具用 `--no-save` 安装、未入库，是否接受这种取证方式；若要可复现，需要把 playwright 加进 devDependencies（需你同意）。


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
