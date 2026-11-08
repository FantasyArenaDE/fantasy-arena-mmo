import type * as THREE from 'three';
import { WIND_FRONT_X, WIND_FRONT_Z } from './ambient_wind_core';
import { sharedUniforms } from './gfx';
import { windGustGlsl } from './grass_tuft_wind';

/** Deform the tips only, keeping the shoreline roots planted. */
export function reedWindMaterial(base: THREE.Material, height: number): THREE.Material {
  const material = base.clone();
  const baseKey = base.customProgramCacheKey();
  const reach = Math.max(height, 0.01).toFixed(4);
  material.customProgramCacheKey = () => `reed-wind-v1:${reach}:${baseKey}`;
  material.onBeforeCompile = (shader, renderer) => {
    base.onBeforeCompile.call(material, shader, renderer);
    shader.uniforms.uReedWindTime = sharedUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uReedWindTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec2 wocReedOrigin = instanceMatrix[3].xz;
  float wocReedGust = ${windGustGlsl('wocReedOrigin.x', 'wocReedOrigin.y', 'uReedWindTime')};
  float wocReedTip = smoothstep(0.0, ${reach}, position.y);
  vec2 wocReedDirection = vec2(${WIND_FRONT_X.toFixed(5)}, ${WIND_FRONT_Z.toFixed(5)});
  float wocReedBend = (wocReedGust * wocReedGust * 0.075 + 0.012 * sin(
    uReedWindTime * 2.1 + wocReedOrigin.x * 0.38 + wocReedOrigin.y * 0.4
  )) * wocReedTip * wocReedTip;
  transformed.x += dot(wocReedDirection, normalize(instanceMatrix[0].xz)) * wocReedBend;
  transformed.z += dot(wocReedDirection, normalize(instanceMatrix[2].xz)) * wocReedBend;
#endif`,
      );
  };
  return material;
}
