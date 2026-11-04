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

export function applyRelief(texture: T.Texture, materials: readonly T.MeshStandardMaterial[]) {
  for (const material of materials) {
    material.map = texture;
    material.bumpMap = texture;
    material.needsUpdate = true;
  }
}
