import * as T from 'three';
import { applySurfaceMap } from './encounter-surfaces';
import { antGaster, antHead, antThorax } from './ant-shell';

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

export const antMold = new T.MeshStandardMaterial({
  map: fallbackMold(), color: 0xd8dbc5, roughness: 1, transparent: true, opacity: 0.86,
  alphaTest: 0.02, depthWrite: false,
});

export function setAntMoldTexture(texture: T.Texture) {
  texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
  applySurfaceMap(texture, [antMold]);
}

type Patch = readonly [y: number, angle: number, halfHeight: number, halfAngle: number, rotation: number];

function moldPatches(shell: typeof antGaster, patches: readonly Patch[]) {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const rows = 22, cols = 12;
  for (const [y, angle, halfHeight, halfAngle, rotation] of patches) {
    const start = positions.length / 3;
    const cos = Math.cos(rotation), sin = Math.sin(rotation);
    for (let row = 0; row <= rows; row++) for (let col = 0; col <= cols; col++) {
      const u = col / cols, v = row / rows;
      const x = 2 * u - 1, s = 2 * v - 1;
      const p = shell.point(y + halfHeight * (x * sin + s * cos), angle + halfAngle * (x * cos - s * sin), 0.007);
      positions.push(p.x, p.y, p.z);
      uv.push(u, v);
      if (row < rows && col < cols) {
        const a = start + row * (cols + 1) + col, b = a + cols + 1;
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices).computeVertexNormals();
  return geometry;
}

export const gasterMold = moldPatches(antGaster, [
  [-0.105, -0.28, 0.28, 0.51, -0.14], [-0.106, 0.91, 0.28, 0.70, 0.47], [-0.163, -1.18, 0.22, 0.56, -0.33],
]);
export const thoraxMold = moldPatches(antThorax, [[0.095, -0.25, 0.208, 1.03, 0.27]]);
export const headMold = moldPatches(antHead, [[-0.073, -0.27, 0.135, 0.79, -0.31]]);
