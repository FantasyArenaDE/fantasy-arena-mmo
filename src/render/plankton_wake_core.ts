export const PLANKTON_CYCLE_SECONDS = 75;
export const PLANKTON_SWIM_SECONDS = 1.35;
export const PLANKTON_WAKE_SECONDS = 3.2;

interface Lane {
  x: number;
  z: number;
  dx: number;
  dz: number;
  start: number;
}

// Three crossings along the sheltered north rim of Eastbrook's harbor.
const LANES: readonly Lane[] = [
  { x: -125, z: -35.4, dx: -9.2, dz: 1.2, start: 5 },
  { x: -137, z: -32.2, dx: 8.3, dz: -2.1, start: 27 },
  { x: -123.8, z: -37.2, dx: -8.7, dz: 0.5, start: 53 },
];

export function wetPlanktonLanes(isWet: (x: number, z: number) => boolean): readonly Lane[] {
  return LANES.filter(({ x, z, dx, dz }) => {
    for (let i = 0; i <= 8; i++) {
      const sx = x + (dx * i) / 8;
      const sz = z + (dz * i) / 8;
      if (!isWet(sx, sz - 0.8) || !isWet(sx, sz + 0.8)) return false;
    }
    return true;
  });
}

export function activePlanktonLane(
  lanes: readonly Lane[],
  time: number,
  night: number,
  cameraX: number,
  cameraZ: number,
): Lane | undefined {
  if (night <= 0 || Math.abs(cameraX + 130) > 53 || Math.abs(cameraZ + 35) > 53) return;
  const cycleTime = time % PLANKTON_CYCLE_SECONDS;
  for (const lane of lanes) {
    const age = cycleTime - lane.start;
    if (age >= 0 && age < PLANKTON_WAKE_SECONDS) return lane;
  }
}
