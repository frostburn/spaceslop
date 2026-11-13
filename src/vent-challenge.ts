import { BOSS_MUZZLE_Z } from './encounters';
import { BOSS_CAMERA_DISTANCE } from './playfield';
import { faunaMuzzle } from './vent-fauna';
import { ventAnchors, ventBossPose, ventWorld, VENT_APPROACH, VENT_CRAB_SCALE, VENT_DURATION, VENT_SPAWN_LEAD, type VentWave } from './vent-layout';
import { MORTAR_WINDUP, mortarAim, mortarMuzzle } from './vent-mortar';
import { wingRewardForWave } from './wing';

type Point = { x: number; y: number };
type Attacker = Parameters<typeof faunaMuzzle>[0] & { lockedAim?: Point; mortarAngle?: number };

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

export const ventChallengeShrimp = { pace: 2.1, windup: .72, interval: 3.24, speed: 7.35 };
export const ventChallengeMortar = { interval: 2.16, speed: 6.85 };

export function ventChallengeShrimpFirstShot(slot: number) {
  return 1.58 + slot * .43;
}

function fan(origin: Point, bearing: number, speed: number, spread: readonly number[]) {
  return spread.map(offset => ({ ...origin, z: 0, vx: Math.sin(bearing + offset) * speed,
    vy: -Math.cos(bearing + offset) * speed, vz: 0, planar: true }));
}

const tightFan = [-.38, -.19, 0, .19, .38];
const splitFan = [-.56, -.39, -.22, .22, .39, .56];

export function stepVentChallengeShrimp(enemy: Attacker, player: Point) {
  const origin = faunaMuzzle(enemy);
  const { windup, interval, speed } = ventChallengeShrimp;
  const canFire = enemy.y < 7.1 && origin.y > player.y + 1.65 && Math.abs(enemy.heading ?? 0) < 1;
  if (!canFire) {
    enemy.fire = Math.max(enemy.fire, enemy.age + windup);
    enemy.lockedAim = undefined;
    return;
  }
  if (enemy.age < enemy.fire - windup) return;
  enemy.lockedAim ??= { ...player };
  if (enemy.age < enemy.fire) return;
  const aim = mortarAim(origin, enemy.lockedAim);
  enemy.lockedAim = undefined;
  enemy.fire = enemy.age + interval;
  return fan(origin, aim, speed, (enemy.shrimp?.slot ?? 0) % 2 === 0 ? tightFan : splitFan);
}

const mortarFan = [-.64, -.44, -.25, 0, .25, .44, .64];
export function stepVentChallengeMortar(enemy: Attacker, player: Point) {
  const { interval, speed } = ventChallengeMortar;
  if (enemy.y >= 7.1 || enemy.y <= player.y + 2.2) {
    enemy.fire = Math.max(enemy.fire, enemy.age + MORTAR_WINDUP);
    enemy.lockedAim = undefined;
  } else if (enemy.age >= enemy.fire - MORTAR_WINDUP) {
    enemy.lockedAim ??= { ...player };
  }
  const angle = mortarAim(enemy, enemy.lockedAim ?? player);
  enemy.mortarAngle = angle;
  if (enemy.age < enemy.fire) return;
  const origin = mortarMuzzle(enemy, angle, interval);
  enemy.fire = enemy.age + interval;
  enemy.lockedAim = undefined;
  return fan(origin, angle, speed, mortarFan);
}

export const ventChallengeBoss = { clawHealth: 30, coreHealth: 92, interval: 2.15, lockAt: .28 };
const sprays = [
  { at: .72, speed: 7.55, spread: [-.84, -.66, -.48, -.30, -.15, 0, .15, .30, .48, .66, .84] },
  { at: 1.15, speed: 8, spread: [-.90, -.74, -.58, -.42, -.27, -.13, .13, .27, .42, .58, .74, .90] },
  { at: 1.57, speed: 8.35, spread: [-.72, -.56, -.40, -.24, -.08, .08, .24, .40, .56, .72] },
] as const;

export function ventChallengeWindup(time: number, core: boolean) {
  const elapsed = time % ventChallengeBoss.interval;
  let charge = 0;
  for (let index = 0; index < (core ? 3 : 2); index++) {
    const { at } = sprays[index];
    const start = index === 0 ? ventChallengeBoss.lockAt : at - .25;
    charge = Math.max(charge, elapsed < at ? (elapsed - start) / (at - start) : 1 - (elapsed - at) / .15);
  }
  return charge;
}

export function ventChallengeVolleys(elapsed: number, dt: number, core: boolean) {
  const fired: number[] = [];
  for (let index = 0; index < (core ? 3 : 2); index++) {
    const { at } = sprays[index];
    if (elapsed >= at && elapsed - dt < at) fired.push(index);
  }
  return fired;
}

export function ventChallengeBossFan(time: number, localX: number, target: Point, index: number, cycle: number) {
  const boss = ventBossPose(1, time);
  const point = ventWorld(boss.x, boss.y, boss.z, VENT_DURATION + VENT_APPROACH + time, 1);
  // Match the posed claw or gill anchor before the rig recoils.
  const scale = BOSS_CAMERA_DISTANCE / (BOSS_CAMERA_DISTANCE - point.z - (BOSS_MUZZLE_Z + .015) * VENT_CRAB_SCALE);
  const origin = { x: (point.x + localX) * scale, y: point.y * scale };
  const spray = sprays[index];
  const turn = (cycle % 2 === 0 ? 1 : -1) * (index === 1 ? .17 : index === 2 ? -.23 : 0);
  return fan(origin, mortarAim(origin, target) + turn, spray.speed, spray.spread);
}
