import * as T from 'three';
import { shipBurners } from '../burners';
import { HEIGHT, WIDTH } from '../playfield';

export function wormholeReflectionPose(x: number, y: number, axisY: number) {
  const sideClearance = WIDTH / 2 - Math.abs(x);
  const endClearance = HEIGHT / 2 - Math.abs(y);
  const side = 1 - T.MathUtils.smoothstep(sideClearance, .58, 1.54);
  const end = 1 - T.MathUtils.smoothstep(endClearance, 1.02, 2.0);
  const strength = Math.max(side, end);
  if (strength === 0) return;

  // Blend the wall normals in the corners so a continuous drag never switches
  // between two separate mirrors. Foreshorten the image towards the horizon.
  const norm = Math.hypot(side, end);
  const nx = Math.sign(x) * side / norm, ny = Math.sign(y) * end / norm;
  const clearance = (side * sideClearance + end * endClearance) / (side + end);
  const reach = .09 + .64 * clearance;
  const along = .14 * (x * ny + (axisY - y) * nx);
  const marginX = WIDTH / 2 - .29, marginY = HEIGHT / 2 - .41;
  return {
    x: T.MathUtils.clamp(x + nx * reach - ny * along, -marginX, marginX) / (HEIGHT / 2),
    y: T.MathUtils.clamp(y + ny * reach + nx * along, -marginY, marginY) / (HEIGHT / 2),
    nx, ny, strength,
  };
}

export type WormholeReflectionPose = ReturnType<typeof wormholeReflectionPose>;

export function createWormholeReflection(fighter: T.Group) {
  const target = new T.WebGLRenderTarget(160, 160);
  target.texture.name = 'wormhole-fighter-reflection';
  const scene = new T.Scene();
  const image = fighter.clone();
  const sourceJets = shipBurners(fighter), imageJets = shipBurners(image);
  const light = new T.DirectionalLight(0xc5ecff, 2.65);
  light.position.set(-3, 4, 7);
  scene.add(image, light, new T.HemisphereLight(0xb7d3ff, 0x66639c, 2));
  const camera = new T.OrthographicCamera(-1.35, 1.35, 1.35, -1.35, .1, 30);
  const clear = new T.Color();
  let priming = false;

  return {
    texture: target.texture,
    prime() { priming = true; },
    capture(renderer: T.WebGLRenderer, pose: WormholeReflectionPose) {
      if (!pose && !priming) return;
      priming = false;
      // The proxy shares the live hull materials and geometry. Its isolated
      // camera sees the wall-facing side of the ship and its moving exhaust.
      image.quaternion.copy(fighter.quaternion);
      image.scale.copy(fighter.scale);
      for (const [i, jet] of imageJets.entries()) jet.scale.copy(sourceJets[i].scale);
      camera.position.set((pose?.nx ?? 1) * 4.5, (pose?.ny ?? 0) * 4.5 + 1.8, 12);
      camera.lookAt(0, 0, 0);
      const previous = renderer.getRenderTarget();
      const alpha = renderer.getClearAlpha();
      renderer.getClearColor(clear);
      try {
        renderer.setRenderTarget(target);
        renderer.setClearColor(0, 0);
        renderer.render(scene, camera);
      } finally {
        renderer.setRenderTarget(previous);
        renderer.setClearColor(clear, alpha);
      }
    },
    dispose() {
      target.dispose();
      scene.clear();
    },
  };
}
