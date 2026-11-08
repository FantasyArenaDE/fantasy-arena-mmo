// Loads the terrain plate baked by runtime/build-world-overview.mjs for the
// world map's continent level. The plate is decoded once and cached. The painter
// blits it into the world-bounds dest rect; when it is missing the painter falls
// back to an ocean fill plus the zone-region overlay, so the overview still works
// (custom worlds, a stripped asset build, or a not-yet-committed plate).
//
// Terrain-only art contract (mirrors map_art.ts): north at the top, the same
// east-west mirroring as the game map, no baked text or labels (the localized
// zone names + markers are drawn on top by the painter).
//
// FRAMING contract, because the zone regions are projected onto the whole plate
// rect: the image must be cropped so its FRAME equals the world bounds, i.e. the
// map shows only the land and sea inside the actual world coordinates.
// Extra ocean padding baked into the crop shifts every clickable region
// off the land it labels. Two things track the file and must be updated with it:
// CONTINENT_FALLBACK_ASPECT (continent_map_view.ts, pinned to the real pixels by
// tests/continent_map_view.test.ts) and --color-map-continent-ocean (tokens.css,
// the flat fill the plate is letterboxed into, sampled from its deep water).

type ArtState = HTMLImageElement | 'loading' | 'missing';

let state: ArtState | null = null;
const waiters: { onReady: (img: HTMLImageElement) => void; onMiss: () => void }[] = [];

export const CONTINENT_ART_SRC = '/map_bg/fantasy_arena_world.webp';

/** Load (or join the load of) the continent plate. Exactly one of the two
 *  callbacks fires: onReady with the decoded image, or onMiss so the caller can
 *  fall back to the ocean + region overlay. */
export function loadContinentArt(
  onReady: (img: HTMLImageElement) => void,
  onMiss: () => void,
): void {
  if (state === 'missing') {
    onMiss();
    return;
  }
  if (state instanceof HTMLImageElement) {
    onReady(state);
    return;
  }
  waiters.push({ onReady, onMiss });
  if (state === 'loading') return;
  state = 'loading';
  const img = new Image();
  img.onload = () => {
    state = img;
    const queue = waiters.splice(0);
    for (const w of queue) w.onReady(img);
  };
  img.onerror = () => {
    state = 'missing';
    const queue = waiters.splice(0);
    for (const w of queue) w.onMiss();
  };
  img.src = CONTINENT_ART_SRC;
}
