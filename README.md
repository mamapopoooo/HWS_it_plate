# 王宠课堂 2.0 · 班级宠物园（v3）

> 游戏化班级管理系统：教师课堂加分为唯一货币 → 学生抽签集宠 → 回合制斗法 → 班级战。
> v3 起改为**中国风水墨**、**五阶品阶（无极·太极·四象·八卦·万象）**、**八卦八属性**。

![版本](https://img.shields.io/badge/version-3.0-purple)
![技术栈](https://img.shields.io/badge/技术栈-Vue3%20%2B%20TS%20%2B%20Express%20%2B%20SQLite-green)
![测试](https://img.shields.io/badge/tests-45%20passed-brightgreen)

---

## 一、这是什么

面向中小学信息技术课堂的积分 + 养成 + 对战平台。教师用手机或电脑给学生加减分，学生用积分抽签、集齐神兽、与同学斗法。

**核心循环：**

```
课堂表现 → 积分（唯一货币）→ 求签 / 集市 → 宠物与角色成长 → 斗法 → 班级战与排行榜
```

**v3 的三个关键设计：**

| 设计 | 说明 |
|---|---|
| **五阶品阶** | 无极（隐藏/学生自造）> 太极（阴阳鱼）> 四象（四方神兽）> 八卦（八属之灵）> 万象（山海异兽）。图鉴共 38 只官方 + 每人 1 只本命 |
| **三轴成长** | 品阶（物种，定死）× 等级（Lv.1–7）× 觉醒（上限随品阶递增，形态 = 觉醒 + 1） |
| **风格光谱** | 38 只分四类画风：萌系 8 / 俊逸 10 / 雅致 10 / 奇诡 10，男女生各有所爱 |

---

## 二、功能清单

### 学生端（12 个页面）

| 路由 | 页面 | 说明 |
|---|---|---|
| `/lobby` | 太极盘大厅 | 立绘站台、卦象环、功能坞、活动榜文 |
| `/collection` | 灵宠图鉴 | **五阶分卷**（卷数由配置生成）、风格筛选、未获得剪影 |
| `/pet/:id` | 宠物详情 | 卦象盘、形态切换、战力与觉醒费用 |
| `/gacha` | 求签 | 摇签筒演出（2.4s，可跳过）、保底进度、概率公示 |
| `/ranking` | 封神榜 | 三榜（积分/战力/收集）；前三领奖台、4–7 全身、8+ 只名字 |
| `/shop` | 集市 | 分类货架、铜钱价签、限购 |
| `/quests` | 课业 | 每日 / 每周双卷轴、领取奖励 |
| `/achievements` | 功名册 | 印章式徽章、未解锁进度、盖章动画 |
| `/character` | 修行者 | 男女形象、皮肤穿戴（纯装饰）、昵称 |
| `/custom` | 造物 | 无极 UGC：立绘上传 + 效果池配技能（120 灵力，不可填数值） |
| `/events` | 节气榜文 | 活动按日期自动上下架 |
| `/duel` | 斗法 | 国风水墨战场、飘字、卷轴战况、结算 |

### 教师端（2 个页面）

| 路由 | 页面 | 说明 |
|---|---|---|
| `/teacher` | 教师工作台 | 学生卡片网格、−1/+1/+3/+5 快捷加分、待同步队列 |
| `/review` | 造物审核 | 队列 + 详情、超预算自动提示、驳回必填理由 |

> 两者都要求管理员登录；开发期可用 `?preview=1` 跳过角色校验（仅 DEV 构建生效）。
> 旧 v1 页面（`/` 首页、`/preview`、`/battle`）已于 2026-11-04 下线；`/` 与 `/battle` 保留重定向。

---

## 三、技术栈

| 层 | 选型 |
|---|---|
| 前端 | Vue 3 + TypeScript + Vite + Pinia + Vue Router |
| 样式 | 原生 CSS 变量 + 少量 Tailwind（国风令牌集中在 `src/styles/tokens.css`） |
| 后端 | Node.js + Express + SQLite（better-sqlite3） |
| 测试 | Vitest（45 条） |
| 战斗表现 | Vue + CSS 外壳；PixiJS 特效层已按需预留（当前未引入） |

---

## 四、目录结构

```
class-pet-garden/
├── src/
│   ├── api/            types.ts（契约）/ demo.ts（占位数据）/ adapter.ts（接口优先+回落）
│   ├── config/         gameConfig.ts（品阶/八卦/战力/价格）/ contentConfig.ts（商城/任务/成就/皮肤/活动）
│   ├── styles/         tokens.css（国风令牌）/ game.css（卷轴·印章·太极盘）/ battle.css（斗法配色）
│   ├── components/     layout/（HUD·功能坞）pet/（卡片·站台·名称牌）gacha/（求签演出）
│   ├── pages/          v3 页面（见上方路由表）+ v2/（旧版，待迁移）
│   ├── utils/          gacha.ts / duel.ts（纯函数 + 单测）
│   └── layouts/ stores/ composables/ router/
├── server/             Express API（v1 /api、v2 /api/v2）
├── docs/
│   ├── 00-总纲-架构基线与内容扩展规范.md        ← 权威基线，先读这份
│   ├── 品阶体系-v3-中国风设计规范.md
│   ├── 品阶体系改造-各Agent同步清单.md
│   ├── 战斗引擎选型.md
│   ├── seeds/          tiers / trigrams / pets / skill_effects / economy
│   │                   skins / shop / quests / achievements / events
│   └── design-preview*.html                    视觉稿（浏览器直接打开）
└── scripts/verify-build.mjs                    构建产物自检
```

---

## 五、快速开始

> 本机 PowerShell 执行策略会拦 `npx` 与 `npm.ps1`，所以下面用 `node` 直跑二进制；能用 `npm run` 的环境照常用脚本。

```powershell
# 安装依赖
node "$env:ProgramFiles\nodejs\node_modules\npm\bin\npm-cli.js" install

# 开发（前端 3001 + 后端 3002，两个终端）
node node_modules\vite\bin\vite.js
node server\index.js

# 打开
# http://localhost:3001/pet-garden/lobby                  学生端
# http://localhost:3001/pet-garden/teacher?preview=1       教师端
```

**默认入口**：`/` 会重定向到 `/lobby`；未登录由守卫送去 `/login`。

---

## 六、数据与配置

**所有内容都是数据，代码只读数据**（详见 `docs/00-总纲` §10）：

```
docs/seeds/*.json  →  src/config/*.ts  →  src/api/adapter.ts  →  页面
   内容唯一入口          类型化与计算         接口优先、失败回落
```

**加一只宠物的步骤**（0 行代码）：

1. `docs/seeds/pets.json` 加一项（`tier` / `trigram` / `style` / `pinyin` / 出处）
2. 把立绘放到 `public/pets/{id}/form{N}.png`
3. 刷新 —— 图鉴自动分卷、抽签池自动包含、详情页自动可看

**价格与概率**只写在 `docs/seeds/economy.json` 与 `tiers.json` 里，改价格不用改代码。

**改种子数据后先跑校验：**

```powershell
node docs\seeds\_validate.mjs
# 校验：宠物数量 24/8/4/2、概率合计 1.0、对宫互指、风格分布、男女皮肤配对、活动日期
```

---

## 七、测试与构建自检

```powershell
node node_modules\vue-tsc\bin\vue-tsc.js --noEmit    # 类型检查
node node_modules\vitest\vitest.mjs run              # 单测（45 条）
node node_modules\vite\bin\vite.js build             # 构建
node scripts\verify-build.mjs                        # 产物自检（部署前必跑）
```

`verify-build.mjs` 检查：`/pet-garden/` 基路径、资源是否真实存在、14 个页面分包是否齐全、产物里是否残留 v1 分包、体积是否超标。

**当前体积**：主包 109.5 KB（gzip 42.4 KB），页面按需分包。

---

## 八、部署（手工，无 CI）

```powershell
node node_modules\vue-tsc\bin\vue-tsc.js --noEmit
node node_modules\vite\bin\vite.js build
node scripts\verify-build.mjs          # 必须"通过"
# 上传 dist/ 与 server/ 到服务器，重启 node server/index.js
```

| 项 | 值 |
|---|---|
| 服务器 | Ubuntu · `110.40.142.247` |
| 前端路径 | `/var/www/hw-platform/pet-garden/` |
| API 路径 | `/opt/pet-garden-server/` |
| 端口 | 3002（API），Nginx 反代前端 |
| 访问 | `http://110.40.142.247/pet-garden/` |

> 离线缓存（Service Worker）按决定**暂不做**：机房内网稳定，SW 会增加"改了看不到新版本"的排查成本。

---

## 九、文档索引

| 文档 | 用途 |
|---|---|
| `docs/文档状态总表.md` | **先看这张表**：哪些文档现行、哪些已归档 |
| `docs/00-总纲-架构基线与内容扩展规范.md` | **权威基线**：原则、分层、扩展点、数值、经济、契约 |
| `docs/品阶体系改造-各Agent同步清单.md` | 三个 Agent 各自改什么 + adapter 期望字段 |
| `docs/品阶体系-v3-中国风设计规范.md` | 视觉语言、风格光谱、美术生产规范 |
| `docs/战斗引擎选型.md` | 为什么不上 Phaser/Cocos，特效分层怎么做 |
| `提示词-KIMI.md` / `提示词-DSH.md` | 各 Agent 的角色提示词（v3 版） |
| `docs/seeds/*.json` | 全部内容数据 |

---

## 十、常见问题

**Q：页面显示"未获得"或卦象字符？**
A：美术立绘尚未接入，缺图按设计退化为卦象占位，不是加载失败。

**Q：数字都好整齐，是真实数据吗？**
A：接口未就绪时页面使用 `docs/seeds` 的占位数据；`adapter.ts` 会在 1.5s 内尝试真实接口，成功即切换。

**Q：为什么不用 Phaser / Cocos？**
A：回合制没有物理需求，且引擎场景与 Vue 状态双份维护成本高。见 `docs/战斗引擎选型.md`。

**Q：多个 Agent 同时改这个仓库要注意什么？**
A：各开一个 `git worktree`（`git worktree add ..\pet-garden-xxx dev-xxx`），不要在同一个目录切换分支，否则会互相冲掉未提交改动。
