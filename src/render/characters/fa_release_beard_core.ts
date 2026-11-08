export const FA_RELEASE_BEARD_IDS = [
  'none',
  'moustache',
  'goatee',
  'fa_curl',
  'fa_duet',
  'fa_long',
  'fa_chops',
  'fa_chinstrap',
  'fa_boxed',
] as const;

export type FaReleaseBeardStyle = (typeof FA_RELEASE_BEARD_IDS)[number];

export function faReleaseBeardStyle(value: unknown): FaReleaseBeardStyle {
  return FA_RELEASE_BEARD_IDS.find((id) => id === value) ?? 'none';
}
