import { bossPatternCharge, patternBullet, stepPatternBurst, type BossPattern } from '../challenge-patterns';
import { wingRewardForWave } from '../wing';
import { groveCanAttack, groveEnemySize, groveWaves, type GroveCourse } from './combat';

type Point = { x: number; y: number };
type Glider = Point & Parameters<typeof stepPatternBurst>[0] & { heading?: number; lane: number };
type AerialWave = readonly [time: number, kind: Exclude<GroveCourse['kind'], 'frog'>,
  formation: GroveCourse['formation'], lanes: readonly number[], mirror: number];

const aerial: readonly AerialWave[] = [
  [1.4, 'glider', 'weave', [-2.4, -.8, .8, 2.4], 1], [4.8, 'skimmer', 'sweep', [-2, -1, 0, 1, 2], -1],
  [8.2, 'sentry', 'weave', [-2.35, 2.35], -1], [11.65, 'glider', 'train', [0, 0, 0, 0, 0], 1],
  [15.1, 'skimmer', 'weave', [-2.6, -1.3, 0, 1.3, 2.6], 1], [18.6, 'glider', 'sweep', [-2, -1, 0, 1, 2], 1],
  [22.1, 'sentry', 'weave', [-2.6, .6], -1], [25.5, 'glider', 'train', [0, 0, 0, 0], -1],
  [28.95, 'skimmer', 'sweep', [-2, -1, 0, 1, 2], -1], [32.45, 'glider', 'weave', [-2.5, -.85, .85, 2.5], 1],
  [35.85, 'sentry', 'weave', [-2.35, 2.35], 1], [39.25, 'skimmer', 'weave', [-2.6, -1.3, 0, 1.3, 2.6], -1],
  [42.7, 'glider', 'train', [0, 0, 0, 0, 0], -1], [46.05, 'skimmer', 'sweep', [-2, -1, 0, 1, 2], 1],
  [49.5, 'sentry', 'weave', [-2.55, 0, 2.55], -1], [53, 'glider', 'weave', [-2.55, -1.25, 0, 1.25, 2.55], 1],
  [56.45, 'skimmer', 'sweep', [-2, -1, 0, 1, 2], -1], [59.9, 'glider', 'train', [0, 0, 0, 0, 0], 1],
  [63.35, 'sentry', 'weave', [-.6, 2.6], 1], [66.75, 'glider', 'sweep', [-2, -1, 0, 1, 2], 1],
  [70.2, 'skimmer', 'weave', [-2.5, -1.25, 0, 1.25, 2.5], 1], [73.6, 'glider', 'train', [0, 0, 0, 0, 0], -1],
  [77.05, 'sentry', 'weave', [-2.5, 0, 2.5], -1], [80.45, 'skimmer', 'sweep', [-2, -1, 0, 1, 2], 1],
  [83.9, 'glider', 'weave', [-2.55, -1.3, 0, 1.3, 2.55], -1], [87.4, 'sentry', 'weave', [-2.35, 2.35], 1],
  [90.9, 'glider', 'train', [0, 0, 0, 0, 0], -1], [93.9, 'skimmer', 'weave', [-2.55, -1.25, 0, 1.25, 2.55], 1],
];
const drops = ['homing', 'cannon', 'laser', 'omega'] as const;
export const groveChallengeWaves = [
  ...aerial.map(([time, kind, formation, lanes, mirror], index) => ({
    time, lanes, grove: { kind, formation, mirror }, drop: wingRewardForWave(drops, index),
  })),
  ...groveWaves.filter(wave => wave.grove.kind === 'frog'),
].sort((a, b) => a.time - b.time);

export const GROVE_CHALLENGE_PACE = 1.19;
const gliderFire = { windup: .62, rows: 4, spacing: .205, rest: 3.65 };
const skimmerFire = { windup: .54, rows: 5, spacing: .16, rest: 3.8 };
const sentryFire = { windup: .94, rows: 6, spacing: .205, rest: 4.2 };

export function groveChallengeTiming(course: GroveCourse) {
  return course.kind === 'sentry' ? sentryFire : course.kind === 'skimmer' ? skimmerFire : gliderFire;
}

export function groveChallengeFirstShot(course: GroveCourse) {
  if (course.kind === 'sentry') return 2.04 + course.slot * .69;
  if (course.kind === 'skimmer') return 1.31 + course.slot * .38;
  return 1.68 + course.slot * .36 + (course.formation === 'train' ? .16 : 0);
}

export function stepGroveChallengeGlider(enemy: Glider, course: GroveCourse, player: Point, time: number) {
  const heading = enemy.heading ?? 0, nose = groveEnemySize(course) * .95;
  const origin = { x: enemy.x + nose * Math.sin(heading), y: enemy.y - nose * Math.cos(heading) };
  const visible = groveCanAttack(enemy.age, enemy.lane, course) && origin.y > Math.max(-2.4, player.y + 2.65);
  const opening = { x: 1.26 * Math.sin(time * .42 + .8) + player.x * .16, y: -5.95 };
  const burst = stepPatternBurst(enemy, opening, visible, groveChallengeTiming(course));
  if (!burst) return;

  const sentry = course.kind === 'sentry', skimmer = course.kind === 'skimmer';
  const turn = burst.row * .67 - 1.15;
  const gap = burst.target.x + course.mirror * .53 * Math.sin(turn);
  const petals = sentry ? [-4, -3, -2, -1, 1, 2, 3, 4] : skimmer ? [-2, -1, 1, 2] : [-3, -1, 0, 1, 3];
  return petals.map(petal => {
    const side = Math.sign(petal) || course.mirror, distance = Math.abs(petal) - (sentry || skimmer ? 1 : 0);
    const curl = Math.cos(turn - distance * .8 + course.slot * .34 + side * .45);
    const x = gap + side * (1.39 + distance * .58 + .22 * curl);
    const angle = Math.atan2(x - origin.x, origin.y - burst.target.y);
    const color = sentry ? petal % 2 === 0 : side === course.mirror;
    return patternBullet(origin, angle, 5.30 - .12 * distance + .19 * curl, color ? 'primary' : 'accent');
  });
}

export const groveChallengeBoss = { health: 254, interval: 5.6, lockAt: .49,
  first: 1.17, spacing: .164, rows: 16 } satisfies BossPattern & { health: number };
export const GROVE_CHALLENGE_SEEKER_AT = 4.42;

export function groveChallengeRaySignal(time: number) {
  const t = Math.max(0, time), cycle = Math.floor(t / groveChallengeBoss.interval), phase = t % groveChallengeBoss.interval;
  const seeker = phase < GROVE_CHALLENGE_SEEKER_AT ? Math.max(0, 1 + (phase - GROVE_CHALLENGE_SEEKER_AT) / .73) : 0;
  return { cycle, phase, side: cycle % 2 ? 1 : -1,
    fan: time < 0 ? 0 : bossPatternCharge(phase, groveChallengeBoss, groveChallengeBoss.rows), seeker };
}

export function groveChallengeRayRow(origin: Point, target: Point, cycle: number, row: number) {
  const side = cycle % 2 ? 1 : -1, curling = cycle % 4 >= 2;
  const phase = row / (groveChallengeBoss.rows - 1);
  const gap = target.x * .23 + side * (curling ? 1.72 * Math.sin((phase * 1.34 - .45) * Math.PI)
    : (2 * phase - 1) * 1.68 + .33 * Math.sin(phase * Math.PI * 2));
  const height = Math.max(-5.5, Math.min(-3.8, target.y));
  const shots = [];
  for (const wing of [-1, 1]) for (let vein = 0; vein < 6; vein++) {
    const ripple = .22 * Math.sin(phase * Math.PI * 2.3 - vein * .71 + wing * side);
    for (const strand of [-1, 1]) {
      const x = gap + wing * (1.58 + vein * .75 + strand * (.21 + ripple * .58));
      const angle = Math.atan2(x - origin.x, origin.y - height);
      const speed = 5.04 + (curling ? wing * side * ripple : ripple) + strand * (.24 + vein * .019);
      shots.push(patternBullet(origin, angle, speed, strand > 0 ? 'primary' : 'accent'));
    }
  }
  return shots;
}

export function groveChallengeSeekerBurst(origin: Point, heading: number) {
  return Array.from({ length: 12 }, (_, i) => {
    const angle = heading + (i + .5) * Math.PI / 6;
    const muzzle = { x: origin.x + Math.sin(angle) * .18, y: origin.y - Math.cos(angle) * .18 };
    return patternBullet(muzzle, angle, i % 2 === 0 ? 4.35 : 3.55, i % 2 === 0 ? 'primary' : 'accent');
  });
}
