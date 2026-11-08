import * as T from 'three';

// Cool grow-light fill and a grazing UV-colored rim. Shared with the inspector;
// the world supplies the stronger overhead source and its broad shadow.
export const preserveLighting = {
  key: 0xe8f7ff, sky: 0xdce9ee, ground: 0x34343d,
  keyIntensity: .55, skyIntensity: 1.3, uv: 0xff219e, uvIntensity: 3.2,
};

export function createPreserveUv() {
  const light = new T.DirectionalLight(preserveLighting.uv, preserveLighting.uvIntensity);
  light.name = 'preserve-uv-rim';
  light.position.set(20, 18, 4); light.target.position.set(0, 12, 0);
  // Rim illumination has no second shadow map or moving fine-detail raster.
  return light;
}

export function softenPreserveShadows(root: T.Object3D) {
  root.traverse(o => {
    if (o instanceof T.InstancedMesh && /crowns|feather|plumage|hackles/.test(o.name))
      o.castShadow = false;
  });
}
