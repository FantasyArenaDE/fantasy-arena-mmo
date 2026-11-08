import type { ClipMap, VisualDef } from './manifest';

/** Grubjaw formerly used the same troll-family body. Keep the rare's target
 * height, and use the CC0 body's own rig and animation donors. */
export function faReleaseGrubjaw(def: VisualDef, trollClips: ClipMap, enabled: boolean): VisualDef {
  if (!enabled) return def;
  return {
    ...def,
    url: 'models/creatures/orc.glb',
    clips: trollClips,
    animUrls: [
      'models/creatures/troll_ability_anims.glb',
      'models/creatures/orc_hit_variety_anims.glb',
    ],
    walkRef: undefined,
    runRef: undefined,
    tintStrength: 0.12,
  };
}
