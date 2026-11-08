import * as THREE from 'three';
import { LAKE, zoneAt } from '../sim/data';
import { hash2 } from '../sim/rng';
import { terrainHeight, waterLevelAt } from '../sim/world';
import { registerGroundDecorPrewarmDraw } from './ground_decor_prewarm';

const { x: LAKE_X, z: LAKE_Z } = LAKE;

export function mirrorLakeMistAmount(sunY: number, sunX: number): number {
  if (!Number.isFinite(sunY) || sunX <= 0) return 0;
  return THREE.MathUtils.smoothstep(sunY, -0.25, -0.045) *
    (1 - THREE.MathUtils.smoothstep(sunY, 0.05, 0.24));
}

function mistTexture(): THREE.DataTexture {
  const width = 96;
  const height = 24;
  const bytes = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / (width - 1);
      const v = y / (height - 1);
      const edge = Math.sin(Math.PI * u) * Math.sin(Math.PI * v) ** 2.2;
      const veil = 0.58 + 0.22 * Math.sin(u * 15 + v * 5) + 0.19 * Math.cos(u * 27 - v * 8);
      bytes[(y * width + x) * 4 + 1] = Math.round(255 * edge * veil);
    }
  }
  const texture = new THREE.DataTexture(bytes, width, height);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** A handful of low, moving wisps restricted to the lake's deep-water centre. */
export function buildMirrorLakeMist(seed: number) {
  const geometry = new THREE.PlaneGeometry(21, 1.28);
  const material = new THREE.MeshBasicMaterial({
    color: 0xbfd4e0,
    transparent: true,
    side: THREE.DoubleSide,
    forceSinglePass: true,
    depthWrite: false,
    alphaMap: mistTexture(),
  });
  const ribbons = new THREE.InstancedMesh(geometry, material, 8);
  ribbons.name = 'mirror-lake-morning-mist';
  ribbons.renderOrder = 1; // Draw above the transparent low-tier water surface.
  ribbons.visible = false;
  ribbons.frustumCulled = false;
  ribbons.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  registerGroundDecorPrewarmDraw({ geometry, material, instanceColor: false });
  const surface = waterLevelAt(LAKE_X, LAKE_Z, seed);
  const zone = zoneAt(LAKE_X, LAKE_Z);
  const wet = zone.id === 'eastbrook_vale' &&
    zone.lakes.some((lake) => lake.x === LAKE_X && lake.z === LAKE_Z) &&
    surface > terrainHeight(LAKE_X, LAKE_Z, seed) + 1;
  const pose = new THREE.Object3D();
  const lanes = Array.from({ length: ribbons.count }, (_, i) => ({
    phase: hash2(i, 1, seed) * Math.PI * 2,
    x: (hash2(i, 2, seed) - 0.5) * 13,
    z: (i - 3.5) * 2.4,
    scale: 0.64 + hash2(i, 3, seed) * 0.34,
  }));

  return {
    ribbons,
    update(x: number, z: number, time: number, sunY: number, sunX: number): boolean {
      const amount = mirrorLakeMistAmount(sunY, sunX);
      ribbons.visible = wet && amount > 0.01 && (x - LAKE_X) ** 2 + (z - LAKE_Z) ** 2 < 102 ** 2;
      if (!ribbons.visible) return false;
      material.opacity = amount * 0.58;
      for (const [i, lane] of lanes.entries()) {
        const wave = lane.phase + time * (0.24 + i * 0.017);
        pose.position.set(
          LAKE_X + lane.x + 4.3 * Math.sin(wave),
          surface + 0.43 + 0.09 * Math.sin(wave * 1.2),
          LAKE_Z + lane.z + Math.cos(wave * 0.8) * 1.8,
        );
        pose.rotation.set(-0.27, 0.43 + 0.1 * Math.sin(lane.phase), 0);
        pose.scale.set(lane.scale, 0.7 + lane.scale * 0.3, 1);
        pose.updateMatrix();
        ribbons.setMatrixAt(i, pose.matrix);
      }
      ribbons.instanceMatrix.needsUpdate = true;
      return true;
    },
  };
}
