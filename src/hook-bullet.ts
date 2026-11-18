import { patternBullet, type PatternColor } from './challenge-patterns';
import { HEIGHT, WIDTH } from './playfield';

type Point = { x: number; y: number };
export type HookTurn = { lead: number; remaining: number; ax: number; ay: number };
type MovingShot = Point & { vx: number; vy: number; hook?: HookTurn };

/** Fire aft around a rounded corner, then coast through the locked position. */
export function hookBullet(origin: Point, target: Point, spread: number, rise: number, speed: number, color: PatternColor) {
  const x = Math.max(-WIDTH / 2, Math.min(WIDTH / 2, origin.x + spread));
  const y = Math.min(HEIGHT / 2, origin.y + rise);
  const approach = Math.hypot(x - origin.x, y - origin.y);
  const exit = Math.hypot(target.x - x, target.y - y);
  if (Math.min(approach, exit) < 1e-6) {
    return patternBullet(origin, Math.atan2(target.x - origin.x, origin.y - target.y), speed, color);
  }
  const shot = patternBullet(origin, Math.atan2(x - origin.x, origin.y - y), speed, color);
  // Trim equally far along the two rays. Constant acceleration between those
  // points traces a quadratic Bézier tangent to both, even for a close lock.
  const trim = Math.min(approach, exit * .8);
  const remaining = 2 * trim / speed;
  const hook: HookTurn = {
    lead: (approach - trim) / speed, remaining,
    ax: ((target.x - x) * speed / exit - shot.vx) / remaining,
    ay: ((target.y - y) * speed / exit - shot.vy) / remaining,
  };
  return { ...shot, hook };
}

export function advanceHook(shot: MovingShot, hook: HookTurn, dt: number) {
  const lead = Math.min(dt, hook.lead);
  hook.lead -= lead;
  const turn = Math.min(dt - lead, hook.remaining);
  const coast = dt - lead - turn;
  shot.x += shot.vx * (lead + turn) + .5 * hook.ax * turn * turn;
  shot.y += shot.vy * (lead + turn) + .5 * hook.ay * turn * turn;
  shot.vx += hook.ax * turn;
  shot.vy += hook.ay * turn;
  shot.x += shot.vx * coast;
  shot.y += shot.vy * coast;
  hook.remaining -= turn;
  if (hook.remaining === 0) shot.hook = undefined;
}
