import * as THREE from 'three';

// Bounds of the former Eastbrook shrub. The replacement remains centered in
// X/Z and on its ground pivot after normalizing, matching the existing layout.
export const FLOWERING_SHRUB_SIZE = new THREE.Vector3(.8954385228580808, .4500435949441486, .9580054879188538);
export const FLOWERING_SHRUB_URL = '/models/foliage/bush_flowers.glb';

export function fitFloweringShrub(geometries: readonly THREE.BufferGeometry[], size: THREE.Vector3): THREE.Vector3 {
  if (!(size.x > 0 && size.y > 0 && size.z > 0)) throw new Error('Invalid flowering shrub bounds');
  const scale = FLOWERING_SHRUB_SIZE.clone().divide(size);
  for (const geometry of geometries) {
    geometry.scale(scale.x, scale.y, scale.z);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }
  return FLOWERING_SHRUB_SIZE.clone();
}
