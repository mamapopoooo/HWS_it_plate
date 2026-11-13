# 构建反馈区

当前协作入口：`origin/dev-codex-integration-20261113`；代码接续基线：`bbb030e`。首次落地于2026-11-13，当前为待验收整合分支，生产冻结。

| Agent | 本人汇报（本人写） | Codex审核反馈（Codex写） |
|---|---|---|
| Qoder | [REPORT](Qoder/REPORT.md) | [FEEDBACK](Qoder/FEEDBACK.md) |
| KIMI | [REPORT](KIMI/REPORT.md) | [FEEDBACK](KIMI/FEEDBACK.md) |
| DSH | [REPORT](DSH/REPORT.md) | [FEEDBACK](DSH/FEEDBACK.md) |
| GPT-ART | [REPORT](GPT-ART/REPORT.md) | [FEEDBACK](GPT-ART/FEEDBACK.md) |
| CODEX-CONTROL | [REPORT](CODEX-CONTROL/REPORT.md) | [FEEDBACK](CODEX-CONTROL/FEEDBACK.md) |
| Codex | [REPORT](Codex/REPORT.md) | [FEEDBACK](Codex/FEEDBACK.md) |

## 提交流程

1. 在自己独立工作区fetch读取本区，不为读文档切他人分支。
2. 每个Agent只编辑自己分区REPORT.md；可引用自己的交接单，避免重复贴长日志。Codex只写FEEDBACK.md和本索引。不要互改同一文件。
3. 汇报跟随修复推到自己的分支，附完整提交SHA/PR；Codex审核时fetch对应分支读取REPORT，审核结论汇总到整合分支。尚未合入的报告不一定能从本索引直接看到。
4. 仅push不会自动通知其他聊天；用户转发“角色/分支/提交/问题号”后Codex再取阅，或当前工作期间主动检查远端变化；不承诺后台持续监控。
5. 状态：待审核 → Codex接受方案/要求修改/需用户决定 → Agent提交修复待复验 → Codex复验通过。Agent不能自行把Codex验收标为通过。
6. 每个问题使用角色前缀唯一编号，如QD-01、KM-01；保留历史反馈，追加轮次和新提交，不覆盖旧结论。
7. 报告必须含复现、期望/实际、影响、文件、基线、提交、测试命令和实际结果、需要Codex决定的事项。真实名单、数据库、token与密钥不进入反馈区。
8. 当前其他Agent分区为Codex建立的空模板，FEEDBACK是初审/待办，不代表Agent已经汇报或接单。Codex分区是自检，不冒充独立审核。

## 当前审核结论

认证/API第一批已实测；名单补丁、战斗落库、UI与素材、管控联调继续分别等待交付。所有生产动作保持冻结。

