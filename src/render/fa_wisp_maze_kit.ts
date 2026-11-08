// Original procedural maze kit. Its seven hedge variants occupy the same
// complete four-yard collision cell; gates are visibly CLOSED wall cells.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { markSharedGeometry } from './shared_resource';
import { WISP_MAZE_WALL_HEIGHT } from './wisp_maze_core';
import type { WispMazeKit, WispMazeKitPart } from './wisp_maze_kit';
import { WISP_MAZE_HEDGE_KINDS, WISP_MAZE_KIT_CELL } from './wisp_maze_kit_core';

function painted(geometry: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const colors = new Float32Array(g.getAttribute('position').count * 3);
  const c = new THREE.Color(hex);
  for (let i = 0; i < colors.length; i += 3) c.toArray(colors, i);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}
function combined(pieces: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = mergeGeometries(pieces, false);
  if (!g) throw new Error('Could not build the original wisp maze kit');
  return markSharedGeometry(g);
}
const part = (
  solid: THREE.BufferGeometry | null,
  tint: THREE.BufferGeometry | null = null,
  glow: THREE.BufferGeometry | null = null,
): WispMazeKitPart => ({ solid, tint, glow });

let cached: WispMazeKit | null = null;
export function fantasyArenaWispMazeKit(): WispMazeKit {
  if (cached) return cached;
  const kit = new Map<string, WispMazeKitPart>();
  for (const [variant, kind] of WISP_MAZE_HEDGE_KINDS.entries()) {
    const g = new THREE.BoxGeometry(
      WISP_MAZE_KIT_CELL,
      WISP_MAZE_WALL_HEIGHT,
      WISP_MAZE_KIT_CELL,
      8,
      3,
      8,
    ).toNonIndexed();
    g.translate(0, WISP_MAZE_WALL_HEIGHT / 2, 0);
    const pos = g.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const leaf = [0x344d39, 0x3c5941, 0x476548, 0x526e4a].map((c) => new THREE.Color(c));
    const gateWood = new THREE.Color(0x604433),
      gateRim = new THREE.Color(0x9e8048);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        y = pos.getY(i),
        z = pos.getZ(i);
      let color = leaf[Math.abs(Math.round(x * 7 + z * 11 + y * 9 + variant * 3)) % leaf.length];
      // North face of the gate is a closed wooden gate against the hedge:
      // a painted face, so no apparent opening misrepresents a solid cell.
      if (kind === 'Gate' && Math.abs(z + WISP_MAZE_KIT_CELL / 2) < 0.001 && Math.abs(x) <= 1.5) {
        color = y > 0.75 && y < 1.1 && Math.abs(x) > 1 ? gateRim : gateWood;
      }
      color.toArray(colors, i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const gateLights =
      kind === 'Gate'
        ? combined(
            [-1, 1].map((side) =>
              painted(
                new THREE.OctahedronGeometry(0.11).translate(side * 1.3, 0.92, -2.02),
                0xffd685,
              ),
            ),
          )
        : null;
    kit.set(`Hedge${kind}`, part(markSharedGeometry(g), null, gateLights));
  }
  const post = painted(
    new THREE.CylinderGeometry(0.11, 0.16, 3.1, 8).translate(0, 1.55, 0),
    0x655343,
  );
  const arm = painted(new THREE.BoxGeometry(0.13, 0.13, 1.0).translate(0, 2.9, -0.48), 0x655343);
  const cap = painted(new THREE.ConeGeometry(0.34, 0.3, 6).translate(0, 2.65, -0.88), 0x655343);
  const lamp = painted(new THREE.OctahedronGeometry(0.23).translate(0, 2.35, -0.88), 0xffd685);
  kit.set('LanternPost', part(combined([post, arm, cap]), null, combined([lamp])));
  const stones: THREE.BufferGeometry[] = [];
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 3; col++) {
      const stone = new THREE.BoxGeometry(1.13, 0.07, 1.1);
      stone.translate((col - 1) * 1.25, 0.035, (row - 1) * 1.25);
      stones.push(painted(stone, (row + col) % 2 ? 0x777d71 : 0x899080));
    }
  kit.set('Flagstones', part(combined(stones)));
  const cloak = new THREE.ConeGeometry(0.5, 1.5, 7, 1, true).rotateX(Math.PI).translate(0, 0.95, 0);
  const hood = new THREE.SphereGeometry(0.4, 9, 7).translate(0, 1.72, 0);
  const eyes = new THREE.BoxGeometry(0.36, 0.08, 0.06).translate(0, 1.72, 0.34);
  const arms = [-1, 1].map((side) =>
    painted(new THREE.BoxGeometry(0.12, 0.14, 0.55).translate(side * 0.46, 1.14, 0.15), 0x675a46),
  );
  kit.set(
    'Spirit',
    part(
      combined(arms),
      combined([painted(cloak, 0xffffff), painted(hood, 0xffffff)]),
      combined([painted(eyes, 0xfff1c4)]),
    ),
  );
  const crests = [
    new THREE.ConeGeometry(0.12, 0.5, 5).translate(0, 2.2, 0),
    new THREE.OctahedronGeometry(0.22).translate(0, 2.3, 0),
    new THREE.TorusGeometry(0.5, 0.05, 5, 14).rotateX(Math.PI / 2).translate(0, 1.6, 0),
    new THREE.CylinderGeometry(0.3, 0.3, 0.2, 6).translate(0, 2.1, 0),
    new THREE.BoxGeometry(0.9, 0.5, 0.1).translate(0, 2.2, -0.2),
  ];
  for (let i = 0; i < crests.length; i++)
    kit.set(`Crest${i}`, part(null, combined([painted(crests[i], 0xffffff)])));
  cached = kit;
  return cached;
}
