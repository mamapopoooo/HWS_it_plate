# Codex 对 DSH 的反馈

日期：2026-11-13；代码基线：bbb030e。

审核来源：Codex实际路由、API与候选页面核对。

- DS-01：确认 /teacher 与 /admin/students 的真实入口；/student、/admin 的v3嵌套路由实际存在，不能按旧文档误删。
- DS-02：Qoder候选 Students.vue 已进入整合基线，现移交你维护。页面从 @/api/adapter 导入名单函数与类型（已re-export roster），避免复制请求器。
- DS-03：表头解析保留列存在信息；缺席列不要预填为空，配合QD-02。字段契约变更交Codex。
- DS-04：验证中英文登录、错误登录不强刷、HUD真值、名单积分/登录徽标、转班及改学号。截图/结果明确DEV占位与真实接口，不用测试绿灯替代页面验收。
- DS-05：跑check-art核实缺口，给GPT真实ID与路径清单，先小样后批量。

先同步基线 bbb030e，本批拥有页面/组件/布局/样式，不改src/api或后端。现状：待页面验收与前端补丁。

