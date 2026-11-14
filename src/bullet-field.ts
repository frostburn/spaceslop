import type { PatternColor } from './challenge-patterns';
import { HEIGHT, WIDTH } from './playfield';

type Point = { x: number; y: number };
type Landing = Point & { column: number };

export const FIELD_ROWS = 19;
const columns = 12;
const fillTime = .34, holdTime = .78, fadeTime = .45;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export function fieldRow(row: number) {
  return Array.from({ length: columns }, (_, column): Landing => {
    const x = (column - (columns - 1) / 2) * (WIDTH - .84) / columns;
    const y = (row - (FIELD_ROWS - 1) / 2) * (HEIGHT - 1.4) / FIELD_ROWS;
    return {
      column,
      x: x + (row % 2 ? .14 : -.14) + .10 * Math.sin(row * .64 + column * .4),
      y: y + .12 * Math.sin(column * .57 + row * .24),
    };
  });
}

export type BulletLanding = {
  origin: Point;
  point: Point;
  travel: number;
  fillAt: number;
};

export function fieldBullet(origin: Point, point: Point, delay: number, wave: number, pattern: PatternColor) {
  const travel = .18 + Math.min(1, Math.hypot(point.x - origin.x, point.y - origin.y) / HEIGHT) * .26;
  // The whole field lands before the fill starts. The small offset sweeps the fill across it.
  const field: BulletLanding = { origin, point, travel, fillAt: 1.77 + .24 * wave - delay };
  return { ...origin, z: 0, vx: 0, vy: 0, vz: 0, planar: true as const, pattern, field, age: 0 };
}

export function fieldBulletPhase(field: BulletLanding, age: number) {
  const fill = clamp01((age - field.fillAt) / fillTime);
  const fade = clamp01((age - field.fillAt - fillTime - holdTime) / fadeTime);
  return {
    fill,
    opacity: (.5 + .5 * clamp01(age / field.travel)) * (1 - fade),
    live: fill === 1 && fade === 0,
  };
}

export function fieldBulletPoint(field: BulletLanding, age: number) {
  const t = clamp01(age / field.travel);
  if (t === 1) return field.point;
  const flight = 1 - (1 - t) ** 2;
  return {
    x: field.origin.x + (field.point.x - field.origin.x) * flight,
    y: field.origin.y + (field.point.y - field.origin.y) * flight,
  };
}
