import { type Material, Vector4 } from 'three';
import { FA_BODY_TATTOOS, FA_FACE_SCARS, FA_FACE_TATTOOS, FA_FRECKLES } from '../../world_api/appearance';
import type { FaReleaseBeardStyle } from './fa_release_beard_core';
import type { ModularAppearance } from './modular';
import { hexToLinear } from './woc_head_look_core';

export interface FaReleaseMarkings {
  faceTattoo: ModularAppearance['faceTattoo'];
  bodyTattoo: ModularAppearance['bodyTattoo'];
  faceScar: ModularAppearance['faceScar'];
  freckles: ModularAppearance['freckles'];
  beard: FaReleaseBeardStyle;
  beardColor: number;
  lipstick: number | null;
  blush: number | null;
  eyeshadow: number | null;
}

interface SkinMarkUniforms {
  readonly fit: 'male' | 'female';
  readonly ink: { value: Vector4 };
  readonly details: { value: Vector4 };
  readonly lipstick: { value: Vector4 };
  readonly blush: { value: Vector4 };
  readonly eyeshadow: { value: Vector4 };
  readonly beard: { value: Vector4 };
}

const uniforms = new WeakMap<Material, SkinMarkUniforms>();
const VARYING = 'varying vec3 vFaInkBind;';
const DECL = `${VARYING}
uniform vec4 uFaInk;
uniform vec4 uFaDetails;
uniform vec4 uFaLip;
uniform vec4 uFaBlush;
uniform vec4 uFaShadow;
uniform vec4 uFaBeard;
float faSoftOval(vec2 p, vec2 radius, float falloff) {
  return 1.0 - smoothstep(falloff, 1.0, length(p / radius));
}
float faFreckle(vec2 uv, float density) {
  vec2 p = uv * 360.0;
  vec2 cell = floor(p);
  float a = fract(sin(dot(cell, vec2(72.43, 29.71))) * 41721.95);
  float b = fract(sin(dot(cell, vec2(29.15, 91.59))) * 23945.29);
  vec2 offset = vec2(a, b) * 0.44 + 0.28;
  float dotMask = 1.0 - smoothstep(0.10, 0.24, length(fract(p) - offset));
  return dotMask * step(1.0 - density, a);
}
float faDiamond(vec2 p, vec2 radius) {
  vec2 q = abs(p / radius);
  return 1.0 - smoothstep(0.8, 1.0, q.x + q.y);
}
float faLine(vec2 p, vec2 a, vec2 b, float width) {
  vec2 d = b - a;
  float distanceToLine = length(p - a - d * clamp(dot(p - a, d) / dot(d, d), 0.0, 1.0));
  return 1.0 - smoothstep(width * 0.58, width, distanceToLine);
}
vec3 faFacePaint(vec3 base, vec4 pigment, float mask) {
  float lum = dot(base, vec3(0.2126, 0.7152, 0.0722));
  return mix(base, pigment.rgb * clamp(0.46 + 1.9 * lum, 0.46, 1.25), mask * pigment.a);
}
`;

// Makeup follows UVs on the existing head surface. The neck tattoo follows
// bind-space skin across UV seams, so it moves with animation and never dyes clothes.
const MARKS = `#ifdef USE_MAP
if (uFaInk.x + uFaInk.y + uFaDetails.x + uFaDetails.y + uFaLip.a + uFaBlush.a + uFaShadow.a + uFaBeard.a > 0.0) {
  vec2 uv = vMapUv;
  float x = abs(uv.x - 0.1845);
  vec3 paint = diffuseColor.rgb;
  if (uFaDetails.y > 0.0) {
    float field = faSoftOval(uv - vec2(0.1835, 0.204), vec2(0.113, 0.026), 0.28);
    float density = uFaDetails.y == 1.0 ? 0.25 : 0.58;
    if (uFaDetails.y == 3.0) {
      field = faSoftOval(uv - vec2(0.1835, 0.200), vec2(0.041, 0.025), 0.16);
      density = 0.62;
    } else if (uFaDetails.y == 4.0) {
      field = faSoftOval(uv - vec2(0.1835, 0.215), vec2(0.116, 0.042), 0.32);
      density = 0.46;
    } else if (uFaDetails.y == 5.0) {
      field = faSoftOval(vec2(x - 0.080, uv.y - 0.222), vec2(0.043, 0.029), 0.40);
      density = 0.22;
    }
    float freckles = faFreckle(uv, density) * field;
    paint *= mix(vec3(1.0), vec3(0.47, 0.35, 0.29), 0.52 * freckles);
  }
  float lid = faSoftOval(vec2(x - 0.052, uv.y - 0.165), vec2(0.030, 0.020), 0.17);
  paint = faFacePaint(paint, uFaShadow, lid);
  float cheek = faSoftOval(vec2(x - 0.080, uv.y - 0.222), vec2(0.042, 0.025), 0.08);
  paint = faFacePaint(paint, uFaBlush, cheek);
  float lip = faSoftOval(uv - vec2(0.1835, 0.2650), vec2(0.036, uFaInk.w), 0.58);
  paint = faFacePaint(paint, uFaLip, lip);

  vec2 p = vec2(x - 0.086, uv.y - 0.228);
  float ink = 0.0;
  if (uFaInk.x == 1.0) {
    float slant = p.y + 0.36 * p.x;
    ink = max(faSoftOval(vec2(p.x, slant), vec2(0.034, 0.004), 0.53),
      faSoftOval(vec2(p.x - 0.006, slant - 0.012), vec2(0.025, 0.0035), 0.48));
  } else if (uFaInk.x == 2.0) {
    ink = max(faDiamond(p, vec2(0.014, 0.025)),
      faDiamond(p - vec2(0.020, 0.006), vec2(0.008, 0.013)));
    ink *= 1.0 - faDiamond(p, vec2(0.006, 0.010));
  } else if (uFaInk.x == 3.0) {
    ink = max(faLine(p, vec2(-0.020, -0.008), vec2(-0.004, 0.013), 0.004),
      faLine(p, vec2(0.005, -0.012), vec2(0.020, 0.006), 0.003));
  } else if (uFaInk.x == 4.0) {
    vec2 moon = uv - vec2(0.258, 0.226);
    ink = faSoftOval(moon, vec2(0.019, 0.016), 0.80)
      * (1.0 - faSoftOval(moon - vec2(0.008, -0.004), vec2(0.015, 0.012), 0.78));
    ink = max(ink, faDiamond(moon - vec2(0.023, -0.009), vec2(0.004, 0.006)));
  } else if (uFaInk.x == 5.0) {
    vec2 rune = uv - vec2(0.281, 0.175);
    ink = max(faLine(rune, vec2(0.0, -0.020), vec2(0.0, 0.024), 0.0028),
      max(faLine(rune, vec2(0.0, -0.012), vec2(-0.012, -0.020), 0.0025),
        faLine(rune, vec2(0.0, 0.002), vec2(0.012, -0.008), 0.0025)));
  }

  vec2 neck = vec2(vFaInkBind.x, vFaInkBind.y - uFaInk.z);
  float front = smoothstep(-0.028, -0.006, vFaInkBind.z);
  float body = 0.0;
  if (uFaInk.y == 1.0) {
    float v = neck.y - abs(neck.x) * 0.43;
    body = max(faSoftOval(vec2(neck.x, v), vec2(0.039, 0.003), 0.45),
      faSoftOval(vec2(neck.x, v + 0.009), vec2(0.030, 0.0028), 0.45));
  } else if (uFaInk.y == 2.0) {
    body = faDiamond(neck, vec2(0.022, 0.023)) * (1.0 - faDiamond(neck, vec2(0.011, 0.013)));
    body = max(body, faDiamond(vec2(abs(neck.x) - 0.028, neck.y), vec2(0.006, 0.008)));
  } else if (uFaInk.y == 3.0) {
    vec2 branch = vec2(abs(neck.x), neck.y);
    body = faLine(branch, vec2(0.004, -0.010), vec2(0.039, 0.012), 0.002);
    body = max(body, faSoftOval(vec2(branch.x - 0.020, branch.y - branch.x * 0.8 + 0.001),
      vec2(0.007, 0.004), 0.4));
    body = max(body, faSoftOval(vec2(branch.x - 0.032, branch.y - branch.x * 0.7),
      vec2(0.006, 0.0038), 0.4));
  } else if (uFaInk.y == 4.0) {
    float distanceToCenter = length(neck);
    float ring = smoothstep(0.009, 0.011, distanceToCenter) * (1.0 - smoothstep(0.013, 0.015, distanceToCenter));
    float ray = pow(abs(cos(atan(neck.y, neck.x) * 6.0)), 12.0);
    body = max(ring, ray * smoothstep(0.015, 0.017, distanceToCenter) * (1.0 - smoothstep(0.022, 0.024, distanceToCenter)));
  } else if (uFaInk.y == 5.0) {
    vec2 strand = vec2(abs(neck.x), neck.y);
    float outer = faDiamond(strand - vec2(0.012, 0.0), vec2(0.019, 0.014));
    float inner = faDiamond(strand - vec2(0.012, 0.0), vec2(0.014, 0.009));
    body = max(outer * (1.0 - inner), faDiamond(neck, vec2(0.004, 0.006)));
  }
  float strength = max(ink, body * front);
  paint = mix(paint, paint * vec3(0.16, 0.30, 0.42), strength * 0.84);
  if (uFaDetails.x > 0.0) {
    vec2 center = uFaDetails.x == 1.0 ? vec2(0.243, 0.157) : vec2(0.263, 0.228);
    if (uFaDetails.x == 3.0) center = vec2(0.184, 0.194);
    else if (uFaDetails.x == 4.0) center = vec2(0.255, 0.270);
    else if (uFaDetails.x == 5.0) center = vec2(0.278, 0.151);
    vec2 mark = uv - center;
    if (uFaDetails.x == 3.0) mark = vec2(mark.y + 0.35 * mark.x, mark.x);
    else if (uFaDetails.x == 4.0) mark = vec2(mark.y - 0.45 * mark.x, mark.x);
    float lengthAlong = uFaDetails.x > 2.0 ? 0.021 : 0.030;
    float streak = faSoftOval(vec2(mark.x + 0.52 * mark.y, mark.y), vec2(0.0029, lengthAlong), 0.33);
    float edge = faSoftOval(vec2(mark.x + 0.52 * mark.y - 0.0022, mark.y), vec2(0.0014, lengthAlong * 0.83), 0.38);
    paint = mix(paint, paint * vec3(0.56, 0.36, 0.34), streak * 0.56);
    paint = mix(paint, paint * 1.4 + vec3(0.018, 0.010, 0.008), edge * 0.72);
  }
  if (uFaBeard.a > 0.0) {
    float sideburn = faSoftOval(vec2(x - 0.099, uv.y - 0.247), vec2(0.025, 0.041), 0.57);
    float jaw = faSoftOval(vec2(x, uv.y - 0.303 + 0.25 * x), vec2(0.106, 0.019), 0.49);
    float boxed = faSoftOval(uv - vec2(0.1835, 0.292), vec2(0.089, 0.036), 0.53);
    float hair = uFaBeard.a == 1.0 ? sideburn : max(sideburn * 0.82, jaw);
    if (uFaBeard.a == 3.0) hair = max(hair, boxed * (1.0 - lip * 0.92));
    float grain = 0.74 + 0.26 * faFreckle(uv * 1.8, 0.94);
    paint = faFacePaint(paint, vec4(uFaBeard.rgb * grain, 0.87), hair);
  }
  diffuseColor.rgb = paint;
}
#endif`;

function bind(material: Material, look: SkinMarkUniforms): void {
  uniforms.set(material, look);
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    compile.call(material, shader, renderer);
    shader.uniforms.uFaInk = look.ink;
    shader.uniforms.uFaDetails = look.details;
    shader.uniforms.uFaLip = look.lipstick;
    shader.uniforms.uFaBlush = look.blush;
    shader.uniforms.uFaShadow = look.eyeshadow;
    shader.uniforms.uFaBeard = look.beard;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VARYING}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFaInkBind = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${DECL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${MARKS}`);
  };
  material.customProgramCacheKey = () => `${key}|fa-skin-markings-v2`;
}

export function attachFaReleaseSkinMarks(
  material: Material,
  fit: SkinMarkUniforms['fit'],
): (markings: FaReleaseMarkings) => void {
  const look: SkinMarkUniforms = {
    fit,
    ink: { value: new Vector4() },
    details: { value: new Vector4() },
    lipstick: { value: new Vector4() },
    blush: { value: new Vector4() },
    eyeshadow: { value: new Vector4() },
    beard: { value: new Vector4() },
  };
  bind(material, look);
  return (marks) => {
    look.ink.value.set(
      Math.max(0, FA_FACE_TATTOOS.indexOf(marks.faceTattoo)),
      Math.max(0, FA_BODY_TATTOOS.indexOf(marks.bodyTattoo)),
      look.fit === 'female' ? 1.503 : 1.549,
      look.fit === 'female' ? 0.017 : 0.0115,
    );
    look.details.value.set(
      Math.max(0, FA_FACE_SCARS.indexOf(marks.faceScar)),
      Math.max(0, FA_FRECKLES.indexOf(marks.freckles)),
      0,
      0,
    );
    setPigment(look.lipstick.value, marks.lipstick, 0.78);
    setPigment(look.blush.value, marks.blush, 0.42);
    setPigment(look.eyeshadow.value, marks.eyeshadow, 0.62);
    const beardMode = marks.beard === 'fa_chops' ? 1 : marks.beard === 'fa_chinstrap' ? 2 : marks.beard === 'fa_boxed' ? 3 : 0;
    look.beard.value.set(...hexToLinear(marks.beardColor), beardMode);
  };
}

function setPigment(target: Vector4, hex: number | null, strength: number): void {
  if (hex === null) target.set(0, 0, 0, 0);
  else target.set(...hexToLinear(hex), strength);
}

export function reapplyFaReleaseSkinMarks(source: Material, clone: Material): void {
  const look = uniforms.get(source);
  if (look) bind(clone, look);
}
