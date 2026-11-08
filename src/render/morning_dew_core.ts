/** Dew forms overnight. Only low morning sunlight makes it sparkle. */
export function morningDewAmount(phase: number, outdoor: boolean): number {
  if (!outdoor || phase <= 0.25 || phase >= 0.415) return 0;
  const rise = Math.min(1, (phase - 0.25) / 0.035);
  const dry = Math.max(0, Math.min(1, (0.415 - phase) / 0.1));
  return rise * rise * (3 - 2 * rise) * dry * dry * (3 - 2 * dry);
}

const DEW_VIEW_RANGE = 22;

// Mirror Lake's open eastern meadow and the green verge outside Eastbrook.
const DEW_MEADOWS = [
  [-59, 65, 32],
  [14, -52, 25],
] as const;

/** No tuft can show dew if the camera is outside the reach of both meadows. */
export function nearDewMeadow(camX: number, camZ: number): boolean {
  return DEW_MEADOWS.some(
    ([x, z, radius]) => (camX - x) ** 2 + (camZ - z) ** 2 < (radius + DEW_VIEW_RANGE) ** 2,
  );
}

export function patchMorningDewFragment(fragment: string): string {
  const inMeadow = DEW_MEADOWS.map(
    ([x, z, radius]) =>
      `distance(vTuftWorld, vec2(${x.toFixed(1)}, ${z.toFixed(1)})) < ${radius.toFixed(1)}`,
  ).join(' || ');
  return fragment
    .replace(
      '#include <common>',
      `#include <common>
      uniform vec3 uMorningDew;
      float dewHash(vec2 q) {
        vec3 v = fract(vec3(q.xyx) * 0.1031);
        v += dot(v, v.yzx + 33.33);
        return fract((v.x + v.y) * v.z);
      }`,
    )
    .replace(
      '#include <opaque_fragment>',
      `#ifdef USE_MAP
      if (uMorningDew.z > 0.0 && vMapUv.y > 0.38 && vMapUv.y < 0.86 &&
          (${inMeadow})) {
        vec2 dewLook = vTuftWorld - cameraPosition.xz;
        float dewDist = length(dewLook);
        if (dewDist > 0.5 && dewDist < ${DEW_VIEW_RANGE.toFixed(1)}) {
          vec2 sunXZ = uMorningDew.xy;
          float dewFacing = dot(dewLook / dewDist, sunXZ / max(0.001, length(sunXZ)));
          if (dewFacing > 0.55) {
            vec2 dewGrid = vMapUv * vec2(6.0, 8.0);
            vec2 dewCell = floor(dewGrid) + floor(vTuftWorld * 13.0) * 1.7;
            float dewSeed = dewHash(dewCell);
            if (dewSeed > 0.54) {
              vec2 dewCenter = vec2(0.32 + 0.36 * dewSeed, 0.28 + 0.44 * dewHash(dewCell + 4.3));
              vec2 dewDelta = fract(dewGrid) - dewCenter;
              float dewRadius = length(dewDelta * vec2(1.0, 1.25));
              float dewDot = 1.0 - smoothstep(0.035, 0.16, dewRadius);
              float dewFlare = smoothstep(0.60 + dewSeed * 0.24, 0.96, dewFacing);
              float dewFade = (1.0 - smoothstep(10.0, ${DEW_VIEW_RANGE.toFixed(1)}, dewDist)) * smoothstep(0.5, 2.4, dewDist);
              outgoingLight += vec3(0.86, 0.95, 1.0) * dewDot * dewFlare * dewFade * uMorningDew.z * 1.5;
            }
          }
        }
      }
      #endif
      #include <opaque_fragment>`,
    );
}
