import * as THREE from 'three';
import { LAKE } from '../sim/content/zone1';
import { terrainHeight, waterLevel } from '../sim/world';
import { foliageShoreSkip } from './foliage_shore_gate_core';
import { createShoreTrackAtlas } from './shore_track_atlas';
import {
  advanceTrackStride,
  dampTrackHeight,
  type ShoreTrackKind,
  shoreTrackAlpha,
  shoreTrackKind,
  TRACK_SPECS,
  type TrackStep,
  type TrackStride,
} from './shore_tracks_core';

const CAPACITY = 84;
const TRACKED_BODIES = 32;
const VIEW_RADIUS = LAKE.radius + 30;
const GROUND_RADIUS = LAKE.radius + 11;
const VERTICES = 6;
const TRIANGLES = [0, 2, 1, 2, 3, 1];

function nearLake(x: number, z: number, radius: number): boolean {
  return (x - LAKE.x) ** 2 + (z - LAKE.z) ** 2 < radius ** 2;
}

/** A bounded, client-only decal pool. Positions change only when a body leaves a print. */
export function buildShoreTracks(seed: number, terrain: THREE.Group) {
  const texture = createShoreTrackAtlas();
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -2,
  });
  const geometry = new THREE.BufferGeometry();
  const positions = new THREE.BufferAttribute(
    new Float32Array(CAPACITY * VERTICES * 3),
    3,
  ).setUsage(THREE.DynamicDrawUsage);
  const uv = new THREE.BufferAttribute(new Float32Array(CAPACITY * VERTICES * 2), 2).setUsage(
    THREE.DynamicDrawUsage,
  );
  const colors = new THREE.BufferAttribute(
    new Float32Array(CAPACITY * VERTICES * 4).fill(1),
    4,
  ).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positions).setAttribute('uv', uv).setAttribute('color', colors);
  geometry.setDrawRange(0, 0);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'mirror-lake-shore-tracks';
  mesh.visible = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  const twinGeometry = new THREE.PlaneGeometry(0.12, 0.12);
  twinGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(16).fill(1), 4));

  const strideById = new Map<number, TrackStride>();
  const marks = Array.from({ length: CAPACITY }, () => ({ time: -Infinity }));
  const step: TrackStep = { x: 0, z: 0, dx: 0, dz: 0 };
  const corners = Array.from({ length: 4 }, () => new THREE.Vector3());
  const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 5);
  const patches: THREE.Mesh[] = [];
  const hits: THREE.Intersection[] = [];
  let projectBudget = 0;
  let next = 0;
  let clock = 0;
  let enabled = false;
  let lastSweep = -Infinity;

  function refreshPatches(): void {
    patches.length = 0;
    for (const chunk of terrain.children) {
      if (!(chunk instanceof THREE.Mesh)) continue;
      const box = chunk.geometry.boundingBox;
      if (
        box &&
        box.min.x < LAKE.x + GROUND_RADIUS &&
        box.max.x > LAKE.x - GROUND_RADIUS &&
        box.min.z < LAKE.z + GROUND_RADIUS &&
        box.max.z > LAKE.z - GROUND_RADIUS
      )
        patches.push(chunk);
    }
  }

  function stamp(kind: ShoreTrackKind, y: number): void {
    const { x, z, dx, dz } = step;
    const ground = terrainHeight(x, z, seed);
    const water = waterLevel();
    if (
      Math.abs(y - ground) > 0.32 ||
      !dampTrackHeight(ground, water) ||
      !foliageShoreSkip(x, z, ground, seed)
    )
      return;

    if (projectBudget <= 0) return;
    projectBudget--;
    ray.ray.origin.set(x, ground + 2, z);
    hits.length = 0;
    for (const chunk of patches) {
      const box = chunk.geometry.boundingBox;
      if (
        !chunk.visible ||
        !box ||
        x < box.min.x ||
        x > box.max.x ||
        z < box.min.z ||
        z > box.max.z
      )
        continue;
      ray.intersectObject(chunk, false, hits);
    }
    const hit = hits[0];
    const normal = hit?.face?.normal;
    if (!hit || !normal || normal.y < 0.68 || hit.point.y <= water + 0.045) return;

    const { width, length, tile } = TRACK_SPECS[kind];
    for (let i = 0; i < 4; i++) {
      const lateral = ((i % 2) - 0.5) * width;
      const forward = ((i >> 1) - 0.5) * length;
      const px = x + dx * forward + dz * lateral;
      const pz = z + dz * forward - dx * lateral;
      const h = terrainHeight(px, pz, seed);
      if (!dampTrackHeight(h, water) || Math.abs(h - ground) > 0.31) return;
      const drawY = hit.point.y - (normal.x * (px - x) + normal.z * (pz - z)) / normal.y;
      if (drawY <= water + 0.035) return;
      corners[i].set(px, drawY + 0.027, pz);
    }
    for (let i = 0; i < VERTICES; i++) {
      const corner = TRIANGLES[i];
      const v = corners[corner];
      const at = next * VERTICES + i;
      positions.setXYZ(at, v.x, v.y, v.z);
      const u = corner % 2 ? 0.985 : 0.015;
      uv.setXY(at, (tile + u) / 3, corner >> 1);
    }
    marks[next].time = clock;
    next = (next + 1) % CAPACITY;
    positions.needsUpdate = true;
    uv.needsUpdate = true;
  }

  return {
    mesh,
    prewarm(parent: THREE.Group) {
      const twin = new THREE.Mesh(twinGeometry, material);
      twin.frustumCulled = false;
      parent.add(twin);
    },
    dispose() {
      mesh.removeFromParent();
      geometry.dispose();
      twinGeometry.dispose();
      material.dispose();
      texture.dispose();
    },
    begin(time: number, camX: number, camZ: number, outdoor: boolean) {
      clock = time;
      projectBudget = 5;
      enabled = outdoor && nearLake(camX, camZ, VIEW_RADIUS);
      if (!enabled) {
        strideById.clear();
        mesh.visible = false;
      } else if (time - lastSweep >= 0.5) {
        lastSweep = time;
        refreshPatches();
        for (const [id, stride] of strideById) if (time - stride.time > 0.4) strideById.delete(id);
      }
    },
    sample(
      id: number,
      type: string,
      template: string,
      x: number,
      y: number,
      z: number,
      walking: boolean,
    ) {
      if (!enabled) return;
      const kind = shoreTrackKind(type, template);
      if (!kind || !walking || !nearLake(x, z, GROUND_RADIUS)) {
        strideById.delete(id);
        return;
      }
      const stride = strideById.get(id);
      if (stride) {
        if (advanceTrackStride(stride, x, z, clock, kind, step)) stamp(kind, y);
      } else if (strideById.size < TRACKED_BODIES) {
        strideById.set(id, {
          x,
          z,
          time: clock,
          carry: TRACK_SPECS[kind].stride * 0.6,
          side: id % 2 ? 1 : -1,
        });
      }
    },
    finish() {
      if (!enabled) return;
      let count = 0;
      for (let slot = 0; slot < CAPACITY; slot++) {
        const alpha = shoreTrackAlpha(clock - marks[slot].time);
        if (alpha > 0) count = (slot + 1) * VERTICES;
        for (let v = 0; v < VERTICES; v++) colors.setW(slot * VERTICES + v, alpha);
      }
      mesh.visible = count > 0;
      if (mesh.visible) colors.needsUpdate = true;
      geometry.setDrawRange(0, count);
    },
  };
}
