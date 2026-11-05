import * as T from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { shipAlloy } from './encounter-surfaces';

export function asteroidGeometry(seed: number) {
  const geometry = new T.SphereGeometry(1, 32, 24), positions = geometry.getAttribute('position');
  const colors: number[] = [], frost: number[] = [], point = new T.Vector3(), color = new T.Color();
  const stone = new T.Color(0x575650), ice = new T.Color(0xe0e7e8);
  const cuts = Array.from({ length: 11 }, (_, i) => {
    const z = 1 - (i + 0.5) / 11 * 2, a = i * 2.39996 + seed * 0.79;
    return { axis: new T.Vector3(Math.cos(a) * Math.sqrt(1-z*z), Math.sin(a) * Math.sqrt(1-z*z), z),
      depth: 0.64 + (Math.sin(i * 13.7 + seed * 5.1) * 0.5 + 0.5) * 0.22 };
  });
  const craters = Array.from({ length: 7 }, (_, i) => {
    const z = Math.sin(i * 7.1 + seed * 2.3) * 0.9, angle = i * 2.399 + seed;
    return { axis: new T.Vector3(Math.cos(angle) * Math.sqrt(1 - z * z), Math.sin(angle) * Math.sqrt(1 - z * z), z),
      width: 0.025 + (i % 3) * 0.012 };
  });
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    const noise = Math.sin(point.x * 4 + seed) * Math.sin(point.y * 3 - seed) * Math.cos(point.z * 5 + seed);
    let radius = 0.96 + noise * 0.025 + Math.sin(point.x * 2 + point.y * 3 + seed) * 0.035;
    for (const crater of craters) {
      const d = (1 - point.dot(crater.axis)) / crater.width;
      if (d < 1) radius -= 0.035 * (1 - d) ** 2;
      radius += 0.009 * Math.exp(-(((d - 0.9) * 9) ** 2));
    }
    // Broad fracture planes interrupt the rounded body; the dense mesh rounds only their rims.
    for (const cut of cuts) {
      const facing = point.dot(cut.axis);
      if (facing > 0) radius = Math.min(radius, cut.depth / facing);
    }
    const cover = 0.68 + 0.32 * T.MathUtils.smoothstep(point.z + Math.sin(point.x * 6 + seed) * 0.24 + noise * 0.2, -0.7, 0.1);
    point.multiplyScalar(radius); point.x *= 0.92 + Math.sin(seed * 1.7) * 0.06;
    point.y *= 0.9 + Math.sin(seed * 2.1) * 0.07;
    positions.setXYZ(i, point.x, point.y, point.z);
    color.copy(stone).lerp(ice, cover).multiplyScalar(0.92 + noise * 0.12);
    colors.push(color.r, color.g, color.b); frost.push(cover);
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('frost', new T.Float32BufferAttribute(frost, 1));
  // Smooth worn areas and UV seams, but retain the break at steep fracture rims.
  const fractured = toCreasedNormals(geometry, 0.32);
  geometry.dispose();
  return fractured;
}

let relief: { normal: T.Texture; roughness: T.Texture } | undefined;
export function asteroidRelief() {
  if (relief) return relief;
  const size = 256, height = new Float32Array(size * size);
  const tau = Math.PI * 2;
  // Periodic Voronoi fracture plates: straight joints, tilted faces and tiny chips.
  const fracture = new Float32Array(size * size);
  const hash = (x: number, y: number, salt: number) => {
    const v = Math.sin(((x + 8) % 8) * 127.1 + ((y + 8) % 8) * 311.7 + salt) * 43758.5453;
    return v - Math.floor(v);
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * 8, v = y / size * 8, cx = Math.floor(u), cy = Math.floor(v);
    let first = 100, second = 100, slope = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const px = cx + dx, py = cy + dy;
      const qx = u - px - 0.2 - hash(px, py, 7) * 0.6, qy = v - py - 0.2 - hash(px, py, 19) * 0.6;
      const d = qx*qx + qy*qy;
      if (d < first) { second = first; first = d; slope = qx * (hash(px,py,31)-0.5) + qy * (hash(px,py,43)-0.5); }
      else second = Math.min(second, d);
    }
    const joint = Math.exp(-(second - first) * 65);
    const chip = Math.abs(Math.sin(x / size * tau * 27 + y / size * tau * 13));
    height[y * size + x] = slope * 0.24 - joint * 0.12 - Math.max(0, 0.035 - chip) * 0.35;
    fracture[y * size + x] = joint;
  }
  const make = () => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = size; return canvas; };
  const normalCanvas = make(), roughCanvas = make(), nc = normalCanvas.getContext('2d')!, rc = roughCanvas.getContext('2d')!;
  const ni = nc.createImageData(size, size), ri = rc.createImageData(size, size);
  const h = (x: number, y: number) => height[((y + size) % size) * size + (x + size) % size];
  const n = new T.Vector3();
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    n.set((h(x - 1, y) - h(x + 1, y)) * 12, (h(x, y - 1) - h(x, y + 1)) * 12, 1).normalize();
    const i = (y * size + x) * 4;
    ni.data[i] = (n.x * 0.5 + 0.5) * 255; ni.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
    ni.data[i + 2] = (n.z * 0.5 + 0.5) * 255; ni.data[i + 3] = 255;
    ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = 38 + fracture[y * size + x] * 162; ri.data[i + 3] = 255;
  }
  nc.putImageData(ni, 0, 0); rc.putImageData(ri, 0, 0);
  const normal = new T.CanvasTexture(normalCanvas), roughness = new T.CanvasTexture(roughCanvas);
  for (const texture of [normal, roughness]) { texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.repeat.set(2, 2); }
  return relief = { normal, roughness };
}

let environment: T.DataTexture | undefined;
export function iceEnvironment() {
  if (environment) return environment;
  const width = 256, height = 128, data = new Uint16Array(width * height * 4);
  const sun = new T.Vector3(0.4, 0.5, 0.7).normalize(), fill = new T.Vector3(-0.7, 0.2, 0.4).normalize();
  const direction = new T.Vector3();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const phi = (y + 0.5) / height * Math.PI, theta = (x + 0.5) / width * Math.PI * 2;
    direction.set(Math.sin(phi)*Math.cos(theta), Math.cos(phi), Math.sin(phi)*Math.sin(theta));
    const key = Math.exp((direction.dot(sun)-1)*170)*24;
    const rim = Math.exp((direction.dot(fill)-1)*28)*3;
    const light = 0.09 + key + rim, i = (y * width + x) * 4;
    data[i] = T.DataUtils.toHalfFloat(light);
    data[i+1] = T.DataUtils.toHalfFloat(light * 0.98);
    data[i+2] = T.DataUtils.toHalfFloat(light * 0.94);
    data[i+3] = T.DataUtils.toHalfFloat(1);
  }
  environment = new T.DataTexture(data, width, height, T.RGBAFormat, T.HalfFloatType);
  environment.mapping = T.EquirectangularReflectionMapping; environment.needsUpdate = true;
  return environment;
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
