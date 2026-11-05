import * as T from 'three';
import { shipAlloy } from './encounter-surfaces';
import { HEIGHT } from './game';

export function createCorridorBridge() {
  const pieces: { x: number; y: number; z: number; width: number; height: number; color: number; angle: number }[] = [];
  function block(x: number, y: number, z: number, width: number, height: number, color: number, angle = 0) {
    pieces.push({ x, y, z, width, height, color, angle });
  }

  block(0, 0, 0, 9.65, 1.14, 0x1f232b);
  for (const side of [-1, 1]) {
    block(0, side * 0.57, 0.02, 9.42, 0.13, 0x4d413f);
    block(0, side * 0.41, 0.025, 8.54, 0.064, 0x454753);
    block(side * 4.19, 0, 0.06, 1.0, 1.47, 0x40383c);
    block(side * 4.19, 0.09, 0.12, 0.64, 0.84, 0x29272e);
    block(side * 4.23, -0.53, 0.14, 0.21, 0.09, 0xb9894e);
    for (let i = 0; i < 4; i++) block(side * (3.82 + i * 0.16), 0.54, 0.14, 0.095, 0.19, 0x877042, 0.48);
  }
  for (let i = -5; i <= 5; i++) {
    const x = i * 0.69;
    block(x, 0, 0.035, 0.63, 0.72, i % 2 ? 0x2c3037 : 0x31343a);
    for (let rung = -2; rung <= 2; rung++) block(x, rung * 0.108, 0.048, 0.58, 0.023, 0x494650);
    block(x - 0.34, 0, 0.063, 0.067, 0.86, 0x54484a);
    block(x - 0.34, i % 2 ? -0.32 : 0.32, 0.085, 0.109, 0.06, 0x74615a);
  }

  const bridge = new T.InstancedMesh(new T.BoxGeometry(1, 1, 0.06), shipAlloy(0xd0c2b7), pieces.length);
  const transform = new T.Object3D();
  const tint = new T.Color();
  for (const [index, { x, y, z, width, height, color, angle }] of pieces.entries()) {
    transform.position.set(x, y, z);
    transform.rotation.z = angle;
    transform.scale.set(width, height, 1);
    transform.updateMatrix();
    bridge.setMatrixAt(index, transform.matrix);
    bridge.setColorAt(index, tint.setHex(color));
  }
  bridge.rotation.z = -0.045;
  const neighbor = bridge.clone();
  const root = new T.Group();
  root.position.z = -1.04;
  root.add(bridge, neighbor);

  return {
    root,
    update(scroll: number, edge: number, reveal: number, perspectiveDistance?: number) {
      const fold = HEIGHT / 2 - T.MathUtils.euclideanModulo(scroll, HEIGHT);
      const handoff = T.MathUtils.smoothstep(reveal, 0.01, 0.24);
      const center = T.MathUtils.lerp(fold, (edge - 0.5) * HEIGHT, handoff);
      root.visible = reveal < 1 && Math.abs(center) < HEIGHT / 2 + 1.0;
      root.scale.setScalar(perspectiveDistance === undefined ? 1 : 1 - root.position.z / perspectiveDistance);
      bridge.position.y = center;
      // Two copies cover both ends of the viewport as the mirror joint wraps.
      neighbor.position.y = fold + (fold >= 0 ? -HEIGHT : HEIGHT);
      neighbor.visible = handoff < 0.5;
    },
  };
}
