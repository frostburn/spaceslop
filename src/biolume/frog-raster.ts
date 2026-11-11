import * as T from 'three';
import {FROG_MOUTH_OFFSET} from './frog';

const ATLAS_SIZE = 1254;
type Crop = readonly [left: number, top: number, right: number, bottom: number];

// Use the original sheet's coordinates even when the owner resizes the PNG.
function frogCard(crop: Crop, pivotX: number, pivotY: number, pivotHeight: number, widthScale: number, depth = 0, segments = 1) {
  const [left, top, right, bottom] = crop;
  const heightScale = .0018;
  const geometry = new T.PlaneGeometry((right - left) * widthScale, (bottom - top) * heightScale, segments, segments);
  geometry.translate(((left + right) / 2 - pivotX) * widthScale, pivotHeight + (pivotY - (top + bottom) / 2) * heightScale, depth);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (left + uv.getX(i) * (right - left)) / ATLAS_SIZE, 1 - (bottom - uv.getY(i) * (bottom - top)) / ATLAS_SIZE);
  }
  return geometry;
}

export function createFrogAtlas() {
  // The closed and open heads share their neck and eyes. Their reference rows
  // are 628 pixels apart. The open mouth at row 1110 meets the tongue origin.
  const closed = frogCard([775, 101, 1108, 492], 940, 482, -FROG_MOUTH_OFFSET, .00255);
  const open = frogCard([775, 729, 1108, 1163], 940, 1110, -FROG_MOUTH_OFFSET, .00255);
  const material = new T.MeshStandardMaterial({alphaTest: .35, roughness: .72, side: T.DoubleSide});
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      #ifdef USE_MAP
        vec3 tissue = texture2D(map, vMapUv).rgb;
        float gland = smoothstep(.045, .22, min(tissue.g, tissue.b) - tissue.r * 1.25);
        totalEmissiveRadiance += tissue * (.32 + 2.8 * gland);
      #endif`);
  };
  material.customProgramCacheKey = () => 'grove-frog-atlas-v1';
  return {
    closed, open, material,
    get available() { return material.map !== null; },
    setArt(map: T.Texture) { material.map = map; material.needsUpdate = true; },
    release() { material.map = null; },
  };
}

export function createFrogRasterBody(material: T.MeshStandardMaterial) {
  const neckHeight = .009;
  const geometry = frogCard([16, 43, 612, 585], 313, 520, neckHeight, .0029, .012, 24);
  const positions = geometry.attributes.position as T.BufferAttribute;
  positions.setUsage(T.DynamicDrawUsage);
  const rest = positions.clone();
  const forefeet = new Float32Array(rest.count);
  const hindfeet = new Float32Array(rest.count);
  const belly = new Float32Array(rest.count);
  const {smoothstep} = T.MathUtils;
  for (let i = 0; i < rest.count; i++) {
    const x = Math.abs(rest.getX(i));
    const y = rest.getY(i);
    const flank = smoothstep(x, .27, .63);
    // The toe pads sit below the forelimbs and midway down the hind legs.
    forefeet[i] = flank * (1 - smoothstep(y, -.065, .22));
    hindfeet[i] = flank * smoothstep(y, .1, .32) * (1 - smoothstep(y, .41, .65));
    belly[i] = smoothstep(y, .035, .32) * (1 - smoothstep(x, .28, .6));
  }
  geometry.computeBoundingBox();
  geometry.boundingBox!.expandByScalar(.28);
  geometry.computeBoundingSphere();
  geometry.boundingSphere!.radius += .28;
  const mesh = new T.Mesh(geometry, material);
  mesh.name = 'frog-raster-body';

  function pose(age: number, forefootLag: number, hindfootLag: number) {
    const breath = Math.sin(age * 2.1);
    const foreSin = Math.sin(forefootLag), foreCos = Math.cos(forefootLag) - 1;
    const hindSin = Math.sin(hindfootLag), hindCos = Math.cos(hindfootLag) - 1;
    for (let i = 0; i < rest.count; i++) {
      const x = rest.getX(i), y = rest.getY(i);
      const front = forefeet[i], back = hindfeet[i];
      // Feet lag the heading through their ankles, while the torso expands
      // around its neck attachment and leaves the mouth in place.
      positions.setXY(i,
        x * (1 + .028 * breath * belly[i]) + front * (foreCos * x - foreSin * y) + back * (hindCos * x - hindSin * y),
        y + (y - neckHeight) * .018 * breath * belly[i] + front * (foreSin * x + foreCos * y) + back * (hindSin * x + hindCos * y));
    }
    positions.needsUpdate = true;
  }
  return {mesh, pose};
}
