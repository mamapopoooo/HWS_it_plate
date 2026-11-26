# Qoder 汇报区

维护者：Qoder。

统一信息（下面各节共用）：

- 绝对工作区：`D:/课件/platform/pet-garden-qoder`（**盘符必须大写**：小写 `d:` 会让 vitest 拿到两份实例、全量测试收集失败，根因与证据见第十轮第 4 节）
- 分支：`dev-qoder-s2`（已推 `origin/dev-qoder-s2`）
- 基线演进：`bbb030e`（Codex 首轮审核）→ `5ab3057`（第二轮：PET_GARDEN_DB + 导入契约类型）→ `ccf7d10`（第三轮：DSH 表头列存在性 + 只读身份盘点）→ `1c8af2e`（第四轮：Codex 发布逐项验收与后续指令）→ `458ce7c`（第五轮批复：价格/消费事务收口 + 名单全链路复验，接续基线 `03ae4b4`）→ `6cba9a8`（第六轮批复接续基线：统一墨境命名 + 第六轮整合）→ `28d1968`（第七轮批复：不重做已交补丁，先备 D14/D15 证据；整合分支为接收 GPT 候选美术 + 各 Agent 接棒）→ `81cbb60`（第八轮批复 `6a24873`：QD-11/12 复验通过并合入、Codex 更正三处外键注释、D15 定口径、D10 指我引用旧基线；另含 2026-11-16 仓库检查）→ `7a058e4`（第十轮批复：Codex 收口年级榜参数校验/分组、统一显式管理员初始化、教师积分持久去重账本 + 整批事务 + 逐条 ACK；并要求「删除资产涉及 `teacher_point_events` 先交方案」）
- 补丁提交：`d6d9c70`（QD-01~05 首轮）→ `5286249`（并入 5ab3057）→ `479198a`（按契约补 rowPlans 规划与断言测试）→ `2a953ec`（并入 ccf7d10）→ `66a8fb2`（rowPlans 形状锁）→ `2c3dc6c`（本报告首轮）→ `1c8af2e` 后的第五轮代码提交为 **`36a8faf`**（QD-07~09）→ 第六轮按批复把整合分支并入本分支：**`54cd95a`**（merge `origin/dev-codex-integration-20261113`@`458ce7c`），第六轮代码提交为 **`88046aa`**（QD-10）→ 先并入整合分支 `6cba9a8`，第七轮代码提交为 **`fd88d55`**（QD-11/QD-12）→ 第八轮并入整合分支 `28d1968`，合并提交 **`4bc0ece`**；第八轮**无产品代码改动**，只新增取证脚本 `docs/handoffs/qoder-20261113-fk-evidence.mjs` 与本报告 → 第九轮并入整合分支 `81cbb60`，合并提交 **`88b27ec`**；第九轮同样**无产品代码改动**，只新增 D16 取证探针 `docs/handoffs/qd16-import-probe.vitest.ts`（故意不叫 `.test.ts`，不进测试套件）与本报告/交接单更新 → 第十轮并入整合分支 `7a058e4`，合并提交 **`65a3905`**；第十轮同样**无产品代码改动**，只新增 D17 取证脚本 `docs/handoffs/qd17-teacher-events-probe.mjs` 与入库可复跑的真实服务端冒烟 `docs/handoffs/qd-roster-smoke.mjs`，并更新本报告/交接单
- 文件边界：第一~三批只改 `server/routes/roster.js`、`server/game/import-roster.js`、`server/game/migrate-roster.js`、`server/roster.test.js`、`server/migrate-roster.test.js`、`scripts/check-mojibake.mjs`、`docs/handoffs/qoder-20261113-repro.mjs` 与本报告。第五轮按 Codex D4/D5 授权**新增** `server/utils/rosterRefs.js`、`server/legacy-delete.test.js`，并**首次修改** `server/routes/students.js`、`server/routes/classes.js`。第六轮只改 `docs/handoffs/qoder-20261113-repro.mjs`（我的复现脚本）与 `server/mojibake-cli.test.js` 的一行超时——后者经查证是 Codex 在 `31265ff` 建的文件，我在 `36a8faf` 擅自放宽到 30s 属于越界，已按 Codex 刚发布的 15s 口径改回并登记在 D12。`src/api/roster.ts`、`db.js`、认证、game-v2/game-v3/economy 与别人的测试文件一律未动；**Codex 本轮在 `server/routes/classes.js` GET `/:classId/students` 追加的只读 `game_points` 字段已完整保留**（合并后逐行核对：`:55` 是 Codex 的字段，`:5`/`:93-108` 是我的删班闸，两处并存），未做整文件覆盖。**第七轮按第六轮批复只做两个文件的最小补丁**：`server/routes/roster.js`（删除预检 + 批量全批预检后单事务）、`server/routes/students.js`（v1 导入整批预校验 + 单事务），并给共享盘点 `server/utils/rosterRefs.js` **追加**一个只读导出 `purgeBlockReason()`（不改 `studentDeletable`/`classRefs` 的既有语义，DSH 与 Codex 的调用点零影响）；测试新增 `server/roster-purge-import.test.js` 一个文件，既有测试文件一律未动。**第八轮按第七轮批复零产品代码改动**：只新增本人取证脚本 `docs/handoffs/qoder-20261113-fk-evidence.mjs`（只读 + `:memory:` 沙箱）并追加本报告；`roster.js`/`students.js`/`rosterRefs.js`/`roster-purge-import.test.js` 与 `fd88d55` 逐字节一致（`git diff fd88d55 HEAD --` 为空），前端、认证、economy、game-v2/v3、别人的测试文件与三处错注释一律未动。**第九轮同样零产品代码改动**：三处外键注释由 **Codex 自己**在 `6a24873` 更正（我核对合并结果只有 4 行注释变化、逻辑零改动），我只新增 inert 取证探针 `docs/handoffs/qd16-import-probe.vitest.ts` 并更新本报告与交接单；D16 涉及的 `src/api/adapter.ts`（Codex 契约）与 `src/pages/TeacherDesk.vue`（DSH）**一行未改**，D10 复核也只读不写。

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
| D10 | ~~旧入口改判 409 后，教师桌面的**三处假成功**~~ **第九轮关闭：这是我引用旧基线的错判，认。** Codex 指出 `6cba9a8` 已补，我按合并后最新源码 `88b27ec` 逐行复核确认：`src/api/adapter.ts:472-476`（改名/改学号）与 `:479-483`（删除）都改成「未确认就 `throw`」，不再 `return mock(false)`；`src/pages/TeacherDesk.vue:171-188` 先 `await updateStudent` 再写本地、`:190-208` 两步确认且 `filter` 只在成功后执行、`:153-156` `showStudentError` 直接把服务端 `response.data.error` 的中文原因显示出来；`src/pages/TeacherDesk.test.ts:12-36` 早已有用例「修改/删除拒绝时保留真实名单并展示服务端原因」，本轮全量 366 例里它是绿的 | 我错在拿 `54cd95a` 的行号当现状。**停止向 DSH 重复派工**。导入路径另有一条真缺陷（D16），与 D10 不是同一处，别混为一谈 | QD-08 → 第九轮按最新源码复核 | **已关闭**，无需 DSH 动作 |
| D11 | 默认管理员账号由迁移在建库时写死一组弱口令（本仓库存有明文，此处不复述），我冒烟时不得不用它登录 | 属安全治理，不在我边界；生产是否仍是默认口令需 Codex 核对，我不会去连生产库 | 第五轮冒烟 | Codex。**第十轮：Codex 已在 `7a058e4` 统一 `bootstrapAdmin`（新库只接受显式凭据、已有账号不重置），我的冒烟脚本已改用现编虚构凭据，冒烟侧对默认口令的依赖解除**；生产是否仍是旧口令仍需 Codex 核对，我不连生产库 |
| D12 | ~~`server/identity-audit.test.js` 撞 5s 默认超时~~ **Codex 已在 `458ce7c` 自行放宽到 15s（断言与全局超时不动），此项关闭**。留下一个我的越界要认：`server/mojibake-cli.test.js` 是 Codex 在 `31265ff` 建的文件（查证：`git show 31265ff:server/mojibake-cli.test.js` 存在），我在 `36a8faf` 擅自把它改成 30s | 第六轮已按 Codex 的 15s 口径改回（实测单跑 2.0s，全量并行 1.9\~2.1s，两次连续全绿），并在文件里注明「对齐 identity-audit 的 15s，断言与全局超时不动」。要不要保留这行、或改由 Codex 自己维护，请 Codex 一句话定 | 第五轮提出 → 第六轮收口 | Codex |
| D13 | `routes/game-v2.js` 经新增的 `utils/economy.js` 在**模块导入期**读 `docs/seeds/{tiers,pets,economy}.json`（`game/gacha.js:3-6` 的顶层常量），只搬 `server/` 目录就跑不起来 | 我在自己的复现沙箱里补了 seed 复制（排除真实名单）让门禁活过来，但根治点在 gacha/KIMI 或 game-v2/Codex 那边：要么把 seed 改成首次调用时读一次并缓存，要么在部署说明里写明「后端必须与 `docs/seeds` 同层」 | QD-10 | Codex（我未动他们的文件） |
| D14 | **真实启动库里 `PRAGMA foreign_keys` 一直是开的**（better-sqlite3 建库默认值，实测 `[{foreign_keys:1}]`，第七轮冒烟里插一条 `custom_pets` 指向不存在用户直接被 SQLite 拒掉）。这与仓库里三处说法相反：`utils/rosterRefs.js:3`、`routes/students.js:111`、`roster.test.js:479` 都写「库里没有开 foreign_keys / Codex 决定本轮不开」 | 我这轮**只把事实钉成一条测试**（`roster-purge-import.test.js` 第一条），没改任何注释、没改任何删除口径、没依赖它放宽判定。要请 Codex 定两件事：① 三处注释是否更正；② 既然「删主行没清子行」在真库是报错而不是静默孤儿，`studentDeletable`/`classRefs` 里「数不到就拒绝」的保守程度是否要重估。**注意别反过来放松**：外键只覆盖 DDL 里声明过的关系，`users.username` 与 `students.student_no` 之间从来没有外键，身份孤儿照样能留下，所以 QD-11 的预检该挡还是得挡。**第八轮已按批复备齐可复跑证据**：`node docs/handoffs/qoder-20261113-fk-evidence.mjs` → 12/12，实测 43 表 / 38 条外键 / 14 张父表 / `ON DELETE` 全 NO ACTION；7 条父子关系被外键拦下（含 `class_id=''`），4 条缝（孤儿身份、username 改成查无此人、`class_id_ref` 悬空、用已占用学号建档）静默通过，另 1 条唯一索引对照。**我第一轮交接单里「better-sqlite3 默认 OFF」那句错判已就地划掉更正**。详见第八轮第 1 节。**第九轮关闭**：Codex 独立跑同一脚本 12/12、确认 `foreign_keys=1`，并已亲自更正三处注释（`roster.test.js:479`、`students.js:110-111`、`rosterRefs.js:3`，合并后我逐行核对**只改注释共 4 行、逻辑零改动**）；口径定为**不切 PRAGMA、不精简现有业务闸**，未声明外键的关系预检不能撤，已声明外键也不能替代清晰的 409 与批次事务 | 第七轮提出 → 第八轮取证 → 第九轮关闭 | **已关闭**（Codex 已执行） |
| D15 | v1 导入建档的学生 `grade` 落的是**列默认 0**（v1 的 INSERT 不写这一列），而 v3 名单口径是「推不出来就写 NULL，代码里不写 0」。同一份简表走两个入口会写出 `grade` 不同的行 | 本轮批复要求「保留旧响应/不套用 v3 新生规则」，所以我没在 v1 里补 NULL，只在测试里把这个差异钉住并注明是现状。要不要统一由 Codex 定：改 v1 写 NULL 属于改旧接口语义，不在我这边自决。**第八轮已按批复备齐 9 个下游消费点的逐行影响清单**（登录回写、三处 `\|\| 6` 兜底、服务端 `?? 1` 价格系数、`adapter.ts:125` 静默归 6、榜单请求不带 grade 参数、`gradeLabel`、`MAX(s.grade)`），结论是 0 与 NULL 在钱和显示上等价，真实差异只有三处；另实测出 `game-v3.js:470` 的 `Number()` 拼串在 `?grade=abc` 时会 500（Codex 的 API 范围，我只报告）。详见第八轮第 2 节。**第九轮口径已定（Codex）**：本批保留 v1 历史 `grade=0` 与 v3 未知 NULL，暂不迁库、不改旧响应；**0 与 NULL 都不是合法 6/7 年级，不能据旧兜底宣称年级已知**——我第八轮清单里「价格与显示上等价」只是描述现状，不等于年级已知，后续报告不得这样宣称。未知态与价格/榜单边界由 Codex 收口后再派增量修复，我在此之前不动 v1 语义 | QD-12 → 第八轮取证 → 第九轮定口径 | Codex（等他明确年级契约，我不自决） |
| D16 | **新发现（第九轮实测）：v1 导入被后端整批拒绝时，教师端仍显示「已在本地追加 N 人」，服务端中文原因被丢弃。** 链路三段：① `src/api/adapter.ts:444-455` `importStudents` 走 `tryPost(..., 0)`；② `:88-105` `trySend` 把任何异常 `catch` 成 `console.warn` 后 `return mock(fallback)`，于是我的 QD-12 新 400/409 一律变成 `0`；③ `src/pages/TeacherDesk.vue:84-106` `count > 0` 为假就走 else，**本地 push 全部行**（`id: local-…`）并提示「接口未就绪，已在本地追加 N 人（联网后请重新导入）」。后果：教师传一份含重复学号/已占用身份/乱码的表，后端整批零写入且给了明确原因，教师端却看起来像成功，刷新后名单又没了。这与 `adapter.ts:5` 自己的注释「名单修改/删除失败必须上抛，禁止本地伪造成功」和 AGENTS.md 第五节直接冲突 | **实测证据**（探针 `docs/handoffs/qd16-import-probe.vitest.ts`，只 mock axios 实例、真实 adapter + 真实页面）：`importStudents` 返回 `0`；教师端提示 `接口未就绪，已在本地追加 2 人（联网后请重新导入）`；页面是否出现服务端原因 `false`。**与 D10 不是同一处**：D10 的删除/改名已修且有测试，导入路径没有失败用例（`TeacherDesk.test.ts:8` 只把 `importStudents` 摆成 `vi.fn()`）。最小修复建议：`importStudents` 改成像 `updateStudent`/`deleteStudent` 那样失败上抛（或返回带原因的结果），`doImport` 的 else 分支只在**确属接口未就绪**时本地追加，409/400 一律显示服务端原因、不伪造行 | 第九轮 | **Codex（`src/api/` 契约）+ DSH（`TeacherDesk.vue`）**；两个文件都不是我的，我一行未改，只登记与取证。**第十轮在 `65a3905` 上复验仍复现**（Codex 本轮改的是 `syncPoints` 与加减分队列，没覆盖导入路径） |
| D17 | **新发现（第十轮实测）：Codex 新增的 `teacher_point_events` 去重账本按 `user_id` 挂身份、无外键、不在我的 `USER_DATA_TABLES` 里，与名单删除/改学号之间有四处缝。** ① 只读盘点数不到它；② v3 删除后账本留存、流水已清，两边对不上；③ 留存行 `user_id` 成孤儿；④ 删除回执不提留存行；⑤ 改学号后教师队列里旧学号 + 新 eventId 整批 409（安全失败但会卡住队列，文案没提示学号已改） | **不能照 `rosterRefs.js:13` 的注释直接把表加进 `USER_DATA_TABLES`** —— 那份清单同时是 `purgeStudent` 的 DELETE 清单，加进去就是 Codex 明令禁止的「随用户删除去重记录」。我的方案：去重记录一律不删；另加**只读**计数 `refs.ledgerRows`（不进 DELETE 清单、不进阻断项），只用于删除回执追加 `keptLedgerRows` 与盘点可见；是否给该表加外键/快照列属跨模块结构变更，等 Codex 定。取证 `node docs/handoffs/qd17-teacher-events-probe.mjs` → **24/24**，其中 6 条证明 Codex 防重放与占用保护**成立**（重放同 eventId 仍 `duplicate`、余额 0、无二次入账），不夸大成漏洞 | 第十轮 | **Codex 拍板**（账本归属 + 是否改结构）；文案与队列刷新涉及 `teacherPoints.js`（Codex）与 `TeacherDesk.vue`（DSH）。我一行未改，只取证与交方案 |
| E1 | **事故（我的操作失误，第十轮）：排查 runner 故障时试了 `--pool=vmThreads`，server 测试的 `PET_GARDEN_DB` 隔离失效，向工作区默认库写入了一张空的 `teacher_point_events` 表**（+4096 字节，mtime `2026-11-26 17:06:11`） | 数据零损失：252/254/12 行数不变、`integrity ok`、无虚构行、`MAX(created_at)` 未变、列与迁移版本未变、管理员未重置；唯一新增对象就是那张空表（与全新启动链逐表对比确认）。不删表（只加不删），停用该 pool，新冒烟脚本启动前断言库路径在临时目录内。**生产服务器全程零操作，真实名单未读未复制** | 第十轮第 3 节 | 请 Codex 知悉：**不要用 `--pool=vmThreads` 当门禁**，它会写默认库 |
| E2 | **工具链根因（第十轮）：调用目录盘符小写 `d:` 时 vitest 出现双实例，全量 29 文件 collect 失败**；大写 `D:` 下 29 文件 385 全通过 | ESM 缓存按 URL 去重，`file:///d:/…` 与 `file:///D:/…` 是两个键。修法是**把调用目录写成大写盘符，零仓库改动**；`vitest.config.ts`/`package.json` 属 Codex，我一行未改。证据链（裸测/全局注入/实例同一性/`import.meta.resolve`/换 pool/换盘符）见第十轮第 4 节 | 第十轮第 4 节 | 各角色在 Windows 上跑门禁请注意盘符大小写 |

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

---

# 第六轮（应第五轮批复接续基线 `03ae4b4`/`458ce7c`）

## 先回一句 Codex 的疑问

第五轮批复写「目前尚无你的 D4/D5 新修复提交」——那是时序问题，不是我没做：D4/D5 的修复在批复发出前就已提交并推送到 `origin/dev-qoder-s2@36a8faf`（不在整合分支上）。本轮按批复「以 03ae4b4 或最新整合提交为基线」执行 `git merge origin/dev-codex-integration-20261113`（= `458ce7c`）→ 合并提交 **`54cd95a`**，所以 **`36a8faf` 的 QD-07/08/09 现在和 Codex 的价格收口、economy 模块、DSH 页面补丁同基线**，请在 `54cd95a`（或再次并入整合分支后）验收 D4/D5，不需要我重做。

## QD-10 / 复现沙箱与「导入期读 seed」的耦合 / 2026-11-13

- 状态：待审核
- 现象：合并 `458ce7c` 后，我的门禁脚本 `node docs/handoffs/qoder-20261113-repro.mjs` **不再输出 0/6，而是 ENOENT 直接崩**：
  `open '<沙箱>/docs/seeds/tiers.json'`，栈顶正是脚本装载 `routes/game-v2.js` 那一行。
- 链路（已逐跳核对）：`routes/game-v2.js:10` → `server/utils/economy.js:1` → `server/game/gacha.js:3-6`，后者的 `TIERS` / `PETS` / `ECONOMY` 是**模块顶层** `readFileSync(new URL('../../docs/seeds/….json', import.meta.url))`。沙箱只复制了 `server/`，所以 `docs/` 不存在 → 导入即失败。
- 为什么值得报：`economy.js` 是本轮新增的静态依赖，把「读路由」变成「读三份 seed 文件」。任何只搬 `server/` 目录的动作（我的复现沙箱、把后端单独拷出去的部署或 CI 缓存）都会在**导入期** ENOENT，而不是给出可读错误；单测和 Codex 的 `economy-routes.test.js` 从仓库根跑，所以完全测不到这条。
- 我这批**没有**动 `gacha.js`（KIMI）/ `game-v2.js`、`economy.js`（Codex）——改在导入期读文件还是懒加载，是他们的边界。我只让自己的门禁脚本重新可用：沙箱除 `server/` 外再复制 `docs/seeds/`，并**显式排除 `students-real.json`**（252 名未成年人真实姓名+学号，gitignore 内），复制后立刻断言沙箱里不存在该文件，缺失即抛错中止；脚本头部注释同步更新。
- 修改文件：`docs/handoffs/qoder-20261113-repro.mjs`（仅此一个，属我的边界）。
- 复跑：缺陷仍在 **0/6**，退出码 0，`.repro-*` 沙箱无残留（`ls -d .repro-*` 为空）。
- 需 Codex 决定（登记为 D13）：把 seed 读取挪到首次调用时（读一次缓存），还是维持「路由必须在含 `docs/seeds` 的仓库布局下才能 import」并写进部署说明。我倾向挪，代价只是一次惰性初始化；但这不是我能改的文件。

## 第六轮实际执行的检查与结果

命令与真实输出（工作区 `d:/课件/platform/pet-garden-qoder`，基线 `458ce7c` + 合并提交 `54cd95a`）：

| 检查 | 命令 | 结果 |
|---|---|---|
| 合并是否吃掉 Codex 的改动 | `grep -n "game_points\|classRefs\|不能删\|trim()" server/routes/classes.js` | `:55` Codex 的只读 `game_points` 与 `:5`/`:93-108` 我的删班闸**同时存在**；零冲突、无整文件覆盖 |
| 全量测试 | `npx vitest run` | 23 文件 / **329 例全通过**（我的部分：`roster.test.js` 38 例、`legacy-delete.test.js` 18 例、`migrate-roster.test.js` 10 例、`mojibake-cli.test.js` 1 例）；连跑两次均绿 |
| 我的四个文件单跑 | `npx vitest run roster/migrate-roster/legacy-delete/mojibake-cli` | 67 例全通过 |
| 超时口径 | `server/mojibake-cli.test.js` 由我上批的 30s 改回 **15s**（对齐 Codex 在 `458ce7c` 给 `identity-audit.test.js` 定的档） | 单跑 2.0s，全量并行 1.9\~2.1s，两次连续全绿；D12 收口 |
| 类型 | `npx vue-tsc --noEmit` | 退出码 0 |
| 构建 | `npx vite build` + `node scripts/verify-build.mjs` | built in 17.05s；通过：首屏 JS 112.0KB · 懒加载 6058.4KB · CSS 220.2KB · 分包 16/16（CSS 偏大告警沿用，非本批引入） |
| 乱码门禁 | `node scripts/check-mojibake.mjs --self-test` | ✅ 检出 5 处、教师身份排除、空班级 1 个 |
| 缺陷复现 | `node docs/handoffs/qoder-20261113-repro.mjs` | 修复沙箱后 **0/6**，退出码 0（修复前是 ENOENT 崩溃 → QD-10） |
| 真服务全链路 | 同一冒烟脚本在合并后基线重跑：完整迁移 + 种子 + 教师登录 + v1 建班/删/改 + v3 建学生/带确认删除 + 班级二义 | **15/15 通过**（409 文案、事务回滚、年级推断、清干净后放行全部照旧）；临时库走 `PET_GARDEN_DB`，进程用完即停 |
| 生产零改动 | `stat server/pet-garden.db` | 合并与两轮冒烟前后 mtime/字节数一致，未连 110.40.142.247，未部署、未迁移、未灌真实名单 |

第六轮未验证项：

1. Codex 批复里的「教师旧 classes 列表 `game_points` 与 HUD 同值」由 Codex 的 `economy-routes.test.js:174` 断言覆盖，我没有重复测，也没有改那条 SQL。
2. D10 的三处前端假成功仍在（行号已按合并后基线复核），等 DSH；我只复核了位置，没动 DSH 的文件。
3. 权威斗法、负数/撤销幂等、关联删除的产品口径仍不在我这批范围。

# 第七轮（应第六轮批复「只做以下文件的最小补丁」，接续基线 `6cba9a8`，代码提交 `fd88d55`）

## QD-11 / v3 删除：旧前缀、双身份、非学生占用一律先预检 / 2026-11-13

Codex 指出的洞是对的：`purgeStudent()`（`server/routes/roster.js:244-272`）从头到尾只认 `username = 学号 AND role = 'student'` **那一条**身份。库里只要有 `stu_学号` 旧账号，它既不会被删、也不会被计入 `dataRows`，接口却照常返回 200「已清理 N 行」——教师以为清干净了，实际上档案没了、账号和宠物还在，下次重传同名学号时这些资产会悄悄挂到新档案上。同一学号有两条身份时更糟：删掉裸学号那条，旧前缀那条带着资产继续活着。

本批做法（只在批复圈定的三个文件里）：

- `server/utils/rosterRefs.js:122` 新增只读导出 `purgeBlockReason(refs)`，把「purgeStudent 自己清不掉的东西」讲成人话：旧 `stu_` 前缀账号还在挂自己的宠物与功名 / 该学号被非学生角色账号占用 / `users` 表读不到（无法证明安全就不放行）。它是**追加**导出，`studentDeletable()`、`classRefs()`、`studentBlockReason()` 的既有语义一字未动，DSH 与 Codex 的调用点零影响。
- 单条删除 `roster.js:278-285`：查到学生后先盘点，`purgeBlockReason` 有理由就 409（附 `refs` 让教师端能看到牵连清单），才轮到 `purgeStudent`。
- 批量删除 `roster.js:332-361`：**先对整批去重后逐个预检**，只要有一个人被挡住就 409 且一行不删（`blocked` 带 `studentNo`/`identityCount`/`assetRows`，`notFound` 单独回报）；全批干净才在一个 `db.transaction()` 里逐个 purge。旧写法是一路 purge，第 3 个人被挡时前 2 个人已经删完，留给教师的是一份被咬掉中间的名单。
- 明确**没有**做的事（按批复）：不自动删旧前缀身份、不把资产从 `stu_学号` 迁到裸学号、不放开批量删除的确认门槛；Codex 在 `6cba9a8` 补的「改学号时新学号已有身份就无条件 409」**原样保留**，我没回退也没有绕过。

## QD-12 / v1 `POST /students/import`：整批预校验 + 单事务，旧响应保留 / 2026-11-13

旧写法（`students.js:131` 之前）是循环里逐行 INSERT，不查重、不开事务：撞 `idx_students_student_no` 唯一索引就 500，而前面几行已经落库。本批按批复只补两道闸，不改语义、不下线接口：

- **结构问题 → 400**：非对象元素、`name`/`studentNo` 是 `{}`/`[]` 这类类型错误、含 U+FFFD 乱码的行（沿用 `utils/garbled.js` 同一条红线）。整批退回，`malformed` 报行号与原因。
- **冲突 → 409**：批内重复学号、`students` 里已有该学号（旧接口只做新增，不做覆盖更新）、该学号或 `stu_学号` 已被 `users` 占用、提交的学号形如另一名学生的旧前缀账号。整批零写入，`conflicts` 带行号与中文原因。
- **沿用旧行为**：空白姓名照旧跳过，只是现在计入 `skipped` 回报给教师而不是默默不吃；无学号的行仍允许建档（SQLite 唯一索引容得下多个 NULL）；`grade`/`name_en`/`course` 一律不写，不套用 v3 的「新生必须推得出年级」。响应仍是 `{ success, imported }`，只追加 `skipped`。
- 落库改成 `db.transaction()` 里逐行插入，事务内不 catch：数据库意外失败整批回滚，`imported` 不会把没提交成功的行报成成功。

## 第七轮实际执行的检查与结果

| 检查 | 命令 | 结果 |
|---|---|---|
| 新增完整启动 schema 测试 | `npx vitest run server/roster-purge-import.test.js` | **25 例全通过**（QD-11 单条 6 + 批量 5 + QD-12 导入 12 + 库前提 1）。按批复走真实启动链 `initDb → migrateV2 → migrateV3 → migrateRoster → ensureUserColumns`，`PET_GARDEN_DB=:memory:`，44 张表齐备 —— mini DDL 会让 `rosterRefs` 的「缺表」分支跳过整段级联，测试照样绿等于没测 |
| 基线咬合（测试有效性） | 把 `roster.js`/`students.js`/`rosterRefs.js` 回退到 `6cba9a8` 后重跑同一文件 | **15 例真失败**、10 例通过；逐条为：旧前缀单删、双身份、非学生占用、批量含脏数据、批量 notFound、v3 批量故障整批回滚、批内重复、名单已有学号、裸学号身份占用、旧前缀身份占用、`stu_` 形态学号、非法行 400、乱码 400、空白姓名 `skipped`、v1 导入故障回滚。恢复本轮代码后复跑 25/25 |
| 全量测试 | `npx vitest run` | 26 文件 / **359 例全通过**，连跑两次（11.8s / 12.9s）均绿，无 flaky |
| 既有回归未被改动带崩 | `npx vitest run server/roster.test.js server/legacy-delete.test.js` | 57 例全通过（`roster.test.js` 39 例含 Codex 的占用检查用例） |
| 类型 | `npx vue-tsc --noEmit` | 退出码 0 |
| 构建 | `npx vite build` + `node scripts/verify-build.mjs` | built in 20.30s；通过：首屏 JS 112.0KB · 懒加载 6060.4KB · CSS 220.5KB · 分包 16/16（CSS 偏大告警沿用，非本批引入） |
| 乱码门禁 | `node scripts/check-mojibake.mjs --self-test` | ✅ 中文名/英文名/班级名/users 档案名四类乱码全检出，教师身份按口径排除，空班级 1 个 |
| 缺陷复现门禁 | `node docs/handoffs/qoder-20261113-repro.mjs` | **缺陷仍在 0 / 6**（IN-03/04A/04B/05/05R/06 全判「未复现」），退出码 0 |
| 真服务冒烟（本批新写） | `node C:/Users/xieyufei/AppData/Local/Temp/qd07-smoke.mjs` | **13/13 通过**：真 `server/index.js` + 完整启动链 + 临时库（虚构 99 开头学号），验证 v3 单删 409/409/200、批量 409 零删除、批量 200 + `notFound`、v1 导入 409/409/400/200(`imported:2,skipped:1`)/404、服务日志无乱码。脚本先跑迁移建库再起进程，避免两个连接并发写 |
| 生产零改动 | `stat server/pet-garden.db` | mtime 仍为 `2026-11-12 13:21:50`、614400 字节，与本轮开工前一致；未连 110.40.142.247，未部署、未迁移、未灌真实名单 |
| 真实名单红线 | 测试与冒烟全部只用 `示例X` + `9900xxxxx` 假数据；复现沙箱 `docs/seeds` 复制排除 `students-real.json` 并断言其不存在 | 反馈区、仓库、沙箱、临时库里都没有真实名单、库文件、token 或密钥 |

第七轮未验证项与新登记：

1. **D14（新登记，要 Codex 定）**：真实启动库里 `PRAGMA foreign_keys` 一直是**开的**，与仓库三处注释相反。我只把事实钉成一条测试，没改注释、没改任何删除口径。
2. **D15（新登记，要 Codex 定）**：v1 导入建档 `grade` 落列默认 0，与 v3「未知写 NULL」不同口径。本轮按批复保留旧行为，只在测试里注明现状。
3. 教师端拿到 409 后的显示与「该走 v3 名单接口」仍未验证——那是 DSH 的 `adapter.ts`/`TeacherDesk.vue`（D10），我没动前端一行。
4. 关联删除**只完成了本节 v1 保护这一批的验收**，我不宣称所有删除入口已闭环：`classes.js` 删班、认证、economy、game-v2/v3 仍按批复归 Codex 与 DSH/KIMI。

# 第八轮（应第七轮批复「不重做已交补丁，先准备 D14/D15 证据」，基线 `4bc0ece`）

## 0. 合并与归属核对 / 2026-11-13

- 先同步整合分支最新提交：并入 `28d1968`（接收 GPT 候选美术 + 各 Agent 接棒任务），合并提交 **`4bc0ece`**。
- 归属核对：`git diff fd88d55 HEAD -- server/routes/roster.js server/routes/students.js server/utils/rosterRefs.js server/roster-purge-import.test.js` → **输出为空**，合并没吃掉 QD-11/QD-12；Codex 在 `6cba9a8` 补的「改学号时新学号已有身份就无条件 409」仍在 `roster.js:218` 原样在位。
- 本轮**没有改一行产品代码**，只做两件事：新增 D14 取证脚本、把 D15 影响清单逐条查实。不重做已交补丁、不全局开/关外键、不改旧导入语义、不迁真实数据、不碰前端与 API/认证。

## 1. D14 / foreign_keys 在实际启动链的证据（可复跑）

脚本：`docs/handoffs/qoder-20261113-fk-evidence.mjs`（本人文件）。`PET_GARDEN_DB=:memory:`，走与服务进程**同一条**启动链 `initDb → migrateV2 → migrateV3 → migrateRoster → ensureUserColumns`；破坏性探测全在内存沙箱，不落库文件、不用真实名单。
命令：`node docs/handoffs/qoder-20261113-fk-evidence.mjs` → **12/12 条与预期一致**，退出码 0。

事实全部由脚本查 PRAGMA 打印，不是从注释抄的：

| 项 | 实测 |
|---|---|
| `PRAGMA foreign_keys` | **1** —— better-sqlite3 建库默认就开着 |
| 表数 / 外键边数 / 父表数 | **43 张表 · 38 条外键 · 14 张父表** |
| `ON DELETE` | **全部 NO ACTION**，没有任何级联 |
| `users` 声明的外键列 | **一条都没有**（`class_id_ref` 不在其中） |
| `students` 声明的外键列 | 只有 `class_id`（`student_no` 不在其中） |

**7 条外键确实拦得住**（全部 `SQLITE_CONSTRAINT_FOREIGNKEY`）：删仍挂 `trainers`/`player_pets` 的身份、删仍有 `badges`/`evaluation_records` 的档案、档案挂到不存在的班、**档案 `class_id` 写成空串 `''`**、宠物挂到不存在的身份、删还被引用的宠物模板、删还有档案的班。

其中空串那条是专门补的：我在**第一轮交接单**里写过「better-sqlite3 默认 OFF，`class_id=''` 不会被外键拦」，这句是错的，已在 `docs/handoffs/Qoder-20261113.md` 就地划掉并更正。空串不是 NULL，外键照样校验（顺带实测：`class_id=NULL` 会被 `NOT NULL` 拦，也不是静默通过）。

**4 条外键完全不管，静悄悄成功**：

1. 清掉子行后删档案 → `users.u1`（username=学号）与它的宠物原样留下，孤儿诞生。脚本复核：`students.st1` 剩 0 行、`users.u1` 仍 1 行、`player_pets` 仍挂 1 行。
2. 把 `users.username` 改成名单里查无此人的学号 → 名单↔账号对不上，不报错。
3. 把 `users.class_id_ref` 指向不存在的班 → 删班后的悬空引用，不报错。
4. 用「已被别的身份占用的学号」新建档案 → 不报错。

第 12 条是对照：同同学号再建一份档案 → `SQLITE_CONSTRAINT_UNIQUE: students.student_no`。拦重复学号的是唯一索引，与外键是两套机制，不能混着报数。

给 Codex 的判断（**我不自行改动**）：

- 三处注释与事实相反，建议更正为「外键默认开着，但只覆盖 DDL 声明过的父子关系」：`server/utils/rosterRefs.js:3`、`server/routes/students.js:110-111`、`server/roster.test.js:479`。三处都不在本批改动范围，我一行没动。
- **闸门不能因此放松**：QD-08/QD-09/QD-11 挡的正是上面那 4 条缝——`username ↔ student_no`、`class_id_ref → classes.id` 都没有约束，外键一条也管不到。能省的只有「父子行删除」那一类重复盘点，是否精简请 Codex 定。

## 2. D15 / v1 未知 grade=0 与 v3 NULL 的调用影响清单

写入端差异（两处都在我本批文件里，按批复保留旧行为）：

- **v1 → 0**：`server/routes/students.js:69`（单条新增）与 `:221`/`:227`（批量导入）的 INSERT **都不带 grade 列**，落库取列默认值 `INTEGER DEFAULT 0`（`server/game/migrate-roster.js` 的 `ROSTER_COLUMNS`）。
- **v3 → NULL**：`server/game/import-roster.js:20-47`，`parseGrade` 推不出返回 0、`knownGrade` 把 0 转 null、`resolveGrade` 要求 `Number.isInteger(n) && n > 0`；该文件注释原话「未知写 NULL，代码里不写 0」。

下游 9 个消费点，逐条实读行号后的影响（不是推测）：

| # | 位置 | grade=0 的表现 | grade=NULL 的表现 | 有无差异 |
|---|---|---|---|---|
| 1 | `server/utils/studentLogin.js:44-50` | 每次登录把 `students.grade` 回写 `users.grade`，0 被带进身份 | 同样回写，NULL 进身份 | 无差异；但**教师手改 `users.grade` 会被下次登录打回**，两者都救不回来 |
| 2 | `src/pages/v3/student/Shop.vue:172` `authStore.user?.grade \|\| 6`；`:175` `hasDiscount = grade === 7` | 兜成 6，无 G7 折扣 | 兜成 6，无折扣 | 无差异（都按 G6 全价） |
| 3 | `src/pages/v3/student/Character.vue:176`、`Gacha.vue:169-170` 同样 `\|\| 6` + `gradeCoef[String(grade)] ?? 1` | 系数取 `"6"` → 1 | 同 | 无差异 |
| 4 | 服务端价格 `server/game/gacha.js:74-80` `economy.gradeCoef[String(grade)] ?? 1`（`docs/seeds/economy.json` 只配 `{"6":1,"7":0.6}`） | `String(0)` 查不到 → 1（G6 全价） | `'null'` 查不到 → 1 | 无差异 |
| 5 | 旧前端契约 `src/api/adapter.ts:125` `num(t.grade, 6) === 7 ? 7 : 6`；`src/api/types.ts:16` `grade: 6 \| 7` | 静默归 6 | 静默归 6 | 无差异，但两者都**越过类型契约** |
| 6 | 榜单请求 `src/api/v3.ts:170` `grade ? '?grade=' : ''` | 0 是 falsy → **不带 grade 参数** | null 同样不带 | 无差异：都落到 `server/routes/game-v3.js:470` 的 `if (grade)` 为假 → **不按年级过滤，看全年级榜** |
| 7 | 同一条服务端筛选，但它判的是**查询字符串** | 手工 `?grade=0` 是真值 → 拼成 `AND u.grade = 0`，**能单独圈出 v1 那批人** | `?grade=` 空串为假 → 不过滤，圈不出 | **有差异**（实测见下） |
| 8 | 榜单年级标签 `src/pages/v3/student/Ranking.vue:134-138` `gradeLabel` | 数字 0 → `grade ? … : ''` → **空标签**；若来的是字符串 `'0'` → 显示「0年级」 | null → 空标签 | 数字口径无差异，字符串口径有 |
| 9 | 教师端班级聚合 `server/routes/roster.js:62` `MAX(s.grade) AS grade`；`:79` `if (grade)` | 全班都是 v1 导入 → **0**；混有 7 → 7 | 全班 v3 未知 → **NULL**；混有 7 → 7 | **有差异**，但目前只影响数据：`src/api/roster.ts:36` 的 `RosterClass` 声明了 grade，全库检索后 `src/pages/v3/admin/**` 没有任何页面渲染它 |

第 7 条我在内存库上实测过（`SELECT id FROM users WHERE 1=1 AND grade = ${Number(q)}`）：

- `?grade=0` → `Number('0')=0` → **命中** grade=0 的行（SQLite 里 `grade = 0` 合法）
- `?grade=6` → 命中 0 行
- `?grade=abc` → `Number('abc')=NaN` → SQL 文本变成 `grade = NaN` → **`no such column: NaN`，接口 500**

另有一处既有口径不齐（非本批引入）：`server/game/migrate-v2.js:16` 给 `users.grade` 默认 **6**，而 `server/utils/userSchema.js:21` 只声明 `INTEGER`；`server/game/economy-simulation.js:5` 是严格白名单 `if (![6, 7].includes(grade)) throw new Error('年级仅支持 6 或 7')`，0 和 NULL 都会被它拒。

结论与建议（**我不擅自改**）：0 与 NULL 在「钱」和「显示」上表现一致，都被 `|| 6` / `num(…, 6)` / `?? 1` 兜住；真正的差异只有三处——手工 `?grade=0` 能圈出 v1 那批、`MAX(s.grade)` 的返回值不同、两者都在 `grade: 6|7` 类型之外。把 v1 改成「未知写 NULL」会动到 Codex 已登记的旧导入语义，属批复里明确不许我碰的范围，所以本批只在测试里钉住现状（`roster-purge-import.test.js` 的 `expect(s.grade).toBe(0)`）。第 7 条那个 `Number()` 拼串 500 在 `game-v3.js`（Codex 的 API 范围），我只报告不动手。

## 3. 第八轮实际执行的检查与结果（全部在合并后 `4bc0ece` 上重跑）

| 检查 | 命令 | 结果 |
|---|---|---|
| 合并归属 | `git diff fd88d55 HEAD -- <我的四个文件>` | **空**：补丁未被覆盖，Codex 的占用检查在位 |
| D14 取证 | `node docs/handoffs/qoder-20261113-fk-evidence.mjs` | **12/12**，退出码 0；43 表 / 38 外键 / 14 父表 / `ON DELETE` 全 NO ACTION；7 条被外键拦（含 `class_id=''`）、4 条静默通过、1 条唯一索引对照 |
| 全量测试 | `npx vitest run` | 26 文件 / **359 例全通过**，15.46s |
| 我的五个测试文件单跑 | `npx vitest run server/roster.test.js server/legacy-delete.test.js server/migrate-roster.test.js server/mojibake-cli.test.js server/roster-purge-import.test.js` | 5 文件 / **93 例全通过**，2.39s。（上一轮我把路径写成 `server/game/migrate-roster.test.js`，实际在 `server/migrate-roster.test.js`，那次少跑一个文件；本轮已按真实路径跑齐） |
| 类型 | `npx vue-tsc --noEmit` | 退出码 0 |
| 构建 | `npx vite build` + `node scripts/verify-build.mjs` | built in **16.81s**；产物 88 个；首屏 JS 112.0KB · 懒加载 6060.4KB · CSS 220.5KB · 分包 **16/16**；结论「通过：构建产物可用于部署」（CSS 偏大告警沿用，非本批引入） |
| 乱码门禁 | `node scripts/check-mojibake.mjs --self-test` | ✅ 检出 5 处（`classes#c2 name`、`students#990000002 name`、`students#990000003 name_en`、`users#990000002 real_name`、`users#990000003 name_en`），教师身份按口径排除，空班级 1 个 |
| 缺陷复现门禁 | `node docs/handoffs/qoder-20261113-repro.mjs` | **缺陷仍在 0 / 6**（IN-03/04A/04B/05/05R/06 全判「未复现」），退出码 0 |
| 真服务冒烟 | `node C:/Users/xieyufei/AppData/Local/Temp/qd07-smoke.mjs` 在合并后基线重跑 | **13/13 通过**：v3 单删 409/409/200、批量 409 零删除、批量 200 + `notFound`、v1 导入 409/409/400/200(`imported:2,skipped:1`)/404、日志无乱码、「临时库确实被用到」也过；真 `server/index.js` + 完整启动链 + 临时库（虚构 99 开头学号），进程用完即停 |
| 生产零改动 | `stat server/pet-garden.db` | mtime 仍为 **2026-11-12 13:21:50**、**614400 字节**，与本轮开工前一致；未连 110.40.142.247，未部署、未迁移、未灌真实名单 |
| 真实名单红线 | 取证脚本与冒烟全部只用 `示例X` + `9900xxxxx` 假数据 | 反馈区、仓库、沙箱、临时库里都没有真实名单、库文件、token 或密钥 |

## 4. 第八轮未验证项（不自标通过）

1. **QD-11/QD-12 尚未经 Codex 复验**，本轮只是把证据补齐并上传，我不宣称已通过审核。
2. D14 的注释更正与闸门精简、D15 的年级口径统一都**等 Codex 决定**，我一行没改；三处错注释仍在原文件里。
3. D10 的三处前端假成功仍在，等 DSH。本轮没动任何前端文件，D15 清单只是读代码取证。
4. 第 7 条 `game-v3.js:470` 的 `Number()` 拼串 500 我只在内存库复现，**没有在真服务上打这条 URL**（属 Codex 的 API 范围）。
5. 权威斗法、负数/撤销幂等、关联删除的其余入口（`classes.js` 删班、认证、economy、game-v2/v3）仍不在我这批范围。

# 第九轮（应第八轮批复 `6a24873` 与 2026-11-16 仓库检查 `81cbb60`，合并后基线 `88b27ec`）

## 0. 批复接收与合并归属 / 2026-11-16

读到的批复要点，逐条照办：

- **QD-11/QD-12 复验通过并合入**：Codex 在独立 worktree `D:/工作/pet-garden-codex`、Node 22 跑出 27 文件 366 测试，明确「不是仅据你的报告标通过」。我的代码经 `b05b791` 进入整合分支。
- **D14 关闭**：Codex 独立跑取证脚本 12/12，确认 `foreign_keys=1`，并亲自更正三处注释；口径是**不切 PRAGMA、不精简现有业务闸**，未声明外键的关系预检不能撤，已声明外键也不能替代清晰的 409 与批次事务。
- **D15 保留旧语义**：不迁库、不改旧响应；**0 与 NULL 都不是合法 6/7 年级，不能据旧兜底宣称年级已知**。未知态与价格/榜单边界由 Codex 收口后再派增量修复。
- **年级榜 `Number()` 拼串 500 报告成立**：登记进 Codex 下一批参数校验/参数绑定与分组 SQL 审查，**不交我越界修改，本轮未修、不可上线**。
- **D10 是我引用旧基线的错判**：`6cba9a8` 已补，要求后续报告引用最新源码、勿重复派工 → 本轮复核并关闭，见第 1 节。
- 下一步只补名单相关复验发现的问题；不扩大身份自动清理、资产迁移或外键改造；生产继续冻结。

合并与归属：`git merge --no-ff origin/dev-codex-integration-20261113`（`81cbb60`）→ **`88b27ec`**，无冲突。`git diff 068df20 HEAD -- <我的 11 个文件>` 只有 `roster.test.js`、`students.js`、`rosterRefs.js` 共 **4 行注释**变化（Codex 的外键更正），逐行看过**逻辑零改动**；`roster.js:218` 改学号无条件占用检查仍在位，`roster-purge-import.test.js` 25 例一字未动。

## 1. D10 更正：我错了，按最新源码逐行复核后关闭

我第八轮仍写「D10 三处前端假成功仍在，等 DSH」，那是拿 `54cd95a` 的行号当现状。在合并后 `88b27ec` 上复核：

| 位置 | 最新源码的实际行为 |
|---|---|
| `src/api/adapter.ts:472-476` | `updateStudent` 走 `api.put`，`if (!asRecord(res.data)?.success) throw new Error('修改未确认，请刷新核对后再操作')`，不再 `mock(false)` |
| `src/api/adapter.ts:479-483` | `deleteStudent` 同形，未确认就 throw |
| `src/pages/TeacherDesk.vue:171-188` | `saveEdit` **先 await 再改本地**：`:179` 判断成功后 `:180-181` 才赋值，失败进 `showStudentError` |
| `src/pages/TeacherDesk.vue:190-208` | `removeStudent` 两步确认，`:200` 先 await，`:201` 才 `filter` 掉本地行 |
| `src/pages/TeacherDesk.vue:153-156` | `showStudentError` 优先取 `response.data.error`，也就是我后端给的中文 409 原因 |
| `src/pages/TeacherDesk.test.ts:12-36` | 已有用例「修改/删除拒绝时保留真实名单并展示服务端原因」，断言 alert 含服务端原因、卡片保留、改名不落地；本轮 366 例全绿包含它 |

结论：**D10 关闭，不再向 DSH 派工**。往后引用行号一律先在当轮合并基线上复核，不沿用历史快照。

## 2. D16 新发现：导入路径仍会假成功，而且是被我的新闸触发的

这属于批复允许的「名单相关复验发现的问题」，但两个文件都不是我的，所以**只登记取证、一行不改**。

链路（行号按 `88b27ec`）：

1. `src/api/adapter.ts:444-455`：`importStudents` 走 `tryPost('/students/import', …, 0)`。
2. `src/api/adapter.ts:88-105`：`trySend` 把任何异常 `catch` 成 `console.warn`，然后 `return mock(fallback)` → **我 QD-12 新加的 400/409 一律变成 `0`**，服务端中文原因只进控制台。
3. `src/pages/TeacherDesk.vue:84-106`：`count > 0` 为假就走 else，**本地 push 全部行**（`id: local-…`），提示「接口未就绪，已在本地追加 N 人（联网后请重新导入）」。

后果：教师传一份含重复学号 / 已占用身份 / 乱码的表，后端整批零写入并给了明确原因，教师端却看起来像成功，刷新后名单又没了。这与 `adapter.ts:5` 自己的注释「正式消费、名单修改/删除失败必须上抛，禁止本地伪造成功」以及 AGENTS.md 第五节同口径要求直接冲突——`importStudents` 是写请求，却走了只读回落。

实测输出（探针只 mock `useAuth().api`，让**真实** adapter 与**真实**页面跑完整链路）：

```
【实测】importStudents 返回 = 0 （后端说的是 409 整批零写入）
【实测】教师端提示 = 接口未就绪，已在本地追加 2 人（联网后请重新导入）
【实测】本地名单卡片数 = 14
【实测】页面是否出现服务端原因 = false
```

读数说明：14 张卡片里 12 张是 `DEMO_STUDENTS` 占位（探针故意让 `api.get` 失败以走既有回落），**真正的发现是末尾 2 行本地伪造的「示例甲 / 示例乙」**，以及服务端原因完全没上屏。

复跑方式：`docs/handoffs/qd16-import-probe.vitest.ts`。故意不叫 `.test.ts`，vitest 默认 include 拾不到它（全量仍 **366** 例），tsconfig 只 include `src/**` 所以 vue-tsc 也不检查它——它是可复跑证据，不是产品代码，也不在别人的文件里钉住缺陷行为。文件头写了三步命令（复制成 `.test.ts` → 单跑 → 删掉临时副本），我已按这三步实跑验证，仓库里不留临时副本。

与 D10 的区别：D10 是删除/改名（已修、有测试），D16 是**导入**；`TeacherDesk.test.ts:8` 只把 `importStudents` 摆成 `vi.fn()`，没有任何失败用例。

最小修复建议（交 Codex + DSH，我不自己动）：`importStudents` 失败上抛或返回带原因的结果；`doImport` 的 else 分支只在**确属接口未就绪**（网络错/404/502）时本地追加，400/409 一律显示服务端原因且不伪造行。

## 3. 第九轮实际执行的检查与结果（全部在合并后 `88b27ec` 上重跑）

| 检查 | 命令 | 结果 |
|---|---|---|
| 合并归属 | `git diff 068df20 HEAD -- <我的 11 个文件>` | 只有 4 行注释（Codex 的外键更正），逻辑零改动；`roster.js:218` 占用检查在位 |
| 全量测试 | `npx vitest run` | **27 文件 / 366 例全通过**，10.62s —— 与 Codex 独立跑出的数字一致 |
| 我的五个测试文件单跑 | `npx vitest run server/roster.test.js server/legacy-delete.test.js server/migrate-roster.test.js server/mojibake-cli.test.js server/roster-purge-import.test.js` | 5 文件 / **93 例全通过**，2.29s |
| D16 取证 | 复制探针为 `.test.ts` 后单跑，再删副本 | **2 例通过**（即缺陷成立）：返回 0、提示「已在本地追加 2 人」、服务端原因未上屏；临时副本已删，`git status` 只剩 inert 探针 |
| 类型 | `npx vue-tsc --noEmit` | 退出码 0 |
| 构建 | `npx vite build` + `node scripts/verify-build.mjs` | built in **17.02s**；产物 **93** 个；首屏 JS 112.3KB · 懒加载 6066.0KB · CSS **222.6KB** · 分包 **16/16**；「通过：构建产物可用于部署」（CSS 偏大告警与 Codex 记录的 222.6KB 一致，非本批引入） |
| 乱码门禁 | `node scripts/check-mojibake.mjs --self-test` | ✅ 四类乱码全检出，教师身份按口径排除，空班级 1 个 |
| 缺陷复现门禁 | `node docs/handoffs/qoder-20261113-repro.mjs` | **缺陷仍在 0 / 6** |
| D14 取证 | `node docs/handoffs/qoder-20261113-fk-evidence.mjs` | **12/12**（注释被 Codex 更正后脚本结论仍成立，未改脚本口径） |
| 真服务冒烟 | `node C:/Users/xieyufei/AppData/Local/Temp/qd07-smoke.mjs` | **13/13 通过**：v3 单删 409/409/200、批量 409 零删除、批量 200 + `notFound`、v1 导入 409/409/400/200(`imported:2,skipped:1`)/404、日志无乱码、临时库确实被用到 |
| 生产零改动 | `stat server/pet-garden.db` | mtime 仍 **2026-11-12 13:21:50**、**614400 字节**；未连 110.40.142.247，未部署、未迁移、未灌真实名单 |
| 真实名单红线 | 探针与冒烟只用 `示例X` + `9900xxxxx` 虚构数据 | 反馈区、仓库、沙箱、临时库里都没有真实名单、库文件、token 或密钥 |

## 4. 第九轮未验证项（不自标通过）

1. **D16 只有组件级实证**（happy-dom + 真实 adapter/页面），**没跑真实浏览器**，也没在真服务上点这条导入路径。真服务侧的 400/409 由冒烟 13/13 覆盖，但「教师实际看到什么」目前只有组件级证据。
2. 年级榜 `Number()` 拼串 500 仍只在内存库复现，未在真服务打这条 URL；Codex 已登记下一批，**本轮未修，不可上线**。
3. D15 年级未知态与价格/榜单边界等 Codex 契约，我未动 v1 语义；本报告不再出现「年级已知」这类宣称，第八轮「价格与显示上等价」只描述现状。
4. 整合成果尚未进 main/dev（仍 `d35d017`），我没有合并主分支的授权，也没动。
5. CODEX-CONTROL 的独立分数导出（`docs/CODEX_CONTROL_WORKFLOW_20261116.md`）是设计约束、未实现未联调。其中「学号唯一、缺映射不猜测、只发增量不发余额覆盖」与我的名单口径相关，但**导出器与事件源不在我范围**：我未实现、未联调、未开启上传，也没碰管控主程序。
6. 权威斗法、负数/撤销幂等、关联删除其余入口仍不在我这批范围。

# 第十轮（应 Codex 2026-11-16 收口同步 `7a058e4`，合并后基线 `65a3905`）

## 0. 批复接收与合并归属 / 2026-11-26

本轮新批复只有一条：`Qoder/FEEDBACK.md` 顶部「2026-11-16 Codex收口同步」，另有总索引与 Codex 本人 REPORT 的同日条目。逐条照办：

- **年级榜 NaN / 分组位置已由 Codex 修复并覆盖三指标与重复参数**，不再派我重复修。合并后 `server/routes/game-v3.js` 已改成白名单 + 参数绑定 + 筛选后分组，本轮**一行未改**，这条从我的待办里去掉。
- **新库管理员统一显式初始化**：`server/utils/bootstrapAdmin.js` 只在库里没有任何 admin 时按 `ADMIN_USERNAME`/`ADMIN_PASSWORD` 建号，已有账号直接 `return false`。我的冒烟脚本随之改成显式凭据（现编虚构串），不再依赖默认弱口令，D11 的冒烟侧依赖解除。
- **教师积分账本与余额、累计、流水同事务、整批失败回滚、不自动回填历史累计分**：收到。`teacherPoints.js`、`game-v2.js`、`TeacherDesk.vue` 我一行未碰。
- **「删除资产涉及 `teacher_point_events` 必须先交方案，禁止随用户删除去重记录导致旧事件能再次入账」**：据此本轮**只做只读盘点与取证，不改任何删除口径**，方案见第 2 节 D17。
- **名单逻辑保留**：`git diff 2bd068f HEAD --` 我的 11 个文件（roster.js / import-roster.js / migrate-roster.js / rosterRefs.js / roster.test.js / migrate-roster.test.js / roster-purge-import.test.js / legacy-delete.test.js / identity-audit.test.js / check-mojibake.mjs / docs/handoffs/）**为空**；唯一变化是 Codex 自己往 `Qoder/FEEDBACK.md` 追加 6 行。`roster.js:216-219` 的改学号占用检查逐行核对仍在。

合并提交 **`65a3905`**。本轮**零产品代码改动**，只新增两个取证脚本（`docs/handoffs/qd17-teacher-events-probe.mjs`、`docs/handoffs/qd-roster-smoke.mjs`）与本报告/交接单更新。

## 1. D16 在新基线上复验：仍复现，未被本轮改动顺带修好

Codex 本轮改了 `src/api/adapter.ts`（`syncPoints` 改逐条 ACK）与 `src/pages/TeacherDesk.vue`（教师 ID 隔离持久队列），这两个文件正是 D16 的链路，所以必须重验而不是沿用第九轮结论。按探针头部配方（复制成 `.test.ts` → 单跑 → 删除）在 `65a3905` 上重跑，2/2 通过，实测输出与第九轮逐字一致：

```
【实测】importStudents 返回 = 0 （后端说的是 409 整批零写入）
【实测】教师端提示 = 接口未就绪，已在本地追加 2 人（联网后请重新导入）
【实测】本地名单卡片数 = 14
【实测】页面是否出现服务端原因 = false
```

结论：**D16 仍开放**。`doImport()` 的 else 分支与 `importStudents` 的 `tryPost(..., 0)` 本轮都没动；`syncPoints` 的收口没有覆盖导入路径。归属仍是 Codex（`src/api/`）+ DSH（`TeacherDesk.vue`），我一行未改。

## 2. D17 新登记：`teacher_point_events` 与名单删除/改学号的四处缝（附方案，不擅自改）

Codex 新增的 `teacher_point_events`（`server/utils/teacherPoints.js:4-6`）按 `user_id` 挂学生身份，**没有声明任何外键**，且**不在** `server/utils/rosterRefs.js:15` 的 `USER_DATA_TABLES` 里。

**这里有个陷阱，我特意没踩**：`rosterRefs.js:13` 的注释是我自己写的「v3 加表时这里要一起加」，但 `USER_DATA_TABLES` 同时是 `roster.js:261` `purgeStudent()` 的 **DELETE 清单**。照注释直接加进去，就等于「删学生顺手删去重记录」——正是 Codex 本轮明令禁止、要求先交方案的做法。所以我**没有**往清单里加表，改为取证 + 交方案。

取证脚本 `docs/handoffs/qd17-teacher-events-probe.mjs`（`:memory:` + 真实启动链 + 真实 express 路由 + 真实 token，学号 9900009xx 全虚构），实测 **24/24 与预期一致**，其中 **6 条是替 Codex 证明防线成立**、**7 条是缺口**：

| 类别 | 实测事实 |
|---|---|
| 防线成立 | 旧 v1 删除入口遇登录身份仍 409；`studentDeletable=false`；同学号重新入库后重放同一 `eventId` 同一内容 → `duplicate`，余额仍 0、流水仍 0，**没有二次入账**；改学号后余额与累计跟着走（7/7）；改用新学号可正常入账 |
| 缺口 1 | `studentRefs()` 的资产清单只有 `game_points_records` + `trainers`，**去重账本那 1 行没被数进去**（`assetRows=2`，账本行不在内） |
| 缺口 2 | v3 名单管理删除后：账本留存 1 行、流水已清 0 行、身份已清 0 行 —— **账本说「已入账」，流水却没了**，两边对不上 |
| 缺口 3 | 留存账本行的 `user_id` 已成孤儿（`LEFT JOIN users` 查无此身份），无外键拦、无盘点报 |
| 缺口 4 | 删除回执只有 `{success, userId, dataRows}`，**不提留存的账本行**，教师看到的「已清理 N 行」不包含它 |
| 缺口 5 | 改学号后账本 `payload` 仍是旧学号；教师队列里**旧学号 + 新 eventId** 提交 → 整批 409「学号没有有效的名单与学生身份」。这是**安全失败**（不会错记到别人头上），但教师改了学号后待提交队列会整批卡住，且错误文案没告诉他「学号已改，请刷新名单」 |

**我的方案（请 Codex 拍板，本轮一行未改）**：

1. **去重记录一律不删**。`purgeStudent` 保持现状（不碰 `teacher_point_events`），这是防重放的前提，实测已证明它有效。
2. 盘点与删除口径**分家**：在 `rosterRefs.js` 另加一个**只读**计数（例如 `refs.ledgerRows`），**不进** `USER_DATA_TABLES`、**不进** `studentDeletable` 的阻断项（否则教师永远删不掉任何加过分的学生）。它只用于两件事：① 删除回执追加 `keptLedgerRows`，让「已清理 N 行」不再掩盖留存的账本；② 只读盘点报告里能看见这张表。
3. 账本孤儿是否要治理（例如给 `teacher_point_events.user_id` 加声明外键 + `ON DELETE RESTRICT`，或改成保留 `student_no` 快照列）属**跨模块结构变更**，不在我边界，等 Codex 定；我不擅自加外键、不迁数据。
4. 缺口 5 的文案与队列刷新属 `teacherPoints.js`（Codex）+ `TeacherDesk.vue`（DSH）：建议 409 文案区分「学号不存在」与「学号已变更，请刷新名单后重试」，并让教师端在改学号成功后刷新待提交队列的学号。我只报告，不改他们的文件。

## 3. 事故记录 E1：我的一次试验向工作区默认库写了一张空表（数据零损失，生产未碰）

**必须写明，不掩盖。** 本轮排查测试 runner 故障时，我试了 `--pool=vmThreads`。该 pool 下 server 测试的 `PET_GARDEN_DB` 隔离失效，测试进程打开了**工作区默认库** `server/pet-garden.db` 并执行了启动迁移。

- 时间证据：该库 mtime 变为 `2026-11-26 17:06:11`，正是那次 vmThreads 运行（17:06:09 起、7.54s）；大小 614400 → **618496（+4096，一页）**。
- **实际写入内容只有一项**：`CREATE TABLE IF NOT EXISTS teacher_point_events`（空表）。与全新启动链逐表对比：全新链 44 表、本地库 45 表，多出的唯一一张是历史遗留 `skill_effects`，**本地库不缺任何表**；`teacher_point_events` 的 DDL 与 `teacherPoints.js` 一致。
- **数据零损失**（只读核对）：`students=252`、`users=254`、`classes=12` 与事故前一致；`integrity_check=ok`；`teacher_point_events`/`game_points_records`/`evaluation_records` 均 0 行；虚构学号（`99000%`/`90000%`/`qd17%`）与「示例%」姓名残留均为 0；`students`/`users` 的 `MAX(created_at)` 仍是 11-12 的原值，说明没有插入或更新任何行；`students`/`users` 列清单未变；`schema_migrations` 仍 9 条（v11 早于本轮已应用）。管理员账号未被重置（`bootstrapAdmin` 见已有 admin 即返回）。
- **处置**：不删这张表（迁移只加不删，且它本来就是启动链会建的表）；**停用 vmThreads**，此后所有门禁只用默认 pool；本轮新写的冒烟脚本在启动前断言库路径落在系统临时目录内且不在仓库内，跑完复核默认库 mtime **未再变化**。
- **生产服务器 110.40.142.247 全程零操作**：不部署、不迁移、不灌名单。真实名单文件 `docs/seeds/students-real.json` 未读、未复制、未入库、未进反馈区。
- **给其他角色的提醒**：`--pool=vmThreads` 会让 server 测试失去库隔离并写默认库，**不要用它当门禁**。这条属工具链风险，登记在此请 Codex 知悉；我没有改任何共享配置去「修」它。

## 4. 工具链根因 E2：Windows 盘符大小写导致 vitest 双实例，全量 29 文件 collect 失败

本轮开头全量测试**29 文件全部失败**（`Vitest failed to find the current suite` / `Cannot read properties of undefined (reading 'config')`），而第九轮同一仓库同一命令是 27 文件 366 通过。按系统化排查逐步取证，**根因不在仓库代码，在调用时的工作目录盘符大小写**：

| 实验 | 结果 |
|---|---|
| 只 `import {it} from 'vitest'` 的裸测（不引任何 src） | 失败 → 与合并进来的源码无关 |
| 改用全局注入的 `it/expect`（`globals:true`） | **通过** → 配置确实加载了 |
| 同一文件里比较 `imported it === globalThis.it` | **false**（`expect`、`vi` 同样 false）→ **两份 vitest 实例** |
| `import.meta.resolve('vitest')` | `file:///D:/课件/.../node_modules/vitest/dist/index.js`（**大写 D**） |
| vitest CLI 打印的 root | `d:/课件/platform/pet-garden-qoder`（**小写 d**） |
| 换 `--pool=threads` / `forks` | 都失败；`vmThreads` 能收集但语义变了（116 例失败，且引发 E1） |
| **把 cwd 换成大写 `D:/课件/platform/pet-garden-qoder` 重跑** | **29 文件 385 测试全部通过** |

机理：ESM 模块缓存按 URL 字符串去重，`file:///d:/…` 与 `file:///D:/…` 是两个键，于是测试文件里 `import 'vitest'` 拿到的实例与 worker 注入全局的实例不是同一个，收集器状态对不上。**修法是把调用目录写成大写盘符，零仓库改动**；`vitest.config.ts`、`package.json` 属 Codex 归属，我一行未改。第九轮能过是因为当时的调用目录是大写盘符。

**此后我的所有门禁命令都在 `D:/课件/platform/pet-garden-qoder`（大写 D）下执行**，下表数字均出自该目录。

## 5. 第十轮实际执行的检查与结果（全部在合并后 `65a3905`、大写盘符目录下重跑）

| 检查 | 命令 | 结果 |
|---|---|---|
| 类型 | `node node_modules/vue-tsc/bin/vue-tsc.js --noEmit` | **0 错误** |
| 全量单测 | `node node_modules/vitest/vitest.mjs run` | **29 文件 / 385 测试通过**（9.57s），与 Codex 同日报告的 385 一致 |
| 我的名单测试 | 同上，指定 `roster / migrate-roster / roster-purge-import / legacy-delete / identity-audit` 五个文件 | **5 文件 / 97 测试通过** |
| 构建 | `node node_modules/vite/bin/vite.js build` | 成功（24.70s） |
| 产物校验 | `node scripts/verify-build.mjs` | 93 个产物；首屏 JS 112.3KB · 懒加载 6067.1KB · CSS 222.6KB；页面分包 **16/16**；**通过**（CSS 偏大告警保留） |
| 乱码自检 | `node scripts/check-mojibake.mjs --self-test` | 检出 5/5，**通过** |
| 缺陷复现 | `node docs/handoffs/qoder-20261113-repro.mjs` | **缺陷仍在 0 / 6** |
| D14 外键取证 | `node docs/handoffs/qoder-20261113-fk-evidence.mjs` | **12/12** |
| D16 导入探针 | 复制成 `.test.ts` 单跑后删除 | **2/2**，仍复现（见第 1 节） |
| D17 账本取证 | `node docs/handoffs/qd17-teacher-events-probe.mjs` | **24/24**（6 条防线成立 + 7 条缺口，见第 2 节） |
| 真实服务端冒烟 | `node docs/handoffs/qd-roster-smoke.mjs` | **21/21**（本轮改为入库可复跑版，临时目录空库 + 显式管理员凭据） |
| 工作区默认库 | 只读核对 + `stat` | 618496 字节、mtime `2026-11-26 17:06:11`（E1 那一次），此后**未再变化**；252/254/12 与 `integrity ok` 见第 3 节 |

冒烟脚本本轮有 4 条**我自己的预期错**，已按真实契约更正并写在脚本注释里，不当成系统缺陷：① 学生登录入参是 `realName` 不是 `name`（`studentLogin.js:57`）；② `garbled()` 只认 U+FFFD 替换符，不认「æµ‹è¯•」这种可读乱码（`garbled.js:5`）；③ v3 导入是「逐行判定 + rejected 清单」，整批 4xx 是 v1 的口径，两者不能混断言；④ v3 导入的班级是**逐行 `class` 列**，顶层 `className` 不被读取（`src/api/roster.ts:168` 只发 `{rows,dryRun}`）。D17 脚本也有 1 条我的预期错（漏算单条新增会顺带建 `trainers` 行），同样按实测更正。

## 6. 第十轮未验证项（不自标通过）

1. **D17 的四处缝只有内存库 + 真实路由级实证**，没有在真实浏览器里走「教师加分 → 改学号 → 删学生」的完整操作流；缺口 5 的教师端表现（队列卡住时页面显示什么）**未验**。
2. **D16 仍只有组件级实证**，没跑真实浏览器；归属 Codex + DSH，我未改他们的文件。
3. E1 的写入范围我是用「表清单对比 + 行数 + `MAX(created_at)` + `integrity_check`」推断的，**没有事故前的库快照可逐字节比对**（仓库内无备份文件）。结论「只多了一张空表」有上述证据支撑，但不是快照级证明；如果 Codex 手上有更早的副本，值得再核一次。
4. 年级榜修复是 Codex 的实现，我只核对了他改后的源码形态与全量测试绿，**没有独立设计非法参数用例去攻它**。
5. 整合成果仍未进 main/dev（仍 `d35d017`），我无授权也未动。生产继续冻结。
6. CODEX-CONTROL 的分数导出器仍是设计稿，未实现未联调；其「只发增量不发余额覆盖」与本轮教师账本口径相关，但导出器不在我范围。

