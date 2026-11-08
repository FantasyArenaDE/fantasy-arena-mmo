// Original release-only gate built from the existing simulation's collision
// layout. It uses no imported geometry, textures or reserved entrance media.
import * as THREE from 'three';
import { SANCTUM_SEAL_GATE_COLLIDERS } from '../sim/sanctum_seal_gate';
import { terrainHeight } from '../sim/world';

export function buildFantasyArenaSanctumGate(
  door: { x: number; z: number }, base: number, seed: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'fantasyArenaSanctumGate';
  const masonry = new THREE.MeshStandardMaterial({ color: 0x343a44, roughness: .91 });
  const rock = new THREE.MeshStandardMaterial({ color: 0x515c6a, roughness: .96 });
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x242b35, roughness: .9 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x424b54, roughness: .74, metalness: .32 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x665244, roughness: .96 });
  const rune = new THREE.MeshBasicMaterial({ color: 0x6abde6 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x727f8e, roughness: .84 });
  for (const row of SANCTUM_SEAL_GATE_COLLIDERS) {
    const atGround = terrainHeight(door.x + row.lx, door.z + row.lz, seed) - base;
    // Rocks extend into the mountainside; smaller pieces begin just below the
    // ground. Every upper face remains at the collider's own documented top.
    const bottom = row.name.startsWith('rock_') || row.name === 'tunnel_end'
      ? Math.min(-2, atGround - 3)
      : Math.min(row.top - .2, atGround - .35);
    const height = row.top - bottom;
    const geometry = row.type === 'circle'
      ? new THREE.CylinderGeometry(row.r!, row.r!, height, 10)
      : new THREE.BoxGeometry(row.hw! * 2, height, row.hd! * 2);
    const material = row.name.startsWith('rock_') || row.name === 'tunnel_end'
      ? rock
      : row.name === 'sledge' ? wood
        : row.name === 'chain_heap' || row.name === 'toppled_brazier' ? iron
          : row.name.startsWith('pylon_') ? darkStone : masonry;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `sealCollider:${row.name}`;
    mesh.position.set(row.lx, (row.top + bottom) / 2, row.lz);
    mesh.rotation.y = row.rot ?? 0;
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(10.6, 2.1, 5), darkStone);
  lintel.name = 'sealLintel';
  lintel.position.set(0, 12.85, .3);
  lintel.castShadow = lintel.receiveShadow = true;
  group.add(lintel);
  for (const x of [-4.8, -2.5, 2.5, 4.8]) {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(.24, 11.7, .12), trim);
    edge.position.set(x, 6.0, -2.24);
    group.add(edge);
  }
  const lintelTrim = new THREE.Mesh(new THREE.BoxGeometry(10.1, .28, .12), trim);
  lintelTrim.position.set(0, 12.85, -2.24);
  group.add(lintelTrim);
  // Simple geometric inlays on the front face: visible entrance accents, not
  // copies of the reserved art. They do not alter the walk-in lane or physics.
  for (const x of [-3.65, 3.65]) {
    for (const y of [4.4, 6.6, 8.8]) {
      const glyph = new THREE.Mesh(new THREE.BoxGeometry(.22, 1.1, .04), rune);
      glyph.position.set(x, y, -2.22);
      glyph.rotation.z = Math.PI / 4;
      group.add(glyph);
    }
  }
  return group;
}

/** Decorative glacial shards above the existing collision-backed ridge. */
export function buildFantasyArenaSanctumIce(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'fantasyArenaSanctumIce';
  const material = new THREE.MeshStandardMaterial({ color: 0x8bbacf, roughness: .45, metalness: .04 });
  for (const [x, z, bottom, radius, height] of [
    [-4.5, 33.5, 28, 3, 10], [0, 34.5, 29, 3.5, 14], [4.5, 33, 28, 2.8, 9],
  ] as const) {
    const shard = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 5), material);
    shard.position.set(x, bottom + height / 2, z);
    shard.rotation.y = .3;
    shard.castShadow = shard.receiveShadow = true;
    group.add(shard);
  }
  return group;
}
