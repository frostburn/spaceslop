import { patternBearing, patternBullet, stepPatternBurst, type BossPattern } from './challenge-patterns';
import { GROUNDSKEEPER_CYCLE, groundskeeperFlight, groundskeeperPose, type GkAttack } from './groundskeeper';
import { flyerDelay, type FlyerCourse, type FlyerFormation } from './preserve-flyer';
import { BOSS_CAMERA_DISTANCE } from './playfield';
import { wingRewardForWave } from './wing';

type Point = { x: number; y: number };
type Attacker = Point & Parameters<typeof stepPatternBurst>[0] & {
  heading?: number; flyer?: FlyerCourse; lane: number;
};
type Patrol = readonly [time: number, formation: FlyerFormation, lanes: readonly number[], mirror: number, raptor?: number];

const patrols: readonly Patrol[] = [
  [.9, 'chevron', [-2.4, -.8, .8, 2.4], 1],
  [4.2, 'crossing', [-2.3, -.8, .8, 2.3], -1],
  [7.55, 'swoop', [-2.5, -.85, .85, 2.5], 1, 3],
  [10.9, 'loop', [0, 0, 0, 0], -1],
  [14.35, 'chevron', [-2.25, -.65, 1.4, 2.5], 1, 3],
  [17.8, 'slalom', [0, 0, 0], -1],
  [21.2, 'swoop', [-2.55, -.85, .85, 2.55], -1, 0],
  [24.5, 'crossing', [-2.5, -.8, .8, 2.5], 1],
  [27.8, 'chevron', [-2.6, -1.3, 0, 1.3, 2.6], -1, 4],
  [31.15, 'loop', [0, 0, 0, 0], 1],
  [34.55, 'swoop', [-2.5, -.8, .8, 2.5], -1, 0],
  [38, 'chevron', [-2.5, -.85, .85, 2.5], 1],
  [41.4, 'chevron', [-2.4, -.8, .8, 2.4], 1],
  [44.75, 'crossing', [-2.5, -.8, .8, 2.5], -1, 3],
  [48.2, 'swoop', [-2.5, -.9, .9, 2.5], 1],
  [51.55, 'loop', [0, 0, 0], -1],
  [55.05, 'chevron', [-2.6, -1.3, 0, 1.3, 2.6], -1, 0],
  [58.4, 'slalom', [0, 0, 0], 1],
  [61.65, 'crossing', [-2.5, -.85, .85, 2.5], 1, 3],
  [65.05, 'swoop', [-2.45, -.85, .85, 2.45], -1],
  [68.45, 'loop', [0, 0, 0], 1],
  [71.85, 'chevron', [-2.5, -.8, .8, 2.5], -1, 0],
  [75.3, 'slalom', [0, 0, 0, 0], -1, 0],
  [78.65, 'crossing', [-2.55, -.85, .85, 2.55], 1],
  [82.05, 'swoop', [-2.5, -.85, .85, 2.5], 1, 3],
  [85.5, 'chevron', [-2.6, -1.3, 0, 1.3, 2.6], -1],
  [88.9, 'loop', [0, 0, 0, 0], -1],
  [92.35, 'chevron', [-2.6, -1.3, 0, 1.3, 2.6], 1, 2],
];
const drops = ['homing', 'cannon', 'laser', 'omega'] as const;

export const preserveChallengeWaves = patrols.map(([time, formation, lanes, mirror, raptor], index) => ({
  time, lanes, raptor, flyer: { formation, mirror }, drop: wingRewardForWave(drops, index),
}));
export const PRESERVE_CHALLENGE_PACE = 1.19;
export const PRESERVE_FLYER_MUZZLE = .88, PRESERVE_RAPTOR_MUZZLE = .65;
export const preserveChallengeFlyer = { windup: .68, rows: 4, spacing: .26, rest: 3.7 };
export const preserveChallengeRaptor = { windup: .79, rows: 5, spacing: .19, rest: 3.95 };
const longFeatherOffsets = [-.62, -.44, -.26, .12, .29, .46, .63];

export function preserveChallengeFirstShot(course?: FlyerCourse) {
  if (!course) return 1.42;
  const stagger = course.formation === 'crossing' ? course.slot * .49 : course.slot * .20;
  return 1.52 + flyerDelay(course) + stagger + (course.formation === 'chevron' ? Math.abs(course.slot - (course.count - 1) / 2) * .22 : 0);
}

export function stepPreserveChallengeFlyer(enemy: Attacker, player: Point) {
  const course = enemy.flyer;
  const timing = course ? preserveChallengeFlyer : preserveChallengeRaptor;
  const heading = enemy.heading ?? 0, length = course ? PRESERVE_FLYER_MUZZLE : PRESERVE_RAPTOR_MUZZLE;
  const origin = { x: enemy.x + Math.sin(heading) * length, y: enemy.y - Math.cos(heading) * length };
  const visible = enemy.y < 7.45 && Math.abs(origin.x) < 4.55 && origin.y > Math.max(-1.9, player.y + 3)
    && Math.cos(heading) > .38;
  const burst = stepPatternBurst(enemy, player, visible, timing);
  if (!burst) return;
  const side = course?.mirror ?? Math.sign(enemy.lane || 1);
  if (!course) {
    const center = patternBearing(origin, { x: enemy.lane * .56 + burst.target.x * .29, y: -5.4 }, .41);
    const sweep = side * (burst.row - 2) * .14;
    return longFeatherOffsets.map(offset => patternBullet(origin, center + sweep + side * offset,
      5.30 - Math.abs(offset) * .42, 'accent'));
  }
  const opening = burst.target.x * .1 + side * .8 * Math.sin(burst.row * .68 - .94);
  const lane = enemy.lane * .68 + side * (course.slot - (course.count - 1) / 2) * .35;
  return [-.8, -.35, .35, .8].map((offset, index) => {
    const x = lane + offset;
    const destination = opening + (Math.sign(x) || side) * (1.22 + Math.abs(x));
    const angle = Math.atan2(destination - origin.x, origin.y + 5.45);
    return patternBullet(origin, angle, 5.08 + .26 * Math.sin((index + 1) * Math.PI / 5),
      (burst.row + index) % 3 === 0 ? 'accent' : 'primary');
  });
}

export const preserveChallengeBoss = { health: 208, interval: GROUNDSKEEPER_CYCLE,
  lockAt: 3.28, first: 3.8, spacing: .128, rows: 10 } satisfies BossPattern & { health: number };

const featherShoulders: Record<GkAttack, readonly number[]> = {
  'left rake': [0], 'right rake': [1], 'double slam': [0, 1], lunge: [0, 1],
};

export function groundskeeperFeatherShoulders(kind: GkAttack) {
  return featherShoulders[kind];
}

export function preserveChallengeBossRow(time: number, aim: Point, cancelledAt: number, target: Point, cycle: number, row: number) {
  const pose = groundskeeperPose(time, aim, cancelledAt);
  const reverse = cycle % 2 === 0 ? 1 : -1;
  const progress = row / (preserveChallengeBoss.rows - 1);
  const gap = target.x * .27 + reverse * (progress * 2 - 1) * 1.34;
  const shoulders = groundskeeperFeatherShoulders(pose.kind).map(index => {
    const p = groundskeeperFlight(pose.arms[index].shoulder);
    const scale = BOSS_CAMERA_DISTANCE / (BOSS_CAMERA_DISTANCE - p.z);
    return { x: p.x * scale, y: p.y * scale };
  });
  const shots = [];
  for (const side of [-1, 1]) {
    const origin = shoulders[side < 0 ? 0 : shoulders.length - 1];
    const height = Math.max(-5.5, Math.min(origin.y - 2.5, target.y));
    for (let i = 0; i < 10; i++) {
      const x = gap + side * (1.26 + i * .49);
      const bearing = Math.atan2(x - origin.x, origin.y - height);
      // Fletch each row with a fast shaft and slower tips, mirrored with the rake.
      const speed = 4.88 + .57 * Math.sin(Math.PI * (i + 1) / 11) + side * reverse * .14;
      shots.push(patternBullet(origin, bearing, speed, side === reverse ? 'accent' : 'primary'));
    }
  }
  return shots;
}
