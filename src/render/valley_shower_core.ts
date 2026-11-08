import { DAY_NIGHT_CYCLE_MS } from '../sim/day_night';

const CYCLE_SECONDS = DAY_NIGHT_CYCLE_MS / 1000;
const SHOWER_PHASES = [0.305, 0.363, 0.628, 0.695];
const BOW_END = 71;
const SHOWER_END = 32;

function ease(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Epoch-phased, so a clear-sky login cannot mint a shower or a rainbow. */
export function valleyShowerAge(phase: number): number {
  for (const start of SHOWER_PHASES) {
    const age = (phase - start) * CYCLE_SECONDS;
    if (age >= 0 && age < BOW_END) return age;
  }
  return -1;
}

export function valleyRainStrength(age: number): number {
  return ease(0, 4, age) * (1 - ease(26, SHOWER_END, age));
}

export function valleyRainbowStrength(age: number, remainingPrecipitation: number): number {
  const clearing = ease(35, 41, age) * (1 - ease(54, BOW_END, age));
  return clearing * (1 - ease(0.012, 0.12, remainingPrecipitation));
}

/** Inner violet and outer red of the primary bow, about 42 degrees from the antisolar point. */
export const RAINBOW_INNER_DEG = 40.2;
export const RAINBOW_OUTER_DEG = 42.7;
