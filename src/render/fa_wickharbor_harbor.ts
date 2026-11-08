// Own release geometry for Wickharbor's existing walkable harbor layout.
// Level planks are clipped to the sim's half-plane cuts, while stairs use the
// shared deck builder. No restricted harbor artwork enters this renderer.
import * as THREE from 'three';
import { activeWorldIsBuiltinShaped } from '../sim/builtin_shaped_world';
import { WICKHARBOR_HARBOR_DECKS, WICKHARBOR_HARBOR_PROPS, WICKHARBOR_HARBOR_RAILS } from '../sim/content/wickharbor_harbor';
import { galeDeckAlong, type GaleDeckCut, type GaleDeckDef } from '../sim/gale_harbor';
import { terrainHeight, WATER_LEVEL } from '../sim/world';
import { buildHarborWood } from './eastbrook_harbor';
import { addFantasyArenaHarborObstacles } from './fa_wickharbor_wharf';

type Point = { x: number; z: number };

/** Trim a convex plank polygon to the same positive half-plane as the sim. */
export function clipHarborPolygon(polygon: readonly Point[], cut: GaleDeckCut): Point[] {
  const out: Point[] = [];
  if (!polygon.length) return out;
  const side = (p: Point) => (p.x - cut.x) * cut.nx + (p.z - cut.z) * cut.nz;
  let previous = polygon[polygon.length - 1];
  let previousSide = side(previous);
  for (const current of polygon) {
    const currentSide = side(current);
    if ((previousSide >= 0) !== (currentSide >= 0)) {
      const t = previousSide / (previousSide - currentSide);
      out.push({ x: previous.x + (current.x - previous.x) * t, z: previous.z + (current.z - previous.z) * t });
    }
    if (currentSide >= 0) out.push(current);
    previous = current;
    previousSide = currentSide;
  }
  return out;
}

/** Exact continuous plank fields, split into individually clipped courses. */
export function harborDeckPlanks(deck: GaleDeckDef): Point[][] {
  const result: Point[][] = [];
  const dx = Math.sin(deck.rot), dz = Math.cos(deck.rot);
  const point = (along: number, across: number): Point => ({
    x: deck.x + dx * along + dz * across,
    z: deck.z + dz * along - dx * across,
  });
  const courses = Math.max(1, Math.ceil(deck.hl * 2 / 1.05));
  for (let i = 0; i < courses; i++) {
    const a0 = -deck.hl + 2 * deck.hl * i / courses;
    const a1 = -deck.hl + 2 * deck.hl * (i + 1) / courses;
    let polygon = [point(a0, -deck.hw), point(a1, -deck.hw), point(a1, deck.hw), point(a0, deck.hw)];
    for (const cut of deck.cuts ?? []) polygon = clipHarborPolygon(polygon, cut);
    if (polygon.length >= 3) result.push(polygon);
  }
  return result;
}

export function buildFantasyArenaWickharborHarbor(seed: number): THREE.Group {
  const group = new THREE.Group();
  group.name = 'fantasyArenaWickharborHarbor';
  if (!activeWorldIsBuiltinShaped()) return group;
  const deckGroup = new THREE.Group();
  deckGroup.name = 'harborDecks';
  const woods = [0x8a6a4a, 0x806044].map((color) => new THREE.MeshStandardMaterial({ color, roughness: .92 }));
  const supports = new THREE.Group();
  supports.name = 'harborSupports';
  const supportWood = new THREE.MeshStandardMaterial({ color: 0x6b523d, roughness: .94 });
  for (const deck of WICKHARBOR_HARBOR_DECKS) {
    if (deck.kind === 'stair') continue;
    if (deck.nearAboveWater === undefined || deck.nearAboveWater !== deck.farAboveWater) {
      throw new Error(`Expected level harbor deck: ${deck.id}`);
    }
    harborDeckPlanks(deck).forEach((points, index) => {
      const shape = new THREE.Shape();
      shape.moveTo(points[0].x, points[0].z);
      for (const point of points.slice(1)) shape.lineTo(point.x, point.z);
      shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: .16, bevelEnabled: false });
      geometry.rotateX(Math.PI / 2);
      geometry.translate(0, WATER_LEVEL + deck.nearAboveWater!, 0);
      const plank = new THREE.Mesh(geometry, woods[index % 2]);
      plank.name = deck.id;
      plank.castShadow = plank.receiveShadow = true;
      deckGroup.add(plank);
    });
    // Visible support posts terminate below the deck and never claim a new
    // collision. Reject posts beyond the exact walkable half-plane cuts.
    for (let along = -deck.hl + .4; along < deck.hl; along += 3) {
      for (const across of [-deck.hw + .2, deck.hw - .2]) {
        const x = deck.x + Math.sin(deck.rot) * along + Math.cos(deck.rot) * across;
        const z = deck.z + Math.cos(deck.rot) * along - Math.sin(deck.rot) * across;
        if (galeDeckAlong(deck, x, z) === null) continue;
        const top = WATER_LEVEL + deck.nearAboveWater - .16;
        const bottom = Math.min(top - .4, Math.max(terrainHeight(x, z, seed), WATER_LEVEL - 5));
        const post = new THREE.Mesh(new THREE.BoxGeometry(.25, top - bottom, .25), supportWood);
        post.position.set(x, (top + bottom) / 2, z);
        post.castShadow = post.receiveShadow = true;
        supports.add(post);
      }
    }
  }
  group.add(deckGroup);
  group.add(supports);
  group.add(buildHarborWood('harborStairs', WICKHARBOR_HARBOR_DECKS.filter((deck) => deck.kind === 'stair'), seed));
  addFantasyArenaHarborObstacles(group, WICKHARBOR_HARBOR_RAILS, WICKHARBOR_HARBOR_PROPS, seed);
  return group;
}
