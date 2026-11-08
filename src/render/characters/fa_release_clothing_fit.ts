import type { BufferGeometry, Object3D, SkinnedMesh } from 'three';
import { markSharedGeometry } from '../shared_resource';

const fitted = new WeakMap<BufferGeometry, BufferGeometry>();
const prepared = new WeakSet<BufferGeometry>();

const ramp = (value: number, start: number, end: number) =>
  Math.min(1, Math.max(0, (value - start) / (end - start)));

/** Fit the shirt and sleeves without changing the exposed neck or hands. */
export function fitFaReleaseClothing(root: Object3D): void {
  root.traverse((node) => {
    const mesh = node as SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const skin = /^superhero_(?:male|female)$/i.test(node.name);
    if (!skin && !/^(?:Male|Female)_Peasant_Arms(?:_1)?$/.test(node.name)) return;
    const source = mesh.geometry;
    if (prepared.has(source)) return;
    const cached = fitted.get(source);
    if (cached) {
      mesh.geometry = cached;
      return;
    }
    const geometry = source.clone();
    const positions = geometry.getAttribute('position');
    const female = /female/i.test(node.name);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      const side = Math.abs(x);
      if (skin) {
        // Move only the covered shoulder girdle inward. Keep the center of
        // the collar and the open neckline at their original surface.
        const collar = z > 0
          ? ramp(side, 0.073, 0.12)
          : Math.max(ramp(side, 0.03, 0.078), 1 - ramp(y, 1.46, 1.50));
        const shoulder = ramp(y, 1.28, 1.39) * (1 - ramp(y, 1.52, 1.58))
          * collar * (1 - ramp(side, 0.32, 0.46));
        positions.setXYZ(i, x * (1 - 0.11 * shoulder), y - 0.057 * shoulder,
          z - (z + 0.038) * 0.33 * shoulder);
      } else {
        // Clearance for the bent sleeves, tapered out at the wrist. Apply a
        // position-based offset so coincident seam vertices stay together.
        const cuff = female ? 0.80 : 0.55;
        const bulge = (female ? 0.43 : 0.19) * (1 - ramp(side, cuff - 0.12, cuff));
        const axisY = female ? 1.417 : 1.455;
        const axisZ = female ? -0.038 : -0.055;
        positions.setXYZ(i, x, y + (y - axisY) * bulge, z + (z - axisZ) * bulge);
      }
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    markSharedGeometry(geometry);
    fitted.set(source, geometry);
    prepared.add(geometry);
    mesh.geometry = geometry;
  });
}
