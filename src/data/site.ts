import type { LocaleCode } from '../i18n';
import type { IconName } from '../components/base/icons';

/** A string that exists in every supported language. */
export type I18nText = Record<LocaleCode, string>;

export const SITE = {
  domain: 'kentomahou.com',
  url: 'https://kentomahou.com',
  repo: 'https://github.com/Kzeroko/kzeroko.github.io',
  author: 'Kzeroko',
  /** Used for `<meta name="theme-color">`, matched to the dark surface. */
  themeColor: { light: '#f5f2ec', dark: '#070b12' },
} as const;

export interface SocialLink {
  id: string;
  label: string;
  href: string;
  icon: IconName;
  /** The footer lists every link; the header renders the `primary` ones. */
  primary: boolean;
}

export const SOCIALS: SocialLink[] = [
  { id: 'github', label: 'GitHub', href: 'https://github.com/Kzeroko', icon: 'github', primary: true },
  { id: 'discord', label: 'Discord', href: 'https://discord.gg/uwhpp65vwU', icon: 'discord', primary: true },
  { id: 'bilibili', label: 'Bilibili', href: 'https://space.bilibili.com/20218494', icon: 'bilibili', primary: true },
  { id: 'kook', label: 'KOOK', href: 'https://www.kookapp.cn/app/channels/2843529064587973', icon: 'kook', primary: true },
  { id: 'afdian', label: '爱发电 / Afdian', href: 'https://afdian.com/a/kzeroko', icon: 'heart', primary: true },
];

export interface NavItem {
  key: string;
  label: I18nText;
  /** Path relative to the language root, without leading or trailing slashes. */
  path: string;
  /** Marks the item active for any URL beginning with this path. */
  match?: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { key: 'ktm2', label: { en: 'KTM2', 'zh-cn': 'KTM2' }, path: 'ktm2' },
  { key: 'wiki', label: { en: 'Wiki', 'zh-cn': '维基' }, path: 'wiki' },
  { key: 'codex', label: { en: 'Codex', 'zh-cn': '设定集' }, path: 'codex' },
  { key: 'blog', label: { en: 'Devlog', 'zh-cn': '开发日志' }, path: 'blog' },
  { key: 'about', label: { en: 'About', 'zh-cn': '关于' }, path: 'about' },
];

/* -------------------------------------------------------------------------- */
/* KTM2 project facts                                                          */
/* -------------------------------------------------------------------------- */

export const KTM2 = {
  name: 'KenToMahou 2',
  subtitle: 'The Chronicles of Urdas',
  minecraft: '1.20.1',
  loader: 'Fabric',
  modCount: 268,
  packVersion: '0.4.0',
  moduleVersion: '1.20.1-0.4.0',
} as const;

export interface Pillar {
  key: string;
  icon: IconName;
  title: I18nText;
  body: I18nText;
}

/**
 * The four things the pack is actually built around. Wording comes from the
 * WorldDict's "player promise" section rather than from a feature list.
 */
export const PILLARS: Pillar[] = [
  {
    key: 'liveable',
    icon: 'home',
    title: {
      en: 'A world you can settle into',
      'zh-cn': '可以住下来的世界',
    },
    body: {
      en: 'Towns have work, rent, food, transport and a watch. Comfort tracks whether you have somewhere to sleep. Staying somewhere is a strategy, not downtime.',
      'zh-cn':
        '聚落里有工作、房租、饮食、交通和治安。舒适度会算上你有没有地方能好好睡一觉。留在一个地方是玩法的一部分，不是浪费时间。',
    },
  },
  {
    key: 'stance',
    icon: 'scales',
    title: {
      en: 'Positions, not good and evil',
      'zh-cn': '立场先于善恶',
    },
    body: {
      en: 'Empire, church, demons, elves and scholars are each protecting someone — and each making someone else pay for it. Reputation is tracked per faction, and the factions disagree.',
      'zh-cn':
        '帝国、教廷、魔族、精灵和魔法学者都在保护某些人，也都让另一些人承担代价。声望按阵营分别计算，而这些阵营彼此并不合拍。',
    },
  },
  {
    key: 'magic',
    icon: 'sparkles',
    title: {
      en: 'Magic as infrastructure',
      'zh-cn': '魔法是基础设施',
    },
    body: {
      en: 'Conductors, star towers and magitech ore power miracles — and also mining, medicine, war and class. Spell schools, elements and gear all read from the same rules.',
      'zh-cn':
        '魔导体、星塔与魔石既能发动奇迹，也牵动着矿业、医疗、战争和阶级。法术学派、元素与装备读的是同一套规则。',
    },
  },
  {
    key: 'cast',
    icon: 'users',
    title: {
      en: 'Companions with their own lives',
      'zh-cn': '有自己人生的同伴',
    },
    body: {
      en: 'Every travelling companion has duties, old debts and choices of her own. Getting closer changes what she lets you see — it does not solve her problems for her.',
      'zh-cn':
        '每位同行者都有自己的职责、旧债和选择。关系变近改变的是她愿意让你看见的部分，而不是替她把问题解决掉。',
    },
  },
];

/* -------------------------------------------------------------------------- */
/* Isekai Series modules                                                       */
/* -------------------------------------------------------------------------- */

export interface IsekaiModule {
  id: string;
  name: string;
  icon: IconName;
  accent: 'teal' | 'amber' | 'violet' | 'green' | 'azure' | 'rose';
  tagline: I18nText;
  body: I18nText;
  /** Public repository, when there is one. */
  repo?: string;
  highlights: I18nText[];
}

export const ISEKAI_MODULES: IsekaiModule[] = [
  {
    id: 'core',
    name: 'Isekai Core',
    icon: 'cube',
    accent: 'azure',
    tagline: {
      en: 'The shared foundation every other module builds on.',
      'zh-cn': '其余所有模块共用的底层。',
    },
    body: {
      en: 'Common API surface for the whole series: registries, networking helpers, capability hooks and the shared UI toolkit. Nothing ships without it.',
      'zh-cn':
        '整个系列共用的 API 层：注册表、网络辅助、能力接口，以及共享的界面工具。其它模块都依赖它。',
    },
    highlights: [
      { en: 'Cross-module registries', 'zh-cn': '跨模块注册表' },
      { en: 'Hunger & regeneration hooks', 'zh-cn': '饱食与恢复接口' },
      { en: 'Shared ModernUI toolkit', 'zh-cn': '共享 ModernUI 组件' },
    ],
  },
  {
    id: 'expansion',
    name: 'Isekai Expansion',
    icon: 'sword',
    accent: 'teal',
    repo: 'https://github.com/Kzeroko/IsekaiExpansion',
    tagline: {
      en: 'The gameplay module — combat, gear, skills, quests and NPCs.',
      'zh-cn': '玩法主模块——战斗、装备、技能、任务与 NPC。',
    },
    body: {
      en: 'The largest module by far. It bridges Origins, PlayerEx, Spell Engine, Better Combat and Puffish Skills into one progression, then adds forgery, gem sockets, dungeons, reputation, quests and the NPC framework on top. Isekai Structures has been merged into it — every settlement, dungeon and ruin now ships here.',
      'zh-cn':
        '体量最大的模块。它把 Origins、PlayerEx、Spell Engine、Better Combat 与 Puffish Skills 串成同一条成长线，再往上加锻造、宝石镶嵌、地下城、声望、任务与 NPC 框架。原本独立的 Isekai Structures 已经合并进本体，城镇、地下城与遗迹现在都由它提供。',
    },
    highlights: [
      { en: 'Attributes, effects & spell schools', 'zh-cn': '属性、状态与法术学派' },
      { en: 'Forgery, blueprints & gem sockets', 'zh-cn': '锻造、蓝图与宝石镶嵌' },
      { en: 'Quests, dialogue & reputation', 'zh-cn': '任务、对话与声望' },
      {
        en: 'Original settlements, dungeons & ruins (formerly Isekai Structures)',
        'zh-cn': '原创聚落、地下城与遗迹（原 Isekai Structures）',
      },
    ],
  },
  {
    id: 'tweaks',
    name: 'Isekai Tweaks',
    icon: 'wrench',
    accent: 'violet',
    tagline: {
      en: 'Mixin work that makes 268 mods behave like one game.',
      'zh-cn': '用 Mixin 让 268 个模组表现得像同一个游戏。',
    },
    body: {
      en: 'Cross-mod patches, balance corrections and the fixes that belong to no single mod. If a change needs to touch two mods at once, it lives here.',
      'zh-cn':
        '跨模组的修补、数值校正，以及那些不属于任何单个模组的修复。凡是要同时动两个模组的东西都放在这里。',
    },
    highlights: [
      { en: 'Cross-mod compatibility patches', 'zh-cn': '跨模组兼容修补' },
      { en: 'Balance and pacing corrections', 'zh-cn': '数值与节奏校正' },
      { en: 'Quality-of-life behaviour', 'zh-cn': '体验向的行为调整' },
    ],
  },
  {
    id: 'cuisine',
    name: 'Isekai Cuisine',
    icon: 'bowl',
    accent: 'green',
    tagline: {
      en: 'Food, drink and fishing — the part of survival that is pleasant.',
      'zh-cn': '食物、饮品与钓鱼——生存里让人开心的那部分。',
    },
    body: {
      en: 'Dishes and drinks that feed the Comfort system, a fishing module, and compatibility with most Farmer’s Delight recipes. Eating the same bread for a week stops helping.',
      'zh-cn':
        '与舒适度系统联动的菜品与饮料、一套钓鱼模块，以及对绝大多数农夫乐事配方的兼容。连吃一周同样的面包，效果会越来越差。',
    },
    highlights: [
      { en: 'Comfort-aware dishes', 'zh-cn': '影响舒适度的菜品' },
      { en: 'Fishing module', 'zh-cn': '钓鱼模块' },
      { en: "Farmer's Delight compatibility", 'zh-cn': '农夫乐事兼容' },
    ],
  },
  {
    id: 'melody',
    name: 'Isekai Melody',
    icon: 'music',
    accent: 'rose',
    tagline: {
      en: 'A soundtrack that knows where you are standing.',
      'zh-cn': '会分辨你站在哪里的配乐。',
    },
    body: {
      en: 'Replaces the vanilla soundtrack and gives structures their own themes, so entering a place is something you hear before you read it. Tracks are used under CC BY 4.0; see the module CREDITS file.',
      'zh-cn':
        '替换原版配乐，并为不同结构配置专属主题——进入一个地方，先听见，再看清。使用的曲目遵循 CC BY 4.0 协议，详见模块内的 CREDITS 文件。',
    },
    highlights: [
      { en: 'Full soundtrack override', 'zh-cn': '完整配乐替换' },
      { en: 'Per-structure themes', 'zh-cn': '结构专属主题曲' },
      { en: 'CC BY 4.0 attribution', 'zh-cn': 'CC BY 4.0 署名' },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Roadmap                                                                     */
/* -------------------------------------------------------------------------- */

export type RoadmapStage = 'now' | 'next' | 'later';

export interface RoadmapItem {
  stage: RoadmapStage;
  title: I18nText;
  body: I18nText;
}

export const ROADMAP: RoadmapItem[] = [
  {
    stage: 'now',
    title: { en: 'NPC & dialogue overhaul', 'zh-cn': 'NPC 与对话系统重做' },
    body: {
      en: 'Branching dialogue, emotions, followers and city routines, all running on one data-driven schema rather than hand-wired scripts.',
      'zh-cn':
        '分支对话、情绪表现、同伴跟随与城市作息，全部跑在同一套数据驱动的结构上，而不是零散的硬编码脚本。',
    },
  },
  {
    stage: 'now',
    title: { en: 'Immersive crafting', 'zh-cn': '沉浸式制作' },
    body: {
      en: 'Metallurgy and alchemy that happen in the world instead of a 3×3 grid. Forgery and blueprint research are the first two pieces already in.',
      'zh-cn':
        '把冶金与炼金放回世界里，而不是塞进 3×3 的合成格。锻造与蓝图研究是已经落地的前两块。',
    },
  },
  {
    stage: 'now',
    title: { en: 'UI & readability pass', 'zh-cn': '界面与可读性打磨' },
    body: {
      en: 'Upgrade stations, skill requirements and customisation screens rebuilt so the numbers you need are the ones on screen.',
      'zh-cn': '重做强化台、技能需求与自定义界面，让你需要的数值就摆在屏幕上。',
    },
  },
  {
    stage: 'next',
    title: { en: 'Skill tree depth', 'zh-cn': '技能树纵深' },
    body: {
      en: 'More branch variety and real interdependencies between nodes, gated by level, adventurer rank and born-with talents.',
      'zh-cn': '更多分支形态，以及节点之间真正的互相牵制，按等级、冒险者位阶与先天天赋解锁。',
    },
  },
  {
    stage: 'next',
    title: { en: 'Endgame itemisation', 'zh-cn': '终局装备' },
    body: {
      en: 'Higher-tier blueprints, artifact relics and armour sets with identities of their own instead of a flat stat increase.',
      'zh-cn': '更高阶的蓝图、遗物级道具与拥有独立定位的防具套装，而不是只有数值往上叠。',
    },
  },
  {
    stage: 'next',
    title: { en: 'Hybrid build support', 'zh-cn': '混合流派支持' },
    body: {
      en: 'Spells and gear designed specifically to bridge martial and magic play, so the middle of the build space stops being a trap.',
      'zh-cn': '专门为衔接武技与魔法而设计的法术和装备，让中间路线不再是陷阱选项。',
    },
  },
  {
    stage: 'later',
    title: { en: 'Gem synergy', 'zh-cn': '宝石联动' },
    body: {
      en: 'More elemental procs, deeper curse interactions and per-slot socket profile tuning.',
      'zh-cn': '更多元素触发、更深的诅咒交互，以及按槽位细调的镶嵌规则。',
    },
  },
  {
    stage: 'later',
    title: { en: 'Economy & loot', 'zh-cn': '经济与掉落' },
    body: {
      en: 'A broader crafting economy and rare drop tables that hold up through late game, priced against the WorldDict economy design.',
      'zh-cn': '更完整的制作经济与能撑到后期的稀有掉落表，价格对齐 WorldDict 的经济设计。',
    },
  },
  {
    stage: 'later',
    title: { en: 'Combat pacing', 'zh-cn': '战斗节奏' },
    body: {
      en: 'Continuous tuning of weapon attributes, mob behaviour and animation weight to match how the pack actually plays.',
      'zh-cn': '持续调整武器属性、怪物行为与动作手感，让它贴合整合包真正的游玩节奏。',
    },
  },
];
