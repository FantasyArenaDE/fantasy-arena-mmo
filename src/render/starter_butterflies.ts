import * as THREE from 'three';
import { terrainHeight, waterLevelAt } from '../sim/world';
import { GFX } from './gfx';
import { registerGroundDecorPrewarmDraw } from './ground_decor_prewarm';
import {
  butterflyDaylight,
  butterflyFlight,
  starterButterflyHabitat,
} from './starter_butterflies_core';

const PALETTE = [0xffa53f, 0xdac4ff, 0xffe8a1, 0x78caff];

function wingTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.beginPath();
  ctx.moveTo(3, 35);
  ctx.bezierCurveTo(16, 14, 43, 2, 58, 6);
  ctx.bezierCurveTo(65, 15, 58, 32, 42, 37);
  ctx.bezierCurveTo(53, 44, 41, 59, 28, 59);
  ctx.bezierCurveTo(19, 59, 10, 47, 3, 40);
  ctx.closePath();
  const shade = ctx.createLinearGradient(3, 36, 62, 28);
  shade.addColorStop(0, '#876a66');
  shade.addColorStop(0.43, '#fff8ee');
  shade.addColorStop(0.85, '#ead8d3');
  shade.addColorStop(1, '#b3a29b');
  ctx.fillStyle = shade;
  ctx.fill();
  ctx.strokeStyle = '#413237';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(6, 37);
  ctx.quadraticCurveTo(26, 38, 43, 36);
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.fillStyle = '#69505b';
  for (const [x, y, r] of [
    [49, 15, 3.1],
    [42, 21, 2.1],
    [32, 49, 3.2],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Independent flight paths kept close to the starter meadows. */
export function buildStarterButterflies(seed: number) {
  const group = new THREE.Group();
  group.name = 'starter-butterflies';
  group.visible = false;
  const habitat = starterButterflyHabitat(seed);
  const capacity = GFX.standardMaterials ? 8 : 5;
  const bodies = new THREE.InstancedMesh(
    new THREE.CapsuleGeometry(0.022, 0.14, 3, 5).rotateX(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x393036 }),
    capacity,
  );
  bodies.name = 'starter-butterfly-bodies';
  const wings = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.32, 0.33).rotateX(Math.PI / 2).translate(0.15, 0.014, 0.012),
    new THREE.MeshBasicMaterial({ map: wingTexture(), alphaTest: 0.5, side: THREE.DoubleSide }),
    capacity * 2,
  );
  wings.name = 'starter-butterfly-wings';
  for (const mesh of [bodies, wings]) {
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }
  const tint = new THREE.Color();
  for (let i = 0; i < capacity * 2; i++) wings.setColorAt(i, tint);
  registerGroundDecorPrewarmDraw({
    geometry: bodies.geometry,
    material: bodies.material,
    instanceColor: false,
  });
  registerGroundDecorPrewarmDraw({
    geometry: wings.geometry,
    material: wings.material,
    instanceColor: true,
  });
  group.add(bodies, wings);

  const body = new THREE.Object3D();
  const wing = new THREE.Object3D();
  const matrix = new THREE.Matrix4();
  const pose = { x: 0, z: 0, lift: 0, yaw: 0, flap: 0 };
  const active: number[] = [];
  let centerX = Infinity;
  let centerZ = Infinity;

  return {
    group,
    update(sunY: number, time: number, x: number, z: number): void {
      group.visible = false;
      const light = butterflyDaylight(sunY);
      if (!(light > 0.02)) return;
      if ((x - centerX) ** 2 + (z - centerZ) ** 2 > 5 ** 2) {
        active.length = 0;
        const near = habitat.map((a, i) => ({ i, distance: (a.x - x) ** 2 + (a.z - z) ** 2 }));
        near.sort((a, b) => a.distance - b.distance);
        for (const { i, distance } of near.slice(0, capacity)) {
          if (distance > 28 ** 2) break;
          const slot = active.length;
          active.push(i);
          tint.setHex(PALETTE[i % PALETTE.length]);
          wings.setColorAt(slot * 2, tint);
          wings.setColorAt(slot * 2 + 1, tint);
        }
        if (wings.instanceColor) wings.instanceColor.needsUpdate = true;
        centerX = x;
        centerZ = z;
      }
      for (const [slot, i] of active.entries()) {
        butterflyFlight(habitat[i], time, pose);
        const ground = terrainHeight(pose.x, pose.z, seed);
        body.position.set(pose.x, ground + pose.lift, pose.z);
        body.rotation.set(0, pose.yaw, 0);
        const dry = ground > waterLevelAt(pose.x, pose.z, seed);
        body.scale.setScalar(dry ? light * (0.82 + (i % 3) * 0.09) : 0);
        body.updateMatrix();
        bodies.setMatrixAt(slot, body.matrix);
        for (let side = 0; side < 2; side++) {
          wing.rotation.z = side === 0 ? pose.flap : Math.PI - pose.flap;
          wing.updateMatrix();
          matrix.multiplyMatrices(body.matrix, wing.matrix);
          wings.setMatrixAt(slot * 2 + side, matrix);
        }
      }
      bodies.count = active.length;
      wings.count = active.length * 2;
      bodies.instanceMatrix.needsUpdate = wings.instanceMatrix.needsUpdate = active.length > 0;
      group.visible = active.length > 0;
    },
  };
}
