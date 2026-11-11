import * as T from 'three';

function hash(x: number, y: number, salt: number) {
  const value = Math.sin(x * 127.1 + y * 311.7 + salt * 37.2) * 43758.5453;
  return value - Math.floor(value);
}

const wrap = (cell: number, size: number) => (cell + size) % size;

function noise(u: number, v: number, size: number) {
  const x = Math.floor(u * size), y = Math.floor(v * size);
  const tx = T.MathUtils.smoothstep(u * size - x, 0, 1);
  const ty = T.MathUtils.smoothstep(v * size - y, 0, 1);
  const at = (i: number, j: number) => hash(wrap(i, size), wrap(j, size), size);
  return T.MathUtils.lerp(
    T.MathUtils.lerp(at(x, y), at(x + 1, y), tx),
    T.MathUtils.lerp(at(x, y + 1), at(x + 1, y + 1), tx), ty,
  );
}

function crater(u: number, v: number) {
  const cells = 10;
  const px = u * cells, py = v * cells;
  const cx = Math.floor(px), cy = Math.floor(py);
  let bowl = 0, rim = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = cx + dx, y = cy + dy;
    const i = wrap(x, cells), j = wrap(y, cells);
    const radius = .19 + .27 * hash(i, j, 1);
    const d = Math.hypot(px - x - hash(i, j, 2), py - y - hash(i, j, 3)) / radius;
    bowl = Math.max(bowl, 1 - T.MathUtils.smoothstep(d, .19, .92));
    rim = Math.max(rim, 1 - T.MathUtils.smoothstep(Math.abs(d - .94), .015, .27));
  }
  return { bowl, rim };
}

export function createStoneSurface() {
  const size = 256;
  const pigment = new Uint8Array(size * size * 4);
  const relief = new Uint8Array(pigment.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + .5) / size, v = (y + .5) / size;
    const mineral = noise(u, v, 6), fracture = noise(u, v, 24), grit = noise(u, v, 83);
    const { bowl, rim } = crater(u, v);
    const seam = 1 - T.MathUtils.smoothstep(Math.abs(fracture - .49), .016, .085);
    const tone = 162 + 60 * mineral + 26 * grit - 69 * bowl - 23 * seam + 20 * rim;
    const height = 124 + 37 * fracture + 31 * grit - 91 * bowl - 31 * seam + 32 * rim;
    const i = (y * size + x) * 4;
    pigment[i] = Math.min(255, tone + mineral * 11);
    pigment[i + 1] = tone;
    pigment[i + 2] = Math.min(255, tone + 12 - mineral * 17);
    pigment[i + 3] = 255;
    relief[i] = relief[i + 1] = relief[i + 2] = height;
    relief[i + 3] = 255;
  }
  const maps = [pigment, relief].map(data => {
    const map = new T.DataTexture(data, size, size);
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.magFilter = T.LinearFilter;
    map.minFilter = T.LinearMipmapLinearFilter;
    map.generateMipmaps = true;
    map.needsUpdate = true;
    return map;
  });
  maps[0].colorSpace = T.SRGBColorSpace;
  return { map: maps[0], bumpMap: maps[1] };
}
