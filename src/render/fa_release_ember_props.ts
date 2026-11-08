import * as THREE from 'three';
import { LAVA_PIECE_METRICS } from './lava_chain_core';
import { surfaceMat } from './gfx';

type EmberProp = 'pool' | 'riverMid' | 'riverEnd' | 'hoard' | 'eggs' | 'lily';

function part(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function lavaProp(kind: 'pool' | 'mid' | 'end'): THREE.Group {
  const group = new THREE.Group();
  const { cross, melt } = LAVA_PIECE_METRICS[kind];
  const basalt = surfaceMat({ color: 0x4a322d, roughness: 0.96, side: THREE.DoubleSide });
  const magma = surfaceMat({
    color: 0xff8733,
    emissive: 0xef4b14,
    emissiveIntensity: 1.05,
    roughness: 0.58,
    side: THREE.DoubleSide,
    vertexColors: true,
  });
  const outline = new THREE.Shape();
  if (kind === 'pool') {
    outline.absellipse(0, 0, 0.5, cross * 0.5, 0, 2 * Math.PI);
  } else {
    const profile =
      kind === 'mid'
        ? [
            [-0.5, 0.47],
            [-0.22, 0.89],
            [-0.15, 1],
            [0.15, 1],
            [0.32, 0.88],
            [0.5, 0.52],
          ]
        : [
            [-0.5, 0.12],
            [-0.34, 0.54],
            [-0.06, 0.86],
            [0.24, 1],
            [0.5, 0.84],
          ];
    for (const [i, [x, width]] of profile.entries()) {
      const y = width * cross * 0.5;
      if (i === 0) outline.moveTo(x, y);
      else outline.lineTo(x, y);
    }
    for (const [x, width] of [...profile].reverse()) outline.lineTo(x, -width * cross * 0.5);
    outline.closePath();
  }
  const base = new THREE.ShapeGeometry(outline, 24).rotateX(-Math.PI / 2);
  part(group, base, basalt);
  const hot = base.clone().scale(0.98, 1, 0.91);
  const points = hot.getAttribute('position');
  const rgb = new Float32Array(points.count * 3);
  const honey = new THREE.Color(0xffc260);
  const coal = new THREE.Color(0xc94318);
  for (let i = 0; i < points.count; i++) {
    const band = (1 + Math.sin(points.getX(i) * 19 - points.getZ(i) * 28)) * 0.5;
    coal
      .clone()
      .lerp(honey, band)
      .toArray(rgb, i * 3);
  }
  hot.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  part(group, hot, magma, 0, melt, 0).name = 'MeltSurface';
  return group;
}

export function buildReleaseEmberProp(key: EmberProp): THREE.Group {
  if (key === 'pool') return lavaProp('pool');
  if (key === 'riverMid') return lavaProp('mid');
  if (key === 'riverEnd') return lavaProp('end');

  const group = new THREE.Group();
  const rock = surfaceMat({ color: 0x594139, roughness: 0.92 });
  part(group, new THREE.CylinderGeometry(0.46, 0.5, 0.13, 11), rock, 0, 0.065);
  if (key === 'hoard') {
    const gold = surfaceMat({ color: 0xf2bd59, roughness: 0.47, metalness: 0.56 });
    for (let i = 0; i < 9; i++) {
      const angle = i * 2.4;
      const radius = 0.1 + 0.024 * i;
      part(
        group,
        new THREE.CylinderGeometry(0.108, 0.108, 0.035 + 0.012 * (i % 3), 8),
        gold,
        Math.sin(angle) * radius,
        0.2 + 0.025 * (i % 2),
        Math.cos(angle) * radius,
      );
    }
  } else if (key === 'eggs') {
    const shell = surfaceMat({ color: 0x7e483e, roughness: 0.84 });
    const fire = surfaceMat({ color: 0xb96849, roughness: 0.81 });
    for (const [i, [x, z, size]] of [
      [-0.24, 0.08, 0.16],
      [0.19, 0.13, 0.19],
      [0.02, -0.22, 0.18],
    ].entries()) {
      part(
        group,
        new THREE.IcosahedronGeometry(size, 1).scale(1, 1.48, 1),
        i === 1 ? fire : shell,
        x,
        0.11 + size * 1.48,
        z,
      ).rotation.z = x;
    }
  } else {
    const stem = surfaceMat({ color: 0x713c31, roughness: 0.82 });
    const petals = surfaceMat({
      color: 0xcb6541,
      emissive: 0x772e14,
      emissiveIntensity: 0.4,
      roughness: 0.72,
    });
    part(group, new THREE.CylinderGeometry(0.045, 0.11, 0.48, 7), stem, 0, 0.36);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const shape = new THREE.OctahedronGeometry(0.18, 0).scale(1, 0.65, 1.4).rotateY(a);
      part(group, shape, petals, Math.sin(a) * 0.14, 0.61, Math.cos(a) * 0.14);
    }
  }
  return group;
}
