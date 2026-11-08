import * as THREE from 'three';
import { hash2 } from '../sim/rng';
import {
  coastalBreakers,
  coastalBurstAge,
  coastalDropletHeight,
  SPRAY_BURST_SECONDS,
} from './coastal_spray_core';
import { registerGroundDecorPrewarmDraw } from './ground_decor_prewarm';

function sprayTexture() {
  const size = 32;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot((2 * x) / (size - 1) - 1, (2 * y) / (size - 1) - 1);
      const at = (y * size + x) * 4;
      pixels[at] = pixels[at + 1] = pixels[at + 2] = 255;
      pixels[at + 3] = 255 * Math.max(0, 1 - r * r) ** 2;
    }
  }
  const map = new THREE.DataTexture(pixels, size, size);
  map.minFilter = map.magFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  return map;
}

export function buildCoastalSpray(seed: number, lowGfx: boolean) {
  const spots = coastalBreakers(seed);
  const drops = lowGfx ? 15 : 25;
  const capacity = spots.length * drops;
  const geometry = new THREE.PlaneGeometry(2, 2);
  const opacity = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(
    THREE.DynamicDrawUsage,
  );
  geometry.setAttribute('aSprayOpacity', opacity);
  const material = new THREE.MeshBasicMaterial({
    color: 0xe2edf2,
    map: sprayTexture(),
    depthWrite: false,
    transparent: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'attribute float aSprayOpacity; varying float vSprayOpacity;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvSprayOpacity = aSprayOpacity;',
      );
    shader.fragmentShader =
      'varying float vSprayOpacity;\n' +
      shader.fragmentShader.replace(
        '#include <alphamap_fragment>',
        '#include <alphamap_fragment>\ndiffuseColor.a *= vSprayOpacity;',
      );
  };
  const mesh = new THREE.InstancedMesh(geometry, material, capacity);
  mesh.name = 'starter-coastal-wave-spray';
  mesh.visible = false;
  mesh.count = 0;
  mesh.renderOrder = 2;
  mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  registerGroundDecorPrewarmDraw({ geometry, material, instanceColor: false });

  const actors = spots.map((spot, i) => ({
    spot,
    drops: Array.from({ length: drops }, (_, j) => ({
      delay: hash2(i, j, seed ^ 0x4d18) * 0.39,
      offset: (hash2(j, i, seed ^ 0x1427) - 0.5) * 3.4,
      fan: (hash2(i, j, seed ^ 0x8541) - 0.5) * 1.9,
      kick: 1.45 + hash2(i, j, seed ^ 0x1123) * 2.65,
      reach: 0.85 + hash2(j, i, seed ^ 0x4312) * 1.35,
      size: j % 5 === 0 ? 0.27 : 0.055 + hash2(j, i, seed ^ 0x9225) * 0.075,
    })),
  }));
  const pose = new THREE.Object3D();
  const color = new THREE.Color(0xe2edf2);
  return {
    mesh,
    update(
      time: number,
      camera: THREE.Camera,
      enabled: boolean,
      grade: readonly [number, number, number],
    ): void {
      mesh.count = 0;
      mesh.visible = false;
      if (!enabled) return;
      material.color.setRGB(color.r * grade[0], color.g * grade[1], color.b * grade[2]);
      pose.quaternion.copy(camera.quaternion);
      for (const { spot, drops: particles } of actors) {
        if ((spot.x - camera.position.x) ** 2 + (spot.z - camera.position.z) ** 2 > 62 ** 2)
          continue;
        const burst = coastalBurstAge(spot, time);
        if (burst > SPRAY_BURST_SECONDS) continue;
        for (const drop of particles) {
          const age = burst - drop.delay;
          if (age <= 0 || age > 0.67) continue;
          const height = coastalDropletHeight(age, drop.kick * spot.energy);
          if (height <= 0.01) continue;
          const along = age * drop.reach;
          const side = drop.offset + age * drop.fan;
          pose.position.set(
            spot.x + spot.nx * along - spot.nz * side,
            spot.y + height,
            spot.z + spot.nz * along + spot.nx * side,
          );
          const size = drop.size * (0.8 + age * 1.5);
          pose.scale.set(size, size * 0.8, 1);
          pose.updateMatrix();
          const i = mesh.count++;
          mesh.setMatrixAt(i, pose.matrix);
          opacity.setX(
            i,
            Math.min(1, age * 20) * (1 - age / 0.67) * (drop.size > 0.2 ? 0.45 : 0.8),
          );
        }
      }
      mesh.visible = mesh.count > 0;
      mesh.instanceMatrix.needsUpdate = opacity.needsUpdate = mesh.visible;
    },
  };
}
