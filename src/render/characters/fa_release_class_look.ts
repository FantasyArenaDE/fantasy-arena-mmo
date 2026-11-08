import {
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshLambertMaterial,
  type Object3D,
  OctahedronGeometry,
  SkinnedMesh,
  SphereGeometry,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ITEMS } from '../../sim/data';
import type { ArmorType, PlayerClass } from '../../sim/types';
import { markSharedGeometry, markSharedMaterial } from '../shared_resource';

type Fit = 'male' | 'female';
type Shape = 'plate' | 'mantle' | 'cowl' | 'hide';
type BoneName = 'spine_03' | 'thigh_l' | 'thigh_r' | 'upperarm_l' | 'upperarm_r';
type Point = readonly [x: number, y: number, z: number];

export interface FaReleaseClassLook {
  readonly cls: PlayerClass;
  readonly fit: Fit;
}

interface ClassKit {
  readonly fabric: number;
  readonly secondary: number;
  readonly trim: number;
  readonly shape: Shape;
  readonly cape: number;
  readonly split: number;
  readonly side?: 'l' | 'r';
}

// The clothes on the CC0 bodies still show the folds and seams from their
// original atlas. These palettes and rigged pieces are original class art.
const kits: Readonly<Record<PlayerClass, ClassKit>> = {
  warrior: {
    fabric: 0xbd684c,
    secondary: 0x455365,
    trim: 0x9caab5,
    shape: 'plate',
    cape: 0,
    split: 0.1,
  },
  paladin: {
    fabric: 0xffedca,
    secondary: 0x8593a7,
    trim: 0xe2b557,
    shape: 'plate',
    cape: 0.36,
    split: 0.29,
  },
  hunter: {
    fabric: 0x8f9d64,
    secondary: 0xa77956,
    trim: 0xbda774,
    shape: 'hide',
    cape: 0,
    split: 0,
    side: 'l',
  },
  rogue: {
    fabric: 0x605360,
    secondary: 0x55454e,
    trim: 0xc4756e,
    shape: 'hide',
    cape: 0.23,
    split: 0,
    side: 'r',
  },
  priest: {
    fabric: 0xffe4b9,
    secondary: 0xa58a86,
    trim: 0xf4d792,
    shape: 'mantle',
    cape: 0.28,
    split: 0.38,
  },
  shaman: {
    fabric: 0x75a9b6,
    secondary: 0x5b6b77,
    trim: 0x79d3d3,
    shape: 'hide',
    cape: 0,
    split: 0.18,
  },
  mage: {
    fabric: 0x8caddc,
    secondary: 0x52639a,
    trim: 0xbadcf3,
    shape: 'mantle',
    cape: 0.45,
    split: 0.33,
  },
  dreamdancer: { fabric: 0x776bb0, secondary: 0x4b467f, trim: 0xa8dcf3, shape: 'mantle', cape: 0.32, split: 0.33 },
  warlock: {
    fabric: 0x6d527e,
    secondary: 0x493656,
    trim: 0xcb87d2,
    shape: 'cowl',
    cape: 0.48,
    split: 0.34,
  },
  druid: {
    fabric: 0x8eab68,
    secondary: 0x6a8154,
    trim: 0xd4bf78,
    shape: 'hide',
    cape: 0.31,
    split: 0.21,
  },
};

export function faReleaseClassLook(key: string, fit: Fit): FaReleaseClassLook | undefined {
  const cls = /^player_([a-z]+)(?:_female)?$/.exec(key)?.[1];
  if (!cls || !Object.hasOwn(kits, cls)) return undefined;
  return { cls: cls as PlayerClass, fit };
}

/** Only textile meshes receive the class tint. All skin, eyes and hair keep the chosen look. */
export function faReleaseClassTint(
  look: FaReleaseClassLook | undefined,
  name: string,
  chestSurface: ArmorType = 'cloth',
): number | undefined {
  if (!look || !/^(?:Male|Female)_Peasant_(?:Body|Arms(?:_1)?|Feet|Legs)$/.test(name))
    return undefined;
  const kit = kits[look.cls];
  if (!name.endsWith('_Body') || chestSurface === 'cloth') {
    return /(?:Feet|Legs)$/.test(name) ? kit.secondary : kit.fabric;
  }
  const [tint, strength] = chestSurface === 'mail' ? [0xb5cbdc, 0.82] : [0x955c38, 0.58];
  return new Color(kit.fabric).lerp(new Color(tint), strength).getHex();
}

const costumeMaterial = markSharedMaterial(
  new MeshLambertMaterial({ vertexColors: true, side: DoubleSide }),
);

const coatMaterials: Readonly<Record<ArmorType, MeshLambertMaterial>> = {
  cloth: costumeMaterial,
  leather: markSharedMaterial(costumeMaterial.clone()),
  mail: markSharedMaterial(costumeMaterial.clone()),
};
coatMaterials.leather.color.setHex(0xecc29c);
coatMaterials.mail.color.setHex(0xc5daef);

// The visible style follows the worn chest slot, even when the same outfit
// geometry is shared. Keep the actual item ID so identical snapshots are cheap.
const wornChest = new WeakMap<Object3D, { item: string; surface: ArmorType }>();

export function faReleaseChestSurface(root: Object3D): ArmorType {
  return wornChest.get(root)?.surface ?? 'cloth';
}

export function updateFaReleaseChestSurface(root: Object3D, itemId: string | undefined): boolean {
  const previous = wornChest.get(root);
  if (previous?.item === itemId) return false;
  const item = itemId ? ITEMS[itemId] : undefined;
  const surface = item?.kind === 'armor' && item.slot === 'chest' ? item.armorType : 'cloth';
  if (itemId) wornChest.set(root, { item: itemId, surface });
  else wornChest.delete(root);
  return surface !== (previous?.surface ?? 'cloth');
}

export function faReleaseCoatMaterial(surface: ArmorType): MeshLambertMaterial {
  return coatMaterials[surface];
}

function colored(geometry: BufferGeometry, hex: number): BufferGeometry {
  const col = new Color(hex);
  const count = geometry.getAttribute('position').count;
  const values = new Float32Array(count * 3);
  for (let i = 0; i < values.length; i += 3) col.toArray(values, i);
  geometry.setAttribute('color', new Float32BufferAttribute(values, 3));
  geometry.deleteAttribute('uv');
  return geometry;
}

function panel(outline: readonly Point[], hex: number): BufferGeometry {
  const positions: number[] = [];
  for (let i = 1; i < outline.length - 1; i++) {
    positions.push(...outline[0], ...outline[i], ...outline[i + 1]);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return colored(geometry, hex);
}

function jewel(x: number, y: number, z: number, scale: Point, tint: number): BufferGeometry {
  return colored(new OctahedronGeometry(1).scale(...scale).translate(x, y, z), tint);
}

/** Rigid pieces are drawn in the bind frame and seat on the animation bones. */
function coat(look: FaReleaseClassLook, kit: ClassKit): BufferGeometry[] {
  const a = look.fit === 'male';
  const y = a ? 1.48 : 1.43;
  const w = a ? 0.18 : 0.137;
  const z = a ? 0.142 : 0.153;
  const metal = kit.shape === 'plate';
  const h = metal ? 0.165 : 0.115;
  const pieces: BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    // A separate raised ridge follows the fuller B chest; a single plane
    // between collar and waist would intersect the source clothing in motion.
    const outer: Point = [side * w, y, a ? 0.055 : 0.082];
    pieces.push(
      panel(
        [
          [side * w * 0.46, y - h * 0.64, z + (a ? 0.003 : 0.023)],
          outer,
          [side * w * 0.9, y - h * 0.63, z - (a ? 0.023 : 0.005)],
          [0, y - h, z],
          [side * 0.035, y, z - 0.016],
          outer,
        ],
        kit.secondary,
      ),
      panel(
        [
          [side * 0.044, y, z - 0.007],
          [side * 0.022, y - h * 0.69, z + 0.019],
          [0, y - h, z + 0.011],
          [side * 0.032, y, z - 0.01],
        ],
        kit.trim,
      ),
    );
  }
  const badgeY = y - h * 0.78;
  if (look.cls === 'warrior') {
    const front = z + 0.029;
    pieces.push(
      panel(
        [
          [-0.037, badgeY + 0.03, front],
          [0.037, badgeY + 0.03, front],
          [0.027, badgeY - 0.009, front],
          [0, badgeY - 0.041, front],
          [-0.027, badgeY - 0.009, front],
        ],
        kit.trim,
      ),
      panel(
        [
          [-0.027, badgeY + 0.021, front + 0.002],
          [0.027, badgeY + 0.021, front + 0.002],
          [0.02, badgeY - 0.006, front + 0.002],
          [0, badgeY - 0.029, front + 0.002],
          [-0.02, badgeY - 0.006, front + 0.002],
        ],
        kit.fabric,
      ),
      jewel(0, badgeY, front + 0.004, [0.009, 0.024, 0.005], kit.trim),
    );
  } else if (look.cls === 'paladin' || look.cls === 'priest') {
    const radius = look.cls === 'paladin' ? 0.035 : 0.025;
    pieces.push(
      colored(
        new CylinderGeometry(radius, radius, 0.009, 10)
          .rotateX(Math.PI / 2)
          .translate(0, badgeY, z + 0.025),
        kit.trim,
      ),
      jewel(0, badgeY, z + 0.033, [radius * 0.61, radius * 0.78, 0.008], kit.secondary),
    );
  } else {
    pieces.push(jewel(0, badgeY, z + 0.024, [0.024, 0.029, 0.012], kit.trim));
  }
  if (kit.cape) {
    const end = y - kit.cape - 0.07;
    const hem = kit.shape === 'cowl' ? 0.081 : w;
    const back = a ? -0.187 : -0.169;
    pieces.push(
      panel(
        [
          [-w, y, back],
          [w, y, back],
          [hem, end + 0.05, -0.213],
          [0, end, -0.235],
          [-hem, end + 0.05, -0.213],
        ],
        kit.secondary,
      ),
      panel(
        [
          [-hem, end + 0.05, -0.214],
          [0, end - 0.004, -0.237],
          [hem, end + 0.05, -0.214],
          [0, end + 0.021, -0.238],
        ],
        kit.trim,
      ),
    );
  }
  if (look.cls === 'hunter') {
    const tilt = -0.29;
    pieces.push(
      colored(
        new CylinderGeometry(0.041, 0.034, 0.39, 8)
          .rotateZ(tilt)
          .translate(0.079, y - 0.112, -0.162),
        kit.secondary,
      ),
    );
    for (const offset of [-0.022, 0, 0.022]) {
      pieces.push(
        colored(
          new CylinderGeometry(0.005, 0.005, 0.154, 4)
            .rotateZ(tilt)
            .translate(0.145 + offset, y + 0.107, -0.159),
          kit.trim,
        ),
      );
    }
  }
  return pieces;
}

function shoulder(look: FaReleaseClassLook, kit: ClassKit, side: 1 | -1): BufferGeometry[] {
  const a = look.fit === 'male';
  const heavy = kit.shape === 'plate' || kit.shape === 'cowl';
  const x = (a ? 0.265 : 0.196) * side;
  const y = a ? 1.487 : 1.455;
  const z = a ? -0.022 : -0.016;
  const width = heavy ? 0.145 : 0.111;
  const depth = heavy ? 0.141 : 0.111;
  const height = heavy ? 0.093 : 0.072;
  // The former hemisphere ended above the upper-arm seam. The shell now
  // wraps below that seam and covers the forward edge of the bent shoulder.
  const dome = (size: number, lift: number, tint: number, arc: number) =>
    colored(
      new SphereGeometry(1, heavy ? 8 : 10, 5, 0, Math.PI * 2, 0, Math.PI * arc)
        .scale(width * size, height * size, depth * size)
        .translate(x, y + lift, z),
      tint,
    );
  const pieces = [dome(1, 0, kit.trim, 0.74), dome(0.88, 0.02, kit.secondary, 0.62)];
  if (kit.shape === 'cowl' || look.cls === 'shaman') {
    pieces.push(jewel(x + side * 0.049, y + 0.072, z, [0.033, 0.067, 0.027], kit.trim));
  } else if (look.cls === 'druid') {
    pieces.push(
      colored(
        new ConeGeometry(0.041, 0.108, 4).rotateZ(-side * 0.76).translate(x, y + 0.066, z),
        kit.fabric,
      ),
    );
  }
  return pieces;
}

function leg(look: FaReleaseClassLook, kit: ClassKit, side: 1 | -1): BufferGeometry[] {
  const x = side * 0.112;
  const y = look.fit === 'male' ? 0.993 : 0.97;
  const w = kit.shape === 'plate' ? 0.083 : 0.071;
  const end = y - kit.split;
  const tip = x + side * 0.024;
  return [
    panel(
      [
        [x - w, y, 0.122],
        [x + w, y, 0.122],
        [tip + w * 0.63, end + 0.054, 0.089],
        [tip, end, 0.091],
        [tip - w * 0.63, end + 0.054, 0.089],
      ],
      kit.secondary,
    ),
    panel(
      [
        [x - w, y, 0.125],
        [x + w, y, 0.125],
        [x + w, y - 0.018, 0.123],
        [x - w, y - 0.018, 0.123],
      ],
      kit.trim,
    ),
    panel(
      [
        [tip - w * 0.63, end + 0.054, 0.093],
        [tip, end - 0.002, 0.094],
        [tip + w * 0.63, end + 0.054, 0.093],
        [tip, end + 0.024, 0.095],
      ],
      kit.trim,
    ),
  ];
}

const cache = new Map<string, ReadonlyMap<BoneName, BufferGeometry>>();

function outfit(look: FaReleaseClassLook): ReadonlyMap<BoneName, BufferGeometry> {
  const key = `${look.fit}:${look.cls}`;
  const resident = cache.get(key);
  if (resident) return resident;
  const kit = kits[look.cls];
  const meshes = new Map<BoneName, BufferGeometry>();
  const add = (bone: BoneName, parts: BufferGeometry[]) => {
    const buffers = parts.map((p) => (p.index ? p.toNonIndexed() : p));
    const merged = mergeGeometries(buffers);
    for (const geo of new Set([...parts, ...buffers])) geo.dispose();
    if (!merged) return;
    // The CC0 body meshes are indexed. Keep the same topology contract when
    // the static shadow baker combines the body with these costume parts.
    merged.setIndex(Array.from({ length: merged.getAttribute('position').count }, (_, i) => i));
    meshes.set(bone, markSharedGeometry(merged));
  };
  add('spine_03', coat(look, kit));
  for (const [suffix, side] of [
    ['l', 1],
    ['r', -1],
  ] as const) {
    if (!kit.side || kit.side === suffix)
      add(`upperarm_${suffix}` as BoneName, shoulder(look, kit, side));
    if (kit.split) add(`thigh_${suffix}` as BoneName, leg(look, kit, side));
  }
  cache.set(key, meshes);
  return meshes;
}

export function mountFaReleaseClassLook(root: Object3D, look: FaReleaseClassLook): void {
  let skin: SkinnedMesh | undefined;
  root.traverse((node) => {
    if (!skin && node instanceof SkinnedMesh) skin = node;
  });
  const skeleton = skin?.skeleton;
  if (!skeleton) return;
  for (const [name, geometry] of outfit(look)) {
    const index = skeleton.bones.findIndex((bone) => bone.name === name);
    const bone = skeleton.bones[index];
    const inverse = skeleton.boneInverses[index];
    if (!bone || !inverse) continue;
    const piece = new Mesh(geometry, costumeMaterial);
    piece.name = `FA_ClassKit_${name}`;
    piece.userData.faReleaseAppearancePart = true;
    piece.applyMatrix4(inverse);
    bone.add(piece);
  }
}
