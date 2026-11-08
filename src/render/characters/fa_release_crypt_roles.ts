import type { VisualDef } from './manifest';

/** Replace only the two named crypt roles while retaining their phase and ability maps. */
export function faReleaseCryptRole(
  def: VisualDef,
  role: 'morthen' | 'sexton',
  enabled: boolean,
): VisualDef {
  if (!enabled) return def;
  return {
    ...def,
    url: `models/creatures/fantasy-arena/crypt-${role}.glb`,
    authoredAtlas: false,
    // The former Sexton shovel extended below its original body origin.
    ...(role === 'sexton' ? { hover: 0 } : {}),
  };
}
