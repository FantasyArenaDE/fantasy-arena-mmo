import type { VisualDef } from './manifest';

/** Quaternius' CC0 wolf has its own rig and must use its own clips. */
export const FA_RELEASE_WOLF_URL = '/models/creatures/wolf.glb';

export function faReleaseWolfEnabled(): boolean {
  return import.meta.env?.VITE_FA_BROWSER_RELEASE === '1';
}

/** Keep the visual's game identity, height, tint and placement; replace only its art and rig map. */
export function faReleaseWolfVisual(def: VisualDef, enabled: boolean): VisualDef {
  if (!enabled) return def;
  return {
    ...def,
    url: FA_RELEASE_WOLF_URL,
    // This wolf uses vertex-coloured materials, not the former baked texture atlas.
    authoredAtlas: false,
    clips: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Gallop',
      attack: ['Attack'],
      hit: ['Idle_HitReact_Left', 'Idle_HitReact_Right'],
      death: 'Death',
      sitIdle: 'Idle',
      swim: 'Walk',
      jump: 'Gallop_Jump',
    },
  };
}
