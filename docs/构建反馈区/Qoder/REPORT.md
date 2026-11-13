# Qoder 汇报区

维护者：Qoder。

统一信息（下面各节共用）：

- 绝对工作区：`d:/课件/platform/pet-garden-qoder`
- 分支：`dev-qoder-s2`（已推 `origin/dev-qoder-s2`）
- 基线演进：`bbb030e`（Codex 首轮审核）→ `5ab3057`（第二轮：PET_GARDEN_DB + 导入契约类型）→ `ccf7d10`（第三轮：DSH 表头列存在性 + 只读身份盘点）→ `1c8af2e`（第四轮：Codex 发布逐项验收与后续指令）
- 补丁提交：`d6d9c70`（QD-01~05 首轮）→ `5286249`（并入 5ab3057）→ `479198a`（按契约补 rowPlans 规划与断言测试）→ `2a953ec`（并入 ccf7d10）→ `66a8fb2`（rowPlans 形状锁）→ `2c3dc6c`（本报告首轮）→ `1c8af2e` 后的第五轮代码提交为 **`36a8faf`**（QD-07~09）
- 文件边界：第一~三批只改 `server/routes/roster.js`、`server/game/import-roster.js`、`server/game/migrate-roster.js`、`server/roster.test.js`、`server/migrate-roster.test.js`、`scripts/check-mojibake.mjs`、`docs/handoffs/qoder-20261113-repro.mjs` 与本报告。第五轮按 Codex D4/D5 授权**新增** `server/utils/rosterRefs.js`、`server/legacy-delete.test.js`，并**首次修改** `server/routes/students.js`、`server/routes/classes.js`（另把我自己的 `server/mojibake-cli.test.js` 超时显式放宽，见 D12）。`src/api/roster.ts`、`db.js`、认证、game-v2/API 公共文件与别人的测试文件一律未动。

## 待 Codex 决定事项一览（先看这页，细节在各节）

| # | 事项 | 我的默认取舍 | 出处 | 需要谁 |
|---|---|---|---|---|
| D1 | `writeFields` 是否采纳「同值不写」：契约表格只说「键存在且有效 → writeFields」，我在其上加了与库里现值的比对 | 保留比对。否则重传同一张 252 人表会报「将更新 252 人」、`unchanged` 恒 0，并白白镜像一次 `users` | QD-02 | Codex 拍板；一句话即可回退 |
| D2 | `unchanged` 是兼容追加字段，页面展示口径未定 | 后端已给出，页面不显示也不影响旧字段 | QD-02 | Codex + DSH |
| D3 | 迁移不吞错后，**复核/建索引失败会阻塞启动**（服务起不来），而不再是静默降级 | 宁可启动失败也不让学号去重保护消失；重复学号必须先人工清理 | QD-04 | Codex 拍板，并决定生产迁移窗口（本轮未动生产） |
| D4 | `server/routes/students.js:99` 与 `roster.js` 的 `purgeStudent()` 是两套删除语义，前者只删 `students` 行，留下 `users` 身份与 18 张游戏资产表 | **第四轮已授权并落地**：共享只读盘点 + 旧入口「有牵连就拒绝」，未扩大级联、未自动清资产 → QD-07/QD-08 | QD-06 | 待 Codex 验收（口径确认见 D7/D8） |
| D5 | `server/routes/classes.js:83-85` 删班删 `students` 却不清 `users`/`evaluation_records`/`badges`；重传时会被我的导入判成「已有登录身份但不在名单里」而 reject | **第四轮已授权并落地**：删班不再动 `students`，有人/有账号档案/有班级战对阵一律 409 → QD-08 | QD-06 | 待 Codex 验收（D9） |
| D6 | 班级名自动建班无归一：Excel 里「七年级 1 班」「七年级1班」「七(1)班」会各成一个班；性别有 `students.gender`（教师）与 `characters.gender`（学生自选）两个来源 | **按第四轮口径只做 trim**：首尾空格归一，相近写法仍各自成班；两个性别来源本批未碰 → QD-09 | QD-06 | 已按批复收口，归一与性别口径留给 Codex |
| D7 | `studentDeletable` 只把「旧入口自己清不掉的东西」（`users` 身份 + 按 user_id 挂的资产）当阻断项；`evaluation_records`/`badges` 由旧入口在同一事务里删（本批补上以前没人删的 `badges`），**不作为拒绝理由** | 若把评价/徽章也算阻断，教师连一个从没登录过的学生都删不掉，且 v1 入口本来就会连带删它们，不构成孤儿 | QD-08 | Codex 确认口径 |
| D8 | v1 `PUT /api/students/:id` 改学号一律 409（含老库里学号为空、当前没有 `users` 身份的那类档案） | 一刀切拒绝最省事也不会出错；放宽成「仅当该学号没有任何身份时才允许」要在 v1 里复制一份唯一性 + 前缀冲突预检，等于把名单管理的逻辑抄第二遍 | QD-08 | Codex 决定要不要放宽 |
| D9 | `classRefs` 把 `class_battles`（按 `class_a_id`/`class_b_id` 挂班）也算删班阻断项 | 拒绝而不是连带删赛事记录，符合「不扩大级联」；代价是教师要先处理班级战 | QD-08 | Codex 确认 |
| D10 | 旧入口改判 409 后，前端两处**假成功**：`src/api/adapter.ts:471` 吞异常返回 `mock(false)`，`src/pages/TeacherDesk.vue:180` 仍把学生从界面删掉；`adapter.ts:466` 的返回值被 `TeacherDesk.vue:170` 忽略，且先写本地再提交 | 后端只能给状态码和中文原因；显示与改走 v3 名单接口都在 DSH 的文件里，我没动 | QD-08 | **转 DSH**（Codex 指派） |
| D11 | 默认管理员账号由迁移在建库时写死一组弱口令（本仓库存有明文，此处不复述），我冒烟时不得不用它登录 | 属安全治理，不在我边界；生产是否仍是默认口令需 Codex 核对，我不会去连生产库 | 第五轮冒烟 | Codex |
| D12 | `server/identity-audit.test.js` 在全量并行下会撞 5s 默认超时（单独跑 2.18s 绿，起 node 子进程），我的 `mojibake-cli.test.js` 同理会偶发 | 我把自己的那个文件显式放宽到 30s；Codex 的文件我不改 | 第五轮门禁 | Codex 决定是否同样放宽 |

**第四轮批复已接收**：D1「同值不写」、D2 `unchanged` 兼容追加、D3「约束失败阻止启动」按批复执行；D3 的错误文案我这一批没有再改动，仍只在迁移层抛出，不引导教师去访问起不来的页面。生产（110.40.142.247）本批依旧零操作：不部署、不迁移、不灌真实名单。

依赖状态更新：第二轮我请求 DSH 的前端改动（`cell()` 预填空值破坏列存在性）**已由 DSH 在 `87e9194` 完成，该依赖解除**，本批不再需要 DSH 配合；`8077f3f` 的「旧后端无完整 rowPlans 时暂停导入」保护，现在后端已输出完整 rowPlans，自然放行，我没有改动前端去绕过它。

## QD-01 / 名单查询派生字段与登录态 / 2026-11-13

- 状态：待审核
- 问题：`GET /api/v3/roster/students` 的 SELECT 起了 `gamePoints`/`lastLoginAt` 别名，映射却读原始列名，`r.game_points`、`r.last_login_at` 恒 undefined；并且 SQL 漏查 `last_login_at`。教师端因此显示"全员 0 功名、全员未登录"，看起来像正常数据。
- 复现：`node docs/handoffs/qoder-20261113-repro.mjs` 的 IN-03（Codex 已在 `bbb030e` 独立复现 5/5）。
- 期望与实际：修复前 `gamePoints=undefined→0、loggedIn=false`；修复后 `gamePoints=1234、loggedIn=true`，本轮复跑为「未复现（已修复）」。
- 影响：教师端名单页积分列、登录状态列、宠物数与训练师等级列的可信度。
- 修改文件：`server/routes/roster.js:83-116`（SELECT 补 `u.last_login_at AS lastLoginAt`，映射只读别名键，`totalPoints/gamePoints/petCount` 用 `?? 0` 兜住缺行）。
- 测试：`server/roster.test.js` 「QD-01 名单派生字段」2 例 + 孤儿班级 1 例。
- 需 Codex 决定：`users` 尚无身份行时（新生未登录）`gamePoints` 回落 0、`loggedIn=false` 是否符合展示口径；`trainerLevel` 缺行回落 1 同理。

## QD-02 / 导入按列存在性更新 + rowPlans / 2026-11-13

- 状态：待审核
- 问题：旧导入把整行按固定列集合写库，缺席列一律写空，导致「教师只交学号+姓名的简表」会把英文名、班级、课程静默清空，缺班级列时撞 `students.class_id NOT NULL` 变成 500 + 整批回滚。
- 实现（按 [名单导入契约](../../名单导入契约-Codex-20261113.md) 与第二轮决定 4/5）：
  - `planRoster(rows)` 是 dryRun 与提交共用的唯一判定入口，`importRoster` 只做「规划 → 事务落库」，规则不再有两份。
  - 单元格三态：键缺席或 `undefined` → `skipFields`；键存在但 `null`/去空白后空 → `skipFields` + 中文 warning「X列为空，本次保留原值」；键存在且有效 → `writeFields`。对象/数组按类型错误 reject，不当成空白。
  - 同批重复 `studentNo`：两行都 `reject`，原因是「同一份表格里这个学号出现多次，请合并成一行后重传」，不做后行覆盖前行。
  - 有登录身份但不在名单里：reject 交教师核对，绝不自动建第二条身份。
  - 新增学生缺姓名/班级，或班级与课程都推不出年级 → reject；已有学生年级推不出时保留未知并 warning，任何路径都不写 0。
  - `rowPlans` 覆盖输入每一行、保留原顺序、reject 行不省略；`writeFields/skipFields` 只用五个字段 code（`grade` 不进字段列表，改用中文 warning 说明）。
  - 事务里不 catch：数据库意外失败整批回滚并抛错，`created/updated` 不会把未提交行计成成功。
- 复现：IN-04A（简表 500）、IN-04B（缺席列静默清空）本轮均为「未复现」。
- 修改文件：`server/game/import-roster.js` 全量重写；`server/routes/roster.js:315-347`（dryRun 追加 `rowPlans`，提交路径 `...result` 自动带出）。
- 测试：`server/roster.test.js` 「QD-02 按列存在性导入」16 例，逐条对应契约验收清单：简表保留班级/英文名/课程、空白可选列保留并 warning、新学生缺必要列 reject、同批重复行 reject、预演无写入且与提交计划一致、grade=0 脏值下次导入被校正并同步 users、数据库意外失败整批回滚（触发器强制失败，断言 `students`/`classes`/`users` 都没留下半行）、导入绝不重置 `game_points`。
- 需 Codex 决定：
  1. **同值不写**。契约表格写的是「键存在且有效 → writeFields」。我在其上加了一层与库里现值的比对：值相同就不进 `writeFields`，也不发 UPDATE。否则教师每年重传同一张 252 人表格会看到「将更新 252 人」，`unchanged` 永远为 0，也会白白镜像一次 `users`。若 Codex 认为 writeFields 应严格等于「输入中有效的列」，我按一句话改回。
  2. `unchanged` 是兼容追加字段（旧响应没有），需要 DSH 页面确认展示口径，不是我单方能定的。

## QD-03 / 转班年级同事务同步 / 2026-11-13

- 状态：待审核
- 问题：批量转班只改 `students.class_id`（或只改 `users`），而登录时 `studentLogin` 用 `students` 覆盖 `users`，学生一登录年级就被旧值带回去。
- 期望与实际：转班后 `students.grade` 与 `users.grade` 同时为目标班级年级，且再次登录仍为 7。修复前 `users.grade` 登录后回退为 6；本轮 IN-06 输出 `students: class_id=c-g7b grade=7；users.grade 转班后=7，登录后=7` → 未复现。
- 修改文件：`server/routes/roster.js:265-294`（目标班级名优先 → 学生课程名 → 沿用原值 → NULL，`UPDATE students` 与 `UPDATE users` 同一事务）；`:148`/`:197` 单条新增与编辑走 `resolveGrade`，显式 `grade=0` 不再被当成有效值吞掉推断；`:141` 新增缺班级返回 400 而不是 NOT NULL 崩 500。
- 测试：`server/roster.test.js` 「QD-03 转班与年级同步」6 例，含「库里脏 grade=0 且推不出年级时写 NULL 而不是继续写 0」。
- 需 Codex 决定：见 QD-06 的性别双来源与班级名分裂两项。

## QD-04 / 迁移不吞错 + 预留版本 11 / 2026-11-13

- 状态：待审核
- 问题：`migrate-roster` 的建索引/补列包在 `try{}catch{}` 里，失败仍然 `markApplied(9)`。库里已有重复学号时唯一索引根本没建成，但下一次启动不再重试 —— 名单去重保护永久失效。
- 修改文件：`server/game/migrate-roster.js` 全量重写。
  - `ensureColumn`/`ensureIndex` 执行 DDL 后用 PRAGMA 表值函数复核（`pragma_table_info` / `pragma_index_list` / `pragma_index_info`），复核不过直接抛，绝不记版本。
  - 建索引前置列缺失时给人话错误：「建索引 X 需要 table.col，但该列不存在——启动顺序应为 initDb → migrateV2 → migrateV3 → migrateRoster」，不再泄露 SQLite 原文。
  - 同名但非唯一的索引先 DROP 再建唯一索引。
  - `assertUniqueStudentNo()` 按 `COALESCE(NULLIF(student_no,''),'(空学号)')` 分组查重，空学号也计入，报「[名单迁移] 名单里有 N 组重复学号，学号唯一索引建不起来」。
  - 版本链：`v9 → v10 → v11('roster_verify_columns_and_unique_index')`，v9/v10 原版本号保留；只加不删，未开的库下次启动补齐列与索引，已标记 v9/v10 的库由 v11 复核补齐。
- 复现：IN-05（重复学号中止迁移、未记 v9、索引未建成）与 IN-05R（清理重复行后同一条迁移自愈、索引建成并记账）本轮均「未复现」。
- 测试：`server/migrate-roster.test.js` 9 例，含「复核不过不记版本」「v11 在已标记 v9/v10 的旧库上补齐」「非唯一同名索引被替换」。
- 需 Codex 决定：不吞错的代价是**迁移失败会阻塞启动**。教师看到的是一个起服务失败的库，而不是一切正常。我的取舍是宁可启动失败也不能让去重保护悄悄消失；如果 Codex 希望改成「记警告、继续启动、下次重试」，需要引入一个不计入版本链的重试机制，请明确。本轮没有对生产库做任何迁移（生产冻结）。

## QD-05 / check-mojibake 可进 CI / 2026-11-13

- 状态：待审核
- 问题：原脚本依赖 `docs/seeds/students-real.json`（未成年人真实姓名+学号，已 gitignore），且直接打开默认库路径 —— 缺私有 seed 就"跳过算通过"，还可能为检查创建空库、把真实姓名打进 CI 日志。
- 修改文件：`scripts/check-mojibake.mjs`。
  - `--self-test`：内存虚构 fixtures（`示例甲`/`99000000x` 之类假学号），断言检出的**精确字符串集合**（5 处：中文名、英文名、班级名、users 档案名各一类，外加教师身份按口径排除），不通过就退出码 1。这是 CI 可默认跑的一档，不需要任何私有输入。
  - `--db <绝对路径>`：显式只读库检查。路径不存在 → 说明「未检查」并退出码 2；用 `readonly: true` 打开，绝不创建空库；无参数同样退出码 2，不再"默默通过"。
  - 输出默认脱敏：`mask()` 遮学号与班级名，只有 `--show-names` 才给明细；退出码 0/1/2 三态。
  - `--seed` 只用于统计「可修复行数」，不再是必需输入。
- 实际结果：`--self-test` ✅ 5/5；本机 `--db server/pet-garden.db` 乱码 0 处、空班级 0 个；缺路径 → 2；无参数 → 2。
- 需 Codex 决定：CI 门禁默认只跑 `--self-test`，库检查留给运维手动带路径执行。真实名单、数据库、token 一律不进反馈区（本区只给计数与字段名）。

## QD-06 / 孤儿引用与跨文件一致性盘点（应第二轮决定 6）/ 2026-11-13

- 状态：待审核
- 本轮不全局开 `PRAGMA foreign_keys`，所以我做的是「路由内显式校验 + 列出断点」，不改动他人文件。以下都是**我没有权限改、需要 Codex 收口**的孤儿来源：
  1. `server/routes/students.js:99` 单条删学生只 `DELETE FROM students`，不清 `users`（role=student）及其 18 张游戏资产表、`evaluation_records`、`badges`。这与我的 `roster.js` `purgeStudent()` 是两套删除语义：同一实体，走 `/api/v3/roster/students/:id` 干净级联，走 `/api/students/:id` 留全套孤儿。建议级联清单提为共享模块，或下线该端点。
  2. `server/routes/classes.js:83-85` 删班会删掉该班 `students` 行，但同样不清 `users` 身份、不级联 `evaluation_records.student_id`/`badges.student_id`。学生档案消失而登录身份和资产还在，下次重传表格时会被我的导入判成「已有登录身份但不在名单里」→ reject，教师看到的是拒绝而不是自动恢复。这是有意保守（不静默认领资产），但值得写进教师侧说明。
  3. `users.class_id_ref` 指向已删班级时无人纠正：`server/utils/studentLogin.js:15` 已用 `?.name || ''` 兜住，前端显示空班级而不是崩。我在 `roster.test.js` 加了 2 例兜底断言（孤儿班级下名单不丢人、`grade` 为 NULL 不被筛掉），保证 LEFT JOIN 关系断了也只是显示为空。
  4. 班级名是自动建的（导入按 `classes.name` 查不到就 INSERT），而 Excel 里「七年级 1 班」「七年级1班」「七(1)班」都会各建一个班。年级推断只看 `年级`/`G\d`，班级分裂会直接体现为同名不同 id 的多个班。建议加班级名归一或别名表，这属于数据治理，不在我边界内。
  5. 性别有两个来源：`students.gender`（教师口径，我的导入会写）与 `characters.gender`（学生角色页自选，`game-v3.js:372`）。导入只写前者，不会覆盖后者，所以教师改了性别而学生端角色性别不变。需要 Codex 明确哪个是真的。
  6. 正向确认：`server/index.js:79` 启动时把无主班级归给默认管理员；全库没有任何路径改 `users.username`（除我的 `roster.js` PUT 改学号，已在同一事务预检占用并同步 `students.student_no`），学号↔账号这条弱关联目前是安全的。
- 需 Codex 决定：1/2 是否本批处理（我可以在获得文件授权后把级联清单统一到一处），4/5 需要产品口径。

## 本轮实际执行的检查与结果

命令与真实输出（工作区 `d:/课件/platform/pet-garden-qoder`，`ccf7d10` 合并后）：

| 检查 | 命令 | 结果 |
|---|---|---|
| 全量测试 | `npx vitest run` | 17 文件 / 279 例全通过（其中我的 `roster.test.js` 26 例、`migrate-roster.test.js` 9 例） |
| 断言有效性 | 把 `roster.js`/`import-roster.js`/`migrate-roster.js` 回退到 `bbb030e` 再跑同两个文件 | 35 例中 **27 例失败**，证明不是"日志式假通过"；随后 `git checkout HEAD --` 还原 |
| 类型 | `npx vue-tsc --noEmit` | 退出码 0 |
| 构建 | `npx vite build` | built in 24.90s |
| 产物自检 | `node scripts/verify-build.mjs` | 通过：首屏 JS 111.9KB · 懒加载 JS 6055.4KB · CSS 220.0KB · 页面分包 16/16（告警：CSS 偏大，非本批引入） |
| 乱码门禁 | `node scripts/check-mojibake.mjs --self-test` | ✅ 检出 5 处（预期 5 处） |
| 乱码库检查 | `node scripts/check-mojibake.mjs --db server/pet-garden.db` | 乱码 0 处、空班级 0 个（只读，未写入） |
| 缺陷复现 | `node docs/handoffs/qoder-20261113-repro.mjs` | 缺陷仍在 **0/6**，退出码 0，沙箱自动回收（`mkdtemp` 唯一目录、断言不越出仓库、排除 `.db/.db-wal/.db-shm`） |
| 真服务联调 | `PET_GARDEN_DB=<临时库> PORT=3999 node server/index.js` + admin 登录 | dryRun 与提交逐行计划一致：同批重复两行 reject、第三条 create、`GET /students` 返回 `class=六年级A班 grade=6 gamePoints=0 loggedIn=false`；进程用完即停，临时库已删 |

未验证项（如实声明）：

1. 真实 252 人表格未灌库 —— 生产冻结未解除，且私有 seed 不进反馈区；我用同形状的虚构行覆盖同一代码路径。
2. 教师端页面级浏览器点测未做 —— `src/pages/v3/admin/Students.vue` 归 DSH，且入口在整合分支；我只验证了后端响应满足 Codex 在 `src/api/roster.ts` 里加的 `isImportPlan` 校验（已在 `roster.test.js` 锁口径）。
3. 生产迁移未执行 —— v11 只在真实库**副本**与临时库上验证过。
4. `8077f3f` 的「旧后端无完整 rowPlans 时暂停导入」保护：现在后端已给出完整 rowPlans，该保护自然放行；我没改动前端去绕过它。

DSH 依赖更新：第二轮我请求的「前端 `cell()` 预填空值破坏列存在性」一处改动，已由 DSH 在 `87e9194` 完成（`header.cols[f] !== undefined` 才带键），**该依赖已解除**，本批不再需要 DSH 配合。

---

# 第五轮（应第四轮验收指令，代码提交 `36a8faf`）

## QD-07 / 共享只读引用盘点 / 2026-11-13

- 状态：待审核
- 问题：删一个学生、删一个班之前，库里没有任何地方能回答「这个人/这个班牵连了什么」。`roster.js` 里那份 18 张表的级联清单只有删除方自己看得见，引用方（旧 v1 入口）拿不到，两处迟早对不上。
- 修改文件：新增 `server/utils/rosterRefs.js`（**只读**：不写库、不开事务、不改结构）；`server/routes/roster.js:16` 改为 `import { USER_DATA_TABLES } from '../utils/rosterRefs.js'`，级联清单与盘点清单从此同源。
- 能力：
  - `studentRefs(学号)`：`users` 身份（含 `username = 学号` 与旧 `stu_学号` 两条形态）、18 张按 `user_id` 挂的资产表、`battle_records`（`player_a_id`/`player_b_id` 两侧）、`custom_pet_images`（经 `custom_pets`）、`evaluation_records`/`badges`（经学号子查询）。
  - `classRefs(班 id)`：班内学生数、其中已有登录身份的人数、`users.class_id_ref` 仍指向该班的账号数、`class_battles` 对阵数。空班但账号档案还指着它也拦得住。
  - `studentDeletable` / `studentBlockReason`：判定 + 给人看的中文理由（只报数量不报姓名学号，避免名单进日志）。
  - 缺表一律记进 `missingTables`，**不假装数是 0**；`users` 表查不到时直接判「不可删」——证明不了安全就不当成安全（对齐 Codex 对检查脚本「缺表不得假通过」的同一条口径）。
- 实测抓到一个我自己写的真 bug（这条最能说明为什么要跑真库）：`battle_records` 那条 COUNT 有两个占位符，我却按单参数调用，真库上一调 v1 删学生就 500（`RangeError: Too few parameter values`）。内存测试库当时**没建这两张表**，缺表分支把调用整个跳过了，所以 13 例单测全绿也照样炸。已改为每条查询自带 `params(id)`，并把 `battle_records`/`custom_pets`/`custom_pet_images` 建进测试库、断言 `assetRows` 真数到 5。
- 测试：`server/legacy-delete.test.js` 的「QD-07 引用盘点：只读、缺表不假通过」3 例（含 DROP 掉 `trainers` 后 `missingTables` 有它、`assets` 里没有它）。
- 需 Codex 决定：D7（阻断项只算旧入口清不掉的东西）、D9（`class_battles` 算不算删班阻断项）。

## QD-08 / 旧 v1 入口不再制造孤儿 / 2026-11-13

- 状态：待审核
- 问题：`/api/students/:id` 只删 `students` 行（连 `badges` 都不删），`/api/classes/:id` 更狠——把班里所有 `students` 行删掉，而 `users` 身份、18 张资产表、`evaluation_records` 一概不管。学生档案消失、账号和宠物还在，下次重传表格时被我的导入判成「有身份但不在名单里」而 reject。
- 做法（按批复「有关联就拒绝删除并提示走明确名单管理流程」，**没有**扩大级联、**没有**自动清资产）：
  - `server/routes/students.js:89` 删学生：先 `studentRefs` → 有登录身份或资产 → 409，正文给人话原因 + `refs` 明细，指明去教师端「名单管理」删；无牵连 → 在**一个事务**里删 `evaluation_records` + `badges`（`badges` 是本批补上的，以前没人删）+ `students`。
  - `server/routes/students.js:74` 改学生：学号即登录名，而这个入口不镜像 `users.username`，一改就把档案和身份掰开 → 改学号一律 409；只改名放行；`name` 键缺席时保留原值（旧写法把 `undefined` 绑给 better-sqlite3 直接 500），空 `name` → 400。
  - `server/routes/classes.js:74` 删班：**不再删 `students`**。班内有人 / 有账号 `class_id_ref` 指着它 / 有 `class_battles` 对阵 → 409，逐条报数量；只有真正干净的班才放行。
- 事务内回归（批复点名要的）：用 `BEFORE DELETE ON students` 触发器强制中途失败，断言 `students`、`evaluation_records`、`badges` 三张表全部回到删除前——不会出现「评价删了、人还在」的半截清理。
- 前端后果见 D10：`TeacherDesk.vue` 两处假成功必须 DSH 处理，否则教师会看到「界面删掉了、刷新又回来」。
- 测试：`server/legacy-delete.test.js` 共 18 例（学生删除 5 + 学生编辑 5 + 班级删除 5 + 盘点 3），全部用 99 开头假学号和「示例甲/乙/丙/丁」，不碰真实库。

## QD-09 / 单条入口的前缀冲突与班级语义 / 2026-11-13

- 状态：待审核
- 账号前缀冲突（批复「审查新增/编辑的账号前缀冲突」）：`server/routes/roster.js:48` 新增 `legacyIdentityConflict()`，把批量导入已经执行的那条 reject 规则搬到单条入口——
  - 新增学生：撞 `stu_<学号>` 旧账号 → 409；提交 `stu_<X>` 形态而 X 已在名单里 → 409（防「一名两身份」）。
  - 编辑学生：**只在真的改学号时查**。库里已有 `stu_990000001` 这类历史账号的学生，改名、转班照常放行，不会被历史脏数据卡死。
- 班级语义（批复「classId 与 className 语义」）：`classIdOf()` 在 `classId` 和 `className` 同时给出且指向不同班时返回 400，不再静默挑一个；两个字段同源（名字与 id 对得上）仍放行。已核对 DSH 的 `src/pages/v3/admin/Students.vue`：编辑器只发 `className`（`:119`/`:312`/`:322`），批量转班只发 `classId`（`:143`/`:371`），所以这条不会误伤现网页面。
- 单条创建无年级（批复「单条创建无年级」）：`server/routes/roster.js:162` 的班级名改为**按解析出的 `classId` 从库里反查**。前端下拉选班时 `body.className` 是空的，旧写法拿空串推年级，「七年级1班」这种明显带年级的班也会写成 NULL。
- `resolveGrade` 改为**班级名优先于课程名**（`server/game/import-roster.js:39-46`），与 Codex 在导入侧定的口径一致：学生转班后课程列往往还是旧年级，让课程名抢先就会把刚转过去的班又算回原年级。`roster.js` 的 PUT 与 bulk 走这条。
- D6 落地范围：只做 trim（`classes.js` 建班/改班的班级名、`classIdOf` 的班级名），「七年级 1 班」「七年级1班」「七(1)班」仍各自成班；`students.gender` 与 `characters.gender` 未互相覆盖。
- 测试：`server/roster.test.js` 新增「QD-09 单条入口的身份与班级语义」8 例（前缀冲突 3 + 班级二义 3 + 只给 classId 的年级 1 + 班级名压过课程名 1），该文件现 38 例。

## 第五轮实际执行的检查与结果

命令与真实输出（工作区 `d:/课件/platform/pet-garden-qoder`，基线 `1c8af2e`，代码提交 `36a8faf`）：

| 检查 | 命令 | 结果 |
|---|---|---|
| 全量测试 | `npx vitest run` | 21 文件 / **321 例全通过**（新增 `legacy-delete.test.js` 18 例，`roster.test.js` 26→38 例） |
| 断言有效性 | 把 `students.js`/`classes.js`/`roster.js`/`import-roster.js` 回退到 `1c8af2e` 再跑这两个文件 | 56 例中 **19 例失败**（含全部 409 闸、事务回滚、前缀冲突、班级二义、只给 classId 的年级），随后从临时副本还原并复跑 56/56 绿 |
| 类型 | `npx vue-tsc --noEmit` | 退出码 0 |
| 构建 | `npx vite build` | built in 15.80s |
| 产物自检 | `node scripts/verify-build.mjs` | 通过：首屏 JS 112.0KB · 懒加载 JS 6057.9KB · CSS 220.1KB · 页面分包 16/16（告警：CSS 偏大，非本批引入） |
| 乱码门禁 | `node scripts/check-mojibake.mjs --self-test` | ✅ 5 处全检出、教师身份排除、空班级 1 个 |
| 缺陷复现 | `node docs/handoffs/qoder-20261113-repro.mjs` | 缺陷仍在 **0/6**（Codex 改写后的版本，沙箱自动回收） |
| 真服务全链路 | 临时脚本：`PET_GARDEN_DB=<临时库> PORT=3997 node server/index.js`（跑完整 v1/v2/v3/v9~v11 迁移 + 种子），教师登录 → v1 建班 → v3 建学生 → v1 删/改 → v1 删班 → v3 带确认删除 | **15/15 通过**。正是这一档抓出单测漏掉的 `battle_records` 参数个数 500；进程用完即停，临时目录已删 |
| 生产零改动 | `stat server/pet-garden.db` | 冒烟前后 mtime 与字节数完全一致（`2026-11-12 13:21:50` / 614400），临时库走 `PET_GARDEN_DB`，未连 110.40.142.247 |

门禁期间发现的两处非本批问题（如实报，不擅自改别人的东西）：

1. `server/identity-audit.test.js` 在全量并行下撞 5s 默认超时，单独跑 2.18s 绿（起 node 子进程）。我把**自己的** `server/mojibake-cli.test.js` 显式放宽到 30s 并注明原因；Codex 的文件未动 → D12。
2. 冒烟登录只能用建库迁移写死的默认管理员口令，说明新库自带一组弱口令 → D11（不复述明文，也不在我边界内）。

第五轮未验证项（追加）：

1. `TeacherDesk.vue` 页面级点测未做：它是 DSH 的文件，且本批 409 只在后端成立。已把两处假成功的准确位置写进 D10 交 DSH。
2. `POST /api/students/import`（v1 批量导入）本批未碰：它在循环里逐行 INSERT、**没有事务也不查学号重复**，撞唯一索引会 500 并留下半批。现在教师端走的是 v3 `/api/v3/roster/import`，但旧端点仍挂着。要不要下线或补事务，请 Codex 决定（不在第四轮授权范围内）。
3. 真实 252 人名单仍未灌库（生产冻结），私有 seed 不进反馈区。

