import { clamp01 } from './num_clamp';

export const LEAF_SETTLE_SECONDS = 0.95;

export interface LeafFall {
  x: number;
  y: number;
  z: number;
  endX: number;
  endY: number;
  endZ: number;
  duration: number;
  flutter: number;
}

export interface LeafFallPose {
  x: number;
  y: number;
  z: number;
  progress: number;
  scale: number;
}

/** Absolute world height decreases throughout a fall, even across rising ground. */
export function leafFallPose(path: LeafFall, age: number, out: LeafFallPose): void {
  const t = clamp01(age / path.duration);
  const wobble = Math.sin(t * 10 + path.flutter) * 4 * t * (1 - t);
  out.x = path.x + (path.endX - path.x) * t + wobble * 0.26;
  out.y = path.y + (path.endY - path.y) * t * (0.78 + 0.22 * t);
  out.z = path.z + (path.endZ - path.z) * t - wobble * 0.31;
  out.progress = t;
  out.scale =
    age < 0 ? 0 : 1 - clamp01((age - path.duration - 0.24) / (LEAF_SETTLE_SECONDS - 0.24));
}
