/** Only these five rig-specific hit banks are regenerated from individually
 * verified CC0 KayKit bodies. The logical URLs remain the cache keys. */
export const FA_RELEASE_KAYKIT_HIT: Readonly<Record<string, string>> = Object.fromEntries(
  ['mage', 'rogue_hooded', 'barbarian', 'knight', 'rogue'].map((name) => [
    `models/chars/players/${name}_hit_variety_anims.glb`,
    `models/chars/fantasy-arena/kaykit-hit/${name}.glb`,
  ]),
);

export function faReleaseKaykitHitSource(url: string, enabled: boolean): string {
  if (!enabled) return url;
  const key = url.replace(/^\/+/, '');
  return Object.hasOwn(FA_RELEASE_KAYKIT_HIT, key) ? FA_RELEASE_KAYKIT_HIT[key] : url;
}

/** Regenerated from three individually traced, hash-pinned KayKit EXTRA bodies. */
export const FA_RELEASE_KAYKIT_EXTRA_ANIMS: Readonly<Record<string, string>> = {
  'models/chars/players/druid_hit_variety_anims.glb':
    'models/chars/fantasy-arena/kaykit-extra-anims/druid-hit.glb',
  'models/chars/players/druid_ability_anims.glb':
    'models/chars/fantasy-arena/kaykit-extra-anims/druid-ability.glb',
  'models/chars/enemies/necromancer_hit_variety_anims.glb':
    'models/chars/fantasy-arena/kaykit-extra-anims/necromancer-hit.glb',
  'models/chars/enemies/skeleton_golem_anims.glb':
    'models/chars/fantasy-arena/kaykit-extra-anims/golem-ability.glb',
};

export function faReleaseKaykitExtraSource(url: string, enabled: boolean): string {
  if (!enabled) return url;
  const key = url.replace(/^\/+/, '');
  return Object.hasOwn(FA_RELEASE_KAYKIT_EXTRA_ANIMS, key)
    ? FA_RELEASE_KAYKIT_EXTRA_ANIMS[key]
    : url;
}
