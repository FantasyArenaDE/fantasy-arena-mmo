import type { PlacedTextureTier } from './placed_texture_tier_core';

export const FA_GUILD_HALL_SOURCE = '/models/tidehold/fantasy-arena/guild.glb';
const ORIGINAL_GUILD = '/models/tidehold/highwatch/guild.glb';

/** A single prototype is used for all three texture tiers; the logical URL remains the guild. */
export function faGuildHallPreviewFile(
  url: string,
  _tier: PlacedTextureTier,
  dev: boolean,
  hostname: string,
  search: string,
): string | null {
  const enabled =
    dev &&
    ['localhost', '127.0.0.1', '[::1]'].includes(hostname.toLowerCase()) &&
    new URLSearchParams(search).get('fa-guild-hall') === '1';
  return enabled && `/${url.replace(/^\/+/, '')}` === ORIGINAL_GUILD ? FA_GUILD_HALL_SOURCE : null;
}

/** The release profile uses our hall while preserving the original logical building identity. */
export function faGuildHallReleaseFile(url: string, release: boolean): string | null {
  return release && `/${url.replace(/^\/+/, '')}` === ORIGINAL_GUILD ? FA_GUILD_HALL_SOURCE : null;
}

/** Ordinary builds retain the original; the local experiment remains explicitly opt-in. */
export function faGuildHallPreviewSource(url: string, tier: PlacedTextureTier): string | null {
  const release = faGuildHallReleaseFile(url, import.meta.env?.VITE_FA_BROWSER_RELEASE === '1');
  if (release) return release;
  if (import.meta.env?.DEV !== true || typeof window === 'undefined') return null;
  return faGuildHallPreviewFile(url, tier, true, window.location.hostname, window.location.search);
}
