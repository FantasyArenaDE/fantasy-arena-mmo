import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { registerGroundDecorPrewarmDraw } from './ground_decor_prewarm';
import { starterFrogPose, starterFrogRoutes } from './starter_frogs_core';

function frogPart(color: number, x: number, y: number, z: number, w: number, h: number, d: number) {
  const part = new THREE.SphereGeometry(1, 10, 7).scale(w, h, d).translate(x, y, z);
  const tint = new THREE.Color(color);
  const colors = new Float32Array(part.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) tint.toArray(colors, i);
  part.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return part;
}

function frogGeometry() {
  const body = [
    frogPart(0x689c38, 0, 0.13, -0.055, 0.16, 0.124, 0.21),
    frogPart(0x97a957, 0, 0.09, 0.104, 0.134, 0.068, 0.135),
    frogPart(0x78ad46, 0, 0.15, 0.094, 0.164, 0.087, 0.148),
    frogPart(0xb8bb74, 0, 0.088, 0.162, 0.116, 0.044, 0.08),
    frogPart(0x466f31, 0, 0.127, 0.218, 0.121, 0.009, 0.021),
  ];
  const legs: THREE.BufferGeometry[] = [];
  for (const sign of [-1, 1]) {
    body.push(
      frogPart(0x79aa41, sign * 0.113, 0.213, 0.123, 0.066, 0.069, 0.059),
      frogPart(0xe9cb64, sign * 0.128, 0.228, 0.16, 0.038, 0.042, 0.025),
      frogPart(0x242921, sign * 0.132, 0.229, 0.182, 0.024, 0.012, 0.008),
      frogPart(0xffeed1, sign * 0.126, 0.237, 0.188, 0.006, 0.005, 0.004),
      frogPart(0x618634, sign * 0.126, 0.043, 0.137, 0.038, 0.039, 0.077),
    );
    legs.push(
      frogPart(0x53842f, sign * 0.157, 0.095, -0.117, 0.085, 0.077, 0.121),
      frogPart(0x729744, sign * 0.198, 0.036, -0.182, 0.049, 0.033, 0.114),
    );
  }
  const meshes = [mergeGeometries(body), mergeGeometries(legs)];
  for (const part of [...body, ...legs]) part.dispose();
  return meshes;
}

export function buildStarterFrogs(seed: number) {
  const routes = starterFrogRoutes(seed);
  const group = new THREE.Group();
  group.name = 'starter-bank-frogs';
  group.visible = false;
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const [bodies, legs] = frogGeometry().map((geometry) => {
    const mesh = new THREE.InstancedMesh(geometry, material, routes.length);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    registerGroundDecorPrewarmDraw({ geometry, material, instanceColor: false });
    group.add(mesh);
    return mesh;
  });
  bodies.name = 'starter-frog-bodies';
  legs.name = 'starter-frog-legs';
  const body = new THREE.Object3D();
  const limb = new THREE.Object3D();
  const legMatrix = new THREE.Matrix4();
  const pose = { x: 0, y: 0, z: 0, yaw: 0, crouch: 0, kick: 0 };

  return {
    group,
    update(time: number, x: number, z: number, outdoor: boolean): void {
      group.visible = false;
      if (!outdoor) return;
      let count = 0;
      for (const route of routes) {
        if ((route.from.x - x) ** 2 + (route.from.z - z) ** 2 > 42 ** 2) continue;
        starterFrogPose(route, time, pose);
        body.position.set(pose.x, pose.y + 0.015, pose.z);
        body.rotation.set(-0.16 * pose.kick, pose.yaw, 0, 'YXZ');
        body.scale.set(1 + 0.12 * pose.crouch, 1 - 0.28 * pose.crouch, 1 + 0.1 * pose.kick);
        body.updateMatrix();
        bodies.setMatrixAt(count, body.matrix);
        limb.scale.set(1 - 0.23 * pose.kick, 1, 1 + 0.64 * pose.kick);
        limb.updateMatrix();
        legs.setMatrixAt(count, legMatrix.multiplyMatrices(body.matrix, limb.matrix));
        count++;
      }
      bodies.count = legs.count = count;
      if (!count) return;
      bodies.instanceMatrix.needsUpdate = legs.instanceMatrix.needsUpdate = true;
      group.visible = true;
    },
  };
}
