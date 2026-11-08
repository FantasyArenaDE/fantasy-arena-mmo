import { hash2 } from '../sim/rng';

export interface RainSurfaceSample {
  ground: number;
  water: number;
}

export interface RainSurfacePoint {
  x: number;
  y: number;
  z: number;
}

export interface RainPuddle extends RainSurfacePoint {
  width: number;
  length: number;
  angle: number;
}

const GRID = 4;
const RADIUS = 4;

/** Deterministic, bounded selection in fixed world cells. */
export function rainSurfacePlan(
  seed: number,
  centerX: number,
  centerZ: number,
  isRainingAt: (x: number, z: number) => boolean,
  sample: (x: number, z: number) => RainSurfaceSample,
  limit: number,
): { water: RainSurfacePoint[]; puddles: RainPuddle[] } {
  const water: RainSurfacePoint[] = [];
  const puddles: RainPuddle[] = [];
  for (let dx = -RADIUS; dx <= RADIUS; dx++) {
    for (let dz = -RADIUS; dz <= RADIUS; dz++) {
      const i = Math.round(centerX / GRID) + dx;
      const j = Math.round(centerZ / GRID) + dz;
      const x = i * GRID + 2.5 * (hash2(i, j, seed ^ 0x120c) - 0.5);
      const z = j * GRID + 2.5 * (hash2(i, j, seed ^ 0x73d1) - 0.5);
      if (!isRainingAt(x, z)) continue;
      const at = sample(x, z);
      if (at.water > at.ground + 0.13) {
        water.push({ x, y: at.water + 0.025, z });
        continue;
      }
      if (at.water > at.ground) continue;
      const neighbors = [
        sample(x + 0.64, z),
        sample(x - 0.64, z),
        sample(x, z + 0.64),
        sample(x, z - 0.64),
      ];
      const highest = Math.max(at.ground, ...neighbors.map((s) => s.ground));
      const lowest = Math.min(at.ground, ...neighbors.map((s) => s.ground));
      if (highest - lowest > 0.105 || neighbors.some((s) => s.water > s.ground)) continue;
      const average = neighbors.reduce((sum, s) => sum + s.ground, 0) / neighbors.length;
      if (at.ground > average + 0.012) continue;
      const size = hash2(i, j, seed);
      puddles.push({
        x,
        y: highest + 0.016,
        z,
        width: 0.66 + size * 0.45,
        length: 0.62 + size * 0.31,
        angle: size * Math.PI,
      });
    }
  }
  const nearest = (a: RainSurfacePoint, b: RainSurfacePoint) =>
    (a.x - centerX) ** 2 + (a.z - centerZ) ** 2 - ((b.x - centerX) ** 2 + (b.z - centerZ) ** 2);
  return {
    water: water.sort(nearest).slice(0, limit),
    puddles: puddles.sort(nearest).slice(0, Math.ceil(limit / 3)),
  };
}

export function rainSurfaceWetness(wetness: number, strength: number, dt: number): number {
  const target = strength > 0.04 ? 1 : 0;
  const speed = target ? 0.4 : 0.085;
  const step = Math.max(0, dt) * speed;
  return Math.max(wetness - step, Math.min(wetness + step, target));
}

export function rainRingPhase(time: number, phase: number, period: number): number {
  return ((time + phase) % period) / 0.9;
}
