import type { VisualDef } from './manifest';

/** Keep all existing elemental behavior and replace only its model in the release profile. */
export function faReleaseWaterElemental(def: VisualDef, enabled: boolean): VisualDef {
  return enabled ? { ...def, url: 'models/creatures/fantasy-arena/water-elemental.glb' } : def;
}
