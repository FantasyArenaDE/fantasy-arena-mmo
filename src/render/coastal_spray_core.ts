import { getActiveWorldContent } from '../sim/data';
import { isInWaterBody, isOpenSeaAt, terrainHeight, waterLevel } from '../sim/world';
import { OCEAN_LOOP_SECONDS } from './ocean/ocean_spectrum_core';
import {
  SHORE_LAP_CYCLES,
  SHORE_LAP_DEPTH,
  SHORE_LAP_X,
  SHORE_LAP_Z,
  SHORE_SLOPE_SAMPLE_HALF_WIDTH,
  shoreDepthAt,
  WATER_FOAM_WIDTH_YARDS,
} from './water_core';

const TAU = 2 * Math.PI;
const LAP_RATE = (SHORE_LAP_CYCLES * TAU) / OCEAN_LOOP_SECONDS;
export const SPRAY_BURST_SECONDS = 1.05;
const DOCKS = ['the_old_pier', 'eastbrook_docks'];

export interface CoastalBreaker {
  x: number;
  y: number;
  z: number;
  nx: number;
  nz: number;
  distance: number;
  energy: number;
}

/** Place short bursts on the wet side of an actual saltwater shoreline. */
export function coastalBreakers(seed: number): CoastalBreaker[] {
  const surface = waterLevel();
  const coast = (x: number, z: number) => !isInWaterBody(x, z) && isOpenSeaAt(x, z, seed);
  return DOCKS.flatMap((id) => {
    const dock = getActiveWorldContent()
      .zones.flatMap((zone) => zone.pois)
      .find((poi) => poi.id === id);
    if (!dock) return [];
    const candidates: CoastalBreaker[] = [];
    for (let i = -9; i <= 9; i++) {
      for (let j = -9; j <= 9; j++) {
        const x = dock.x + i * 3.5;
        const z = dock.z + j * 3.5;
        const depth = shoreDepthAt(x, z, seed);
        if (depth < 0.14 || depth > 0.95 || !coast(x, z)) continue;
        const h = SHORE_SLOPE_SAMPLE_HALF_WIDTH;
        const sx = shoreDepthAt(x - h, z, seed) - shoreDepthAt(x + h, z, seed);
        const sz = shoreDepthAt(x, z - h, seed) - shoreDepthAt(x, z + h, seed);
        const slope = Math.hypot(sx, sz);
        if (slope < 0.22) continue;
        const nx = sx / slope;
        const nz = sz / slope;
        const distance = (depth * 2 * h) / slope;
        if (distance > WATER_FOAM_WIDTH_YARDS) continue;
        if (terrainHeight(x + nx * 4.2, z + nz * 4.2, seed) <= surface) continue;
        if (![5, 11].every((r) => coast(x - nx * r, z - nz * r))) continue;
        candidates.push({
          x,
          y: surface,
          z,
          nx,
          nz,
          distance,
          energy: Math.min(1.2, 0.72 + slope * 0.35),
        });
      }
    }
    candidates.sort(
      (a, b) =>
        (a.x - dock.x) ** 2 + (a.z - dock.z) ** 2 - ((b.x - dock.x) ** 2 + (b.z - dock.z) ** 2),
    );
    const selected: CoastalBreaker[] = [];
    for (const spot of candidates) {
      if (selected.some((other) => (spot.x - other.x) ** 2 + (spot.z - other.z) ** 2 < 7 ** 2))
        continue;
      selected.push(spot);
      if (selected.length === 6) break;
    }
    return selected;
  });
}

/** Start just before the coherent crest used by the water's shore foam. */
export function coastalBurstAge(spot: CoastalBreaker, time: number): number {
  const phase =
    time * LAP_RATE -
    spot.distance * SHORE_LAP_DEPTH +
    spot.x * SHORE_LAP_X +
    spot.z * SHORE_LAP_Z -
    1.24;
  return (((phase % TAU) + TAU) % TAU) / LAP_RATE;
}

export function coastalDropletHeight(age: number, speed: number): number {
  return Math.max(0, 0.13 + age * (speed - age * 4.2));
}
