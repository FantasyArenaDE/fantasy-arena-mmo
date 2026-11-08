// Original release harbor geometry derived solely from the sim's walk and collision data.
import * as THREE from 'three';
import {
  WYRMWATCH_HARBOR_DECKS,
  WYRMWATCH_HARBOR_PATH,
  WYRMWATCH_HARBOR_PATH_HALF_WIDTH,
  WYRMWATCH_HARBOR_PROPS,
  WYRMWATCH_HARBOR_RAILS,
} from '../sim/content/wyrmwatch_harbor';
import {
  HARBOR_HOUSE,
  HARBOR_HOUSE_FLOOR_ABOVE_WATER,
  HARBOR_HOUSE_PROPS,
} from '../sim/content/wyrmwatch_harbor_house';
import { galeDeckSurfaceAt } from '../sim/gale_harbor';
import { groundHeight, terrainHeight, WATER_LEVEL } from '../sim/world';
import { harborHouseWalls } from '../sim/wyrmwatch_harbor_house';
import { harborDeckPlanks } from './fa_wickharbor_harbor';
import { addFantasyArenaHarborObstacles } from './fa_wickharbor_wharf';
import type { VertexColourPart } from './vertex_colour_glb_parts';
import { wyrmwatchPathStones } from './wyrmwatch_harbor_core';
import { buildHarborHouseShell, setHarborHouseAnchor } from './wyrmwatch_harbor_house';
import type { HouseShellPart } from './wyrmwatch_harbor_house_core';

export function buildFantasyArenaWyrmwatchHarbor(seed: number): THREE.Group {
  const root = new THREE.Group();
  root.name = 'fantasyArenaWyrmwatchHarbor';
  const wood = new THREE.MeshStandardMaterial({ color: 0x89694c, roughness: 0.92 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x624a39, roughness: 0.94 });
  const wall = new THREE.MeshStandardMaterial({ color: 0x998a70, roughness: 0.95 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x594642, roughness: 0.93 });
  const box = new THREE.BoxGeometry(1, 1, 1);
  const deckRoot = new THREE.Group();
  deckRoot.name = 'wyrmwatchDecks';
  root.add(deckRoot);
  for (const deck of WYRMWATCH_HARBOR_DECKS) {
    const ground = (x: number, z: number) => terrainHeight(x, z, seed);
    if (deck.kind === 'flight') {
      const count = Math.ceil((deck.hl * 2) / 0.5);
      for (let i = 0; i < count; i++) {
        const along = -deck.hl + ((i + 0.5) * deck.hl * 2) / count;
        const y = galeDeckSurfaceAt(deck, along, ground, WATER_LEVEL);
        const tread = new THREE.Mesh(box, i % 2 ? wood : dark);
        tread.name = `wyrmwatchDeck:${deck.id}:${i}`;
        tread.position.set(
          deck.x + Math.sin(deck.rot) * along,
          y - 0.1,
          deck.z + Math.cos(deck.rot) * along,
        );
        tread.scale.set(deck.hw * 2, 0.2, (deck.hl * 2) / count + 0.01);
        tread.rotation.y = deck.rot;
        tread.receiveShadow = true;
        deckRoot.add(tread);
      }
    } else {
      for (const points of harborDeckPlanks(deck)) {
        const shape = new THREE.Shape();
        shape.moveTo(points[0].x, points[0].z);
        for (const p of points.slice(1)) shape.lineTo(p.x, p.z);
        shape.closePath();
        const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false });
        geo.rotateX(Math.PI / 2);
        geo.translate(0, WATER_LEVEL + (deck.nearAboveWater ?? 0), 0);
        const plank = new THREE.Mesh(geo, wood);
        plank.name = `wyrmwatchDeck:${deck.id}`;
        plank.receiveShadow = true;
        deckRoot.add(plank);
      }
    }
    // Decorative stilts remain under the deck and add no blocking volume.
    for (let along = -deck.hl + 0.45; along < deck.hl; along += 2.8) {
      for (const across of [-deck.hw + 0.2, deck.hw - 0.2]) {
        const x = deck.x + Math.sin(deck.rot) * along + Math.cos(deck.rot) * across;
        const z = deck.z + Math.cos(deck.rot) * along - Math.sin(deck.rot) * across;
        const top = galeDeckSurfaceAt(deck, along, ground, WATER_LEVEL) - 0.18;
        const bottom = Math.min(top - 0.4, Math.max(ground(x, z), WATER_LEVEL - 5));
        const post = new THREE.Mesh(box, dark);
        post.position.set(x, (top + bottom) / 2, z);
        post.scale.set(0.24, top - bottom, 0.24);
        post.castShadow = true;
        deckRoot.add(post);
      }
    }
  }
  addFantasyArenaHarborObstacles(root, WYRMWATCH_HARBOR_RAILS, WYRMWATCH_HARBOR_PROPS, seed);
  // Shell geometries are world-positioned; this group itself has identity
  // transform, allowing the existing house camera cutaway to own each wall.
  const shell = new Map<HouseShellPart, VertexColourPart[]>();
  const floorY = WATER_LEVEL + HARBOR_HOUSE_FLOOR_ABOVE_WATER;
  const addShell = (
    part: HouseShellPart,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
  ) => {
    const pieces = shell.get(part) ?? [];
    pieces.push({ geometry, material });
    shell.set(part, pieces);
  };
  for (const w of harborHouseWalls()) {
    const geo = new THREE.BoxGeometry(w.hw * 2, HARBOR_HOUSE.wallTop, w.hd * 2);
    geo.translate(w.x, floorY + HARBOR_HOUSE.wallTop / 2, w.z);
    const name =
      w.id === 'southEast'
        ? 'HouseWallSouth'
        : (`HouseWall${w.id[0].toUpperCase()}${w.id.slice(1)}` as HouseShellPart);
    addShell(name, geo, wall);
  }
  const lintel = new THREE.BoxGeometry(
    HARBOR_HOUSE.door.width,
    HARBOR_HOUSE.wallTop - HARBOR_HOUSE.door.height,
    HARBOR_HOUSE.wall,
  );
  lintel.translate(
    HARBOR_HOUSE.door.x,
    floorY + (HARBOR_HOUSE.wallTop + HARBOR_HOUSE.door.height) / 2,
    HARBOR_HOUSE.z + HARBOR_HOUSE.hd - HARBOR_HOUSE.wall / 2,
  );
  addShell('HouseWallSouth', lintel, wall);
  const halfRun = HARBOR_HOUSE.hd + HARBOR_HOUSE.roof.eaveOut;
  const rise = HARBOR_HOUSE.ridge - HARBOR_HOUSE.wallTop;
  for (const side of [-1, 1]) {
    const geo = new THREE.BoxGeometry(
      HARBOR_HOUSE.hw * 2 + HARBOR_HOUSE.roof.vergeOut * 2,
      0.3,
      Math.hypot(halfRun, rise),
    );
    geo.rotateX(side * Math.atan2(rise, halfRun));
    geo.translate(
      HARBOR_HOUSE.x,
      floorY + HARBOR_HOUSE.wallTop + rise / 2,
      HARBOR_HOUSE.z + (side * halfRun) / 2,
    );
    addShell('HouseRoof', geo, roof);
  }
  root.add(buildHarborHouseShell(shell));
  setHarborHouseAnchor(HARBOR_HOUSE.x, HARBOR_HOUSE.z);
  const furnishings = new THREE.Group();
  furnishings.name = 'harborHouseFurnishings';
  for (const prop of HARBOR_HOUSE_PROPS) {
    const geo =
      prop.r === undefined
        ? new THREE.BoxGeometry((prop.hw ?? 0.5) * 2, prop.height, (prop.hd ?? 0.5) * 2)
        : new THREE.CylinderGeometry(prop.r, prop.r, prop.height, 10);
    const mesh = new THREE.Mesh(
      geo,
      prop.kind === 'hearth' || prop.kind === 'chimney' ? wall : dark,
    );
    mesh.name = `harborHouse:${prop.kind}`;
    mesh.position.set(prop.x, groundHeight(prop.x, prop.z, seed) + prop.height / 2, prop.z);
    mesh.rotation.y = prop.rot;
    mesh.castShadow = mesh.receiveShadow = true;
    furnishings.add(mesh);
  }
  root.add(furnishings);
  const path = new THREE.Group();
  path.name = 'wyrmwatchHarborPath';
  const rock = new THREE.MeshStandardMaterial({ color: 0x777870, roughness: 0.98 });
  const geo = new THREE.CylinderGeometry(0.42, 0.45, 0.16, 6);
  for (const p of wyrmwatchPathStones(
    WYRMWATCH_HARBOR_PATH,
    WYRMWATCH_HARBOR_PATH_HALF_WIDTH,
    (x, z) => terrainHeight(x, z, seed),
  )) {
    const stone = new THREE.Mesh(geo, rock);
    stone.position.set(p.x, p.y, p.z);
    stone.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(p.nx, p.ny, p.nz),
    );
    stone.rotateY(p.yaw);
    stone.scale.set(p.scale, 1, p.scale);
    stone.receiveShadow = true;
    path.add(stone);
  }
  root.add(path);
  return root;
}
