import * as THREE from 'three';
import { activeWorldIsBuiltinShaped } from '../sim/builtin_shaped_world';
import { waterLevel } from '../sim/world';
import { GFX } from './gfx';
import {
  harborCrabShadow,
  harborCrabSites,
  makeHarborCrabMotion,
  stepHarborCrab,
} from './harbor_crab_core';

interface Point {
  x: number;
  y: number;
  z: number;
}

export interface HarborCrabEnvironment {
  sun: Point;
  playerFeet(): Point;
  rainStrength(): number;
}

type GroundAt = (x: number, z: number) => number;
const RANGE_SQ = 26 * 26;
const PARTS = 25;

export function buildHarborCrabs(ground: GroundAt, environment: HarborCrabEnvironment) {
  const sites = activeWorldIsBuiltinShaped() ? harborCrabSites(ground, waterLevel()) : [];
  if (sites.length === 0) return null;

  const group = new THREE.Group();
  group.name = 'eastbrook-harbor-crabs';
  const material = GFX.standardMaterials
    ? new THREE.MeshStandardMaterial({ roughness: 0.74 })
    : new THREE.MeshLambertMaterial();
  const shellGeometry = new THREE.IcosahedronGeometry(1, 1);
  const crabs = new THREE.InstancedMesh(shellGeometry, material, sites.length * PARTS);
  crabs.name = 'harbor-crab-batch';
  crabs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  crabs.frustumCulled = false;
  crabs.receiveShadow = true;
  const rockGeometry = new THREE.DodecahedronGeometry(1);
  const rocks = new THREE.InstancedMesh(rockGeometry, material, sites.length * 3);
  rocks.name = 'harbor-crab-crevices';
  rocks.receiveShadow = true;
  group.add(rocks, crabs);

  const pose = new THREE.Object3D();
  const states = sites.map(makeHarborCrabMotion);
  const heights = sites.map(({ x, z, endX, endZ }) =>
    Array.from({ length: 9 }, (_, i) =>
      ground(THREE.MathUtils.lerp(x, endX, i / 8), THREE.MathUtils.lerp(z, endZ, i / 8)),
    ),
  );
  function pathHeight(i: number, travel: number): number {
    const position = travel * 8;
    const lower = Math.min(7, Math.floor(position));
    return THREE.MathUtils.lerp(heights[i][lower], heights[i][lower + 1], position - lower);
  }
  const shells = [0xa65238, 0x9d4937, 0xb86649].map((hex) => new THREE.Color(hex));
  const limbs = [0x97452d, 0x863e29, 0xa75936].map((hex) => new THREE.Color(hex));
  const sides = [-1, 1];
  const dark = new THREE.Color(0x251b18);
  const stone = new THREE.Color(0x737b80);
  const wetStone = new THREE.Color(0x60696e);
  const axes = sites.map(({ x, z, endX, endZ }) => {
    const midX = (x + endX) / 2;
    const midZ = (z + endZ) / 2;
    const h = 0.4;
    const slopeX = (ground(midX + h, midZ) - ground(midX - h, midZ)) / (2 * h);
    const slopeZ = (ground(midX, midZ + h) - ground(midX, midZ - h)) / (2 * h);
    const normal = new THREE.Vector3(-slopeX, 1, -slopeZ).normalize();
    const tangent = new THREE.Vector3(endX - x, 0, endZ - z).projectOnPlane(normal).normalize();
    const across = new THREE.Vector3().crossVectors(tangent, normal);
    return {
      tangent,
      rotation: new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(tangent, normal, across),
      ),
    };
  });

  let x = 0;
  let y = 0;
  let z = 0;
  let index = 0;
  let orientation = axes[0].rotation;
  const swingAxis = new THREE.Vector3(0, 0, 1);
  const swingRotation = new THREE.Quaternion();

  function place(
    mesh: THREE.InstancedMesh,
    offsetX: number,
    offsetY: number,
    offsetZ: number,
    width: number,
    height: number,
    depth: number,
    swing: number,
    color: THREE.Color,
  ): void {
    pose.position.set(offsetX, offsetY, offsetZ).applyQuaternion(orientation);
    pose.position.x += x;
    pose.position.y += y;
    pose.position.z += z;
    pose.quaternion.copy(orientation).multiply(swingRotation.setFromAxisAngle(swingAxis, swing));
    pose.scale.set(width, height, depth);
    pose.updateMatrix();
    mesh.setMatrixAt(index, pose.matrix);
    mesh.setColorAt(index++, color);
  }

  for (const [i, site] of sites.entries()) {
    const { tangent, rotation } = axes[i];
    orientation = rotation;
    x = site.x - tangent.x * 0.14;
    z = site.z - tangent.z * 0.14;
    y = ground(x, z);
    place(rocks, 0, -0.075, 0.3, 0.54, 0.33, 0.32, -0.15, stone);
    place(rocks, -0.13, -0.06, -0.27, 0.52, 0.27, 0.26, 0.11, stone);
    x = THREE.MathUtils.lerp(site.x, site.endX, 0.68);
    z = THREE.MathUtils.lerp(site.z, site.endZ, 0.68);
    y = ground(x, z);
    place(rocks, 0, -0.07, 0, 0.49, 0.16, 0.33, 0, wetStone);
  }
  rocks.computeBoundingSphere();

  function paint(i: number, reducedMotion: boolean): void {
    const shell = shells[i % shells.length];
    const limb = limbs[i % limbs.length];
    const state = states[i];
    const gait = reducedMotion ? 0 : state.travel * 39 + i * 1.67;
    const step = Math.sin(gait) * 0.028;
    place(crabs, 0, 0.155 + Math.abs(step) * 0.5, 0, 0.265, 0.116, 0.174, 0, shell);
    for (const side of sides) {
      for (let leg = 0; leg < 4; leg++) {
        const stroke = Math.sin(gait + leg * Math.PI + side) * (reducedMotion ? 0 : 0.038);
        const at = leg * 0.077 - 0.119;
        place(crabs, side * 0.25, 0.1 + stroke, at, 0.117, 0.024, 0.025, side * 0.22, limb);
        place(
          crabs,
          side * 0.385,
          0.048 + Math.max(0, stroke),
          at - 0.021,
          0.089,
          0.018,
          0.018,
          side * -0.42,
          limb,
        );
      }
      place(crabs, side * 0.214, 0.127, 0.155, 0.096, 0.037, 0.068, side * 0.15, limb);
      place(crabs, side * 0.257, 0.142, 0.229 + step, 0.1, 0.055, 0.08, side * 0.15, shell);
      place(crabs, side * 0.204, 0.143, 0.288 + step, 0.05, 0.025, 0.05, side * -0.2, shell);
    }
    // Two inset black eyes share the shell geometry and instance batch.
    place(crabs, -0.11, 0.238, 0.113, 0.025, 0.025, 0.025, 0, dark);
    place(crabs, 0.11, 0.238, 0.113, 0.025, 0.025, 0.025, 0, dark);
  }

  function update(camX: number, camZ: number, dt: number, reducedMotion: boolean): void {
    index = 0;
    const rain = environment.rainStrength();
    const player = environment.playerFeet();
    for (let i = 0; i < sites.length; i++) {
      const site = sites[i];
      const dx = camX - site.x;
      const dz = camZ - site.z;
      if (dx * dx + dz * dz > RANGE_SQ) continue;
      const state = states[i];
      const previousX = THREE.MathUtils.lerp(site.x, site.endX, state.travel);
      const previousZ = THREE.MathUtils.lerp(site.z, site.endZ, state.travel);
      const height = pathHeight(i, state.travel);
      const startled =
        rain > 0.32 ||
        harborCrabShadow(previousX, height + 0.17, previousZ, player, environment.sun);
      stepHarborCrab(state, site, Math.min(dt, 0.1), startled, reducedMotion);
      if (state.travel < 0.075) continue;
      x = THREE.MathUtils.lerp(site.x, site.endX, state.travel);
      z = THREE.MathUtils.lerp(site.z, site.endZ, state.travel);
      const rise = Math.max(0, 1 - Math.abs(state.travel - 0.68) / 0.27) * 0.095;
      y = pathHeight(i, state.travel) + rise - Math.max(0, 0.33 - state.travel) * 0.66;
      orientation = axes[i].rotation;
      paint(i, reducedMotion);
    }
    crabs.count = index;
    crabs.visible = index > 0;
    if (index > 0) {
      crabs.instanceMatrix.needsUpdate = true;
      if (crabs.instanceColor) crabs.instanceColor.needsUpdate = true;
    }
  }

  // The reveal path must compile the instanced-color variant even when every
  // crab is sheltered, and can only see visible descendants of the root.
  crabs.setColorAt(0, shells[0]);
  crabs.count = 0;
  const focus = { x: -106, z: -55 };
  return {
    group,
    focus,
    inRange(camX: number, camZ: number): boolean {
      return Math.abs(camX - focus.x) < 35 && Math.abs(camZ - focus.z) < 47;
    },
    update,
    dispose(): void {
      group.removeFromParent();
      crabs.dispose();
      rocks.dispose();
      shellGeometry.dispose();
      rockGeometry.dispose();
      material.dispose();
    },
  };
}
