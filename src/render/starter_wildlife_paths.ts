import { inHollowOpenSea, terrainHeight, waterLevelAt } from '../sim/world';

// Eastbrook's north trail and the first trees above the harbor road.
export const STARTER_WOODLAND = [
  { x: 12, z: -52, radius: 5.4 },
  { x: 25, z: -46, radius: 4.6 },
  { x: -48, z: -40, radius: 4.8 },
] as const;

// The three routes point in different directions in the fatigue sea west of
// the docks. Keep them clear of the ferry lane and the inlet.
export const STARTER_DOLPHIN_ROUTES = [
  { x: -190, z: -64, dx: -9, dz: 7, wait: 3.5 },
  { x: -216, z: -51, dx: 10, dz: -4, wait: 7.8 },
  { x: -238, z: -89, dx: -7, dz: -10, wait: 11.2 },
] as const;

export const MIRROR_SCHOOL = { x: -91, z: 85, radius: 8 };
export const DOLPHIN_ASSET = '/models/biome/sea_dolphin.glb';

export function starterDolphinRouteIsWet(
  route: (typeof STARTER_DOLPHIN_ROUTES)[number],
  seed: number,
): boolean {
  for (let i = 0; i <= 8; i++) {
    const x = route.x + route.dx * (i / 8);
    const z = route.z + route.dz * (i / 8);
    if (!inHollowOpenSea(x, z) || waterLevelAt(x, z, seed) - terrainHeight(x, z, seed) < 0.85) {
      return false;
    }
  }
  return true;
}

/** A quick breach with the animal pitched along its instantaneous velocity. */
export function starterDolphinPose(progress: number, height: number, travel: number) {
  const t = Math.min(1, Math.max(0, progress));
  return {
    rise: 4 * height * t * (1 - t) - 0.52,
    pitch: -Math.atan2(4 * height * (1 - 2 * t), travel),
  };
}
