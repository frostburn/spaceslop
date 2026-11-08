import * as T from 'three';
import { shipAlloy } from './encounter-surfaces';
import { applyTriplanar } from './rendering/triplanar';
import { preserveNoise, preserveRandom } from './preserve-layout';

// Runtime surface relief keeps this section independent of new raster assets.
// Each scene owns these small mip-filtered maps, including workshop instances.
function grain(kind: 'earth' | 'bark' | 'leaf' | 'stone') {
  const size = 128, data = new Uint8Array(size * size * 4), random = preserveRandom(781);
  const tileNoise = (x: number, y: number, period: number) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const u = T.MathUtils.smoothstep(x - ix, 0, 1), v = T.MathUtils.smoothstep(y - iy, 0, 1);
    const at = (a: number, b: number) => preserveNoise(a % period + 21, b % period + 35);
    return T.MathUtils.lerp(T.MathUtils.lerp(at(ix, iy), at(ix + 1, iy), u),
      T.MathUtils.lerp(at(ix, iy + 1), at(ix + 1, iy + 1), u), v);
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // Periodic coordinates keep the repeated relief continuous at both edges.
    const a = x / size * Math.PI * 2, b = y / size * Math.PI * 2;
    const broad = preserveNoise(5 + Math.cos(a) * 2 + Math.sin(b), 5 + Math.sin(a) * 2 + Math.cos(b));
    const fine = (random() - .5) * .016;
    const grooves = Math.sin(a * 13 + Math.sin(b) * 2 + Math.sin(a * 5)) * .055;
    const veins = Math.exp(-Math.abs(Math.sin(a)) * 24) * .09;
    // Dirt is granular, without the folded/swirl appearance of bark grain.
    const value = kind === 'stone' ? .74 + (broad - .5) * .18 + .05 * Math.sin(b * 19 + Math.sin(a * 3) * 1.2) + (random() - .5) * .08
      : kind === 'earth'
      ? .83 + (tileNoise(x / 16, y / 16, 8) - .5) * .12 + (random() - .5) * .09
      : Math.max(.52, Math.min(.98, .81 + (broad - .5) * .22 + fine + (kind === 'bark' ? grooves : veins)));
    const c = value * 255;
    data.set([c, c, c, 255], (y * size + x) * 4);
  }
  const map = new T.DataTexture(data, size, size);
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.magFilter = T.LinearFilter;
  map.minFilter = T.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.colorSpace = T.SRGBColorSpace;
  map.needsUpdate = true;
  return map;
}

export function createPreserveMaterials() {
  const earth = grain('earth'), wood = grain('bark'), leaf = grain('leaf'), stone = grain('stone');
  const soil = new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true,
    map: earth, bumpMap: earth, bumpScale: .025, roughness: .96 });
  const bark = new T.MeshStandardMaterial({ color: 0x887656, vertexColors: true,
    map: wood, bumpMap: wood, bumpScale: .045, roughness: .94 });
  const rock = applyTriplanar(new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true,
    map: stone, bumpMap: stone, bumpScale: .07, roughness: .92 }), 1.8);
  const foliage = new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true,
    map: leaf, bumpMap: leaf, bumpScale: .016, roughness: .83,
    side: T.DoubleSide, forceSinglePass: true });
  const metal = applyTriplanar(shipAlloy(0xd0c8ad), .9);
  metal.map = earth; metal.bumpMap = earth; metal.bumpScale = .13; metal.roughness = .86;
  const dark = new T.MeshStandardMaterial({ color: 0x182322, roughness: .94 });
  const glass = new T.MeshStandardMaterial({ color: 0xa4b8a7, transparent: true,
    opacity: .15, metalness: .25, roughness: .24, side: T.DoubleSide, depthWrite: false });
  const water = new T.MeshStandardMaterial({ color: 0x33534e, roughness: .26,
    metalness: .15, bumpMap: earth, bumpScale: .025 });
  const lamp = new T.MeshBasicMaterial({ color: 0xffd39a });
  const fluorescent = new T.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const uvGlow = new T.MeshBasicMaterial({ color: 0xff219e, transparent: true, opacity: .12, depthWrite: false, toneMapped: false });
  return { soil, bark, rock, foliage, metal, dark, glass, water, lamp, fluorescent, uvGlow };
}
export type PreserveMaterials = ReturnType<typeof createPreserveMaterials>;
