import type { PatternColor } from './challenge-patterns';
import { BOSS_CAMERA_DISTANCE } from './playfield';

type Point3 = { x: number; y: number; z: number };
const activeDepth = 1.75;

export type DepthArc = {
  origin: Point3;
  approach: number;
  duration: number;
  delay: number;
  localX: number;
  localY: number;
  angle: number;
  spin: number;
  driftX: number;
  driftY: number;
  bend: number;
  x: number;
  y: number;
};

function footprint(arc: DepthArc, age: number) {
  // Stagger the launches while keeping live pellets on the same ring clock.
  const t = (age + arc.delay) / arc.duration;
  const angle = arc.angle + arc.spin * t;
  const localX = arc.localX * (1 + .32 * t), localY = arc.localY * (1 + .32 * t);
  return {
    x: arc.x + arc.driftX * t + localX * Math.cos(angle) - localY * Math.sin(angle),
    y: arc.y + arc.driftY * t + localX * Math.sin(angle) + localY * Math.cos(angle),
  };
}

export function depthArcPoint(arc: DepthArc, age: number) {
  // Use projected flight coordinates to keep the opening registered with the fighter.
  const { x, y } = footprint(arc, age);
  if (age >= arc.approach) {
    const fore = (age - arc.approach) / arc.duration;
    return { x, y, z: activeDepth + 2.5 * fore * (2 - fore) };
  }

  const u = age / arc.approach;
  const start = footprint(arc, 0);
  const bend = Math.sin(Math.PI * u) ** 2;
  const ease = (1 - u) ** 2;
  const projection = BOSS_CAMERA_DISTANCE / (BOSS_CAMERA_DISTANCE - arc.origin.z);
  return {
    x: x + (arc.origin.x * projection - start.x) * ease + arc.bend * bend,
    y: y + (arc.origin.y * projection - start.y) * ease + 1.1 * bend,
    z: arc.origin.z + (activeDepth - arc.origin.z) * u * u * (3 - 2 * u),
  };
}

export type DepthBullet = Point3 & {
  vx: number;
  vy: number;
  vz: number;
  pattern: PatternColor;
  planar: true;
  arc: DepthArc;
  age: number;
};

export function depthBullet(arc: DepthArc, pattern: PatternColor): DepthBullet {
  return { ...depthArcPoint(arc, 0), vx: 0, vy: 0, vz: 0, age: 0, arc, pattern, planar: true };
}
