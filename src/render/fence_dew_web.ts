import * as THREE from 'three';
import { currentDayNightPhase } from './day_night_clock';
import { fenceDewMorning, fenceDewPattern } from './fence_dew_web_core';

const SIZE = 256;

function dewMask(): THREE.DataTexture {
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  const { silk, strand, drops } = fenceDewPattern();
  // Red holds the web, green holds the beads, blue holds one anchor thread.
  function paint(
    from: { x: number; y: number },
    to: { x: number; y: number },
    radius: number,
    channel: number,
    strength: number,
  ): void {
    const ax = from.x * SIZE;
    const ay = from.y * SIZE;
    const bx = to.x * SIZE;
    const by = to.y * SIZE;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const reach = radius + 1;
    for (
      let y = Math.max(0, Math.floor(Math.min(ay, by) - reach));
      y < Math.min(SIZE, Math.ceil(Math.max(ay, by) + reach));
      y++
    ) {
      for (
        let x = Math.max(0, Math.floor(Math.min(ax, bx) - reach));
        x < Math.min(SIZE, Math.ceil(Math.max(ax, bx) + reach));
        x++
      ) {
        const t =
          lengthSq > 0
            ? Math.max(0, Math.min(1, ((x + 0.5 - ax) * dx + (y + 0.5 - ay) * dy) / lengthSq))
            : 0;
        const distance = Math.hypot(x + 0.5 - ax - t * dx, y + 0.5 - ay - t * dy);
        const coverage = Math.max(0, Math.min(1, radius + 0.65 - distance));
        const i = (x + y * SIZE) * 4 + channel;
        pixels[i] = Math.max(pixels[i], Math.round(coverage * strength));
      }
    }
  }
  for (const { from, to } of silk) paint(from, to, 0.53, 0, 255);
  paint(strand.from, strand.to, 0.72, 2, 255);
  drops.forEach((p, i) => {
    paint(p, p, 1.2 + (i % 4) * 0.53, 1, 215 + (i % 3) * 20);
  });

  const texture = new THREE.DataTexture(pixels, SIZE, SIZE);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createFenceDewWebMaterial(): THREE.ShaderMaterial {
  const mask = dewMask();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uMask: { value: mask },
      uMorning: { value: 0 },
    },
    fog: true,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 vWebUv;
      varying vec3 vWebEye;
      varying vec3 vWebNormal;
      #include <fog_pars_vertex>
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vWebUv = uv;
        vWebEye = -mvPosition.xyz;
        vWebNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMask;
      uniform float uMorning;
      varying vec2 vWebUv;
      varying vec3 vWebEye;
      varying vec3 vWebNormal;
      #include <fog_pars_fragment>
      void main() {
        if (uMorning <= 0.0) discard;
        float distance = length(vWebEye);
        if (distance >= 12.0) discard;
        float face = abs(dot(vWebNormal, vWebEye / max(distance, 0.001)));
        vec3 mask = texture2D(uMask, vWebUv).rgb;
        float web = smoothstep(0.28, 0.58, face);
        float strand = mask.b * (1.0 - web) * smoothstep(0.04, 0.16, face);
        float glint = 0.55 + 0.45 * pow(max(1.0 - abs(face - 0.72) * 2.0, 0.0), 4.0);
        float drops = mask.g * web * glint;
        float opacity = max(mask.r * web * 0.47, max(strand * 0.78, drops));
        opacity *= uMorning * (1.0 - smoothstep(6.5, 12.0, distance));
        if (opacity < 0.015) discard;
        vec3 tint = mix(vec3(0.69, 0.77, 0.82), vec3(1.0, 0.93, 0.73), drops);
        gl_FragColor = vec4(tint, opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  material.addEventListener('dispose', () => mask.dispose());
  material.name = 'fence-dew-web';
  material.forceSinglePass = true;
  return material;
}

export function buildFenceDewWeb(
  transform: THREE.Matrix4,
  size: THREE.Vector3,
  variant: 0 | 1,
  material: THREE.ShaderMaterial,
): THREE.Mesh {
  // The fence template is centered on X/Z and sits at Y zero. Keep the web
  // in the lower opening; the long radial threads meet the posts and bottom rail.
  const geo = new THREE.PlaneGeometry(size.x * 0.78, size.y * 0.32);
  geo.translate(size.x * 0.008, size.y * 0.2675, size.z * 0.1);
  if (variant === 1) {
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  }
  geo.applyMatrix4(transform);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = `eastbrook-fence-dew-web-${variant}`;
  mesh.onBeforeRender = () => {
    material.uniforms.uMorning.value = fenceDewMorning(currentDayNightPhase());
    material.uniformsNeedUpdate = true;
  };
  return mesh;
}
