import { antScales, type AntKind } from '../ant-navigation';
import { patternBearing, patternBullet, rippleRow, stepPatternBurst, type BossPattern } from '../challenge-patterns';
import { hookBullet } from '../hook-bullet';
import type { WingWeapon } from '../wing';

type Point = { x: number; y: number };
type Ant = Point & Parameters<typeof stepPatternBurst>[0] & { heading?: number };
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
  worker: { first: 1.24, windup: CHALLENGE_ANT_WINDUP, rows: 3, spacing: .24, rest: 2.95, speed: 4.45 },
  soldier: { first: 1.48, windup: CHALLENGE_ANT_WINDUP, rows: 4, spacing: .22, rest: 3.25, speed: 4.6 },
};

export function challengeAntFirstShot(kind: AntKind, slot: number) {
  return antPatterns[kind].first + slot * .34;
}

export function stepChallengeAnt(ant: Ant, kind: AntKind, slot: number, player: Point) {
  const origin = { x: ant.x, y: ant.y - .55 * antScales[kind] };
  const timing = antPatterns[kind];
  const soldier = kind === 'soldier';
  const burst = stepPatternBurst(ant, soldier ? player : ant, ant.y <= 6.9 && origin.y > -1, timing);
  if (!burst) return;
  if (soldier) {
    const heading = ant.heading ?? 0;
    const rear = { x: ant.x - .72 * Math.sin(heading), y: ant.y + .72 * Math.cos(heading) };
    return [-1, 1].map(side => hookBullet(rear, burst.target, side * 2.35, 1.65, timing.speed, 'accent'));
  }
  const mirror = slot % 2 === 0 ? 1 : -1;
  const sweep = (burst.row - (timing.rows - 1) / 2) * mirror * .13;
  const aim = patternBearing(origin, { x: burst.target.x * .52, y: -5.2 }, .36) + sweep;
  return [-.27, 0, .27].map(offset => patternBullet(origin, aim + offset, timing.speed, 'primary'));
}

export const challengeGuardian = { health: 96, interval: 3.8, lockAt: .38, first: 1.04, spacing: .19, rows: 8 } satisfies BossPattern & { health: number };
const petalAngles = [-.91, -.76, -.58, -.42, -.26, .26, .42, .58, .76, .91];

export function challengeGuardianVolley(origin: Point, target: Point, cycle: number, row: number) {
  const phase = row / (challengeGuardian.rows - 1) * 2 * Math.PI;
  const aim = patternBearing(origin, target, .23) * .53;
  if (cycle % 2) return rippleRow(origin, aim, -1, row, 12, 4.12, .66);
  return petalAngles.map(offset => {
    const inner = Math.abs(offset) <= .42;
    const side = Math.sign(offset), tip = Math.abs(offset);
    const flare = .14 * Math.sin(phase + tip * 3 + side);
    const speed = (inner ? 4.6 : 4.05) + .83 * Math.sin(phase - tip * 3 + side);
    return patternBullet(origin, aim + offset + flare, speed, inner ? 'accent' : 'primary');
  });
}
