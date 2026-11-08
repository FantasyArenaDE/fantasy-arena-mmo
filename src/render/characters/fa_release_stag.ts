import type { VisualDef } from './manifest';

export const FA_STAG_BASE = 'models/creatures/stag.glb';
export const FA_STAG_DOE = '/models/creatures/fantasy-arena/doe.glb';
export const FA_STAG_CHARGE = '/models/creatures/fantasy-arena/stag-ability.glb';
export type FAStagKind = 'base' | 'veiled' | 'gleam' | 'doe' | 'aurelhorn';

/** Only the five deer-family definitions change; clips and world identity stay intact. */
export function faReleaseStagVisual(def: VisualDef, kind: FAStagKind, enabled: boolean): VisualDef {
  if (!enabled) return def;
  if (kind === 'base') return { ...def, animUrls: [FA_STAG_CHARGE] };
  const tint = { veiled: 0x8d76a3, gleam: 0xb08bd2, doe: 0xa693b2, aurelhorn: 0xd6aa63 }[kind];
  return {
    ...def,
    url: kind === 'doe' ? FA_STAG_DOE : FA_STAG_BASE,
    tint,
    tintStrength: 0.45,
  };
}

export function faReleaseStagEnabled(): boolean {
  return import.meta.env?.VITE_FA_BROWSER_RELEASE === '1';
}
