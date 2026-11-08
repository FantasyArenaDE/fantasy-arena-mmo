const TAU = Math.PI * 2;
export const SWALLOW_COUNT = 3;
export const SWALLOW_ROUTE_SAMPLES = 64;
export const SWALLOW_HALF_SPAN = 0.44;

export interface SwallowPose {
  along: number;
  across: number;
  height: number;
  yaw: number;
  bank: number;
  flap: number;
}

/** Two passes between consecutive stilt pairs, with longer turns on open water. */
export function harborSwallowPose(seconds: number, bird: number, out: SwallowPose): void {
  const angle =
    seconds * 1.4 + bird * (TAU / SWALLOW_COUNT) + 0.07 * Math.sin(seconds * 0.91 + bird);
  const width = 4.6 + bird * 0.13;
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  out.along = 4 + 1.1 * cos;
  out.across = width * sin;
  out.height = 0.55 + bird * 0.12 + sin * sin * 0.42 + 0.06 * Math.sin(angle * 2 + bird);
  // In pier-local coordinates, the bird's +Z follows the ellipse tangent.
  out.yaw = Math.atan2(width * cos, -1.1 * sin);
  out.bank = 0.16 + 0.46 * sin ** 4;
  const flutter = Math.sin(seconds * (37 + bird * 2) + bird * 1.7);
  const glide = Math.max(0, (Math.abs(sin) - 0.55) / 0.45);
  out.flap = flutter * (0.52 - glide * 0.35);
}
