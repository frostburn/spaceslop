import * as T from 'three';

export function createFonsEnvironment(tunnel: T.Mesh, rocks: readonly T.Mesh[]) {
  const target = new T.WebGLRenderTarget(216, 384);
  target.texture.name = 'fons-reflected-surroundings';
  const scene = new T.Scene();
  // Share the live tunnel and rock materials without ever drawing the mirror
  // into its own target. This also keeps combat graphics out of the capture.
  const copies = rocks.map(rock => rock.clone());
  const key = new T.DirectionalLight(0xb4d3ff, 3.25);
  key.position.set(-5, 7, 8);
  scene.add(tunnel.clone(), ...copies, key, new T.HemisphereLight(0xe9d9ff, 0x4e385d, 1.5));
  let priming = false;

  return {
    texture: target.texture,
    prime() { priming = true; },
    capture(renderer: T.WebGLRenderer, camera: T.Camera, active: boolean) {
      if (!active && !priming) return;
      priming = false;
      for (const [index, copy] of copies.entries()) {
        const source = rocks[index];
        copy.visible = source.visible;
        copy.position.copy(source.position);
        copy.quaternion.copy(source.quaternion);
        copy.scale.copy(source.scale);
      }
      const previous = renderer.getRenderTarget();
      try {
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
      } finally {
        renderer.setRenderTarget(previous);
      }
    },
    dispose() {
      target.dispose();
      scene.clear();
    },
  };
}
