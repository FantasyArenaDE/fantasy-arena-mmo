import * as THREE from 'three';
import { surfaceMat } from './gfx';

/** Own cave mouths shaped around the existing passage's two flanks and back wall. */
export function buildReleaseHollowMouth(kind: 'crystal' | 'tree'): THREE.Group {
  const gate = new THREE.Group();
  gate.name = kind === 'crystal' ? 'FantasyArena_AmethystMouth' : 'FantasyArena_RootMouth';
  const rock = surfaceMat({ color: kind === 'crystal' ? 0x575263 : 0x665148, roughness: 0.91 });
  const shadow = surfaceMat({ color: 0x36323b, roughness: 0.96 });
  const accent = surfaceMat({
    color: kind === 'crystal' ? 0x9b62b5 : 0x5d6947,
    emissive: kind === 'crystal' ? 0x42294d : 0x19231c,
    emissiveIntensity: 0.46,
    roughness: 0.72,
  });

  const put = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    gate.add(mesh);
    return mesh;
  };

  for (const side of [-1, 1]) {
    // These supports mark the same flank positions as the sim's 2.3 yd circles.
    put(new THREE.CylinderGeometry(1.95, 2.3, 4.5, 9), rock, side * 3.4, 2.25, 0.6);
    put(new THREE.CylinderGeometry(1.2, 1.94, 4.6, 9), rock, side * 3.4, 6.4, 0.3).rotation.z =
      side * 0.16;
    if (kind === 'crystal') {
      for (const [x, y, z, h] of [
        [3.78, 3.1, 1.78, 4.1],
        [4.59, 2.0, 1.4, 2.7],
        [2.25, 5.3, 0.98, 3.2],
      ]) {
        const crystal = put(new THREE.ConeGeometry(h * 0.16, h, 6), accent, x * side, y, z);
        crystal.rotation.z = -side * 0.24;
      }
    } else {
      for (const [x, y, z, angle] of [
        [3.68, 2.5, 1.8, 0.31],
        [4.55, 2.08, 0.65, 0.62],
      ]) {
        const root = put(new THREE.CylinderGeometry(0.28, 0.67, 4.0, 7), rock, x * side, y, z);
        root.rotation.z = -angle * side;
      }
      put(
        new THREE.DodecahedronGeometry(1.65, 0).scale(1.3, 0.72, 1.1),
        accent,
        side * 3.9,
        9.7,
        -0.1,
      );
    }
  }

  // The player enters at z=0. The dark back is behind the trigger and
  // the lintel stays well above the opening in both versions.
  put(new THREE.CylinderGeometry(2.8, 3.2, 7.9, 10), shadow, 0, 3.95, -3.8);
  const cap = put(new THREE.BoxGeometry(7.1, 3.5, 4.15), rock, 0, 10.25, -0.5);
  cap.name = 'PassageLintel';
  put(new THREE.DodecahedronGeometry(1.05, 0), accent, 0, 8.55, 1.3);
  return gate;
}
