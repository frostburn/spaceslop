import { bossPatternCharge, patternBearing, patternBullet, stepPatternBurst, type BossPattern, type PatternColor } from '../challenge-patterns';
import { BOSS_CAMERA_DISTANCE } from '../playfield';
import { wingRewardForWave } from '../wing';
import type { SummerCourse } from './combat';
import { HYDRA_BOSS_SIZE, HYDRA_SIDES, hydraAlive, hydraBossHead, hydraCrown, riverHydraHead, type HydraSide, type HydraState } from './hydra-targets';
import { VORTEX_FIRE, vortexEmission } from './vortex';

type Point = { x: number; y: number };
type Attacker = Point & Parameters<typeof stepPatternBurst>[0] & { lane: number; hydra?: HydraState };
type Patrol = readonly [at: number, kind: SummerCourse['kind'], formation: SummerCourse['formation'], lanes: readonly number[], mirror: number];

const patrols: readonly Patrol[] = [
  [1, 'scout', 'vee', [-2.55, -.85, .85, 2.55], 1],
  [4.15, 'drone', 'cross', [-2.4, 0, 2.4], -1],
  [7.5, 'scout', 'weave', [-2.4, -.8, .8, 2.4], -1],
  [10.4, 'vortex', 'vee', [1.55], -1],
  [11.95, 'drone', 'loop', [-2.3, 0, 2.3], 1],
  [15.05, 'scout', 'cross', [-2.55, -.85, .85, 2.55], -1],
  [18.4, 'hydra', 'vee', [0], 1],
  [21.15, 'drone', 'weave', [-2.35, 0, 2.35], 1],
  [23.9, 'scout', 'loop', [-2.55, -.85, .85, 2.55], -1],
  [27.45, 'drone', 'vee', [-2.45, -.8, .8, 2.45], -1],
  [30.15, 'vortex', 'vee', [-1.55], 1],
  [32.15, 'scout', 'cross', [-2.55, -.85, .85, 2.55], 1],
  [36.1, 'drone', 'weave', [-2.5, -.8, .8, 2.5], -1],
  [39.45, 'scout', 'vee', [-2.55, -.85, .85, 2.55], 1],
  [43.1, 'hydra', 'vee', [0], 1],
  [45.25, 'scout', 'loop', [-2.4, -.8, .8, 2.4], 1],
  [48.95, 'drone', 'cross', [-2.55, -.85, .85, 2.55], -1],
  [51.95, 'vortex', 'vee', [1.55], -1],
  [53.1, 'scout', 'weave', [-2.45, -.8, .8, 2.45], -1],
  [56.65, 'drone', 'loop', [-2.6, -.85, .85, 2.6], 1],
  [60.2, 'scout', 'cross', [-2.55, -.85, .85, 2.55], -1],
  [63.45, 'hydra', 'vee', [0], 1],
  [65.65, 'drone', 'vee', [-2.55, -.85, .85, 2.55], 1],
  [69.1, 'scout', 'weave', [-2.6, -1.3, 0, 1.3, 2.6], -1],
  [72, 'vortex', 'vee', [-1.55], 1],
  [74.1, 'drone', 'cross', [-2.55, -.85, .85, 2.55], 1],
  [77.55, 'scout', 'loop', [-2.5, -.85, .85, 2.5], -1],
  [81.1, 'drone', 'weave', [-2.55, -.85, .85, 2.55], -1],
  [84.45, 'hydra', 'vee', [0], 1],
  [86.35, 'scout', 'cross', [-2.55, -.85, .85, 2.55], 1],
  [89.65, 'vortex', 'vee', [1.55], -1],
  [91.3, 'drone', 'vee', [-2.6, -1.3, 0, 1.3, 2.6], -1],
];
const drops = ['cannon', 'homing', 'laser', 'omega'] as const;
export const summerChallengeWaves = patrols.map(([at, kind, formation, lanes, mirror], index) => ({
  time: at, lanes, drop: wingRewardForWave(drops, index), summer: { at, kind, formation, mirror },
}));

export const SUMMER_CHALLENGE_PACE = 1.2;
const scoutTiming = { windup: .66, rows: 4, spacing: .225, rest: 3.9 };
const droneTiming = { windup: .85, rows: 5, spacing: .24, rest: 4.4 };
const riverTiming = { windup: .74, rows: 6, spacing: .22, rest: 4.6 };
export const summerChallengeWindup = { scout: scoutTiming.windup, drone: droneTiming.windup, hydra: riverTiming.windup };

export function summerChallengeFirstShot(course: SummerCourse) {
  if (course.kind === 'vortex') return VORTEX_FIRE;
  if (course.kind === 'hydra') return 1.52;
  return 1.66 + course.slot * .37;
}

function petalFan(origin: Point, bearing: number, offsets: readonly number[], speed: number, pattern: PatternColor) {
  return offsets.map(offset => patternBullet(origin, bearing + offset, speed - .48 * Math.abs(offset), pattern));
}

export function stepSummerChallengeActor(enemy: Attacker, course: SummerCourse, player: Point, time: number) {
  const hydra = course.kind === 'hydra', drone = course.kind === 'drone';
  const timing = hydra ? riverTiming : drone ? droneTiming : scoutTiming;
  const visible = enemy.y < 6.7 && enemy.y > Math.max(-1.6, player.y + 2.95);
  const burst = stepPatternBurst(enemy, player, visible, timing);
  if (!burst) return;
  if (hydra) {
    const sweep = .32 * Math.sin(burst.row * .58 - 1.12);
    return HYDRA_SIDES.filter(side => hydraAlive(enemy.hydra, side)).flatMap(side => {
      const crown = hydraCrown(riverHydraHead(enemy, time, side), 1);
      const origin = { x: enemy.x + crown.x, y: enemy.y + crown.y };
      const center = patternBearing(origin, { x: burst.target.x * .28 + side * 1.35, y: -5.4 }, .42);
      return petalFan(origin, center + sweep, [-.24, 0, .24], 5.2, side === 0 ? 'accent' : 'primary');
    });
  }
  const origin = { x: enemy.x, y: enemy.y - (drone ? .16 : .45) };
  const opening = burst.target.x * .12 + course.mirror * .99 * Math.sin(burst.row * .57 - 1.08);
  const lane = enemy.lane * .62 + .27 * Math.sin(burst.row * .87 + course.slot * .34);
  const offsets = drone ? [-1.18, -.60, 0, .60, 1.18] : [-.87, -.34, .34, .87];
  return offsets.map((offset, i) => {
    const side = Math.sign(lane + offset) || course.mirror;
    const x = opening + side * (1.24 + Math.abs(lane + offset));
    const angle = Math.atan2(x - origin.x, origin.y + 5.45);
    const speed = 4.91 + (drone ? .46 : .4) * Math.sin((i + 1) * Math.PI / (offsets.length + 1));
    return patternBullet(origin, angle, speed, drone ? 'accent' : 'primary');
  });
}

export function summerChallengeVortex(at: number, origin: Point, mirror: number) {
  const { next, shots: nozzles } = vortexEmission(at, origin.x, origin.y, mirror);
  const shots = nozzles.flatMap(({ x, y, vx, vy }, index) => {
    const bearing = Math.atan2(vx, -vy);
    // Leave a break in the inner spiral as it crosses the river lane.
    if (Math.sin(bearing) * origin.x < -.28 && Math.cos(bearing) > .6) return [];
    return [-.085, .085].map(offset => patternBullet({ x, y }, bearing + offset, 3.8,
      index === 0 ? 'primary' : 'accent'));
  });
  return { shots, next };
}

export const LOTUS_CHALLENGE_HEAD_HP = 74;
export const lotusChallengeBoss = { interval: 5.65, lockAt: .46, first: 1.34, spacing: .187, rows: 16 } satisfies BossPattern;

function headDelay(side: HydraSide, cycle: number) {
  return cycle % 2 === 0 ? side + 1 : 1 - side;
}

export function lotusChallengeHeadCharge(elapsed: number, cycle: number, side: HydraSide) {
  const delay = headDelay(side, cycle) * lotusChallengeBoss.spacing;
  return bossPatternCharge(elapsed - delay, lotusChallengeBoss, lotusChallengeBoss.rows - 2);
}

export function lotusChallengeBossRow(state: HydraState, time: number, depth: number, target: Point, cycle: number, row: number) {
  const turn = cycle % 2 === 0 ? 1 : -1, span = lotusChallengeBoss.rows - 1;
  const phase = row / span * Math.PI * 2;
  const gap = target.x * .24 + turn * (1.35 * Math.sin(phase - .78) + .34 * Math.sin(phase / 2));
  const targetHeight = Math.max(-5.5, target.y);
  const shots = [];
  for (const side of HYDRA_SIDES) {
    const localRow = row - headDelay(side, cycle);
    if (!hydraAlive(state, side) || localRow < 0 || localRow > span - 2) continue;
    const crown = hydraCrown(hydraBossHead(time, side), HYDRA_BOSS_SIZE);
    const scale = BOSS_CAMERA_DISTANCE / (BOSS_CAMERA_DISTANCE - depth - crown.z);
    const origin = { x: crown.x * scale, y: crown.y * scale };
    const height = Math.min(origin.y - 2.6, targetHeight);
    const opening = 1.33 + .22 * Math.sin(phase + side * .7);
    for (let i = 0; i < 8; i++) {
      const branch = side || (i < 4 ? -1 : 1);
      const radius = side ? 1.64 + i * .49 : opening + (i % 4) * .81;
      const x = gap + branch * radius;
      const angle = Math.atan2(x - origin.x, origin.y - height);
      const petal = Math.sin(Math.PI * ((side ? i : i % 4) + 1) / (side ? 9 : 5));
      const speed = (side ? 5.12 : 4.8) + .47 * petal + .16 * Math.sin(localRow * .7 + side * 2);
      shots.push(patternBullet(origin, angle, speed, side === 0 ? 'accent' : 'primary'));
    }
  }
  return shots;
}
