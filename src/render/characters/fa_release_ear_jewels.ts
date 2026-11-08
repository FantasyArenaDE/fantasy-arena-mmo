import {
  type BufferGeometry,
  ExtrudeGeometry,
  type Group,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { markSharedGeometry, markSharedMaterial } from '../shared_resource';
import type { FaReleaseEarPiercingId } from './fa_release_piercing_core';

type Ornament = Exclude<FaReleaseEarPiercingId, 'none' | 'lobes' | 'ears'>;
type Point = readonly [x: number, y: number, z: number];
type Piece = {
  readonly geometry: BufferGeometry;
  readonly offset: Point;
  readonly size: Point;
  readonly accent?: MeshStandardMaterial;
};

const round = markSharedGeometry(new SphereGeometry(1, 8, 6));
const cut = markSharedGeometry(new OctahedronGeometry(1));
const ring = markSharedGeometry(new TorusGeometry(1, 0.17, 6, 14));
const cuff = markSharedGeometry(new TorusGeometry(1, 0.26, 6, 14, 5.15));
const moon = new Shape();
moon.moveTo(0.42, 0.92);
moon.bezierCurveTo(-1.18, 0.90, -1.12, -1.05, 0.58, -0.87);
moon.bezierCurveTo(-0.28, -0.52, -0.41, 0.38, 0.42, 0.92);
const star = new Shape();
for (let i = 0; i < 10; i++) {
  const angle = Math.PI / 2 + i * Math.PI / 5;
  const radius = i % 2 === 0 ? 1 : 0.43;
  const x = radius * Math.cos(angle);
  const y = radius * Math.sin(angle);
  if (i === 0) star.moveTo(x, y);
  else star.lineTo(x, y);
}
star.closePath();
const feather = new Shape();
feather.moveTo(0.12, 1);
feather.bezierCurveTo(-0.95, 0.72, -1.03, -0.25, -0.15, -1);
feather.bezierCurveTo(0.55, -0.43, 0.68, 0.49, 0.12, 1);

function cast(shape: Shape): BufferGeometry {
  return markSharedGeometry(new ExtrudeGeometry(shape, {
    steps: 1, depth: 0.18, bevelEnabled: true, bevelSegments: 1,
    bevelThickness: 0.08, bevelSize: 0.08, curveSegments: 7,
  }).translate(0, 0, -0.09));
}

const bone = markSharedMaterial(new MeshStandardMaterial({ color: 0xe5d8bc, roughness: 0.57 }));
const pearl = markSharedMaterial(new MeshStandardMaterial({ color: 0xf0e5d9, roughness: 0.27 }));
const jade = markSharedMaterial(new MeshStandardMaterial({ color: 0x5da288, roughness: 0.31 }));
const garnet = markSharedMaterial(new MeshStandardMaterial({ color: 0xa32341, roughness: 0.30 }));
const enamel = markSharedMaterial(new MeshStandardMaterial({ color: 0x5f436b, roughness: 0.43 }));

const stud: Piece = { geometry: round, offset: [0, 0, 0.0015], size: [0.003, 0.003, 0.0017] };
const link: Piece = { geometry: ring, offset: [0, -0.0048, 0.0016], size: [0.0024, 0.0036, 0.0034] };
const ornaments: Readonly<Record<Ornament, readonly Piece[]>> = {
  fa_moon: [
    stud, link,
    { geometry: cast(moon), offset: [0.001, -0.0125, 0.0023], size: [0.0068, 0.0075, 0.006] },
  ],
  fa_star: [
    stud,
    { geometry: cast(star), offset: [0, -0.0095, 0.002], size: [0.0061, 0.0067, 0.006] },
    { geometry: cut, offset: [0, -0.0095, 0.0038], size: [0.002, 0.002, 0.0013], accent: garnet },
  ],
  fa_rune: [
    stud, link,
    { geometry: cut, offset: [0, -0.0135, 0.0021], size: [0.0048, 0.0078, 0.0029], accent: jade },
    { geometry: round, offset: [0, -0.009, 0.0029], size: [0.0034, 0.00165, 0.002] },
  ],
  fa_drop: [
    stud, link,
    { geometry: ring, offset: [0, -0.0092, 0.0014], size: [0.0022, 0.0034, 0.0031] },
    { geometry: round, offset: [0, -0.0156, 0.0021], size: [0.0035, 0.005, 0.0035], accent: pearl },
  ],
  fa_cuff: [
    { geometry: cuff, offset: [0, -0.002, 0.0014], size: [0.0058, 0.006, 0.006] },
    { geometry: cuff, offset: [0, -0.0052, 0.0022], size: [0.0052, 0.0054, 0.006] },
    { geometry: cut, offset: [0, -0.005, 0.0038], size: [0.00225, 0.00225, 0.0019], accent: garnet },
  ],
  fa_feather: [
    stud, link,
    { geometry: cast(feather), offset: [0, -0.0148, 0.0017], size: [0.0056, 0.0094, 0.0045], accent: enamel },
    { geometry: round, offset: [-0.0005, -0.0152, 0.003], size: [0.00065, 0.0078, 0.00065] },
  ],
  fa_bone: [
    stud, link,
    { geometry: round, offset: [0, -0.0131, 0.0016], size: [0.0025, 0.0051, 0.0022], accent: bone },
    { geometry: round, offset: [0, -0.0174, 0.0016], size: [0.0041, 0.0021, 0.0022], accent: bone },
  ],
  fa_bone_hoop: [
    stud,
    { geometry: ring, offset: [0, -0.0084, 0.0012], size: [0.0068, 0.0074, 0.006], accent: bone },
    { geometry: round, offset: [0, -0.0159, 0.0014], size: [0.003, 0.0021, 0.0024] },
  ],
};

const front = new Vector3(0, 0, 1);

export function addFaReleaseEarJewels(
  group: Group,
  style: Ornament,
  anchor: Vector3,
  side: number,
  material: MeshStandardMaterial,
): void {
  const normal = new Vector3(side * 0.59, 0, 0.81).normalize();
  for (const [index, piece] of ornaments[style].entries()) {
    const mesh = new Mesh(piece.geometry, piece.accent ?? material);
    mesh.name = `FA_EarJewel_${style}_${side < 0 ? 'L' : 'R'}_${index}`;
    mesh.scale.set(...piece.size);
    mesh.position.copy(anchor);
    mesh.position.x += side * piece.offset[0];
    mesh.position.y += piece.offset[1];
    mesh.position.addScaledVector(normal, piece.offset[2]);
    mesh.quaternion.setFromUnitVectors(front, normal);
    group.add(mesh);
  }
}
