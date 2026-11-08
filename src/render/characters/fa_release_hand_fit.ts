import type { AttachDef } from './manifest';

type Fit = 'male' | 'female';
type Hand = 'hand_r' | 'hand_l';

// Shaft grip centers in model space. Unlisted shafts are centered on the grip.
const shaftGripY: Readonly<Record<string, number>> = {
  'iron-sword': -0.005,
  'iron-axe': -0.017,
  'iron-mace': 0.075,
  greatsword: -0.008,
  greataxe: -0.026,
  greatmaul: 0.139,
  'paladin-sun-mace': 0.075,
  'shaman-storm-maul': 0.075,
};

export function faReleaseHandFit(
  name: string,
  hand: Hand,
  fit: Fit,
): Pick<AttachDef, 'position' | 'rotationX' | 'rotationY' | 'boneScale'> {
  // Quaternius hand bones begin at the wrist. The palm landmarks come from
  // each body's skinned hand in that bone's local frame.
  const x = hand === 'hand_l' ? 0.01 : -0.01;
  const y = fit === 'male' ? 0.064 : 0.051;
  const z = fit === 'male' ? 0.008 : 0.004;
  if (name.endsWith('-shield')) {
    return { position: [x, y, z], rotationY: -Math.PI / 2 };
  }
  if (name === 'bound-spellbook') {
    return { position: [x + 0.007, y, z], boneScale: 0.8 };
  }
  if (name.endsWith('-crossbow')) {
    const scale = 0.77;
    const [gripY, gripZ] = name === 'hunter-thorn-crossbow' ? [-0.002, 0.004] : [0, 0];
    const diagonal = Math.SQRT1_2 * scale;
    // This rotation puts the rail toward the front and the limbs upright
    // in the rest hold. Seat the trigger grip before rotating the rail.
    return {
      position: [x, y - (gripZ - gripY) * diagonal, z - (gripY + gripZ) * diagonal],
      rotationX: 3 * Math.PI / 4,
      rotationY: Math.PI,
      boneScale: scale,
    };
  }
  return { position: [x, y, z - (shaftGripY[name] ?? 0)], rotationX: Math.PI / 2 };
}
