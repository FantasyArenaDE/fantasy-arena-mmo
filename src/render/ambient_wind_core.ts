export const GUST_RATE = 0.6;
export const GUST_X = 0.05;
export const GUST_Z = 0.04;
const CREST = Math.PI / 2;
const CYCLE = Math.PI * 4;
const phaseSlope = Math.hypot(GUST_X, GUST_Z);
export const WIND_FRONT_X = -GUST_X / phaseSlope;
export const WIND_FRONT_Z = -GUST_Z / phaseSlope;
export const WIND_FRONT_SPEED = GUST_RATE / phaseSlope;
export const WIND_TRACE_DURATION = 2.6;

/** Seconds from an occasional crest of the same wave that animates the trees. */
export function windTraceAge(x: number, z: number, seconds: number): number {
  const phase = seconds * GUST_RATE + x * GUST_X + z * GUST_Z - CREST + 0.75;
  return (((phase % CYCLE) + CYCLE) % CYCLE) / GUST_RATE;
}

export function windTraceOpacity(age: number): number {
  if (age <= 0 || age >= WIND_TRACE_DURATION) return 0;
  return Math.sin((Math.PI * age) / WIND_TRACE_DURATION) ** 1.65;
}
