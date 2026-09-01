import type { LocaleCode } from '../i18n';

/**
 * KTM2 experience curves.
 *
 * Stored as "experience required to reach the next level", indexed from the
 * first level of each track. Cumulative totals are derived rather than typed
 * out, so the two columns can never drift apart.
 *
 * Regular runs are generated (`ramp`) and irregular tails are literal, which
 * keeps the intent of each segment visible instead of burying it in 100 rows.
 */

/** Inclusive arithmetic run: `ramp(100, 1300, 50)` -> 100, 150, … 1300. */
function ramp(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let value = from; value <= to; value += step) out.push(value);
  return out;
}

/** Repeats each value in `values` `times` times, in order. */
function repeat(values: number[], times: number): number[] {
  return values.flatMap((value) => Array<number>(times).fill(value));
}

export interface LevelRow {
  level: number;
  /** Experience needed to reach the next level. 0 marks the cap. */
  next: number;
  /** Cumulative experience needed to reach this level. */
  total: number;
}

function toRows(steps: number[], startLevel = 1): LevelRow[] {
  let total = 0;
  return steps.map((next, index) => {
    const row = { level: startLevel + index, next, total };
    total += next;
    return row;
  });
}

/* ------------------------------------------------------------- player -- */

const PLAYER_STEPS = [
  ...ramp(100, 1300, 50), // 1–25: gentle, one new level per short session
  ...ramp(1500, 6400, 100), // 26–75: the long mid-game plateau
  6770, 7150, 7520, 7890, 8270, 8640, 9010, 9390, 9760, 10130, 10510, 10880, 11250, 11630, 12000, // 76–90
  12890, 13780, 14670, 15560, 16440, 17330, 18220, 19110, 20000, // 91–99
  0, // 100 — cap
];

/* ---------------------------------------------------------- equipment -- */

const EQUIPMENT_STEPS = [
  ...repeat([100], 2), // 1–2
  ...repeat([150], 2), // 3–4
  ...repeat([200], 3), // 5–7
  ...repeat([250], 2), // 8–9
  ...repeat([300], 3), // 10–12
  ...repeat([350], 2), // 13–14
  ...repeat([400], 3), // 15–17
  ...repeat([450], 2), // 18–19
  ...repeat([500], 3), // 20–22
  ...repeat([550], 2), // 23–24
  600, // 25
  700, 850, 1050, 1200, 1400, 1600, 1750, 1950, 2100, 2300, // 26–35
  2500, 2650, 2850, 3000, 3200, 3400, 3550, 3750, 3900, 4100, // 36–45
  4300, 4450, 4650, 4800, 5000, // 46–50
  ...ramp(5400, 15000, 400), // 51–75
  16350, 17650, 19000, 20350, 21650, 23000, 24350, 25650, 27000, 28350, 29650, 31000, 32350, 33650, 35000, // 76–90
  38900, 42800, 46650, 50550, 54450, 58350, 62200, 66100, 70000, // 91–99
  0, // 100 — cap
];

/* --------------------------------------------------------- adventurer -- */

const ADVENTURER_STEPS = [1200, 2000, 3100, 4700, 7300, 11300, 17500, 27000, 0];

/* ------------------------------------------------------------ affinity -- */

const AFFINITY_STEPS = [50, 100, 150, 200, 300, 450, 600, 750, 1200, 1650, 2100, 0];

/** Named affinity stages, keyed by the level each one begins at. */
const AFFINITY_TIERS: Record<number, Record<LocaleCode, string>> = {
  0: { en: 'Acquainted', 'zh-cn': '初识' },
  4: { en: 'Friendly', 'zh-cn': '并肩' },
  8: { en: 'Trusted', 'zh-cn': '交心' },
  11: { en: 'Pledged', 'zh-cn': '盟誓' },
};

/* -------------------------------------------------------------- export -- */

export interface LevelTrack {
  id: 'player' | 'equipment' | 'adventurer' | 'affinity';
  label: Record<LocaleCode, string>;
  note: Record<LocaleCode, string>;
  rows: LevelRow[];
  /** Rows to surface in the compact view; the rest sit behind a disclosure. */
  milestoneEvery: number;
  /** Named stages for tracks that have them, keyed by starting level. */
  tiers?: Record<number, Record<LocaleCode, string>>;
}

export const LEVEL_TRACKS: LevelTrack[] = [
  {
    id: 'player',
    label: { en: 'Player level', 'zh-cn': '玩家等级' },
    note: {
      en: 'Caps at 100. Gates skill tree nodes, identity progression and most gear requirements.',
      'zh-cn': '上限 100 级。技能树节点、身份进阶与大多数装备需求都以它为门槛。',
    },
    rows: toRows(PLAYER_STEPS),
    milestoneEvery: 10,
  },
  {
    id: 'equipment',
    label: { en: 'Equipment level', 'zh-cn': '装备等级' },
    note: {
      en: 'Per-item. Unlocks socket slots that are locked below their minimum item level.',
      'zh-cn': '每件装备各自计算。会解锁那些低于最低物品等级时被锁住的镶嵌槽。',
    },
    rows: toRows(EQUIPMENT_STEPS),
    milestoneEvery: 10,
  },
  {
    id: 'adventurer',
    label: { en: 'Adventurer rank', 'zh-cn': '冒险者位阶' },
    note: {
      en: 'Starts at 0 and becomes rank 1 once the guild registers you. Gates commissions, districts and some skill tree branches.',
      'zh-cn': '从 0 开始，被公会正式登记后成为 1 阶。它决定你能接的委托、能进的区域，以及部分技能树分支。',
    },
    rows: toRows(ADVENTURER_STEPS, 0),
    milestoneEvery: 1,
  },
  {
    id: 'affinity',
    label: { en: 'NPC affinity', 'zh-cn': 'NPC 好感' },
    note: {
      en: 'Per-character. Deeper stages change what a companion is willing to tell you, not how much damage she does.',
      'zh-cn': '每位角色单独计算。阶段变深改变的是她愿意告诉你的事，而不是她的输出数值。',
    },
    rows: toRows(AFFINITY_STEPS, 0),
    milestoneEvery: 1,
    tiers: AFFINITY_TIERS,
  },
];
