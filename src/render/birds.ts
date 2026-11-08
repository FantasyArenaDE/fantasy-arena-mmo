import * as THREE from 'three';
import { DUNGEON_X_THRESHOLD, isBuiltinWorldActive, zoneAt } from '../sim/data';
import { GFX } from './gfx';

// Ambient high-altitude BIRD FLOCK — a render-only flourish, no sim state.
// A small V-formation of dark silhouettes drifts across the sky high above the
// player, wings flapping in a travelling wave. Distinct from ground wildlife
// and airborne motes: birds live in the sky band, far above terrain, and never
// interact with the world. Follows the foliage/clouds contract: a fixed pool is
// recycled around the moving player, never rebuilt, with no per-frame allocs.

export interface BirdsView {
  group: THREE.Group;
  update(px: number, pz: number, dt: number, heading?: number, openAir?: boolean): void;
}

/** Editor overrides for the ambient flock; absent fields keep the shipped look. */
export interface BirdsConfig {
  /** Birds in the flock (0 = no birds at all). */
  count?: number;
  /** true (default) = V-formation; false = a loose scattered flock. */
  formation?: boolean;
}

// Local seeded PRNG — render convention is never to touch Math.random so the
// flock is reproducible per world seed (mirrors foliage's hashing discipline).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SPAWN_RADIUS = 120; // where a recycled flock re-enters around the player
const DESPAWN_RADIUS = 165; // once the flock drifts past this it is recycled
// Flight band in yards. Authored maps fly the Studio's higher band; the
// built-in world keeps the band it shipped with.
const ALT_MIN = 162;
const ALT_MAX = 246;
const BUILTIN_ALT_MIN = 54;
const BUILTIN_ALT_MAX = 82;
const SPEED_MIN = 5;
const SPEED_MAX = 9;
const WING_LEN = 1.7;
const WING_CHORD = 0.75;
const FLAP_AMP = 0.55;

interface Bird {
  obj: THREE.Group;
  lw: THREE.Mesh;
  rw: THREE.Mesh;
  ox: number; // formation offset, flock-local (lateral)
  oz: number; // formation offset, flock-local (along travel)
  oy: number; // altitude jitter within the flock
  flapSpeed: number;
  flapPhase: number;
  bobAmp: number;
}

type BirdKind = 'field' | 'swan';

function buildBird(mat: THREE.Material, kind?: BirdKind): Bird {
  const obj = new THREE.Group();

  // Each wing is a flat quad pivoting at the shoulder (origin), lying in the
  // XZ plane and extending along ±X with its chord along Z. Flapping then rides
  // a single rotation about the forward (Z) axis — no Euler-order surprises.
  const wing = (side: number) => {
    if (!kind) {
      const geo = new THREE.PlaneGeometry(WING_LEN, WING_CHORD);
      geo.rotateX(-Math.PI / 2);
      return geo.translate((side * WING_LEN) / 2, 0, 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [
          0,
          0,
          0.3,
          side * 0.7,
          0,
          0.15,
          side * 1.65,
          0,
          -0.16,
          side * 1.25,
          0,
          -0.46,
          side * 0.36,
          0,
          -0.39,
          0,
          0,
          -0.24,
        ],
        3,
      ),
    );
    geo.setIndex([0, 1, 5, 1, 4, 5, 1, 2, 3, 1, 3, 4]);
    return geo;
  };

  const lw = new THREE.Mesh(wing(1), mat);
  const rw = new THREE.Mesh(wing(-1), mat);
  obj.add(lw, rw);
  if (kind) {
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 5), mat);
    body.scale.set(0.19, 0.14, 0.51);
    obj.add(body);
    if (kind === 'swan') {
      const neck = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 5), mat);
      neck.scale.set(0.083, 0.095, 0.52);
      neck.position.set(0, 0.11, 0.65);
      neck.rotation.x = -0.16;
      obj.add(neck);
    }
  }

  return {
    obj,
    lw,
    rw,
    ox: 0,
    oz: 0,
    oy: 0,
    flapSpeed: 0,
    flapPhase: 0,
    bobAmp: 0,
  };
}

export function buildBirds(seed: number, cfg?: BirdsConfig): BirdsView {
  if (import.meta.env.VITE_FA_BROWSER_RELEASE === '1' && !cfg) {
    const group = new THREE.Group();
    group.name = 'regional-birds';
    const field = buildFlock(
      seed,
      { count: GFX.standardMaterials ? 8 : 5, formation: false },
      'field',
    );
    const swans = buildFlock(seed ^ 0x4621, { count: 3 }, 'swan');
    group.add(field.group, swans.group);
    return {
      group,
      update(px, pz, dt, heading, openAir = true) {
        const biome = zoneAt(px, pz).biome;
        const waterCountry =
          biome === 'vale' || biome === 'beach' || biome === 'fen' || biome === 'marsh';
        field.update(px, pz, dt, heading, openAir);
        swans.update(px, pz, dt, heading, openAir && waterCountry);
      },
    };
  }
  return buildFlock(seed, cfg);
}

function buildFlock(seed: number, cfg?: BirdsConfig, kind?: BirdKind): BirdsView {
  const rand = mulberry32((seed ^ 0x5f3b21) >>> 0);
  const group = new THREE.Group();
  group.name = kind ?? 'birds';

  // Dark, double-sided, fog-aware silhouettes — read as specks against the sky
  // and fade into the haze at the rim like the clouds do.
  const mat = new THREE.MeshBasicMaterial({
    color: kind === 'swan' ? 0xf1ecdd : 0x2b2f38,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.82,
    fog: true,
    depthWrite: false,
  });

  const count = Math.max(
    0,
    Math.min(40, Math.round(cfg?.count ?? (GFX.standardMaterials ? 14 : 6))),
  );
  const formation = cfg?.formation ?? true;
  const birds: Bird[] = [];
  for (let i = 0; i < count; i++) {
    const b = buildBird(mat, kind);
    if (formation) {
      // Loose V-formation: pairs fan out behind a leader, left/right alternating.
      const rank = Math.ceil(i / 2);
      const side = i % 2 === 0 ? 1 : -1;
      b.ox = side * rank * (2.4 + rand() * 0.8);
      b.oz = -rank * (2.6 + rand() * 0.9) - rand() * 1.5;
      b.oy = (rand() - 0.5) * 3.0;
    } else {
      // Scattered flock: a loose drifting cloud with no leader.
      b.ox = (rand() - 0.5) * (14 + count);
      b.oz = (rand() - 0.5) * (14 + count);
      b.oy = (rand() - 0.5) * 8;
    }
    b.flapSpeed = kind === 'swan' ? 3.6 + rand() : 5.5 + rand() * 3.5;
    b.flapPhase = rand() * Math.PI * 2;
    b.bobAmp = 0.4 + rand() * 0.5;
    const s = 0.7 + rand() * 0.7; // size variety = fake depth
    b.obj.scale.setScalar(s * (kind === 'swan' ? 1.18 : 1));
    birds.push(b);
    group.add(b.obj);
  }

  // Flock state, in absolute world coords. Lazily seeded on the first update
  // once we know where the player actually is.
  let cx = 0;
  let cz = 0;
  const builtin = isBuiltinWorldActive();
  const altMin = kind === 'swan' ? 29 : builtin ? BUILTIN_ALT_MIN : ALT_MIN;
  const altMax = kind === 'swan' ? 43 : builtin ? BUILTIN_ALT_MAX : ALT_MAX;
  let cy = (altMin + altMax) / 2;
  let heading = 0;
  let speed = SPEED_MIN;
  let phase = 0;
  let seeded = false;

  function reseat(px: number, pz: number, viewHeading?: number): void {
    const bearing =
      viewHeading === undefined
        ? rand() * Math.PI * 2
        : viewHeading + (kind === 'swan' ? 0.68 : -0.5);
    const radius = viewHeading === undefined ? SPAWN_RADIUS : kind === 'swan' ? 72 : 98;
    cx = px + Math.sin(bearing) * radius;
    cz = pz + Math.cos(bearing) * radius;
    cy = altMin + rand() * (altMax - altMin);
    // Aim roughly back across the player's neighbourhood, with a lateral skew
    // so the flock crosses the sky rather than flying straight at the camera.
    const toPlayer = Math.atan2(px - cx, pz - cz);
    heading =
      viewHeading === undefined
        ? toPlayer + (rand() - 0.5) * 1.3
        : bearing + (kind === 'swan' ? -1 : 1) * Math.PI * 0.64;
    speed = SPEED_MIN + rand() * (SPEED_MAX - SPEED_MIN);
  }

  function update(px: number, pz: number, dt: number, viewHeading?: number, openAir = true): void {
    // No birds inside dungeons / arena interiors — the sky isn't rendered there.
    group.visible = openAir && px <= DUNGEON_X_THRESHOLD;
    if (!group.visible) return;

    if (!seeded) {
      reseat(px, pz, kind ? viewHeading : undefined);
      seeded = true;
    }

    cx += Math.sin(heading) * speed * dt;
    cz += Math.cos(heading) * speed * dt;
    phase += dt;

    const dx = cx - px;
    const dz = cz - pz;
    if (dx * dx + dz * dz > DESPAWN_RADIUS * DESPAWN_RADIUS) reseat(px, pz);

    const sh = Math.sin(heading);
    const ch = Math.cos(heading);
    for (const b of birds) {
      // Rotate the flock-local formation offset into world space by heading.
      const wx = b.ox * ch + b.oz * sh;
      const wz = -b.ox * sh + b.oz * ch;
      const bob = Math.sin(phase * 0.6 + b.flapPhase) * b.bobAmp;
      b.obj.position.set(cx + wx, cy + b.oy + bob, cz + wz);
      b.obj.rotation.y = heading;

      // Travelling-wave flap: rank further back lags, so the flock ripples.
      const flap = Math.sin(phase * b.flapSpeed + b.flapPhase + b.oz * 0.5) * FLAP_AMP;
      b.lw.rotation.z = flap;
      b.rw.rotation.z = -flap;
    }
  }

  return { group, update };
}
