import { CRUCIBLE_STREAM_URLS } from './crucible_music';

/** Unmodified Scott Buckley recordings; see /audio/fantasy-arena/credits.html. */
export const FANTASY_ARENA_ADVENTURE_TRACK = '/audio/fantasy-arena/born-of-the-sky.mp3';
export const FANTASY_ARENA_COMBAT_TRACK = '/audio/fantasy-arena/song-of-the-forge.mp3';

const CRUCIBLE_PATHS = new Set(
  Object.values(CRUCIBLE_STREAM_URLS).map((url) => url.split('?', 1)[0]),
);

/**
 * Select the Fantasy Arena recording at playback time. Keep the original logical
 * cue URL on each stream so zone pools, boss retargeting, and transitions still
 * distinguish cues as before. Non-music URLs pass through unchanged.
 */
export function fantasyArenaMusicUrl(url: string): string {
  const pathname = url.split('?', 1)[0];
  if (pathname === '/audio/main-theme.mp3') return FANTASY_ARENA_ADVENTURE_TRACK;
  if (pathname === '/audio/dungeon-boss-fight.mp3') return FANTASY_ARENA_COMBAT_TRACK;
  if (!/^\/audio\/music\/[^/]+\.mp3$/i.test(pathname)) return url;
  if (
    CRUCIBLE_PATHS.has(pathname) ||
    /\/(?:boss_|combat_)/i.test(pathname) ||
    /(?:raid_arena|crucible|ember)/i.test(pathname)
  ) {
    return FANTASY_ARENA_COMBAT_TRACK;
  }
  return FANTASY_ARENA_ADVENTURE_TRACK;
}
