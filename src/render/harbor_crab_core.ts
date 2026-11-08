import { eastbrookDeckSurface } from '../sim/eastbrook_harbor';
import { WATER_LEVEL } from '../sim/world';

export interface HarborCrabSite {
  x: number;
  z: number;
  endX: number;
  endZ: number;
  phase: number;
  period: number;
}

interface Point {
  x: number;
  y: number;
  z: number;
}

export interface HarborCrabMotion {
  travel: number;
  clock: number;
  shelter: number;
}

type GroundAt = (x: number, z: number) => number;

const SHORE_STATIONS = [-76.6, -73.2, -61.4, -48.2, -44.4, -36.6];
const STEP = 0.25;

// Take the first exposed strip on the landward side of the water line.
// The deck test rejects the undersides of piers and the boardwalk.
function wetShoreAt(z: number, ground: GroundAt, level: number): number | null {
  for (let x = -116; x <= -99; x += STEP) {
    const height = ground(x, z);
    const freeboard = height - level;
    if (freeboard < 0.24 || freeboard > 0.7) continue;
    if (ground(x - 0.32, z) < level + 0.04) continue;
    if (ground(x - 1.6, z) > level + 0.18) continue;
    if (Number.isFinite(eastbrookDeckSurface(x, z, ground, level))) continue;
    return x;
  }
  return null;
}

export function harborCrabSites(ground: GroundAt, level = WATER_LEVEL): HarborCrabSite[] {
  const sites: HarborCrabSite[] = [];
  for (let i = 0; i < SHORE_STATIONS.length; i++) {
    const z = SHORE_STATIONS[i];
    const endZ = z + (i % 2 === 0 ? 1.5 : -1.65);
    const x = wetShoreAt(z, ground, level);
    const endX = wetShoreAt(endZ, ground, level);
    if (x === null || endX === null || Math.abs(x - endX) > 2.1) continue;
    const midX = (x + endX) * 0.5;
    const midZ = (z + endZ) * 0.5;
    if (ground(midX, midZ) < level + 0.08) continue;
    if (Number.isFinite(eastbrookDeckSurface(midX, midZ, ground, level))) continue;
    sites.push({ x, z, endX, endZ, phase: 1.8 + i * 2.67, period: 8.7 + i * 1.16 });
  }
  return sites;
}

/** A sun ray from the shell must cross the player's approximate body volume. */
export function harborCrabShadow(
  x: number,
  y: number,
  z: number,
  feet: Point,
  sun: Point,
): boolean {
  if (sun.y <= 0.045) return false;
  const dx = feet.x - x;
  const dz = feet.z - z;
  const distanceSq = dx * dx + dz * dz;
  if (distanceSq > 13 * 13) return false;
  const horizontalSq = sun.x * sun.x + sun.z * sun.z;
  if (horizontalSq < 0.0001) return distanceSq < 0.55 * 0.55 && feet.y + 2.05 > y;
  const along = (dx * sun.x + dz * sun.z) / horizontalSq;
  const crossX = dx - sun.x * Math.max(0, along);
  const crossZ = dz - sun.z * Math.max(0, along);
  if (crossX * crossX + crossZ * crossZ > 0.55 * 0.55) return false;
  const rayY = y + sun.y * Math.max(0, along);
  return rayY >= feet.y - 0.18 && rayY <= feet.y + 2.05;
}

function patrol(clock: number, period: number): number {
  const wave = 0.5 - 0.5 * Math.cos((clock / period) * Math.PI * 2);
  return Math.max(0, Math.min(1, (wave - 0.065) / 0.87));
}

export function makeHarborCrabMotion(site: HarborCrabSite): HarborCrabMotion {
  return { travel: patrol(site.phase, site.period), clock: site.phase, shelter: 0 };
}

export function stepHarborCrab(
  state: HarborCrabMotion,
  site: HarborCrabSite,
  dt: number,
  startled: boolean,
  reducedMotion: boolean,
): void {
  if (startled) state.shelter = 3.8 + site.phase * 0.12;
  else state.shelter = Math.max(0, state.shelter - dt);

  const hiding = state.shelter > 0;
  if (hiding) state.clock = 0;
  else if (!reducedMotion) state.clock += dt;
  const target = hiding ? 0 : reducedMotion ? 0.72 : patrol(state.clock, site.period);
  const maxStep = dt * (hiding ? 2.45 : 0.55);
  state.travel += Math.max(-maxStep, Math.min(maxStep, target - state.travel));
}
