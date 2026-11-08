// Original functional Mirefen prototype: generated from the simulation's own
// floor, collision, furniture and camera-shell layout; no restricted images.
// This module is deliberately not selected by the release renderer yet.
import * as THREE from 'three';
import {
  TAVERN_ARCH,
  TAVERN_CHANDELIER,
  TAVERN_DOOR,
  TAVERN_HALL,
  TAVERN_LANTERNS,
  TAVERN_PORCH,
  TAVERN_PROPS,
  TAVERN_STEPS_MAX_RUN,
  TAVERN_TOWER,
  TAVERN_WING,
} from '../sim/content/mirefen_tavern';
import { TAVERN_STABLE } from '../sim/content/mirefen_tavern_grounds';
import { tavernPropBaseY, tavernTowerWallSegments, tavernWingWalls } from '../sim/mirefen_tavern';
import { tavernHallHeight } from '../sim/mirefen_tavern_floor';
import { tavernStablePosts, tavernStableWalls } from '../sim/mirefen_tavern_grounds';
import { clipHarborPolygon } from './fa_wickharbor_harbor';
import {
  TAVERN_FRONT_SPLIT,
  TAVERN_SHELL_PARTS,
  type TavernShellPart,
} from './mirefen_tavern_core';
import type { VertexColourPart } from './vertex_colour_glb_parts';

export interface FantasyArenaTavernPrototype {
  body: THREE.Group;
  shell: Map<TavernShellPart, VertexColourPart[]>;
}

export function buildFantasyArenaMirefenTavern(): FantasyArenaTavernPrototype {
  const body = new THREE.Group();
  body.name = 'fantasyArenaMirefenTavern';
  const shell = new Map<TavernShellPart, VertexColourPart[]>(
    TAVERN_SHELL_PARTS.map((part) => [part, []]),
  );
  const stone = new THREE.MeshStandardMaterial({ color: 0x8a8171, roughness: 0.96 });
  const plaster = new THREE.MeshStandardMaterial({ color: 0xc4b498, roughness: 0.95 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x594538, roughness: 0.94 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x8c6748, roughness: 0.94 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x4e4444, roughness: 0.95 });
  const shellBox = (
    part: TavernShellPart,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    z0: number,
    z1: number,
    mat = plaster,
  ) => {
    const geo = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    shell.get(part)?.push({ geometry: geo, material: mat });
  };
  const h = TAVERN_HALL,
    d = TAVERN_DOOR,
    a = TAVERN_ARCH;
  const frontZ = h.z1 - h.wall,
    dz = h.z1;
  shellBox('HallWallFrontLeft', h.x0, -TAVERN_FRONT_SPLIT, 0, h.eave, frontZ, dz);
  shellBox('HallWallFrontRight', TAVERN_FRONT_SPLIT, h.x1, 0, h.eave, frontZ, dz);
  shellBox('HallWallFront', -TAVERN_FRONT_SPLIT, d.x - d.width / 2, 0, h.eave, frontZ, dz);
  shellBox('HallWallFront', d.x + d.width / 2, TAVERN_FRONT_SPLIT, 0, h.eave, frontZ, dz);
  shellBox('HallWallFront', d.x - d.width / 2, d.x + d.width / 2, d.height, h.eave, frontZ, dz);
  shellBox('HallWallBack', h.x0, a.x0, 0, h.eave, h.z0, h.z0 + h.wall);
  shellBox('HallWallBack', a.x1, h.x1, 0, h.eave, h.z0, h.z0 + h.wall);
  shellBox('HallWallBack', a.x0, a.x1, a.height, h.eave, h.z0, h.z0 + h.wall);
  shellBox('HallWallLeft', h.x0, h.x0 + h.wall, 0, h.eave, h.z0, h.z1);
  shellBox('HallWallRight', h.x1 - h.wall, h.x1, 0, h.eave, h.z0, h.z1);
  const wing = TAVERN_WING;
  tavernWingWalls().forEach((b, i) => {
    shellBox(
      i === 0 ? 'WingWallEast' : i === 1 ? 'WingWallBack' : 'WingWallWest',
      b[0],
      b[1],
      0,
      wing.eave,
      b[2],
      b[3],
    );
  });
  for (const s of tavernTowerWallSegments()) {
    const geo = new THREE.BoxGeometry(s.hw * 2, TAVERN_TOWER.wallTop, s.hd * 2);
    geo.rotateY(s.rot);
    geo.translate(s.x, TAVERN_TOWER.wallTop / 2, s.z);
    shell.get('TowerWall')?.push({ geometry: geo, material: stone });
  }
  // Simple pitched roof sections retain the same eaves and ridge clearances.
  const hallMidZ = (h.z0 + h.z1) / 2;
  for (const side of [-1, 1]) {
    const run = (h.z1 - h.z0) / 2 + h.eaveOut,
      rise = h.ridge - h.eave;
    const geo = new THREE.BoxGeometry(h.x1 - h.x0 + 2 * h.vergeOut, 0.35, Math.hypot(run, rise));
    geo.rotateX(side * Math.atan2(rise, run));
    geo.translate((h.x0 + h.x1) / 2, h.eave + rise / 2, hallMidZ + (side * run) / 2);
    shell.get('HallRoof')?.push({ geometry: geo, material: roof });
  }
  // Close the end gables up to the ridge; these live in the same camera
  // fading units as their respective end walls, with no extra floor obstacle.
  for (const side of [-1, 1]) {
    const x = side < 0 ? h.x0 : h.x1;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([x, h.eave, h.z0, x, h.eave, h.z1, x, h.ridge, hallMidZ], 3),
    );
    geo.setIndex(side < 0 ? [0, 1, 2] : [0, 2, 1]);
    geo.computeVertexNormals();
    const mat = plaster.clone();
    mat.side = THREE.DoubleSide;
    shell.get(side < 0 ? 'HallWallLeft' : 'HallWallRight')?.push({ geometry: geo, material: mat });
  }
  for (const side of [-1, 1]) {
    const run = (wing.x1 - wing.x0) / 2 + wing.eaveOut,
      rise = wing.ridge - wing.eave;
    const geo = new THREE.BoxGeometry(
      Math.hypot(run, rise),
      0.3,
      wing.z1 - wing.z0 + wing.vergeOut * 2,
    );
    geo.rotateZ(-side * Math.atan2(rise, run));
    geo.translate(
      (wing.x0 + wing.x1) / 2 + (side * run) / 2,
      wing.eave + rise / 2,
      (wing.z0 + wing.z1) / 2,
    );
    shell.get('WingRoof')?.push({ geometry: geo, material: roof });
  }
  const towerRoof = new THREE.ConeGeometry(
    TAVERN_TOWER.rOut + TAVERN_TOWER.eaveOut,
    TAVERN_TOWER.peak - TAVERN_TOWER.wallTop,
    24,
  );
  towerRoof.translate(
    TAVERN_TOWER.x,
    (TAVERN_TOWER.peak + TAVERN_TOWER.wallTop) / 2,
    TAVERN_TOWER.z,
  );
  shell.get('TowerRoof')?.push({ geometry: towerRoof, material: roof });
  shellBox(
    'HallPorch',
    TAVERN_PORCH.x0 - 0.3,
    TAVERN_PORCH.x1 + 0.3,
    4.7,
    5.0,
    h.z1,
    TAVERN_PORCH.z1,
    roof,
  );

  // Hall floor is a sampled height field. The grid follows the exact existing
  // pit/platform/stage equations, with no solid slab through the sunken pit.
  const nX = 160,
    nZ = 140,
    positions: number[] = [],
    indices: number[] = [];
  for (let j = 0; j <= nZ; j++)
    for (let i = 0; i <= nX; i++) {
      const x = h.x0 + ((h.x1 - h.x0) * i) / nX,
        z = h.z0 + ((h.z1 - h.z0) * j) / nZ;
      positions.push(x, tavernHallHeight(x, z), z);
    }
  for (let j = 0; j < nZ; j++)
    for (let i = 0; i < nX; i++) {
      const p = j * (nX + 1) + i;
      indices.push(p, p + nX + 1, p + 1, p + 1, p + nX + 1, p + nX + 2);
    }
  const floorGeo = new THREE.BufferGeometry();
  floorGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  floorGeo.setIndex(indices);
  floorGeo.computeVertexNormals();
  const floor = new THREE.Mesh(floorGeo, wood);
  floor.name = 'tavernHallFloor';
  floor.receiveShadow = true;
  body.add(floor);
  // Tower disc is clipped at the hall and wing so it never z-fights their floors.
  let circle = Array.from({ length: 72 }, (_, i) => ({
    x: TAVERN_TOWER.x + TAVERN_TOWER.rOut * Math.cos((i * Math.PI) / 36),
    z: TAVERN_TOWER.z + TAVERN_TOWER.rOut * Math.sin((i * Math.PI) / 36),
  }));
  circle = clipHarborPolygon(circle, { x: 0, z: h.z0, nx: 0, nz: -1 });
  circle = clipHarborPolygon(circle, { x: wing.x0, z: 0, nx: -1, nz: 0 });
  const shape = new THREE.Shape();
  shape.moveTo(circle[0].x, circle[0].z);
  for (const p of circle.slice(1)) shape.lineTo(p.x, p.z);
  shape.closePath();
  const nookGeo = new THREE.ShapeGeometry(shape);
  nookGeo.rotateX(Math.PI / 2);
  const nookMat = stone.clone();
  nookMat.side = THREE.DoubleSide;
  const nook = new THREE.Mesh(nookGeo, nookMat);
  nook.name = 'tavernTowerFloor';
  nook.receiveShadow = true;
  body.add(nook);
  const levelBox = (name: string, x0: number, x1: number, z0: number, z1: number, top: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.18, z1 - z0), wood);
    mesh.name = name;
    mesh.position.set((x0 + x1) / 2, top - 0.09, (z0 + z1) / 2);
    mesh.receiveShadow = true;
    body.add(mesh);
  };
  levelBox('tavernWingFloor', wing.x0, wing.x1, wing.z0, wing.z1, 0);
  levelBox(
    'tavernPorchFloor',
    TAVERN_PORCH.x0,
    TAVERN_PORCH.x1,
    TAVERN_PORCH.z0,
    TAVERN_PORCH.z1,
    0,
  );
  const slopeGeo = new THREE.BufferGeometry();
  const p = TAVERN_PORCH,
    zEnd = p.z1 + TAVERN_STEPS_MAX_RUN;
  slopeGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        -p.stepHalfWidth,
        0,
        p.z1,
        p.stepHalfWidth,
        0,
        p.z1,
        p.stepHalfWidth,
        -TAVERN_STEPS_MAX_RUN * p.stepSlope,
        zEnd,
        -p.stepHalfWidth,
        -TAVERN_STEPS_MAX_RUN * p.stepSlope,
        zEnd,
      ],
      3,
    ),
  );
  slopeGeo.setIndex([0, 3, 1, 1, 3, 2]);
  slopeGeo.computeVertexNormals();
  const slope = new THREE.Mesh(slopeGeo, stone);
  slope.name = 'tavernPorchRamp';
  slope.receiveShadow = true;
  body.add(slope);
  for (const x of [p.x0, p.x1]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, p.parapet, p.z1 - p.z0), stone);
    mesh.position.set(x, p.parapet / 2, (p.z0 + p.z1) / 2);
    mesh.name = 'tavernPorchParapet';
    body.add(mesh);
  }
  // Outdoor stable keeps exactly the existing partition and open front.
  for (const b of tavernStableWalls()) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(b[1] - b[0], TAVERN_STABLE.eave, b[3] - b[2]),
      dark,
    );
    m.position.set(
      (b[0] + b[1]) / 2,
      TAVERN_STABLE.baseY + TAVERN_STABLE.eave / 2,
      (b[2] + b[3]) / 2,
    );
    m.name = 'tavernStableWall';
    body.add(m);
  }
  for (const post of tavernStablePosts()) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(post.r, post.r, TAVERN_STABLE.eave, 8),
      dark,
    );
    m.position.set(post.x, TAVERN_STABLE.baseY + TAVERN_STABLE.eave / 2, post.z);
    m.name = 'tavernStablePost';
    body.add(m);
  }
  const stableRoof = new THREE.Mesh(
    new THREE.BoxGeometry(
      TAVERN_STABLE.x1 - TAVERN_STABLE.x0,
      0.25,
      TAVERN_STABLE.z1 - TAVERN_STABLE.z0 + 2 * TAVERN_STABLE.eaveOut,
    ),
    roof,
  );
  stableRoof.position.set(
    (TAVERN_STABLE.x0 + TAVERN_STABLE.x1) / 2,
    TAVERN_STABLE.baseY + TAVERN_STABLE.eave,
    (TAVERN_STABLE.z0 + TAVERN_STABLE.z1) / 2,
  );
  body.add(stableRoof);

  // Placeholder furnishings are intentionally isolated from structural shell.
  // Their tops and footprints follow the actual seat and collision records.
  for (const [i, prop] of TAVERN_PROPS.entries()) {
    const y = tavernPropBaseY(prop),
      isSeat = ['bench', 'chair', 'stool', 'settle', 'terraceBench'].includes(prop.kind);
    const isTable = ['table', 'roundTable', 'terraceTable'].includes(prop.kind);
    const geom =
      prop.r === undefined
        ? new THREE.BoxGeometry(
            (prop.hw ?? 0.5) * 2 + (isSeat ? 0.1 : 0),
            prop.height,
            (prop.hd ?? 0.5) * 2 + (isSeat ? 0.1 : 0),
          )
        : new THREE.CylinderGeometry(prop.r, prop.r, prop.height, 12);
    if (prop.kind === 'pillar') {
      geom.translate(prop.x, y + prop.height / 2, prop.z);
      shell.get('BarPillar')?.push({ geometry: geom, material: stone });
      continue;
    }
    const holder = new THREE.Group();
    holder.name = `tavernProp:${i}:${prop.kind}`;
    holder.position.set(prop.x, y, prop.z);
    holder.rotation.y = prop.rot;
    if (isSeat || isTable) {
      // The visible board is at the exact interaction height. Legs are inside
      // the collider footprint and leave room for the seated characters.
      const thickness = Math.min(0.16, prop.height);
      const boardGeo =
        prop.r === undefined
          ? new THREE.BoxGeometry(
              (prop.hw ?? 0.5) * 2 + (isSeat ? 0.1 : 0),
              thickness,
              (prop.hd ?? 0.5) * 2 + (isSeat ? 0.1 : 0),
            )
          : new THREE.CylinderGeometry(prop.r, prop.r, thickness, 16);
      const board = new THREE.Mesh(boardGeo, wood);
      board.position.y = prop.height - thickness / 2;
      board.name = isSeat ? 'tavernSeatBody' : 'tavernTableBody';
      board.castShadow = board.receiveShadow = true;
      holder.add(board);
      const reachX = prop.r !== undefined ? prop.r * 0.48 : Math.max(0.08, (prop.hw ?? 0.5) - 0.12);
      const reachZ = prop.r !== undefined ? prop.r * 0.48 : Math.max(0.08, (prop.hd ?? 0.5) - 0.12);
      for (const x of [-reachX, reachX])
        for (const z of [-reachZ, reachZ]) {
          const leg = new THREE.Mesh(
            new THREE.BoxGeometry(0.14, prop.height - thickness, 0.14),
            dark,
          );
          leg.position.set(x, (prop.height - thickness) / 2, z);
          leg.castShadow = true;
          holder.add(leg);
        }
    } else if (prop.kind === 'hearth') {
      const rim = new THREE.Mesh(
        new THREE.TorusGeometry((prop.r ?? 1.7) - 0.25, 0.25, 6, 24),
        stone,
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.y = prop.height - 0.25;
      rim.castShadow = rim.receiveShadow = true;
      holder.add(rim);
      const embers = new THREE.Mesh(
        new THREE.CylinderGeometry((prop.r ?? 1.7) - 0.48, (prop.r ?? 1.7) - 0.48, 0.1, 20),
        dark,
      );
      embers.position.y = 0.28;
      holder.add(embers);
    } else {
      const solid = new THREE.Mesh(geom, prop.kind === 'fireplace' ? stone : wood);
      solid.position.y = prop.height / 2;
      solid.name = 'tavernSolid';
      solid.castShadow = solid.receiveShadow = true;
      holder.add(solid);
      if (prop.kind === 'fireplace') {
        const soot = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.8), dark);
        soot.rotation.y = -Math.PI / 2;
        soot.position.set(-(prop.hw ?? 0.6) - 0.01, 0.95, 0);
        holder.add(soot);
      }
    }
    body.add(holder);
  }
  // Original simple lamp silhouettes at the existing light locations. They
  // are cosmetic and remain above the camera's walkable air volume.
  const glow = new THREE.MeshStandardMaterial({
    color: 0xffd187,
    emissive: 0xff902e,
    emissiveIntensity: 0.65,
    roughness: 0.7,
  });
  for (const lamp of TAVERN_LANTERNS) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.68, 0.42), dark);
    frame.position.set(lamp.x, lamp.y, lamp.z);
    frame.castShadow = true;
    body.add(frame);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.48, 0.44), glow);
    pane.position.set(lamp.x, lamp.y, lamp.z);
    body.add(pane);
  }
  const chandelier = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.12, 6, 20), dark);
  chandelier.rotation.x = Math.PI / 2;
  chandelier.position.set(TAVERN_CHANDELIER.x, TAVERN_CHANDELIER.y, TAVERN_CHANDELIER.z);
  body.add(chandelier);
  return { body, shell };
}
