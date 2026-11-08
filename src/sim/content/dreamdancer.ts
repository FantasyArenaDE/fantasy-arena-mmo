import type { AbilityDef } from '../types';
import type { ClassDef } from './classes';
import type { RowTree } from './talent_rows';
import type { ClassTalents } from './talents';

export const DREAM_THREAD = 'dream_thread';
export const DREAM_SPARK = 'dream_spark';
export const DREAM_SHROUD = 'dream_shroud';
export const NIGHTMARE = 'dream_nightmare';
export const DEEP_NIGHTMARE = 'dream_deep_nightmare';
export const DREAM_COMFORT = 'dream_comfort';
export const DREAM_VEIL = 'dream_veil';
export const DREAM_CHORUS = 'dream_chorus';
export const DREAM_CHORUS_RADIUS = 16;
export const DREAM_MISTSTEP = 'dream_miststep';
export const DREAM_MOONREND = 'dream_moonrend';
export const DREAM_SILENCE = 'dream_silence';
export const DREAM_GLIDE = 'dream_glide';
export const DREAM_REVERIE = 'dream_reverie';
export const DREAM_REFUGE = 'dream_refuge';
export const DREAM_UNRAVEL = 'dream_unravel';
export const DREAM_REVERIE_MANA_FRACTION = 0.14;
export const DREAM_THREAD_DURATION = 15;
export const DREAM_THREAD_CAP = 3;

// Class-archetype quest rewards the Dreamdancer can attune as a Traumrute.
// The reward remains the original item, with its original progression gate and stats.
const DREAMDANCER_QUEST_WEAPONS: ReadonlySet<string> = new Set([
  'apprentice_staff', 'gravecaller_staff', 'staff_of_drowned_prayers', 'vaels_mist_staff',
  'ogre_bonecharm_staff', 'emberwood_staff', 'staff_of_velkhar', 'palecoil_rod',
  'drownedmoon_scepter', 'gleamwood_stave',
]);

export function isDreamdancerQuestWeapon(itemId: string): boolean {
  return DREAMDANCER_QUEST_WEAPONS.has(itemId);
}

export const DREAMDANCER_CLASS: ClassDef = {
  id: 'dreamdancer',
  name: 'Dreamdancer',
  baseStats: { str: 10, agi: 12, sta: 15, int: 23, spi: 22, armor: 24 },
  statsPerLevel: { str: 0, agi: 0, sta: 2, int: 3, spi: 2, armor: 4 },
  baseHp: 42,
  hpPerLevel: 15,
  baseMana: 100,
  manaPerLevel: 24,
  resourceType: 'mana',
  startWeapon: 'dreamdancer_staff',
  startOffhand: 'dreamcatcher_focus',
  startChest: 'apprentice_robe',
  startItems: [{ itemId: 'baked_bread', count: 5 }, { itemId: 'spring_water', count: 5 }],
  ranged: { min: 3, max: 6, speed: 1.8, minRange: 0, maxRange: 30, wand: true, school: 'arcane' },
  abilities: [
    DREAM_THREAD, DREAM_SPARK, DREAM_SHROUD, NIGHTMARE,
    DREAM_CHORUS, DREAM_MISTSTEP, DREAM_MOONREND,
    DREAM_SILENCE, DREAM_GLIDE, DREAM_REVERIE, DREAM_REFUGE, DREAM_UNRAVEL,
  ],
  color: 0x9ec8ef,
};

const damage = (min: number, max: number) => ({ type: 'directDamage', min, max } as const);
const heal = (min: number, max: number) => ({ type: 'heal', min, max } as const);
const shield = (amount: number) => ({
  type: 'absorb', amount, duration: 6, spellPowerCoeff: 0.25,
} as const);
const veil = (min: number, max: number) => ({
  type: 'groundAoE', min, max, radius: 5, duration: 5, interval: 1,
  slowMult: 0.7, slowDuration: 1.5,
} as const);
const chorus = (min: number, max: number) => ({
  type: 'aoeHeal', min, max, radius: DREAM_CHORUS_RADIUS, centerOnTarget: true, maxGroupTargets: 5,
} as const);
const miststep = (min: number, max: number) => ({
  type: 'groundAoE', min, max, radius: 6, duration: 3, interval: 1,
} as const);
const moonrend = (total: number) => ({ type: 'dot', total, duration: 9, interval: 3 } as const);

export const DREAMDANCER_ABILITIES: Record<string, AbilityDef> = {
  [DREAM_THREAD]: {
    id: DREAM_THREAD, class: 'dreamdancer', name: 'Dream Thread', learnLevel: 1,
    cost: 5, castTime: 0, cooldown: 0, range: 30, school: 'arcane',
    requiresTarget: true, targetType: 'any', effects: [],
    description: 'Bind one enemy for 15 sec. Dream Spark builds a strand on that enemy, up to three. Dreamkeepers can bind allies and build strands with effective Dream Comfort heals. Changing the target loses all strands. In 2v2, Nightweaver and Veilweaver damage finishers keep the target bound and reduce its healing received by 40% for 6 sec.',
  },
  [DREAM_SPARK]: {
    id: DREAM_SPARK, class: 'dreamdancer', name: 'Dream Spark', learnLevel: 1,
    cost: 18, castTime: 1.5, cooldown: 0, range: 30, school: 'shadow',
    requiresTarget: true, effects: [damage(16, 22)],
    ranks: [
      { rank: 2, level: 6, cost: 32, effects: [damage(34, 44)] },
      { rank: 3, level: 12, cost: 52, effects: [damage(66, 82)] },
      { rank: 4, level: 18, cost: 72, effects: [damage(108, 132)] },
    ],
    description: 'Deals $d Shadow damage. A damaging hit on the target of your Dream Thread adds one strand.',
  },
  [DREAM_SHROUD]: {
    id: DREAM_SHROUD, class: 'dreamdancer', name: 'Dream Shroud', learnLevel: 1,
    cost: 20, castTime: 0, cooldown: 8, range: 30, school: 'arcane',
    requiresTarget: true, targetType: 'friendly', effects: [shield(24)],
    ranks: [
      { rank: 2, level: 7, cost: 34, effects: [shield(46)] },
      { rank: 3, level: 13, cost: 52, effects: [shield(82)] },
      { rank: 4, level: 19, cost: 70, effects: [shield(124)] },
    ],
    description: 'Shields an ally for 6 sec. Consumes a full Dream Thread to double the shield’s base amount.',
  },
  [NIGHTMARE]: {
    id: NIGHTMARE, class: 'dreamdancer', name: 'Nightmare', learnLevel: 3,
    cost: 14, castTime: 0, cooldown: 6, range: 30, school: 'shadow',
    requiresTarget: true, requiresAuraKind: 'dream_thread', requiresAuraStacks: DREAM_THREAD_CAP,
    consumesRequiredAura: false, effects: [damage(42, 54)],
    ranks: [
      { rank: 2, level: 9, cost: 27, effects: [damage(75, 92)] },
      { rank: 3, level: 15, cost: 44, effects: [damage(125, 152)] },
      { rank: 4, level: 20, cost: 59, effects: [damage(171, 204)] },
    ],
    description: 'Consumes three strands to deal $d Shadow damage to your bound enemy.',
  },
  [DEEP_NIGHTMARE]: {
    id: DEEP_NIGHTMARE, class: 'dreamdancer', name: 'Deep Nightmare', learnLevel: 5,
    cost: 20, castTime: 0, cooldown: 8, range: 30, school: 'shadow',
    requiresTarget: true, requiresAuraKind: 'dream_thread', requiresAuraStacks: DREAM_THREAD_CAP,
    consumesRequiredAura: false, effects: [damage(66, 83)],
    ranks: [
      { rank: 2, level: 11, cost: 39, effects: [damage(119, 144)] },
      { rank: 3, level: 17, cost: 57, effects: [damage(180, 218)] },
    ],
    description: 'Consumes three strands to deal $d Shadow damage to your bound enemy. In 2v2, if your Moonrend is active when you cast, Deep Nightmare also deals Shadow damage over 4.5 sec.',
  },
  [DREAM_COMFORT]: {
    id: DREAM_COMFORT, class: 'dreamdancer', name: 'Dream Comfort', learnLevel: 5,
    cost: 32, castTime: 1.4, cooldown: 0, range: 30, school: 'arcane',
    requiresTarget: true, targetType: 'friendly', effects: [heal(48, 60)],
    ranks: [
      { rank: 2, level: 11, cost: 52, effects: [heal(85, 105)] },
      { rank: 3, level: 17, cost: 76, effects: [heal(162, 198)] },
    ],
    description: 'Heals an ally for $d. Effective healing on your bound ally adds one strand.',
  },
  [DREAM_VEIL]: {
    id: DREAM_VEIL, class: 'dreamdancer', name: 'Dream Veil', learnLevel: 5,
    cost: 24, castTime: 0, cooldown: 14, range: 30, school: 'shadow',
    requiresTarget: true, requiresAuraKind: 'dream_thread', requiresAuraStacks: DREAM_THREAD_CAP,
    consumesRequiredAura: false, effects: [veil(7, 10)],
    ranks: [
      { rank: 2, level: 11, cost: 41, effects: [veil(11, 15)] },
      { rank: 3, level: 17, cost: 62, effects: [veil(19, 24)] },
    ],
    description: 'Consumes three strands to create a 5-sec field at your bound enemy. Each pulse damages and slows enemies in the field. In 2v2, the bound enemy also takes an immediate hit.',
  },
  [DREAM_CHORUS]: {
    id: DREAM_CHORUS, class: 'dreamdancer', name: 'Dream Chorus', learnLevel: 5,
    specs: ['dreamkeeper'], cost: 37, castTime: 1.5, cooldown: 6, range: 30, school: 'arcane',
    requiresTarget: true, targetType: 'friendly', partyOnlyTarget: true, projectile: false,
    effects: [chorus(33, 41)],
    ranks: [
      { rank: 2, level: 11, cost: 62, effects: [chorus(49, 61)] },
      { rank: 3, level: 17, cost: 74, effects: [chorus(100, 122)] },
    ],
    description: 'Heals up to five of the most injured group members within 16 yards of the chosen ally for $d. Effective healing on your bound ally and another group member adds one strand and refunds half the Mana cost. The refund is full if at least three are healed, including the bound ally.',
  },
  [DREAM_MISTSTEP]: {
    id: DREAM_MISTSTEP, class: 'dreamdancer', name: 'Miststep', learnLevel: 5,
    specs: ['veilweaver'], cost: 25, castTime: 0, cooldown: 6, range: 30, school: 'shadow',
    requiresTarget: false, targetMode: 'position', effects: [miststep(6, 8)],
    ranks: [
      { rank: 2, level: 11, cost: 39, effects: [miststep(11, 14)] },
      { rank: 3, level: 17, cost: 51, effects: [miststep(18, 23)] },
    ],
    description: 'Weaves mist at the chosen location for 3 sec. The mist deals Shadow damage to enemies within 6 yards each second.',
  },
  [DREAM_MOONREND]: {
    id: DREAM_MOONREND, class: 'dreamdancer', name: 'Moonrend', learnLevel: 5,
    specs: ['nightweaver'], cost: 22, castTime: 0, cooldown: 6, range: 30, school: 'shadow',
    requiresTarget: true, projectile: false, effects: [moonrend(45)],
    ranks: [
      { rank: 2, level: 11, cost: 36, effects: [moonrend(99)] },
      { rank: 3, level: 17, cost: 49, effects: [moonrend(180)] },
    ],
    description: 'Rends the target with moonlight, dealing $d Shadow damage over 9 sec. In 2v2, applying it to your bound enemy adds one strand.',
  },
  [DREAM_SILENCE]: {
    id: DREAM_SILENCE, class: 'dreamdancer', name: 'Hush Thread', learnLevel: 7,
    cost: 28, castTime: 0, cooldown: 24, range: 25, school: 'arcane',
    requiresTarget: true, projectile: false, offGcd: true, usableWhileCasting: true,
    effects: [{ type: 'interrupt', lockout: 3 }],
    description: 'Interrupts the target’s spellcast and locks its spell school for 3 sec.',
  },
  [DREAM_GLIDE]: {
    id: DREAM_GLIDE, class: 'dreamdancer', name: 'Dream Glide', learnLevel: 10,
    cost: 25, castTime: 0, cooldown: 30, range: 0, school: 'arcane', requiresTarget: false,
    effects: [{ type: 'breakRoots' }, { type: 'selfBuff', kind: 'buff_speed', value: 1.35, duration: 4 }],
    description: 'Removes roots and increases your movement speed by 35% for 4 sec.',
  },
  [DREAM_REVERIE]: {
    id: DREAM_REVERIE, class: 'dreamdancer', name: 'Reverie', learnLevel: 12,
    cost: 0, castTime: 0, cooldown: 55, range: 0, school: 'arcane',
    requiresTarget: false, effects: [],
    description: 'Restores 14% of your maximum Mana.',
  },
  [DREAM_REFUGE]: {
    id: DREAM_REFUGE, class: 'dreamdancer', name: 'Moon Refuge', learnLevel: 16,
    cost: 36, castTime: 0, cooldown: 60, range: 0, school: 'arcane', requiresTarget: false,
    effects: [{ type: 'selfBuff', kind: 'buff_dr', value: 0.25, duration: 6 }],
    description: 'Reduces damage taken by 25% for 6 sec.',
  },
  [DREAM_UNRAVEL]: {
    id: DREAM_UNRAVEL, class: 'dreamdancer', name: 'Unravel', learnLevel: 20,
    cost: 55, castTime: 0, cooldown: 12, range: 30, school: 'arcane',
    requiresTarget: true, targetType: 'friendly', projectile: false,
    effects: [{ type: 'dispel', count: 1 }],
    description: 'Removes one harmful magic effect from an ally.',
  },
};

export const DREAMKEEPER_MOON_REFUGE: AbilityDef = {
  ...DREAMDANCER_ABILITIES[DREAM_REFUGE],
  offGcd: true,
  usableWhileCasting: true,
  effects: [{ type: 'selfBuff', kind: 'buff_dr', value: 0.4, duration: 6 }],
  description: 'Reduces damage taken by 40% for 6 sec. Can be used while casting and does not trigger the global cooldown.',
};

export const DREAMDANCER_TALENTS: ClassTalents = {
  class: 'dreamdancer',
  specs: [
    {
      id: 'nightweaver', class: 'dreamdancer', name: 'Nightweaver', role: 'dps', icon: 'x',
      description: 'Weave dreams around one enemy and end with a stronger Nightmare.',
      signature: DEEP_NIGHTMARE,
      mastery: { name: 'Night Rhythm', description: 'Dream Spark deals up to 10% more damage.',
        effect: { ability: [{ ability: DREAM_SPARK, dmgPct: 0.1 }] } },
    },
    {
      id: 'dreamkeeper', class: 'dreamdancer', name: 'Dreamkeeper', role: 'healer', icon: '+',
      description: 'Bind an ally, build strands through effective healing and turn them into a shield.',
      signature: DREAM_COMFORT,
      mastery: { name: 'Gentle Rhythm', description: 'Dream Comfort heals for up to 10% more.',
        effect: { ability: [{ ability: DREAM_COMFORT, dmgPct: 0.1 }] } },
    },
    {
      id: 'veilweaver', class: 'dreamdancer', name: 'Veilweaver', role: 'dps', icon: 'o',
      description: 'Cast Dream Spark while moving and weave slowing fields around bound enemies.',
      signature: DREAM_VEIL,
      mastery: { name: 'Dreamstep', description: 'Dream Spark can be cast while moving.',
        effect: { ability: [{ ability: DREAM_SPARK, castWhileMoving: true }] } },
    },
  ],
};

export const DREAMDANCER_ROWS: RowTree = [
  { level: 5, options: [
    { id: 'dream_talent_spark_cost', name: 'Light Steps', description: 'Dream Spark costs 10% less mana.', effect: { ability: [{ ability: DREAM_SPARK, costPct: -0.1 }] } },
    { id: 'dream_talent_shroud_cost', name: 'Soft Landing', description: 'Dream Shroud costs 15% less mana.', effect: { ability: [{ ability: DREAM_SHROUD, costPct: -0.15 }] } },
    { id: 'dream_talent_thread_cost', name: 'Silver Thread', description: 'Dream Thread costs no mana.', effect: { ability: [{ ability: DREAM_THREAD, costPct: -1 }] } },
  ] },
  { level: 8, options: [
    { id: 'dream_talent_spark_speed', name: 'Quick Step', description: 'Dream Spark casts 10% faster.', effect: { ability: [{ ability: DREAM_SPARK, castPct: -0.1 }] } },
    { id: 'dream_talent_shroud_cd', name: 'Second Shelter', description: 'Dream Shroud cools down 15% faster.', effect: { ability: [{ ability: DREAM_SHROUD, cooldownPct: -0.15 }] } },
    { id: 'dream_talent_nightmare_cd', name: 'Returning Dread', description: 'Both Nightmares cool down 15% faster.', effect: { ability: [{ ability: NIGHTMARE, cooldownPct: -0.15 }, { ability: DEEP_NIGHTMARE, cooldownPct: -0.15 }] } },
  ] },
  { level: 11, options: [
    { id: 'dream_talent_int', name: 'Lucid Focus', description: 'Increases Intellect by 3.', effect: { stats: { int: 3 } } },
    { id: 'dream_talent_spi', name: 'Quiet Mind', description: 'Increases Spirit by 5.', effect: { stats: { spi: 5 } } },
    { id: 'dream_talent_sta', name: 'Steady Feet', description: 'Increases Stamina by 3.', effect: { stats: { sta: 3 } } },
  ] },
  { level: 14, options: [
    { id: 'dream_talent_spark_power', name: 'Bright Spark', description: 'Dream Spark deals 8% more damage.', effect: { ability: [{ ability: DREAM_SPARK, dmgPct: 0.08 }] } },
    { id: 'dream_talent_shroud_time', name: 'Lingering Shelter', description: 'Dream Shroud lasts 2 sec longer.', effect: { ability: [{ ability: DREAM_SHROUD, durationFlat: 2 }] } },
    { id: 'dream_talent_nightmare_cost', name: 'Pale Dread', description: 'Both Nightmares cost 15% less mana.', effect: { ability: [{ ability: NIGHTMARE, costPct: -0.15 }, { ability: DEEP_NIGHTMARE, costPct: -0.15 }] } },
  ] },
  { level: 17, options: [
    { id: 'dream_talent_regen', name: 'Quiet Interval', description: 'Regenerate 8% more mana from Spirit.', effect: { global: { manaRegenPct: 0.08 } } },
    { id: 'dream_talent_armor', name: 'Woven Robe', description: 'Increases armor by 8%.', effect: { stats: { armorPct: 0.08 } } },
    { id: 'dream_talent_mana', name: 'Dream Reservoir', description: 'Increases maximum mana by 5%.', effect: { global: { manaPct: 0.05 } } },
  ] },
  { level: 20, options: [
    { id: 'dream_talent_finish', name: 'Final Flourish', description: 'Both Nightmares deal 10% more damage.', effect: { ability: [{ ability: NIGHTMARE, dmgPct: 0.1 }, { ability: DEEP_NIGHTMARE, dmgPct: 0.1 }] } },
    { id: 'dream_talent_shroud_power', name: 'Woven Shelter', description: 'Dream Shroud absorbs 12% more base damage.', effect: { ability: [{ ability: DREAM_SHROUD, buffPct: 0.12 }] } },
    { id: 'dream_talent_flow', name: 'Dancer’s Breath', description: 'Dream Spark and Dream Shroud cost 10% less mana.', effect: { ability: [{ ability: DREAM_SPARK, costPct: -0.1 }, { ability: DREAM_SHROUD, costPct: -0.1 }] } },
  ] },
];
