import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { activeWorldIsBuiltinShaped } from '../sim/builtin_shaped_world';
import { hash2 } from '../sim/rng';
import { terrainHeight, waterLevelAt } from '../sim/world';
import { BROOK_X, BROOK_Z, patchBrookCaustics } from './brook_caustics';
import { GFX } from './gfx';

const STONE_COLORS = [0x8e8572, 0xb0a495, 0x8a907e, 0x756b65, 0xc0ad91];
const WOOD_COLOR = 0x675641;

function tint(geometry: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const color = new THREE.Color(hex);
  const count = geometry.getAttribute('position').count;
  const values = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) color.toArray(values, i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(values, 3));
  return geometry;
}

/** One opaque draw lets the terrain, stones and wood all receive the same
 * light, and lets the ocean refract and occlude them normally. */
export function buildBrookBed(seed: number) {
  if (!activeWorldIsBuiltinShaped()) return null;
  const parts: THREE.BufferGeometry[] = [];
  const bed = (x: number, z: number) => terrainHeight(x, z, seed);
  for (let row = -5; row <= 5; row++) {
    for (let col = -12; col <= 12; col++) {
      const x = BROOK_X + col + (hash2(col, row, seed + 81) - 0.5) * 0.88;
      const z = BROOK_Z + row + (hash2(row, col, seed + 92) - 0.5) * 0.88;
      const y = bed(x, z);
      const depth = waterLevelAt(x, z, seed) - y;
      if (depth < 0.36 || depth > 2.1) continue;
      const size = 0.095 + hash2(col, row, seed + 103) ** 2 * 0.22;
      const stone = new THREE.IcosahedronGeometry(1, 0);
      stone.scale(size * 1.3, size * 0.57, size * 0.86);
      stone.rotateY(hash2(row, col, seed + 114) * Math.PI * 2);
      stone.translate(x, y + size * 0.18, z);
      const index = Math.floor(hash2(col, row, seed + 125) * STONE_COLORS.length);
      parts.push(tint(stone, STONE_COLORS[index]));
    }
  }

  // Two forked branches lodged on either side of the plank crossing. End
  // points follow the real bed and are checked against the actual water.
  const forks = [
    [
      [-9.5, -2.9],
      [-8.4, -2.6],
      [-7.3, -2.0],
      [-6.3, -1.8],
      [-8.0, -3.5],
    ],
    [
      [5.2, 2.0],
      [6.3, 1.7],
      [7.6, 2.2],
      [8.4, 2.1],
      [6.8, 3.1],
    ],
  ];
  const links = [
    [0, 1],
    [1, 2],
    [2, 3],
    [1, 4],
  ];
  const up = new THREE.Vector3(0, 1, 0);
  const rotation = new THREE.Quaternion();
  for (const fork of forks) {
    const points = fork.map(([dx, dz]) => {
      const x = BROOK_X + dx;
      const z = BROOK_Z + dz;
      return new THREE.Vector3(x, bed(x, z) + 0.12, z);
    });
    if (points.some(({ x, y, z }) => waterLevelAt(x, z, seed) - y < 0.35)) continue;
    for (const [from, to] of links) {
      const a = points[from];
      const b = points[to];
      const direction = b.clone().sub(a);
      const radius = to > 2 ? 0.075 : 0.13;
      const base = new THREE.CylinderGeometry(radius * 0.65, radius, direction.length() + 0.06, 7);
      const segment = base.toNonIndexed();
      base.dispose();
      segment.applyQuaternion(rotation.setFromUnitVectors(up, direction.normalize()));
      segment.translate((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, (a.z + b.z) * 0.5);
      parts.push(tint(segment, WOOD_COLOR));
    }
  }

  const geometry = parts.length ? mergeGeometries(parts) : null;
  for (const part of parts) part.dispose();
  if (!geometry) return null;
  const material = GFX.standardMaterials
    ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, flatShading: true })
    : new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  material.onBeforeCompile = (shader) => patchBrookCaustics(shader);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'emerald-run-brook-bed';
  mesh.receiveShadow = true;
  return mesh;
}
