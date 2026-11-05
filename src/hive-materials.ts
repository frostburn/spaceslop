import * as T from 'three';

// Small, deterministic surfaces keep the models textured before the reviewed art is installed.
function surface(fungal: boolean) {
  const size = 128;
  const canvas = document.createElement('canvas');
  const relief = document.createElement('canvas');
  canvas.width = canvas.height = relief.width = relief.height = size;
  const context = canvas.getContext('2d')!;
  const reliefContext = relief.getContext('2d')!;
  const pixels = context.createImageData(size, size);
  const heights = reliefContext.createImageData(size, size);
  const base = fungal ? [167, 126, 74] : [106, 55, 34];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * Math.PI * 2;
    const v = y / size * Math.PI * 2;
    const grain = Math.sin(u * 31 + Math.cos(v * 11) * 2) * Math.sin(v * 37 + Math.sin(u * 7));
    const fiber = Math.sin(u * (fungal ? 17 : 9) + Math.sin(v * 3) * 2);
    const pores = Math.max(0, grain - 0.55) * 42;
    const shade = fiber * (fungal ? 12 : 7) + grain * 6 - pores;
    const index = (y * size + x) * 4;
    for (let c = 0; c < 3; c++) {
      pixels.data[index + c] = base[c] + shade;
      heights.data[index + c] = 176 + fiber * 23 + grain * 19 - pores;
    }
    pixels.data[index + 3] = heights.data[index + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  reliefContext.putImageData(heights, 0, 0);
  const color = new T.CanvasTexture(canvas);
  const height = new T.CanvasTexture(relief);
  color.colorSpace = T.SRGBColorSpace;
  for (const texture of [color, height]) {
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.anisotropy = 2;
  }
  return { color, height };
}

const chitin = surface(false);
const fungal = surface(true);

function cloudedEye() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d')!;
  const pixels = context.createImageData(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const cloud = Math.sin(x * 0.13 + Math.sin(y * 0.17) * 1.8) * Math.cos(y * 0.11);
    const vein = Math.sin(x * 0.37 + Math.cos(y * 0.15) * 3) ** 18;
    const index = (y * 64 + x) * 4;
    pixels.data[index] = 134 + cloud * 20 - vein * 12;
    pixels.data[index + 1] = 155 + cloud * 18 - vein * 10;
    pixels.data[index + 2] = 147 + cloud * 17 - vein * 8;
    pixels.data[index + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

export const antShell = new T.MeshStandardMaterial({
  color: 0xd4b2a0, map: chitin.color, bumpMap: chitin.height, bumpScale: 0.026,
  roughnessMap: chitin.height, roughness: 0.64, metalness: 0.14,
});
export const antJoint = new T.MeshStandardMaterial({
  color: 0x62514b, map: chitin.color, bumpMap: chitin.height, bumpScale: 0.016, roughness: 0.72,
});
export const antSeam = new T.MeshStandardMaterial({ color: 0x3d2420, roughness: 0.66 });
export const antEye = new T.MeshStandardMaterial({ color: 0xe0e5d7, map: cloudedEye(), roughness: 0.68 });
export const sporeGlow = new T.MeshBasicMaterial({ color: 0xffb05b });

export const fungusCap = new T.MeshStandardMaterial({
  color: 0xf0c49b, map: fungal.color, bumpMap: fungal.height, bumpScale: 0.04, roughness: 0.86,
});
export const fungusStem = new T.MeshStandardMaterial({
  color: 0xf3e2c1, map: fungal.color, bumpMap: fungal.height, bumpScale: 0.025, roughness: 0.92,
});
export const fungusGills = new T.MeshStandardMaterial({ color: 0x89653e, roughness: 0.96, side: T.DoubleSide });
export const mycelium = new T.MeshStandardMaterial({ color: 0xc4ae89, map: fungal.color, roughness: 0.96 });

export function setAntChitinTexture(texture: T.Texture) {
  for (const material of [antShell, antJoint]) {
    material.map = texture;
    material.needsUpdate = true;
  }
}

export function setFungusTexture(texture: T.Texture) {
  for (const material of [fungusCap, fungusStem, mycelium]) {
    material.map = texture;
    material.needsUpdate = true;
  }
}
