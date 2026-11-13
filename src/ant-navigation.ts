import type { HiveCollision, HullCircle } from './hive-collision';
import { HEIGHT, WIDTH } from './playfield';
import { HIVE_SCREENS } from './hive-layout';

export type AntKind = 'worker' | 'soldier';
export const antScales = { worker: 0.8, soldier: 1.03 } as const;
export const antSpeeds = { worker: 2.25, soldier: 1.7 } as const;
const silhouette: readonly HullCircle[] = [
  { x: 0, y: -0.93, radius: 0.5 }, { x: 0, y: -0.35, radius: 0.4 },
  { x: 0, y: 0.59, radius: 0.47 }, { x: -0.51, y: 0.18, radius: 0.49 }, { x: 0.51, y: 0.18, radius: 0.49 },
];
function hull(kind: AntKind, margin: number) {
  return silhouette.map(({ x, y, radius }) => ({ x: x * antScales[kind], y: y * antScales[kind],
    radius: radius * antScales[kind] + margin }));
}
export const antHulls = { worker: hull('worker', 0), soldier: hull('soldier', 0) };
const clearance = { worker: hull('worker', 0.075), soldier: hull('soldier', 0.075) };
const ANT_BOUNDS = { minX: -WIDTH / 2 + 1.05, maxX: WIDTH / 2 - 1.05, minY: -10.5, maxY: 10.5 };
type NavigatingAnt = { x: number; y: number; lane: number; age: number; ant?: AntKind;
  course?: number; courseAt?: number; heading?: number };
const probe = { x: 0, y: 0 };
const clamp = (x: number, low: number, high: number) => Math.max(low, Math.min(high, x));

export function steerHiveAnt(ant: NavigatingAnt, scenery: HiveCollision, duration: number, dt: number, pace = 1) {
  const kind = ant.ant ?? 'worker', speed = antSpeeds[kind] * pace;
  const lateralSpeed = (kind === 'soldier' ? 2.3 : 2.7) * pace;
  const preferred = ant.lane + Math.sin(ant.age * pace * 1.55) * 0.46;
  if (ant.course === undefined || ant.age >= (ant.courseAt ?? 0)) {
    const lookahead = 1.25;
    const scrollSpeed = HEIGHT * (HIVE_SCREENS - 1) / duration;
    const relativeSpeed = Math.max(0.35, speed - scrollSpeed);
    let best = 0, bestScore = Infinity;
    for (const offset of [0, -0.65, 0.65, -1.3, 1.3, -2, 2, -3.4, 3.4]) {
      const target = clamp(preferred + offset, ANT_BOUNDS.minX, ANT_BOUNDS.maxX);
      const reach = clamp(target - ant.x, -lateralSpeed * lookahead, lateralSpeed * lookahead);
      let score = Math.abs(target - preferred) * 0.65 + Math.abs(target - ant.x) * 0.15 +
        Math.abs(target - (ant.course ?? preferred)) * 0.35;
      for (let i = 1; i <= 4; i++) {
        const t = i / 4;
        probe.x = ant.x + reach * t;
        probe.y = ant.y - relativeSpeed * lookahead * t;
        if (scenery.overlaps(probe, clearance[kind])) score += 20 + i * 3;
      }
      if (score < bestScore) { best = target; bestScore = score; }
    }
    ant.course = best;
    ant.courseAt = ant.age + 0.15;
  }
  const beforeX = ant.x, beforeY = ant.y;
  const dx = clamp(ant.course - ant.x, -lateralSpeed * dt, lateralSpeed * dt);
  const blocked = scenery.move(ant, dx, -speed * dt, antHulls[kind], ANT_BOUNDS);
  if (blocked) ant.courseAt = 0;
  const heading = clamp(-Math.atan2(ant.x - beforeX, Math.max(0.01, beforeY - ant.y)), -0.24, 0.24);
  ant.heading = (ant.heading ?? 0) + (heading - (ant.heading ?? 0)) * (1 - Math.exp(-8 * dt));
}
