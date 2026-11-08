// Release-only replacement drawn from the same deck and collider data the sim
// walks. No imported geometry or project-reserved harbor model is used.
import * as THREE from 'three';
import { WICKHARBOR_WHARF_DECKS, WICKHARBOR_WHARF_PROPS, WICKHARBOR_WHARF_RAILS } from '../sim/content/wickharbor_wharf';
import { WYRMWATCH_RAIL_HEIGHT } from '../sim/content/wyrmwatch_harbor';
import type { WyrmwatchHarborProp } from '../sim/content/wyrmwatch_harbor';
import { wyrmwatchRailColliders } from '../sim/wyrmwatch_harbor';
import { groundHeight, WATER_LEVEL } from '../sim/world';
import { buildHarborWood } from './eastbrook_harbor';

export function buildFantasyArenaWickharborWharf(seed: number): THREE.Group {
  const group = buildHarborWood('fantasyArenaWickharborWharf', WICKHARBOR_WHARF_DECKS, seed);
  // The shared deck renderer intentionally returns an empty group for other worlds.
  if (!group.children.length) return group;
  const underlay = new THREE.Group();
  underlay.name = 'wharfDeckUnderlay';
  const underlayWood = new THREE.MeshStandardMaterial({ color: 0x705039, roughness: .94 });
  for (const deck of WICKHARBOR_WHARF_DECKS) {
    if (deck.kind !== 'level') continue;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(deck.hw * 2, .06, deck.hl * 2), underlayWood);
    mesh.position.set(deck.x, WATER_LEVEL + deck.nearAboveWater! - .08, deck.z);
    mesh.rotation.y = deck.rot;
    mesh.receiveShadow = true;
    underlay.add(mesh);
  }
  group.add(underlay);
  addFantasyArenaHarborObstacles(group, WICKHARBOR_WHARF_RAILS, WICKHARBOR_WHARF_PROPS, seed);
  return group;
}

/** Visible geometry for the same rail boxes and fixed obstacles as the sim. */
export function addFantasyArenaHarborObstacles(
  group: THREE.Group,
  railLines: readonly (readonly (readonly [number, number])[])[],
  obstacleDefs: readonly WyrmwatchHarborProp[],
  seed: number,
): void {
  const railWood = new THREE.MeshStandardMaterial({ color: 0x755038, roughness: 0.91 });
  const cargoWood = new THREE.MeshStandardMaterial({ color: 0x927047, roughness: 0.95 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x453b33, roughness: 0.76, metalness: 0.28 });
  const rails = new THREE.Group();
  rails.name = 'wharfRails';
  for (const line of railLines) {
    for (const collider of wyrmwatchRailColliders(line, seed)) {
      if (collider.type !== 'obb' || collider.moveTopY === undefined) continue;
      // A solid wooden parapet makes the complete blocking volume visible.
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(collider.hw * 2, WYRMWATCH_RAIL_HEIGHT, collider.hd * 2), railWood);
      mesh.position.set(collider.x, collider.moveTopY - WYRMWATCH_RAIL_HEIGHT / 2, collider.z);
      mesh.rotation.y = collider.rot;
      mesh.castShadow = mesh.receiveShadow = true;
      rails.add(mesh);
    }
  }
  group.add(rails);
  const props = new THREE.Group();
  props.name = 'wharfObstacles';
  for (const prop of obstacleDefs) {
    const geometry = prop.r === undefined
      ? new THREE.BoxGeometry((prop.hw ?? .5) * 2, prop.height, (prop.hd ?? .5) * 2)
      : new THREE.CylinderGeometry(prop.r, prop.r, prop.height, 10);
    const mesh = new THREE.Mesh(geometry, prop.kind === 'lanternPost' ? iron : cargoWood);
    mesh.name = prop.kind;
    mesh.position.set(prop.x, groundHeight(prop.x, prop.z, seed) + prop.height / 2, prop.z);
    mesh.rotation.y = prop.rot;
    mesh.castShadow = mesh.receiveShadow = true;
    props.add(mesh);
  }
  group.add(props);
}
