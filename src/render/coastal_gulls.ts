import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { coastalGullPose, coastalGullRoutes } from './coastal_gulls_core';
import { GFX } from './gfx';
import { registerGroundDecorPrewarmDraw } from './ground_decor_prewarm';

function colors(geometry: THREE.BufferGeometry, palette: readonly number[]) {
  const color = new THREE.Color();
  const values = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < values.length; i += 3) {
    color.setHex(palette[i / 3] ?? palette[0]).toArray(values, i);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(values, 3));
  return geometry;
}

function gullBody() {
  const parts = [
    colors(new THREE.SphereGeometry(1, 8, 6).scale(0.12, 0.105, 0.32), [0xf4f2e8]),
    colors(
      new THREE.SphereGeometry(1, 8, 6).scale(0.088, 0.082, 0.105).translate(0, 0.055, 0.22),
      [0xfffcf0],
    ),
    colors(
      new THREE.SphereGeometry(1, 8, 6).scale(0.031, 0.023, 0.075).translate(0, 0.047, 0.325),
      [0xdfa653],
    ),
    colors(
      new THREE.SphereGeometry(1, 8, 6).scale(0.11, 0.026, 0.16).translate(0, -0.017, -0.28),
      [0xeeeade],
    ),
  ];
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return merged;
}

function gullWing() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        0, 0, 0.14, 0.32, 0.025, 0.14, 0.6, 0.045, 0.015, 0.82, 0.035, -0.22, 0.57, 0.028, -0.2,
        0.28, 0, -0.18, 0, 0, -0.17,
      ],
      3,
    ),
  );
  geometry.setIndex([0, 1, 5, 0, 5, 6, 1, 2, 4, 1, 4, 5, 2, 3, 4]);
  return colors(geometry, [0xe6e7e6, 0xd6dadd, 0x555d68, 0x222c3c, 0x596473, 0xe8e9e3, 0xf1f0ea]);
}

export function buildCoastalGulls(seed: number) {
  const routes = coastalGullRoutes(seed, GFX.standardMaterials ? 5 : 3);
  const group = new THREE.Group();
  group.name = 'starter-coastal-gulls';
  group.visible = false;
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const bodies = new THREE.InstancedMesh(gullBody(), material, routes.length);
  const wings = new THREE.InstancedMesh(gullWing(), material, routes.length * 2);
  bodies.name = 'coastal-gull-bodies';
  wings.name = 'coastal-gull-wings';
  for (const mesh of [bodies, wings]) {
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    registerGroundDecorPrewarmDraw({ geometry: mesh.geometry, material, instanceColor: false });
    group.add(mesh);
  }
  const bird = new THREE.Object3D();
  const wing = new THREE.Object3D();
  const matrix = new THREE.Matrix4();
  const pose = { x: 0, y: 0, z: 0, yaw: 0, bank: 0, flap: 0 };

  return {
    group,
    update(time: number, x: number, z: number, sunY: number): void {
      group.visible = false;
      const light = THREE.MathUtils.smoothstep(sunY, -0.08, 0.12);
      if (!(light > 0.02)) return;
      let count = 0;
      for (const [i, route] of routes.entries()) {
        if ((x - route.coast.viewX) ** 2 + (z - route.coast.viewZ) ** 2 > 65 ** 2) continue;
        coastalGullPose(route, time, pose);
        bird.position.set(pose.x, pose.y, pose.z);
        bird.rotation.set(0, pose.yaw, pose.bank, 'YXZ');
        bird.scale.setScalar(light * (0.92 + (i % 3) * 0.1));
        bird.updateMatrix();
        bodies.setMatrixAt(count, bird.matrix);
        for (let side = 0; side < 2; side++) {
          wing.rotation.z = side === 0 ? pose.flap : Math.PI - pose.flap;
          wing.updateMatrix();
          wings.setMatrixAt(count * 2 + side, matrix.multiplyMatrices(bird.matrix, wing.matrix));
        }
        count++;
      }
      bodies.count = count;
      wings.count = count * 2;
      if (!count) return;
      bodies.instanceMatrix.needsUpdate = wings.instanceMatrix.needsUpdate = true;
      group.visible = true;
    },
  };
}
