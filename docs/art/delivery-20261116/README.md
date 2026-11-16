# 墨境 · 正式美术资源交付（2026-11-16）

状态：本批技术规格已自检通过，交总审核复验与DSH页面接入。用户已确认造型与最新配色，并授权处理全部现有有效候选；灰度玄武已否定，不纳入本批。原始候选文件原样保留在public/art-review/，没有改动游戏规则或页面代码。

## DSH接入清单

以下8张已放在配置实际读取的正式路径。合入本次美术提交后，既有formImage与角色image字段即可取到，不需要改宠物ID或造新接口：

| 内容 | 真实ID | 文件 |
|---|---|---|
| 青龙首形态 | pet_qinglong | public/pets/qinglong/form1.png |
| 白虎首形态 | pet_baihu | public/pets/baihu/form1.png |
| 朱雀首形态 | pet_zhuque | public/pets/zhuque/form1.png |
| 玄武首形态（黑曜石、金纹、冰蓝点睛） | pet_xuanwu | public/pets/xuanwu/form1.png |
| 阴鱼首形态（黑鳞、金纹、银白鳍） | pet_yinyu | public/pets/yinyu/form1.png |
| 阳鱼首形态 | pet_yangyu | public/pets/yangyu/form1.png |
| 初始素衣男 | skin_base_m | public/characters/base_m.png |
| 初始素衣女 | skin_base_f | public/characters/base_f.png |

原男女装饰套装分别在public/art-delivery/20261116/outfit_m.png、outfit_f.png。它们不是免费素衣，也没有擅自绑定已有收费皮肤ID、定价或上架；待Codex/DSH确定对应内容条目后接入。
资源URL沿用BASE_URL，例如 /pet-garden/pets/xuanwu/form1.png。旧候选读取入口只用于对照；正式页面应使用上述路径，其他未制作的形态继续保持缺图回退。

## 规格与证据

- 六灵宠：精确1024×1024；四角色：精确1024×1536。
- 全部为8-bit RGBA、PNG color type 6（RGB24位加8位alpha），不是索引色PNG；全部小于250,000 bytes，实际221,319～241,215 bytes。
- 主体高度71.97%～72.01%，底边留白8.01%，在最终alpha上实测；男女及换装落脚线统一。
- 清除低透明度光晕及离散杂点，保留主体，重采样后保留边缘抗锯齿；alpha范围0～255，画布边缘无非透明像素。
- 使用有限颜色量化压缩，属于有损减色，不称无损。没有重画脸、动作或配色；白虎采用24色，其他48～128色，精确参数逐张记录在measurements.json。原图保留供未来高精度重处理。
- 已逐张查看light-dark-contact-sheet.png及64px-contact-sheet.png：未见原角色大面积光晕，六神兽轮廓、男女衣饰可区分，黑曜石玄武金蓝点睛及黑金阴鱼保留。小图不用于评判所有细小鳞片纹理。
- preview.html可在完整仓库本地打开，支持深浅底切换、全尺寸查看和64px对照。PNG均为本地实际输出，非示意截图。
- node scripts/check-art.mjs：6/98宠物、2/10角色就位，剩余缺100张，退出1表示全项目未齐；不把本批通过写成全项目立绘齐全。
- 本分支：类型检查0错误、22文件302测试通过、构建与产物自检通过。既有CSS220.3KB与大分包告警仍在，不代表所有页面已由DSH验收。

## 复跑与复验

工具版本使用本机独立工具目录的sharp与image-q，不加入应用依赖。不需要API、模型或生产访问。prepare-delivery-20261116.cjs与make-delivery-preview-20261116.cjs位于上级目录，通过GPT_ART_SHARP_MODULE / GPT_ART_IMAGE_Q_MODULE指定这两个模块的本地路径即可复跑。首次运行拒绝覆盖已存在目标；--replace-owned只供确认本批自有目标后重处理。

DSH需在最新整合基线选择性取本批美术提交（不要整分支合并此前未收口的UI主题补丁），实看大厅/图鉴/角色页、64px、移动端、深浅底、form2缺图回退及换装基线；总审核记录复验结论到本人FEEDBACK。本批未操作生产、未改背景视频或海报。
