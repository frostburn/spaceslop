import * as T from 'three';

// Three nearest asteroid surfaces, each with a depth and stable body ID. Captures
// use the sky-only ice shader; the final pass can look past itself and foreground
// objects without recursive framebuffer feedback. No actors enter these buffers.
export function iceRefraction(batchPrefix = 'ice-rocks-') {
  const layers = Array.from({ length: 3 }, () => new T.WebGLRenderTarget(1, 1, {
    type: T.HalfFloatType, minFilter: T.NearestFilter, magFilter: T.NearestFilter,
    depthTexture: new T.DepthTexture(1, 1, T.UnsignedIntType),
  }));
  const empty = new T.DataTexture(new Uint8Array(4), 1, 1); empty.needsUpdate = true;
  const uniforms = { captureLayer: { value: 0 }, previousBody0: { value: empty as T.Texture }, previousBody1: { value: empty as T.Texture },
    layerColor0: { value: layers[0].texture }, layerDepth0: { value: layers[0].depthTexture as T.Texture },
    layerColor1: { value: layers[1].texture }, layerDepth1: { value: layers[1].depthTexture as T.Texture },
    layerColor2: { value: layers[2].texture }, layerDepth2: { value: layers[2].depthTexture as T.Texture } };
  const scene = new T.Scene(); scene.matrixAutoUpdate = false;
  const key = new T.DirectionalLight(0xb9e8ff, 2.7); key.position.set(3, 5, 6);
  scene.add(key, new T.HemisphereLight(0xd6e3ff, 0x514873, 1.75));
  const size = new T.Vector2(), clear = new T.Color();
  let decorations: T.Object3D[] | undefined;
  const visible: boolean[] = [];
  return { uniforms, empty, capture(renderer: T.WebGLRenderer, camera: T.Camera, root: T.Group, field: T.Group) {
    if (!root.visible || !root.parent) return;
    renderer.getDrawingBufferSize(size);
    // Bound mobile fill cost; all bodies remain instanced in six shared batches.
    const scale = Math.min(0.5, 512 / size.y), width = Math.max(1, Math.round(size.x * scale)), height = Math.max(1, Math.round(size.y * scale));
    for (const layer of layers) if (layer.width !== width || layer.height !== height) layer.setSize(width, height);
    decorations ??= [ ...field.children.filter(child => !child.name.startsWith(batchPrefix)), ...root.children.filter(child => child !== field) ];
    decorations.forEach((child, i) => { visible[i] = child.visible; child.visible = false; });
    const parent = root.parent, target = renderer.getRenderTarget(), alpha = renderer.getClearAlpha();
    const scissor = renderer.getScissorTest(); renderer.getClearColor(clear);
    parent.updateWorldMatrix(true, false); scene.matrix.copy(parent.matrixWorld); scene.matrixWorldNeedsUpdate = true; scene.add(root);
    try {
      renderer.setScissorTest(false); renderer.setClearColor(0, 0);
      // Detach every output texture from sampler uniforms even in untaken shader
      // branches: WebGL forbids read/write feedback on an attached framebuffer.
      uniforms.layerColor0.value = uniforms.layerColor1.value = uniforms.layerColor2.value = empty;
      uniforms.layerDepth0.value = uniforms.layerDepth1.value = uniforms.layerDepth2.value = empty;
      for (let i = 0; i < layers.length; i++) {
        uniforms.captureLayer.value = i + 1;
        uniforms.previousBody0.value = i > 0 ? layers[0].texture : empty;
        uniforms.previousBody1.value = i > 1 ? layers[1].texture : empty;
        renderer.setRenderTarget(layers[i]); renderer.render(scene, camera);
      }
    } finally {
      uniforms.captureLayer.value = 0;
      uniforms.previousBody0.value = uniforms.previousBody1.value = empty;
      uniforms.layerColor0.value = layers[0].texture; uniforms.layerColor1.value = layers[1].texture; uniforms.layerColor2.value = layers[2].texture;
      uniforms.layerDepth0.value = layers[0].depthTexture!; uniforms.layerDepth1.value = layers[1].depthTexture!; uniforms.layerDepth2.value = layers[2].depthTexture!;
      parent.add(root);
      decorations.forEach((child, i) => { child.visible = visible[i]; });
      renderer.setRenderTarget(target); renderer.setClearColor(clear, alpha); renderer.setScissorTest(scissor);
    }
  } };
}

export const iceLayerSampling = `
  uniform float captureLayer;
  uniform sampler2D previousBody0, previousBody1;
  uniform sampler2D layerColor0, layerColor1, layerColor2, layerDepth0, layerDepth1, layerDepth2;
  varying float vRockId;
  bool behindIce(sampler2D colorMap, sampler2D depthMap, vec2 uv, out vec3 color) {
    vec4 sampleColor = texture2D(colorMap, uv);
    float depth = texture2D(depthMap, uv).r;
    color = sampleColor.rgb;
    return sampleColor.a > 0.0 && abs(sampleColor.a-vRockId) > 0.001
      && depth > gl_FragCoord.z + 0.000002;
  }
  vec3 iceBehind(vec2 uv) {
    vec3 color;
    if (captureLayer < 0.5 && all(greaterThanEqual(uv,vec2(0.0))) && all(lessThanEqual(uv,vec2(1.0)))) {
      if (behindIce(layerColor0,layerDepth0,uv,color)) return color;
      if (behindIce(layerColor1,layerDepth1,uv,color)) return color;
      if (behindIce(layerColor2,layerDepth2,uv,color)) return color;
    }
    return galaxyAt(uv);
  }`;
