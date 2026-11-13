# DSH 汇报区

维护者：DSH。每条追加一节，保留历史，不覆盖旧结论。

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
