import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { SpatialAudioSink } from './audio_sink';
import { currentDayNightPhase } from './day_night_clock';
import { attachSceneGroupGated } from './gated_scene_attach';
import { setRenderCategory } from './renderer_diagnostics';
import {
  crossedWoodpeckerBeat,
  nearestWoodpeckerPerch,
  WOODPECKER_VIEW_RANGE,
  woodpeckerDaytime,
  woodpeckerThrust,
} from './woodpecker_core';
import type { WoodpeckerPerch } from './woodpecker_perches';

const TAP = 'foot_wood';
type WoodpeckerAudio = Pick<SpatialAudioSink, 'preload' | 'isBuffered' | 'playAt'>;

function colored(geometry: THREE.BufferGeometry, tint: number): THREE.BufferGeometry {
  const color = new THREE.Color(tint);
  const values = new Float32Array(geometry.getAttribute('position').count * 3);
  for (let i = 0; i < values.length; i += 3) color.toArray(values, i);
  geometry.setAttribute('color', new THREE.BufferAttribute(values, 3));
  return geometry;
}

function oval(x: number, y: number, z: number, sx: number, sy: number, sz: number, tint: number) {
  return colored(new THREE.SphereGeometry(1, 8, 6).scale(sx, sy, sz).translate(x, y, z), tint);
}

function beak(y: number, z: number) {
  return colored(
    new THREE.ConeGeometry(0.025, 0.112, 6).rotateX(-Math.PI / 2).translate(0, y, z),
    0x717b7c,
  );
}

function join(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const geometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return geometry;
}

function buildBody(): THREE.BufferGeometry {
  const dark = 0x202731;
  const parts = [
    oval(0, 0.01, 0.104, 0.071, 0.128, 0.076, dark),
    oval(0, 0.024, 0.049, 0.063, 0.102, 0.04, 0xe9dfc9),
    oval(0, -0.08, 0.079, 0.061, 0.048, 0.051, 0xb52c32),
    oval(0, -0.14, 0.075, 0.038, 0.104, 0.025, dark),
  ];
  for (const side of [-1, 1]) {
    parts.push(
      oval(side * 0.052, 0.018, 0.125, 0.036, 0.11, 0.046, dark),
      oval(side * 0.074, 0.061, 0.139, 0.022, 0.046, 0.031, 0xf6eedc),
      oval(side * 0.078, -0.022, 0.144, 0.017, 0.013, 0.021, 0xe4ded4),
      oval(side * 0.04, -0.059, 0.025, 0.018, 0.014, 0.036, 0x8b7862),
    );
  }
  return join(parts);
}

function buildHead(): THREE.BufferGeometry {
  const parts = [
    oval(0, 0.024, 0.01, 0.055, 0.057, 0.062, 0x242933),
    oval(0, 0.062, 0.034, 0.043, 0.022, 0.037, 0xd93437),
    beak(0.015, -0.083),
  ];
  for (const side of [-1, 1]) {
    parts.push(
      oval(side * 0.038, 0.013, 0.001, 0.025, 0.035, 0.044, 0xf8eee0),
      oval(side * 0.052, 0.032, -0.018, 0.009, 0.011, 0.012, 0x262429),
      oval(side * 0.057, 0.036, -0.02, 0.004, 0.004, 0.004, 0xd7ac71),
    );
  }
  return join(parts);
}

export interface WoodpeckerView {
  update(x: number, z: number, dt: number, outdoors: boolean): void;
  dispose(): void;
}

export function buildWoodpecker(
  scene: THREE.Scene,
  perches: readonly WoodpeckerPerch[],
  gate: ((target: THREE.Object3D) => Promise<unknown>) | undefined,
  getAudio: () => WoodpeckerAudio | null,
): WoodpeckerView | undefined {
  const first = perches[0];
  if (!first) return;
  const group = new THREE.Group();
  group.name = 'eastbrook-woodpecker';
  setRenderCategory(group, 'ambient');
  const bird = new THREE.Group();
  bird.name = 'eastbrook-woodpecker-bird';
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  material.name = 'woodpecker-feathers';
  const body = new THREE.Mesh(buildBody(), material);
  const head = new THREE.Mesh(buildHead(), material);
  head.name = 'eastbrook-woodpecker-head';
  bird.add(body, head);
  group.add(bird);

  let perch: WoodpeckerPerch | undefined;
  let age = 0;
  let ready = false;
  let disposed = false;
  let preloadAudio: WoodpeckerAudio | null = null;
  let retryAt = 0;
  function seat(on: WoodpeckerPerch): void {
    bird.position.set(on.x + Math.sin(on.yaw) * 0.018, on.y, on.z + Math.cos(on.yaw) * 0.018);
    bird.rotation.y = on.yaw;
  }
  seat(first);
  head.position.set(0, 0.115, 0.161);
  void attachSceneGroupGated(scene, group, gate, () => disposed).then(
    () => {
      ready = true;
      bird.visible = false;
    },
    () => {},
  );

  return {
    update(x, z, dt, outdoors) {
      if (!ready) return;
      const nearby = outdoors ? nearestWoodpeckerPerch(perches, x, z) : undefined;
      const next = nearby && woodpeckerDaytime(currentDayNightPhase()) ? nearby : undefined;
      if (next !== perch) {
        perch = next;
        age = 0;
        retryAt = 0;
        if (perch) seat(perch);
      }
      if (!perch) {
        bird.visible = false;
        return;
      }
      const sink = getAudio();
      if (sink !== preloadAudio) {
        preloadAudio = sink;
        retryAt = 0;
      }
      const previous = age;
      age += Math.max(0, dt);
      const beat = crossedWoodpeckerBeat(previous, age);
      const checkSample = beat !== undefined || age >= retryAt;
      const buffered = checkSample && sink?.isBuffered?.(TAP);
      if (checkSample && age >= retryAt) {
        if (!buffered) sink?.preload?.(TAP);
        retryAt = age + 1.2;
      }
      if (beat !== undefined && buffered) {
        sink?.playAt?.(TAP, perch.x, perch.y + 0.15, perch.z, {
          ambient: true,
          gain: 0.68 - (beat % 3) * 0.07,
          rate: 1.66 + (beat % 3) * 0.13,
          release: 0.088,
          cooldown: 0.045,
          cooldownKey: 'eastbrook-woodpecker',
        });
      }
      bird.visible =
        !perch.tree.hidden && (perch.x - x) ** 2 + (perch.z - z) ** 2 < WOODPECKER_VIEW_RANGE ** 2;
      if (!bird.visible) return;
      const thrust = woodpeckerThrust(age);
      head.position.z = 0.161 - thrust * 0.039;
      head.position.y = 0.115 + Math.sin(age * 2.3) * 0.009 * (1 - thrust);
      head.rotation.y = Math.sin(age * 1.2) * 0.23 * (1 - thrust);
    },
    dispose() {
      disposed = true;
      group.removeFromParent();
      body.geometry.dispose();
      head.geometry.dispose();
      material.dispose();
    },
  };
}
