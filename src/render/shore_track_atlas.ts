import * as THREE from 'three';

const SIZE = 40;

function oval(x: number, y: number, cx: number, cy: number, rx: number, ry: number): number {
  return Math.hypot((x - cx) / rx, (y - cy) / ry);
}

function impression(tile: number, x: number, y: number): number {
  if (tile === 0) {
    const sole = oval(x, y, 0.02, 0.34, 0.64, 0.52);
    const heel = oval(x, y, -0.05, -0.5, 0.51, 0.32);
    return Math.min(sole, heel);
  }
  if (tile === 1) {
    return Math.min(
      oval(x, y, 0, -0.29, 0.59, 0.39),
      oval(x, y, -0.54, 0.2, 0.2, 0.26),
      oval(x, y, -0.2, 0.54, 0.19, 0.26),
      oval(x, y, 0.2, 0.54, 0.19, 0.26),
      oval(x, y, 0.54, 0.2, 0.2, 0.26),
    );
  }
  const taper = 0.82 + 0.16 * (1 - y);
  return oval(Math.abs(x) * taper, y, 0.39, 0.02, 0.25, 0.76);
}

/** Tiny procedural boot, paw and split-hoof stamps with a light pressed rim. */
export function createShoreTrackAtlas(): THREE.DataTexture {
  const data = new Uint8Array(SIZE * SIZE * 3 * 4);
  for (let tile = 0; tile < 3; tile++) {
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        const x = ((col + 0.5) / SIZE) * 2 - 1;
        const y = ((row + 0.5) / SIZE) * 2 - 1;
        const shape = impression(tile, x, y);
        const edge = Math.min(1, Math.max(0, (1.12 - shape) / 0.22));
        const rim = Math.max(0, 1 - Math.abs(shape - 0.87) * 5) * Math.max(0, 0.55 + 0.6 * y);
        const grit = ((col * 13 + row * 29) % 11) * 0.6;
        const tread = tile === 0 && Math.floor((y + 1) * 10) % 4 === 2 ? 11 : 0;
        const i = (row * SIZE * 3 + tile * SIZE + col) * 4;
        data[i] = 39 + rim * 85 + grit + tread;
        data[i + 1] = 27 + rim * 63 + grit + tread;
        data[i + 2] = 17 + rim * 43 + grit + tread;
        data[i + 3] = Math.round(edge * 255);
      }
    }
  }
  const texture = new THREE.DataTexture(data, SIZE * 3, SIZE);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
