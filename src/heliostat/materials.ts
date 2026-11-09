import * as T from 'three';
import type { HeliostatArt } from './art';
import { createThermalMaterials } from './thermal';
import { weatherHeliostatMaterial } from './weathering';

function grainMap(bump: boolean) {
  const n = 128, bytes = new Uint8Array(n * n * 4);
  const hash = (x: number, y: number) => {
    let s = Math.imul(x + 941, 374761393) ^ Math.imul(y + 73, 668265263);
    s = Math.imul(s ^ (s >>> 13), 1274126177); return ((s ^ (s >>> 16)) >>> 0) / 4294967296;
  };
  function noise(x: number, y: number, cells: number) {
    const u=x/n*cells,v=y/n*cells,ix=Math.floor(u),iy=Math.floor(v);
    const fx=u-ix,fy=v-iy,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
    const a=T.MathUtils.lerp(hash(ix%cells,iy%cells),hash((ix+1)%cells,iy%cells),sx);
    const b=T.MathUtils.lerp(hash(ix%cells,(iy+1)%cells),hash((ix+1)%cells,(iy+1)%cells),sx);
    return T.MathUtils.lerp(a,b,sy)-.5;
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const value = bump ? 128 + noise(x,y,12)*10 + noise(x,y,40)*5 + hash(x,y)*4
      : 195 + noise(x,y,4)*10 + noise(x,y,12)*6 + hash(0,y)*2 + hash(x,y)*2;
    bytes.set([value, value, value, 255], (y * n + x) * 4);
  }
  const map = new T.DataTexture(bytes, n, n);
  if (!bump) map.colorSpace = T.SRGBColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping; map.generateMipmaps = true;
  map.magFilter = T.LinearFilter; map.minFilter = T.LinearMipmapLinearFilter; map.needsUpdate = true;
  return map;
}

/** Regular lit surfaces share maps, never pictures of completed machinery. */
export function createHeliostatMaterials() {
  const grain = grainMap(false), relief = grainMap(true), owned = new Set<T.Texture>([grain, relief]);
  const thermal = createThermalMaterials();
  const make = (color: number, roughness: number, metalness: number) => new T.MeshStandardMaterial({
    color, roughness, metalness, map: grain, bumpMap: relief, bumpScale: .012, envMapIntensity: .65,
  });
  const materials = {
    titanium: make(0xb8afa0, .61, .64), copper: make(0xbe7645, .48, .78),
    dark: make(0x2b373b, .7, .42), ceramic: make(0xd7d0bd, .75, .08),
    graphite: make(0x273137, .88, .16), blue: make(0x426b76, .67, .38),
    cyan: new T.MeshStandardMaterial({ color: 0x90e9ee, emissive: 0x55dbe5, emissiveIntensity: 2.2, roughness: .4 }),
    amber: new T.MeshStandardMaterial({ color: 0xf6b35b, emissive: 0xffac38, emissiveIntensity: 2, roughness: .4 }),
    hotCoil: thermal.hotCoil, starstuff: thermal.starstuff, plasmaHalo: thermal.plasmaHalo, containmentGlass: thermal.containmentGlass,
  };
  for(const key of ['titanium','copper','dark','ceramic','graphite','blue'] as const)
    weatherHeliostatMaterial(materials[key],key==='ceramic'||key==='graphite'?0:key==='copper'?.45:.7,key==='copper');
  return {
    ...materials,
    updateThermal: thermal.updateThermal,
    setArt(art: HeliostatArt, enabled: boolean) {
      for (const key of ['heliostatMetal','heliostatCeramic'] as const) if (art[key]) owned.add(art[key]);
      for (const key of ['titanium','copper','dark','ceramic','graphite','blue'] as const) {
        const material = materials[key];
        material.map = enabled ? (key === 'ceramic' ? art.heliostatCeramic : art.heliostatMetal) ?? grain : grain;
        material.needsUpdate = true;
      }
    },
    releaseTextures() {
      // The palette owns inactive fallback maps as well as active uploaded maps.
      for (const material of Object.values(materials)) if (material instanceof T.MeshStandardMaterial) { material.map = null; material.bumpMap = null; }
      for (const texture of owned) texture.dispose(); owned.clear();
    },
  };
}
export type HeliostatMaterials = ReturnType<typeof createHeliostatMaterials>;

export function createHeliostatEnvironment() {
  const bytes = new Uint8Array(64 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 64; x++) {
    const band = Math.exp(-(((y - 17) / 5) ** 2));
    const warm = Math.exp(-(((x - 15) / 7) ** 2)), cool = Math.exp(-(((x - 48) / 10) ** 2));
    bytes.set([8 + band * (55 + warm * 110), 12 + band * (55 + warm * 60 + cool * 25),
      20 + band * (65 + cool * 65), 255], (y * 64 + x) * 4);
  }
  const texture = new T.DataTexture(bytes, 64, 32);
  texture.colorSpace = T.SRGBColorSpace; texture.mapping = T.EquirectangularReflectionMapping;
  texture.needsUpdate = true; return texture;
}
