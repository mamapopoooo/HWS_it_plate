# 交接：Qoder 侧进度与待决问题（给 Codex 总审核）

> 基线：`origin/dev-qoder` @ `ed48de2`
> 工作树：`D:/课件/platform/pet-garden-qoder`
> 写于 2026-11-12。本文档里每一条都经过本工作树实跑核对，未核实的推断会标注"待确认"。
>
> **生产服务器 110.40.142.247 处于用户指令冻结中**，下面的问题都还没上生产，也不要在合并完成前动它。

---

## 一、我的提交范围

相对 `origin/dev`：多 2 个提交，少 8 个提交。

| 提交 | 内容 |
|---|---|
| `ed48de2` | feat(roster)：名单成为登录唯一依据，教师端支持表格导入与增删改查 |
| `9958939` | fix(dev)：开发服务器不再用 immutable 缓存源码，部署校验补 JSON 兜底检查 |

改动面 29 文件（+1691 / −531），大头是 `src/pages/v3/admin/Students.vue` 重写与 `server/routes/roster.js` 新建。

---

## 二、已完成进度（可审）

### 1. 名单（`students` 表）是登录的唯一事实来源
- 入口 `server/routes/game-v2.js:18` → `POST /api/v2/auth/student/login`，参数 `{studentNo, realName}`。
- 按**学号定位**，中文名或英文名任一匹配即通过（`name_en` 参与比较，两边先归一化空白/大小写）。
- **不再自动建号**：学号不在名单里返回 401，文案直接给学生看（"名单里没有这个学号，请核对后重试或找老师"）。
- 每次登录把 `users` 的身份行（real_name / name_en / grade / class_id_ref）同步成名单的样子，游戏数据列（`game_points` 等）不动。首次登录才建 `users` + `trainers`。
- `users.username` = 学号，所以"改学号 = 改密码"这条口径天然成立。

### 2. 教师端名单管理
`server/routes/roster.js`，挂在 **`/api/v3/roster`**（`server/index.js:97`）：

| 端点 | 作用 |
|---|---|
| `GET /classes` | 班级列表（含人数） |
| `GET /students` | 名单查询，支持班级/关键字过滤 |
| `POST /students` | 单个新增 |
| `PUT /students/:id` | 单个修改（含改学号，即改密码） |
| `DELETE /students/:id` | 删除 + 级联清游戏数据 |
| `POST /bulk` | 批量操作（统一增删改） |
| `POST /import` | 表格导入，按学号 upsert |
| `GET /duplicate-names` | 同名检测，避免按姓名误匹配 |

前端 `src/pages/v3/admin/Students.vue` 重写为上传 xlsx + 单条增删改查 + 批量迁移界面。

### 3. 乱码守卫（写入前拦截）
- `server/utils/garbled.js`：无依赖模块，判 U+FFFD 替换符；`garbledRows()` 按学号/中文名/英文名/班级四列统计坏行数。
- `server/garbled.test.js`：5 条单测（样例是编造的通用字符串，不含真实姓名）。
- `POST /import` 先数坏行，`garbled > 0` 直接 400 不落库（历史事故：库里曾被 GBK 请求写坏过中文名和班级名）。
- `scripts/check-mojibake.mjs` 作构建期门禁。

### 4. 删学生的级联清理
`server/routes/roster.js:24` 列出 18 张按 `user_id` 挂的数据表，删 `users` 前先清干净；另有两条必须单独写的：

```js
// server/routes/roster.js:228 附近
removed.dataRows += db.prepare('DELETE FROM battle_records WHERE player_a_id = ? OR player_b_id = ?').run(user.id, user.id).changes
removed.dataRows += db.prepare('DELETE FROM custom_pet_images WHERE custom_pet_id IN (SELECT id FROM custom_pets WHERE user_id = ?)').run(user.id).changes
```

第二条必须在删 `custom_pets` 之前执行，否则子查询查不到；`battle_records` 分左右两侧，一个占位符会触发 better-sqlite3 的 `Too few parameter values` 报错（这条我踩过，已修正）。

### 5. 学生端顶栏改为真值
- `GET /api/v2/trainer/me`（`server/routes/game-v2.js:132` 起）用标量子查询补出 `character_nickname` / `class_name` / `roster_gender` / `today_points` / `today_battles` / `fragment_total`。**故意不用 JOIN**：JOIN 会因行数放大让 `SUM(amount)` 翻倍。
- `src/api/adapter.ts` 的 `pickProfile` 映射进 `Profile`，`GameHud.vue` 的 props 换成真值。
- 顶栏不再有写死的 `+38`、`3/3`；`displayName` 变成"昵称 · 真名"（无昵称时只显示真名），班级缺失回落 `G{grade} 班`。
- 性别以名单为准（`roster_gender === '男'`），回落 `users.gender === 'male'`。

### 6. 构建与部署
- `vite.config.ts`：dev 期不再对源码下 immutable 缓存头（会把改过的模块钉在旧版本），该头只留给 `preview`。
- `deploy.sh`：发布前断言 API 前缀返回的是 JSON 而不是 SPA 的 `index.html`——之前有过一次"登录报 Unexpected token `<`"就是打到 SPA 兜底页。
- `server/index.js`：`PORT` 支持环境变量覆盖。

### 7. 隐私处理（未成年人数据）
- `docs/seeds/students-real.json`（252 名学生的姓名 + 学号）**已加入 `.gitignore`，从未入库**。
- 生产灌库必须走 scp 传到服务器，不走 git。
- 提交前已做过一轮全仓真实姓名扫描，注释与测试里的样例都已换成通用字符串。

### 8. 门禁状态（本文档提交前实跑）
```
npx vue-tsc --noEmit   → 0 错
npx vitest run         → 10 files / 207 tests 全过
```
`npx vite build` + `node scripts/verify-build.mjs` + `node scripts/check-mojibake.mjs` 在本基线通过。

> **给审核者的提醒**：这 207 项测的几乎都是纯函数（`gameConfig` / `gacha` / `duel` / `level` / `password` / `garbled`），**没有一项覆盖 `/api/v3/roster` 的字段映射**。所以上面那行绿灯不能作为名单管理可用的证据——§七 的 #2 就是从这条缝里漏出去的。

---

## 三、P0：学生登录有三套实现，直接合并会让名单登录失效

这是**最需要 Codex 拍板**的一条，三套实现同时存在：

| 实现 | 路由 | `users.username` 写法 | 匹配规则 | 学号不在名单 |
|---|---|---|---|---|
| origin/dev `server/routes/auth.js:79` | `POST /api/auth/student/login` | **`stu_<学号>`** | 学号优先，回落按姓名；**中文名必须全等，不认英文名** | 401 |
| origin/dev `server/routes/game-v2.js:14` | `POST /api/v2/auth/student/login` | `<学号>` | **完全不查 students**，`grade` 写死 6 | **自动建号** |
| dev-qoder `server/routes/game-v2.js:18` | `POST /api/v2/auth/student/login` | `<学号>` | 学号定位 + 中/英文名任一匹配 | 401 |

前端调用点决定命中哪一套：
- **origin/dev** `src/api/index.ts:77` 用 `auth.post`，基址 `API_ROOT + '/auth/...'` → `/api/auth/student/login` → **走 auth.js**。
- **dev-qoder** `src/api/index.ts:50` 用 `api.post`，基址写死 `/api/v2` → **走 game-v2.js**。

两个后果：

1. **基址修复是对的，必须保留。** origin/dev 的 `f5dd0fe` 把基址改成跟着 `import.meta.env.BASE_URL`（Vite 配了 `base: '/pet-garden/'`，写死 `/api/v2` 在生产会打到 SPA 兜底页）。我的 `src/api/index.ts` 还是写死的 `/api/v2`，**合并时应取 origin/dev 的基址逻辑**。
2. **但取了他的基址、又只留我的 game-v2.js，名单登录就没人调用了。** 而 auth.js 那一套不认英文名，用户明确要求的"允许学生输入英文名"会直接失效；它还会给同一学生生成 `stu_<学号>` 这种 username，与我的 `<学号>` 写法并存时**一个人两条 users 行、训练师/宠物/积分数据分裂**。

建议（等 Codex 决策，我不擅自改）：统一到"学号即 username、名单为唯一依据、中英文名任一匹配"这一套语义，落到 auth.js 的挂载路径上（保留基址修复），把 game-v2.js 里两份自动建号的实现删掉；若生产库里已存在 `stu_*` 行，需要一条把 `stu_<学号>` 合并回 `<学号>` 的迁移（**注意 AGENTS.md 铁律：迁移只加不删**，合并数据要留回滚备份）。

---

## 四、其余待决问题

### P1 — `battle_records` schema 漂移，导致"今日斗法"恒为 0
- 权威 schema 是 `server/game/migrate-v2.js:126`：`(id, battle_type, player_a_id, player_b_id, winner_id, turn_count, log_json, created_at)`。`server/index.js:7-8` 只跑 migrateV2 / migrateV3，实库 `server/pet-garden.db` dump 确认就是这个形状，`COUNT(*) = 0`。
- 但 `server/game/db-migrate.js:36` 定义的是**另一套**列（`player_a_pet, player_b_pet, player_a_level, player_b_level, winner, battle_log`）。
- 全仓唯一的写入口 `server/routes/game.js:313` 用的正是 db-migrate 那套列名 → prepare 阶段就失败：`table battle_records has no column named player_a_pet`。**战斗结束时记一条都没写进去。**
- 连带影响：我给顶栏做的 `today_battles` 子查询（`server/routes/game-v2.js:140`，按 `player_a_id/player_b_id/created_at` 统计）列是存在的、查询能跑，但数出来永远是 0——不是顶栏的 bug，是没数据。
- 修法二选一（等 Codex 定）：把 `game.js:313` 改成写 v2 列，或加一条补列迁移。**我没有动它**，因为跨了 KIMI 的战斗模块边界。

### ~~P1~~ → P3 — `xlsx` 依赖挂在 CDN：我上一轮把这条写重了（已更正）
- 实情：`xlsx` 只被 `src/pages/v3/admin/Students.vue:211` 前端引入，由 Vite 在**构建机**打进 bundle；`deploy.sh:47` 是本地 `npm run build` 后传静态产物，**远程不装前端依赖**。所以"生产拉不到 tgz → 导入功能不可用"这个推断不成立，Codex 的反驳是对的。
- 残留风险只有一条：它挂在 `dependencies`（`package.json:29`）而不是 `devDependencies`，所以服务器若用同一份 manifest 跑 `npm ci`（哪怕 `--omit=dev`）仍会去访问 `cdn.sheetjs.com`。
- 建议：挪进 `devDependencies` 即可彻底摘掉，不需要 vendoring。

### P2 — 与 origin/dev 重叠的文件 5 个
`server/index.js`、`src/api/index.ts`、`src/components/layout/GameHud.vue`、`src/pages/GameLobby.vue`、`src/pages/Login.vue`——我在 dev-qoder 上改过，origin/dev 上也有别人的改动（尤其 `7f1a532` 动了 `server/index.js` + `server/routes/auth.js`）。逐文件三方比对时这几处优先看。

### P2 — 分支现状提醒
`pet-garden-qoder` 工作树的**本地 `dev` 分支是 ahead 2 / behind 8 的分叉状态**（那两个提交就是后来 dev-qoder 上的内容）。不要直接 push 这个本地 `dev`；我的成果一律以 `origin/dev-qoder` 为准。

### P2 — 临时验证脚本未入库
上一轮的"乱码守卫 16 项路由用例"和"级联删除 8 项用例"是用一次性脚本对着跑起来的服务验的，脚本用完即删、没有进仓库，所以现在是**结论在、复现脚本不在**。需要回归的话按下面口径重写即可：
- 乱码：向 `POST /api/v3/roster/import` 提交含 U+FFFD 的行 → 期望 400 且响应 `garbled` 计数正确、库里行数不变。
- 级联：造一个测试学生 + 若干游戏数据行 → `DELETE /api/v3/roster/students/:id` → 期望返回的 `dataRows` 与实际残留 0 相符。

---

## 五、生产未执行项（用户指令冻结，合并完再动）

1. 252 人名单灌库：`docs/seeds/students-real.json` 只在本地，**已 gitignore、绝不上库**；上线时 scp 到服务器再跑 `scripts/import-roster.mjs`。
2. `deploy.sh` + 构建产物发布。
3. 上线后回归三件事：学生用中文名登录、学生用英文名登录、教师端表格导入；顺带确认顶栏"今日功名/今日斗法"不再是写死值。

---

## 六、复验命令

```bash
npx vue-tsc --noEmit          # 期望 0 错
npx vitest run                # 期望 207 tests 全过
npx vite build && node scripts/verify-build.mjs
node scripts/check-mojibake.mjs
node server/index.js          # 默认 3002，可 PORT= 覆盖
```

---

## 七、对 Codex《GitHub插件增量复审》的逐条核对（2026-11-12）

复审意见 6 条，我逐条对源码 + 实库验过：**5 条成立，1 条（xlsx）是他们驳对我驳错**。
用户决定：**这一轮代码一条都不动**，等 Codex 出整合方案；本节只交核对结论。

| # | 复审条目 | 判定 | 核对证据 |
|---|---|---|---|
| 1 | 登录整合阻塞 | **成立**，与本文 §三 同源 | 本地库 `SELECT COUNT(*) FROM users WHERE substr(username,1,4)='stu_'` → **0 条**。生产库未连（冻结中），该数字必须在生产重新盘点后再定迁移方案 |
| 2 | 名单查询字段错 → 恒 0 / 恒未登录 | **成立，且已是用户可见缺陷** | 见下 §7.1 |
| 3 | 学号唯一索引吞错仍记版本 9 | **成立**（本机侥幸已建成） | 见下 §7.2 |
| 4 | 转班后年级不一致 | **成立** | 见下 §7.3 |
| 5 | 年级回退写 0 | **逻辑成立，当前数据不触发** | `parseGrade` 只认 `G\d` 或「X年级」。现库班级为「六年级A班…七年级E班」，`students.grade` 分布 6:143 / 7:109，**无 0**。真隐患是 `Number(body.grade) \|\| parseGrade(...)` 连显式 0 一起吞 |
| 6 | 简表导入清空已有档案 | **成立，上线前最易踩** | 见下 §7.4 |
| — | xlsx CDN 可达性 | **他们对，我写重了** | 已把本文 §四 该条从 P1 降为 P3 并改正 |

### 7.1 #2 — 教师端名单页两列是死的（我的漏检）
`server/routes/roster.js:82` 的 SELECT 写的是 `u.game_points AS gamePoints`，而映射 `:108` 读的是 `r.game_points`；`last_login_at` **根本没进 SELECT**，`:112` 却读 `r.last_login_at`。
实库跑同一条查询确认返回列名里只有 `gamePoints`，没有 `game_points`，也没有 `last_login_at` → `gamePoints` 恒走 `?? 0`，`loggedIn` 恒 false。
前端 `src/pages/v3/admin/Students.vue:79` 渲染 `s.gamePoints`、`:82-83` 用它决定「已登录 / 未登录」徽章 → **教师看到的是全员 0 分、全员未登录**。
修法：SELECT 补 `u.game_points`、`u.last_login_at`（或把映射改成读别名 `r.gamePoints`），并加一条断言映射键名的回归测试——**光看界面发现不了，整列同值看起来像正常数据**。

### 7.2 #3 — 唯一索引是这道约束的**唯一**防线
`server/game/migrate-roster.js:37-39` 的 `try { CREATE UNIQUE INDEX } catch {}` 之后照样 `markApplied(9)`。
补一条他们没写的关键事实：实库 `students` 建表语句是 `student_no TEXT`，**表级没有 UNIQUE**，所以这个索引失败就等于约束完全不存在。本机库里它建成了（重复学号 0 组），所以现网无恙，但生产灌库若有重复就会「报成功、无约束」。
修法：先 `SELECT student_no, COUNT(*) ... HAVING COUNT(*)>1` 预检，有重复直接抛错中止；建索引不再 catch；只有两步都成功才 `markApplied`。

### 7.3 #4 — 转班会把年级滚回去
`roster.js:268` 只 `UPDATE students SET class_id = ?`，`:278` 用 `parseGrade('', className)` 更新 `users.grade`，`students.grade` 保留旧值；而学生下次登录时 `server/routes/game-v2.js:53` 又 `UPDATE users SET ... grade = student.grade`，用 `students` 的旧值覆盖回去。
按项目自己定的口径「students 是花名册权威源」，**权威源没更新才是根因**：转班应在同事务里同步 `students.grade`，登录覆盖才安全。

### 7.4 #6 — 导入语义**已由用户定案**（修复时照这个做）
现状：`server/game/import-roster.js:82` 对已存在的学号，把缺失字段直接写成 `name_en=''`、`gender=''`、`course=''`、`class_id=NULL`、`grade=0`。现库 252 人 `name_en` 是全填的，教师只要传一份「学号 + 姓名」两列简表，**英文名和班级就被清空**。

> **用户决定：按「只更新表格里出现的列」实现**——列缺席 = 保持原值，永不清空；要故意清空某列走单条编辑界面。
> 落地要点：`importRoster` 需按行的**键存在性**（不是值真假）拼 UPDATE 列，`dryRun` 相应该报「本次会写入哪些列 / 哪些列被跳过」，否则教师无从判断。
