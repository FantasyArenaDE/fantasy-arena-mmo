import type { VisualDef } from './manifest';

/** Two CC0-derived ogres with the Quaternius rig's own attack and hit clips. */
export function faReleaseOgreVisual(
  def: VisualDef,
  variant: 'ogre' | 'drogmar',
  enabled: boolean,
): VisualDef {
  if (!enabled) return def;
  return {
    ...def,
    url: `models/creatures/fantasy-arena/${variant}.glb`,
    authoredAtlas: false,
    clips: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Run',
      attack: ['Weapon'],
      hit: ['HitReact'],
      death: 'Death',
      ...(variant === 'drogmar' ? { combatIdle: 'CombatIdle' } : {}),
    },
  };
}
