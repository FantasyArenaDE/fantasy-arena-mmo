import * as THREE from 'three';
import { getActiveWorldContent, zoneAt } from '../sim/data';
import {
  type Decoration,
  generateDecorationsInBounds,
  terrainHeight,
  waterLevelAt,
} from '../sim/world';
import { outsideFoliageBounds } from './foliage_editor_scope';
import { farDecorationFor } from './foliage_far_placements_core';
import { registerGroundDecorPrewarmDraw } from './ground_decor_prewarm';

const REACH = 36;
const TREE_LIMIT = 2;
const GAPS = [-1.15, 0.85];

export function forestBeamDaylight(sunY: number): number {
  return (
    THREE.MathUtils.smoothstep(sunY, 0.09, 0.27) *
    (1 - THREE.MathUtils.smoothstep(sunY, 0.66, 0.88))
  );
}

export function forestBeamTrees(
  seed: number,
  x: number,
  z: number,
  placedOaks: readonly Decoration[] = [],
) {
  if (zoneAt(x, z).id !== 'eastbrook_vale') return [];
  const bounds = { minX: x - REACH, maxX: x + REACH, minZ: z - REACH, maxZ: z + REACH };
  const trees = generateDecorationsInBounds(seed, bounds).filter(
    (tree) => tree.kind !== 'rock' && tree.biome === 'vale',
  );
  for (const tree of placedOaks) {
    if (Math.abs(tree.x - x) <= REACH && Math.abs(tree.z - z) <= REACH) trees.push(tree);
  }
  const dryTrees = trees.flatMap((tree) => {
    const distance = Math.hypot(tree.x - x, tree.z - z);
    if (distance > REACH || outsideFoliageBounds(tree.x, tree.z)) return [];
    const y = terrainHeight(tree.x, tree.z, seed);
    return y > waterLevelAt(tree.x, tree.z, seed) ? [{ ...tree, y, distance }] : [];
  });
  dryTrees.sort((a, b) => a.distance - b.distance);
  const nearby = [];
  for (const tree of dryTrees) {
    if (
      dryTrees.some(
        (other) => other !== tree && (tree.x - other.x) ** 2 + (tree.z - other.z) ** 2 < 18 ** 2,
      )
    )
      nearby.push(tree);
    if (nearby.length === TREE_LIMIT) break;
  }
  return nearby;
}

function beamTexture(): THREE.DataTexture {
  const width = 32;
  const height = 64;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    const along =
      THREE.MathUtils.smoothstep(v, 0, 0.58) * (1 - THREE.MathUtils.smoothstep(v, 0.74, 1));
    for (let x = 0; x < width; x++) {
      const u = Math.abs((x / (width - 1)) * 2 - 1);
      pixels[(y * width + x) * 4 + 1] = 255 * along * (1 - u * u) ** 2;
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Short world-space shafts through nearby crown gaps, following the real sun. */
export function buildForestSunbeams(seed: number) {
  const geometry = new THREE.PlaneGeometry(1, 1);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    if (positions.getY(i) > 0) positions.setX(i, positions.getX(i) * 0.45);
  }
  const material = new THREE.MeshBasicMaterial({
    color: 0xffdda5,
    alphaMap: beamTexture(),
    transparent: true,
    side: THREE.DoubleSide,
    forceSinglePass: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const beams = new THREE.InstancedMesh(geometry, material, TREE_LIMIT * GAPS.length);
  beams.name = 'eastbrook-canopy-sunbeams';
  beams.count = 0;
  beams.visible = false;
  beams.frustumCulled = false;
  beams.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  registerGroundDecorPrewarmDraw({ geometry, material, instanceColor: false });

  const placedOaks = (getActiveWorldContent().placements ?? []).flatMap((placement) => {
    const tree = farDecorationFor(placement, 'vale');
    return tree?.farSpecies === 'oak' ? [tree] : [];
  });
  let trees: ReturnType<typeof forestBeamTrees> = [];
  let sampledX = Infinity;
  let sampledZ = Infinity;
  const side = new THREE.Vector3();
  const center = new THREE.Vector3();
  const across = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const pose = new THREE.Matrix4();
  const scale = new THREE.Vector3();

  return {
    beams,
    update(camera: THREE.Vector3, sun: THREE.Vector3, outdoor: boolean): void {
      const daylight = outdoor ? forestBeamDaylight(sun.y) : 0;
      beams.visible = false;
      if (!(daylight > 0.01)) return;
      if ((camera.x - sampledX) ** 2 + (camera.z - sampledZ) ** 2 > 5 ** 2) {
        trees = forestBeamTrees(seed, camera.x, camera.z, placedOaks);
        sampledX = camera.x;
        sampledZ = camera.z;
      }
      if (!trees.length) return;
      side.set(sun.z, 0, -sun.x).normalize();
      beams.count = 0;
      for (const tree of trees) {
        for (let i = 0; i < GAPS.length; i++) {
          const height = (4.25 + i * 0.55) * tree.scale;
          const length = Math.min(15, (height * (0.76 + i * 0.12)) / sun.y);
          center
            .set(tree.x, tree.y + height, tree.z)
            .addScaledVector(side, GAPS[i] * tree.scale)
            .addScaledVector(sun, -length / 2);
          normal.subVectors(camera, center);
          across.crossVectors(sun, normal).normalize();
          normal.crossVectors(across, sun);
          scale.set((1.05 + i * 0.48) * tree.scale, length, 1);
          pose.makeBasis(across, sun, normal).scale(scale).setPosition(center);
          beams.setMatrixAt(beams.count++, pose);
        }
      }
      material.opacity = daylight * 0.16;
      beams.instanceMatrix.needsUpdate = true;
      beams.visible = true;
    },
  };
}
