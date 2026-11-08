import * as THREE from 'three';
import { isBuiltinWorldActive } from '../sim/data';
import { terrainHeight } from '../sim/world';
import type { TreeHideable } from './tree_hide_fade';
import { WOODPECKER_TREES } from './woodpecker_core';

export interface WoodpeckerPerch {
  x: number;
  y: number;
  z: number;
  yaw: number;
  tree: TreeHideable;
}

export function buildWoodpeckerPerches(
  trees: readonly TreeHideable[],
  seed: number,
): WoodpeckerPerch[] {
  if (!isBuiltinWorldActive()) return [];
  const ray = new THREE.Raycaster();
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const probe = new THREE.Mesh();
  // The probe borrows each real tree part before raycasting and never draws.
  probe.geometry.dispose();
  (probe.material as THREE.Material).dispose();
  const hits: THREE.Intersection[] = [];
  const perches: WoodpeckerPerch[] = [];
  for (const { x, z, dx, dz, height } of WOODPECKER_TREES) {
    const tree = trees.find((t) => Math.abs(t.x - x) < 0.06 && Math.abs(t.z - z) < 0.06);
    if (!tree) continue;
    const ground = terrainHeight(tree.x, tree.z, seed);
    const facing = Math.atan2(dx, dz);
    ray.near = 0.72;
    ray.far = 1.8;
    const barkAt = (heightY: number): THREE.Vector3 | undefined => {
      origin.set(tree.x - direction.x * 1.5, heightY, tree.z - direction.z * 1.5);
      ray.set(origin, direction);
      hits.length = 0;
      for (const part of tree.parts) {
        if (!part.bark) continue;
        probe.geometry = part.mesh.geometry;
        probe.material = part.mesh.material;
        probe.matrixWorld.copy(part.visibleMatrix);
        ray.intersectObject(probe, false, hits);
      }
      return hits[0]?.point;
    };
    // Different graphics tiers choose different oak meshes. Try nearby bark
    // on the path-facing side before giving up on an uneven or forked trunk.
    let placed = false;
    for (const heightOffset of [0, -0.22, -0.43, 0.18]) {
      const y = ground + height + heightOffset;
      for (const turn of [0, -0.38, 0.38, -0.76, 0.76]) {
        const yaw = facing + turn;
        direction.set(-Math.sin(yaw), 0, -Math.cos(yaw));
        const tip = barkAt(y + 0.13);
        const feet = barkAt(y - 0.059);
        if (!tip || !feet || Math.hypot(tip.x - feet.x, tip.z - feet.z) > 0.085) continue;
        perches.push({ x: tip.x, y, z: tip.z, yaw, tree });
        placed = true;
        break;
      }
      if (placed) break;
    }
  }
  return perches;
}
