import type { VisualDef } from './manifest';

/** Keep the CC0 crab body and its clip map, using donors rebuilt from its own rig. */
export function faReleaseCrab(def: VisualDef, enabled: boolean): VisualDef {
  return enabled
    ? {
        ...def,
        animUrls: [
          'models/creatures/fantasy-arena/animations/crabenemy_hit_variety_anims.glb',
          'models/creatures/fantasy-arena/animations/crab_ability_anims.glb',
        ],
      }
    : def;
}
