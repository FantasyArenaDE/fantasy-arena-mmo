import * as THREE from 'three';
import { getActiveWorldContent, zoneAt } from '../sim/data';
import { hash2 } from '../sim/rng';
import { generateDecorationsInBounds, terrainHeight, waterLevelAt } from '../sim/world';
import { WIND_FRONT_X, WIND_FRONT_Z } from './ambient_wind_core';
import { targetHeightFor } from './asset_scale';
import { outsideFoliageBounds } from './foliage_editor_scope';
import { GFX } from './gfx';
import { registerGroundDecorPrewarmDraw } from './ground_decor_prewarm';
import {
  LEAF_SETTLE_SECONDS,
  type LeafFall,
  type LeafFallPose,
  leafFallPose,
} from './leaf_fall_core';

const TREE_REACH = 25;
const BROADLEAF_ASSET =
  /^\/models\/(?:foliage\/oak_[1-5](?:_field)?|props\/(?:willow_tree|fantasy-arena\/fen-willow))\.glb$/;

interface LeafTree {
  x: number;
  z: number;
  base: number;
  releaseHeight: number;
  radius: number;
}

function leafSourceTrees(seed: number, x: number, z: number): LeafTree[] {
  const near: LeafTree[] = [];
  const consider = (tree: { x: number; z: number }, height: number, radius: number, lift = 0) => {
    const distance = (tree.x - x) ** 2 + (tree.z - z) ** 2;
    if (distance >= TREE_REACH ** 2 || outsideFoliageBounds(tree.x, tree.z)) return;
    const ground = terrainHeight(tree.x, tree.z, seed);
    if (ground <= waterLevelAt(tree.x, tree.z, seed) + 0.15 || height < 0.65) return;
    near.push({ x: tree.x, z: tree.z, base: ground + lift, releaseHeight: height, radius });
  };
  for (const tree of generateDecorationsInBounds(seed, {
    minX: x - TREE_REACH,
    maxX: x + TREE_REACH,
    minZ: z - TREE_REACH,
    maxZ: z + TREE_REACH,
  })) {
    const isOak = tree.farSpecies
      ? tree.farSpecies === 'oak'
      : tree.biome === 'vale' && (tree.kind === 'tree' || tree.kind === 'tree2');
    // The procedural foliage renderer seats an oak at scale * 1.15.
    if (isOak) consider(tree, tree.scale * 1.15 * 2.7, tree.scale * 1.24);
  }
  for (const placement of getActiveWorldContent().placements ?? []) {
    if (
      !placement ||
      Math.abs(placement.x - x) > TREE_REACH ||
      Math.abs(placement.z - z) > TREE_REACH
    )
      continue;
    if (
      !BROADLEAF_ASSET.test(placement.path) ||
      placement.detached ||
      Math.abs(placement.rotX ?? 0) > 0.08 ||
      Math.abs(placement.rotZ ?? 0) > 0.08
    )
      continue;
    const height = targetHeightFor(placement.path) * placement.scale;
    consider(
      placement,
      height * (placement.scaleY ?? 1) * 0.37,
      Math.max(0.32, Math.min(3.2, height * 0.16)),
      placement.y ?? 0,
    );
  }
  return near.sort((a, b) => (a.x - x) ** 2 + (a.z - z) ** 2 - ((b.x - x) ** 2 + (b.z - z) ** 2));
}

/** Nearest eligible tree, retained for source diagnostics and regression tests. */
export function leafSourceTree(seed: number, x: number, z: number): LeafTree | null {
  return leafSourceTrees(seed, x, z)[0] ?? null;
}

function leafGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        0, 0, -0.16, 0.094, 0.025, -0.061, 0.081, 0.031, 0.07, 0, 0.004, 0.15, -0.073, 0.027, 0.073,
        -0.089, 0.019, -0.044, 0, 0.037, 0.01,
      ],
      3,
    ),
  );
  geo.setIndex([0, 1, 6, 1, 2, 6, 2, 3, 6, 3, 4, 6, 4, 5, 6, 5, 0, 6]);
  return geo;
}

interface LeafActor {
  fall: LeafFall;
  delay: number;
  size: number;
  retired?: boolean;
}

/** Sparse falls from real broadleaf crowns, with a quiet gap between releases. */
export function buildWindblownLeaves(seed: number) {
  const geometry = leafGeometry();
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const capacity = GFX.standardMaterials ? 4 : 3;
  const leaves = new THREE.InstancedMesh(geometry, material, capacity);
  leaves.name = 'eastbrook-windblown-leaves';
  leaves.visible = false;
  leaves.frustumCulled = false;
  leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const palette = [0x9e592e, 0xbd8449, 0x8a6d36, 0xc7a257];
  const color = new THREE.Color();
  for (let i = 0; i < capacity; i++) leaves.setColorAt(i, color.setHex(palette[i]));
  if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
  registerGroundDecorPrewarmDraw({ geometry, material, instanceColor: true });

  const pose = new THREE.Object3D();
  const sample: LeafFallPose = { x: 0, y: 0, z: 0, progress: 0, scale: 0 };
  let active: LeafActor[] = [];
  let previous: LeafTree | null = null;
  let start = -Infinity;
  let end = -Infinity;
  let nextRelease = -Infinity;
  let release = 0;

  function plan(tree: LeafTree): LeafActor[] {
    const count = 2 + Math.floor(hash2(release, 24, seed) * (capacity - 1));
    const actors: LeafActor[] = [];
    for (let i = 0; i < count; i++) {
      const key = release * 7 + i;
      const r = (salt: number) => hash2(key, salt, seed);
      const angle = r(1) * Math.PI * 2;
      const spread = tree.radius * (0.48 + r(2) * 0.47);
      const x = tree.x + Math.cos(angle) * spread;
      const z = tree.z + Math.sin(angle) * spread;
      const y = tree.base + tree.releaseHeight * (0.94 + r(3) * 0.16);
      const drift = 0.85 + r(4) * 1.7;
      const cross = (r(5) - 0.5) * 0.9;
      const endX = x + WIND_FRONT_X * drift + WIND_FRONT_Z * cross;
      const endZ = z + WIND_FRONT_Z * drift - WIND_FRONT_X * cross;
      const endY = terrainHeight(endX, endZ, seed) + 0.038;
      if (y - endY < 0.55 || endY < waterLevelAt(endX, endZ, seed) + 0.06) continue;
      const duration = Math.min(5.1, Math.max(1.9, (y - endY) / (0.82 + r(6) * 0.32)));
      const fall = { x, y, z, endX, endY, endZ, duration, flutter: r(7) * Math.PI * 2 };
      actors.push({ fall, delay: i * (0.38 + r(8) * 0.24), size: 0.58 + r(9) * 0.32 });
    }
    return actors;
  }

  return {
    leaves,
    update(px: number, pz: number, time: number): boolean {
      leaves.visible = false;
      if (!Number.isFinite(time) || zoneAt(px, pz).id !== 'eastbrook_vale') {
        active = [];
        nextRelease = -Infinity;
        return false;
      }
      if (nextRelease === -Infinity) nextRelease = time + 2.0 + hash2(release, 28, seed) * 2.2;
      if (time >= nextRelease) {
        const trees = leafSourceTrees(seed, px, pz);
        const other = trees.filter(
          (tree) => !previous || Math.hypot(tree.x - previous.x, tree.z - previous.z) > 0.3,
        );
        const choices = other.length ? other.slice(0, 3) : trees.slice(0, 3);
        const offset = previous ? Math.floor(hash2(release, 29, seed) * choices.length) : 0;
        let tree: LeafTree | undefined;
        active = [];
        for (let i = 0; i < choices.length && !active.length; i++) {
          tree = choices[(offset + i) % choices.length];
          active = plan(tree);
        }
        release++;
        if (tree && active.length) {
          previous = tree;
          start = time;
          end =
            start +
            Math.max(...active.map((actor) => actor.delay + actor.fall.duration)) +
            LEAF_SETTLE_SECONDS;
          nextRelease = end + 15 + hash2(release, 30, seed) * 10;
        } else nextRelease = time + 1.8;
      }
      if (
        !active.length ||
        time >= end ||
        !previous ||
        (px - previous.x) ** 2 + (pz - previous.z) ** 2 > 42 ** 2
      )
        return false;
      for (let i = 0; i < capacity; i++) {
        const actor = active[i];
        if (actor && !actor.retired) {
          leafFallPose(actor.fall, time - start - actor.delay, sample);
          const ground = terrainHeight(sample.x, sample.z, seed);
          const above =
            sample.y >= ground + 0.02 && ground > waterLevelAt(sample.x, sample.z, seed);
          if (sample.scale > 0 && !above) actor.retired = true;
          const size = above ? sample.scale * actor.size : 0;
          const flutter = (1 - sample.progress) * actor.fall.flutter + sample.progress * 8;
          const airborne = 1 - sample.progress;
          pose.position.set(sample.x, sample.y, sample.z);
          pose.rotation.set(
            Math.sin(flutter * 1.5) * airborne,
            flutter,
            Math.cos(flutter * 1.7) * airborne * 0.9,
          );
          pose.scale.setScalar(size);
          leaves.visible ||= size > 0;
        } else pose.scale.setScalar(0);
        pose.updateMatrix();
        leaves.setMatrixAt(i, pose.matrix);
      }
      leaves.instanceMatrix.needsUpdate = true;
      return leaves.visible;
    },
  };
}
