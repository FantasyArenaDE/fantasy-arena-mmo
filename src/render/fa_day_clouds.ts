// One drifting cloud field for the sky dome and the local sunlight cue.
export const FA_DAY_SKY = import.meta.env.VITE_FA_BROWSER_RELEASE === '1';

const CELL_SCALE = 0.004;
const CLOUD_HEIGHT = 390;
const WIND_X = 0.032;
const WIND_Z = 0.012;
const CLOUD_EDGE = 0.5;
const CLOUD_BODY = 0.66;
const LAYERS = [
  [1, 0.54, 0, 0],
  [2.13, 0.27, 17, 9],
  [4.47, 0.13, 31, 23],
  [9.21, 0.06, 11, 37],
] as const;

const fract = (n: number) => n - Math.floor(n);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);
const smooth = (a: number, b: number, x: number) =>
  ease(Math.max(0, Math.min(1, (x - a) / (b - a))));

function hash(x: number, z: number): number {
  const a = fract(x * 0.1031);
  const b = fract(z * 0.103);
  const c = fract(x * 0.0973);
  const dot = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
  return fract((a + b + 2 * dot) * (c + dot));
}

function noise(x: number, z: number): number {
  const i = Math.floor(x);
  const j = Math.floor(z);
  const u = ease(fract(x));
  const v = ease(fract(z));
  return mix(mix(hash(i, j), hash(i + 1, j), u), mix(hash(i, j + 1), hash(i + 1, j + 1), u), v);
}

export function dayCloudBiomeWeight(biome: string): number {
  return biome === 'vale' || biome === 'fen' || biome === 'beach' || biome === 'farshore' ? 1 : 0;
}

export function dayCloudSunlight(
  biome: { from: string; to: string; t: number },
  position: { x: number; z: number },
  sun: { x: number; y: number; z: number },
  time: number,
  strength = 0.22,
): number {
  if (!FA_DAY_SKY || sun.y <= 0.045) return 1;
  const skyWeight = mix(dayCloudBiomeWeight(biome.from), dayCloudBiomeWeight(biome.to), biome.t);
  if (skyWeight === 0) return 1;
  const distance = CLOUD_HEIGHT / Math.max(0.13, sun.y);
  const x = (position.x + distance * sun.x) * CELL_SCALE - time * WIND_X;
  const z = (position.z + distance * sun.z) * CELL_SCALE - time * WIND_Z;
  let density = 0;
  for (const [scale, weight, dx, dz] of LAYERS)
    density += weight * noise(x * scale + dx, z * scale + dz);
  const cover = smooth(CLOUD_EDGE, CLOUD_BODY, density) * smooth(0.1, 0.27, sun.y);
  return 1 - strength * cover * smooth(0.045, 0.23, sun.y) * skyWeight;
}

export const FA_DAY_CLOUD_GLSL = /* glsl */ `
uniform vec2 uFaCloudCam;
uniform vec2 uFaCloudBiome;

float faCloudHash(vec2 p) {
  vec3 q = fract(p.xyx * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float faCloudNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(faCloudHash(i), faCloudHash(i + vec2(1.0, 0.0)), f.x),
    mix(faCloudHash(i + vec2(0.0, 1.0)), faCloudHash(i + 1.0), f.x), f.y);
}

float faCloudDensity(vec2 p) {
  return ${LAYERS.map(
    ([scale, weight, x, z]) =>
      `${weight.toFixed(2)} * faCloudNoise(p * ${scale.toFixed(2)} + vec2(${x}.0, ${z}.0))`,
  ).join(' + ')};
}

vec3 faDaySky(vec3 base, vec3 dir, vec3 sun, float time, float biome) {
  float day = smoothstep(0.045, 0.23, sun.y) * biome;
  if (day < 0.001 || dir.y < 0.10) return base;
  float elevation = smoothstep(0.10, 0.72, dir.y);
  vec3 sky = mix(vec3(0.16, 0.36, 0.64), vec3(0.025, 0.12, 0.38), elevation);
  float glow = pow(max(0.0, dot(dir, sun)), 24.0);
  sky += vec3(0.21, 0.14, 0.07) * glow;

  vec2 p = (uFaCloudCam + dir.xz * (${CLOUD_HEIGHT}.0 / max(0.13, dir.y)))
    * ${CELL_SCALE} - time * vec2(${WIND_X}, ${WIND_Z});
  float density = faCloudDensity(p);
  float cover = smoothstep(${CLOUD_EDGE.toFixed(2)}, ${CLOUD_BODY}, density) * smoothstep(0.10, 0.27, dir.y);
  float wisps = smoothstep(0.59, 0.82, faCloudNoise(p * vec2(0.75, 1.8) + vec2(8.0, 32.0)))
    * smoothstep(0.2, 0.55, dir.y);
  sky = mix(sky, vec3(0.62, 0.74, 0.89), wisps * 0.33);
  if (cover > 0.001) {
    float towardSun = faCloudDensity(p + sun.xz * 0.35);
    float light = clamp(0.58 + (density - towardSun) * 3.4 - (density - 0.6) * 1.15, 0.0, 1.0);
    vec3 cloud = mix(vec3(0.25, 0.34, 0.49), vec3(1.04, 0.97, 0.86), light);
    cloud += vec3(0.34, 0.24, 0.12) * glow * (1.0 - cover);
    sky = mix(sky, cloud, cover);
  }
  return mix(base, sky, day);
}
`;
