import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { hash2 } from '../sim/rng';
import { waterLevel } from '../sim/world';
import { GFX } from './gfx';
import { registerGroundDecorPrewarmDraw } from './ground_decor_prewarm';
import { dragonflyDaylight } from './starter_insects_core';
import { waterFloraRegions } from './water_flora_core';
import { thinLeanDressing } from './zone_dressing_lod_core';

function bodyGeometry() {
  const thorax = new THREE.SphereGeometry(1, 8, 5).scale(0.055, 0.052, 0.093);
  const tail = new THREE.SphereGeometry(1, 7, 4)
    .scale(0.025, 0.029, 0.21)
    .translate(0, -0.014, -0.21);
  const head = new THREE.SphereGeometry(1, 8, 5)
    .scale(0.058, 0.038, 0.039)
    .translate(0, 0.012, 0.092);
  const geometry = mergeGeometries([thorax, tail, head]);
  thorax.dispose();
  tail.dispose();
  head.dispose();
  return geometry;
}

function wingGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        0, 0, 0.046, 0.27, 0, 0.085, 0.34, 0, 0.04, 0.25, 0, 0.005, 0, 0, -0.016, 0.22, 0, -0.069,
        0.29, 0, -0.118, 0.2, 0, -0.139,
      ],
      3,
    ),
  );
  geometry.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  return geometry;
}

/** A fixed little pool around the very same reed clumps the lake draws. */
export function buildStarterDragonflies(seed: number) {
  const group = new THREE.Group();
  group.name = 'eastbrook-dragonflies';
  group.visible = false;
  const reeds = waterFloraRegions(seed)[0]?.reeds ?? [];
  const habitat = thinLeanDressing(reeds, GFX.leanFoliage).slice(0, GFX.standardMaterials ? 5 : 3);
  if (habitat.length === 0) return { group, update: () => false };
  const actors = habitat.flatMap((reed, i) =>
    [0, 1].map((j) => {
      const phase = hash2(i, j, seed ^ 0x9613) * Math.PI * 2;
      return { reed, phase, rate: 0.8 + j * 0.27 + i * 0.055 };
    }),
  );
  const bodyMat = new THREE.MeshBasicMaterial();
  const wingMat = new THREE.MeshBasicMaterial({
    color: 0xbbebed,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.66,
    depthWrite: false,
  });
  const bodies = new THREE.InstancedMesh(bodyGeometry(), bodyMat, actors.length);
  const wings = new THREE.InstancedMesh(wingGeometry(), wingMat, actors.length * 2);
  bodies.frustumCulled = wings.frustumCulled = false;
  for (const mesh of [bodies, wings]) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const tint = new THREE.Color();
  for (const [i] of actors.entries())
    bodies.setColorAt(i, tint.setHex(i % 2 ? 0x58c4a9 : 0x3094c6));
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  registerGroundDecorPrewarmDraw({
    geometry: bodies.geometry,
    material: bodyMat,
    instanceColor: true,
  });
  registerGroundDecorPrewarmDraw({
    geometry: wings.geometry,
    material: wingMat,
    instanceColor: false,
  });
  group.add(bodies, wings);
  const body = new THREE.Object3D();
  const wing = new THREE.Object3D();
  const matrix = new THREE.Matrix4();

  return {
    group,
    update(sunY: number, time: number, x: number, z: number) {
      const daylight = dragonflyDaylight(sunY);
      group.visible = daylight > 0.01 && (x + 92) ** 2 + (z - 88) ** 2 < 90 ** 2;
      if (!group.visible) return false;
      wingMat.opacity = 0.66 * daylight;
      body.scale.setScalar(daylight);
      const surface = waterLevel();
      for (const [i, actor] of actors.entries()) {
        const t = time * actor.rate + actor.phase;
        const turn = t * 0.83 + 0.58 * Math.sin(t * 1.25);
        const radius = 0.9 + 0.46 * Math.sin(t * 0.61 + actor.phase);
        body.position.set(
          actor.reed.x + Math.sin(turn) * radius,
          Math.max(actor.reed.y, surface) + 0.76 + Math.sin(t * 1.9) * 0.29,
          actor.reed.z + Math.cos(turn) * radius,
        );
        body.rotation.set(0.1 * Math.sin(t * 1.9), turn + Math.PI / 2, 0.2 * Math.cos(t));
        body.updateMatrix();
        bodies.setMatrixAt(i, body.matrix);
        const flap = 0.76 * Math.sin(time * (47 + i * 1.7) + actor.phase);
        for (let side = 0; side < 2; side++) {
          // Mirror the plane around the fore-aft axis without a negative
          // instance scale, which InstancedMesh does not support.
          wing.rotation.z = side === 0 ? flap : Math.PI - flap;
          wing.updateMatrix();
          matrix.multiplyMatrices(body.matrix, wing.matrix);
          wings.setMatrixAt(i * 2 + side, matrix);
        }
      }
      bodies.instanceMatrix.needsUpdate = wings.instanceMatrix.needsUpdate = true;
      return true;
    },
  };
}
