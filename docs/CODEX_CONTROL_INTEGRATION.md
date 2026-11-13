# CODEX-CONTROL：机房管控积分接入协作区

日期：2026-11-12。状态：**接口预留 / 待双端联调，生产同步关闭**。

负责人标识：CODEX-CONTROL。本协作区只维护管控对接契约、示例和任务流；平台 UI 归 DSH，路由/迁移归 Qoder，规则算法归 KIMI。平台代码与生产数据库本轮均未改动。

## 当前工作与边界

- 管控源码仓库：`mamapopoooo/lab-control-system`，候选分支 `codex/ui-storage-20261112`；教师 5.2.2 / 学生 5.4.5，尚待课堂验收。
- 平台协作分支：`dev-codex-control-integration`；本目录为独立文档工作区，不在其他 agent 的共享本地目录切换分支。
- 阅读依据：根 AGENTS.md、docs/00-总纲-架构基线与内容扩展规范.md、现有教师端积分同步技术方案v2.md；旧 v2 方案标注待审阅，其中字段/路由不能当作已实现。
- 遵守现有单一货币原则；管控纪律分是加减分来源，平台余额仍为已有积分（灵石），不会引入第二种货币。
- 本轮不挂载新路由、不迁移数据库、不发生产积分、不写云端凭据。本文的新增字段与返回格式为提案，不能据此开启客户端自动重试。

## 已核对的实际接口

`server/index.js` 挂载 `/api/v2`，`server/routes/game-v2.js` 实现：

```http
POST /api/v2/teacher/sync-points
Authorization: Bearer <admin-token>
Content-Type: application/json
```

现有请求为 `{"records":[{"studentNo":"DEMO-001","amount":1,"reason":"课堂表现","timestamp":1794441600000}]}`。

后端检查用户 role=admin，以 `users.username=studentNo` 查学生，累加 `users.game_points` 并写 `game_points_records`；当前响应为 `{"success":true,"synced":1}`。这只是仓库代码检查，未验证线上服务器部署的版本或该接口是否可用。

当前限制：每次生成新的服务端 UUID，没有外部事件去重；余额更新和流水插入未包在显式事务内；未见逐条结果、金额整数/范围检查及班级授权范围检查。直接超时重试会重复计分，部分成功时也无法安全确认。

旧 `/api/evaluations` 写 `students.total_points`，不是此接入应调用的游戏余额入口；本轮保留旧接口服务旧数据。

## 预留契约 v1（兼容扩展提案）

继续使用现有路径及 `records` 数组。保留 `studentNo`、`amount`、`reason`、`timestamp` 原字段，追加以下字段。只有服务器明确宣告支持契约 v1、通过联调后，管控才允许自动发送。

```json
{
  "contractVersion": "lab-control.points.v1",
  "deviceId": "DEMO-CLASSROOM-01",
  "records": [
    {
      "eventId": "8bc44079-f6aa-4e48-9ea7-1e428aac40fa",
      "studentNo": "DEMO-001",
      "classId": "DEMO-CLASS",
      "lessonId": "DEMO-LESSON-UUID",
      "amount": 1,
      "reason": "课堂表现加分",
      "category": "discipline",
      "timestamp": 1794441600000,
      "sourceSequence": 1
    }
  ]
}
```

- `eventId`：一次人工加减分生成一次 UUID，先落盘，所有重试使用原值。同一事件号不同内容必须拒绝，不能当成功。
- `studentNo`：学号字符串，保留前导零；映射到平台 users.username。管控当前主要依靠座位和姓名，必须补外部班级/座位到学号映射；缺学号只留待核对，不猜测、不按姓名自动认领。
- `lessonId`：每节课创建并持久化，重连与重启不重建；`classId` 是平台班级 ID，不能把班级显示名直接当 ID。
- `amount`：有符号非零整数；不传浏览器余额或课堂累计值，不使用客户端计算后的年级倍率。范围、负分与余额不足处理由平台已有经济规则确认。不能静默截断或减到零后仍确认原额。
- `timestamp`：UTC Unix 毫秒整数；服务器另记接收时间，不依赖本机时钟去重。`sourceSequence` 是设备/课次内持久递增的审计序号，不替代 eventId。
- `deviceId` 从外部配置读取；教师身份及权限取认证信息，服务器不信任请求自填教师身份。设备 ID 本身不是凭据。

建议新响应保留旧 `success`、`synced` 并追加：

```json
{
  "success": true,
  "synced": 1,
  "contractVersion": "lab-control.points.v1",
  "results": [
    {
      "eventId": "8bc44079-f6aa-4e48-9ea7-1e428aac40fa",
      "status": "applied",
      "recordId": "SERVER-RECORD-ID",
      "appliedAmount": 1
    }
  ]
}
```

逐条状态：`applied`=已事务提交；`duplicate`=同内容事件已提交；`rejected`=永久问题需人工处理；`retryable`=可按原事件重试。缺失结果的事件不能直接标为成功。兼容旧的 `success/synced` 响应不能作为契约 v1 的逐条确认。

预留只读能力探测：`GET /api/v2/teacher/sync-points/capabilities`，同样要求管理员认证。提议返回 `contractVersion`、`idempotent:true`、`perRecordAck:true`、`maxBatchSize`。目前此路由未实现；404 或旧格式必须保持上传关闭，**不能通过试发 POST 探测能力**，以免旧接口直接记分。OpenAPI 预留定义见同目录 `CODEX_CONTROL_POINTS.openapi.json`。

错误约定提案：401 暂停等待重新认证；403 停止该范围上传；409 同事件号内容冲突，进入人工核对；422 学号/班级/金额等无效不自动重试；429 尊重 Retry-After；5xx/连接错误退避重试。只有部署了幂等事务后才允许重试。

## 实时流程与处理器开销

1. 教师点击加减分，生成事件并在本地事务保存课堂账本与待发送队列，再更新 UI。
2. 单后台 worker 以唤醒事件工作，不在 Tk 回调等待 HTTP；每次变化立即唤醒，可将约 100–300ms 内的多次操作合并传输，但每个 eventId 独立保留。
3. 复用连接，限制并发；失败以 1/2/5/15/60 秒加抖动退避，最大间隔 60 秒。空闲阻塞等待，不高频轮询。
4. 后端鉴权并验证班级/学生归属；事件去重与金额累加、流水插入在同一 SQLite 事务内完成。沿用既有积分账本，不另造货币；只做增量迁移。
5. 管控逐条落确认；重启后恢复未确认队列。课后按 eventId/lessonId 对账，只补缺失事件，不能用课堂总分覆盖学生消费后的云端余额。

这个操作频率下，CPU 负担预期很小；这是设计判断，尚无目标四核机器的同步性能实测。实现时记录 UI 回调耗时、队列积压、HTTP 时延、重试次数，再给实际数据。

## 待办与交接

| 编号 | 负责人 | 状态 | 交付 |
|---|---|---|---|
| CC-01 | CODEX-CONTROL | 本轮完成 | 现状检查、兼容契约、脱敏样例、任务边界 |
| CC-02 | CODEX-CONTROL | 待实现 | 外部学号映射、课次、加分事件账本/outbox、关闭默认开关 |
| CC-03 | Qoder | 待确认 | 契约 v1 capability、权限范围、金额验证、幂等事务与逐条响应 |
| CC-04 | KIMI + 用户 | 待确认 | 负分、余额不足、兑换倍率与撤销规则，沿用单一货币 |
| CC-05 | DSH | 待实现 | adapter/types 兼容字段，教师同步状态、课后核对入口 |
| CC-06 | CODEX-CONTROL + Qoder | 待联调 | 重复/超时/离线/部分成功/并发消费/重启恢复验收 |

撤销使用新的反向事件并关联原 eventId；课堂清零只改变本地课堂显示，不能隐式撤销已同步积分。任何既有重置入口需在实现 CC-02 时逐个梳理。

## 验收与启用门槛

- 同事件请求两次、提交成功但响应丢失后重试：只增加一次余额、一次流水。
- 错误学号/班级、无权限账户、非整数/越界金额：不更新余额且逐条可解释。
- 部分批次失败：只重试未确认事件；断电重启后从本地账本恢复。
- 学生同时消费：增量不能覆盖消费余额；课后能查到完整课次事件。
- 未配置、契约不匹配、认证失效时同步保持关闭；日志不含 token、共享密钥、完整请求中的个人信息。
- 文档预留不等于接口上线。本轮未跑平台类型检查/单测/构建，也未宣称通过这些门槛；平台实现合入前按 AGENTS.md 执行完整检查。

示例全部是虚构标识，不含真实名单、IP、凭据或学生分数。
