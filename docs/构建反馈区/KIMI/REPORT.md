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

## KM-04 / /duel 服务端权威斗法最小接入方案 / 2026-11-13

- 状态：方案待 Codex 审核；本批未实施战斗生产代码。当前 `/duel` 仍是本地演练，`/api/v2/battle/pve/result` 仍按第四轮决定返回 501。
- 绝对工作区 / 分支 / 基线SHA：`D:/课件/platform/pet-garden-kimi` / `dev-kimi` / `1c8af2e2abd9f8568281ed4521a1447905ffe6a6`。
- 补丁提交SHA或PR：无生产补丁；本批只提交本报告与交接单，文档提交完整 SHA 在最终推送回执中给出。
- 问题、复现、期望与实际、影响：`src/pages/Duel.vue:102-147` 在本地创建双方、选择技能、结算伤害并判胜，`src/pages/Duel.vue:109-120` 再自报结果；服务端若另开一套战斗而又保留这条链，会重复计算回合与胜负。期望改为服务端创建并持有唯一状态，前端只发技能意图、渲染服务端快照和事件；当前实际仍是本地演出，501 保证不记正式战绩、不发奖励。
- 旧引擎兼容结论：不能直接复用。`server/game/pet-data.js` 是六只六属性宠物及 `fire_fox_s1` 等专属技能，`server/game/battle-engine.js` 按 `element/role` 建状态；`/duel` 使用 38 只八卦宠物、品阶/觉醒及 `damage_single` 等效果池代码，两者不是同一模板或规则模型。

### 宠物 ID 与配置映射

| 数据 | 正确用途 | 权威斗法映射 |
|---|---|---|
| `player_pets.id` | 玩家宠物实例 ID | start 的 `teamPetIds` 只接受此 ID，并按 `id + req.userId` 查询；第一阶段 `/duel` 恰好 1 只 |
| `player_pets.template_id` | seeds / `pets_template.id`，如 `pet_baihu` | 只用于加载官方模板；不能把该字符串当实例 ID 传给旧 `/api/game/battle/start` |
| `player_pets.level / awakening_level` | 实例成长状态 | 分别映射战斗单位的 `level / awaken`，客户端不得自报 |
| `player_pets.equipped_skills` | 旧六属性技能实例数据 | 不作为八卦技能来源；第一阶段按品阶槽位从 seeds `skill_effects` 构造技能 |
| `pets_template.skills_json` | v3 官方模板当前导入为 `[]` | 不能据此推出无技能；技能池来自 `skill_effects` / `docs/seeds/skill_effects.json` |
| AI 对手 | 服务端战斗另一方 | 使用服务端 seeds 配置，固定 `player_b_id='ai_opponent'`，不创建 users 行，不接收客户端胜负或成长参数 |

### 最小接口契约

1. `POST /api/v2/battle/pve/start`：保留现有 `{teamPetIds:[playerPetInstanceId]}` 调用形状和 `src/api/index.ts:99-102` / `src/stores/battle.ts:20-29` 调用方；`/duel` 要求数组恰好 1 项。认证且非游客，实例必须属于 `req.userId`。服务端创建 AI、战斗 ID、双方状态和 RNG 上下文，返回统一快照。现有 `src/pages/Duel.vue:26-31` 的写死模板/等级/觉醒改为先选择本人实例，不再由页面造权威单位。
2. `POST /api/v2/battle/pve/:battleId/action`：body 为 `{skillCode, actionId}`。服务端校验战斗归属、进行状态、技能归属与冷却，执行一次玩家技能和一次服务端 AI 技能，再统一处理回合结束；返回同一快照及本次 `events`。同进程缓存 `actionId` 响应：同 battleId、同 actionId、同请求体重放原响应，不推进回合；同 actionId 不同请求体返回 409。
3. `GET /api/v2/battle/pve/:battleId/state`：仅战斗所有者可读，返回最近权威快照，不在 GET 中推进 RNG 或回合。
4. 统一快照字段：`{battleId,status:'active'|'finished',turn,player,enemy,winner:'player'|'enemy'|null,events}`；fighter 至少含 `petInstanceId|null、templateId、name、tier、trigram、level、awaken、hp、maxHp、shield、atkBuff、buffTurns、skills[{code,name,cd,remain}]`。start 的 `events=[]`，action 只放本回合新事件。
5. 结束只在服务端 `finished` 分支写一次 `battle_records`：`id` 使用 battleId 利用现有主键，`battle_type='pve'`、`player_a_id=req.userId`、`player_b_id='ai_opponent'`、`winner_id` 由服务端胜方映射、`turn_count/log_json/created_at` 取权威状态；成功后才标记 `recorded`。第一阶段不写积分、经验、碎片或任务奖励。旧 `/battle/pve/result` 保持 501，不能成为另一条记账入口。

### 共用规则与前端改造边界

- 不让 Node 直接 import 当前带 `@` alias 的 TS，也不复制一份 JS 公式。最小共享形态建议为 `src/utils/duel-core.js` + 同模块 `.d.ts`：只放无副作用规则，配置（pets/tiers/economy/skillEffects）和 RNG 均由调用方注入；浏览器 `duel.ts` 与 Node 路由调用同一实现。这样不需要新增 TS 运行时，也不受当前 `tsconfig.json` 未启用 `allowJs` 影响。
- `/duel` 的 `cast()` 只 POST action 并播放返回事件；移除权威链上的 `resolveSkill/pickEnemySkill/endTurn/checkOver/reportBattle` 调用。`turn/over/winner/player/enemy` 全部来自响应；restart 调 start 创建新 battleId；服务失败明确提示未结算，不回退本地正式战斗。
- `/duel` 不再调用 `fetchOpponent()`。现有 `/v2/battle/pvp/match` 只返回 `userId/points/tier`，不提供 PvE 模板数据，不能继续客串对手来源。第一阶段可沿用当前占位 `pet_qinglong / Lv7 / awaken3` 作为**服务端**配置以保持演示口径；是否按战力匹配须另定规则，不在本方案擅调数值。
- 文件归属建议：KIMI 在批准后承担共享纯函数和算法回归；`server/routes/game-v2.js`、`src/api/index.ts`、`src/api/adapter.ts` 由 Codex 应用；`Duel.vue` 按页面归属交 DSH，KIMI 提供上述接口与事件契约。
- 必测：实例 ID 与模板 ID 拒绝混用、他人宠物/战斗拒绝、固定 RNG 回合结果、非法或冷却技能、同 actionId 重放不推进、玩家与 AI 两种胜方、结束仅一条记录且重复终结响应不重复写库、旧 result 仍 501 零落库。

- 未解决边界：第一阶段仍是单进程内存战斗；重启/多进程恢复与跨进程 actionId 幂等需要持久战斗表和唯一约束，迁移版本 11 不占用，须由 Codex 另行派工。未做跨进程防重或正式奖励承诺。
- 待 Codex 决定：是否批准共享 JS + 声明文件形态、固定 AI 演示配置、上述接口路径与页面分工；批准后才进入 TDD 实施。

## CC-04-R2 / 年级价格挂载路由调用点与最小补丁 / 2026-11-13

- 状态：只读盘点完成，待 Codex 应用；未修改 `game-v2.js`、`game-v3.js`、共享前端或测试公式。
- 权威口径：`docs/seeds/economy.json:41-44` 为 G6=1.0、G7=0.6；`src/config/gameConfig.ts:186-189` 的 `priceFor` 是 `Math.max(1, Math.round(base * coef))`；`server/game/gacha.js:74-89` 的 `drawPrice/awakeningPayment` 已按同式验证。0 价皮肤由 `src/config/contentConfig.ts:70-78` 单独保持 0，不能经 `Math.max(1,...)` 变成 1。
- 服务端最小公共补丁建议：先在 `server/game/gacha.js` 提取同式 `priceFor(basePrice, grade, economy=ECONOMY)`，让 `drawPrice/awakeningPayment` 复用，并以 TDD 补 G7 四舍五入、最小 1 和 0 价守卫测试；路由不再各写系数或 `Math.floor`。以下“保留旧基价”只处理本任务的年级漂移，不把旧玩法的基价/保底迁移偷渡进补丁。

| 挂载路由与当前行 | 当前漂移 | 最小补丁建议 |
|---|---|---|
| `POST /api/v2/pets/:petId/awaken`，`game-v2.js:187-208` | 基价 `(awakening_level+1)*500`，完全没有年级系数 | 查询用户 grade；本批仅对**现有基价**调用 `priceFor`，余额判断、扣款和 `cost` 响应共用同一整数。是否改用品阶基价及 `awakeningPayment` 属另一项旧 v2 迁移决策 |
| `POST /api/v2/shop/buy`，`game-v2.js:391-421` | G7=0.8，且折后数量总价 `Math.floor` | `unitPrice = item.price===0 ? 0 : priceFor(item.price,grade)`，`totalCost=unitPrice*quantity`；校验、扣款、兑换记录和响应统一使用 totalCost |
| `POST /api/v2/shop/skins/buy`，`game-v2.js:431-455` | G7=0.8；价格未取整就比较余额，之后三次 `Math.floor` | 只计算一次 `price = skin.price===0 ? 0 : priceFor(skin.price,grade)`，同一值用于 required、扣款和 newPoints |
| `POST /api/v2/gacha/draw`，`game-v2.js:461-473` | 旧 normal/rare/legendary 基价，G7=0.8，数量后 `Math.floor` | 本批保留旧基价表与保底，`unitPrice=priceFor(prices[eggType],grade)`、`totalCost=unitPrice*count`；旧蛋种迁移 v3 seeds 不在年级补丁中 |
| `POST /api/v3/pets/:petId/awaken`，`game-v3.js:95-127` | 已读 seeds，但 `Math.floor(cost*gradeCoef)` | 用户查询补 grade，调用 `awakeningPayment(template.tier,grade,0,economy).price`；fragments=0 表示不借本补丁启用碎片抵扣，响应字段不变 |
| `POST /api/v3/gacha/draw`，`game-v3.js:133-145` | 已读 seeds，但总价 `Math.floor` | 十连用 `drawPrice('ten',grade,economy)`，1～9 连用 `drawPrice('single',grade,economy)*count`；不改 seeds 基价、保底或响应 |
| `POST /api/v3/character/buy-skin`，`game-v3.js:400-420` | `Math.floor(skin.price*gradeCoef)`，0 价未保护 | `skin.price===0 ? 0 : priceFor(skin.price,grade,economy)`，保持免费/解锁皮肤为 0，其余字段不变 |

- v3 调用纯函数时传入由现有 `getEconomyValue` 读取的 `gacha/awaken/fragment/gradeCoef` 配置，不把数据库存量配置硬编码替换为 0.6；v2 最小补丁可直接使用 seeds `ECONOMY`，旧基价表是否继续存在由 Codex 决定。
- 测试同步点：`server/game-logic.test.js:82-141` 仍复制“G7 八折 + 向下取整”的本地公式。不能只改期望文字让旧复制公式转绿；应删除价格公式副本，改为直接测试共享纯函数，并给上述挂载路由补 G6/G7、0 价、数量总价及实际扣款一致性回归。
- 明确不在本补丁：负余额/反向事件、v2 旧觉醒基价迁移、旧蛋种与旧保底迁移、并发扣款事务。这些仍需原 CC-04/CC-03 决策，不能借年级取整补丁顺手改变。

## 第五轮交付门禁 / 2026-11-13

- 修改范围：仅 `docs/构建反馈区/KIMI/REPORT.md` 与 `docs/handoffs/KIMI-2026-11-13.md`；没有生产代码、迁移、数据库或前端 API 改动。
- 全量首轮：`node node_modules/vitest/vitest.mjs run`（与类型检查并行）→ 20 文件中 19 通过、1 失败，294 条中 293 通过；唯一失败为 `server/identity-audit.test.js:49` 的 5000ms 超时，非断言失败，KM-02 战斗文件 7/7 通过。
- 超时隔离：`node node_modules/vitest/vitest.mjs run server/identity-audit.test.js` → **1 文件 / 5 条全部通过**，目标用例 1094ms。无并行负载再次全量运行 → **20 文件 / 294 条全部通过**，目标用例 4886ms，仍接近默认 5 秒上限；未修改测试超时或生产代码。
- 类型检查：`node node_modules/vue-tsc/bin/vue-tsc.js --noEmit` → 通过，0 输出、0 错误。
- 构建：`node node_modules/vite/bin/vite.js build` → 通过，1513 个模块完成转换。
- 产物自检：`node scripts/verify-build.mjs` → 通过；88 个产物，首屏 JS 112.0KB，懒加载 JS 6057.9KB，CSS 220.1KB，页面分包 16/16。
- 未验证项：未做真实浏览器 UI 验收；权威斗法新接口和 priceFor 公共补丁均尚未实施，因此没有对应新功能测试；未做跨进程战斗、生产数据库或真实名单验证；未部署、未开启积分同步。构建仍有 browserslist、`lobby.jpg` 运行时解析、大 chunk 与 CSS 偏大告警。

## KM-05 / 共享斗法规则核心提取与双端回归 / 2026-11-13

- 状态：共享核心已实现，待 Codex 审核与接续；生产冻结。本批只完成规则提取和回归，**不代表 `/duel` 服务端权威斗法闭环已完成**。
- 绝对工作区 / 分支：`D:/课件/platform/pet-garden-kimi` / `dev-kimi`。
- 原实施基线：`03ae4b4c26ba22b6ca142fe848f0cbdca461ccb8`；交付前按第六轮指令合并 `origin/dev-codex-integration-20261113@6cba9a859e9f68f813e7c7d0d7cb6599df9d3bf4`，合并提交为 `eb05f695052752e0b0305652158ee8e1fb3feda8`。
- 核心补丁提交：`1f7197d77b29d4771beb08d22df0d28a4d786faa`（`feat(battle): 提取可注入配置的共享斗法核心`）。本报告与交接单随后续文档提交推送，文档提交完整 SHA 在最终推送回执中给出。
- 问题与影响：原公式位于带 `@` alias 的浏览器 TS 模块，Node 不能直接加载；若服务端另写公式会形成第二套伤害、冷却和胜负规则。期望浏览器与 Node 共用同一无副作用核心，配置和 RNG 均由调用方注入，同时保持现有浏览器 API 和规则行为。
- 实现：新增 `src/utils/duel-core.js`，无 import，导出 `statsOf/createFighter/coefAgainst/resolveSkill/endTurn/pickEnemySkill/winnerOf`；新增同模块 `.d.ts` 声明配置、战斗单位、技能、事件和函数签名。`src/utils/duel.ts` 改为浏览器适配层，注入 `TIERS/TRIGRAMS/PETS/ECONOMY/SKILL_EFFECTS` 并保留旧导出，未修改 `Duel.vue`。
- 固定 RNG 回归：新增 `src/utils/duel-core.test.js` 7 条，直接加载真实 seeds；覆盖属性与技能推导、对宫系数、命中/暴击、护盾先于伤害及 KO 事件顺序、玩家与 AI 胜方、冷却与 AI 技能过滤、护盾/增益持续回合，以及核心与浏览器适配的深比较。双端对照覆盖普通攻击、对宫、灼烧现状、AOE 冷却、护盾、增益、胜负和事件顺序，不再只比较 `damage_single`。
- DOT 事实边界：`docs/seeds/skill_effects.json` 的灼烧描述包含 2 回合持续伤害，但原 `duel.ts` 与提取后的核心都只有 70% 单次伤害，没有 burn 状态、DOT 跳伤或回合事件。本批按“保持现有行为”只用测试固定该现状，**未实现 DOT，也未把灼烧测试伪称为持续伤害已通过**；是否补齐属于另立行为变更任务。
- TDD 红灯：首次运行 `node node_modules/vitest/vitest.mjs run src/utils/duel-core.test.js`，因 `./duel-core.js` 尚不存在而解析失败、0 条测试，确认失败原因后才添加核心实现。实现后定向运行 `node node_modules/vitest/vitest.mjs run src/utils/duel-core.test.js src/utils/duel.test.ts` → **2 文件 / 24 条全部通过**；原浏览器 17 条回归未改且通过。
- 合并后全量：`node node_modules/vitest/vitest.mjs run` → **26 文件 / 341 条全部通过**，其中 `duel-core.test.js` 7/7、`duel.test.ts` 17/17、`server/battle-record.test.js` 7/7。
- Node 无 alias 直连：以真实 seeds 创建双方并注入 `() => 0.5`，直接 `import './src/utils/duel-core.js'` 成功，返回 `{"nodeDirect":true,"events":[{"side":"player","kind":"hit","value":28,"message":"白虎·监兵 用单体伤害造成 28 点伤害"}],"targetHp":167}`。
- 类型检查：`node node_modules/vue-tsc/bin/vue-tsc.js --noEmit` → 通过，0 输出、0 错误。
- 构建：`node node_modules/vite/bin/vite.js build` → 通过，1514 个模块完成转换。
- 产物自检：`node scripts/verify-build.mjs` → 通过；88 个产物，首屏 JS 112.0KB，懒加载 JS 6060.8KB，CSS 220.5KB，页面分包 16/16。构建仍有 browserslist 数据旧、`lobby.jpg` 运行时解析、大 chunk 与 CSS 偏大告警，未在本批顺手修改；产物自检通过不等于允许部署。
- KIMI 自产修改范围：`src/utils/duel-core.js`、`.d.ts`、测试、`src/utils/duel.ts`、本报告与交接单。合并带入的其他 Agent 文件不属于 KIMI 补丁；未修改 `server/routes/game-v2.js`、`game-v3.js`、前端 API、`Duel.vue`、迁移文件或迁移版本 11，未重复提交已收口价格补丁。
- 未验证与待 Codex 接续：权威 start/action/state、actionId 重放、唯一落库、固定 AI 服务端配置和页面接入仍未实施；`/api/v2/battle/pve/result` 继续保持 501，第一阶段不发奖励。重启/多进程恢复及持久 actionId 幂等未解决。未做真实浏览器 UI 验收、生产或现有数据库盘点、真实名单验证；未部署、未开启积分同步。

## KM-06 / 服务端调用签名、状态序列化与 RNG / 事件顺序契约 / 2026-11-13

- 状态：第七轮要求的接入契约已整理，待 Codex 技术复验后接续路由；本批没有生产代码补丁，生产继续冻结。
- 绝对工作区 / 分支：`D:/课件/platform/pet-garden-kimi` / `dev-kimi`。
- 最新接续基线：`origin/dev-codex-integration-20261113@28d196881e973c2b4b9eace256e311fbe550ee2d`；本地合并提交为 `273041e5af0d88a0e573da74e173573706159ec8`。
- 已接收核心：`1f7197d77b29d4771beb08d22df0d28a4d786faa`；第七轮收件回复明确“无需重复提取”，因此本节只整理调用和序列化边界，未修改核心、路由、API 或页面。
- 现状证据：`server/routes/game-v2.js:268-291` 的 start 只校验宠物并返回待集成消息；`src/pages/Duel.vue:125-146` 仍是本地“玩家技能→判胜→AI 技能→判胜→双方 endTurn→turn+1”；旧 result 在 `game-v2.js:19-22` 保持 501。

### 1. 服务端调用签名与配置注入

建议 Codex 在服务端会话编排层直接从共享核心导入，不在路由复制公式：

```js
import {
  createFighter,
  resolveSkill,
  pickEnemySkill,
  winnerOf,
  endTurn,
} from '../../src/utils/duel-core.js'
```

- start 的 `teamPetIds` 第一阶段必须恰好 1 个 `player_pets.id`；按 `id + req.userId` 查询后，以 `template_id / level / awakening_level` 调用 `createFighter(template_id, level, awakening_level, duelConfig)`。核心返回的 `fighter.petId` 是**模板 ID**，不能被玩家实例 ID 覆盖；实例 ID 在会话中另存 `playerPetInstanceId`。
- AI 也由服务端配置调用 `createFighter(ai.templateId, ai.level, ai.awaken, duelConfig)`；不得接收客户端 AI 模板、成长、技能、RNG、seed 或 winner。固定演示参数放服务端配置，不硬编码进路由。
- `duelConfig` 形状固定为 `{tiers,trigrams,pets,economy,skillEffects}`；`skillEffects` 是 `skill_effects.json` 的 `effects` 数组，不是整个 JSON 根对象。若从数据库读取 tiers/trigrams，需要显式把 `power_coef/skill_slots/opposite` 映射回核心 camelCase；经济参数可复用 `readEconomy(db)` 的 seeds 默认值 + 运行期覆盖，核心内部不查库。
- `createFighter` 可能返回 `null`，配置缺失必须在 start 失败，不能继续战斗。`resolveSkill` 和 `endTurn` **原地修改** fighter；`resolveSkill` 的返回值只是本次事件数组，不能用返回值替换 fighter。`pickEnemySkill` 返回技能 code，`winnerOf` 不修改状态。

### 2. action 编排与技能前置校验

单个新 action 的服务端顺序固定如下：

```js
// 先完成认证、战斗归属与 actionId 重放检查；新请求再检查 active 和技能。
const playerEvents = resolveSkill(player, enemy, skillCode, 'player', rng, duelConfig)
events.push(...playerEvents)
winner = winnerOf(player, enemy)

if (!winner) {
  const enemySkill = pickEnemySkill(enemy, rng)
  events.push(...resolveSkill(enemy, player, enemySkill, 'enemy', rng, duelConfig))
  winner = winnerOf(player, enemy)
}

session.log.push(...events)
if (winner) {
  status = 'finished'
  // 由 Codex 在此处保证 battle_records 只写一次；log_json 已含终结事件，本阶段不发奖励。
} else {
  endTurn(player)
  endTurn(enemy)
  turn += 1
}
```

- `resolveSkill` 当前会把未知技能回退到 `skillEffects[0]`，且不检查技能是否属于 actor、`remain` 是否为 0、战斗是否已结束。因此路由/会话层必须先找到 actor 自己的精确 `skillCode` 并拒绝冷却技能；非法请求不得调用核心、修改冷却或消耗 RNG，不能依赖核心 fallback 充当校验。
- 玩家使 enemy HP 归零后不得选择或执行 AI 技能；任一方终结后不得执行 `endTurn` 或增加 turn。未终结时才按 player→enemy 顺序递减冷却/增益，再 `turn += 1`。
- actionId 重放检查必须位于“已结束”拒绝之前：同 battleId、同 actionId、同请求体直接返回缓存响应，不推进 RNG、不重复写库；同 actionId 不同请求体返回 409。新 actionId 才按 active 状态继续校验。第一阶段这只是同进程重放，不声称跨进程幂等。

### 3. 内部会话与可序列化传输快照

第一阶段内存会话建议至少包含：

```js
{
  battleId, ownerId, playerPetInstanceId,
  status, turn, player, enemy, winner,
  log, rng, recorded, replayByActionId
}
```

- `player/enemy` 当前均为普通 JSON 数据：`petId,name,pinyin,tier,trigram,level,awaken,maxHp,hp,atk,def,spd,shield,atkBuff,buffTurns,skills[{code,name,cost,cd,remain}]`。这些字段必须完整保留；不能只存 HP，否则冷却、盾和增益无法继续。
- `rng` 是函数，`replayByActionId` 可用 Map，均不能直接 JSON 序列化；`ownerId`、完整 `log`、落库标记和重放缓存也不应混入公开 fighter。传输快照只返回 `{battleId,status,turn,player,enemy,winner,events}`，其中 `winner` 未结束时为 `null`。
- 如传输层需要 `petInstanceId/templateId`，应在响应映射时附加，同时保留内部 `petId=templateId`；不要让序列化/反序列化改变核心 ID 语义。`duel-core.d.ts` 的 `DuelState` 是通用核心状态声明，不等同于上述带 battleId/status/events 的 API 快照，不能直接混用字段名。
- start 返回 `events=[]`；action 的 `events` 只放本 action 新事件，完整 `session.log` 在服务端累计。建议 GET state 返回 `events=[]`，避免刷新后重复播放旧特效；GET 不推进回合或 RNG。结束时 `turn_count` 取当前权威 turn，`log_json` 取累计 log，仍写现有 8 列 `battle_records`。

### 4. RNG 调用次数与恢复限制

- RNG 完全由服务端持有。伤害技能先抽 1 次闪避；只有未闪避时才再抽 1 次暴击。治疗、护盾、增益和 stun 不抽 RNG。`pickEnemySkill` 在技能池非空时抽 1 次；玩家已获胜时不再调用它。
- 因此一个未终结、双方均用伤害技能的 action 通常消耗 5 次：玩家闪避/暴击 2 次、AI 选技 1 次、AI 闪避/暴击 2 次；玩家或 AI 任一方闪避会少 1 次，玩家直接获胜会少掉整个 AI 阶段。测试和重放必须按实际分支断言调用次数，不能固定假设每回合 5 次。
- 非法/冷却技能、GET state、actionId 重放和 `endTurn` 均不得消耗 RNG。固定 RNG 单测可注入序列函数并在调用方记录 `drawCount`，该计数属于 RNG 适配器，不属于 fighter。
- `Math.random` 闭包只能支持第一阶段单进程内存战斗，不能重启恢复。未来若获准持久化，需另行选择可序列化 PRNG 内部状态，或固定算法版本后保存 `seed + drawCount`；不能只把当前 rng 函数 JSON.stringify，也不能在恢复时重置 seed 从头抽。迁移与跨进程承诺不在本批。

### 5. 事件顺序与消费限制

- 单次伤害事件顺序固定为：可选的护盾吸收 `shield` → `hit/crit` → 可选 `ko`；闪避只返回 `miss`，治疗/获得护盾/增益分别只返回 `heal/shield/buff`，`first_strike` 当前兜底为 `hit` 后可选 `ko`。一个 action 的总事件是玩家事件数组在前、AI 事件数组在后，`endTurn` 无事件。
- `DuelEvent.side` 表示**行动方**，不是目标方；事件当前没有 `target` 字段。尤其伤害前的护盾吸收事件也以攻击方为 side，却描述 target 的护盾，而 `shield_pct` 的获得护盾才作用于行动方自身。页面/适配层不能把所有 `shield` 都解释为“side 自己获得护盾”；若需显式 target，应由 Codex/DSH 以 additive API 字段另行接入，KIMI 本批未改事件结构。
- 当前核心没有 burn/stun 状态字段：灼烧仍只有单次伤害，stun 只产生 0 伤害文案，不附加眩晕状态。不得在序列化设计中虚构已实现状态；DOT 或其他技能语义变更仍需另立任务。

### 6. 给 Codex 路由复验的最小测试点

- start 拒绝模板 ID 充当实例 ID、他人宠物、多只宠物和未知模板；响应不包含 rng、ownerId 或重放缓存。
- 非法技能、非本人技能、冷却技能、已结束的新 action 均不改变状态且不消耗 RNG；actionId 同体重放返回原响应，不同体 409。
- 用序列 RNG 分别覆盖命中暴击、首次闪避、AI 闪避、玩家首击终结、AI 反击终结和未终结回合，断言 RNG 次数、turn、冷却、事件数组和胜方。
- GET state 无副作用且 events 不触发旧特效重放；玩家/AI 两种胜方只落一条 8 列记录，终结重放不重复写库；旧 result 继续 501，零奖励、零额外记录。

## 第七轮交付门禁 / 2026-11-13

- 修改范围：仅本报告与 `docs/handoffs/KIMI-2026-11-13.md`；没有生产代码、配置、seeds、迁移或页面改动。
- 全量测试：`node node_modules/vitest/vitest.mjs run` → **26 文件 / 341 条全部通过**，其中共享核心 7/7、浏览器斗法 17/17、战斗记录 7/7。
- 类型检查：`node node_modules/vue-tsc/bin/vue-tsc.js --noEmit` → 通过，0 输出、0 错误。
- 构建：`node node_modules/vite/bin/vite.js build` → 通过，1514 个模块完成转换。
- 产物自检：`node scripts/verify-build.mjs` → 通过；88 个产物，首屏 JS 112.0KB，懒加载 JS 6060.8KB，CSS 220.5KB，页面分包 16/16。既有 browserslist、`lobby.jpg`、大 chunk 和 CSS 偏大告警未顺手修改。
- 未验证项：本节是服务端接入契约，尚未实现或运行权威 start/action/state 新路由；未做真实浏览器 UI、重启/多进程、生产数据库或真实名单验证；未部署、未开启积分同步、未启用战斗奖励。

