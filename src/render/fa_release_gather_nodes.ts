import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { GatherNodeType } from '../sim/types';
import { NODE_Y_OFFSET } from './gather_nodes_lookup';
import { surfaceMat } from './gfx';

function colorPart(geometry: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  g.deleteAttribute('uv');
  const tint = new THREE.Color(color);
  const rgb = new Float32Array(g.getAttribute('position').count * 3);
  for (let i = 0; i < rgb.length; i += 3) tint.toArray(rgb, i);
  g.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  return g;
}

function oreParts(): THREE.BufferGeometry[] {
  const rock = new THREE.IcosahedronGeometry(0.53, 0);
  const parts = [
    colorPart(rock.clone().scale(1.2, 0.6, 0.98), 0x64686e),
    colorPart(rock.clone().scale(0.75, 0.46, 0.64).translate(0.51, -0.04, 0.13), 0x7d7771),
    colorPart(rock.clone().scale(0.62, 0.48, 0.68).translate(-0.48, -0.02, -0.05), 0x5a5b64),
  ];
  for (const [x, z, radius, height] of [
    [-0.23, 0.09, 0.18, 0.55],
    [0.11, -0.16, 0.19, 0.68],
    [0.31, 0.1, 0.13, 0.37],
  ]) {
    const seam = new THREE.ConeGeometry(radius, height, 5)
      .rotateZ(-x * 1.2)
      .translate(x, height * 0.32, z);
    parts.push(colorPart(seam, 0xa7bec4));
  }
  return parts;
}

function woodParts(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  for (const [x, y, z, length] of [
    [-0.29, 0, -0.12, 1.62],
    [0.28, 0.02, 0.02, 1.48],
    [0.02, 0.4, -0.02, 1.52],
  ]) {
    parts.push(
      colorPart(
        new THREE.CylinderGeometry(0.255, 0.275, length, 7).rotateX(Math.PI / 2).translate(x, y, z),
        0x603e2e,
      ),
    );
    for (const sign of [-1, 1]) {
      parts.push(
        colorPart(
          new THREE.CylinderGeometry(0.22, 0.22, 0.04, 7)
            .rotateX(Math.PI / 2)
            .translate(x, y, z + (sign * length) / 2),
          0xc69a65,
        ),
      );
      parts.push(
        colorPart(
          new THREE.CylinderGeometry(0.12, 0.12, 0.045, 7)
            .rotateX(Math.PI / 2)
            .translate(x, y, z + (sign * length) / 2),
          0xa8754b,
        ),
      );
    }
  }
  return parts;
}

function herbParts(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3;
    const leaf = new THREE.SphereGeometry(1, 6, 4)
      .scale(0.12, 0.035, 0.3)
      .rotateX(0.39)
      .translate(0, 0.12 + (i % 2) * 0.04, 0.22)
      .rotateY(angle);
    parts.push(colorPart(leaf, i % 2 ? 0x617842 : 0x8fa451));
  }
  parts.push(
    colorPart(new THREE.CylinderGeometry(0.028, 0.04, 0.5, 5).translate(0, 0.25, 0), 0x526736),
  );
  parts.push(
    colorPart(
      new THREE.IcosahedronGeometry(0.15, 0).scale(1, 0.54, 1).translate(0, 0.5, 0),
      0xe2ba69,
    ),
  );
  return parts;
}

const partsFor = { ore: oreParts, wood: woodParts, herb: herbParts } as const;

/** Three original resource silhouettes, aligned to the existing gather-node pivot. */
export function buildReleaseGatherNode(type: GatherNodeType): THREE.Mesh {
  const parts = partsFor[type]();
  const geometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  if (!geometry) throw new Error('Invalid gather-node geometry');
  geometry.computeBoundingBox();
  geometry.translate(0, -NODE_Y_OFFSET[type] - (geometry.boundingBox?.min.y ?? 0), 0);
  geometry.computeBoundingBox();
  const mesh = new THREE.Mesh(geometry, surfaceMat({ color: 0xffffff, vertexColors: true }));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
