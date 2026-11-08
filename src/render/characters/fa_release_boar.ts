import type { VisualDef } from './manifest';

/** Original Fantasy Arena boar. Only the body and its clip vocabulary change;
 * the existing visual height and every simulation-side animal rule are retained. */
export function faReleaseBoarVisual(def: VisualDef, enabled: boolean): VisualDef {
  if (!enabled) return def;
  return {
    ...def,
    url: 'models/creatures/fantasy-arena/boar.glb',
    clips: {
      idle: 'Idle',
      walk: 'Walk',
      run: 'Run',
      attack: ['Attack'],
      hit: ['Hurt'],
      death: 'Death',
    },
    tintStrength: 0.15,
  };
}
