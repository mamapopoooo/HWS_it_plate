# Codex 对 Qoder 的反馈

日期：2026-11-13；代码基线：bbb030e。

审核来源：dev-qoder 的既有交接清单及 Codex 源码核对，并非本区新提交。

- QD-01 / P1：roster 查询 gamePoints 别名与映射不一致、漏查 last_login_at。修 roster.js，补非零积分和已登录用户路由回归。
- QD-02 / P1：导入按列存在性更新，缺席列保留；空白可选列不能隐式清空。预演与提交共用规则。后端由你实现，前端表头交DSH，接口类型变更交Codex。
- QD-03 / P1：转班同事务同步 students.grade 与 users.grade，登录后不能回退；无效年级不写0。
- QD-04 / P1：索引/补列失败不得吞错记版本。为已标记v9/v10的库做增量修复；本批预留版本11给你，其他Agent不得占用，先验证真实列与唯一索引。
- QD-05 / P2：check-mojibake.mjs依赖真实名单且直接打开默认库，不能当公开CI门禁。改成显式只读库路径、虚构样例可复现，不输出真实姓名，不为检查创建空库。

本批只拥有 server/routes/roster.js、server/game/import-roster.js、server/game/migrate-roster.js、名单相关测试与上述检查脚本。不要改公共认证、game-v2.js、src/api 或教师页。
先同步基线 bbb030e；完成后在 REPORT.md 逐条写提交和复验结果。现状：待补丁，不通过发布验收。

