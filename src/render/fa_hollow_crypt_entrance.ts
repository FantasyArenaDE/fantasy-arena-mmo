// Original release geometry built from the existing Fallen Chapel collision layout.
// No source model or texture is used; the original stair shader remains the portal.
import * as THREE from 'three';
import { HOLLOW_CRYPT_ENTRANCE_COLLIDERS } from '../sim/hollow_crypt_entrance';
import { terrainHeight } from '../sim/world';
import { CRYPT_STAIR } from './hollow_crypt_entrance_core';

export function buildFantasyArenaHollowCrypt(
  door: { x: number; z: number },
  base: number,
  seed: number,
): THREE.Group {
  const root = new THREE.Group();
  root.name = 'fantasyArenaHollowCrypt';
  const stone = new THREE.MeshStandardMaterial({ color: 0x77716a, roughness: 0.96 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x4e4b4c, roughness: 0.96 });
  const grave = new THREE.MeshStandardMaterial({ color: 0x89857c, roughness: 0.96 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x413a36, roughness: 0.98 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x544e49, roughness: 0.8, metalness: 0.3 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
  for (const row of HOLLOW_CRYPT_ENTRANCE_COLLIDERS) {
    const ground = terrainHeight(door.x + row.lx, door.z + row.lz, seed) - base;
    const bottom = Math.min(row.top - 0.2, ground - 0.45);
    const height = row.top - bottom;
    const material =
      row.name === 'yew'
        ? wood
        : row.name === 'fallen_bell'
          ? metal
          : row.name.startsWith('headstone') || row.name.startsWith('table_tomb')
            ? grave
            : row.name.startsWith('stairhouse')
              ? dark
              : stone;
    const mesh = new THREE.Mesh(row.type === 'circle' ? cylinder : box, material);
    mesh.name = `cryptCollider:${row.name}`;
    mesh.position.set(row.lx, bottom + height / 2, row.lz);
    mesh.scale.set(
      row.type === 'circle' ? row.r! : row.hw! * 2,
      height,
      row.type === 'circle' ? row.r! : row.hd! * 2,
    );
    mesh.rotation.y = row.rot ?? 0;
    mesh.castShadow = mesh.receiveShadow = true;
    if (row.name === 'stairhouse_back') {
      // The collision closes the stair well. A low threshold and its existing
      // opaque stair shader show that closure; masonry at the back frames the
      // virtual steps without covering the window.
      const wall = mesh.clone();
      wall.name = 'cryptStairBackWall';
      wall.position.z = row.lz + row.hd! - 0.15;
      wall.scale.z = 0.3;
      root.add(wall);
      mesh.position.set(0, (bottom + CRYPT_STAIR.y) / 2, row.lz - row.hd! + 0.1);
      mesh.scale.set(row.hw! * 2, CRYPT_STAIR.y - bottom, 0.2);
    }
    root.add(mesh);
  }
  // Unobstructed stone arches give the chapel and entry gate their silhouette.
  const arches: Array<[string, number, number, number, number]> = [
    ['cryptPortalArch', 0, 4.05, -0.75, 1.3],
    ['cryptGableArch', 0, 5.5, -22.68, 2.25],
    ['cryptYardArch', -2.5, 4.6, -32.4, 1.9],
  ];
  for (const [name, x, y, z, radius] of arches) {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.25, 6, 18, Math.PI), stone);
    arch.name = name;
    arch.position.set(x, y, z);
    arch.castShadow = arch.receiveShadow = true;
    root.add(arch);
  }
  // Bare branches read as a dead yew while the trunk keeps the exact collider.
  for (const [x, y, z, angle] of [
    [-4.8, 8.4, 6.3, 0.8],
    [-3.0, 8.8, 6.3, -0.75],
  ] as const) {
    const branch = new THREE.Mesh(box, wood);
    branch.position.set(x, y, z);
    branch.scale.set(0.34, 3, 0.34);
    branch.rotation.z = angle;
    branch.castShadow = true;
    root.add(branch);
  }
  return root;
}
