import { patternBearing, patternBullet, stepPatternBurst, type BossPattern } from '../challenge-patterns';
import { wingRewardForWave } from '../wing';
import { electricSites, HELIOSTAT_SPEED, heliostatCanAttack, heliostatScroll, type HeliostatCourse } from './combat';

type Point = { x: number; y: number };
type Course = Omit<HeliostatCourse, 'slot'>;
type Attacker = Point & Parameters<typeof stepPatternBurst>[0] & { heading?: number; lane: number };

const patrols = [
  [1.25, [-2.4, -.8, .8, 2.4], 'vee'], [4.3, [-2.6, -.55, 2.45], 'cross'],
  [7.6, [0, 0, 0, 0], 'line'], [11, [-2.35, -.75, .75, 2.35], 'weave'],
  [14.35, [-2.5, -.65, .65, 2.5], 'vee'], [20.1, [-2.45, .25, 2.45], 'cross'],
  [23.45, [0, 0, 0, 0], 'line'], [26.8, [-2.5, -.8, .8, 2.5], 'weave'],
  [30.5, [-2.6, -1.3, 0, 1.3, 2.6], 'vee'], [36.35, [-2.45, -.85, .85, 2.45], 'weave'],
  [39.7, [-2.6, -1, .9, 2.6], 'cross'], [43, [0, 0, 0, 0], 'line'],
  [46.55, [-2.55, -.75, .75, 2.55], 'vee'], [52.3, [-2.4, -.75, .75, 2.4], 'cross'],
  [55.6, [0, 0, 0, 0], 'line'], [58.95, [-2.5, -1.2, 0, 1.2, 2.5], 'weave'],
  [62.15, [-2.5, -.85, .85, 2.5], 'cross'], [67.65, [-2.55, -1.2, 0, 1.2, 2.55], 'vee'],
  [70.9, [0, 0, 0, 0, 0], 'line'], [74.05, [-2.5, -.75, .75, 2.5], 'weave'],
  [77.15, [-2.55, -.75, .75, 2.55], 'cross'], [82.35, [-2.5, -.75, .75, 2.5], 'vee'],
  [85.65, [0, 0, 0, 0], 'line'], [89, [-2.5, -.8, .8, 2.5], 'weave'],
  [92.25, [-2.55, -.75, .75, 2.55], 'cross'],
] as const;
const guards = [8.5, 20.75, 37.15, 53.3, 68.15, 83.25, 91];
const drops = ['cannon', 'homing', 'laser', 'omega'] as const;
export const heliostatChallengeWaves = [
  ...patrols.map(([time, lanes, formation], index) => ({ time, lanes, drop: wingRewardForWave(drops, index),
    heliostat: { kind: 'drone', formation, mirror: index % 2 === 0 ? -1 : 1 } satisfies Course })),
  ...guards.map((time, index) => ({ time, lanes: [-2.35, 2.35], drop: drops[index % drops.length],
    heliostat: { kind: 'guard', formation: 'vee', mirror: 1 } satisfies Course })),
].sort((a, b) => a.time - b.time);

export const HELIOSTAT_CHALLENGE_PACE = 1.18;
export const heliostatChallengeDrone = { windup: .74, rows: 4, spacing: .23, rest: 4.1 };
export const heliostatChallengeGuard = { windup: 1, rows: 6, spacing: .25, rest: 5.4 };

export function heliostatChallengeFirstShot(course: HeliostatCourse) {
  if (course.kind === 'guard') return 4.95 + course.slot * .62;
  return 1.57 + course.slot * (course.formation === 'line' ? .61 : .35);
}

export function stepHeliostatChallengeActor(enemy: Attacker, course: HeliostatCourse, player: Point, time: number) {
  const guard = course.kind === 'guard', heading = enemy.heading ?? 0;
  const timing = guard ? heliostatChallengeGuard : heliostatChallengeDrone;
  const visible = Math.abs(enemy.x) < 4.6 && enemy.y < 7.1 && enemy.y > Math.max(-.8, player.y + 2.75)
    && heliostatCanAttack(enemy.age, enemy.lane, course);
  const burst = stepPatternBurst(enemy, player, visible, timing);
  if (!burst) return;

  const side = guard ? Math.sign(enemy.lane) : course.mirror;
  const muzzle = guard ? .9 : .43;
  const lens = guard ? (burst.row % 2 === 0 ? .29 : -.29) : 0;
  const origin = { x: enemy.x + Math.sin(heading) * muzzle + Math.cos(heading) * lens,
    y: enemy.y - Math.cos(heading) * muzzle + Math.sin(heading) * lens };
  const bearing = patternBearing(origin, { x: burst.target.x * .37, y: -5.6 }, .4);
  const shift = guard ? side * .28 * Math.sin(burst.row * .53 - 1.57) : side * (burst.row - 1.5) * .15;
  const offsets = guard ? [-.56, -.35, -.16, .1, .31, .51] : [-.38, -.14, .14, .38];
  const gate = electricSites.find(site => time > site.at - 5 && time < site.at + 2.6);
  const gateY = gate ? gate.at * HELIOSTAT_SPEED - heliostatScroll(time) : 0;
  const shots = [];
  for (const [i, offset] of offsets.entries()) {
    const speed = guard ? 4.86 + .35 * Math.cos(offset * 3.3) : 5.1;
    const shot = patternBullet(origin, bearing + shift + offset, speed, guard || i % 2 ? 'accent' : 'primary');
    if (gate && Math.abs(shot.vy + HELIOSTAT_SPEED) > 1e-6) {
      // Keep the marked passage clear where projectiles cross the moving gate.
      const cross = (gateY - shot.y) / (shot.vy + HELIOSTAT_SPEED);
      const y = gateY - cross * HELIOSTAT_SPEED;
      if (cross >= 0 && y < 3.36 && y > -7.45 && Math.abs(shot.x + cross * shot.vx - gate.gap) < 1.05) continue;
    }
    shots.push(shot);
  }
  return shots;
}

export const heliostatChallengeBoss = { health: 174, interval: 5.35, lockAt: .45,
  first: 1.28, spacing: .193, rows: 13, exposedRows: 15 } satisfies BossPattern & { health: number };

export function heliostatChallengeBossRow(origins: readonly Point[], target: Point, cycle: number, row: number, unstable: boolean) {
  const lead = cycle % 2 === 0 ? -1 : 1;
  const end = (unstable ? heliostatChallengeBoss.exposedRows : heliostatChallengeBoss.rows) - 1;
  const sweep = Math.PI * (row / end - .5);
  const opening = target.x * .18 + lead * 1.32 * Math.sin(sweep);
  const height = Math.max(-5.45, target.y);
  const shots = [];
  for (const [index, origin] of origins.entries()) {
    const side = index === 0 ? -1 : 1;
    const delay = unstable && side !== lead ? 2 : 0;
    if (row < delay || (unstable && side === lead && row > end - 2)) continue;
    const arc = row - delay;
    for (let i = 0; i < 9; i++) {
      const x = opening + side * (1.14 + i * .48 + .12 * Math.sin(arc * .56));
      const angle = Math.atan2(x - origin.x, origin.y - height);
      const speed = 4.73 + .66 * Math.sin(Math.PI * (i + 1) / 10) + .11 * Math.sin(arc * .43 + index);
      shots.push(patternBullet(origin, angle, speed, side === -1 ? 'primary' : 'accent'));
    }
  }
  return shots;
}
