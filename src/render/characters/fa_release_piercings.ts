import {
  Bone,
  Group,
  type Matrix4,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  OctahedronGeometry,
  SkinnedMesh,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { markSharedGeometry, markSharedMaterial } from '../shared_resource';
import { addFaReleaseEarJewels } from './fa_release_ear_jewels';

import {
  type FaReleaseEarPiercingId,
  type FaReleaseNosePiercingId,
  type FaReleasePiercingId,
  faReleaseEarPiercingId,
  faReleaseNosePiercingId,
} from './fa_release_piercing_core';
import { type EarringMaterial, EARRING_MATERIALS, normalizeEarringMaterial } from './modular';

export {
  FA_RELEASE_PIERCING_IDS,
  type FaReleasePiercingId,
  faReleasePiercingId,
} from './fa_release_piercing_core';

type MountedId = Exclude<FaReleasePiercingId, 'none'>;
type Fit = 'male' | 'female';
type Point = readonly [number, number, number];

// Positions on the CC0 head surface, measured in the matching rig's Head bind
// frame. The hoop and nose seats allow for the skin's blended neck motion
// in the idle and walk clips. Ear anchors mirror across the centreline.
const anchors: Record<Fit, { lobe: Point; septum: Point }> = {
  male: { lobe: [0.0731, 0.06, 0.0146], septum: [0, 0.0481, 0.1183] },
  female: { lobe: [0.0702, 0.0699, -0.0008], septum: [0, 0.0563, 0.1095] },
};

// Every wearer shares these tiny meshes and the material palette. Keep some
// diffuse response on metals so they read in areas without a bright reflection.
const gold = markSharedMaterial(new MeshStandardMaterial({ color: 0xd79749, metalness: 0.48, roughness: 0.32 }));
const garnet = markSharedMaterial(new MeshStandardMaterial({ color: 0xa32341, metalness: 0.12, roughness: 0.3 }));
const palette = new Map<EarringMaterial, MeshStandardMaterial>([['default', gold]]);
const sphere = markSharedGeometry(new SphereGeometry(1, 8, 6));
const facet = markSharedGeometry(new OctahedronGeometry(1, 0));
const hoopRadius = 0.0088;
const hoop = markSharedGeometry(new TorusGeometry(hoopRadius, 0.0015, 6, 18));
const noseRadius = 0.0063;
const noseHalfGap = 0.47;
const horseshoe = markSharedGeometry(new TorusGeometry(noseRadius, 0.0012, 6, 18, 2 * (Math.PI - noseHalfGap)));
horseshoe.rotateZ(Math.PI / 2 + noseHalfGap);
const front = new Vector3(0, 0, 1);

function jewelMaterial(id: EarringMaterial): MeshStandardMaterial {
  if (id === 'default') return gold;
  const cached = palette.get(id);
  if (cached) return cached;
  const spec = EARRING_MATERIALS[id];
  const material = markSharedMaterial(new MeshStandardMaterial({
    ...spec, metalness: Math.min(spec.metalness, 0.58),
  }));
  palette.set(id, material);
  return material;
}

function addEarStud(group: Group, anchor: Vector3, side: number, material: MeshStandardMaterial): void {
  const normal = new Vector3(side * 0.84, -0.16, 0.42).normalize();
  const base = new Mesh(sphere, material);
  base.name = 'FA_EarStud';
  base.scale.set(0.0038, 0.0038, 0.00165);
  base.position.copy(anchor).addScaledVector(normal, 0.0011);
  base.quaternion.setFromUnitVectors(front, normal);
  const stone = new Mesh(facet, garnet);
  stone.name = 'FA_EarStudStone';
  stone.scale.set(0.00265, 0.00265, 0.00205);
  stone.position.copy(anchor).addScaledVector(normal, 0.00265);
  stone.quaternion.copy(base.quaternion);
  group.add(base, stone);
}

function addEarHoop(group: Group, anchor: Vector3, side: number, material: MeshStandardMaterial): void {
  const ring = new Mesh(hoop, material);
  ring.name = 'FA_EarHoop';
  ring.position.copy(anchor);
  // The upper arc threads through the lobe, a little inboard of the stud face.
  ring.position.x -= side * 0.00115;
  ring.position.y -= hoopRadius - 0.0005;
  ring.position.z += 0.0008;
  ring.quaternion.setFromUnitVectors(front, new Vector3(side * 0.58, 0, 0.82).normalize());
  group.add(ring);
}

interface NeckMount {
  readonly bone: Bone;
  readonly bindFromHead: Matrix4;
}

function findNeckMount(model: Object3D, head: Bone, fit: Fit): NeckMount | null {
  const skin = model.getObjectByName(fit === 'male' ? 'SuperHero_Male' : 'Superhero_Female');
  const neck = head.parent;
  if (!(skin instanceof SkinnedMesh) || !skin.skeleton || !(neck instanceof Bone)) return null;
  const { bones, boneInverses } = skin.skeleton;
  const headInverse = boneInverses[bones.indexOf(head)];
  const neckInverse = boneInverses[bones.indexOf(neck)];
  if (!headInverse || !neckInverse) return null;
  return {
    bone: neck,
    bindFromHead: neckInverse.clone().multiply(headInverse.clone().invert()),
  };
}

// The nose and lobes carry both Head and neck weights. Reproduce the skin's
// local blend for the tiny rigid group, using the renderer's own matrix update.
class SkinMountedJewelry extends Group {
  constructor(
    private readonly mount: NeckMount,
    private readonly neckWeight: number,
  ) {
    super();
  }

  override updateMatrix(): void {
    const head = this.parent;
    if (!head) {
      super.updateMatrix();
      return;
    }
    this.matrix
      .copy(head.matrixWorld)
      .invert()
      .multiply(this.mount.bone.matrixWorld)
      .multiply(this.mount.bindFromHead)
      .multiplyScalar(this.neckWeight);
    const elements = this.matrix.elements;
    const headWeight = 1 - this.neckWeight;
    elements[0] += headWeight;
    elements[5] += headWeight;
    elements[10] += headWeight;
    elements[15] += headWeight;
    this.matrixWorldNeedsUpdate = true;
  }
}

const neckWeights = {
  male: { ears: 0.06, septum: 0.085 },
  female: { ears: 0.045, septum: 0.054 },
} as const;

function makeJewelry(fit: Fit, style: MountedId, mount: NeckMount | null, material: MeshStandardMaterial): Group {
  const group =
    mount && style !== 'lobes'
      ? new SkinMountedJewelry(mount, neckWeights[fit][style === 'septum' ? 'septum' : 'ears'])
      : new Group();
  group.name = `FA_Piercings_${style}`;
  const anchor = anchors[fit];
  if (style === 'septum') {
    const ring = new Mesh(horseshoe, material);
    ring.name = 'FA_SeptumRing';
    // Set the two upper ends into the columella. The lower arc clears the lip
    // for all supported nose morphs on both fits.
    ring.position.set(...anchor.septum);
    group.add(ring);
    for (const side of [-1, 1]) {
      const bead = new Mesh(sphere, material);
      bead.name = 'FA_SeptumBead';
      bead.scale.setScalar(0.00165);
      bead.position.copy(ring.position);
      bead.position.x += side * noseRadius * Math.sin(noseHalfGap);
      bead.position.y += noseRadius * Math.cos(noseHalfGap);
      group.add(bead);
    }
  } else {
    for (const side of [-1, 1]) {
      const p = new Vector3(side * anchor.lobe[0], anchor.lobe[1], anchor.lobe[2]);
      if (style === 'lobes') addEarStud(group, p, side, material);
      else if (style === 'ears') addEarHoop(group, p, side, material);
      else addFaReleaseEarJewels(group, style, p, side, material);
    }
  }
  for (const part of group.children) part.userData.faReleaseAppearancePart = true;
  return group;
}

/** Rigid jewelry follows the same animated Head bone as the fitted CC0 face. */
export class FaReleasePiercings {
  private head: Bone | undefined;
  private readonly neckMount: NeckMount | null;
  private ears: FaReleaseEarPiercingId = 'none';
  private nose: FaReleaseNosePiercingId = 'none';
  private material: EarringMaterial = 'default';
  private readonly groups = new Map<MountedId, Group>();

  constructor(
    model: Object3D,
    private readonly fit: Fit,
  ) {
    const head = model.getObjectByName('Head');
    this.head = head instanceof Bone ? head : undefined;
    this.neckMount = this.head ? findNeckMount(model, this.head, fit) : null;
  }

  apply(headPiercing: unknown, nosePiercing?: unknown, material?: unknown): boolean {
    const head = this.head;
    if (!head) return false;
    const ears = faReleaseEarPiercingId(headPiercing);
    const nose = faReleaseNosePiercingId(headPiercing, nosePiercing);
    const materialId = normalizeEarringMaterial(material);
    const materialChanged = this.material !== materialId;
    if (!materialChanged && ears === this.ears && nose === this.nose) return false;
    if (materialChanged) {
      this.clearGroups();
      this.ears = this.nose = 'none';
      this.material = materialId;
    }
    this.updateSlot(head, this.ears, ears);
    this.updateSlot(head, this.nose, nose);
    this.ears = ears;
    this.nose = nose;
    return true;
  }

  private updateSlot(head: Bone, before: FaReleasePiercingId, next: FaReleasePiercingId): void {
    if (before === next) return;
    if (before !== 'none') this.groups.get(before)?.removeFromParent();
    if (next === 'none') return;
    let group = this.groups.get(next);
    if (!group) {
      group = makeJewelry(this.fit, next, this.neckMount, jewelMaterial(this.material));
      this.groups.set(next, group);
    }
    head.add(group);
  }

  private clearGroups(): void {
    for (const group of this.groups.values()) group.removeFromParent();
    this.groups.clear();
  }

  dispose(): void {
    this.clearGroups();
    this.head = undefined;
  }
}
