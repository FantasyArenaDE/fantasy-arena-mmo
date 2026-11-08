import { getActiveWorldContent } from '../sim/data';
import { hash2 } from '../sim/rng';
import { isOpenSeaAt, terrainHeight, waterLevel } from '../sim/world';

const TAU = 2 * Math.PI;
const LANDMARKS = [
  { zone: 'proving_shore', poi: 'the_old_pier' },
  { zone: 'eastbrook_vale', poi: 'eastbrook_docks' },
];
const ORBIT_RADIUS = 20;

export interface GullCoast {
  x: number;
  z: number;
  viewX: number;
  viewZ: number;
  surface: number;
}

/** Find an open-water orbit near each starter dock, rather than following the player. */
export function coastalGullCoasts(seed: number): GullCoast[] {
  const zones = getActiveWorldContent().zones;
  const surface = waterLevel();
  const open = (x: number, z: number) =>
    isOpenSeaAt(x, z, seed) && terrainHeight(x, z, seed) < surface - 0.9;
  return LANDMARKS.flatMap(({ zone, poi }) => {
    const landmark = zones
      .find((entry) => entry.id === zone)
      ?.pois.find((entry) => entry.id === poi);
    if (!landmark) return [];
    let closest = 57 ** 2;
    let coast: GullCoast | undefined;
    for (let dx = -54; dx <= 54; dx += 6) {
      for (let dz = -54; dz <= 54; dz += 6) {
        const distance = dx * dx + dz * dz;
        if (distance >= closest || distance < 18 ** 2) continue;
        const x = landmark.x + dx;
        const z = landmark.z + dz;
        if (!open(x, z)) continue;
        let clear = true;
        for (let i = 0; i < 12; i++) {
          const angle = (i * TAU) / 12;
          if (!open(x + ORBIT_RADIUS * Math.cos(angle), z + ORBIT_RADIUS * Math.sin(angle))) {
            clear = false;
            break;
          }
        }
        if (!clear) continue;
        closest = distance;
        coast = { x, z, viewX: landmark.x, viewZ: landmark.z, surface };
      }
    }
    return coast ? [coast] : [];
  });
}

export function coastalGullRoutes(seed: number, perCoast: number) {
  return coastalGullCoasts(seed).flatMap((coast, c) =>
    Array.from({ length: perCoast }, (_, i) => ({
      coast,
      radiusX: 10 + hash2(i, c, seed ^ 0x1947) * 8.8,
      radiusZ: 8 + hash2(c, i, seed ^ 0x7796) * 7.6,
      height: 10 + i * 2.25 + hash2(i, c, seed ^ 0x31a7) * 2,
      speed: (i % 3 === 1 ? -1 : 1) * (0.22 + hash2(c, i, seed ^ 0x8401) * 0.2),
      phase: TAU * (i / perCoast + hash2(i, c, seed) * 0.15),
      burst: 4 + hash2(c, i, seed ^ 0x97e1) * 2,
    })),
  );
}

export type GullRoute = ReturnType<typeof coastalGullRoutes>[number];

export function coastalGullPose(
  route: GullRoute,
  time: number,
  pose: { x: number; y: number; z: number; yaw: number; bank: number; flap: number },
): void {
  const angle = route.phase + time * route.speed;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  pose.x = route.coast.x + route.radiusX * cos;
  pose.z = route.coast.z + route.radiusZ * sin;
  pose.y = route.coast.surface + route.height + 1.35 * Math.sin(angle * 2 + route.phase);
  pose.yaw = Math.atan2(-route.radiusX * sin * route.speed, route.radiusZ * cos * route.speed);
  pose.bank = Math.sign(route.speed) * (0.22 + 0.12 * cos * cos);
  const cycle = ((time + route.phase) % route.burst) / route.burst;
  const pulse = cycle < 0.34 ? Math.sin((Math.PI * cycle) / 0.34) ** 2 : 0;
  pose.flap = 0.13 + pulse * 0.86 * Math.sin(time * (13 + route.burst) + route.phase);
}
