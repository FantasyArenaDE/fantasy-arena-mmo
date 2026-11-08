/** Exact CC0 KayKit baselines for the six Hollow building identities. */
export const HOLLOW_HOUSE_BASES = {
  kmedHomeA: '/models/biome/hexb_home_a.glb',
  kmedHomeB: '/models/biome/hexb_home_b.glb',
  kmedTavern: '/models/biome/hexb_tavern.glb',
  kmedChurch: '/models/biome/hex_church.glb',
  kmedBlacksmith: '/models/biome/hex_blacksmith.glb',
  kmedMarket: '/models/biome/hexb_market.glb',
} as const;

export const HOLLOW_PALETTE_URL = '/fantasy-arena/hollow-palette.png';

export function isHollowHouseKey(key: string): key is keyof typeof HOLLOW_HOUSE_BASES {
  return Object.hasOwn(HOLLOW_HOUSE_BASES, key);
}
