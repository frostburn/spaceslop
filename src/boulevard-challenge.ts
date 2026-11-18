import { bossPatternCharge, patternBearing, patternBullet, stepPatternBurst, type BossPattern } from './challenge-patterns';
import { HAULER_LENGTH_SCALE, HOVERCAR_EXHAUST_Y, turnBoulevardTurret, type BoulevardCourse } from './boulevard';
import { hookBullet } from './hook-bullet';
import { mineBurst } from './boulevard-mines';
import { wingRewardForWave } from './wing';

type Point = { x: number; y: number };
type Driver = Point & Parameters<typeof stepPatternBurst>[0] & { heading?: number; interceptorHeading?: number; lane: number };
type Patrol = readonly [time: number, formation: BoulevardCourse['formation'], lanes: readonly number[], mirror: number, heavy?: boolean];

const patrols: readonly Patrol[] = [
  [1.2, 'chevron', [-2.5, -.85, .85, 2.5], 1], [4.7, 'cross', [-2.25, 2.25, -2.25, 2.25], -1],
  [8.15, 'train', [0, 0, 0, 0], 1], [11.65, 'rush', [-.9, .9], -1, true],
  [15.2, 'intercept', [-2.1, 2.1], -1], [18.55, 'chevron', [-2.45, -.8, .8, 2.45], 1],
  [22.05, 'cross', [2.2, -2.2, 2.2, -2.2], 1], [25.5, 'train', [0, 0, 0, 0], -1],
  [28.95, 'rush', [-1.35, 1.35], 1, true], [32.4, 'intercept', [-2.25, 2.25], 1],
  [35.95, 'chevron', [-2.5, -1.25, 0, 1.25, 2.5], -1], [39.5, 'cross', [-2.4, 2.4, -2.4, 2.4], -1],
  [43, 'rush', [-.75, .75], 1, true], [46.45, 'chevron', [-2.5, -.9, .9, 2.5], 1],
  [49.9, 'intercept', [2.2, -2.2, 2.2], -1], [53.35, 'train', [0, 0, 0, 0, 0], 1],
  [56.95, 'cross', [2.3, -2.3, 2.3, -2.3], 1], [60.35, 'rush', [-1.35, 1.35], -1, true],
  [63.85, 'chevron', [-2.45, -.8, .8, 2.45], -1], [67.3, 'intercept', [-2.2, 2.2, -2.2], 1],
  [70.8, 'train', [0, 0, 0, 0], -1], [74.25, 'cross', [-2.4, 2.4, -2.4, 2.4], -1],
  [77.75, 'rush', [-1.25, 1.25], 1, true], [81.2, 'chevron', [-2.5, -1.25, 0, 1.25, 2.5], 1],
  [84.7, 'intercept', [2.2, -2.2, 2.2], -1], [88.15, 'train', [0, 0, 0, 0, 0], 1],
  [91.65, 'chevron', [-2.55, -.85, .85, 2.55], -1], [95.05, 'rush', [-1.25, 1.25], 1, true],
];
const drops = ['homing', 'cannon', 'laser', 'omega'] as const;
export const boulevardChallengeWaves = patrols.map(([time, formation, lanes, mirror, heavy], index) => ({
  time, lanes, boulevard: { formation, mirror, heavy }, drop: wingRewardForWave(drops, index),
}));

export const BOULEVARD_CHALLENGE_PACE = 1.20;
const patrolFire = { windup: .68, rows: 4, spacing: .215, rest: 3.55 };
const chevronFire = { ...patrolFire, rows: 5 };
const heavyFire = { windup: .84, rows: 5, spacing: .205, rest: 3.8 };
const interceptorFire = { windup: .72, rows: 5, spacing: .178, rest: 3.4 };

export function boulevardChallengeTiming(course: BoulevardCourse) {
  return course.formation === 'intercept' ? interceptorFire : course.heavy ? heavyFire
    : course.formation === 'chevron' ? chevronFire : patrolFire;
}

export function boulevardChallengeFirstShot(course: BoulevardCourse) {
  if (course.formation === 'intercept') return 1.9 + course.slot * .69;
  if (course.formation === 'cross') return 1.7 + course.slot * .68;
  if (course.formation === 'train') return 1.72 + course.slot * .65;
  if (course.heavy) return 1.92 + course.slot * .46;
  return 1.64 + .22 * Math.abs(course.slot - 1.5);
}

export function stepBoulevardChallengeDriver(enemy: Driver, course: BoulevardCourse, player: Point, time: number, dt: number) {
  const heading = enemy.heading ?? 0;
  const interceptor = course.formation === 'intercept';
  const nose = interceptor ? .28 : course.heavy ? .98 : .75;
  const origin = { x: enemy.x + nose * Math.sin(heading), y: enemy.y - nose * Math.cos(heading) };
  const visible = enemy.y < 7.8 && Math.abs(origin.x) < 4.3 && origin.y > Math.max(-2.25, player.y + 2.65);
  const timing = boulevardChallengeTiming(course);
  // Nearby patrols steer their rows around the same stretch of road.
  const opening = { x: 1.35 * Math.sin(time * .36) + player.x * .14, y: -6.2 };
  const burst = stepPatternBurst(enemy, course.heavy ? player : opening, visible, timing);
  if (course.heavy) {
    if (!burst) return;
    const tail = HOVERCAR_EXHAUST_Y * HAULER_LENGTH_SCALE;
    const jet = { x: enemy.x - tail * Math.sin(heading), y: enemy.y + tail * Math.cos(heading) };
    return [-1, 1].flatMap(side => {
      const shots = [
        hookBullet(jet, burst.target, side * 2.9, 1.8, 4.35, 'accent'),
        hookBullet(jet, burst.target, side * 1.35, 1.55, 5.15, 'primary'),
        patternBullet(jet, side * 1.45, 4.65, 'accent'),
      ];
      if (burst.row % 2 === 0) shots.push(patternBullet(jet, side * 1.77, 4.15, 'accent'));
      return shots;
    });
  }
  const target = burst?.target ?? enemy.burst?.target ?? opening;
  const row = burst?.row ?? enemy.burst?.row ?? 0;
  const sweep = row / (timing.rows - 1) * 2 - 1;
  const gap = target.x + course.mirror * .39 * sweep;
  if (interceptor) {
    const x = gap + Math.sign(enemy.lane) * (2.52 + .42 * sweep);
    const aim = patternBearing(origin, { x, y: target.y }, .82);
    const turn = enemy.interceptorHeading = turnBoulevardTurret(enemy.interceptorHeading ?? Math.PI - heading, Math.PI - aim, dt);
    if (!burst) return;
    const bearing = Math.PI - turn, sin = Math.sin(bearing), cos = Math.cos(bearing);
    return [-1, 1].flatMap(side => {
      const muzzle = { x: origin.x + .56 * sin + side * .25 * cos, y: origin.y - .56 * cos + side * .25 * sin };
      return [-.085, 0, .085].map(spread => patternBullet(muzzle, bearing + spread + side * .035,
        5.18 + .16 * side, side < 0 ? 'primary' : 'accent'));
    });
  }
  if (!burst) return;

  const lanes = [-3, -2, -1, 1, 2, 3];
  const slotOffset = .18 * Math.sin(course.slot * 1.4);
  return lanes.map(lane => {
    const side = Math.sign(lane), distance = Math.abs(lane) - 1;
    const x = gap + side * (1.53 + distance * .62 + slotOffset);
    const angle = Math.atan2(x - origin.x, origin.y - target.y);
    return patternBullet(origin, angle, 5.47 - distance * .21 + side * .1, side === course.mirror ? 'accent' : 'primary');
  });
}

export function boulevardChallengeMineBurst(x: number, y: number) {
  return [
    ...mineBurst(x, y, 10, 3.8).map(shot => ({ ...shot, planar: true as const, pattern: 'primary' as const })),
    ...mineBurst(x, y, 10, 2.95, Math.PI / 10).map(shot => ({ ...shot, planar: true as const, pattern: 'accent' as const })),
  ];
}

export const boulevardChallengeBoss = { health: 244, interval: 5.3, lockAt: .45,
  first: 1.22, spacing: .165, rows: 16 } satisfies BossPattern & { health: number };
const firstVentRows = 6, secondVentRow = 9;
const ventPattern = { ...boulevardChallengeBoss, relockRows: [firstVentRows] };
const secondVent = { ...ventPattern, lockAt: ventPattern.first + firstVentRows * ventPattern.spacing,
  first: ventPattern.first + secondVentRow * ventPattern.spacing };

export function boulevardUsesVents(cycle: number) { return cycle % 3 === 1; }
export function boulevardBossPattern(cycle: number) { return boulevardUsesVents(cycle) ? ventPattern : boulevardChallengeBoss; }

export function boulevardVentCharge(elapsed: number) {
  return Math.max(bossPatternCharge(elapsed, ventPattern, firstVentRows),
    bossPatternCharge(elapsed, secondVent, ventPattern.rows - secondVentRow));
}

export function boulevardVentRow(left: Point, right: Point, target: Point, row: number) {
  const second = row >= secondVentRow;
  if (!second && row >= firstVentRows) return [];
  const shots = [];
  for (const side of [-1, 1]) {
    const vent = side < 0 ? left : right;
    const color = side < 0 ? 'primary' : 'accent';
    // The first pair swings outside the wings. The reply crosses over the roof.
    const direction = second ? -side : side;
    shots.push(hookBullet(vent, target, direction * 3.95, 3.35, 4.8, color));
    shots.push(hookBullet(vent, target, direction * 2.1, 1.55, 5.5, color));
  }
  return shots;
}

export function boulevardChallengeBossRow(muzzles: readonly [Point, Point], target: Point, cycle: number, row: number) {
  const crossing = cycle % 3 === 2, reverse = Math.floor(cycle / 3) % 2 === 0 ? 1 : -1;
  const phase = row / (boulevardChallengeBoss.rows - 1);
  const gap = target.x * .25 + reverse * (phase * 2 - 1) * (crossing ? 1.5 : 1.8);
  const height = Math.max(-5.55, Math.min(-3.8, target.y));
  const shots = [];
  for (const emitter of [0, 1] as const) {
    const side = (emitter === 0 ? -1 : 1) * (crossing ? -1 : 1);
    const origin = muzzles[emitter];
    for (let lane = 0; lane < 11; lane++) {
      const beat = Math.cos(lane * .65 - phase * 9.5 + emitter * 1.2);
      const x = gap + side * (1.28 + lane * .49 + (row % 2) * .16 + .16 * beat);
      const angle = Math.atan2(x - origin.x, origin.y - height + .5 * beat);
      const speed = 5.15 + .76 * beat + (crossing && lane % 2 ? -.32 : 0) + side * reverse * .12;
      shots.push(patternBullet(origin, angle, speed, emitter === 0 ? 'primary' : 'accent'));
    }
  }
  return shots;
}
