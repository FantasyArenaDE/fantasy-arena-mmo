import type { VisualDef } from './manifest';

/** Preserve the live/corpse shell swap while replacing only the egg art. */
export function faReleaseDragonEgg(def: VisualDef, enabled: boolean): VisualDef {
  return enabled
    ? { ...def, url: 'models/creatures/fantasy-arena/dragon-egg.glb', authoredAtlas: false }
    : def;
}

/** Preserve each brood role and its exact special-ability map with authored matching clips. */
export function faReleaseDragonkin(
  def: VisualDef,
  variant: 'elite' | 'guard' | 'baby',
  enabled: boolean,
): VisualDef {
  return enabled
    ? {
        ...def,
        url: `models/creatures/fantasy-arena/dragonkin-${variant}.glb`,
        authoredAtlas: false,
      }
    : def;
}
