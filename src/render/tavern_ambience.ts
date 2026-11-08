import * as THREE from 'three';
import { litSmokePuffGeometry, litSmokePuffMaterial, writeLitSmokePuff } from './lit_smoke_puffs';
import {
  tavernChimneyMouths,
  tavernChimneyPuff,
  tavernWindowEmission,
} from './tavern_ambience_core';

const NEAR = 110;
const BUILDINGS = 3;
const CHIMNEYS = 4;

interface TavernDetail {
  root: THREE.Group;
  group: THREE.Object3D;
  panes: (THREE.MeshLambertMaterial | THREE.MeshStandardMaterial)[];
  sources: THREE.Vector3[];
  phase: number;
}

function tavernDetail(
  root: THREE.Group,
  group: THREE.Object3D,
  asset: string,
): TavernDetail | null {
  const mouths = tavernChimneyMouths(asset);
  const model = group.children[0];
  if (!mouths.length || !model) return null;
  const panes = new Set<TavernDetail['panes'][number]>();
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (
        (material instanceof THREE.MeshLambertMaterial ||
          material instanceof THREE.MeshStandardMaterial) &&
        material.emissiveMap &&
        /^painted_(?:walls|roof)@tavern(?:_b)?$/.test(material.name)
      ) {
        panes.add(material);
      }
    }
  });
  if (!panes.size) return null;
  return {
    root,
    group,
    panes: [...panes],
    sources: mouths.map(({ x, y, z }) => model.localToWorld(new THREE.Vector3(x, y, z))),
    phase: Math.abs(Math.sin(group.position.x * 12.63 + group.position.z * 4.91)),
  };
}

/** Reuse the taverns' painted emissive panes and the world smoke material. */
export function buildTavernAmbience(roots: readonly THREE.Group[], lowGfx: boolean) {
  const count = lowGfx ? 5 : 8;
  const geometry = litSmokePuffGeometry(BUILDINGS * CHIMNEYS * count);
  const mesh = new THREE.Mesh(geometry, litSmokePuffMaterial());
  mesh.name = 'painted-tavern-chimney-smoke';
  mesh.frustumCulled = false;
  mesh.visible = false;
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const colors = geometry.getAttribute('color') as THREE.BufferAttribute;
  const p = positions.array as Float32Array;
  const c = colors.array as Float32Array;
  const known = new WeakMap<THREE.Object3D, TavernDetail | null>();
  const active: TavernDetail[] = [];
  const puff = { x: 0, y: 0, z: 0, size: 0, alpha: 0 };
  let nextScan = -Infinity;
  let lastX = Infinity;
  let lastZ = Infinity;
  const nearby = (group: THREE.Object3D, x: number, z: number) =>
    (group.position.x - x) ** 2 + (group.position.z - z) ** 2 < NEAR ** 2;

  return {
    mesh,
    update(time: number, cameraX: number, cameraZ: number, night: number, smoke: boolean): void {
      if (time >= nextScan || (cameraX - lastX) ** 2 + (cameraZ - lastZ) ** 2 > 22 ** 2) {
        active.length = 0;
        for (const root of roots) {
          if (!root.visible) continue;
          for (const group of root.children) {
            if (active.length >= BUILDINGS) break;
            const asset: unknown = group.userData.assetId;
            if (!group.visible || typeof asset !== 'string' || !nearby(group, cameraX, cameraZ))
              continue;
            if (!known.has(group)) known.set(group, tavernDetail(root, group, asset));
            const entry = known.get(group);
            if (entry) active.push(entry);
          }
        }
        nextScan = time + 0.8;
        lastX = cameraX;
        lastZ = cameraZ;
      }
      const strength = tavernWindowEmission(night);
      let i = 0;
      for (const detail of active) {
        if (!detail.root.visible || !detail.group.visible) continue;
        for (const pane of detail.panes) pane.emissiveIntensity = strength;
        if (!smoke) continue;
        for (const [source, mouth] of detail.sources.entries()) {
          const dx = mouth.x - cameraX;
          const dz = mouth.z - cameraZ;
          const radius = Math.hypot(dx, dz) || 1;
          for (let slot = 0; slot < count; slot++) {
            tavernChimneyPuff(time, slot, count, detail.phase + source * 0.36, puff);
            writeLitSmokePuff(
              p,
              c,
              i++,
              mouth.x + puff.x,
              mouth.y + puff.y,
              mouth.z + puff.z,
              -dz / radius,
              dx / radius,
              puff.size,
              0.56,
              0.56,
              0.58,
              puff.alpha,
            );
          }
        }
      }
      mesh.visible = i > 0;
      geometry.setDrawRange(0, i * 6);
      if (i) positions.needsUpdate = colors.needsUpdate = true;
    },
  };
}
