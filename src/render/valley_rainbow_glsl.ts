import { RAINBOW_INNER_DEG, RAINBOW_OUTER_DEG } from './valley_shower_core';

const inner = Math.cos((RAINBOW_INNER_DEG * Math.PI) / 180).toFixed(8);
const outer = Math.cos((RAINBOW_OUTER_DEG * Math.PI) / 180).toFixed(8);

export const VALLEY_RAINBOW_GLSL = /* glsl */ `
uniform vec2 uValleyWeather;

vec3 valleyWeatherSky(vec3 sky, vec3 dir, vec3 sun) {
  // Reuse the dome's light: passing showers lift a grey veil, then the
  // droplets briefly separate the direct sunlight on the opposite side.
  if (max(uValleyWeather.x, uValleyWeather.y) <= 0.001) return sky;
  float veil = uValleyWeather.x * 0.66 * smoothstep(0.05, 0.26, dir.y);
  float luminance = dot(sky, vec3(0.2126, 0.7152, 0.0722));
  vec3 color = mix(sky, luminance * vec3(0.65, 0.73, 0.83), veil);
  if (uValleyWeather.y <= 0.001 || sun.y <= 0.015 || sun.y >= 0.65 || dir.y <= 0.01) return color;

  float radial = -dot(dir, sun);
  if (radial < ${outer} || radial > ${inner}) return color;
  float t = (${inner} - radial) / (${inner} - ${outer});
  vec3 spectral = vec3(
    0.45 * (1.0 - smoothstep(0.05, 0.28, t)) + smoothstep(0.55, 0.90, t),
    smoothstep(0.18, 0.47, t) * (1.0 - smoothstep(0.71, 0.96, t)),
    1.0 - smoothstep(0.21, 0.62, t)
  );
  float ribbon = smoothstep(0.0, 0.14, t) * (1.0 - smoothstep(0.83, 1.0, t));
  float horizon = smoothstep(0.01, 0.12, dir.y);
  float light = uValleyWeather.y * ribbon * horizon;
  vec3 pale = mix(vec3(0.58), spectral, 0.68);
  return mix(color, color * 0.82 + pale * 0.58, light * 0.30);
}
`;
