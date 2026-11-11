import { Group } from 'three';
import { HEIGHT, WIDTH } from '../playfield';
import type { createSaucerFactory } from './saucers';

const tracks = [
  { at: 2, x: -6.0, y: 5.9, vx: .61, vy: -.23, radius: .37 },
  { at: 3.3, x: -6.0, y: 4.95, vx: .62, vy: -.24, radius: .30 },
  { at: 20, x: 6.2, y: 6.3, vx: -.66, vy: -.16, radius: .45 },
  { at: 22, x: 6.1, y: 5.5, vx: -.68, vy: -.16, radius: .34 },
  { at: 47.5, x: -6.2, y: -4.4, vx: .58, vy: .30, radius: .43 },
  { at: 49.4, x: -6.0, y: -5.2, vx: .59, vy: .31, radius: .33 },
  { at: 68.1, x: 5.8, y: 3.7, vx: -.62, vy: .20, radius: .40 },
  { at: 70.8, x: 5.7, y: 2.9, vx: -.65, vy: .21, radius: .31 },
] as const;

export function createDistantSaucers(factory: ReturnType<typeof createSaucerFactory>) {
  const root = new Group();
  const ships = tracks.map(() => factory.createDistant());
  root.add(...ships);
  return {
    root,
    update(time: number, distance: number) {
      for (const [index, track] of tracks.entries()) {
        const ship = ships[index], age = time - track.at;
        const x = track.x + track.vx * age;
        const y = track.y + track.vy * age + .17 * Math.sin(age * .88 + index);
        ship.visible = Math.abs(x) < WIDTH / 2 + .6 && Math.abs(y) < HEIGHT / 2 + .6;
        if (!ship.visible) continue;
        const depth = -46 - (index % 3) * 6, factor = 1 - depth / distance;
        ship.position.set(x * factor, y * factor, depth);
        ship.scale.setScalar(track.radius * factor);
        ship.rotation.set(.48 + .14 * Math.sin(age * .61), .18 * Math.cos(age * .83 + index), -.24 + index * .21);
      }
    },
  };
}
