// Original geometry for the Sunken Bastion's release entrance. The layout
// comes from the existing sim contract; no reserved visual source is used.
import * as THREE from 'three';
import { SUNKEN_BASTION_ENTRANCE_COLLIDERS } from '../sim/sunken_bastion_entrance';
import { terrainHeight } from '../sim/world';
import { BASTION_PASSAGE, bastionOccluderSet } from './sunken_bastion_entrance_core';

export function buildFantasyArenaSunkenBastion(
  door: { x: number; z: number }, base: number, seed: number,
): { gatehouse: THREE.Group; ruins: THREE.Group } {
  const gatehouse = new THREE.Group();
  gatehouse.name = 'fantasyArenaBastionGate';
  const ruins = new THREE.Group();
  ruins.name = 'fantasyArenaBastionRuins';
  const stone = new THREE.MeshStandardMaterial({ color: 0x646d70, roughness: .94 });
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x434f52, roughness: .96 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x414a48, roughness: .76, metalness: .25 });
  for (const row of SUNKEN_BASTION_ENTRANCE_COLLIDERS) {
    const atGround = terrainHeight(door.x + row.lx, door.z + row.lz, seed) - base;
    // The closed passage has an existing shader window: represent its low
    // sill physically, leaving that window visible behind it.
    const top = row.name === 'flood_sill' ? BASTION_PASSAGE.kerb : row.top;
    const bottom = Math.min(top - .2, atGround - .4);
    const height = Math.max(.2, top - bottom);
    const geometry = row.type === 'circle'
      ? new THREE.CylinderGeometry(row.r!, row.r!, height, 12)
      : new THREE.BoxGeometry(row.hw! * 2, height, row.name === 'flood_sill' ? .25 : row.hd! * 2);
    const mesh = new THREE.Mesh(geometry, row.name === 'winch' ? metal : row.name.startsWith('tower_') ? darkStone : stone);
    mesh.name = `bastionCollider:${row.name}`;
    mesh.position.set(row.lx, bottom + height / 2, row.name === 'flood_sill' ? .13 : row.lz);
    mesh.rotation.y = row.rot ?? 0;
    mesh.castShadow = mesh.receiveShadow = true;
    (bastionOccluderSet(row.name) === 'gate' ? gatehouse : ruins).add(mesh);
    if (row.name.startsWith('tower_')) {
      // A simple ring and crenellations make each collision-backed cylinder
      // read as a gate tower even when viewed from across the marsh.
      const ring = new THREE.Mesh(new THREE.TorusGeometry(row.r! + .05, .14, 5, 12), stone);
      ring.position.set(row.lx, row.top - .7, row.lz);
      ring.rotation.x = Math.PI / 2;
      gatehouse.add(ring);
      for (let i = 0; i < 8; i++) {
        const angle = Math.PI * 2 * i / 8;
        const merlon = new THREE.Mesh(new THREE.BoxGeometry(.65, .65, .65), stone);
        merlon.position.set(row.lx + Math.sin(angle) * (row.r! - .4), row.top + .325, row.lz + Math.cos(angle) * (row.r! - .4));
        merlon.rotation.y = angle;
        gatehouse.add(merlon);
      }
    }
  }
  // Open arches frame the existing portal; their lowest points remain above
  // the walk-in route and add no collision or new assets.
  const outer = new THREE.Mesh(new THREE.TorusGeometry(2.2, .36, 6, 16, Math.PI), stone);
  outer.name = 'bastionOuterArch';
  outer.position.set(0, 5.2, -3.66);
  gatehouse.add(outer);
  const inner = new THREE.Mesh(new THREE.TorusGeometry(1.25, .28, 6, 16, Math.PI), stone);
  inner.name = 'bastionInnerArch';
  inner.position.set(0, 3.85, -.57);
  gatehouse.add(inner);
  return { gatehouse, ruins };
}
