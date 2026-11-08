import { FA_PROXY_HAIR } from './fa_proxy_hair_catalog';

const proxyIds = FA_PROXY_HAIR.map(([id]) => id);
const proxyIdsA = FA_PROXY_HAIR.filter(([, , bodyA]) => bodyA).map(([id]) => id);
export const FA_PROXY_HAIR_LABELS = new Map<string, string>(
  FA_PROXY_HAIR.map(([id, label]) => [id, label]),
);
export const FA_EXTRA_HAIR_IDS = ['fa_buzz', 'fa_long', 'fa_bob', ...proxyIds] as const;
export type FaReleaseHairId = 'undercut' | 'topknot' | 'bald' | (typeof FA_EXTRA_HAIR_IDS)[number];
type Fit = 'male' | 'female';

const common = ['undercut', 'topknot', 'fa_buzz', 'fa_long'] as const;
const styles: Record<Fit, readonly FaReleaseHairId[]> = {
  male: [...common, ...proxyIdsA, 'bald'],
  female: [...common, 'fa_bob', ...proxyIds, 'bald'],
};

export function faReleaseHairStyles(fit: Fit): readonly FaReleaseHairId[] {
  return styles[fit];
}

/** Older records keep the appearance they had before these IDs were added. */
export function faReleaseHairId(fit: Fit, hair: unknown): FaReleaseHairId {
  const available = styles[fit].find((id) => id === hair);
  if (available) return available;
  return hair === 'bob' || fit === 'male' ? 'undercut' : 'topknot';
}
