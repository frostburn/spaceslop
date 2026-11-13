import * as T from 'three';
import { surfaceFallback } from '../encounter-surfaces';

// Modules may keep shared materials between visits. Release their GPU resources
// and optional image maps on exit. The next flight can reuse procedural maps.
export function disposeScene(scene: T.Scene) {
  const geometries = new Set<T.BufferGeometry>();
  const materials = new Set<T.Material>();
  const textures = new Set<T.Texture>();
  const skeletons = new Set<T.Skeleton>();
  scene.traverse(node => {
    if (node instanceof T.Mesh || node instanceof T.Points || node instanceof T.Line) {
      geometries.add(node.geometry);
      for (const material of [node.material].flat())
        materials.add(material);
    } else if (node instanceof T.Sprite) {
      // Three.js owns the shared sprite quad, while the scene owns its material.
      materials.add(node.material);
    }
    if (node instanceof T.SkinnedMesh) skeletons.add(node.skeleton);
    if (node instanceof T.InstancedMesh) node.dispose();
    if (node instanceof T.DirectionalLight || node instanceof T.PointLight || node instanceof T.SpotLight)
      node.shadow.dispose();
  });
  for (const material of materials) {
    for (const [key, value] of Object.entries(material)) {
      if (!(value instanceof T.Texture)) continue;
      textures.add(value);
      const fallback = surfaceFallback(material, key);
      if (fallback) textures.add(fallback);
      if (fallback === undefined && typeof HTMLImageElement !== 'undefined' && value.image instanceof HTMLImageElement) {
        Reflect.set(material, key, null);
      }
    }
    if (material instanceof T.ShaderMaterial)
      for (const uniform of Object.values(material.uniforms))
        if (uniform.value instanceof T.Texture)
          textures.add(uniform.value);
    material.dispose();
  }
  for (const skeleton of skeletons) skeleton.dispose();
  for (const g of geometries)
    g.dispose();
  for (const t of textures)
    t.dispose();
  scene.clear();
}
