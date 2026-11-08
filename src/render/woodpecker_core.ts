export const WOODPECKER_HEAR_RANGE = 23;
export const WOODPECKER_VIEW_RANGE = 16;
export const WOODPECKER_CYCLE = 16.4;
export const WOODPECKER_BEATS = [0.92, 1.05, 1.21, 8.6, 8.71, 8.83, 9.0] as const;

export const WOODPECKER_TREES = [
  { x: 27.45, z: -60.65, dx: -0.88, dz: 0.475, height: 2.05 },
  { x: -11.25, z: -62.1, dx: 0.92, dz: 0.392, height: 2.05 },
] as const;

export function woodpeckerDaytime(phase: number): boolean {
  return phase >= 0.255 && phase <= 0.74;
}

export function nearestWoodpeckerPerch<T extends { x: number; z: number }>(
  perches: readonly T[],
  x: number,
  z: number,
): T | undefined {
  let nearest: T | undefined;
  let best = WOODPECKER_HEAR_RANGE ** 2;
  for (const perch of perches) {
    const distance = (perch.x - x) ** 2 + (perch.z - z) ** 2;
    if (distance >= best) continue;
    best = distance;
    nearest = perch;
  }
  return nearest;
}

export function crossedWoodpeckerBeat(previous: number, now: number): number | undefined {
  if (now < previous || now - previous > 0.2) return;
  const cycle = Math.floor(now / WOODPECKER_CYCLE) * WOODPECKER_CYCLE;
  for (let i = WOODPECKER_BEATS.length - 1; i >= 0; i--) {
    const beat = cycle + WOODPECKER_BEATS[i];
    if (beat <= now && beat > previous && now - beat < 0.095) return i;
  }
}

export function woodpeckerThrust(time: number): number {
  const local = time % WOODPECKER_CYCLE;
  let amount = 0;
  for (const beat of WOODPECKER_BEATS) {
    const delta = local - beat;
    const reach = delta < 0 ? 0.048 : 0.08;
    amount = Math.max(amount, 1 - Math.abs(delta) / reach);
  }
  return amount * amount;
}
