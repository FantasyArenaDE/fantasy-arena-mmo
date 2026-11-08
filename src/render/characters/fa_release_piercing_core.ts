export const FA_RELEASE_EAR_PIERCING_LABELS = {
  none: 'auth.earNone',
  lobes: 'auth.earStud',
  ears: 'auth.earHoop',
  fa_moon: 'auth.earMoon',
  fa_star: 'auth.earMoonstar',
  fa_rune: 'auth.earRunic',
  fa_drop: 'auth.earChain',
  fa_cuff: 'auth.earCuff',
  fa_feather: 'auth.earFeather',
  fa_bone: 'auth.earBone',
  fa_bone_hoop: 'auth.earBonehoop',
} as const;

export type FaReleaseEarPiercingId = keyof typeof FA_RELEASE_EAR_PIERCING_LABELS;
export const FA_RELEASE_EAR_PIERCING_IDS = Object.keys(
  FA_RELEASE_EAR_PIERCING_LABELS,
) as FaReleaseEarPiercingId[];
export const FA_RELEASE_NOSE_PIERCING_IDS = ['none', 'septum'] as const;
export const FA_RELEASE_PIERCING_IDS = [...FA_RELEASE_EAR_PIERCING_IDS, 'septum'] as const;

export type FaReleaseNosePiercingId = (typeof FA_RELEASE_NOSE_PIERCING_IDS)[number];
export type FaReleasePiercingId = (typeof FA_RELEASE_PIERCING_IDS)[number];

export function faReleaseEarPiercingId(value: unknown): FaReleaseEarPiercingId {
  return typeof value === 'string' && Object.hasOwn(FA_RELEASE_EAR_PIERCING_LABELS, value)
    ? (value as FaReleaseEarPiercingId)
    : 'none';
}

/** Characters saved before the two slots used headPiercing for their septum ring. */
export function faReleaseNosePiercingId(
  headPiercing: unknown,
  nosePiercing?: unknown,
): FaReleaseNosePiercingId {
  const value = nosePiercing === undefined ? headPiercing : nosePiercing;
  return value === 'septum' ? 'septum' : 'none';
}

/** Older looks may name a style that has no equivalent in the release rig. */
export function faReleasePiercingId(value: unknown): FaReleasePiercingId {
  return value === 'septum' ? value : faReleaseEarPiercingId(value);
}
