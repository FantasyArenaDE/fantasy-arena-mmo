import type { VisualDef } from './manifest';

/** Replace only Eastbrook's rat-worker and its shovel-bearing Tunnelking. */
export function faReleaseKoboldVisual(
  def: VisualDef,
  variant: 'digger' | 'grix',
  enabled: boolean,
): VisualDef {
  if (!enabled) return def;
  return {
    ...def,
    url: `models/creatures/fantasy-arena/${variant === 'grix' ? 'grix' : 'kobold'}.glb`,
    authoredAtlas: false,
    // Original offsets compensated for old models' tails below their feet.
    hover: 0,
  };
}
