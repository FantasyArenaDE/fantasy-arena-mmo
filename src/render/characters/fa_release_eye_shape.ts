import {
  type BufferGeometry,
  Float32BufferAttribute,
  MathUtils,
  type Object3D,
  SkinnedMesh,
  Vector3,
} from 'three';
import { markSharedGeometry } from '../shared_resource';
import { faReleaseBrowId, type FaReleaseBrow } from './fa_release_face_options';
import { WOC_HEAD_MORPH_RANGE } from './woc_head_catalog';

export const FA_RELEASE_EYE_MORPHS = ['eyeSpacing', 'eyeSize', 'eyeTilt', 'browHeight'] as const;
type EyeMorph = (typeof FA_RELEASE_EYE_MORPHS)[number];
const BROW_MORPHS = ['browThickness', 'browArch', 'browAngle'] as const;
type BrowMorph = (typeof BROW_MORPHS)[number];
type Fit = 'male' | 'female';
type Part = 'skin' | 'eyes' | 'brows';
type EyeValues = readonly [
  eyeSpacing: number,
  eyeSize: number,
  eyeTilt: number,
  browHeight: number,
];

const EYE_CENTRES = {
  male: { x: 0.03378, y: 1.69857 },
  female: { x: 0.03455, y: 1.65605 },
} as const;
// Thickness, arch and outer-end tilt, in the order of BROW_MORPHS.
const BROW_VALUES: Readonly<Record<FaReleaseBrow, readonly [number, number, number]>> = {
  relaxed: [0, 0, 0],
  fa_slim: [-1, 0, 0],
  fa_arched: [-0.15, 1, 0.2],
  fa_straight: [0.15, -0.75, -0.6],
  fa_soft_arch: [0.4, 0.43, -0.23],
  fa_rounded: [0.75, 0.6, -0.72],
};
const geometries = new WeakMap<BufferGeometry, Map<string, BufferGeometry>>();
const smooth = MathUtils.smoothstep;

function slider(shape: unknown, key: EyeMorph): number {
  const raw =
    shape && typeof shape === 'object' ? (shape as Record<string, unknown>)[key] : undefined;
  const { min, max, def } = WOC_HEAD_MORPH_RANGE[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? MathUtils.clamp(raw, min, max) : def;
}

export function faReleaseEyeValues(shape: unknown): EyeValues {
  return [
    slider(shape, 'eyeSpacing'),
    slider(shape, 'eyeSize'),
    slider(shape, 'eyeTilt'),
    slider(shape, 'browHeight'),
  ];
}

export function faReleaseBrowValues(value: unknown) {
  return BROW_VALUES[faReleaseBrowId(value)];
}

/** Both eyes and the adjacent lids share the same bind-space transform.
 *  The outer skin blends to the neutral face before the nose, ears or collar. */
function displacement(
  fit: Fit,
  part: Part,
  control: EyeMorph | BrowMorph,
  x: number,
  y: number,
  z: number,
  out: Vector3,
): Vector3 {
  const centre = EYE_CENTRES[fit];
  const side = Math.sign(x);
  const dx = x - side * centre.x;
  const dy = y - centre.y;
  const front = smooth(z, 0.024, 0.049);
  const absX = Math.abs(x);
  // Move the brow mesh along the ridge. The inner and outer tips taper back
  // into the existing sculpt, including when the player also raises the brow.
  if (control === 'browThickness' || control === 'browArch' || control === 'browAngle') {
    const across = smooth(absX, 0.008, 0.066);
    const archedCentre = 0.012 + 0.006 * Math.sin(Math.PI * across) + 0.007 * across;
    const band = smooth(dy, 0.002, 0.009) * (1 - smooth(dy, 0.032, 0.043)) * front;
    if (control === 'browThickness') {
      return out.set(0, (dy - archedCentre) * 0.32 * band, 0);
    }
    if (control === 'browArch') {
      return out.set(0, 0.0054 * Math.sin(Math.PI * across) ** 2 * band, 0);
    }
    return out.set(0, 0.0048 * (across - 0.4) * band, 0);
  }
  if (control === 'browHeight') {
    if (part === 'eyes') return out.set(0, 0, 0);
    const brow = smooth(dy, 0.003, 0.011) * (1 - smooth(dy, 0.031, 0.045));
    const lateral = smooth(absX, 0.002, 0.009) * (1 - smooth(absX, 0.062, 0.082));
    return out.set(0, 0.0042 * brow * lateral * front, 0);
  }
  const distanceSq = (dx / 0.021) ** 2 + (dy / 0.017) ** 2;
  const eyelid =
    part === 'eyes' ? 1 : (1 - smooth(distanceSq, 1, 2.56)) * smooth(absX, 0.006, 0.016) * front;
  switch (control) {
    case 'eyeSpacing':
      return out.set(side * 0.004 * eyelid, 0, 0);
    case 'eyeSize':
      return out.set(dx * 0.12 * eyelid, dy * 0.12 * eyelid, 0);
    case 'eyeTilt':
      return out.set(-side * dy * 0.105 * eyelid, side * dx * 0.105 * eyelid, 0);
  }
}

/** Generate the relative mesh and normal targets once per authored surface. */
export function faReleaseEyeTargets(source: BufferGeometry, fit: Fit, part: Part) {
  const positions = source.getAttribute('position');
  const normals = source.getAttribute('normal');
  if (!positions || !normals || positions.count !== normals.count) return [];
  const original = new Vector3();
  const normal = new Vector3();
  const offset = new Vector3();
  const plus = new Vector3();
  const minus = new Vector3();
  const px = new Vector3();
  const py = new Vector3();
  const pz = new Vector3();
  const h = 0.0001;
  const controls = part === 'brows'
    ? [...FA_RELEASE_EYE_MORPHS, ...BROW_MORPHS]
    : FA_RELEASE_EYE_MORPHS;
  return controls.map((control) => {
    const relativePositions = new Float32Array(positions.count * 3);
    const relativeNormals = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      displacement(fit, part, control, x, y, z, offset);
      if (offset.x === 0 && offset.y === 0) continue;
      offset.toArray(relativePositions, i * 3);
      // Derivative columns of the planar warp. Inverse transpose keeps the
      // surface normals consistent across the soft edge of each lid and brow.
      px.copy(displacement(fit, part, control, x + h, y, z, plus))
        .sub(displacement(fit, part, control, x - h, y, z, minus))
        .multiplyScalar(0.5 / h);
      py.copy(displacement(fit, part, control, x, y + h, z, plus))
        .sub(displacement(fit, part, control, x, y - h, z, minus))
        .multiplyScalar(0.5 / h);
      pz.copy(displacement(fit, part, control, x, y, z + h, plus))
        .sub(displacement(fit, part, control, x, y, z - h, minus))
        .multiplyScalar(0.5 / h);
      original.fromBufferAttribute(normals, i);
      const det = (1 + px.x) * (1 + py.y) - py.x * px.y;
      const nx = (original.x * (1 + py.y) - original.y * px.y) / det;
      const ny = (original.y * (1 + px.x) - original.x * py.x) / det;
      normal.set(nx, ny, original.z - pz.x * nx - pz.y * ny);
      normal
        .normalize()
        .sub(original)
        .toArray(relativeNormals, i * 3);
    }
    const position = new Float32BufferAttribute(relativePositions, 3);
    const normalDelta = new Float32BufferAttribute(relativeNormals, 3);
    position.name = normalDelta.name = `FA_${control}`;
    return { position, normal: normalDelta };
  });
}

function fittedGeometry(source: BufferGeometry, fit: Fit, part: 'eyes' | 'brows') {
  const variants = geometries.get(source) ?? new Map<string, BufferGeometry>();
  const key = `${fit}:${part}`;
  const cached = variants.get(key);
  if (cached) return cached;
  if (Object.values(source.morphAttributes).some((attributes) => attributes.length > 0))
    return null;
  const targets = faReleaseEyeTargets(source, fit, part);
  if (!targets.length) return null;
  const geometry = markSharedGeometry(source.clone());
  geometry.morphAttributes.position = targets.map((target) => target.position);
  geometry.morphAttributes.normal = targets.map((target) => target.normal);
  geometry.morphTargetsRelative = true;
  variants.set(key, geometry);
  geometries.set(source, variants);
  return geometry;
}

/** The skin owns the same four values; each wearer owns its influence arrays. */
export function bindFaReleaseEyeMeshes(model: Object3D, fit: Fit) {
  const influences: { eyes?: number[]; brows?: number[] } = {};
  for (const [name, part] of [
    ['Eyes', 'eyes'],
    ['Eyebrows', 'brows'],
  ] as const) {
    const mesh = model.getObjectByName(name);
    if (!(mesh instanceof SkinnedMesh)) continue;
    const geometry = fittedGeometry(mesh.geometry, fit, part);
    if (!geometry) continue;
    mesh.geometry = geometry;
    mesh.updateMorphTargets();
    if (mesh.morphTargetInfluences) influences[part] = mesh.morphTargetInfluences;
  }
  return influences;
}
