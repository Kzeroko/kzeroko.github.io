import type { ImageMetadata } from 'astro';

import type { LocaleCode } from '../i18n';

import arcane from '../assets/images/ktm2/wiki/element/arcane.png';
import astral from '../assets/images/ktm2/wiki/element/astral.png';
import blast from '../assets/images/ktm2/wiki/element/blast.png';
import common from '../assets/images/ktm2/wiki/element/common.png';
import dark from '../assets/images/ktm2/wiki/element/dark.png';
import dragon from '../assets/images/ktm2/wiki/element/dragon.png';
import earth from '../assets/images/ktm2/wiki/element/earth.png';
import fire from '../assets/images/ktm2/wiki/element/fire.png';
import frost from '../assets/images/ktm2/wiki/element/frost.png';
import light from '../assets/images/ktm2/wiki/element/light.png';
import lightning from '../assets/images/ktm2/wiki/element/lightning.png';
import shard from '../assets/images/ktm2/wiki/element/shard.png';
import soul from '../assets/images/ktm2/wiki/element/soul.png';
import water from '../assets/images/ktm2/wiki/element/water.png';
import wind from '../assets/images/ktm2/wiki/element/wind.png';

/**
 * Elemental affinity table.
 *
 * A creature carries one or more *defence* elements. Damage is then scaled by
 * how the incoming *damage type* relates to each of them. Damage types are a
 * superset of defence elements: `blast`, `lightning`, `melee`, `execute`,
 * `heal`, `wither`, `thorns` and `trident` deal damage but are never worn.
 */

export type DamageType =
  | 'common'
  | 'dragon'
  | 'shard'
  | 'arcane'
  | 'fire'
  | 'water'
  | 'frost'
  | 'wind'
  | 'earth'
  | 'soul'
  | 'astral'
  | 'light'
  | 'dark'
  | 'lightning'
  | 'blast'
  | 'flame'
  | 'melee'
  | 'execute'
  | 'heal'
  | 'wither'
  | 'thorns'
  | 'trident'
  | 'all';

export const DAMAGE_LABELS: Record<DamageType, Record<LocaleCode, string>> = {
  common: { en: 'Normal', 'zh-cn': '普通' },
  dragon: { en: 'Dragon', 'zh-cn': '龙' },
  shard: { en: 'Shard', 'zh-cn': '碎片' },
  arcane: { en: 'Arcane', 'zh-cn': '奥术' },
  fire: { en: 'Fire', 'zh-cn': '火' },
  water: { en: 'Water', 'zh-cn': '水' },
  frost: { en: 'Frost', 'zh-cn': '冰霜' },
  wind: { en: 'Wind', 'zh-cn': '风' },
  earth: { en: 'Earth', 'zh-cn': '地' },
  soul: { en: 'Soul', 'zh-cn': '灵魂' },
  astral: { en: 'Astral', 'zh-cn': '星界' },
  light: { en: 'Light', 'zh-cn': '光' },
  dark: { en: 'Dark', 'zh-cn': '暗' },
  lightning: { en: 'Lightning', 'zh-cn': '雷' },
  blast: { en: 'Blast', 'zh-cn': '爆炸' },
  flame: { en: 'Flame', 'zh-cn': '灼烧' },
  melee: { en: 'Melee', 'zh-cn': '近战' },
  execute: { en: 'Execute', 'zh-cn': '处决' },
  heal: { en: 'Healing', 'zh-cn': '治疗' },
  wither: { en: 'Wither', 'zh-cn': '凋零' },
  thorns: { en: 'Thorns', 'zh-cn': '荆棘' },
  trident: { en: 'Trident', 'zh-cn': '三叉戟' },
  all: { en: 'Everything else', 'zh-cn': '其它全部' },
};

const ICONS: Partial<Record<DamageType, ImageMetadata>> = {
  arcane,
  astral,
  blast,
  common,
  dark,
  dragon,
  earth,
  fire,
  frost,
  light,
  lightning,
  shard,
  soul,
  water,
  wind,
};

export function elementIcon(type: DamageType): ImageMetadata | undefined {
  return ICONS[type];
}

export interface DefenceElement {
  id: DamageType;
  /** Damage types that gain the +25% bonus against this element. */
  strong: DamageType[];
  /** Damage types that take the -25% penalty against this element. */
  weak: DamageType[];
  /** Short reading of what the element behaves like, shown under the row. */
  note?: Record<LocaleCode, string>;
}

export const DEFENCE_ELEMENTS: DefenceElement[] = [
  {
    id: 'common',
    strong: ['astral'],
    weak: [],
    note: {
      en: 'The default. Almost everything hits it for exactly its listed damage.',
      'zh-cn': '默认属性。几乎所有攻击都按面板数值原样打上去。',
    },
  },
  {
    id: 'dragon',
    strong: ['dragon'],
    weak: ['all'],
    note: {
      en: 'Only dragon damage gets through cleanly. Bring the right weapon or bring patience.',
      'zh-cn': '只有龙属性伤害能干净地打进去。要么带对武器，要么带够耐心。',
    },
  },
  {
    id: 'shard',
    strong: ['soul', 'blast'],
    weak: ['trident', 'thorns', 'melee', 'earth'],
    note: {
      en: 'Armour-like. Physical pressure bounces; concussive and soul damage do not.',
      'zh-cn': '类似护甲。物理压制会被弹开，但冲击与灵魂伤害不会。',
    },
  },
  {
    id: 'arcane',
    strong: ['arcane', 'astral'],
    weak: [],
    note: {
      en: 'Resists non-magical "magic" such as poison, and melee-flavoured spells.',
      'zh-cn': '对毒素这类非魔法性的「魔法」，以及近战型法术具有抗性。',
    },
  },
  { id: 'fire', strong: ['water', 'frost'], weak: ['fire', 'flame', 'wind', 'blast'] },
  { id: 'water', strong: ['frost', 'lightning'], weak: ['fire', 'flame', 'water', 'melee'] },
  {
    id: 'frost',
    strong: ['melee', 'execute', 'fire', 'flame'],
    weak: ['lightning', 'frost', 'wind', 'water'],
    note: {
      en: 'Brittle. Straight physical force shatters it as readily as heat.',
      'zh-cn': '脆。直接的物理冲击和高温一样能把它打碎。',
    },
  },
  { id: 'wind', strong: ['fire', 'flame'], weak: ['thorns', 'lightning', 'melee'] },
  {
    id: 'earth',
    strong: ['blast', 'earth'],
    weak: ['trident', 'thorns', 'melee', 'common', 'wind', 'lightning'],
  },
  {
    id: 'soul',
    strong: ['light', 'dark', 'heal'],
    weak: ['soul', 'execute', 'melee', 'common', 'thorns', 'astral'],
    note: {
      en: 'Healing hurts it. Undead and spectral enemies usually carry this.',
      'zh-cn': '治疗对它是伤害。不死与幽灵类敌人通常带这个属性。',
    },
  },
  { id: 'astral', strong: ['soul'], weak: ['light', 'dark', 'arcane'] },
  {
    id: 'light',
    strong: ['dark', 'wither'],
    weak: ['all'],
    note: {
      en: 'Only its opposite lands. Everything else is shrugged off.',
      'zh-cn': '只有对立属性能打进去，其余一概被无视。',
    },
  },
  {
    id: 'dark',
    strong: ['light', 'heal'],
    weak: ['all'],
    note: {
      en: 'Same rule as Light, mirrored — and healing is a weapon against it.',
      'zh-cn': '与光属性镜像的规则，而且治疗对它是一种武器。',
    },
  },
];
