export type ShoreTrackKind = 'boot' | 'paw' | 'hoof';

export const TRACK_LIFETIME = 9;
export const TRACK_SPECS = {
  boot: { stride: 0.69, side: 0.13, width: 0.25, length: 0.46, tile: 0 },
  paw: { stride: 0.54, side: 0.17, width: 0.28, length: 0.32, tile: 1 },
  hoof: { stride: 0.65, side: 0.19, width: 0.23, length: 0.31, tile: 2 },
} as const;

export function shoreTrackKind(kind: string, templateId: string): ShoreTrackKind | null {
  if (kind === 'player') return 'boot';
  if (kind !== 'mob') return null;
  if (templateId === 'forest_wolf' || templateId === 'old_greyjaw') return 'paw';
  if (templateId === 'wild_boar') return 'hoof';
  return null;
}

/** A narrow dry strip immediately above the water, not submerged sand or high grass. */
export function dampTrackHeight(ground: number, water: number): boolean {
  const above = ground - water;
  return above > 0.035 && above < 1.1;
}

export interface TrackStride {
  x: number;
  z: number;
  carry: number;
  side: number;
  time: number;
}
export interface TrackStep {
  x: number;
  z: number;
  dx: number;
  dz: number;
}

/** Sample the actual travelled segment so prints stay put even at uneven frame rates. */
export function advanceTrackStride(
  state: TrackStride,
  x: number,
  z: number,
  time: number,
  kind: ShoreTrackKind,
  out: TrackStep,
): boolean {
  const dx = x - state.x;
  const dz = z - state.z;
  const length = Math.hypot(dx, dz);
  const gap = time - state.time;
  state.x = x;
  state.z = z;
  state.time = time;
  if (length > 2.2 || gap > 0.38 || gap < 0) {
    state.carry = 0;
    return false;
  }
  if (length < 0.003) return false;
  const spec = TRACK_SPECS[kind];
  const travel = state.carry + length;
  if (travel < spec.stride) {
    state.carry = travel;
    return false;
  }
  // Use the latest full stride after a delayed frame; never stamp a catch-up burst.
  const back = travel % spec.stride;
  state.carry = back;
  out.dx = dx / length;
  out.dz = dz / length;
  state.side = -state.side;
  out.x = x - out.dx * back + out.dz * spec.side * state.side;
  out.z = z - out.dz * back - out.dx * spec.side * state.side;
  return true;
}

export function shoreTrackAlpha(age: number): number {
  if (age < 0 || age >= TRACK_LIFETIME) return 0;
  const fade = Math.max(0, (age - 2) / (TRACK_LIFETIME - 2));
  return 0.79 * (1 - fade * fade * (3 - 2 * fade));
}
