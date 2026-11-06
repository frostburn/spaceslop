import * as T from 'three';
// Modules may keep shared materials between visits. Release their GPU resources
// and image maps on exit; the next level construction/texture pass rebinds them.
export function disposeScene(scene: T.Scene) {
  const geometries = new Set<T.BufferGeometry>();
  const materials = new Set<T.Material>();
  const textures = new Set<T.Texture>();
  scene.traverse(node => {
    if (node instanceof T.Mesh || node instanceof T.Points || node instanceof T.Line) {
      geometries.add(node.geometry);
      for (const material of [node.material].flat())
        materials.add(material);
    }
    if (node instanceof T.Light && 'shadow' in node)
      (node as T.DirectionalLight).shadow?.dispose();
  });
  for (const material of materials) {
    for (const [key, value] of Object.entries(material))
      if (value instanceof T.Texture) {
        textures.add(value);
        if (value.image instanceof HTMLImageElement)
          Reflect.set(material, key, null);
      }
    if (material instanceof T.ShaderMaterial)
      for (const uniform of Object.values(material.uniforms))
        if (uniform.value instanceof T.Texture)
          textures.add(uniform.value);
    material.dispose();
  }
  for (const g of geometries)
    g.dispose();
  for (const t of textures)
    t.dispose();
  scene.clear();
}
