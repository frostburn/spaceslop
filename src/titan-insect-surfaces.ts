import * as T from 'three';

function random(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
}
function filteredTexture(data: Uint8Array, width: number, height: number) {
  const texture = new T.DataTexture(data, width, height);
  texture.colorSpace = T.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = T.LinearMipmapLinearFilter; texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// Finite, seeded image data gets normal mip filtering when an insect is small.
// No screen-space facets or unbounded-frequency procedural fragment patterns.
function fallbackChitin() {
  const size = 128, rng = random(7261), grid = Array.from({ length: 64 }, rng), data = new Uint8Array(size * size * 4);
  const fade = (x: number) => x * x * (3 - 2 * x);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * 8, v = y / size * 8, ix = Math.floor(u), iy = Math.floor(v), a = fade(u - ix), b = fade(v - iy);
    const sample = (dx: number, dy: number) => grid[((iy + dy) % 8) * 8 + (ix + dx) % 8];
    const value = 195 + ((sample(0, 0) * (1-a) + sample(1, 0) * a) * (1-b) +
      (sample(0, 1) * (1-a) + sample(1, 1) * a) * b - .5) * 54 + (rng() - .5) * 10;
    const i = (y * size + x) * 4; data.set([value, value, value, 255], i);
  }
  const texture = filteredTexture(data, size, size); texture.name = 'mipmapped-chitin-fallback';
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  return texture;
}

function fallbackSetae() {
  const w = 192, h = 128, data = new Uint8Array(w * h * 4), rng = random(5913);
  for (let i = 0; i < data.length; i += 4) data.set([255, 255, 255, 0], i);
  for (let i = 0; i < 1600; i++) {
    const angle = rng() * Math.PI * 2, radius = Math.sqrt(rng()) * .67;
    const x = w * (.5 + Math.cos(angle) * radius * .46), y = h * (.5 + Math.sin(angle) * radius * .46);
    const length = 7 + rng() * 18, dx = Math.cos(angle), dy = Math.sin(angle), bend = (rng() - .5) * 5;
    for (let t = 0; t < length; t += .5) {
      const u = t / length, px = Math.round(x + dx*t - dy*bend*u*u), py = Math.round(y + dy*t + dx*bend*u*u);
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      const index = (py*w + px)*4 + 3;
      data[index] = Math.min(230, data[index] + (1-u) * 110);
    }
  }
  const texture = filteredTexture(data, w, h); texture.name = 'setae-fallback'; return texture;
}

let chitinMap: T.Texture = fallbackChitin();
const shellMaterials = new Set<T.MeshStandardMaterial>();
export function titanChitin(color: number, roughness = .67, metalness = .09) {
  const material = new T.MeshStandardMaterial({ color, roughness, metalness, map: chitinMap, bumpMap: chitinMap, bumpScale: .018 });
  shellMaterials.add(material); return material;
}
export function setTitanChitinTexture(texture: T.Texture) {
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.anisotropy = 4;
  chitinMap = texture;
  for (const material of shellMaterials) {
    material.map = material.bumpMap = texture; material.needsUpdate = true;
  }
}

const setaeMap = fallbackSetae();
const furMaterials = [
  new T.SpriteMaterial({ map: setaeMap, color: 0xc3dbbc, opacity: .48, transparent: true, depthWrite: false, alphaTest: .025 }),
  new T.SpriteMaterial({ map: setaeMap, color: 0xd4c5a6, opacity: .86, transparent: true, depthWrite: false, alphaTest: .025 }),
  new T.SpriteMaterial({ map: setaeMap, color: 0xc7b591, opacity: .82, transparent: true, depthWrite: false, alphaTest: .025, rotation: .7 }),
];
export function setTitanSetaeTexture(texture: T.Texture) {
  texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
  for (const material of furMaterials) { material.map = texture; material.needsUpdate = true; }
}
// Depth-tested billboards stay attached to the posed 3D body, with no depth write
// or render-order override that could paint fur across eyes and attack vents.
export function addTitanSetae(parent: T.Object3D, x: number, y: number, z: number, width: number, height: number, kind = 1) {
  const patch = new T.Sprite(furMaterials[kind]); patch.name = 'camera-facing-setae';
  patch.position.set(x, y, z); patch.scale.set(width, height, 1); parent.add(patch); return patch;
}
