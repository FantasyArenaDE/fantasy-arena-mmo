import type { VisualDef } from './manifest';

/** Preserve the carrion crow's flight/hover contract and replace its body only. */
export function faReleaseCrow(def: VisualDef, enabled: boolean): VisualDef {
  return enabled ? { ...def, url: 'models/creatures/fantasy-arena/carrion-crow.glb' } : def;
}
