import { patternBearing, patternBullet, stepPatternBurst, type BossPattern } from './challenge-patterns';
import { marineSpecs, schoolDelay, type MarineFormation, type MarineKind, type MarineSchool } from './marine';
import { wingRewardForWave } from './wing';

type Point = { x: number; y: number };
type Attacker = Point & Parameters<typeof stepPatternBurst>[0] & { heading?: number; school?: MarineSchool; slot?: number };
type SchoolWave = readonly [time: number, lanes: readonly number[], formation?: MarineFormation, mirror?: number];

const schools: readonly SchoolWave[] = [
  [.8, [-2.2, -.7, .7, 2.2], 'chevron'], [3.9, [-1.8, 1.8], 'pincer'], [6.95, [-1.25, 1.25]],
  [10.3, [0, 0, 0, 0, 0], 'loop', 1], [14.05, [-2.2, 0, 2.2], 'chevron'],
  [17.15, [0, 0, 0, 0], 'slalom', -1], [20.4, [-1.65, 1.65]], [23.65, [-1.8, 1.8, -1.8, 1.8], 'pincer'],
  [26.75, [-2.3, -.75, .75, 2.3], 'chevron'], [30, [0, 0, 0, 0, 0], 'loop', -1], [33.7, [0]],
  [37, [0, 0, 0, 0], 'slalom', 1], [40.25, [-1.8, 1.8, -1.8, 1.8], 'pincer'],
  [43.45, [-1.55, 1.55]], [47.05, [-2.3, -.8, .8, 2.3], 'chevron'], [50.05, [0, 0, 0, 0, 0], 'loop', 1],
  [53.6, [-1.4, 1.4]], [57, [-1.8, 1.8, -1.8, 1.8], 'pincer'], [60.15, [0, 0, 0, 0], 'slalom', -1],
  [63.3, [-2.3, -.8, .8, 2.3], 'chevron'], [66.5, [-1.55, 1.55]], [69.75, [0, 0, 0, 0, 0], 'loop', -1],
  [73.5, [-1.8, 1.8, -1.8, 1.8], 'pincer'], [76.6, [0, 0, 0], 'slalom', 1],
  [79.8, [-1.55, 1.55]], [83.25, [-2.4, -1.2, 0, 1.2, 2.4], 'chevron'],
];
const drops = ['homing', 'omega', 'cannon', 'laser'] as const;
export const iceChallengeWaves = schools.map(([time, lanes, formation, mirror], index) => ({
  time, lanes, formation, mirror, drop: wingRewardForWave(drops, index),
  marine: formation ? 'ichthyosaur' as const : 'plesiosaur' as const,
}));

export const ICE_CHALLENGE_PACE = 1.18;
export const iceChallengeHunter = { windup: .74, rows: 4, spacing: .225, rest: 3.85 };
export const iceChallengeSweeper = { windup: .95, rows: 6, spacing: .225, rest: 4.2 };

export function iceChallengeFirstShot(kind: MarineKind, slot: number, school?: MarineSchool) {
  if (kind === 'plesiosaur') return 2.15 + slot * .58;
  const entry = school?.formation === 'chevron' ? Math.abs(slot - (school.count - 1) / 2) * .58 : 0;
  return schoolDelay(school) + entry + 1.25 + slot * .16;
}

export function stepIceChallengeMarine(enemy: Attacker, kind: MarineKind, player: Point) {
  const sweeper = kind === 'plesiosaur', timing = sweeper ? iceChallengeSweeper : iceChallengeHunter;
  const heading = enemy.heading ?? 0, length = marineSpecs[kind].halfLength;
  const origin = { x: enemy.x + Math.sin(heading) * length, y: enemy.y - Math.cos(heading) * length };
  const visible = enemy.y < 7.2 && origin.y > Math.max(-1.4, player.y + 2.45) && Math.abs(heading) < 1.12;
  const burst = stepPatternBurst(enemy, player, visible, timing);
  if (!burst) return;

  const side = enemy.school?.formation === 'pincer' ? Math.sign(enemy.x) : (enemy.slot ?? 0) % 2 ? -1 : 1;
  const opening = sweeper ? burst.target.x * .26 : origin.x * .37 + burst.target.x * .25;
  const aim = patternBearing(origin, { x: opening, y: -5.2 }, .39);
  const row = burst.row, drift = side * .24 * Math.sin(row * (sweeper ? .57 : .8) - 1.18);
  const offsets = sweeper ? [-.62, -.44, -.27, -.11, .11, .27, .44, .62] : [-.39, -.14, .14, .39];
  return offsets.map((offset, index) => patternBullet(origin, aim + drift + offset,
    (sweeper ? 5.13 : 5.27) + Math.cos(index * 1.4 + row * .5) * .17,
    (row + (offset < 0 ? 0 : 1)) % 2 === 0 ? 'primary' : 'accent'));
}

export const iceChallengeBoss = { health: 188, interval: 5.2, lockAt: .42,
  first: 1.22, spacing: .183, rows: 16 } satisfies BossPattern & { health: number };

export function iceChallengeBossRow(origin: Point, target: Point, cycle: number, row: number) {
  const turn = cycle % 2 === 0 ? 1 : -1;
  const phase = row / (iceChallengeBoss.rows - 1) * Math.PI * 2;
  const opening = target.x * .25 + turn * (1.25 * Math.sin(phase - .7) + .45 * Math.sin(phase * .5));
  const height = Math.max(-5.45, target.y);
  const shots = [];
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const twist = Math.sin(phase * 1.5 - i * .63 + (side === turn ? 0 : .75));
    for (const strand of [-1, 1]) {
      // Faster and slower strands wind around each other across the fan.
      const x = opening + side * (1.26 + i * 1.02 + strand * (.2 + .25 * twist));
      const angle = Math.atan2(x - origin.x, origin.y - height);
      const speed = 5.07 + .09 * i + strand * (.29 + .11 * twist);
      shots.push(patternBullet(origin, angle, speed, strand === 1 ? 'accent' : 'primary'));
    }
  }
  return shots;
}
