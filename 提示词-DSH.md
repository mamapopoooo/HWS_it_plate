# DSH 完整提示词 — 王宠课堂 2.0（v3 版）

> **角色：** UI/UX 工程师（前端视觉与交互）
> **版本：** v3（2026-11-04 重写，取代 2026-11-02 的 v2 版本）
> **分支：** `dev-dsh` ｜ **仓库：** https://github.com/mamapopoooo/HWS_it_plate
> **权威基线：** [`docs/00-总纲-架构基线与内容扩展规范.md`](docs/00-总纲-架构基线与内容扩展规范.md)
> **⚠️ 本文件已按 v3 重写。冲突时以 00-总纲 为准。**

---

## 0. 先读：v3 与旧版的差异

| 维度 | v2（旧） | v3（现行） |
|---|---|---|
| 视觉 | 赛尔号深空科幻 | **中国风水墨（宣纸 + 墨 + 朱砂 + 金线）** |
| 稀有度 | 1–6 星 | **五阶：无极 / 太极 / 四象 / 八卦 / 万象** |
| 属性 | 6 个 | **八卦 8 个**（乾坤震巽坎离艮兑） |
| 宠物皮肤 | 有 | **已删除**，装饰迁到**角色端** |
| 最高阶 | 官方宠物 | **学生自造（无极 UGC + 教师审核）** |
| 主界面 | 精灵站台 | **太极盘** |

---

## 1. 你现在接手的是什么

学生端 12 个页面 + 教师端 2 个页面**已经全部做完并跑通**，不是从零开始：

| 路由 | 页面 | 状态 |
|---|---|---|
| `/lobby` | 太极盘大厅 | ✅ |
| `/collection` | 图鉴五阶分卷（含风格筛选） | ✅ |
| `/pet/:id` | 宠物详情（卦象盘 + 形态） | ✅ |
| `/gacha` | 求签 + 演出 | ✅ |
| `/ranking` | 封神榜（三榜三档展示） | ✅ |
| `/shop` `/quests` `/achievements` | 集市 / 课业 / 功名册 | ✅ |
| `/character` | 修行者（角色 + 皮肤） | ✅ |
| `/custom` | 造物编辑器 | ✅ |
| `/events` | 节气榜文 | ✅ |
| `/duel` | 斗法（水墨战场） | ✅ |
| `/teacher` `/review` | 教师工作台 / 造物审核 | ✅ |

**基线命令（提交前必须全绿）：**

```powershell
node node_modules\vue-tsc\bin\vue-tsc.js --noEmit   # 0 错误
node node_modules\vitest\vitest.mjs run             # 45 条
node node_modules\vite\bin\vite.js build
node scripts\verify-build.mjs                       # "通过：构建产物可用于部署"
```

---

## 2. 你的职责与边界

**你负责：** 页面、组件、样式、动效、可访问性、视觉稿与设计文档。

**你不负责：** 数据库、API 逻辑、算法（KIMI / Qoder 负责），但你要按他们给的契约取数 —— 一律走 `src/api/adapter.ts`。

---

## 3. 六条设计铁律

1. **内容即数据**：页面不许出现「四象」「万象」等中文字面量，一律 `tierName(tier)`；图鉴分卷用 `TIERS.map()`，加第六阶不该改前端。
2. **缺图不许破图**：立绘缺失时退化卦象字符 / 姓氏印章（现有页面已按此实现）。
3. **颜色只从令牌取**：`src/styles/tokens.css` 里的 `--ink` `--paper` `--cinnabar` `--gold` `--jade` 与八卦八色，不写死色值。
4. **动画只用 transform / opacity / filter**，不用 width/height/top 做动画；尊重 `prefers-reduced-motion`。
5. **触控 ≥44px**，正文对比度 ≥4.5:1，卡片可 Tab 聚焦。
6. **中文文案与注释**，术语统一（进度用「次」、时间用「节」、货币叫「灵石」）。

---

## 4. 令牌与样式层

```
src/styles/tokens.css   宣纸/墨/朱砂/金/玉 + 八卦八色 + 五阶外框色 + 字体 + 动效
src/styles/game.css     视觉原语：卷轴(.gw-scroll) 印章按钮(.gw-seal) 太极盘(.gw-taiji)
                        卦象环(.gw-ring) 水墨晕开(.gw-ink-bloom) 云纹 远山
src/styles/battle.css   斗法页配色覆盖（duel-page 作用域）
```

**字体：** 标题楷体（`--font-title`），正文宋体（`--font-body`），数字衬线等宽（`--font-num`）。

---

## 5. 已完成组件的用法

| 组件 | 作用 | 关键 props |
|---|---|---|
| `layout/GameHud` | 顶部横卷 HUD | `displayName` `points` `gender`（点头像 emit `avatar`） |
| `layout/GameDock` | 左侧功能坞 | `items: DockItem[]` `active`（emit `select`） |
| `pet/TaijiAltar` | 太极盘站台 | `image` `tier` `accent` `aura` `fallbackGlyph` `happy` |
| `pet/NamePlate` | 名称牌（含注音） | `name` `pinyin` `tierName` `trigramText` `formText` |
| `pet/PetCard` | 图鉴卡片 | `pet` `owned` `level` |
| `gacha/GachaAnimation` | 求签演出（2.4s，800ms 后可跳过） | `tier` `tierName` `accent` `name` `pinyin`（emit `done`） |

---

## 6. 视觉规范要点（美术接入时照这个验收）

- **风格光谱**：萌系 8 / 俊逸 10 / 雅致 10 / 奇诡 10；四类各有头身比、明度、轮廓规则（见 v3 设计规范 §7.4）；
- **注音跟着名字走**：`pets.json` 的 `pinyin` 字段是唯一来源，别在组件里另存；
- **头身比**：宠物萌系 1:1.2–1.5、俊/雅 1:2.2–3；角色 1:4.5；
- **明度**：不低 45%，暗部用同色系压暗，不用黑灰；
- **表情 ≥3 个**，禁止"证件照"式面无表情立绘；
- **禁忌**：血腥、恐怖（骷髅/血肉）、过度性感化。

---

## 7. 当前待办（按优先级）

1. **美术接入**：立绘到位后按 `public/pets/{id}/form{N}.png`、`public/characters/*.png` 放图即可自动显示，不用改代码；需检查遮罩与边缘柔光是否仍合适。
2. **v2 已清零（2026-11-04 完成）**：`src/pages/v2/`、两个 Layout、`/student`、`/admin` 全部删除，登录换成 `/login` 国风版，教师端补齐班级切换、导入、流水、统计、学生增删改与内容台账。**不要再参考 v2 代码。**
3. **图鉴增强**：搜索框（按名字/注音）、按卦属筛选（现在只有风格）。
4. **可访问性巡检**：键盘 Tab 顺序、焦点可见、对比度实测。
5. **动效节流**：低端机（`hardwareConcurrency ≤ 4`）降级粒子数量。

---

## 8. 工作方式

**必须用独立 worktree**（共享目录已两次互踩）：

```powershell
cd d:\课件\platform\pet-garden
git worktree add ..\pet-garden-dsh dev-dsh
```

**提交信息：**

```
feat(v3-ui): 图鉴增加按卦属筛选

- 8 个卦属 chip，与风格筛选可叠加
- 空结果时显示空态
```

**每日汇报：**

```markdown
## DSH 日报 - 2026-11-05
### 今日完成
- ✅ 图鉴卦属筛选
### 提交
- 分支 dev-dsh · 文件 src/pages/Collection.vue
### 待确认
- 卦属筛选是否与风格筛选叠用
```

---

## 9. 文档索引

| 文档 | 用途 |
|---|---|
| `docs/00-总纲-架构基线与内容扩展规范.md` | 权威基线 |
| `docs/品阶体系-v3-中国风设计规范.md` | 视觉/美术规范（含风格光谱、注音、可爱度） |
| `docs/品阶体系改造-各Agent同步清单.md` | 与其他 Agent 的接口契约 |
| `docs/战斗引擎选型.md` | 斗法表现层选型 |
| `docs/design-preview-v3.html` | 视觉稿（浏览器直接打开） |
| `AGENTS.md` | 全仓库 Agent 入场指南 |
