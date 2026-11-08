import { Vector2, Vector4 } from 'three';
import { zoneAt } from '../sim/data';
import { isOpenSeaAt, terrainHeight, waterLevel } from '../sim/world';
import { wildGlowAmount } from './night_lighting_core';
import {
  activePlanktonLane,
  PLANKTON_CYCLE_SECONDS,
  PLANKTON_SWIM_SECONDS,
  wetPlanktonLanes,
} from './plankton_wake_core';

export const planktonUniforms = {
  uPlanktonLane: { value: new Vector4() },
  uPlanktonPulse: { value: new Vector2() },
};

export function buildPlanktonWake(seed: number): void {
  planktonUniforms.uPlanktonPulse.value.set(0, 0);
  lanes = wetPlanktonLanes(
    (x, z) =>
      zoneAt(x, z)?.id === 'eastbrook_vale' &&
      isOpenSeaAt(x, z, seed) &&
      waterLevel() - terrainHeight(x, z, seed) > 0.8,
  );
}

let lanes: ReturnType<typeof wetPlanktonLanes> = [];
let night = 0;

export function setPlanktonNight(amount: number): void {
  night = wildGlowAmount(amount);
}

export function updatePlanktonWake(time: number, cameraX: number, cameraZ: number): void {
  const lane = activePlanktonLane(lanes, time, night, cameraX, cameraZ);
  if (!lane) {
    planktonUniforms.uPlanktonPulse.value.y = 0;
    return;
  }
  planktonUniforms.uPlanktonLane.value.set(lane.x, lane.z, lane.dx, lane.dz);
  planktonUniforms.uPlanktonPulse.value.set((time % PLANKTON_CYCLE_SECONDS) - lane.start, night);
}

// Shared by the simple and FFT water surfaces. The leading point disturbs the
// water first, then the two wake threads spread and fade in place.
export const PLANKTON_GLSL = /* glsl */ `
uniform vec4 uPlanktonLane;
uniform vec2 uPlanktonPulse;

vec4 planktonStroke(vec2 worldXZ) {
  if (uPlanktonPulse.y <= 0.0) return vec4(0.0);
  vec2 delta = worldXZ - uPlanktonLane.xy;
  if (dot(delta, delta) > 145.0) return vec4(0.0);
  vec2 travel = uPlanktonLane.zw;
  float laneLength = length(travel);
  vec2 direction = travel / max(laneLength, 0.01);
  float along = dot(delta, direction);
  float stroke = along / max(laneLength, 0.01);
  float lateral = dot(delta, vec2(-direction.y, direction.x));
  float head = uPlanktonPulse.x / ${PLANKTON_SWIM_SECONDS};
  float body = 0.0;
  if (head < 1.0) {
    float headAge = smoothstep(0.02, 0.11, head) * (1.0 - smoothstep(0.85, 1.0, head));
    float offset = lateral - sin(head * 6.283185) * 0.36;
    vec2 bodyPoint = vec2((along - head * laneLength) / 0.33, offset / 0.10);
    body = (1.0 - smoothstep(0.55, 1.0, dot(bodyPoint, bodyPoint))) * headAge;
  }

  float trailAge = uPlanktonPulse.x - stroke * ${PLANKTON_SWIM_SECONDS};
  if (stroke < 0.0 || stroke > 1.0 || trailAge <= 0.0 || trailAge >= 1.85) {
    return vec4(0.0, 0.0, 0.0, body * uPlanktonPulse.y);
  }
  lateral -= sin(stroke * 6.283185) * 0.36;
  float curl = sin(along * 2.6 + sin(along * 1.3) + trailAge * 2.3);
  lateral += curl * min(0.12, trailAge * 0.09);
  float separation = 0.045 + trailAge * (0.15 + 0.05 * curl);
  float filament = 1.0 - smoothstep(0.015, 0.13, abs(abs(lateral) - separation));
  float flecks = smoothstep(0.06, 0.8,
    sin(along * 27.0 + lateral * 31.0 + curl * 3.0) * sin(along * 13.0 - lateral * 23.0));
  float breaks = smoothstep(-0.8, 0.55, sin(along * 3.7 + lateral * 12.0 + curl * 2.0));
  float envelope = smoothstep(0.0, 0.09, trailAge) * (1.0 - smoothstep(0.23, 1.85, trailAge));
  envelope *= smoothstep(0.0, 0.08, stroke) * (1.0 - smoothstep(0.88, 1.0, stroke));
  float glow = filament * (0.26 + flecks * 0.74) * (0.52 + 0.48 * breaks) * envelope * uPlanktonPulse.y;
  return vec4(vec3(0.016, 0.23, 0.48) * glow, body * uPlanktonPulse.y);
}
`;
