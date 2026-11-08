import { PROVING_SHORE_ARRIVAL } from '../sim/content/proving_shore';
import { LAKE, zoneAt } from '../sim/data';
import { hash2 } from '../sim/rng';
import { roadDistance, terrainHeight, waterLevel, waterLevelAt } from '../sim/world';

const BANKS = [
  { ...PROVING_SHORE_ARRIVAL, reach: 23, step: 2.5, count: 3, zone: 'proving_shore' },
  { ...LAKE, reach: 42, step: 3.5, count: 5, zone: 'eastbrook_vale' },
];

export interface FrogBankPoint {
  x: number;
  y: number;
  z: number;
}

export interface FrogRoute {
  from: FrogBankPoint;
  to: FrogBankPoint;
  period: number;
  phase: number;
  height: number;
}

/** Find dry, gentle pockets near actual water in the two starter areas. */
export function starterFrogRoutes(seed: number): FrogRoute[] {
  const surface = waterLevel();
  const isWet = (x: number, z: number) => terrainHeight(x, z, seed) < waterLevelAt(x, z, seed);
  return BANKS.flatMap((bank) => {
    const candidates: FrogBankPoint[] = [];
    for (let dx = -bank.reach; dx <= bank.reach; dx += bank.step) {
      for (let dz = -bank.reach; dz <= bank.reach; dz += bank.step) {
        const x = bank.x + dx;
        const z = bank.z + dz;
        const y = terrainHeight(x, z, seed);
        if (y < surface + 0.17 || y > surface + 1.65 || zoneAt(x, z).id !== bank.zone) continue;
        if (roadDistance(x, z) < 2 || isWet(x, z)) continue;
        if (isWet(x + 3.5, z) || isWet(x - 3.5, z) || isWet(x, z + 3.5) || isWet(x, z - 3.5)) {
          candidates.push({ x, y, z });
        }
      }
    }
    candidates.sort(
      (a, b) =>
        (a.x - bank.x) ** 2 + (a.z - bank.z) ** 2 - ((b.x - bank.x) ** 2 + (b.z - bank.z) ** 2),
    );
    const routes: FrogRoute[] = [];
    for (const from of candidates) {
      if (
        routes.some((route) => (route.from.x - from.x) ** 2 + (route.from.z - from.z) ** 2 < 5 ** 2)
      ) {
        continue;
      }
      const bearing = hash2(from.x, from.z, seed ^ 0x1642) * Math.PI * 2;
      const rate = hash2(from.x, from.z, seed);
      const height = 0.35 + rate * 0.27;
      for (let k = 0; k < 8; k++) {
        const yaw = bearing + (k * Math.PI) / 4;
        const x = from.x + 1.45 * Math.sin(yaw);
        const z = from.z + 1.45 * Math.cos(yaw);
        const y = terrainHeight(x, z, seed);
        if (
          Math.abs(y - from.y) > 0.3 ||
          y < surface + 0.12 ||
          isWet(x, z) ||
          roadDistance(x, z) < 1.6
        )
          continue;
        const clear = [0.25, 0.5, 0.75].every((t) => {
          const hopX = from.x + (x - from.x) * t;
          const hopZ = from.z + (z - from.z) * t;
          const ground = terrainHeight(hopX, hopZ, seed);
          const arcY = from.y + (y - from.y) * t + height * 4 * t * (1 - t);
          return ground >= waterLevelAt(hopX, hopZ, seed) && ground < arcY;
        });
        if (!clear) continue;
        routes.push({
          from,
          to: { x, y, z },
          period: 4.8 + rate * 4.6,
          phase: hash2(from.z, from.x, seed ^ 0x9713) * 15,
          height,
        });
        break;
      }
      if (routes.length === bank.count) break;
    }
    return routes;
  });
}

export function starterFrogPose(
  route: FrogRoute,
  time: number,
  out: { x: number; y: number; z: number; yaw: number; crouch: number; kick: number },
): void {
  const clock = time + route.phase;
  const cycle = Math.floor(clock / route.period);
  const local = clock - cycle * route.period;
  const forward = cycle % 2 === 0;
  const from = forward ? route.from : route.to;
  const to = forward ? route.to : route.from;
  const anticipation = route.period - 0.95;
  const takeoff = route.period - 0.68;
  const flight = Math.max(0, Math.min(1, (local - takeoff) / 0.52));
  const arc = 4 * flight * (1 - flight);
  out.x = from.x + (to.x - from.x) * flight;
  out.y = from.y + (to.y - from.y) * flight + route.height * arc;
  out.z = from.z + (to.z - from.z) * flight;
  const heading = Math.atan2(to.x - from.x, to.z - from.z);
  const turn = Math.max(0, Math.min(1, (local - anticipation) / 0.21));
  out.yaw = heading - Math.PI * (1 - turn);
  const compress = Math.max(0, 1 - Math.abs(local - takeoff) / 0.2);
  const land = Math.max(0, 1 - Math.abs(local - (takeoff + 0.55)) / 0.1);
  out.crouch = Math.max(compress, land);
  out.kick = arc;
}
