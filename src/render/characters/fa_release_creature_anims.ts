/** Exact CC0-derived animation banks, rebuilt from their own creature rigs. */
const NAMES = [
  'bear_ability_anims',
  'yeti_ability_anims',
  'murloc_ability_anims',
  'troll_ability_anims',
  'demon_ability_anims',
  'demon_flying_anims',
  'nightkin_ability_anims',
  'ghost_ability_anims',
  'glub_ability_anims',
  'elemental_ability_anims',
  'dragonkin_ability_anims',
  'kobold_ability_anims',
  'treant_ability_anims',
  'yetialt_hit_variety_anims',
  'frog_hit_variety_anims',
  'orc_hit_variety_anims',
  'demonalt_hit_variety_anims',
  'goblin_hit_variety_anims',
  'yeti_hit_variety_anims',
] as const;

export const FA_RELEASE_CREATURE_ANIMS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    NAMES.map((name) => [
      `models/creatures/${name}.glb`,
      `/models/creatures/fantasy-arena/animations/${name}.glb`,
    ]),
  ),
);

export function faReleaseCreatureAnimationSource(url: string, enabled: boolean): string {
  const logical = url.replace(/^\/+/, '');
  return enabled && Object.hasOwn(FA_RELEASE_CREATURE_ANIMS, logical)
    ? FA_RELEASE_CREATURE_ANIMS[logical]
    : url;
}
