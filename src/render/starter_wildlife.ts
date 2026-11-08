import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { zoneAt } from '../sim/data';
import { terrainHeight, waterLevelAt } from '../sim/world';
import { loadGltf } from './assets/loader';
import {
  DOLPHIN_ASSET,
  MIRROR_SCHOOL,
  STARTER_DOLPHIN_ROUTES,
  STARTER_WOODLAND,
  starterDolphinPose,
  starterDolphinRouteIsWet,
} from './starter_wildlife_paths';

type Compile = (root: THREE.Object3D) => Promise<unknown>;
type AnimalMaterial = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial;
const DOE_ASSET = '/models/creatures/fantasy-arena/doe.glb';
const TAU = 2 * Math.PI;
const SPLASH_POINTS = [0.08, 0.92];

function ellipsoid(
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  length: number,
  tilt = 0,
): THREE.BufferGeometry {
  return new THREE.SphereGeometry(1, 9, 6)
    .scale(width, height, length)
    .rotateX(tilt)
    .translate(x, y, z);
}

function squirrelMeshes() {
  const bodyParts = [
    ellipsoid(0, 0.23, 0, 0.12, 0.13, 0.22),
    ellipsoid(0, 0.33, 0.18, 0.09, 0.09, 0.1),
    ellipsoid(-0.052, 0.41, 0.17, 0.028, 0.067, 0.027),
    ellipsoid(0.052, 0.41, 0.17, 0.028, 0.067, 0.027),
    ellipsoid(-0.08, 0.115, -0.07, 0.055, 0.07, 0.11),
    ellipsoid(0.08, 0.115, -0.07, 0.055, 0.07, 0.11),
    ellipsoid(-0.053, 0.12, 0.145, 0.037, 0.043, 0.08),
    ellipsoid(0.053, 0.12, 0.145, 0.037, 0.043, 0.08),
  ];
  const tailParts = [
    ellipsoid(0, 0.18, -0.11, 0.094, 0.25, 0.12, -0.42),
    ellipsoid(0, 0.35, -0.13, 0.1, 0.19, 0.13, 0.35),
  ];
  const body = mergeGeometries(bodyParts);
  const tail = mergeGeometries(tailParts);
  const faceParts = [
    ellipsoid(-0.076, 0.355, 0.217, 0.014, 0.018, 0.019),
    ellipsoid(0.076, 0.355, 0.217, 0.014, 0.018, 0.019),
    ellipsoid(0, 0.317, 0.271, 0.021, 0.015, 0.018),
  ];
  const face = mergeGeometries(faceParts);
  for (const geo of [...bodyParts, ...tailParts, ...faceParts]) geo.dispose();
  return { body, tail, face };
}

function nearby(px: number, pz: number, x: number, z: number, range: number): boolean {
  return (px - x) ** 2 + (pz - z) ** 2 < range * range;
}

function createRig(source: THREE.Group, scale: number, footprint: 'height' | 'length') {
  const root = new THREE.Group();
  const model = clone(source);
  // Refresh each skinned mesh's bind inverse before reading quantized vertices.
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model, true);
  const size = footprint === 'height' ? bounds.max.y - bounds.min.y : bounds.max.z - bounds.min.z;
  const normalized = new THREE.Group();
  normalized.add(model);
  if (size > 0.01) {
    const factor = scale / size;
    normalized.scale.setScalar(factor);
    bounds.getCenter(normalized.position).multiplyScalar(-factor);
    if (footprint === 'height') normalized.position.y = -bounds.min.y * factor;
  }
  root.add(normalized);
  root.visible = false;
  return { root, mixer: new THREE.AnimationMixer(model) };
}

/** A small client-side cast, separate from mob spawns, combat and fishing. */
export function buildStarterWildlife(
  seed: number,
  fishGeo: THREE.BufferGeometry,
  fishMaterial: AnimalMaterial,
  onSplash?: (x: number, z: number, radius: number, strength: number) => void,
) {
  const group = new THREE.Group();
  group.name = 'starter-wildlife';
  const compiledRoots = new Set<THREE.Object3D>();
  let gate: Compile | null = null;
  let started = false;
  let clock = 0;
  const woodland = new THREE.Group();
  woodland.name = 'woodland-squirrels';
  group.add(woodland);
  const fur = fishMaterial.clone();
  fur.color.set(0xa85a32);
  const tailFur = fur.clone();
  tailFur.color.set(0x8b4328);
  fur.emissive.setHex(0);
  tailFur.emissive.setHex(0);
  if ('metalness' in fur) fur.metalness = 0;
  if ('metalness' in tailFur) tailFur.metalness = 0;
  const faceFur = fur.clone();
  faceFur.color.set(0x281910);
  const squirrelGeo = squirrelMeshes();
  const squirrels = Array.from({ length: 4 }, () => {
    const root = new THREE.Group();
    const body = new THREE.Mesh(squirrelGeo.body, fur);
    const tail = new THREE.Mesh(squirrelGeo.tail, tailFur);
    tail.position.set(0, 0.17, -0.14);
    root.add(body, tail, new THREE.Mesh(squirrelGeo.face, faceFur));
    woodland.add(root);
    return { root, tail };
  });
  const fishSchool = new THREE.Group();
  fishSchool.name = 'mirror-lake-school';
  group.add(fishSchool);
  const school = Array.from({ length: 7 }, () => {
    const fish = new THREE.Mesh(fishGeo, fishMaterial);
    fish.scale.setScalar(0.67);
    fishSchool.add(fish);
    return fish;
  });
  woodland.visible = false;
  fishSchool.visible = false;

  const warm = (root: THREE.Object3D) => {
    if (gate) {
      void gate(root).then(
        () => compiledRoots.add(root),
        () => undefined,
      );
    } else compiledRoots.add(root);
  };

  const deer: Array<
    ReturnType<typeof createRig> & {
      walk: THREE.AnimationAction;
      graze: THREE.AnimationAction;
    }
  > = [];
  const dolphins: Array<
    ReturnType<typeof createRig> & {
      route: (typeof STARTER_DOLPHIN_ROUTES)[number];
      time: number;
      duration: number;
      height: number;
      rest: number;
      cycles: number;
    }
  > = [];

  function begin() {
    started = true;
    warm(woodland);
    // The school uses the original fish program and geometry.
    void loadGltf(DOE_ASSET)
      .then(({ scene, animations }) => {
        const walk = THREE.AnimationClip.findByName(animations, 'Walk');
        const graze = THREE.AnimationClip.findByName(animations, 'Eating');
        if (!walk || !graze) return;
        for (let i = 0; i < STARTER_WOODLAND.length; i++) {
          const rig = createRig(scene, 1.52 + i * 0.12, 'height');
          rig.root.name = 'eastbrook-doe';
          const step = rig.mixer.clipAction(walk).play();
          const feed = rig.mixer.clipAction(graze).play();
          step.time = i * 0.24;
          feed.time = i * 0.53;
          group.add(rig.root);
          deer.push({ ...rig, walk: step, graze: feed });
          warm(rig.root);
        }
      })
      .catch(() => undefined);
    const wetRoutes = STARTER_DOLPHIN_ROUTES.filter((route) =>
      starterDolphinRouteIsWet(route, seed),
    );
    if (!wetRoutes.length) return;
    void loadGltf(DOLPHIN_ASSET)
      .then(({ scene, animations }) => {
        const swim = THREE.AnimationClip.findByName(animations, 'Swim');
        if (!swim) return;
        for (const [i, route] of wetRoutes.entries()) {
          const rig = createRig(scene, 2.55 + i * 0.16, 'length');
          rig.root.name = 'eastbrook-dolphin';
          rig.mixer
            .clipAction(swim)
            .setEffectiveTimeScale(1.18 + i * 0.21)
            .play().time = i * 0.26;
          rig.root.rotation.order = 'YXZ';
          group.add(rig.root);
          dolphins.push({
            ...rig,
            route,
            time: -route.wait,
            duration: 0.94 + i * 0.13,
            height: 2.0 + i * 0.21,
            rest: 8.4 + i * 3.1,
            cycles: 0,
          });
          warm(rig.root);
        }
      })
      .catch(() => undefined);
  }

  function positionLand(root: THREE.Object3D, x: number, z: number, yaw: number, hop: number) {
    const ground = terrainHeight(x, z, seed);
    root.visible = ground > waterLevelAt(x, z, seed) + 0.2;
    root.position.set(x, ground + hop, z);
    root.rotation.y = yaw;
  }

  return {
    group,
    setCompileGate(compile: Compile | null) {
      gate = compile;
    },
    update(px: number, pz: number, dt: number, openAir: boolean) {
      group.visible = openAir && zoneAt(px, pz).id === 'eastbrook_vale';
      if (!group.visible) return;
      if (!started) begin();
      clock += dt;
      woodland.visible = compiledRoots.has(woodland);
      for (const [i, { root, tail }] of squirrels.entries()) {
        const home = STARTER_WOODLAND[i % STARTER_WOODLAND.length];
        if (!woodland.visible || !nearby(px, pz, home.x, home.z, 58)) {
          root.visible = false;
          continue;
        }
        const time = clock * (0.85 + i * 0.11) + i * 2.7;
        const turn = time * 0.42 - Math.sin(time * 0.8) * 0.5;
        const radius = 2.2 + i * 0.37;
        const hop = Math.max(0, Math.sin(time * 9)) * 0.115 * (0.55 - 0.45 * Math.cos(time * 0.8));
        positionLand(
          root,
          home.x + Math.cos(turn) * radius,
          home.z + Math.sin(turn) * radius,
          -turn,
          hop,
        );
        tail.rotation.x = Math.sin(time * 5.3) * 0.25;
      }

      for (const [i, { root, mixer, walk, graze }] of deer.entries()) {
        const home = STARTER_WOODLAND[i];
        if (!compiledRoots.has(root) || !nearby(px, pz, home.x, home.z, 108)) {
          root.visible = false;
          continue;
        }
        const t = clock * (0.45 + i * 0.07) + i * 2.15;
        const turn = (t - Math.sin(t)) * 0.4;
        const stride = (1 - Math.cos(t)) * 0.5;
        positionLand(
          root,
          home.x + Math.cos(turn) * home.radius,
          home.z + Math.sin(turn) * home.radius,
          -turn,
          0,
        );
        if (root.visible) {
          walk.setEffectiveWeight(stride).setEffectiveTimeScale(0.25 + 0.9 * stride);
          graze.setEffectiveWeight(1 - stride);
          mixer.update(dt);
        }
      }

      fishSchool.visible = nearby(px, pz, MIRROR_SCHOOL.x, MIRROR_SCHOOL.z, 85);
      if (fishSchool.visible) {
        for (const [i, fish] of school.entries()) {
          const turn = clock * 0.26 - i * 0.11;
          const radius = MIRROR_SCHOOL.radius + Math.sin(i * 2.4) * 1.35;
          const x = MIRROR_SCHOOL.x + Math.cos(turn) * radius;
          const z = MIRROR_SCHOOL.z + Math.sin(turn) * radius;
          const surface = waterLevelAt(x, z, seed);
          fish.visible = surface - terrainHeight(x, z, seed) > 1.0;
          if (fish.visible) {
            const glint = Math.max(0, Math.sin(clock * 0.72 + i * 0.44)) ** 14;
            fish.position.set(x, surface - 0.39 + glint * 0.62, z);
            fish.rotation.set(-0.1 * glint, -turn, Math.sin(clock * 10 + i) * 0.16);
          }
        }
      }

      const nearCoast = nearby(px, pz, -108, -64, 85);
      for (const dolphin of dolphins) {
        const { root, mixer, route, duration, height } = dolphin;
        root.visible = false;
        if (!nearCoast || !compiledRoots.has(root)) continue;
        const previous = dolphin.time;
        dolphin.time += dt;
        // The arc is below the surface at both ends. Disturb the surface as
        // the body crosses it, rather than on its hidden timer reset.
        for (const splashAt of SPLASH_POINTS) {
          const threshold = duration * splashAt;
          if (previous < threshold && dolphin.time >= threshold) {
            const x = route.x + route.dx * splashAt;
            const z = route.z + route.dz * splashAt;
            if (!nearby(px, pz, x, z, 62)) onSplash?.(x, z, 1.05, 1.12);
          }
        }
        if (dolphin.time >= duration) {
          dolphin.cycles++;
          dolphin.time = -dolphin.rest - (1 + Math.sin(dolphin.cycles * 2.39 + route.wait)) * 2.2;
        }
        if (dolphin.time < 0) continue;
        const progress = dolphin.time / duration;
        const pose = starterDolphinPose(progress, height, Math.hypot(route.dx, route.dz));
        const x = route.x + route.dx * progress;
        const z = route.z + route.dz * progress;
        if (nearby(px, pz, x, z, 62)) continue;
        root.position.set(x, waterLevelAt(x, z, seed) + pose.rise, z);
        root.rotation.set(
          pose.pitch,
          Math.atan2(route.dx, route.dz),
          0.12 * Math.sin(progress * TAU),
        );
        mixer.update(dt);
        root.visible = true;
      }
    },
  };
}
