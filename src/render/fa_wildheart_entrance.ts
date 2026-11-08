// Original release-only Wildheart idol and court geometry, seated against the
// existing simulation's exact collision locations. No reserved art is used.
import * as THREE from 'three';
import { WILDHEART_BASIN_ENTRANCE_COLLIDERS } from '../sim/wildheart_basin_entrance';
import { terrainHeight } from '../sim/world';
import { wildheartOccluderSet } from './wildheart_basin_entrance_core';

export function buildFantasyArenaWildheart(
  door: { x: number; z: number }, base: number, seed: number,
): { idol: THREE.Group; court: THREE.Group } {
  const idol = new THREE.Group();
  idol.name = 'fantasyArenaWildheartIdol';
  const court = new THREE.Group();
  court.name = 'fantasyArenaWildheartCourt';
  const stone = new THREE.MeshStandardMaterial({ color: 0x9a8b6b, roughness: .94 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x6e654e, roughness: .95 });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xc6b98f, roughness: .85 });
  const jade = new THREE.MeshBasicMaterial({ color: 0x70d9ac });
  for (const row of WILDHEART_BASIN_ENTRANCE_COLLIDERS) {
    const ground = terrainHeight(door.x + row.lx, door.z + row.lz, seed) - base;
    const bottom = Math.min(row.top - .2, ground - (row.name === 'head' ? 2 : .35));
    if (row.name === 'head') {
      // Split the cylindrical head at the mouth. The lower shell leaves an
      // opening in front of the existing throat shader at z=1.3; the sim's
      // trigger takes the player before the collider closes that passage.
      const head = new THREE.Group();
      head.name = 'wildheartCollider:head';
      const radius = row.r!;
      const mouthTop = 6.4;
      const gapAngle = .36;
      const shell = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, mouthTop - bottom, 32, 1, true, Math.PI + gapAngle, 2 * Math.PI - 2 * gapAngle), stone,
      );
      shell.position.y = (mouthTop + bottom) / 2;
      head.add(shell);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, row.top - mouthTop, 32), stone);
      crown.position.y = (row.top + mouthTop) / 2;
      head.add(crown);
      head.position.set(row.lx, 0, row.lz);
      head.traverse((item) => { if (item instanceof THREE.Mesh) item.castShadow = item.receiveShadow = true; });
      idol.add(head);
      continue;
    }
    const height = row.top - bottom;
    const geometry = row.type === 'circle'
      ? new THREE.CylinderGeometry(row.r!, row.r!, height, 10)
      : new THREE.BoxGeometry(row.hw! * 2, height, row.hd! * 2);
    const mesh = new THREE.Mesh(geometry, row.name.startsWith('tusk_') ? ivory : dark);
    mesh.name = `wildheartCollider:${row.name}`;
    mesh.position.set(row.lx, (row.top + bottom) / 2, row.lz);
    mesh.rotation.y = row.rot ?? 0;
    mesh.castShadow = mesh.receiveShadow = true;
    (wildheartOccluderSet(row.name) === 'idol' ? idol : court).add(mesh);
  }
  // Distinctive abstract feline face, kept above the walking corridor.
  const brow = new THREE.Mesh(new THREE.BoxGeometry(7.3, 1.2, 2), dark);
  brow.name = 'wildheartMouthLintel';
  brow.position.set(0, 7.1, .3);
  idol.add(brow);
  for (const x of [-3.1, 3.1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(1.15, .45, .16), jade);
    eye.position.set(x, 10.1, 1.15);
    idol.add(eye);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3, 4), stone);
    ear.position.set(x * 1.5, 17.1, 5.3);
    ear.rotation.y = Math.PI / 4;
    idol.add(ear);
  }
  return { idol, court };
}
