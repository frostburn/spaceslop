import * as T from 'three';

function fallbackMold() {
  const size = 128, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x / size - 0.5) * 2, v = (y / size - 0.5) * 2;
    const angle = Math.atan2(v, u);
    const edge = 0.68 + Math.sin(angle * 5 + 0.8) * 0.07 + Math.sin(angle * 9) * 0.035;
    const distance = Math.hypot(u, v);
    const grain = Math.sin(x * 1.73 + Math.cos(y * 0.41)) * Math.sin(y * 2.37 + Math.sin(x * 0.57));
    const cloud = Math.sin(x * 0.13 + Math.cos(y * 0.11) * 2) * Math.sin(y * 0.15);
    const feather = Math.max(0, Math.min(1, (edge - distance) / 0.22));
    const index = (y * size + x) * 4;
    image.data[index] = 190 + cloud * 19 + grain * 17;
    image.data[index + 1] = 193 + cloud * 18 + grain * 15;
    image.data[index + 2] = 170 + cloud * 19 + grain * 13;
    image.data[index + 3] = feather * Math.max(0.1, 0.54 + grain * 0.24 + cloud * 0.2) * 255;
  }
  context.putImageData(image, 0, 0);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

const moldMap = fallbackMold();
const materials = [0, 0.85, -0.65].map((rotation) => new T.SpriteMaterial({
  map: moldMap, color: 0xf0ead4, transparent: true, opacity: 0.88,
  alphaTest: 0.015, depthWrite: false, rotation,
}));

export function setAntMoldTexture(texture: T.Texture) {
  texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
  for (const material of materials) {
    material.map = texture;
    material.needsUpdate = true;
  }
}

export function addMoldPatch(parent: T.Group, x: number, y: number, z: number, width: number, height: number, variant = 0) {
  const patch = new T.Sprite(materials[variant % materials.length]);
  patch.name = 'camera-facing-mold';
  patch.position.set(x, y, z);
  patch.scale.set(width, height, 1);
  parent.add(patch);
}
