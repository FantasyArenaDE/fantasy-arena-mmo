import * as THREE from 'three';
import { activeWorldIsBuiltinShaped } from '../sim/builtin_shaped_world';
import { EASTBROOK_HARBOR_DECKS } from '../sim/eastbrook_harbor';
import { galeDeckSurfaceAt } from '../sim/gale_harbor';
import { terrainHeight, WATER_LEVEL, waterLevelAt } from '../sim/world';
import {
  harborSwallowPose,
  SWALLOW_COUNT,
  SWALLOW_HALF_SPAN,
  SWALLOW_ROUTE_SAMPLES,
  type SwallowPose,
} from './harbor_swallows_core';

function swallowMaterial(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, vertexColors: true });
}

type Point = readonly [number, number, number];

function swallowGeometry(
  sections: readonly { color: number; triangles: readonly Point[] }[],
): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  for (const { color, triangles } of sections) {
    const tint = new THREE.Color(color);
    for (const vertex of triangles) {
      positions.push(...vertex);
      colors.push(tint.r, tint.g, tint.b);
    }
  }
  return new THREE.BufferGeometry()
    .setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    .setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
}

function swallowBody(): THREE.BufferGeometry {
  const head = [0, 0.035, 0.24] as const;
  const rump = [0, 0, -0.12] as const;
  const left = [-0.065, 0, 0.055] as const;
  const right = [0.065, 0, 0.055] as const;
  const back = [0, 0.075, 0.08] as const;
  const breast = [0, -0.052, 0.01] as const;
  return swallowGeometry([
    {
      color: 0x202f48,
      triangles: [
        head,
        back,
        left,
        head,
        right,
        back,
        left,
        back,
        rump,
        right,
        rump,
        back,
        left,
        rump,
        [-0.09, 0.01, -0.29],
        right,
        [0.09, 0.01, -0.29],
        rump,
      ],
    },
    { color: 0xf1dfbe, triangles: [left, breast, rump, right, rump, breast] },
    { color: 0x9d4f33, triangles: [head, breast, left, head, right, breast] },
  ]);
}

function swallowWing(side: number): THREE.BufferGeometry {
  const tip = [side * SWALLOW_HALF_SPAN, 0.012, -0.09] as const;
  const shoulder = [side * 0.035, 0, 0.09] as const;
  const elbow = [side * 0.19, 0.016, 0.085] as const;
  const trailing = [side * 0.14, 0, -0.085] as const;
  return swallowGeometry([
    { color: 0x28364c, triangles: [shoulder, elbow, trailing, elbow, tip, trailing] },
  ]);
}

export function buildHarborSwallows(seed: number) {
  const group = new THREE.Group();
  group.name = 'eastbrook-harbor-swallows';
  group.visible = false;
  const pier = EASTBROOK_HARBOR_DECKS[3];
  const surface = (x: number, z: number) => terrainHeight(x, z, seed);
  const deckY = galeDeckSurfaceAt(pier, 0, surface, WATER_LEVEL);
  const alongX = Math.sin(pier.rot);
  const alongZ = Math.cos(pier.rot);
  const xAt = (along: number, across: number) => pier.x + alongX * along + alongZ * across;
  const zAt = (along: number, across: number) => pier.z + alongZ * along - alongX * across;
  const pose: SwallowPose = { along: 0, across: 0, height: 0, yaw: 0, bank: 0, flap: 0 };
  const routeClear =
    activeWorldIsBuiltinShaped() &&
    deckY > WATER_LEVEL + 1.4 &&
    Array.from({ length: SWALLOW_ROUTE_SAMPLES }, (_, i) => i).every((i) => {
      harborSwallowPose(i * 0.075, SWALLOW_COUNT - 1, pose);
      const x = xAt(pose.along, pose.across);
      const z = zAt(pose.along, pose.across);
      return waterLevelAt(x, z, seed) === WATER_LEVEL && surface(x, z) < WATER_LEVEL - 0.1;
    });
  const flock: { root: THREE.Group; left: THREE.Mesh; right: THREE.Mesh }[] = [];
  const assets = routeClear
    ? {
        material: swallowMaterial(),
        body: swallowBody(),
        leftWing: swallowWing(1),
        rightWing: swallowWing(-1),
      }
    : null;
  if (assets) {
    const { material, body, leftWing, rightWing } = assets;
    for (let i = 0; i < SWALLOW_COUNT; i++) {
      const root = new THREE.Group();
      const left = new THREE.Mesh(leftWing, material);
      const right = new THREE.Mesh(rightWing, material);
      root.add(new THREE.Mesh(body, material), left, right);
      group.add(root);
      flock.push({ root, left, right });
    }
  }

  return {
    group,
    prewarmMesh() {
      // All three live parts share these shader attributes and flags.
      return assets ? new THREE.Mesh(assets.body, assets.material) : null;
    },
    dispose() {
      group.removeFromParent();
      assets?.body.dispose();
      assets?.leftWing.dispose();
      assets?.rightWing.dispose();
      assets?.material.dispose();
    },
    update(time: number, camX: number, camZ: number, enabled: boolean) {
      group.visible =
        routeClear && enabled && (camX - pier.x) ** 2 + (camZ - pier.z) ** 2 < 62 ** 2;
      if (!group.visible) return;
      for (let i = 0; i < flock.length; i++) {
        const { root, left, right } = flock[i];
        harborSwallowPose(time, i, pose);
        root.position.set(
          xAt(pose.along, pose.across),
          WATER_LEVEL + pose.height,
          zAt(pose.along, pose.across),
        );
        root.rotation.set(0, pier.rot + pose.yaw, -pose.bank, 'YXZ');
        left.rotation.z = pose.flap;
        right.rotation.z = -pose.flap;
      }
    },
  };
}
