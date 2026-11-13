import * as T from 'three';

export function texturedSurface(material: T.MeshStandardMaterial, midpoint: number, contrast: number) {
  material.onBeforeCompile = (shader) => {
    const map = T.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;', `
      vec3 grain = clamp(vec3(0.9) + (sampledDiffuseColor.rgb - ${midpoint.toFixed(3)}) * ${contrast.toFixed(2)}, 0.30, 1.35);
      diffuseColor.rgb *= grain;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', map);
  };
  material.customProgramCacheKey = () => `encounter-grain/${midpoint}/${contrast}`;
  return material;
}

export function hide(color: number, vertexColors = false) {
  return texturedSurface(new T.MeshStandardMaterial({
    color, vertexColors, roughness: 0.69, bumpScale: 0.92,
  }), 0.49, 4.1);
}

type SurfaceMaterial = T.Material & { map: T.Texture | null; bumpMap?: T.Texture | null };
const surfaceFallbacks = new WeakMap<T.Material, Partial<Record<'map' | 'bumpMap', T.Texture | null>>>();

// Some level and boss rigs share a palette. Restore every binding when its
// upload is released, including materials outside the current scene.
export function applySurfaceMap(texture: T.Texture, materials: readonly SurfaceMaterial[], relief = false) {
  for (const material of materials) {
    const fallbacks = surfaceFallbacks.get(material) ?? {};
    if (fallbacks.map === undefined) fallbacks.map = material.map;
    material.map = texture;
    if (relief) {
      if (fallbacks.bumpMap === undefined) fallbacks.bumpMap = material.bumpMap ?? null;
      material.bumpMap = texture;
    }
    surfaceFallbacks.set(material, fallbacks);
    material.needsUpdate = true;
  }
  function release() {
    texture.removeEventListener('dispose', release);
    for (const material of materials) {
      if (material.map !== texture && material.bumpMap !== texture) continue;
      const fallbacks = surfaceFallbacks.get(material);
      if (material.map === texture) material.map = fallbacks?.map ?? null;
      if (material.bumpMap === texture) material.bumpMap = fallbacks?.bumpMap ?? null;
      material.needsUpdate = true;
    }
  }
  texture.addEventListener('dispose', release);
}

export function surfaceFallback(material: T.Material, slot: string) {
  const fallbacks = surfaceFallbacks.get(material);
  if (slot === 'map') return fallbacks?.map;
  if (slot === 'bumpMap') return fallbacks?.bumpMap;
}

export function applyRelief(texture: T.Texture, materials: readonly T.MeshStandardMaterial[]) {
  applySurfaceMap(texture, materials, true);
}

export function shipAlloy(color: number) {
  const material = texturedSurface(new T.MeshStandardMaterial({
    color, metalness: 0.16, roughness: 0.53, flatShading: true, bumpScale: 0.56,
  }), 0.37, 7.5);
  material.userData.shipAlloy = true;
  return material;
}

export function textureShipAlloy(texture: T.Texture, rigs: readonly T.Group[]) {
  const materials = new Set<T.MeshStandardMaterial>();
  for (const rig of rigs) {
    rig.traverse((node) => {
      if (node instanceof T.Mesh && node.material instanceof T.MeshStandardMaterial && node.material.userData.shipAlloy) {
        materials.add(node.material);
      }
    });
  }
  applyRelief(texture, [...materials]);
}
