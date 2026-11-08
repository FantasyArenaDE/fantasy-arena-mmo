import { zoneAt } from '../sim/data';
import { hash2 } from '../sim/rng';
import { roadDistance, terrainHeight, waterLevelAt } from '../sim/world';
import { flowerMeadowsForBiome } from './flower_meadows_core';

const SHORE_VERGES = [
  { x: -284, z: -15, r: 4 },
  { x: -290, z: -24, r: 5 },
  { x: -295, z: 34, r: 5 },
];

export function starterButterflyHabitat(seed: number) {
  const zones = [
    { id: 'proving_shore', meadows: SHORE_VERGES },
    { id: 'eastbrook_vale', meadows: flowerMeadowsForBiome('vale') ?? [] },
  ];
  return zones.flatMap(({ id, meadows }) =>
    meadows.flatMap(({ x, z, r }, meadow) => {
      const anchors: { x: number; z: number; phase: number; rate: number }[] = [];
      for (let attempt = 0; attempt < 12 && anchors.length < 2; attempt++) {
        const phase = hash2(meadow, attempt, seed ^ 0x2417) * Math.PI * 2;
        const radius = r * (0.2 + hash2(attempt, meadow, seed ^ 0x4527) * 0.48);
        const px = x + Math.cos(phase) * radius;
        const pz = z + Math.sin(phase) * radius;
        if (zoneAt(px, pz).id !== id || roadDistance(px, pz) < 2.5) continue;
        if (terrainHeight(px, pz, seed) < waterLevelAt(px, pz, seed) + 0.4) continue;
        if (anchors.some((a) => (a.x - px) ** 2 + (a.z - pz) ** 2 < 1.6 ** 2)) continue;
        anchors.push({ x: px, z: pz, phase, rate: 0.68 + hash2(meadow, attempt, seed) * 0.51 });
      }
      return anchors;
    }),
  );
}

export type ButterflyAnchor = ReturnType<typeof starterButterflyHabitat>[number];

export function butterflyFlight(
  anchor: ButterflyAnchor,
  time: number,
  pose: { x: number; z: number; lift: number; yaw: number; flap: number },
): void {
  const t = time * anchor.rate + anchor.phase;
  const wave = t + 0.36 * Math.sin(t * 1.7);
  const stride = 1 + 0.18 * Math.sin(t * 0.53);
  const waveSpeed = 1 + 0.612 * Math.cos(t * 1.7);
  const strideSpeed = 0.0954 * Math.cos(t * 0.53);
  pose.x = anchor.x + stride * Math.sin(wave);
  pose.z = anchor.z + 0.69 * Math.sin(wave * 1.34 + anchor.phase);
  pose.lift = 0.39 + 0.67 * (0.5 + 0.5 * Math.sin(t * 1.25)) ** 2 + 0.1 * Math.sin(t * 5);
  pose.yaw = Math.atan2(
    strideSpeed * Math.sin(wave) + stride * waveSpeed * Math.cos(wave),
    0.69 * 1.34 * waveSpeed * Math.cos(wave * 1.34 + anchor.phase),
  );
  pose.flap = 0.45 + 0.86 * Math.sin(time * (38 + anchor.rate * 14) + anchor.phase);
}

export function butterflyDaylight(sunY: number): number {
  const t = Math.max(0, Math.min(1, (sunY - 0.1) / 0.22));
  return t * t * (3 - 2 * t);
}
