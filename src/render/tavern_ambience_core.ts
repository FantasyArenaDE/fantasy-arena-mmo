import { hash2 } from '../sim/rng';
import { TAVERN_SMOKE_WIND } from './mirefen_tavern_smoke_core';

interface ChimneyMouth {
  x: number;
  y: number;
  z: number;
}

/** The caps on the two Tidehold inn models, in the exporter model frame.
 * The Blender source is scripts/assets/blender_tidehold/bl_town.py (TAVERNS)
 * and bl_town_lib.py (chimney/chimney_breast). glTF negates Blender Y into Z.
 */
export function tavernChimneyMouths(asset: string): readonly ChimneyMouth[] {
  if (!asset.startsWith('/models/tidehold/')) return [];
  const name = asset.split('/').at(-1);
  if (name === 'tavern.glb') return TAVERN_MOUTHS;
  if (name === 'tavern_b.glb') return LARGE_TAVERN_MOUTHS;
  return [];
}

const TAVERN_MOUTHS = [
  { x: -10.56, y: 17.84, z: 0 },
  { x: -10.14, y: 17.84, z: 0 },
] as const;
const LARGE_TAVERN_MOUTHS = [
  { x: -13.56, y: 18.84, z: -1 },
  { x: -13.14, y: 18.84, z: -1 },
  { x: 5.8, y: 18.94, z: 2.4 },
  { x: 6.22, y: 18.94, z: 2.4 },
] as const;

export function tavernWindowEmission(night: number): number {
  const t = Math.max(0, Math.min(1, night));
  return 1.18 + 2.3 * t * t * (3 - 2 * t);
}

export function tavernChimneyPuff(
  time: number,
  slot: number,
  count: number,
  phase: number,
  out: { x: number; y: number; z: number; size: number; alpha: number },
): void {
  const life = 5.4;
  const u = (((time / life + slot / count + phase) % 1) + 1) % 1;
  const variation = hash2(slot, phase, 842);
  out.x = TAVERN_SMOKE_WIND.x * life * u + 0.75 * u * Math.sin(u * 8 + variation * 6);
  out.y = 0.12 + u * (4.5 + variation * 0.8);
  out.z = TAVERN_SMOKE_WIND.z * life * u + 0.55 * u * Math.cos(u * 7 + variation * 6);
  out.size = 0.42 + u * (2.5 + variation * 0.65);
  out.alpha = Math.min(1, u * 17) * (1 - u) ** 1.35 * 0.37;
}
