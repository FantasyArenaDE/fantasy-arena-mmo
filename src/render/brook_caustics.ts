import type * as THREE from 'three';
import { activeWorldIsBuiltinShaped } from '../sim/builtin_shaped_world';
import { getContentGeneration } from '../sim/data';
import { waterLevel } from '../sim/world';
import { sharedUniforms } from './gfx';

// The Emerald Run bridge in the Palmreach. The projection's world-space
// footprint is shared by the creek-bed dressing and both terrain materials.
export const BROOK_X = -419;
export const BROOK_Z = 996;
export const BROOK_RADIUS = 19;

let worldGeneration = -1;
let inBuiltinLayout = false;
let motionReduced = false;
const lightUniforms = {
  uBrookTime: {
    get value() {
      return motionReduced ? 0 : sharedUniforms.uTime.value;
    },
  },
  uBrookDaylight: sharedUniforms.uDayNight,
  uBrookWaterLevel: {
    get value() {
      const generation = getContentGeneration();
      if (generation !== worldGeneration) {
        worldGeneration = generation;
        inBuiltinLayout = activeWorldIsBuiltinShaped();
      }
      return inBuiltinLayout ? waterLevel() : -10000;
    },
  },
};

export function setBrookReducedMotion(reduced: boolean): void {
  motionReduced = reduced;
}

const BROOK_LIGHT_GLSL = /* glsl */ `
uniform float uBrookTime;
uniform vec3 uBrookDaylight;
uniform float uBrookWaterLevel;

vec3 brookCaustics(vec3 worldPosition, vec3 surfaceLight) {
  vec2 p = worldPosition.xz - vec2(${BROOK_X}.0, ${BROOK_Z}.0);
  float r2 = dot(p, p);
  float depth = uBrookWaterLevel - worldPosition.y;
  if (r2 >= ${BROOK_RADIUS ** 2}.0 || depth <= 0.06 || depth >= 2.8) return surfaceLight;
  vec3 toEye = cameraPosition - worldPosition;
  float d2 = dot(toEye, toEye);
  float day = smoothstep(0.30, 0.72, dot(uBrookDaylight, vec3(0.2126, 0.7152, 0.0722)));
  if (day <= 0.0 || d2 >= 3025.0) return surfaceLight;

  // Three warped wave fronts, with different flows, make the moving light
  // net bend and reconnect instead of scrolling a fixed pattern over the bed.
  float t = mod(uBrookTime, 125.663706);
  vec2 q = p * 1.9;
  q += 0.62 * vec2(sin(q.y * 0.61 + t * 0.60), cos(q.x * 0.72 - t * 0.45));
  float a = abs(sin(q.x + q.y * 0.47 - t * 0.90 + sin(q.y * 0.89) * 0.57));
  float b = abs(sin(q.y - q.x * 0.69 + t * 0.75 + sin(q.x * 0.81) * 0.51));
  float c = abs(sin(q.x * 0.57 - q.y * 0.93 - t * 0.55 + sin(q.x + q.y) * 0.61));
  float line = 1.0 - smoothstep(0.045, 0.23, min(min(a, b), c + 0.09));
  float focus = 0.74 + 0.26 * sin(q.x * 0.38 + q.y * 0.41 + t * 0.40);
  float fade = (1.0 - smoothstep(121.0, ${BROOK_RADIUS ** 2}.0, r2))
    * smoothstep(0.06, 0.4, depth) * (1.0 - smoothstep(1.6, 2.8, depth))
    * (1.0 - smoothstep(625.0, 3025.0, d2));
  return surfaceLight * (1.0 + line * focus * fade * day * vec3(0.62, 0.66, 0.46));
}
`;

/** Use the host's existing world position, or add it for static creek-bed props. */
export function patchBrookCaustics(
  shader: THREE.WebGLProgramParametersWithUniforms,
  world?: string,
) {
  Object.assign(shader.uniforms, lightUniforms);
  if (!world) {
    world = 'vBrookWorld';
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBrookWorld;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvBrookWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
  }
  shader.fragmentShader = shader.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>\n${world === 'vBrookWorld' ? 'varying vec3 vBrookWorld;' : ''}${BROOK_LIGHT_GLSL}`,
    )
    .replace(
      '#include <opaque_fragment>',
      `outgoingLight = brookCaustics(${world}, outgoingLight);\n#include <opaque_fragment>`,
    );
}
