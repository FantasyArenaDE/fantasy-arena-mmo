import * as THREE from 'three';
import { zoneAt } from '../sim/data';
import { hash2 } from '../sim/rng';
import { terrainHeight, waterLevelAt } from '../sim/world';
import {
  WIND_FRONT_SPEED,
  WIND_FRONT_X,
  WIND_FRONT_Z,
  WIND_TRACE_DURATION,
  windTraceAge,
  windTraceOpacity,
} from './ambient_wind_core';
import { GFX } from './gfx';
import { registerGroundDecorPrewarmDraw } from './ground_decor_prewarm';

function traceGeometry(): THREE.BufferGeometry {
  const points = [];
  const uv = [];
  const indices = [];
  const segments = 12;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const wave = Math.sin(t * Math.PI * 1.7);
    const width = 0.055 + 0.1 * Math.sin(t * Math.PI);
    for (const side of [-1, 1]) {
      points.push(wave * 0.48 + side * width * 0.55, wave * 0.24 + side * width, (t - 0.5) * 8);
      uv.push(t, (side + 1) / 2);
    }
    if (i < segments) {
      const j = i * 2;
      indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  return geometry;
}

function traceAlpha(): THREE.DataTexture {
  const width = 64;
  const height = 16;
  const data = new Uint8Array(width * height * 4);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const ends = Math.sin((Math.PI * x) / (width - 1)) ** 0.8;
      const sides = Math.sin((Math.PI * y) / (height - 1)) ** 2;
      data[(y * width + x) * 4 + 1] = Math.round(255 * ends * sides);
    }
  }
  const texture = new THREE.DataTexture(data, width, height);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Sparse, world-anchored tracers for the open starter landscape. */
export function buildAmbientWind(seed: number) {
  const geometry = traceGeometry();
  const material = new THREE.MeshBasicMaterial({
    color: 0xd5edf2,
    alphaMap: traceAlpha(),
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });
  const count = GFX.standardMaterials ? 7 : 4;
  const traces = new THREE.InstancedMesh(geometry, material, count);
  traces.name = 'eastbrook-wind-traces';
  traces.visible = false;
  traces.frustumCulled = false;
  traces.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  registerGroundDecorPrewarmDraw({ geometry, material, instanceColor: false });
  const pose = new THREE.Object3D();
  pose.rotation.y = Math.atan2(WIND_FRONT_X, WIND_FRONT_Z);
  const ground = (x: number, z: number) =>
    Math.max(terrainHeight(x, z, seed), waterLevelAt(x, z, seed));
  const lanes = Array.from({ length: count }, (_, i) => ({
    offset: (i - (count - 1) / 2) * 1.7 + hash2(i, 1, seed),
    stagger: (hash2(i, 2, seed) - 0.5) * 10,
    height: 0.48 + hash2(i, 3, seed) * 1.1,
    scale: 0.62 + hash2(i, 4, seed) * 0.44,
  }));
  let started = Number.NEGATIVE_INFINITY;
  let expires = Number.NEGATIVE_INFINITY;
  let anchorX = 0;
  let anchorZ = 0;
  return {
    traces,
    update(x: number, z: number, time: number, yaw: number): boolean {
      const zone = Number.isFinite(time) ? zoneAt(x, z).id : '';
      if (zone !== 'eastbrook_vale' && zone !== 'proving_shore') {
        traces.visible = false;
        expires = Number.NEGATIVE_INFINITY;
        return false;
      }
      if (time < expires && (x - anchorX) ** 2 + (z - anchorZ) ** 2 > 70 ** 2) {
        started = expires = Number.NEGATIVE_INFINITY;
      }
      if (time >= expires) {
        const aheadX = x + Math.sin(yaw) * 16;
        const aheadZ = z + Math.cos(yaw) * 16;
        const age = windTraceAge(aheadX, aheadZ, time);
        if (time - started >= 14 && age < 0.48) {
          started = time - age;
          expires = started + WIND_TRACE_DURATION;
          anchorX = aheadX;
          anchorZ = aheadZ;
        }
      }
      const age = time - started;
      traces.visible = time < expires && age >= 0;
      if (!traces.visible) return false;
      material.opacity = 0.48 * windTraceOpacity(age);
      const advance = (age - WIND_TRACE_DURATION / 2) * WIND_FRONT_SPEED;
      for (const [i, lane] of lanes.entries()) {
        const along = advance + lane.stagger;
        const wx = anchorX + WIND_FRONT_X * along + WIND_FRONT_Z * lane.offset;
        const wz = anchorZ + WIND_FRONT_Z * along - WIND_FRONT_X * lane.offset;
        pose.position.set(wx, ground(wx, wz) + lane.height, wz);
        pose.scale.set(lane.scale, lane.scale, lane.scale);
        pose.updateMatrix();
        traces.setMatrixAt(i, pose.matrix);
      }
      traces.instanceMatrix.needsUpdate = true;
      return true;
    },
  };
}
