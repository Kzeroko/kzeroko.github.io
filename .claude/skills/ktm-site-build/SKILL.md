---
name: ktm-site-build
description: "KTM2 官网（kentomahou.com）的建站与写作约束：术语表、事实底线、不可公开的内容、作者语气范例、结构与验收清单。Build, extend or restructure the KTM2 site — new wiki/codex/blog/pages entries, module and roadmap data, navigation, layouts, site chrome — without repeating known mistakes. Use when asked to 做站 / 建站 / 加页面 / 重做某个板块 / 改 site.ts / 改导航 / 写新的 wiki 或设定集词条, or to add, restructure or rebuild any part of this site. For line-editing prose that already exists, use lang-polish instead."
user-invocable: true
---

# 适用范围

仓库 `D:\Github Repo\kzeroko.github.io`，站点 `kentomahou.com`。
本 skill 管**新增与重做**；只改文字不动结构时用 `lang-polish`。

站点是**自建 Astro 5 + MDX**，不是 Starlight。任何地方都不要再写 Starlight。

---

# 1. 事实来源

| 来源 | 权威范围 | 备注 |
| --- | --- | --- |
| `D:\Github Repo\IsekaiExpansion\language_assemble\categories\` | 所有游戏内名称与描述（种族、职业、技艺、属性、状态、物品、宝石…） | **中文是正文**，英文 `*desc` 大量还是 `"Xxx desc"` 占位符 |
| `D:\Github Repo\IsekaiExpansion` | 机制、数值、数据包格式 | 数值必须核对，不许凭印象 |
| `D:\Github Repo\KTM2WorldDict` | 世界观、人物、势力、地点、经济 | 只取「Ⅰ 公开资料」层 |
| `D:\Modrinth-Data\profiles\[1.20.1]KenToMahou2-TCOU` | 整合包级事实（模组数、版本） | — |

三个仓库对本仓库都是**只读**。

英文的种族/职业/技艺 **名称**照抄 language_assemble；**描述**因为原文是占位符，只能取自 codex/WorldDict，不要把中文直译过去。

---

# 2. 固定术语

写错这些等于返工。

| 正确 | 错误 |
| --- | --- |
| 厄达斯传奇 / The Chronicles of Urdas | 厄达斯编年史 |
| 异界系列 / Isekai Series | 异世界系列 |
| 模组加载器 Fabric | 加载器 Fabric |
| 种族 / 职业 / **技艺** | 专精、出身（作为层名时） |
| 魔法师 | 法师 |
| 龙人族 → 上位龙族 | 龙 → 高等龙 |

**十三个可玩种族**（顺序即游戏内顺序）：

魔族 Demon · 龙人族 Dragon · 矮人族 Dwarf · 精灵族 Elf · 人族 Human · 狐妖族 Kitsune · 猫人族 Feline · 机械种 Mecha · 鱼人族 Mermaid · 鬼族 Oni · 兔人族 Rabbit · 粘液族 Slime · 羽灵族 Winged Spirit

（上位龙族 High Dragon 是龙人族的进阶，不计入十三个。英文用单数形，别自创 Dragonblood / Machina / Merfolk / Lapines。）

**职业**：战士 Warrior · 射手 Ranger · 魔法师 Magic Caster · 牧师 Cleric · 神官 Priest · 重战士 Heavy Warrior · 猎人 Hunter
**技艺**：铁匠 Blacksmith · 厨师 Cook · 炼金术士 Alchemist

## 显示名一律去查，不要自己起

**已经踩过一次**：命运天平的选项被写成了「大胃」「乐观」「悲观」「和善」「凶悍」，全是编的。真名在 `categories/fate_balance/`：

| id | 中文 | English |
| --- | --- | --- |
| `hearty_appetite` | 大胃王 | Bottomless Appetite |
| `birdlike_appetite` | 小鸟胃 | Birdlike Appetite |
| `optimistic_nature` | 乐观性格 | Sunward Nature |
| `pessimistic_nature` | 消极性格 | Gloomward Nature |
| `kind_countenance` | 面相和善 | Kind Countenance |
| `fierce_countenance` | 面相狰狞 | Grim Visage |
| `silver_tongue` | 辞锋如银 | Silver Tongue |
| `tongue_tied` | 拙于言辞 | Tongue-Tied |
| `captivating_presence` | 魅力四射 | Magnetic Presence |
| `unassuming_presence` | 寡淡无华 | Faded Presence |

规矩：**任何在页面上出现的物品名、状态名、选项名、界面名，写之前先 grep `language_assemble`**；查不到就写 id，不要顺手翻译一个。

顺带记住命运天平自己的词：系统叫**命运天平**（教程里的叫法），界面标题是**命运调律**，一整套选择叫**命谱**，单条选择叫**命途**。

---

# 3. 事实底线

- **NPC 关系包含友谊、信任与恋爱。** 恋爱、求婚和配偶关系属于项目设计，不能把关系系统写成「与恋爱无关」，也不能用保留人物独立性为由删去恋爱内容。誓约之戒 / Engage Ring 是实际游戏物品，求婚条件、消耗和配偶绑定须核对 IsekaiExpansion 的 `EngageRingItem` 与关系实现。隶属及隶属契约有独立的资格与权限规则，不替代恋爱；不要凭空添加约会阶段或婚礼流程。
- 异界扩展的 wiki/dev 文档在模组仓库 `src/main/resources/ise_doc` 编写，通过 `isekai-expansion-docs-authoring` 的文档工具镜像至本站；修改机制文档时遵循该技能的受众边界，勿直接改本站镜像。
- 对话工坊的翻译文本可留空；导出时两种语言都保留所有引用键，空值为 `""`。AI 补写通过 `translation-todo.json` 定位上下文，填写语言值后重新导入，结构错误与待填写文本分开处理。

- **KTM2 是原创大陆，但不是固定地图。** 大陆分布基于 ReTerraForged，城镇 / 地下城 / 遗迹仍然随机生成。凡是说到「原创世界」的地方，都要顺带说清这一点，否则玩家会以为是手搓固定地图。
- **Isekai Structures 已经不存在**，内容并入 Isekai Expansion 本体。异界系列现在是**五个**模块：Core、Expansion、Tweaks、Cuisine、Melody。
- 1.20.1 · Fabric · 模组数与包版本都以 `src/data/site.ts` 的 `KTM2` 为准（模组数 = Modrinth 整合包 `mods/` 里启用的 jar，`.disabled` 不算；2026-09-25 核对为 257）。
- 数值改动跟着 IsekaiExpansion 走，页面 `updated` 字段是「数据核对日期」，不是「文章修改日期」。

---

# 4. 绝对不公开的内容

写站时**不得**出现，也**不要**解释为什么没有：

- 设计规则文档、运行时模块表、类名 / Service / Packet / Registry / Loader / Mixin / NBT 键名 / 内部字段名。
- 界面实现细节（ModernUI fragment、alpha 裁切、字体回退链之类）。
- **出身效果**（`dwarf_stone_form`、`kitsune_*`、`energy_overload`…）是隐藏属性，任何状态效果列表里都不能有。
- 声望、身份、命运天平这些页面写**结果**，不写**逻辑**：说「核对不过就不生效」，不说「服务端重新校验会话与目录版本号」。

**唯一例外**：命运天平页面「给附属模组作者」那一段 Java / 入口点内容保留。

**数据包教程是允许的**，而且要留：`data/<命名空间>/…` 路径、JSON 字段表、示例、`/ise dev …` 命令。判断标准——**写给数据包作者的留下，写给读源码的删掉**。

---

# 5. 各板块的分工

| 板块 | 是什么 | 不是什么 |
| --- | --- | --- |
| `wiki/` | 玩家要用的系统说明：是什么、数值多少、怎么触发、有什么例外 | 设计随笔、开发心得 |
| `codex/` | 厄达斯的公开设定层 | 剧透、内部写作规范 |
| `blog/` | **开发日志**：做了什么、遇到什么、接下来做什么 | 机制讲解（那是 wiki）、「为什么我这样设计 X」的长文 |
| `pages/` | about、法务等独立页 | — |

开发日志被塞进机制讲解是**已经犯过一次的错**，别再犯。

---

# 6. 语气：写得像我本人

中文先写，英文另外用英文写一遍——**不是翻译**。两边句子切分、举例可以不同，数值 / 条件 / 章节结构必须一致。

## 我的中文长这样

> 异界核心是异界系列的核心模组，你可以理解为异界系列的前置模组，所有异界系列模组都依赖于异界核心。

> 异界修改是 KTM2 异界系列中最混杂的模组……一些不太适合放在其它扩展中的修改也纳入异界修改之中。

> 手上这个是 KTM2，全称 KTM 剑与魔法 2—厄达斯传奇。跑在 1.20.1 的模组加载器 Fabric 上，装了 257 个模组。

> 在家里待机的情况下，舒适度不再下降。

> 除了查看蓝图，整个流程没有任何图形界面——把真实的物品放在真实的铁砧上，然后敲它。

写更新条目时是这个样子：

> 恐惧效果重做，现在恐惧效果同时有隐藏的 -20% 移速效果，控制效果对玩家也生效（玩家会自动逃跑）。

> 天赋现在可以通过后天努力提升，根据随机到的潜力决定可提升的等阶，范围 0~2 级。

七条特征：

1. 动词开头，先说做了什么——修复了 / 新增了 / 更新了 / 重做 / 调整。
2. 「现在……了」是主力句式，用来交代改动后的状态。
3. 主题＋冒号＋细节。
4. 补充信息塞括号，不另起一句。
5. 数值直接写进句子（`-20% 移速`、`0~2 级`、`由 20 提升至 26`）。
6. 会用「你可以理解为」把术语讲白；会用「小修小调」这种半口语说法；偶尔直接下判断（「非常强力」），那是他的评价不是宣传。
7. 只说改了什么、结果是什么，不解释自己为什么这么设计。

## 不要写成这样

| 别写 | 改成 |
| --- | --- |
| 为了打造一个真正独特且沉浸的世界，我将后续开发集中在以下三个维度 | 接下来主要在做这几块 |
| 告别枯燥的合成表 | 我在把制作从 3×3 合成格里搬出来 |
| 这些设计将成为 KTM2 独有的视觉名片 | （删掉） |
| 它存在的意义，是让「安顿下来」变成一种策略 | （删掉，直接讲数值） |
| 这不是个装饰性数值 | （删掉） |
| 三个维度 / 全新体验 / 沉浸感拉满 / 不仅仅是…… | （删掉） |

黑名单：值得注意的是、与此同时、从某种意义上、维度、赋能、闭环、打造、构建、赋予、让……成为……、不再只是……。

## 英文

- 英式拼写：`colour` `behaviour` `armour` `centre` `-ise`。（`armor_penetration` 是 ID，不算。）
- 主流不用牛津逗号。
- 可以用 `I` / `we` / `you`，可以直接下判断。
- 禁止 AI slop：`It's worth noting that`、`At its core, X is…`、`X isn't just Y — it's Z`、`unlock` `leverage` `seamlessly` `robust` `immersive` `a testament to`。

---

# 7. 结构与技术约定

- 内容路径：`src/content/{wiki,codex,blog,pages}/{en,zh-cn}/<slug>.mdx`。**两种语言 slug 必须相同**，语言切换靠它。
- frontmatter 字段以 `src/content.config.ts` 为准，不要自创字段。`wiki` 必填 `category`（core/combat/crafting/world）、`order`、`updated`。
- MDX 里 `Callout` `Steps` `Figure` `Gallery` `Clip` `Stats` `ElementMatrix` `LevelTable` `SkillSlots` 不用 import；带图片的组件仍要 `import` 资源。
- 中文角色台词用 `「」`，`“”` 留给术语与引用。
- 中文加粗后的句号放在星号外：`**先看图纸**。` —— 写成 `**先看图纸。**` CommonMark 不会闭合强调。
- 站点数据（模块、路线图、社交链接、KTM2 事实）在 `src/data/site.ts`；UI 文案在 `src/i18n/ui.ts`，两种语言键必须齐。
- 品牌图标固定用 `src/assets/images/ktm2/ktm2_iconr.webp`（`BrandMark.astro`）；favicon / touch icon / PWA 图标由 `npm run assets` 从同一张图生成，产物提交进仓库。不要再引入手绘 K 字 SVG。
- KOOK 与爱发电必须是 `SOCIALS` 里的 `primary: true`，出现在页首，不能只藏在页脚。

---

# 8. 交付前逐项确认

- [ ] 术语表全部对上（技艺 / 异界系列 / 厄达斯传奇 / 模组加载器）
- [ ] 页面上每一个显示名都 grep 过 `language_assemble`，没有一个是自己起的
- [ ] 没有出现类名、Service、Packet、Mixin、内部字段（命运天平那一段除外）
- [ ] 没有出现出身效果
- [ ] 没有在文档里解释「为什么这里不写某某」
- [ ] 数值在中英两版一致；发现不一致**上报，不自己改**
- [ ] 中英同 slug 成对存在
- [ ] 中文不是翻译腔，英文不是 AI slop，两边都像我写的
- [ ] `npm run build`（含 `astro check`）零 error / warning / hint
- [ ] 改了 `public/` 图标就跑过 `npm run assets` 并提交产物
