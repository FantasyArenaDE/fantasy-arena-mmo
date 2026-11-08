import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Kenney's CC0 Nature Kit; both existing files are already in the release index.
export const FEN_MUSHROOM_RED = '/models/props/mushroom_red.glb';
export const FEN_MUSHROOM_TAN = '/models/props/mushroom_tan.glb';
export const FEN_MUSHROOM_BOUNDS = new THREE.Vector3(.9812928438186646, .5643923744806223, .5929024848756957);

/** A small cluster of existing CC0 mushrooms, grounded and fitted to the old patch. */
export function buildFenMushroomCluster(red: THREE.Group, tan: THREE.Group): THREE.Group {
  const cluster = new THREE.Group();
  cluster.name = 'fantasyArenaFenMushrooms';
  const items = [
    { source: red, x: -.17, z: -.04, size: 1 },
    { source: red, x: .17, z: .04, size: .79 },
    { source: tan, x: .00, z: -.15, size: .67 },
    { source: tan, x: -.31, z: .13, size: .53 },
    { source: red, x: .32, z: -.12, size: .45 },
  ];
  for (const item of items) {
    const model = item.source.clone(true);
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const height = bounds.max.y - bounds.min.y;
    if (!(height > 0)) throw new Error('Empty CC0 mushroom');
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -bounds.min.y, -center.z);
    const stem = new THREE.Group();
    stem.add(model);
    stem.scale.setScalar(.48 * item.size / height);
    stem.position.set(item.x, 0, item.z);
    cluster.add(stem);
  }
  cluster.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(cluster);
  const size = bounds.getSize(new THREE.Vector3());
  if (!(size.x > 0 && size.y > 0 && size.z > 0)) throw new Error('Empty mushroom cluster');
  const center = bounds.getCenter(new THREE.Vector3());
  const root = new THREE.Group();
  cluster.position.set(-center.x, -bounds.min.y, -center.z);
  root.scale.set(FEN_MUSHROOM_BOUNDS.x / size.x, FEN_MUSHROOM_BOUNDS.y / size.y, FEN_MUSHROOM_BOUNDS.z / size.z);
  root.add(cluster);
  root.updateMatrixWorld(true);
  // The source GLBs use normalized Int16 positions. Bake a float copy before
  // applying transforms, then merge clones sharing one material so the five
  // mushrooms do not create ten draw calls per fen cell.
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    const geometry = mesh.geometry.clone();
    for (const name of ['position', 'normal']) {
      const attr = geometry.getAttribute(name);
      if (!attr) continue;
      const values = new Float32Array(attr.count * 3);
      for (let i = 0; i < attr.count; i++) {
        values[i * 3] = attr.getX(i);
        values[i * 3 + 1] = attr.getY(i);
        values[i * 3 + 2] = attr.getZ(i);
      }
      geometry.setAttribute(name, new THREE.BufferAttribute(values, 3));
    }
    geometry.applyMatrix4(mesh.matrixWorld);
    const bucket = byMaterial.get(mesh.material) ?? [];
    bucket.push(geometry);
    byMaterial.set(mesh.material, bucket);
  });
  const merged = new THREE.Group();
  merged.name = 'fantasyArenaFenMushrooms';
  for (const [material, geometries] of byMaterial) {
    const geometry = mergeGeometries(geometries);
    if (!geometry) throw new Error('Cannot merge CC0 mushroom geometry');
    merged.add(new THREE.Mesh(geometry, material));
    for (const part of geometries) part.dispose();
  }
  return merged;
}
