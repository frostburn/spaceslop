type Point = { x: number; y: number };
export type PatternColor = 'primary' | 'accent';

export const PATTERN_HIT_RADIUS = .30;
export const PATTERN_GRAZE_RADIUS = .66;
export const PATTERN_BULLET_CAPACITY = 512;

type AttackClock = {
  age: number;
  fire: number;
  burst?: { target: Point; row: number };
};

type BurstTiming = { windup: number; rows: number; spacing: number; rest: number };

// Fire is the next emission on the attacker's clock. Keep the aim fixed for
// every row of a burst, and start a new windup if the attacker leaves view.
export function stepPatternBurst(enemy: AttackClock, target: Point, visible: boolean, timing: BurstTiming) {
  if (!visible) {
    enemy.fire = Math.max(enemy.fire, enemy.age + timing.windup);
    enemy.burst = undefined;
    return;
  }
  if (!enemy.burst && enemy.age < enemy.fire - timing.windup) return;
  const burst = enemy.burst ??= { target: { ...target }, row: 0 };
  if (enemy.age < enemy.fire) return;

  const row = burst.row++;
  if (burst.row === timing.rows) {
    enemy.fire = enemy.age + timing.rest;
    enemy.burst = undefined;
  } else enemy.fire += timing.spacing;
  return { target: burst.target, row };
}

export function patternBurstCharge(enemy: AttackClock, windup: number) {
  if (!enemy.burst) return 0;
  if (enemy.burst.row > 0) return .7;
  return Math.max(0, Math.min(1, 1 + (enemy.age - enemy.fire) / windup));
}

export function patternBearing(origin: Point, target: Point, limit: number) {
  const angle = Math.atan2(target.x - origin.x, origin.y - target.y);
  return Math.max(-limit, Math.min(limit, angle));
}

export function patternBullet(origin: Point, angle: number, speed: number, pattern: PatternColor) {
  return { ...origin, z: 0, vx: Math.sin(angle) * speed, vy: -Math.cos(angle) * speed, vz: 0, planar: true as const, pattern };
}

export type BossPattern = {
  interval: number;
  lockAt: number;
  first: number;
  spacing: number;
  rows: number;
  exposedRows?: number;
};

export function bossPatternCharge(elapsed: number, timing: BossPattern, rows: number) {
  const sinceFirst = elapsed - timing.first;
  if (sinceFirst < 0) return Math.max(0, (elapsed - timing.lockAt) / (timing.first - timing.lockAt));
  const tail = sinceFirst - (rows - 1) * timing.spacing;
  if (tail > 0) return Math.max(0, 1 - tail / .17);
  return .68 + .32 * Math.cos(Math.PI * sinceFirst / timing.spacing) ** 2;
}
