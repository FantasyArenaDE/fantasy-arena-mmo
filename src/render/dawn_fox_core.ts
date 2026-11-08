import { clamp01 } from './num_clamp';

export const FOX_GLADE = { x: 18, z: -53 } as const;
export const FOX_WALK_SECONDS = 4.1;
export const FOX_LISTEN_SECONDS = 2.4;
export const FOX_RUN_SECONDS = 2.3;
export const FOX_SCENE_SECONDS = FOX_WALK_SECONDS + FOX_LISTEN_SECONDS + FOX_RUN_SECONDS;
export const FOX_START = { x: 9, z: -58 } as const;
export const FOX_EXIT = { x: 31.8, z: -65.4 } as const;

export interface FoxEncounter {
  start: number | null;
  played: boolean;
}

export interface FoxPose {
  x: number;
  z: number;
  yaw: number;
  gait: 'walk' | 'listen' | 'run';
  look: number;
  ear: number;
}

export function isFoxDawn(phase: number): boolean {
  return phase >= 0.247 && phase < 0.341;
}

/** Once per dawn, even if the viewer circles the glade or returns after it leaves. */
export function advanceFoxEncounter(
  scene: FoxEncounter,
  clock: number,
  dawn: boolean,
  mayStart: boolean,
  canSee: boolean,
): number | null {
  if (!dawn) {
    scene.start = null;
    scene.played = false;
    return null;
  }
  if (scene.start === null && !scene.played && mayStart && canSee) {
    scene.start = clock;
    scene.played = true;
  }
  if (scene.start === null) return null;
  const elapsed = clock - scene.start;
  if (!canSee || elapsed < 0 || elapsed >= FOX_SCENE_SECONDS) {
    scene.start = null;
    return null;
  }
  return elapsed;
}

interface GroundPoint {
  x: number;
  z: number;
}

function arc(a: GroundPoint, b: GroundPoint, c: GroundPoint, t: number, out: FoxPose): void {
  const u = 1 - t;
  out.x = u * u * a.x + 2 * u * t * b.x + t * t * c.x;
  out.z = u * u * a.z + 2 * u * t * b.z + t * t * c.z;
  out.yaw = Math.atan2(u * (b.x - a.x) + t * (c.x - b.x), u * (b.z - a.z) + t * (c.z - b.z));
}

const APPROACH_TURN = { x: 12, z: -52 };
const EXIT_TURN = { x: 27.2, z: -54.5 };

export function dawnFoxPose(elapsed: number, out: FoxPose): void {
  out.look = 0;
  out.ear = 0;
  if (elapsed < FOX_WALK_SECONDS) {
    const t = clamp01(elapsed / FOX_WALK_SECONDS);
    arc(FOX_START, APPROACH_TURN, FOX_GLADE, t * t * (3 - 2 * t), out);
    out.gait = 'walk';
    return;
  }
  const rest = elapsed - FOX_WALK_SECONDS;
  if (rest < FOX_LISTEN_SECONDS) {
    arc(FOX_START, APPROACH_TURN, FOX_GLADE, 1, out);
    out.gait = 'listen';
    const t = clamp01(rest / FOX_LISTEN_SECONDS);
    const settle = Math.sin(Math.PI * t);
    out.look = Math.sin(t * Math.PI * 2.15) * settle * 0.56;
    out.ear = Math.sin(t * Math.PI * 6) * settle * 0.2;
    return;
  }
  const t = clamp01((rest - FOX_LISTEN_SECONDS) / FOX_RUN_SECONDS);
  arc(FOX_GLADE, EXIT_TURN, FOX_EXIT, t ** 1.32, out);
  // Carry the listening heading into the first few paces, then follow the curve.
  const listeningYaw = Math.atan2(FOX_GLADE.x - APPROACH_TURN.x, FOX_GLADE.z - APPROACH_TURN.z);
  out.yaw = listeningYaw + (out.yaw - listeningYaw) * clamp01(t * 6);
  out.gait = 'run';
}
