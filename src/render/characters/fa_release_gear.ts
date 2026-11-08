/** Explicit replacements for the 84 rights-reserved weapon URLs in the launch manifest.
 * Model identity stays logical, so existing hand, grip, item size and slot rules still apply.
 * Entries were checked against the held-model family and item tables; unknown URLs never map. */
const GROUPS: ReadonlyArray<readonly [string, readonly string[]]> = [
  [
    'iron-axe',
    [
      'axe_field_bronze',
      'axe_field_iron',
      'axe_field_steel',
      'axe_rare_a_ember',
      'axe_rare_a_teal',
      'axe_rare_a_violet',
      'axe_rare_b_ember',
      'axe_starter',
    ],
  ],
  ['hunting-crossbow', ['crossbow_starter']],
  [
    'iron-dagger',
    [
      'dagger_epic_dragonfang_ivory_violet',
      'dagger_field_bronze',
      'dagger_field_iron',
      'dagger_field_steel',
      'dagger_rare_a_bone',
      'dagger_rare_a_ember',
      'dagger_rare_a_frost',
      'dagger_rare_a_teal',
      'dagger_rare_a_violet',
      'dagger_rare_b_ember',
      'dagger_rare_b_teal',
      'dagger_rare_b_violet',
      'dagger_starter',
    ],
  ],
  [
    'iron-mace',
    [
      'hammer_field_2h_iron',
      'hammer_field_2h_steel',
      'hammer_field_bronze',
      'hammer_field_iron',
      'hammer_field_steel',
      'hammer_rare_a_ember',
      'hammer_rare_a_teal',
      'hammer_rare_b_ember',
      'hammer_rare_b_teal',
      'hammer_rare_b_violet',
      'hammer_starter',
    ],
  ],
  [
    'wooden-shield',
    [
      'shield_field_steel',
      'shield_rare_a_crucible',
      'shield_rare_a_dawn',
      'shield_rare_a_deepice',
      'shield_rare_a_glacier',
      'shield_rare_a_teal',
      'shield_rare_a_violet',
      'shield_rare_b_ember',
      'shield_rare_b_teal',
      'shield_rare_b_violet',
      'shield_starter',
    ],
  ],
  ['spear', ['spear_field_iron', 'spear_rare_a_teal', 'spear_rare_b_ember']],
  ['bound-spellbook', ['spellbook_starter']],
  [
    'ash-staff',
    [
      'staff_epic_hexwood_basin_turquoise',
      'staff_field_bronze',
      'staff_field_iron',
      'staff_field_steel',
      'staff_rare_a_ember',
      'staff_rare_a_obsidian',
      'staff_rare_a_teal',
      'staff_rare_a_violet',
      'staff_rare_b_ember',
      'staff_rare_b_teal',
      'staff_rare_b_violet',
      'staff_starter',
    ],
  ],
  [
    'iron-sword',
    [
      'sword_epic_deathless_crucible_heart',
      'sword_field_2h_iron',
      'sword_field_2h_steel',
      'sword_field_bronze',
      'sword_field_iron',
      'sword_field_steel',
      'sword_rare_a_anvil',
      'sword_rare_a_ember',
      'sword_rare_a_ivory',
      'sword_rare_a_jade',
      'sword_rare_a_molten',
      'sword_rare_a_royal',
      'sword_rare_a_spectral',
      'sword_rare_a_teal',
      'sword_rare_a_violet',
      'sword_rare_b_ember',
      'sword_rare_b_teal',
      'sword_rare_b_violet',
      'sword_starter',
    ],
  ],
  [
    'wand',
    [
      'wand_field_iron',
      'wand_field_steel',
      'wand_rare_a_teal',
      'wand_rare_b_ember',
      'wand_rare_b_violet',
    ],
  ],
];

export const FA_RELEASE_GEAR: Readonly<Record<string, string>> = Object.fromEntries(
  GROUPS.flatMap(([replacement, names]) =>
    names.map((name) => [
      `models/weapons/${name}.glb`,
      `models/weapons/fantasy-arena/${replacement}.glb`,
    ]),
  ),
);

/** Additional individually audited models from the release boot trace. Unlike the
 * 84 above, these are not asserted to be members of the reserved weapon set. */
export const FA_RELEASE_ADDITIONAL_GEAR: Readonly<Record<string, string>> = {
  'models/weapons/hoard_forge_maul.glb': 'models/weapons/fantasy-arena/greatmaul.glb',
  'models/weapons/knotted_oak_stave.glb': 'models/weapons/fantasy-arena/ash-staff.glb',
  'models/weapons/notched_woodaxe.glb': 'models/weapons/fantasy-arena/iron-axe.glb',
  'models/weapons/whittler_s_knife.glb': 'models/weapons/fantasy-arena/iron-dagger.glb',
  'models/weapons/craterglass_stave.glb': 'models/weapons/fantasy-arena/ash-staff.glb',
  'models/weapons/hammer_varkhul.glb': 'models/weapons/fantasy-arena/iron-mace.glb',
  'models/weapons/tome_silverleaf.glb': 'models/weapons/fantasy-arena/bound-spellbook.glb',
  'models/weapons/tome_goldleaf.glb': 'models/weapons/fantasy-arena/bound-spellbook.glb',
  'models/weapons/tome_sunpetal.glb': 'models/weapons/fantasy-arena/bound-spellbook.glb',
  'models/weapons/tome_voidbound.glb': 'models/weapons/fantasy-arena/bound-spellbook.glb',
  'models/weapons/varkhul_emberward.glb': 'models/weapons/fantasy-arena/wooden-shield.glb',
};

export const FA_RELEASE_TWO_HAND_MODELS = [
  'models/weapons/fantasy-arena/greatsword.glb',
  'models/weapons/fantasy-arena/greataxe.glb',
  'models/weapons/fantasy-arena/greatmaul.glb',
] as const;

const TWO_HAND_BY_SINGLE: Readonly<Record<string, string>> = {
  'models/weapons/fantasy-arena/iron-sword.glb': FA_RELEASE_TWO_HAND_MODELS[0],
  'models/weapons/fantasy-arena/iron-axe.glb': FA_RELEASE_TWO_HAND_MODELS[1],
  'models/weapons/fantasy-arena/iron-mace.glb': FA_RELEASE_TWO_HAND_MODELS[2],
};

const logical = (url: string): string => url.replace(/^\/+/, '');

export function faReleaseGearEnabled(): boolean {
  return import.meta.env?.VITE_FA_BROWSER_RELEASE === '1';
}

/** Remap only known reserved URLs; permitted models and ordinary builds are unchanged. */
export function faReleaseGearSource(url: string, enabled: boolean): string {
  if (!enabled) return url;
  const key = logical(url);
  return Object.hasOwn(FA_RELEASE_GEAR, key) ? FA_RELEASE_GEAR[key] : url;
}

export function faReleaseAdditionalGearSource(url: string, enabled: boolean): string {
  if (!enabled) return url;
  const key = logical(url);
  return Object.hasOwn(FA_RELEASE_ADDITIONAL_GEAR, key) ? FA_RELEASE_ADDITIONAL_GEAR[key] : url;
}

/** An item can share its logical model with a one-hand item. Select its geometry from
 * the actual item hand, without changing the original URL used by all grip rules. */
export function faReleaseTwoHandSource(
  attachedUrl: string,
  equippedModelUrl: string | null,
  hand: string | undefined,
  enabled: boolean,
): string | null {
  if (
    !enabled ||
    hand !== 'twohand' ||
    !equippedModelUrl ||
    logical(attachedUrl) !== logical(equippedModelUrl)
  )
    return null;
  const key = logical(attachedUrl);
  const single = Object.hasOwn(FA_RELEASE_GEAR, key)
    ? FA_RELEASE_GEAR[key]
    : (FA_RELEASE_ADDITIONAL_GEAR[key] ?? null);
  return single ? (TWO_HAND_BY_SINGLE[single] ?? null) : null;
}
