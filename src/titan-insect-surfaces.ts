import * as T from 'three';
import { applyRelief } from './encounter-surfaces';

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

export function createTitanChitinSurface() {
  const fallback = fallbackChitin();
  let map: T.Texture = fallback;
  const materials: T.MeshStandardMaterial[] = [];
  return {
    material(color: number, roughness = .67, metalness = .09) {
      const material = new T.MeshStandardMaterial({ color, roughness, metalness, map: fallback, bumpMap: fallback, bumpScale: .018 });
      if (map !== fallback) applyRelief(map, [material]);
      materials.push(material);
      return material;
    },
    setTexture(texture: T.Texture) {
      texture.wrapS = texture.wrapT = T.RepeatWrapping;
      texture.anisotropy = 4;
      map = texture;
      applyRelief(texture, materials);
      function release() {
        texture.removeEventListener('dispose', release);
        if (map === texture) map = fallback;
      }
      texture.addEventListener('dispose', release);
    },
  };
}
const defaultChitin = createTitanChitinSurface();
export const titanChitin = defaultChitin.material;
export const setTitanChitinTexture = defaultChitin.setTexture;

// Short tapered bristles are opaque modeled geometry, not soft fur billboards.
// Each species shares its bristle buffer across all patches and pool entries.
const stubbleMaterials = [0x7d8270,0x9e8c69,0x74654c].map(color=>new T.MeshStandardMaterial({color,roughness:.94,side:T.DoubleSide}));
const stubbleGeometry = [0,1,2].map(kind=>{
  const rng=random(3981+kind), vertices:number[]=[];
  for(let i=0;i<(kind===0?48:110);i++){
    const angle=rng()*Math.PI*2,r=Math.sqrt(rng())*.38,x=Math.cos(angle)*r,y=Math.sin(angle)*r;
    const length=.04+rng()*.06,width=.004+rng()*.003;
    const dx=Math.cos(angle)*.04+(rng()-.5)*.07,dy=Math.sin(angle)*.04+(rng()-.5)*.07;
    vertices.push(x-width,y,0,x+width,y,0,x+dx,y+dy,length,
      x,y-width,0,x,y+width,0,x+dx,y+dy,length);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();g.computeBoundingBox();return g;
});
export function addTitanSetae(parent:T.Object3D,x:number,y:number,z:number,width:number,height:number,kind=1){
  const patch=new T.Mesh(stubbleGeometry[kind],stubbleMaterials[kind]);patch.name='coarse-setae-patch';
  patch.position.set(x,y,z);patch.scale.set(width,height,Math.min(width,height));parent.add(patch);return patch;
}

function compoundSurface() {
  const size = 96, data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / 6, v = y / 6;
    const base = Math.floor(v);
    let distance = 1;
    for (let row = base - 1; row <= base + 1; row++) {
      const s = u - (row & 1) * .5;
      distance = Math.min(distance, Math.hypot(s - Math.round(s), (v - row) * .866));
    }
    const tone = 222 - 44 * T.MathUtils.smoothstep(distance, .32, .59);
    data.set([tone, tone, tone, 255], (y * size + x) * 4);
  }
  const texture = filteredTexture(data, size, size);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  return texture;
}

const facets = compoundSurface();
export function cicadaEye(color: number, relief: number) {
  return new T.MeshPhysicalMaterial({
    color, roughness: .49, clearcoat: .22, clearcoatRoughness: .44,
    map: facets, bumpMap: facets, bumpScale: relief,
  });
}

// A sequence of lapped plates on one closed abdomen. The shallow grooves
// separate adjacent plates while the overall profile tapers toward the tip.
export function cicadaAbdomen(length: number, width: number, depth: number, plates: number) {
  const outline = [new T.Vector2(0, -length)];
  for (let plate = 0; plate < plates; plate++) {
    for (const [offset, ridge] of [[.03, .88], [.22, 1], [.66, 1], [.87, .98], [.99, .86]]) {
      const t = (plate + offset) / plates;
      const taper = Math.sin(t * Math.PI * .48) ** .65;
      outline.push(new T.Vector2(width * taper * ridge, (t - 1) * length));
    }
  }
  outline.push(new T.Vector2(width * .88, 0), new T.Vector2(0, .016 * length));
  return new T.LatheGeometry(outline, 32).scale(1, 1, depth / width);
}
