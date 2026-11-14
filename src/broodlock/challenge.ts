import { antScales, type AntKind } from '../ant-navigation';
import { patternBearing, patternBullet, stepPatternBurst, type BossPattern } from '../challenge-patterns';
import type { WingWeapon } from '../wing';

type Point = { x: number; y: number };
type Ant = Point & Parameters<typeof stepPatternBurst>[0];
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

export const CHALLENGE_ANT_PACE = 1.38;
export const CHALLENGE_ANT_WINDUP = .68;
const antPatterns = {
  worker: { first: 1.24, windup: CHALLENGE_ANT_WINDUP, rows: 3, spacing: .24, rest: 2.95, speed: 4.45, spread: [-.27, 0, .27] },
  soldier: { first: 1.48, windup: CHALLENGE_ANT_WINDUP, rows: 4, spacing: .22, rest: 3.25, speed: 4.6, spread: [-.47, -.29, .29, .47] },
};

export function challengeAntFirstShot(kind: AntKind, slot: number) {
  return antPatterns[kind].first + slot * .34;
}

export function stepChallengeAnt(ant: Ant, kind: AntKind, slot: number) {
  const origin = { x: ant.x, y: ant.y - .55 * antScales[kind] };
  const timing = antPatterns[kind];
  const burst = stepPatternBurst(ant, ant, ant.y <= 6.9 && origin.y > -1, timing);
  if (!burst) return;
  const spread = timing.spread;
  const mirror = slot % 2 === 0 ? 1 : -1;
  const sweep = (burst.row - (timing.rows - 1) / 2) * mirror * .13;
  const aim = patternBearing(origin, { x: burst.target.x * .52, y: -5.2 }, .36) + sweep;
  return spread.map(offset => patternBullet(origin, aim + offset, timing.speed, kind === 'worker' ? 'primary' : 'accent'));
}

export const challengeGuardian = { health: 96, interval: 3.8, lockAt: .38, first: 1.04, spacing: .19, rows: 8 } satisfies BossPattern & { health: number };
const petalAngles = [-.91, -.76, -.58, -.42, -.26, .26, .42, .58, .76, .91];

export function challengeGuardianVolley(origin: Point, target: Point, cycle: number, row: number) {
  const mirror = cycle % 2 === 0 ? 1 : -1;
  const sweep = Math.sin((row / (challengeGuardian.rows - 1) - .5) * Math.PI) * .31 * mirror;
  const aim = patternBearing(origin, target, .23) * .7 + sweep;
  return petalAngles.map(offset => {
    const inner = Math.abs(offset) <= .42;
    return patternBullet(origin, aim + offset, inner ? 4.8 : 4.1, inner ? 'accent' : 'primary');
  });
}
