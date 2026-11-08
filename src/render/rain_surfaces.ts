import * as THREE from 'three';
import { hash2 } from '../sim/rng';
import { terrainHeight, waterLevelAt } from '../sim/world';
import { registerGroundDecorPrewarmDraw } from './ground_decor_prewarm';
import { rainRingPhase, rainSurfacePlan, rainSurfaceWetness } from './rain_surfaces_core';

function surfaceTexture(puddle: boolean) {
  const size = 64;
  const rgba = new Uint8Array(size * size * 4);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const x = (col / (size - 1)) * 2 - 1;
      const y = (row / (size - 1)) * 2 - 1;
      const angle = Math.atan2(y, x);
      const edge = puddle ? 0.82 + 0.07 * Math.sin(angle * 3) + 0.04 * Math.cos(angle * 7) : 0.79;
      const radius = Math.hypot(x, y);
      const alpha = puddle
        ? 1 - THREE.MathUtils.smoothstep(radius, edge - 0.13, edge)
        : Math.exp(-((radius - edge) ** 2) / 0.0025) * (0.63 + 0.37 * Math.sin(angle + 0.4));
      const highlight = puddle ? 0.5 + 0.48 * Math.exp(-((y + x * 0.23 + 0.2) ** 2) / 0.06) : 1;
      const offset = (row * size + col) * 4;
      rgba[offset] = (puddle ? 104 : 205) * highlight;
      rgba[offset + 1] = (puddle ? 135 : 231) * highlight;
      rgba[offset + 2] = (puddle ? 147 : 244) * highlight;
      rgba[offset + 3] = 255 * alpha;
    }
  }
  const texture = new THREE.DataTexture(rgba, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function makeSurfaceBatch(name: string, capacity: number, puddle: boolean) {
  const geometry = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const alpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(
    THREE.DynamicDrawUsage,
  );
  geometry.setAttribute('aRainAlpha', alpha);
  const material = new THREE.MeshBasicMaterial({
    map: surfaceTexture(puddle),
    transparent: true,
    depthWrite: false,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'attribute float aRainAlpha; varying float vRainAlpha;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvRainAlpha = aRainAlpha;',
      );
    shader.fragmentShader =
      'varying float vRainAlpha;\n' +
      shader.fragmentShader.replace(
        '#include <alphamap_fragment>',
        '#include <alphamap_fragment>\ndiffuseColor.a *= vRainAlpha;',
      );
  };
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.name = name;
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.renderOrder = puddle ? 1 : 2;
  registerGroundDecorPrewarmDraw({ geometry, material, instanceColor: false });
  return { mesh, alpha, material };
}

/** Two short-range batches driven by the live precipitation intensity. */
export function buildRainSurfaces(scene: THREE.Scene, seed: number, lowGfx: boolean) {
  const limit = lowGfx ? 32 : 54;
  const rings = makeSurfaceBatch('weather-rain-rings', limit * 2, false);
  const puddles = makeSurfaceBatch('weather-rain-puddles', Math.ceil(limit / 3), true);
  const group = new THREE.Group();
  group.name = 'weather-rain-surfaces';
  group.userData.renderCategory = 'weather';
  group.visible = false;
  group.add(puddles.mesh, rings.mesh);
  scene.add(group);

  const pose = new THREE.Object3D();
  let plan: ReturnType<typeof rainSurfacePlan> = { water: [], puddles: [] };
  let cellX = Infinity;
  let cellZ = Infinity;
  let wetness = 0;
  let clock = 0;
  let wasRaining = false;
  const sample = (x: number, z: number) => ({
    ground: terrainHeight(x, z, seed),
    water: waterLevelAt(x, z, seed),
  });
  const batches = [puddles, rings];
  const ringAt = (px: number, py: number, pz: number, puddle: boolean, strength: number) => {
    const phase = hash2(px, pz, seed) * 4;
    const age = rainRingPhase(clock, phase, 1.3 + phase * 0.36);
    if (age >= 1) return;
    const radius = (0.075 + 0.52 * age) * (puddle ? 0.55 : 1);
    pose.position.set(px, py, pz);
    pose.scale.set(radius, 1, radius);
    pose.updateMatrix();
    const index = rings.mesh.count++;
    rings.mesh.setMatrixAt(index, pose.matrix);
    rings.alpha.setX(index, strength * Math.min(1, age * 9) * (1 - age) * 0.82);
  };

  return {
    setDayNight(mul: readonly [number, number, number]): void {
      rings.material.color.setRGB(...mul);
      puddles.material.color.setRGB(...mul);
    },
    update(
      x: number,
      z: number,
      dt: number,
      strength: number,
      enabled: boolean,
      isRainingAt: (x: number, z: number) => boolean,
    ): void {
      wetness = rainSurfaceWetness(wetness, strength, dt);
      group.visible = false;
      const raining = strength > 0.04;
      if (!enabled || wetness <= 0.005) {
        wasRaining = false;
        return;
      }
      clock += dt;
      if (raining && (!wasRaining || (x - cellX) ** 2 + (z - cellZ) ** 2 > 5 ** 2)) {
        plan = rainSurfacePlan(seed, x, z, isRainingAt, sample, limit);
        cellX = x;
        cellZ = z;
      }
      wasRaining = raining;
      if ((x - cellX) ** 2 + (z - cellZ) ** 2 > 30 ** 2) return;

      puddles.mesh.count = plan.puddles.length;
      rings.mesh.count = 0;
      pose.rotation.y = 0;
      if (raining) for (const hit of plan.water) ringAt(hit.x, hit.y, hit.z, false, strength);
      for (const [i, puddle] of plan.puddles.entries()) {
        pose.position.set(puddle.x, puddle.y, puddle.z);
        pose.rotation.y = puddle.angle;
        pose.scale.set(
          puddle.width * (0.7 + wetness * 0.3),
          1,
          puddle.length * (0.7 + wetness * 0.3),
        );
        pose.updateMatrix();
        puddles.mesh.setMatrixAt(i, pose.matrix);
        puddles.alpha.setX(i, wetness * 0.7);
        pose.rotation.y = 0;
        if (raining) ringAt(puddle.x + 0.13, puddle.y + 0.014, puddle.z - 0.08, true, strength);
      }
      for (const batch of batches) {
        batch.mesh.instanceMatrix.needsUpdate = batch.alpha.needsUpdate = batch.mesh.count > 0;
      }
      group.visible = puddles.mesh.count + rings.mesh.count > 0;
    },
  };
}
