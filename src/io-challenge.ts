import { CRUCIBLE_MUZZLE_Y, CRUCIBLE_WINDUP } from './io-crucible';
import type { IoWave } from './io-layout';
import { wingRewardForWave } from './wing';

type Point = { x: number; y: number };
type Attacker = Point & { age: number; fire: number; lockedAim?: Point };

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

export const ioChallengeSkipper = { pace: 1.62, windup: .60, interval: 1.94, speed: 7.1 };
export const ioChallengeCrucible = { first: 1.72, interval: 2.42, speed: 5.8 };

export function ioChallengeSkipperFirstShot(slot: number) {
  return 1.28 + slot * .34;
}

function readyToFire(attacker: Attacker, origin: Point, player: Point, windup: number, visible: boolean) {
  if (!visible || origin.y < player.y + 1.65) {
    attacker.fire = Math.max(attacker.fire, attacker.age + windup);
    attacker.lockedAim = undefined;
    return;
  }
  if (attacker.age < attacker.fire - windup) return;
  attacker.lockedAim ??= { ...player };
  if (attacker.age >= attacker.fire) return attacker.lockedAim;
}

function fan(angle: number, speed: number, spread: readonly number[]) {
  return spread.map(offset => {
    const direction = angle + offset;
    return { vx: Math.sin(direction) * speed, vy: -Math.cos(direction) * speed };
  });
}

function bearing(origin: Point, target: Point) {
  return Math.atan2(target.x - origin.x, origin.y - target.y);
}

const skipperFan = [-.38, -.19, 0, .19, .38];
const skipperSplit = [-.36, -.12, .12, .36];
export function stepIoChallengeSkipper(enemy: Attacker, slot: number, player: Point) {
  const origin = { x: enemy.x, y: enemy.y - .58 };
  const { windup, interval, speed } = ioChallengeSkipper;
  const target = readyToFire(enemy, origin, player, windup, enemy.y < 7.1);
  if (!target) return;
  enemy.fire = enemy.age + interval;
  enemy.lockedAim = undefined;
  const spread = slot % 2 === 0 ? skipperFan : skipperSplit;
  return fan(bearing(origin, target), speed, spread)
    .map(velocity => ({ ...origin, ...velocity, z: 0, vz: 0, planar: true }));
}

const slagSpread = [-.58, -.31, 0, .31, .58];
export function stepIoChallengeCrucible(enemy: Attacker, player: Point) {
  const origin = { x: enemy.x, y: enemy.y + CRUCIBLE_MUZZLE_Y };
  const target = readyToFire(enemy, origin, player, CRUCIBLE_WINDUP, Math.abs(enemy.x) < 4);
  if (!target) return;
  enemy.fire = enemy.age + ioChallengeCrucible.interval;
  enemy.lockedAim = undefined;
  return fan(bearing(origin, target), ioChallengeCrucible.speed, slagSpread)
    .map(slag => ({ ...origin, slag }));
}

export const ioChallengeBoss = { health: 132, supportHealth: 32, interval: 2.35, lockAt: .32 };
const wheelVolleys = [
  { at: .78, speed: 7.25, spread: [-.72, -.54, -.36, -.18, 0, .18, .36, .54, .72] },
  { at: 1.20, speed: 7.75, spread: [-.83, -.67, -.51, -.35, -.19, .19, .35, .51, .67, .83] },
  { at: 1.66, speed: 8.15, spread: [-.56, -.40, -.24, -.08, .08, .24, .40, .56] },
] as const;

export function calderaChallengeWindup(time: number, broken: boolean) {
  const elapsed = time % ioChallengeBoss.interval;
  const count = broken ? wheelVolleys.length : 2;
  for (let index = 0; index < count; index++) {
    const { at } = wheelVolleys[index];
    const start = index === 0 ? ioChallengeBoss.lockAt : at - .24;
    if (elapsed >= start && elapsed < at) return (elapsed - start) / (at - start);
    if (elapsed >= at && elapsed < at + .15) return 1 - (elapsed - at) / .15;
  }
  return 0;
}

export function calderaChallengeVolleys(time: number, dt: number, broken: boolean) {
  const cycle = Math.floor(time / ioChallengeBoss.interval);
  const elapsed = time - cycle * ioChallengeBoss.interval;
  return wheelVolleys.slice(0, broken ? 3 : 2).flatMap((volley, index) => {
    if (elapsed < volley.at || elapsed - dt >= volley.at) return [];
    const turn = (cycle % 2 === 0 ? 1 : -1) * (index === 1 ? -.14 : index === 2 ? .19 : 0);
    return [{ ...volley, turn }];
  });
}

export function calderaChallengeFan(origin: Point, target: Point, volley: ReturnType<typeof calderaChallengeVolleys>[number]) {
  const angle = bearing(origin, target) + volley.turn;
  return fan(angle, volley.speed, volley.spread)
    .map(velocity => ({ ...origin, ...velocity, z: 0, vz: 0, planar: true }));
}
