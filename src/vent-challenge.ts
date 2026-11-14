import { BOSS_MUZZLE_Z } from './encounters';
import { patternBearing, patternBullet, stepPatternBurst, type BossPattern } from './challenge-patterns';
import { BOSS_CAMERA_DISTANCE } from './playfield';
import { faunaMuzzle } from './vent-fauna';
import { ventAnchors, ventBossPose, ventWorld, VENT_APPROACH, VENT_CRAB_SCALE, VENT_DURATION, VENT_SPAWN_LEAD, type VentWave } from './vent-layout';
import { MORTAR_WINDUP, mortarAim, mortarMuzzle } from './vent-mortar';
import { wingRewardForWave } from './wing';

type Point = { x: number; y: number };
type Attacker = Parameters<typeof faunaMuzzle>[0] & Parameters<typeof stepPatternBurst>[0];
const shrimpStreams = [-.38, -.18, .18, .38];
const mortarStreams = [-.28, 0, .28];

const patrols = [
  [.7, [-2.3, -.7, .8, 2.4]], [3.75, [-2.25, 0, 2.25]], [6.9, [0, 0, 0, 0]],
  [10.2, [-2.5, -.9, .7, 2.15]], [13.5, [-2.2, -.65, 1.65]], [16.65, [-2.5, -1.2, .2, 1.65, 2.6]],
  [20, [0, 0, 0, 0]], [23.3, [-2.5, -.9, .9, 2.5]], [26.7, [-2.25, -.6, .75, 2.45]],
  [29.9, [0, 0, 0, 0]], [33.1, [-2.5, -1, .45, 1.95]], [36.25, [-2.6, -.9, .9, 2.6]],
  [39.5, [-2.5, -1.25, .15, 1.55, 2.7]], [42.8, [0, 0, 0, 0]], [46.05, [-2.3, -.7, 1.05, 2.6]],
  [49.2, [-2.6, -1, .6, 2.2]], [52.6, [0, 0, 0, 0]], [55.85, [-2.3, -1, .3, 1.6, 2.7]],
  [59.1, [-2.45, -.9, .75, 2.3]], [62.4, [-2.6, -1.15, .25, 1.8]], [65.7, [0, 0, 0, 0]],
  [69, [-2.5, -1.15, .2, 1.6, 2.75]], [72.3, [-2.3, -.8, .85, 2.4]], [75.5, [0, 0, 0, 0]],
  [78.8, [-2.65, -1.25, .05, 1.45, 2.7]], [82.1, [-2.5, -.85, .85, 2.5]], [85.5, [0, 0, 0, 0]],
  [88.8, [-2.45, -.9, .85, 2.55]], [92, [-2.6, -1.3, 0, 1.3, 2.6]],
] as const;
const drops = ['homing', 'cannon', 'laser', 'omega'] as const;

export const ventChallengeWaves: readonly VentWave[] = [
  ...patrols.map(([time, lanes], index): VentWave => ({
    time, lanes: [...lanes], drop: wingRewardForWave(drops, index),
    shrimp: { formation: lanes[0] === 0 ? 'curl' : index % 2 === 0 ? 'weave' : 'cross', mirror: index % 2 === 0 ? 1 : -1 },
  })),
  ...ventAnchors.map((anchor, index) => ({ time: anchor.time - VENT_SPAWN_LEAD, lanes: [0], ventAnchor: index, ventWorm: anchor.worm })),
].sort((a, b) => a.time - b.time);

export const ventChallengeShrimp = { pace: 1.58, windup: .78, rows: 3, spacing: .28, rest: 4.3, speed: 4.95 };
export const ventChallengeMortar = { windup: MORTAR_WINDUP, rows: 5, spacing: .22, rest: 3.9, speed: 4.55 };

export function ventChallengeShrimpFirstShot(slot: number) {
  return 1.67 + slot * .45;
}

export function stepVentChallengeShrimp(enemy: Attacker) {
  const origin = faunaMuzzle(enemy);
  const timing = ventChallengeShrimp;
  const canFire = enemy.y < 7.1 && origin.y > -1 && Math.abs(enemy.heading ?? 0) < 1;
  const burst = stepPatternBurst(enemy, enemy, canFire, timing);
  if (!burst) return;
  const side = (enemy.shrimp?.slot ?? 0) % 2 === 0 ? 1 : -1;
  const aim = patternBearing(origin, { x: burst.target.x * .36, y: -5.25 }, .32) + side * (.24 * (burst.row - 1));
  return shrimpStreams.map(offset => patternBullet(origin, aim + offset, timing.speed,
    side === 1 ? 'primary' : 'accent'));
}

export function stepVentChallengeMortar(enemy: Attacker, player: Point) {
  const burst = stepPatternBurst(enemy, player, enemy.y < 7.1 && enemy.y > player.y + 2.9, ventChallengeMortar);
  const aim = burst?.target ?? enemy.burst?.target ?? player;
  const angle = mortarAim(enemy, aim);
  enemy.mortarAngle = angle;
  if (!burst) return;
  const origin = mortarMuzzle(enemy, angle, burst.row === 0 ? 1 : .7);
  const swing = Math.sign(enemy.x) * (burst.row - 2) * .13;
  const bearing = patternBearing(origin, aim, .72) * .9 + swing;
  return mortarStreams.map(offset => patternBullet(origin, bearing + offset, ventChallengeMortar.speed, 'accent'));
}

export const ventChallengeBoss = { clawHealth: 30, coreHealth: 92, interval: 4.65, lockAt: .34,
  first: 1.02, spacing: .21, rows: 10, exposedRows: 14 } satisfies BossPattern & { clawHealth: number; coreHealth: number };

export function ventChallengeBossRow(time: number, localX: number, target: Point, cycle: number, row: number, extended: boolean) {
  const boss = ventBossPose(1, time);
  const point = ventWorld(boss.x, boss.y, boss.z, VENT_DURATION + VENT_APPROACH + time, 1);
  // Match the posed claw or gill anchor before the rig recoils.
  const scale = BOSS_CAMERA_DISTANCE / (BOSS_CAMERA_DISTANCE - point.z - (BOSS_MUZZLE_Z + .015) * VENT_CRAB_SCALE);
  const origin = { x: (point.x + localX) * scale, y: point.y * scale };
  const mirror = cycle % 2 === 0 ? 1 : -1;
  const sweep = mirror * Math.sin(row * .37 - 1.15) * (extended ? .43 : .35);
  const center = patternBearing(origin, target, .25) * .55 + sweep;
  const shots = [];
  // Each arm keeps an open side and bends around the same empty center.
  for (const side of [-1, 1]) {
    const length = side === mirror ? 6 : 5;
    for (let index = 0; index < length; index++) {
      const angle = center + side * (.24 + .127 * index);
      shots.push(patternBullet(origin, angle, 5.48 - .12 * index, side === mirror ? 'accent' : 'primary'));
    }
  }
  return shots;
}
