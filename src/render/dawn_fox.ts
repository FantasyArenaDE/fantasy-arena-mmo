import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { generateDecorationsInBounds, terrainHeight, waterLevelAt } from '../sim/world';
import { loadGltf } from './assets/loader';
import { VISUALS } from './characters/manifest';
import {
  advanceFoxEncounter,
  dawnFoxPose,
  FOX_EXIT,
  FOX_GLADE,
  FOX_SCENE_SECONDS,
  FOX_START,
  type FoxEncounter,
  type FoxPose,
  isFoxDawn,
} from './dawn_fox_core';
import { attachSceneGroupGated } from './gated_scene_attach';

const DISPLAY_HEIGHT = 0.86;
const FOX_URL = VISUALS.mob_fox.url;

function distanceSq(x: number, z: number, point: { x: number; z: number }): number {
  return (x - point.x) ** 2 + (z - point.z) ** 2;
}

function makeFox(scene: THREE.Group, clips: readonly THREE.AnimationClip[]) {
  const walk = clips.find((clip) => clip.name === 'Walk');
  const listen = clips.find((clip) => clip.name === 'Idle_2');
  const run = clips.find((clip) => clip.name === 'Gallop');
  if (!walk || !listen || !run) return null;
  const model = clone(scene);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model, true);
  const height = bounds.max.y - bounds.min.y;
  if (!Number.isFinite(height) || height <= 0.01) return null;
  const root = new THREE.Group();
  const fit = new THREE.Group();
  const scale = DISPLAY_HEIGHT / height;
  fit.scale.setScalar(scale);
  bounds.getCenter(fit.position).multiplyScalar(-scale);
  fit.position.y = -bounds.min.y * scale;
  fit.add(model);
  root.add(fit);

  const mixer = new THREE.AnimationMixer(model);
  const actions = {
    walk: mixer.clipAction(walk).setEffectiveTimeScale(0.92),
    listen: mixer.clipAction(listen).setEffectiveTimeScale(0.85),
    run: mixer.clipAction(run).setEffectiveTimeScale(1.12),
  };
  let active: THREE.AnimationAction | null = null;
  const bones = ['Head', 'Ear1.L', 'Ear1.R'].flatMap((name) => {
    const bone = model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
    return bone ? [{ name, bone, animated: bone.quaternion.clone() }] : [];
  });
  return {
    root,
    pose(pose: FoxPose, dt: number) {
      const next = actions[pose.gait];
      if (next !== active) {
        next.reset().setEffectiveWeight(1).play();
        if (active) active.crossFadeTo(next, 0.22, false);
        active = next;
      }
      for (const { bone, animated } of bones) bone.quaternion.copy(animated);
      mixer.update(Math.max(0, Math.min(dt, 0.12)));
      for (const { name, bone, animated } of bones) {
        animated.copy(bone.quaternion);
        if (name === 'Head') bone.rotateY(pose.look);
        else bone.rotateZ(name === 'Ear1.L' ? pose.ear : -pose.ear * 0.65);
      }
    },
    dispose() {
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      model.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh) child.skeleton.dispose();
      });
      root.removeFromParent();
    },
  };
}

export function buildDawnFox(seed: number, compile: (root: THREE.Object3D) => Promise<unknown>) {
  const group = new THREE.Group();
  group.name = 'eastbrook-dawn-fox';
  group.visible = false;
  const encounter: FoxEncounter = { start: null, played: false };
  const pose: FoxPose = { x: 0, z: 0, yaw: 0, look: 0, ear: 0, gait: 'walk' };
  let rig: ReturnType<typeof makeFox> = null;
  let ready = false;
  let disposed = false;
  let loading = false;
  let attemptedThisDawn = false;
  let checkedHabitat = false;
  let hasHabitat = false;

  function validateHabitat(): boolean {
    const cover = generateDecorationsInBounds(seed, {
      minX: FOX_EXIT.x - 10,
      maxX: FOX_EXIT.x + 10,
      minZ: FOX_EXIT.z - 10,
      maxZ: FOX_EXIT.z + 10,
    });
    if (
      !cover.some((tree) => tree.kind !== 'rock' && distanceSq(tree.x, tree.z, FOX_EXIT) < 9 ** 2)
    ) {
      return false;
    }
    for (let i = 0; i <= 24; i++) {
      dawnFoxPose((i * FOX_SCENE_SECONDS) / 24, pose);
      if (terrainHeight(pose.x, pose.z, seed) <= waterLevelAt(pose.x, pose.z, seed) + 0.3) {
        return false;
      }
    }
    return true;
  }

  function prepare(): void {
    loading = true;
    attemptedThisDawn = true;
    void loadGltf(FOX_URL, { priority: 'background' })
      .then(async ({ scene, animations }) => {
        if (disposed) return;
        rig = makeFox(scene, animations);
        if (!rig) return;
        await attachSceneGroupGated(group, rig.root, compile, () => disposed);
        ready = !disposed;
      })
      .catch(() => undefined)
      .finally(() => {
        loading = false;
      });
  }

  return {
    group,
    update(clock: number, dt: number, phase: number, x: number, z: number, outdoor: boolean) {
      const distance = distanceSq(x, z, FOX_GLADE);
      if (outdoor && distance < 49 ** 2 && !checkedHabitat) {
        hasHabitat = validateHabitat();
        checkedHabitat = true;
      }
      const prepareWindow = phase >= 0.22 && phase < 0.341;
      if (!prepareWindow) attemptedThisDawn = false;
      if (
        hasHabitat &&
        outdoor &&
        prepareWindow &&
        distance < 47 ** 2 &&
        !rig &&
        !loading &&
        !attemptedThisDawn
      )
        prepare();
      const elapsed = advanceFoxEncounter(
        encounter,
        clock,
        isFoxDawn(phase),
        ready && distance < 28 ** 2 && distanceSq(x, z, FOX_START) > 7 ** 2,
        outdoor && distance < 41 ** 2,
      );
      group.visible = elapsed !== null;
      if (elapsed === null || !rig) return;
      dawnFoxPose(elapsed, pose);
      rig.root.position.set(pose.x, terrainHeight(pose.x, pose.z, seed) + 0.025, pose.z);
      rig.root.rotation.y = pose.yaw;
      rig.pose(pose, dt);
    },
    dispose() {
      disposed = true;
      rig?.dispose();
      group.removeFromParent();
    },
  };
}
