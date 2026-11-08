export const STARTER_FOREST_EDGES = [
  { x: 14, z: -53 },
  { x: 28, z: -43 },
  { x: -48, z: -38 },
] as const;

function smooth(lo: number, hi: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}

/** Positive solar elevation by day, NaN when there is no outdoor sky. */
export function dragonflyDaylight(sunY: number): number {
  return Number.isFinite(sunY) ? smooth(0.09, 0.26, sunY) : 0;
}

export function woodlandTwilight(sunY: number): number {
  if (!Number.isFinite(sunY)) return 0;
  return (1 - smooth(-0.03, 0.11, sunY)) * smooth(-0.45, -0.23, sunY);
}

export function forestFireflyReach(distanceSquared: number): number {
  return 1 - smooth(24 ** 2, 38 ** 2, distanceSquared);
}
