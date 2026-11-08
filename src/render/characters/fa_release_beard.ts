import {
  type BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  type Object3D,
  SkinnedMesh,
  Vector3,
} from 'three';
import { cloneMaterialWithHooks } from '../material_clone_hooks';
import { markOwnedMaterial, markSharedGeometry } from '../shared_resource';
import { faReleaseChinWidth, faReleaseChinWidthDelta } from './fa_release_face_shape';
import { faReleaseBeardStyle, type FaReleaseBeardStyle } from './fa_release_beard_core';
import { WOC_HEAD_MORPH_RANGE } from './woc_head_catalog';
import type { WocLinearRgb } from './woc_head_look_core';
import { attachWocHeadTint, setWocHeadTint } from './woc_head_tint';

type Fit = 'male' | 'female';

export const FA_RELEASE_BEARD_URL =
  '/models/chars/players/fantasy-arena/quaternius-pilot/fa-beard-styles.glb';

const HAIR_REF: WocLinearRgb = [0.25677, 0.25677, 0.25677];
const chinGeometries = new WeakMap<BufferGeometry, BufferGeometry>();
const reshaped = new WeakMap<BufferGeometry, BufferGeometry>();

/** Unknown old looks stay stored and draw clean-shaven on the two CC0 bodies. */
export { faReleaseBeardStyle } from './fa_release_beard_core';

export interface FaReleaseBeard {
  apply(headBeard: unknown, hairColor: WocLinearRgb, headShape?: unknown): boolean;
  dispose(): void;
}

/** Beard geometry is in the CC0 Head bone's space. Translate the body's
 * chin morph back to that frame, so the goatee follows changing jaw width. */
function fittedChin(geometry: BufferGeometry, skin: SkinnedMesh, head: Object3D, fit: Fit) {
  const cached = chinGeometries.get(geometry);
  if (cached) return cached;
  const bindToHead = skin.skeleton.boneInverses.find((_, i) => skin.skeleton.bones[i] === head);
  if (!bindToHead) return markSharedGeometry(geometry);
  const headToBind = bindToHead.clone().invert();
  const headPoint = new Vector3();
  const bindPoint = new Vector3();
  const pos = geometry.getAttribute('position');
  const deltas = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    headPoint.fromBufferAttribute(pos, i);
    bindPoint.copy(headPoint).applyMatrix4(headToBind);
    bindPoint.x += faReleaseChinWidthDelta(fit, bindPoint.x, bindPoint.y, bindPoint.z);
    bindPoint
      .applyMatrix4(bindToHead)
      .sub(headPoint)
      .toArray(deltas, i * 3);
  }
  const shaped = markSharedGeometry(geometry.clone());
  shaped.morphTargetsRelative = true;
  shaped.morphAttributes.position = [new Float32BufferAttribute(deltas, 3)];
  chinGeometries.set(geometry, shaped);
  return shaped;
}

function reshape(source: BufferGeometry, shape: 'curl' | 'long'): BufferGeometry {
  const cached = reshaped.get(source);
  if (cached) return cached;
  const geometry = source.clone();
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds) return source;
  const width = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x), 0.001);
  const length = Math.max(bounds.max.y - bounds.min.y, 0.001);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    if (shape === 'curl') {
      const tip = Math.pow(Math.min(1, Math.abs(x) / width), 2.5);
      positions.setXYZ(i, x * (1 + tip * 0.15), y + tip * 0.0075, z - tip * 0.004);
    } else {
      const drop = (bounds.max.y - y) / length;
      positions.setXYZ(i, x * (1 - drop * 0.24), y - drop * 0.029, z + drop * 0.0045);
    }
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  reshaped.set(source, geometry);
  return geometry;
}

/** Attach the two fitted pieces before the visual takes its material
 * snapshot. Each wearer owns its tint and shares the fitted geometry. */
export function createFaReleaseBeard(
  model: Object3D,
  fit: Fit,
  source: Object3D,
): FaReleaseBeard | null {
  const head = model.getObjectByName('Head');
  const hair = model.getObjectByName('FA_Hair_Simple');
  const skin = model.getObjectByName(fit === 'male' ? 'SuperHero_Male' : 'Superhero_Female');
  const moustache = source.getObjectByName(`${fit}-moustache`);
  const goatee = source.getObjectByName(`${fit}-goatee`);
  if (
    !head ||
    !(hair instanceof Mesh) ||
    Array.isArray(hair.material) ||
    !(skin instanceof SkinnedMesh) ||
    !(moustache instanceof Mesh) ||
    !(goatee instanceof Mesh)
  )
    return null;

  const material = markOwnedMaterial(cloneMaterialWithHooks(hair.material));
  const tint = attachWocHeadTint(material, 'hair', HAIR_REF);
  const upper = new Mesh(markSharedGeometry(moustache.geometry), material);
  const lower = new Mesh(fittedChin(goatee.geometry, skin, head, fit), material);
  const curled = new Mesh(markSharedGeometry(reshape(moustache.geometry, 'curl')), material);
  const long = new Mesh(fittedChin(reshape(goatee.geometry, 'long'), skin, head, fit), material);
  upper.name = 'FA_Beard_Moustache';
  lower.name = 'FA_Beard_Goatee';
  curled.name = 'FA_Beard_Curl';
  long.name = 'FA_Beard_Long';
  const pieces = [upper, lower, curled, long];
  for (const piece of pieces) {
    piece.userData.faReleaseAppearancePart = true;
    piece.visible = false;
    head.add(piece);
  }

  let style: FaReleaseBeardStyle = 'none';
  let color: WocLinearRgb | null = null;
  let chin = WOC_HEAD_MORPH_RANGE.chinWidth.def;
  return {
    apply(headBeard, hairColor, headShape) {
      const next = faReleaseBeardStyle(headBeard);
      const width = faReleaseChinWidth(headShape);
      const changed =
        next !== style ||
        width !== chin ||
        !color ||
        color.some((component, i) => component !== hairColor[i]);
      if (!changed) return false;
      style = next;
      color = [...hairColor];
      chin = width;
      upper.visible = style === 'moustache' || style === 'fa_duet' || style === 'fa_long' || style === 'fa_boxed';
      lower.visible = style === 'goatee' || style === 'fa_duet';
      curled.visible = style === 'fa_curl';
      long.visible = style === 'fa_long';
      for (const chinPiece of [lower, long]) {
        if (chinPiece.morphTargetInfluences) {
          chinPiece.morphTargetInfluences[0] = chin - WOC_HEAD_MORPH_RANGE.chinWidth.def;
        }
      }
      setWocHeadTint(tint, color);
      return true;
    },
    dispose() {
      for (const piece of pieces) piece.removeFromParent();
      material.dispose();
    },
  };
}
