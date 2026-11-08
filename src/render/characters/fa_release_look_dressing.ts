import {
  type BufferGeometry,
  type Material,
  Matrix4,
  Mesh,
  type Object3D,
  SkinnedMesh,
} from 'three';
import { cloneMaterialWithHooks } from '../material_clone_hooks';
import { markSharedGeometry } from '../shared_resource';
import { createFaReleaseBeard, type FaReleaseBeard } from './fa_release_beard';
import { createFaReleaseFaceShape } from './fa_release_face_shape';
import {
  type FaReleaseHairId,
  faReleaseDrawnLookSignature,
  faReleaseLook,
} from './fa_release_looks_core';
import { FaReleasePiercings } from './fa_release_piercings';
import { attachFaReleaseSkinMarks, type FaReleaseMarkings } from './fa_release_skin_marks';
import {
  hexToLinear,
  type WocHeadAppearanceInput,
  type WocHeadTintRef,
} from './woc_head_look_core';
import { attachWocHeadTint, setWocHeadTint, type WocHeadTintUniforms } from './woc_head_tint';

const proxyHairRef: WocHeadTintRef = { role: 'hair', ref: [0.26, 0.26, 0.26] };
const refs: Readonly<Record<string, WocHeadTintRef>> = {
  SuperHero_Male: { role: 'skin', ref: [0.40198, 0.18447, 0.09084] },
  Superhero_Female: { role: 'skin', ref: [0.40724, 0.20508, 0.09531] },
  Male_Peasant_Arms_2: { role: 'skin', ref: [0.40198, 0.17465, 0.08228] },
  FA_Hair_Simple: { role: 'hair', ref: [0.25677, 0.25677, 0.25677] },
  FA_Hair_Buns: { role: 'hair', ref: [0.27379, 0.27379, 0.27379] },
  FA_Hair_Buzz: { role: 'hair', ref: [0.25677, 0.25677, 0.25677] },
  FA_Hair_Long: { role: 'hair', ref: [0.27379, 0.27379, 0.27379] },
  FA_Hair_Bob: { role: 'hair', ref: [0.27379, 0.27379, 0.27379] },
  Eyes: { role: 'eye', ref: [0.3467, 0.30947, 0.25415], surface: 'iris' },
};
const brow = {
  male: { role: 'brow', ref: [0.28774, 0.28774, 0.28774] },
  female: { role: 'brow', ref: [0.29189, 0.29189, 0.29189] },
} as const satisfies Record<string, WocHeadTintRef>;

const fittedSideParts = new WeakMap<BufferGeometry, BufferGeometry>();

/** Both source hair meshes are skinned to Head. The short cut needs more room
 * behind body B's scalp; fit once per source geometry in the head bind frame. */
function fitBodyBSidePart(mesh: Object3D | undefined): void {
  if (!(mesh instanceof SkinnedMesh)) return;
  const source = mesh.geometry;
  let fitted = fittedSideParts.get(source);
  if (!fitted) {
    const headIndex = mesh.skeleton.bones.findIndex((bone) => bone.name === 'Head');
    const inverseBind = mesh.skeleton.boneInverses[headIndex];
    if (!inverseBind) return;
    const fit = new Matrix4().makeScale(1.05, 1, 1.15);
    fit.elements[14] = 0.08 * (1 - 1.15);
    const geometry: BufferGeometry = source
      .clone()
      .applyMatrix4(inverseBind.clone().invert().multiply(fit).multiply(inverseBind));
    fittedSideParts.set(source, markSharedGeometry(geometry));
    fitted = geometry;
  }
  mesh.geometry = fitted;
}

/** One visual owns these material clones. Shader programs and maps remain shared. */
export class FaReleaseLookDressing {
  private readonly parts: { mesh: Mesh; ref: WocHeadTintRef }[] = [];
  private readonly tints: WocHeadTintUniforms[] = [];
  private readonly materials: Material[] = [];
  private readonly markingUpdates: ((markings: FaReleaseMarkings) => void)[] = [];
  private readonly cuts: Readonly<Record<string, Object3D | undefined>>;
  private readonly faceShape: ReturnType<typeof createFaReleaseFaceShape>;
  private readonly piercings: FaReleasePiercings;
  private readonly beard: FaReleaseBeard | null;
  private current: ReturnType<typeof faReleaseLook>;
  private app: WocHeadAppearanceInput;
  private drawnHair: FaReleaseHairId | undefined;

  constructor(
    model: Object3D,
    private readonly fit: 'male' | 'female',
    beardSource?: Object3D,
    private readonly onPiercingChanged?: () => void,
  ) {
    this.current = faReleaseLook(fit, undefined);
    const cuts: Record<string, Object3D | undefined> = {
      undercut: model.getObjectByName('FA_Hair_Simple'),
      topknot: model.getObjectByName('FA_Hair_Buns'),
      fa_buzz: model.getObjectByName('FA_Hair_Buzz'),
      fa_long: model.getObjectByName('FA_Hair_Long'),
      fa_bob: model.getObjectByName('FA_Hair_Bob'),
    };
    this.cuts = cuts;
    if (fit === 'female') fitBodyBSidePart(cuts.undercut);
    model.traverse((node) => {
      const proxyHair = node.name.startsWith('FA_Hair_fa_px_');
      if (proxyHair) cuts[node.name.slice('FA_Hair_'.length)] = node;
      const ref = proxyHair ? proxyHairRef : node.name === 'Eyebrows' ? brow[fit] : refs[node.name];
      if (ref && node instanceof Mesh) this.parts.push({ mesh: node, ref });
    });
    this.beard = beardSource ? createFaReleaseBeard(model, fit, beardSource) : null;
    this.faceShape = createFaReleaseFaceShape(model, fit);
    this.piercings = new FaReleasePiercings(model, fit);
    this.rebindMaterials();
    this.drawHair(this.current.hair);
  }

  /** Call after the normal rig material factory replaces the materials on these meshes. */
  rebindMaterials(): void {
    this.releaseMaterials();
    const proxyMaterials = new Map<Material, Material>();
    for (const { mesh, ref } of this.parts) {
      const bind = (source: Material) => {
        const cached = ref === proxyHairRef ? proxyMaterials.get(source) : undefined;
        if (cached) return cached;
        const owned = cloneMaterialWithHooks(source);
        const tint = attachWocHeadTint(owned, ref.role, ref.ref, ref.surface);
        if (mesh.name === 'SuperHero_Male' || mesh.name === 'Superhero_Female') {
          this.markingUpdates.push(attachFaReleaseSkinMarks(owned, this.fit));
        }
        this.materials.push(owned);
        this.tints.push(tint);
        if (ref === proxyHairRef) proxyMaterials.set(source, owned);
        return owned;
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(bind) : bind(mesh.material);
    }
    this.writeColors();
  }

  apply(app: WocHeadAppearanceInput): boolean {
    if (this.app === app) return false;
    this.app = app;
    const next = faReleaseLook(this.fit, app);
    const faceChanged = this.faceShape?.apply(app?.headShape, app?.headNose, app?.headMouth, app?.headBrows);
    const beardChanged = this.beard?.apply(
      app?.headBeard,
      hexToLinear(next.colors.hair),
      app?.headShape,
    );
    const piercingChanged = this.piercings.apply(
      app?.headPiercing,
      app?.nosePiercing,
      app?.earringMaterial,
    );
    if (piercingChanged) this.onPiercingChanged?.();
    if (faReleaseDrawnLookSignature(next) === faReleaseDrawnLookSignature(this.current)) {
      return !!(faceChanged || beardChanged || piercingChanged);
    }
    this.current = next;
    this.drawHair(next.hair);
    this.writeColors();
    return true;
  }

  private drawHair(hair: FaReleaseHairId): void {
    if (hair === this.drawnHair) return;
    this.drawnHair = hair;
    for (const [id, mesh] of Object.entries(this.cuts)) {
      if (mesh) mesh.visible = hair === id;
    }
  }

  private writeColors(): void {
    const { colors } = this.current;
    for (const tint of this.tints) setWocHeadTint(tint, hexToLinear(colors[tint.role]));
    for (const update of this.markingUpdates) update(this.current.markings);
  }

  dispose(): void {
    this.piercings.dispose();
    this.beard?.dispose();
    this.releaseMaterials();
  }

  private releaseMaterials(): void {
    for (const material of this.materials) material.dispose();
    this.materials.length = 0;
    this.tints.length = 0;
    this.markingUpdates.length = 0;
  }
}
