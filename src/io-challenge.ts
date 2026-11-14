import { CRUCIBLE_MUZZLE_Y, CRUCIBLE_WINDUP } from './io-crucible';
import { patternBearing, patternBullet, stepPatternBurst, type BossPattern } from './challenge-patterns';
import type { IoWave } from './io-layout';
import { wingRewardForWave } from './wing';

type Point = { x: number; y: number };
type Skipper = Point & Parameters<typeof stepPatternBurst>[0];
type Crucible = Point & { age: number; fire: number; lockedAim?: Point };

// Stagger patrols against the alternating Crucible crossings, leaving the rim clear.
const patrols = [
  [.7, [-2.5, -.45, 2]], [3.8, [-1.7, .4, 2.5]], [7.1, [-2.6, -.9, .9, 2.6]],
  [10.4, [-2.2, -.7, .8]], [13.5, [-.8, .8, 2.4]], [16.6, [-2.6, -1.3, .2, 1.9]],
  [20.3, [-2.1, .2, 2.4]], [23.2, [-2.5, -.9, .9, 2.5]], [26.3, [-1.6, 0, 1.7]],
  [29.4, [-2.4, -1, .45, 2]], [32.7, [-1.6, .2, 1.9]], [36, [-2.1, -.55, .95, 2.55]],
  [39.4, [-2.6, -1.15, .45, 2.1]], [42.5, [-1.5, .1, 1.7]], [45.7, [-2.2, -.7, 1.0, 2.55]],
  [49.2, [-2.65, -1.05, .4, 1.8]], [52.4, [-1.8, -.25, 1.2, 2.6]], [55.4, [-2.45, 0, 2.45]],
  [58.7, [-2.6, -.95, .75, 2.5]], [62.1, [-2.3, -.8, .7, 2.25]], [65.1, [-1.7, 0, 1.8]],
  [68.4, [-2.5, -1.25, .15, 1.75]], [71.5, [-1.9, -.35, 1.1, 2.6]], [74.8, [-2.5, -.85, .85, 2.5]],
  [78, [-2.6, -1.05, .5, 2.1]], [81.2, [-1.95, -.35, 1.05, 2.45]], [84.4, [-2.6, -.8, .95, 2.6]],
  [87.6, [-2.35, -.85, .7, 2.3]], [90.7, [-2.55, -1.25, 0, 1.25, 2.55]],
] as const;
const drops = ['cannon', 'homing', 'laser', 'omega'] as const;
const carrierTimes = [8.6, 17.9, 27.7, 37.3, 46.9, 56.9, 66.4, 75.9, 85.6];

export const ioChallengeWaves: readonly IoWave[] = [
  ...patrols.map(([time, lanes], index) => ({ time, lanes: [...lanes], drop: wingRewardForWave(drops, index), skipper: true })),
  ...carrierTimes.map((time, index) => ({ time, lanes: [index % 2 === 0 ? 1 : -1], drop: drops[index % drops.length], crucible: true })),
].sort((a, b) => a.time - b.time);

export const ioChallengeSkipper = { pace: 1.32, windup: .78, rows: 3, spacing: .29, rest: 2.9, speed: 4.8 };
export const ioChallengeCrucible = { first: 1.95, interval: 2.85, speed: 4.7 };

export function ioChallengeSkipperFirstShot(slot: number) {
  return 1.48 + slot * .45;
}

export function stepIoChallengeSkipper(enemy: Skipper, slot: number) {
  const origin = { x: enemy.x, y: enemy.y - .58 };
  const timing = ioChallengeSkipper;
  const burst = stepPatternBurst(enemy, enemy, enemy.y < 7.1 && origin.y > -1, timing);
  if (!burst) return;
  const mirror = slot % 2 === 0 ? 1 : -1;
  const aim = patternBearing(origin, { x: burst.target.x * .68, y: -5.1 }, .34) + (burst.row - 1) * mirror * .24;
  return [-.37, -.13, .13, .37].map(offset => patternBullet(origin, aim + offset, timing.speed,
    burst.row === 1 ? 'accent' : 'primary'));
}

const slagSpread = [-.66, -.42, -.21, .21, .42, .66];
export function stepIoChallengeCrucible(enemy: Crucible, player: Point) {
  const origin = { x: enemy.x, y: enemy.y + CRUCIBLE_MUZZLE_Y };
  if (Math.abs(enemy.x) >= 4 || origin.y < player.y + 2.5) {
    enemy.fire = Math.max(enemy.fire, enemy.age + CRUCIBLE_WINDUP);
    enemy.lockedAim = undefined;
    return;
  }
  if (enemy.age < enemy.fire - CRUCIBLE_WINDUP) return;
  enemy.lockedAim ??= { ...player };
  if (enemy.age < enemy.fire) return;
  const aim = patternBearing(origin, enemy.lockedAim, .32);
  enemy.fire = enemy.age + ioChallengeCrucible.interval;
  enemy.lockedAim = undefined;
  const speed = ioChallengeCrucible.speed;
  return slagSpread.map(offset => ({ ...origin, slag: { vx: Math.sin(aim + offset) * speed, vy: -Math.cos(aim + offset) * speed } }));
}

export const ioChallengeBoss = { health: 132, supportHealth: 32, interval: 4.3, lockAt: .4,
  first: 1.05, spacing: .20, rows: 9, exposedRows: 13 } satisfies BossPattern & { health: number; supportHealth: number };

const curtainY = -4.8;
export function calderaChallengeRow(origin: Point, target: Point, cycle: number, row: number) {
  const mirror = cycle % 2 === 0 ? 1 : -1;
  const gap = Math.max(-2.05, Math.min(2.05, target.x * .3 + mirror * (1.32 * Math.sin(row * .28 - 1.1))));
  const shift = row % 2 === 0 ? 0 : .32;
  const shots = [];
  for (let column = -8; column <= 8; column++) {
    const x = .64 * column + shift;
    if (Math.abs(x - gap) < .92) continue;
    // Lay out the curtain at a fixed height so the moving wheel cannot close its gap.
    const angle = Math.atan2(x - origin.x, origin.y - curtainY);
    shots.push(patternBullet(origin, angle, 5.15, row % 2 === 0 ? 'primary' : 'accent'));
  }
  return shots;
}
