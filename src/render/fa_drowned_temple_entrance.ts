// Original release geometry from the Moon Stair's simulation layout. No GLB,
// atlas, or external texture is used. Four separate roots retain camera fade.
import * as THREE from 'three';
import {
  DROWNED_TEMPLE_ENTRANCE_COLLIDERS,
  DROWNED_TEMPLE_ENTRANCE_LEVELS,
} from '../sim/drowned_temple_entrance';
import {
  DROWNED_TEMPLE_STAIR,
  drownedTempleStairHalfWidth,
  drownedTempleStairLocalSurface,
} from '../sim/drowned_temple_stair';
import { terrainHeight } from '../sim/world';
import { type TempleGhostSet, templeOccluderSet } from './drowned_temple_entrance_core';

export function buildFantasyArenaDrownedTemple(
  door: { x: number; z: number },
  base: number,
  seed: number,
): {
  roots: Record<TempleGhostSet, THREE.Group>;
  support: THREE.Group;
} {
  const roots = {
    gate: new THREE.Group(),
    east: new THREE.Group(),
    west: new THREE.Group(),
    works: new THREE.Group(),
  };
  for (const key of Object.keys(roots) as TempleGhostSet[])
    roots[key].name = `fantasyArenaTemple:${key}`;
  const support = new THREE.Group();
  support.name = 'fantasyArenaTemple:support';
  const stone = new THREE.MeshStandardMaterial({ color: 0x9a9f9b, roughness: 0.91 });
  const slate = new THREE.MeshStandardMaterial({ color: 0x747f80, roughness: 0.92 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
  for (const row of DROWNED_TEMPLE_ENTRANCE_COLLIDERS) {
    const ground = terrainHeight(door.x + row.lx, door.z + row.lz, seed) - base;
    const bottom = Math.min(row.top - 0.25, ground - 0.5);
    const height = row.top - bottom;
    const mesh = new THREE.Mesh(
      row.type === 'circle' ? cylinder : box,
      row.name.startsWith('weir_') ? slate : stone,
    );
    mesh.name = `templeCollider:${row.name}`;
    mesh.position.set(row.lx, bottom + height / 2, row.lz);
    mesh.scale.set(
      row.type === 'circle' ? row.r! : row.hw! * 2,
      height,
      row.type === 'circle' ? row.r! : row.hd! * 2,
    );
    mesh.rotation.y = row.rot ?? 0;
    mesh.castShadow = mesh.receiveShadow = true;
    roots[templeOccluderSet(row.name)].add(mesh);
  }
  const levels = DROWNED_TEMPLE_ENTRANCE_LEVELS;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(
      (levels.ringInner + levels.ringOuter) / 2,
      (levels.ringOuter - levels.ringInner) / 2,
      8,
      36,
    ),
    stone,
  );
  ring.name = 'fantasyArenaTempleRing';
  ring.position.y = levels.ringCentre;
  ring.castShadow = ring.receiveShadow = true;
  roots.gate.add(ring);
  const s = DROWNED_TEMPLE_STAIR;
  const dais = new THREE.Mesh(box, stone);
  dais.name = 'templeDais';
  dais.position.set(0, s.dais - 1, (s.daisZ0 + s.daisZ1) / 2);
  dais.scale.set(s.daisHalfWidth * 2, 2, s.daisZ1 - s.daisZ0);
  dais.receiveShadow = true;
  support.add(dais);
  // Each physical tread approximates the matching continuous walk ramp by at
  // most half a riser, with the original widening toward the lake.
  for (let i = 0; i < s.treads; i++) {
    const z = s.daisZ0 - (i + 0.5) * s.tread;
    const top = drownedTempleStairLocalSurface(0, z);
    const bottom = Math.min(-6.712, top - 0.3);
    const step = new THREE.Mesh(box, i % 2 ? stone : slate);
    step.name = `templeTread:${i}`;
    step.position.set(0, (top + bottom) / 2, z);
    step.scale.set(drownedTempleStairHalfWidth(z) * 2, top - bottom, s.tread);
    step.receiveShadow = true;
    support.add(step);
  }
  // Sloped, walkable edges of the dais and the west cheek's open breach.
  // Their upper vertices are sampled from the very same simulation surface.
  function slope(name: string, x0: number, x1: number, z0: number, z1: number): void {
    const coords: Array<[number, number]> = [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ];
    const ys = coords.map(([x, z]) => drownedTempleStairLocalSurface(x, z));
    const bottom = Math.min(...ys) - 0.4;
    const vertices = coords.flatMap(([x, z], i) => [x, ys[i], z]);
    vertices.push(...coords.flatMap(([x, z]) => [x, bottom, z]));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex([
      0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3,
      0, 4, 3, 4, 7,
    ]);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, stone);
    mesh.name = name;
    mesh.receiveShadow = true;
    support.add(mesh);
  }
  // End-fall is open at exactly six yards; remain just inside its boundary.
  slope('templeDaisEastFall', -s.daisHalfWidth - 5.999, -s.daisHalfWidth, s.daisZ0, s.daisZ1);
  slope('templeDaisWestFall', s.daisHalfWidth, s.daisHalfWidth + 5.999, s.daisZ0, s.daisZ1);
  slope('templeCheekBreach', s.halfWidth, s.halfWidth + s.breachReach, s.breachZ0, s.breachZ1);
  return { roots, support };
}
