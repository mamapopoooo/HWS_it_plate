# KIMI 汇报区

维护者：KIMI。此模板由Codex创建，尚无该Agent实际汇报。

每次追加一节：

## 问题号 / 标题 / 日期

- 状态：待审核
- 绝对工作区 / 分支 / 基线SHA：待填写
- 补丁提交SHA或PR：待填写
- 问题、复现、期望与实际、影响：待填写
- 修改文件及建议方案：待填写
- 实际执行的检查与结果、未验证项：待填写
- 需要Codex审核或决定的事项：待填写

## KM-01 / battle_records 启动 schema 写入适配 / 2026-11-13

- 状态：修复待审核，生产冻结。
- 绝对工作区 / 分支 / 基线SHA：`D:/课件/platform/pet-garden-kimi` / `dev-kimi` / `ccf7d1040b3e3e2919dc1a97e0fdd86982c91dee`（接续最新 `origin/dev-codex-integration-20261113`，原派工 `bbb030ea16136009cc35b482101b1a00ef28bece`）。
- 补丁提交SHA：`692a9dca44ec65631416ca841ab34a2793bbb8dc`（`server/routes/game.js` + `server/battle-record.test.js`）；反馈报告与交接单随后续文档提交推送。
- 交接单：`docs/handoffs/KIMI-2026-11-13.md`。
- 复现：`server/index.js:49-56` 启动执行 `migrateV2`；`server/game/migrate-v2.js:125-135` 建立 `id/battle_type/player_a_id/player_b_id/winner_id/turn_count/log_json/created_at`，旧 `game.js` 却插入 `player_a_pet/player_b_pet/winner/battle_log` 等不存在列。真实 Express 路由 + `Database(':memory:')` + 实际迁移，完整打到战斗结束，旧代码在写库时稳定返回 500，记录未落库。`db-migrate.js` 的旧定义只在手动 `run-migrate.js` 路径，不能作为启动 schema。
- 期望 / 实际：期望结束记录适配现有表且旧记录不丢；修复前 500，修复后写入 8 个现有字段，`winner='A'/'B'` 映射对应玩家 id，AI 保留 `ai_opponent`，不创建 users 行。
- 影响：旧 `/api/game` 服务端权威战斗可落库，供双方 `today_battles` 读取；不覆盖 `/duel` 的独立缺口。
- 修改文件：`server/routes/game.js` 仅战斗结束 INSERT；新增 `server/battle-record.test.js`。未修改迁移、`game-v2.js` 或 API 前端。
- 实际检查：`node node_modules/vitest/vitest.mjs run server/battle-record.test.js` 共 **6 条：5 通过、1 个 KM-02 预期 404 失败，退出码 1**。通过真实落库、旧记录保留、玩家/AI 双向胜方、双方今日计数、同进程重复结算、宠物归属；KM-02 的独立缺口见下节。完整门禁结果见 KIMI 交接单。
- 未验证项：未打开任何现有数据库或生产库；未执行旧生产数据盘点；未做真实浏览器 UI 验收。
- 待 Codex 审核：写入端最小适配是否接受。`game-v2.js` 管理端 `totalBattles` 只统计 `battle_type='pvp'`，不会统计此处 `'pve'`，请明确统计口径，KIMI 未顺手改动。

## KM-02 / /duel 战斗结果端点缺失 / 2026-11-13

- 状态：待 Codex 实施路由；未声称端到端完成。
- 工作区 / 分支 / 基线：同 KM-01。
- 复现：`src/pages/Duel.vue:109-120` 在浏览器本地判胜后调用 `reportBattle`；`src/api/adapter.ts:341-344` POST `/v2/battle/pve/result`，body 为 `{winner:'player'|'enemy',turns,playerPetId}`。`game-v2.js` 无该路由。新增真实路由测试实际得到 **404**；测试保持红色，供 Codex 应用补丁后复验。
- 影响：adapter 捕获 404 后返回 `false`，页面不提示落库失败；本地演出结果没有服务端记录。现有 `/v2/battle/pve/start` 只校验宠物并返回待集成消息，不能形成权威战斗闭环。
- 给 Codex 的最小接口方案（仅建议，未越权改 `game-v2.js`）：新增认证保护的 `/battle/pve/result`，按现有 body 接收；`playerPetId` 必须属于 `req.userId`；`winner` 限现有枚举，`turns` 限正整数；`player_a_id=req.userId`、`player_b_id='ai_opponent'`、`winner_id=req.userId` 或 `ai_opponent`、`battle_type='pve'`，保存 `turn_count/log_json/created_at`，返回 `{success:true}` 与必要 idempotency 字段。若选择暂不信任客户端演出，应明确返回未支持，而不是把自报胜利用于奖励。
- 必须同时解决：当前客户端可以重复自报结果，跨端持久幂等需要客户端提供 `eventId` 并经 Codex 修改 API 契约；`src/api` 与 `game-v2.js` 均归 Codex。正式奖励仍需服务端战斗 id 与权威结果，不能把客户端 `winner` 当发奖依据。v3 `Battle.vue` 走 `@/api/v3`，不等同于本 `/duel` 链路。
- 待 Codex 决定：接受“仅兼容记账”的最小方案，还是本批完成服务端战斗闭环；为兼容记账指定 eventId 与唯一索引/迁移版本，版本 11 不占用。

## KM-03 / 战斗回归边界 / 2026-11-13

- 状态：局部验证完成，跨进程与 `/duel` 防重仍待 Codex。
- 临时库使用虚构 `player-demo/opponent-demo`，未导入真实名单。5 个通过用例分别验证：真实 INSERT 与胜方 userId、AI 获胜时保存 `ai_opponent`、双方今日计数且不计无关用户、已结束战斗再次 action 返回 404 且不重复写库、使用他人宠物返回 403。
- 边界：旧 `/api/game` 仅靠进程内 `activeBattles` 防重，同进程结束后再次 action 已验证；重启或切换到另一进程会丢失战斗状态并返回 404，这是可用性/持久性缺口，不宣称已复现跨进程重复落库。数据库没有 eventId 唯一约束，`/duel` 自报结果的持久幂等仍未解决。开始路由用请求体 `playerId` 自报身份，没有 `authMiddleware`，宠物归属检查不等于调用者身份认证。行动接口没有显式校验当前用户属于该战斗。以上为待收口风险，未伪称已修。

## CC-04 / 负分、余额、年级倍率、撤销与算法复核 / 2026-11-13

- 状态：现状清单待审核，未实现未定产品规则。

| 项目 | 现状 | 已定规则 | 待用户 / Codex 决定 |
|---|---|---|---|
| 负分 | `evaluations.js:23-35` 接受 `points` 直接累加，`pet_exp` 仅下限 0；`game-v2.js:715-737` 管理员同步也直接累加 amount | 未找到允许游戏余额为负的总纲规则 | 是否允许负向课堂事件、游戏余额最低为 0 还是可负、界面如何解释；不得自行钳制 |
| 余额不足 | 多个消费端点先查余额后 UPDATE 扣款，无统一事务/原子条件；旧评价可产生负 `total_points` | 消费应有足够积分，但同步负数未定义 | 统一拒绝余额不足与并发扣款策略，是否使用条件 UPDATE/事务；由 Qoder/Codex 实施 CC-03 |
| 年级倍率 | seeds 为 G6=1.0/G7=0.6；`priceFor` 与 `gacha.js` 使用配置；挂载 v2 商城/抽卡仍用 G7=0.8，v3 觉醒/皮肤用 `Math.floor` | 总纲与 seeds：G6=1.0、G7=0.6，只影响价格不影响战力 | 统一取整策略与旧路由迁移优先级；不应让 0.8 与 0.6 并存 |
| 撤销 | 旧 `evaluations.js:113-185` 减回原 points 并 DELETE；`teacher/sync-points` 没有 eventId 关联或反向事件 | 派工明确：撤销使用新反向事件关联原事件，课堂显示清零不得撤销已同步账本 | 原事件不可变、重复/乱序撤销、部分成功和错误学号处理；平台幂等与权限验收前不开同步 |
| 八卦 | `elementCoefficient` 读 `opposite`，双属性防守取最低系数；64 矩阵通过 | 对宫双向 1.3，其余 1.0，无 0.77 | 旧 `server/game/constants.js` 仍是六属性 1.25，供旧 `/api/game`，是否/何时迁移需 Codex 统一 |
| 战力 / 觉醒 / 保底 | 纯函数读 seeds；`calcPower`、碎片抵扣、20/60 保底通过既有测试 | 按总纲与 seeds，不改数值 | `game-v3.js:72-82` 仍硬编码战力/觉醒常量，且挂载抽卡另有保底逻辑；请 Codex 指定路由接入已验证算法的范围 |

- 规则实测：`node node_modules/vitest/vitest.mjs run src/config/gameConfig.test.ts src/utils/duel.test.ts src/utils/gacha.test.ts server/game/gacha.test.js` → **4 文件 / 130 测试通过**。这些是纯函数回归，不代表上述旧路由已配置驱动。

## 最终交付门禁 / 2026-11-13

- 全量测试：`node node_modules/vitest/vitest.mjs run` → **16 文件 / 250 条：249 通过、1 失败，退出码 1**；唯一失败是 KM-02 已认证请求 `/api/v2/battle/pve/result` 返回 404，无其他失败。
- 类型检查：`node node_modules/vue-tsc/bin/vue-tsc.js --noEmit` → 通过，0 输出、0 错误。
- 构建：`node node_modules/vite/bin/vite.js build` → 通过，1513 个模块完成转换。
- 产物自检：`node scripts/verify-build.mjs` → 通过；88 个产物文件，首屏 JS 112.0KB，懒加载 JS 6058.0KB，CSS 220.1KB，页面分包 16/16。构建告警与未验证项见交接单，生产继续冻结。

