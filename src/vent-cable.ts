import * as T from 'three';
import { ioNoise } from './io-layout';
import { applyTriplanar } from './rendering/triplanar';
import { ventFloor } from './vent-layout';

function tileNoise(u: number, v: number, cells: number, seed: number) {
  const x = u * cells, y = v * cells, ix = Math.floor(x), iy = Math.floor(y);
  const blendX = T.MathUtils.smoothstep(x - ix, 0, 1), blendY = T.MathUtils.smoothstep(y - iy, 0, 1);
  const sample = (dx: number, dy: number) => ioNoise(seed + (ix + dx) % cells, seed * 2 + (iy + dy) % cells);
  const a = T.MathUtils.lerp(sample(0, 0), sample(1, 0), blendX);
  const b = T.MathUtils.lerp(sample(0, 1), sample(1, 1), blendX);
  return T.MathUtils.lerp(a, b, blendY);
}

function cableResidue() {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + .5) / size, v = (y + .5) / size;
    const deposit = .66 * tileNoise(u, v, 5, 7) + .34 * tileNoise(u, v, 11, 13);
    const silt = T.MathUtils.smoothstep(deposit, .23, .72);
    const oxide = T.MathUtils.smoothstep(tileNoise(u, v, 19, 29), .48, .76);
    const grit = (tileNoise(u, v, 57, 53) - .5) * 29;
    pixels.set([
      226 - 62 * silt - 30 * oxide + grit,
      235 - 107 * silt - 56 * oxide + grit,
      233 - 112 * silt - 62 * oxide + grit,
      255,
    ], (y * size + x) * 4);
  }
  const texture = new T.DataTexture(pixels, size, size);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createVentCable() {
  const root = new T.Group();
  root.name = 'europa-survey-cable';
  function path(y: number) {
    const x = -1.65 + .72 * Math.sin(y * .092) + .31 * Math.sin(y * .183);
    return new T.Vector3(x, y, ventFloor(x, y) + .39);
  }
  const curve = new T.CatmullRomCurve3(Array.from({ length: 67 }, (_, i) => path(-18 + i * 2.5)));
  // Use seabed coordinates for both the tube and the instanced housings so
  // residue stays put and continues across the edges of the boxes.
  const residue = cableResidue();
  const insulation = applyTriplanar(new T.MeshStandardMaterial({
    color: 0x627c7e, map: residue, bumpMap: residue, bumpScale: .035,
    roughness: .96, emissive: 0x142a2b, emissiveIntensity: .12,
  }), .42);
  root.add(new T.Mesh(new T.TubeGeometry(curve, 192, .13, 8), insulation));

  const stations = [-8, 9, 28, 46, 64, 83, 99, 117, 134, 147];
  const housing = applyTriplanar(new T.MeshStandardMaterial({
    color: 0xa18362, map: residue, bumpMap: residue, bumpScale: .055, roughness: .94, metalness: .12,
  }), .68);
  const junctions = new T.InstancedMesh(new T.BoxGeometry(.72, 1.10, .44),
    housing, stations.length);
  const lamps = new T.InstancedMesh(new T.BoxGeometry(.22, .36, .06),
    new T.MeshBasicMaterial({ color: 0x84c8cb }), stations.length);
  const placement = new T.Object3D();
  for (const [index, y] of stations.entries()) {
    const direction = path(y + .5).sub(path(y - .5));
    const terminal = index === stations.length - 1;
    placement.position.copy(path(y));
    placement.rotation.z = -Math.atan2(direction.x, direction.y);
    placement.scale.set(terminal ? 1.65 : 1, terminal ? 1.4 : 1, 1);
    placement.updateMatrix();
    junctions.setMatrixAt(index, placement.matrix);
    placement.position.z += .25;
    placement.updateMatrix();
    lamps.setMatrixAt(index, placement.matrix);
  }
  root.add(junctions, lamps);
  return root;
}
