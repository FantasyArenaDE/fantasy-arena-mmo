// Relative morphs on the two CC0 release skins. These envelopes are fitted in
// the meshes' authored bind coordinates (+Y up, +Z front). Both envelopes fade
// to zero before the collar, hairline, ears, arms and clothing.
import {
  type BufferAttribute,
  type BufferGeometry,
  Float32BufferAttribute,
  type InterleavedBufferAttribute,
  MathUtils,
  type Object3D,
  SkinnedMesh,
  Vector3,
} from 'three';
import { markSharedGeometry } from '../shared_resource';
import { faReleaseMouthId, faReleaseNoseId } from './fa_release_face_options';
import {
  bindFaReleaseEyeMeshes,
  faReleaseBrowValues,
  faReleaseEyeTargets,
  faReleaseEyeValues,
} from './fa_release_eye_shape';
import { WOC_HEAD_MORPH_RANGE } from './woc_head_catalog';

type Fit = 'male' | 'female';
type Attribute = BufferAttribute | InterleavedBufferAttribute;
type Displacement = (x: number, y: number, z: number) => number;

const PROFILE = {
  male: {
    skin: 'SuperHero_Male',
    jawHeight: [1.565, 1.582, 1.616, 1.663],
    jawDepth: [-0.016, 0.048],
    noseHeight: [1.633, 1.646, 1.666, 1.687],
    noseBridge: [1.651, 1.676, 1.702],
    lipLine: 1.621,
  },
  female: {
    skin: 'Superhero_Female',
    jawHeight: [1.522, 1.54, 1.574, 1.622],
    jawDepth: [-0.016, 0.043],
    noseHeight: [1.594, 1.606, 1.621, 1.644],
    noseBridge: [1.616, 1.636, 1.658],
    lipLine: 1.579,
  },
} as const;
const RANGE = WOC_HEAD_MORPH_RANGE.chinWidth;
const EYE_INFLUENCE_START = 8;
const geometries = new WeakMap<BufferGeometry, Partial<Record<Fit, BufferGeometry>>>();
const smooth = MathUtils.smoothstep;

/** Use the existing appearance value, whose inverse is shown as width. */
export function faReleaseChinWidth(shape: unknown): number {
  const value =
    shape !== null && typeof shape === 'object' && 'chinWidth' in shape
      ? shape.chinWidth
      : undefined;
  return typeof value === 'number' && Number.isFinite(value)
    ? MathUtils.clamp(value, RANGE.min, RANGE.max)
    : RANGE.def;
}

export { faReleaseMouthId, faReleaseNoseId } from './fa_release_face_options';

/** Signed X delta for one unit of softness; multiply by (softness - default).
 *  Facial parts authored in the same bind space can use the same deformation. */
export function faReleaseChinWidthDelta(fit: Fit, x: number, y: number, z: number): number {
  const { jawHeight: h, jawDepth: d } = PROFILE[fit];
  const vertical = smooth(y, h[0], h[1]) * (1 - smooth(y, h[2], h[3]));
  const front = smooth(z, d[0], d[1]);
  const side = 1 - smooth(Math.abs(x), 0.088, 0.115);
  return -0.34 * x * vertical * front * side;
}

function broadenNose(fit: Fit, x: number, y: number, z: number): number {
  const h = PROFILE[fit].noseHeight;
  const vertical = smooth(y, h[0], h[1]) * (1 - smooth(y, h[2], h[3]));
  const side = 1 - smooth(Math.abs(x), 0.018, 0.046);
  return 0.38 * x * vertical * side * smooth(z, 0.077, 0.098);
}

function archNose(fit: Fit, x: number, y: number, z: number): number {
  const [base, peak, top] = PROFILE[fit].noseBridge;
  const vertical = smooth(y, base, peak) * (1 - smooth(y, peak, top));
  const side = 1 - smooth(Math.abs(x), 0.013, 0.03);
  return 0.014 * vertical * side * smooth(z, 0.073, 0.099);
}

function raiseNoseTip(fit: Fit, x: number, y: number, z: number): number {
  const [, lower, peak, upper] = PROFILE[fit].noseHeight;
  return 0.0068 * smooth(y, lower - 0.006, lower + 0.002)
    * (1 - smooth(y, peak, upper)) * (1 - smooth(Math.abs(x), 0.01, 0.034))
    * smooth(z, 0.078, 0.11);
}

/** Keep the lip sculpt inside the face surface and clear of the nose and jaw. */
function lipShape(fit: Fit, x: number, y: number, z: number, smirk: boolean): number {
  const fromLine = y - PROFILE[fit].lipLine;
  const nearLip = (1 - smooth(Math.abs(fromLine), 0.008, 0.023)) * smooth(z, 0.058, 0.092);
  const lateral = 1 - smooth(Math.abs(x), 0.031, 0.052);
  if (smirk) return 0.008 * smooth(x, 0.006, 0.031) * lateral * nearLip;
  return Math.max(-0.004, Math.min(0.004, 0.5 * fromLine)) * lateral * nearLip;
}

function narrowLips(fit: Fit, x: number, y: number, z: number): number {
  const line = Math.abs(y - PROFILE[fit].lipLine);
  return -0.2 * x * (1 - smooth(Math.abs(x), 0.025, 0.048))
    * (1 - smooth(line, 0.005, 0.02)) * smooth(z, 0.063, 0.092);
}

function cupidLips(fit: Fit, x: number, y: number, z: number): number {
  const line = y - PROFILE[fit].lipLine;
  const peaks = 1 - smooth(Math.abs(Math.abs(x) - 0.009), 0, 0.011);
  return 0.0058 * peaks * smooth(line, -0.005, 0.002)
    * (1 - smooth(line, 0.009, 0.02)) * smooth(z, 0.068, 0.096);
}

function relativeTarget(
  positions: Attribute,
  normals: Attribute,
  deform: Displacement,
  axis: 0 | 1 | 2,
  name: string,
): { position: Float32BufferAttribute; normal: Float32BufferAttribute } {
  const count = positions.count;
  const offsets = new Float32Array(count * 3);
  const normalOffsets = new Float32Array(count * 3);
  const before = new Vector3();
  const after = new Vector3();
  const h = 0.0001;
  for (let i = 0; i < count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const displacement = deform(x, y, z);
    const offset = i * 3;
    offsets[offset + axis] = displacement;
    if (displacement === 0 && (axis !== 0 || x !== 0)) continue;
    // Inverse transpose of the local Jacobian for the one displaced axis.
    const dx = (deform(x + h, y, z) - deform(x - h, y, z)) / (2 * h);
    const dy = (deform(x, y + h, z) - deform(x, y - h, z)) / (2 * h);
    const dz = (deform(x, y, z + h) - deform(x, y, z - h)) / (2 * h);
    if (dx === 0 && dy === 0 && dz === 0) continue;
    before.fromBufferAttribute(normals, i);
    const axial = before.getComponent(axis) / (1 + [dx, dy, dz][axis]);
    after.set(before.x - axial * dx, before.y - axial * dy, before.z - axial * dz);
    after.normalize().sub(before).toArray(normalOffsets, offset);
  }

  const position = new Float32BufferAttribute(offsets, 3);
  const normal = new Float32BufferAttribute(normalOffsets, 3);
  position.name = normal.name = name;
  return { position, normal };
}

function faceGeometry(source: BufferGeometry, fit: Fit): BufferGeometry | null {
  const cached = geometries.get(source);
  if (cached?.[fit]) return cached[fit];
  // The CC0 head GLBs have no authored morphs. Don't overwrite a future set.
  if (Object.values(source.morphAttributes).some((attributes) => attributes.length > 0))
    return null;
  const positions = source.getAttribute('position');
  const normals = source.getAttribute('normal');
  if (!positions || !normals || positions.count !== normals.count) return null;

  const targets = [
    relativeTarget(
      positions,
      normals,
      (x, y, z) => faReleaseChinWidthDelta(fit, x, y, z),
      0,
      'FA_ChinSoftness',
    ),
    relativeTarget(positions, normals, (x, y, z) => broadenNose(fit, x, y, z), 0, 'FA_NoseBroad'),
    relativeTarget(positions, normals, (x, y, z) => archNose(fit, x, y, z), 2, 'FA_NoseAquiline'),
    relativeTarget(
      positions,
      normals,
      (x, y, z) => lipShape(fit, x, y, z, false),
      1,
      'FA_LipsFull',
    ),
    relativeTarget(
      positions,
      normals,
      (x, y, z) => lipShape(fit, x, y, z, true),
      1,
      'FA_LipsSmirk',
    ),
    relativeTarget(positions, normals, (x, y, z) => raiseNoseTip(fit, x, y, z), 1, 'FA_NoseTip'),
    relativeTarget(positions, normals, (x, y, z) => narrowLips(fit, x, y, z), 0, 'FA_LipsNarrow'),
    relativeTarget(positions, normals, (x, y, z) => cupidLips(fit, x, y, z), 1, 'FA_LipsCupid'),
    ...faReleaseEyeTargets(source, fit, 'skin'),
  ];
  const geometry = markSharedGeometry(source.clone());
  geometry.morphAttributes.position = targets.map((target) => target.position);
  geometry.morphAttributes.normal = targets.map((target) => target.normal);
  geometry.morphTargetsRelative = true;
  const fits = cached ?? {};
  fits[fit] = geometry;
  geometries.set(source, fits);
  return geometry;
}

export interface FaReleaseFaceShape {
  apply(shape: unknown, headNose?: unknown, headMouth?: unknown, headBrows?: unknown): boolean;
}

/** Bind before the visual is revealed. The source assets own the shared
 *  geometry lifetime, and Three keeps each instance's influences separately. */
export function createFaReleaseFaceShape(model: Object3D, fit: Fit): FaReleaseFaceShape | null {
  const head = model.getObjectByName(PROFILE[fit].skin);
  if (!(head instanceof SkinnedMesh)) return null;
  const geometry = faceGeometry(head.geometry, fit);
  if (!geometry) return null;
  head.geometry = geometry;
  head.updateMorphTargets();
  const influences = head.morphTargetInfluences;
  if (!influences) return null;
  const eyeMeshes = bindFaReleaseEyeMeshes(model, fit);

  return {
    apply(shape, headNose, headMouth, headBrows) {
      const chin = faReleaseChinWidth(shape) - RANGE.def;
      const nose = faReleaseNoseId(headNose);
      const mouth = faReleaseMouthId(headMouth);
      const eyes = faReleaseEyeValues(shape);
      const brows = faReleaseBrowValues(headBrows);
      const face = [
        chin,
        nose === 'broad' ? 1 : nose === 'fa_soft' ? -0.6 : 0,
        nose === 'aquiline' ? 1 : nose === 'fa_soft' ? -0.48 : 0,
        mouth === 'full' ? 1 : mouth === 'fa_thin' ? -1 : mouth === 'fa_rounded' ? 0.6 : 0,
        Number(mouth === 'smirk'),
        Number(nose === 'fa_button'),
        mouth === 'fa_narrow' ? 1 : mouth === 'fa_rounded' ? 0.55 : 0,
        Number(mouth === 'fa_cupids_bow'),
      ];
      const browInfluences = eyeMeshes.brows;
      if (
        face.every((value, index) => value === influences[index]) &&
        eyes.every((value, index) => value === influences[EYE_INFLUENCE_START + index]) &&
        (!browInfluences || brows.every((value, index) => value === browInfluences[eyes.length + index]))
      ) {
        return false;
      }
      face.forEach((value, index) => { influences[index] = value; });
      for (const [index, value] of eyes.entries()) {
        influences[EYE_INFLUENCE_START + index] = value;
        if (eyeMeshes.eyes) eyeMeshes.eyes[index] = value;
        if (browInfluences) browInfluences[index] = value;
      }
      if (browInfluences) brows.forEach((value, index) => { browInfluences[eyes.length + index] = value; });
      return true;
    },
  };
}
