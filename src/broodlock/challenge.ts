import { antScales, type AntKind } from '../ant-navigation';
import type { WingWeapon } from '../wing';

type Point = { x: number; y: number };
type Ant = Point & { age: number; fire: number; sporeTarget?: Point };
type HiveWave = { time: number; lanes: number[]; ant: AntKind; drop?: WingWeapon };

export const challengeWaves: readonly HiveWave[] = [
  { time: .65, lanes: [-2.65, 0, 2.65], ant: 'worker', drop: 'cannon' },
  { time: 2.9, lanes: [-1.7, 1.7], ant: 'soldier', drop: 'cannon' },
  { time: 5.35, lanes: [-2.8, -.75, 1.6], ant: 'worker', drop: 'cannon' },
  { time: 8.05, lanes: [-1.8, .35, 2.8], ant: 'worker', drop: 'cannon' },
  { time: 10.65, lanes: [-2.5, 1.25], ant: 'soldier', drop: 'cannon' },
  { time: 13.4, lanes: [-2.7, 0, 2.6], ant: 'worker', drop: 'cannon' },
  { time: 16.15, lanes: [-2.25, .05, 2.3], ant: 'soldier', drop: 'cannon' },
  { time: 18.95, lanes: [-2.7, -.7, 1.55], ant: 'worker', drop: 'homing' },
  { time: 21.6, lanes: [-1.2, 2.15], ant: 'soldier', drop: 'homing' },
  { time: 24, lanes: [-2.65, 0, 2.65], ant: 'soldier', drop: 'laser' },
];

export const CHALLENGE_ANT_PACE = 1.75;
export const CHALLENGE_ANT_WINDUP = .46;
const antPatterns = {
  worker: { first: .92, interval: 1.36, speed: 6.3, spread: [-.19, 0, .19] },
  soldier: { first: 1.12, interval: 1.27, speed: 6.65, spread: [-.42, -.21, 0, .21, .42] },
};

export function challengeAntFirstShot(kind: AntKind, slot: number) {
  return antPatterns[kind].first + slot * .24;
}

function sporeFan(origin: Point, aim: number, speed: number, spread: readonly number[]) {
  return spread.map(offset => {
    const angle = aim + offset;
    return { ...origin, z: 0, vx: Math.sin(angle) * speed, vy: -Math.cos(angle) * speed, vz: 0, planar: true };
  });
}

export function stepChallengeAnt(ant: Ant, kind: AntKind, player: Point) {
  const origin = { x: ant.x, y: ant.y - .55 * antScales[kind] };
  if (ant.y > 6.9 || origin.y < player.y + 1.65) {
    ant.fire = Math.max(ant.fire, ant.age + CHALLENGE_ANT_WINDUP);
    ant.sporeTarget = undefined;
    return;
  }
  if (ant.age < ant.fire - CHALLENGE_ANT_WINDUP) return;
  ant.sporeTarget ??= { ...player };
  if (ant.age < ant.fire) return;
  const { interval, speed, spread } = antPatterns[kind];
  const aim = Math.atan2(ant.sporeTarget.x - origin.x, origin.y - ant.sporeTarget.y);
  const shots = sporeFan(origin, aim, speed, spread);
  ant.sporeTarget = undefined;
  ant.fire = ant.age + interval;
  return shots;
}

export const challengeGuardian = { health: 96, interval: 1.64, windup: .33, fire: .88, echo: 1.22 };
const sweep = [-.54, -.36, -.18, 0, .18, .36, .54];
const split = [-.68, -.50, -.32, -.18, .18, .32, .50, .68];
const echo = [-.44, -.22, 0, .22, .44];

export function challengeGuardianVolley(origin: Point, target: Point, cycle: number, followup: boolean) {
  const aim = Math.atan2(target.x - origin.x, origin.y - target.y);
  if (followup) return sporeFan(origin, aim + (cycle % 2 === 0 ? .11 : -.11), 7.3, echo);
  return sporeFan(origin, aim, 6.8, cycle % 2 === 0 ? sweep : split);
}
