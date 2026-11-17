import { patternBearing, patternBullet, rippleRow, stepPatternBurst, type BossPattern } from './challenge-patterns';
import type { CentipedeLink } from './centipede';
import type { CicadaCourse } from './titan-insects';
import { wingRewardForWave } from './wing';

type Point = { x: number; y: number };
type Attacker = Point & Parameters<typeof stepPatternBurst>[0] & {
  heading?: number; cicada?: CicadaCourse; centipede?: CentipedeLink;
};

const patrols = [
  [.85, [-2.5, -.8, .8, 2.5], 'chevron', 1], [4.25, [-2, -.6, .7, 2], 'sweep', 1],
  [7.55, [-2.5, -.9, .9, 2.5], 'dive', -1], [10.7, [-.85], 6],
  [13.95, [-2.4, -.75, .75, 2.4], 'sweep', -1], [17.5, [-2.4, -1.2, 0, 1.2, 2.4], 'chevron', -1],
  [20.85, [-2.25, -.6, 1.15, 2.6], 'dive', 1], [24.1, [1.15], 7],
  [27.15, [-2.4, -.8, .8, 2.4], 'sweep', 1], [30.55, [-2.6, -1.2, .45, 2.3], 'chevron', 1],
  [34, [-2.4, -.8, .8, 2.4], 'dive', -1], [37.4, [-.15], 7],
  [40.65, [-2.45, -1, .55, 2.45], 'sweep', -1], [44, [-2.5, -1.25, 0, 1.25, 2.5], 'chevron', -1],
  [47.4, [-2.4, -.75, .75, 2.4], 'sweep', 1], [50.65, [1.2], 8],
  [54.1, [-2.45, -1.2, 0, 1.2, 2.45], 'dive', 1], [57.5, [-2.4, -.7, .9, 2.5], 'sweep', -1],
  [60.9, [-2.6, -1.3, 0, 1.3, 2.6], 'chevron', -1], [64.2, [-1.1], 8],
  [67.65, [-2.35, -.7, .8, 2.45], 'dive', -1], [70.8, [-2.45, -.8, .8, 2.45], 'sweep', 1],
  [74.1, [-2.6, -1.3, 0, 1.3, 2.6], 'chevron', 1], [77.5, [.2], 8],
] as const;
const drops = ['homing', 'cannon', 'laser', 'omega'] as const;
export const titanChallengeWaves = patrols.map(([time, lanes, formation, mirror], index) => ({
  time, lanes, drop: wingRewardForWave(drops, index),
  centipede: typeof formation === 'number' ? formation : undefined,
  cicada: typeof formation === 'string' ? { formation, mirror: mirror ?? 1 } : undefined,
}));

export const TITAN_CHALLENGE_PACE = 1.19;
export const TITAN_SCOUT_MUZZLE = .61, TITAN_CENTIPEDE_MUZZLE = .65;
export const titanChallengeScout = { windup: .76, rows: 4, spacing: .25, rest: 3.9 };
export const titanChallengeCentipede = { windup: .9, rows: 6, spacing: .23, rest: 4.05 };

export function titanChallengeFirstShot(course: CicadaCourse) {
  return (course.formation === 'chevron' ? 1.5 : 1.64) + course.slot * .32;
}

export function stepTitanChallengeInsect(enemy: Attacker, player: Point) {
  const link = enemy.centipede;
  if (link && (link.slot !== 0 || link.chain.escape)) return;
  const timing = link ? titanChallengeCentipede : titanChallengeScout;
  const heading = enemy.heading ?? Math.PI, length = link ? TITAN_CENTIPEDE_MUZZLE : TITAN_SCOUT_MUZZLE;
  const origin = { x: enemy.x + Math.sin(heading) * length, y: enemy.y + Math.cos(heading) * length };
  const visible = Math.abs(origin.x) < 4.6 && enemy.y < 7.3 && origin.y > Math.max(-1.9, player.y + 2.1);
  const burst = stepPatternBurst(enemy, player, visible, timing);
  if (!burst) return;
  const direction = enemy.cicada?.mirror ?? Math.sign(link?.chain.lane || 1);
  const bearing = patternBearing(origin, { x: burst.target.x * .48, y: -5.4 }, .38);
  const drift = direction * (burst.row - (timing.rows - 1) / 2) * (link ? .13 : .15);
  const offsets = link ? [-.53, -.34, -.16, .16, .34, .53] : [-.38, -.15, .15, .38];
  return offsets.map((offset, i) => patternBullet(origin, bearing + drift + offset, link ? 4.88 + .055 * i : 4.99,
    (burst.row + (direction < 0 ? 1 : 0)) % 2 === 0 ? 'primary' : 'accent'));
}

export const titanChallengeBoss = { health: 160, interval: 5.1, lockAt: .38,
  first: 1.15, spacing: .195, rows: 13 } satisfies BossPattern & { health: number };

export function titanChallengeBossRow(origin: Point, target: Point, cycle: number, row: number) {
  const direction = cycle % 2 === 0 ? 1 : -1;
  const front = row / (titanChallengeBoss.rows - 1);
  if (cycle % 3 === 2) return rippleRow(origin, direction * front * .8, direction, row, 16, 4.66, 1.08);
  const opening = target.x * .22 + direction * (1.23 * Math.sin(front * Math.PI * 2 - .58));
  const height = Math.min(origin.y - 3.3, Math.max(-5.6, target.y));
  const shots = [];
  for (const side of [-1, 1]) for (let i = 0; i < 7; i++) {
    const wingbeat = Math.sin(front * Math.PI * 3 - i * .58 + side * direction * .7);
    const x = opening + side * (1.19 + i * .64 + .27 * wingbeat);
    const angle = Math.atan2(x - origin.x, origin.y - height + .65 * wingbeat);
    const speed = 4.86 + .96 * wingbeat + .28 * side * direction;
    shots.push(patternBullet(origin, angle, speed, wingbeat > .12 ? 'accent' : 'primary'));
  }
  return shots;
}
