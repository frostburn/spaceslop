import * as T from 'three';
import { shipAlloy } from './encounter-surfaces';

export function asteroidGeometry(seed: number) {
  const geometry = new T.SphereGeometry(1, 32, 24), positions = geometry.getAttribute('position');
  const colors: number[] = [], frost: number[] = [], point = new T.Vector3(), color = new T.Color();
  const stone = new T.Color(0x444b50), ice = new T.Color(0xb4cbd4);
  const craters = Array.from({ length: 7 }, (_, i) => {
    const z = Math.sin(i * 7.1 + seed * 2.3) * 0.9, angle = i * 2.399 + seed;
    return { axis: new T.Vector3(Math.cos(angle) * Math.sqrt(1 - z * z), Math.sin(angle) * Math.sqrt(1 - z * z), z),
      width: 0.025 + (i % 3) * 0.012 };
  });
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    const noise = Math.sin(point.x * 4 + seed) * Math.sin(point.y * 3 - seed) * Math.cos(point.z * 5 + seed);
    let radius = 0.84 + noise * 0.075 + Math.sin(point.x * 2 + point.y * 3 + seed) * 0.055;
    for (const crater of craters) {
      const d = (1 - point.dot(crater.axis)) / crater.width;
      if (d < 1) radius -= 0.08 * (1 - d) ** 2;
      radius += 0.009 * Math.exp(-(((d - 0.9) * 9) ** 2));
    }
    const cover = T.MathUtils.smoothstep(point.z + Math.sin(point.x * 6 + seed) * 0.24 + noise * 0.2, -0.3, 0.35);
    point.multiplyScalar(radius); point.x *= 0.92 + Math.sin(seed * 1.7) * 0.06;
    point.y *= 0.9 + Math.sin(seed * 2.1) * 0.07;
    positions.setXYZ(i, point.x, point.y, point.z);
    color.copy(stone).lerp(ice, cover).multiplyScalar(0.92 + noise * 0.12);
    colors.push(color.r, color.g, color.b); frost.push(cover);
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('frost', new T.Float32BufferAttribute(frost, 1));
  geometry.computeVertexNormals();
  // UV seam and pole duplicates share a smooth normal too.
  const normals = geometry.getAttribute('normal'), sums = new Map<string, T.Vector3>();
  const keys: string[] = [];
  for (let i = 0; i < positions.count; i++) {
    const key = [positions.getX(i), positions.getY(i), positions.getZ(i)].map(v => Math.round(v * 1e5)).join('/');
    keys.push(key); const sum = sums.get(key) ?? new T.Vector3();
    sum.x += normals.getX(i); sum.y += normals.getY(i); sum.z += normals.getZ(i); sums.set(key, sum);
  }
  for (const normal of sums.values()) normal.normalize();
  keys.forEach((key, i) => { const n = sums.get(key)!; normals.setXYZ(i, n.x, n.y, n.z); });
  return geometry;
}

let relief: { normal: T.Texture; roughness: T.Texture } | undefined;
export function asteroidRelief() {
  if (relief) return relief;
  const size = 256, height = new Float32Array(size * size);
  const tau = Math.PI * 2;
  // Periodic height field: worn pits, fine grit and shallow branching fractures.
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * tau, v = y / size * tau;
    const grain = Math.sin(u * 47 + Math.sin(v * 19)) * Math.cos(v * 39 + Math.sin(u * 23));
    const pits = Math.sin(u * 11 + Math.sin(v * 7) * 2) * Math.cos(v * 13 + Math.sin(u * 5));
    const vein = Math.abs(Math.sin(u * 6 + Math.sin(v * 4) * 2 + Math.sin(v * 9) * 0.4));
    height[y * size + x] = 0.5 + grain * 0.035 + pits * 0.11 - Math.exp(-vein * 35) * 0.07;
  }
  const make = () => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = size; return canvas; };
  const normalCanvas = make(), roughCanvas = make(), nc = normalCanvas.getContext('2d')!, rc = roughCanvas.getContext('2d')!;
  const ni = nc.createImageData(size, size), ri = rc.createImageData(size, size);
  const h = (x: number, y: number) => height[((y + size) % size) * size + (x + size) % size];
  const n = new T.Vector3();
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    n.set((h(x - 1, y) - h(x + 1, y)) * 3, (h(x, y - 1) - h(x, y + 1)) * 3, 1).normalize();
    const i = (y * size + x) * 4;
    ni.data[i] = (n.x * 0.5 + 0.5) * 255; ni.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
    ni.data[i + 2] = (n.z * 0.5 + 0.5) * 255; ni.data[i + 3] = 255;
    ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = 200 + height[y * size + x] * 45; ri.data[i + 3] = 255;
  }
  nc.putImageData(ni, 0, 0); rc.putImageData(ri, 0, 0);
  const normal = new T.CanvasTexture(normalCanvas), roughness = new T.CanvasTexture(roughCanvas);
  for (const texture of [normal, roughness]) { texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.repeat.set(2.4, 2.4); }
  return relief = { normal, roughness };
}

export function weatheredMetal() {
  const material = shipAlloy(0x7d898e), base = material.onBeforeCompile;
  material.roughness = 0.72;
  material.onBeforeCompile = (shader, renderer) => {
    base.call(material, shader, renderer);
    shader.vertexShader = 'varying vec3 vPatina;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPatina = position;');
    shader.fragmentShader = `varying vec3 vPatina;
      float patinaHash(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
      float patinaNoise(vec3 p) {
        vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(patinaHash(i),patinaHash(i+vec3(1,0,0)),f.x),mix(patinaHash(i+vec3(0,1,0)),patinaHash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(patinaHash(i+vec3(0,0,1)),patinaHash(i+vec3(1,0,1)),f.x),mix(patinaHash(i+vec3(0,1,1)),patinaHash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float deposits = patinaNoise(vPatina * 15.0) * 0.65 + patinaNoise(vPatina * 4.0) * 0.35;
      float dirt = smoothstep(0.28, 0.78, deposits) * 0.6;
      float corrosion = smoothstep(0.66, 0.86, patinaNoise(vPatina * 22.0 + vec3(4.0,1.0,7.0))) * 0.65;
      diffuseColor.rgb *= 1.0 - dirt;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.11, 0.049, 0.021), corrosion);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.94, max(dirt, corrosion));');
    shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor *= 1.0 - max(dirt, corrosion);');
  };
  material.customProgramCacheKey = () => 'frostwake-weathered-alloy-v1';
  return material;
}
