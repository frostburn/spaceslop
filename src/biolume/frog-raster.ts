import * as T from 'three';
import {FROG_MOUTH_OFFSET} from './frog';

const ATLAS_SIZE = 1254;
type Crop = readonly [left: number, top: number, right: number, bottom: number];

// Use the original sheet's coordinates even when the owner resizes the PNG.
function frogCard(crop: Crop, pivotX: number, pivotY: number, pivotHeight: number, widthScale: number, depth = 0) {
  const [left, top, right, bottom] = crop;
  const heightScale = .0018;
  const geometry = new T.PlaneGeometry((right - left) * widthScale, (bottom - top) * heightScale);
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
  const body = frogCard([16, 43, 612, 585], 313, 520, .009, .0029, .012);
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
    body, closed, open, material,
    get available() { return material.map !== null; },
    setArt(map: T.Texture) { material.map = map; material.needsUpdate = true; },
    release() { material.map = null; },
  };
}
