import { bossPatternCharge, patternBullet, rippleRow, stepPatternBurst, type BossPattern } from '../challenge-patterns';
import { wingRewardForWave } from '../wing';
import { depthBullet } from '../depth-barrage';
import { DEN_CYCLE, DEN_GUNS, DEN_MUZZLE_DEPTH, denMount, denPose } from './combat';
import { denPatrolCanFire, denPatrolScale, type DenPatrol } from './patrol';

type Point = { x: number; y: number };
type Patrol = readonly [time: number, course: DenPatrol['course'], side: DenPatrol['side'], lanes: readonly number[], guard?: number];

const patrols: readonly Patrol[] = [
  [1.7, 'weave', -1, [-2.35, -.78, .78, 2.35]], [5.25, 'launch', 1, [2.25, .65, -1.1]],
  [8.8, 'cross', -1, [2.4, .85, -.75], 0], [12.4, 'weave', 1, [-2.45, -.8, .8, 2.45]],
  [15.9, 'launch', -1, [-2.45, -.9, .85, 2.1]], [19.5, 'cross', 1, [-2.3, -.7, 1.0], 0],
  [23.1, 'weave', -1, [-2.35, -.72, .72, 2.35]], [26.7, 'launch', 1, [2.4, .85, -.9, -2.1]],
  [30.25, 'cross', -1, [2.45, .75, -.85], 1], [33.9, 'weave', 1, [-2.45, -.8, .8, 2.45]],
  [37.45, 'launch', -1, [-2.4, -.8, .8, 2.1]], [41, 'cross', 1, [-2.4, -.75, .85], 1],
  [44.6, 'weave', -1, [-2.4, -.8, .8, 2.4]], [48.15, 'launch', 1, [2.45, .8, -.8, -2.2]],
  [51.75, 'cross', -1, [2.3, .75, -.9], 0], [55.3, 'weave', 1, [-2.42, -.82, .82, 2.42]],
  [58.85, 'launch', -1, [-2.4, -.8, .8, 2.2]], [62.4, 'cross', 1, [-2.45, -.75, .85], 1],
  [66, 'weave', -1, [-2.45, -.83, .83, 2.45]], [69.55, 'launch', 1, [2.4, .75, -.75, -2.2]],
  [73.1, 'cross', -1, [2.4, .75, -.8], 0], [76.7, 'weave', 1, [-2.5, -.8, .8, 2.5]],
  [80.2, 'launch', -1, [-2.4, -.8, .8, 2.15]], [83.75, 'cross', 1, [-2.45, -.7, .85], 1],
  [87.3, 'weave', -1, [-2.45, -.85, .85, 2.45]], [90.85, 'launch', 1, [2.45, .85, -.8, -2.2]],
  [94.4, 'cross', -1, [2.45, .8, -.8], 0],
];
const drops = ['homing', 'cannon', 'laser', 'omega'] as const;
export const denChallengeWaves = patrols.map(([time, course, side, lanes, guard], index) => ({
  time, course, side, lanes, guard, drop: wingRewardForWave(drops, index),
}));

export const DEN_CHALLENGE_PACE = 1.26;
const riderFire = { windup: .62, rows: 5, spacing: .176, rest: 3.5 };
const weaveFire = { ...riderFire, rows: 7 };
const guardFire = { windup: .83, rows: 7, spacing: .184, rest: 3.7 };

export function denChallengeTiming(patrol: DenPatrol) {
  return patrol.heavy ? guardFire : patrol.course === 'weave' ? weaveFire : riderFire;
}

export function denChallengeFirstShot(patrol: DenPatrol) {
  return patrol.course === 'weave' ? 1.17 + .11 * (patrol.slot % 2) : 1.83 + .12 * (patrol.slot % 2);
}

export function stepDenChallengeRider(enemy: Point & Parameters<typeof stepPatternBurst>[0], patrol: DenPatrol,
  pose: Parameters<typeof denPatrolCanFire>[0], player: Point, time: number) {
  const reach = .82 * denPatrolScale(patrol);
  const muzzle = { x: pose.x + Math.sin(pose.heading) * reach, y: pose.y - Math.cos(pose.heading) * reach };
  const timing = denChallengeTiming(patrol);
  const visible = denPatrolCanFire(pose, patrol) && muzzle.y > Math.max(-2.6, player.y + 2.5);
  const burst = stepPatternBurst(enemy, player, visible, timing);
  if (!burst) return;

  const drift = patrol.side * (.48 * burst.row / (timing.rows - 1) - .24);
  const lanes = patrol.heavy ? [-4, -3, -2, -1, 1, 2, 3, 4] : [-3, -2, -1, 1, 2, 3];
  return lanes.map(lane => {
    const side = Math.sign(lane), distance = Math.abs(lane) - 1;
    const verticalSpeed = 4.75 + .16 * side * patrol.side - .06 * distance;
    const fall = muzzle.y + 6.15;
    // Aim around the bend at the time the row reaches the lower flight lane.
    const arrival = time + fall / verticalSpeed;
    const gap = 1.42 * Math.sin(arrival * .42 - .45) + .13 * burst.target.x + drift;
    const x = gap + side * (1.41 + .63 * distance + .17 * Math.sin(patrol.slot * 1.8));
    const aim = Math.atan2(x - muzzle.x, fall);
    return patternBullet(muzzle, aim, Math.min(5.85, verticalSpeed / Math.cos(aim)),
      side === patrol.side ? 'primary' : 'accent');
  });
}

export function denChallengeTurretRow(muzzle: Point & { heading: number }, row: number) {
  const { x, y, heading } = muzzle;
  return [-.40, -.29, -.18, .18, .29, .40].map(offset =>
    patternBullet({ x, y }, heading + offset + (row - 1) * .055,
      5.18 + (row % 2) * .19, offset < 0 ? 'primary' : 'accent'));
}

export function denChallengeMineBurst(origin: Point, site: number) {
  const rotation = (site % 2 ? 1 : -1) * .22;
  return Array.from({ length: 6 }, (_, i) => rotation + i * Math.PI / 3).flatMap(spoke =>
    [-1, 0, 1].map(branch => {
      const angle = spoke + .14 * branch;
      const muzzle = { x: origin.x + .29 * Math.sin(angle), y: origin.y - .29 * Math.cos(angle) };
      return patternBullet(muzzle, angle, branch === 0 ? 4.25 : 3.27, branch === 0 ? 'primary' : 'accent');
    }));
}

export const denChallengeBoss = { health: 282, interval: DEN_CYCLE, lockAt: .51,
  first: 1.24, spacing: .16, rows: 18 } satisfies BossPattern & { health: number };
const sweepRows = 9;
const loopSpokes = 26;
const denArcTiming = { interval: DEN_CYCLE, lockAt: .47, first: 1.24,
  spacing: .043, rows: 2 * loopSpokes } satisfies BossPattern;

export function denBossPattern(cycle: number) {
  return cycle % 2 ? denArcTiming : denChallengeBoss;
}

export function denDepthBarrage(time: number, target: Point, cycle: number, row: number) {
  const sign = cycle % 4 === 1 ? 1 : -1;
  const returnPass = row >= loopSpokes, spoke = row % loopSpokes;
  const angle = Math.PI * spoke * 2 / loopSpokes + (returnPass ? .34 : 0);
  const center = { x: target.x * .24 + sign * .35, y: Math.max(-6.3, Math.min(-3.55, .68 * target.y - 1.95)) };
  const pose = denPose(time);
  return DEN_GUNS.map((gun, index) => {
    const side = index === 0 ? -1 : 1;
    const x = Math.cos(angle), y = Math.sin(angle);
    const radius = 1 + .15 * Math.cos(angle * 4);
    return depthBullet({
      origin: { ...denMount(pose, gun), z: DEN_MUZZLE_DEPTH },
      approach: 1.07 + .29 * side * Math.sin(angle + .45) + .1 * Math.cos(angle * 3),
      duration: 2.95, delay: spoke * denArcTiming.spacing,
      localX: x * radius * 1.19, localY: y * radius * 1.29,
      angle: -.48 * side, spin: -sign * side * 1.24, driftX: side * (returnPass ? -1.24 : 1.12),
      driftY: side === sign ? 1.03 : 2.5, bend: -side * (.86 + .28 * x),
      x: center.x + side * (returnPass ? 2.06 : 1.04),
      y: center.y + (side === sign ? 0 : .4) + (returnPass ? -1.1 : 0),
    }, index === 0 ? 'primary' : 'accent');
  });
}

export function denChallengeGunSignal(time: number, gun: number) {
  if (time < 0) return { charge: 0, flash: 0 };
  const cycle = Math.floor(time / DEN_CYCLE), phase = time % DEN_CYCLE;
  if (denBossPattern(cycle) === denArcTiming)
    return { charge: bossPatternCharge(phase, denArcTiming, denArcTiming.rows), flash: 0 };
  const charge = bossPatternCharge(phase, denChallengeBoss, denChallengeBoss.rows);
  const row = (phase - denChallengeBoss.first) / denChallengeBoss.spacing;
  const strength = row >= sweepRows || gun === cycle % 2 ? 1 : .55;
  const flash = row >= 0 && row < denChallengeBoss.rows ? Math.max(0, 1 - (row % 1) * 2.6) : 0;
  return { charge: charge * strength, flash: flash * strength };
}

export function denChallengeBossRow(time: number, target: Point, cycle: number, row: number) {
  const pose = denPose(time);
  if (cycle % 4 === 2) {
    const gun = (row + (row >= sweepRows ? 1 : 0)) % DEN_GUNS.length;
    const side = gun === 0 ? 1 : -1;
    return rippleRow(denMount(pose, DEN_GUNS[gun]), -.27 + .28 * Math.sin(row * .6), side, row, 20, 4.95, 1.0);
  }
  const crossing = row < sweepRows, progress = row / (denChallengeBoss.rows - 1);
  const gap = target.x * .24 + 1.64 * Math.cos(progress * Math.PI * 1.42) + .2;
  const height = Math.max(-5.9, Math.min(-4.2, target.y));
  const shots = [];
  for (const [i, gun] of DEN_GUNS.entries()) {
    const origin = denMount(pose, gun), side = i === 0 ? -1 : 1;
    for (let lane = 0; lane < 12; lane++) {
      const stride = crossing ? .49 : .44;
      const stagger = .17 * Math.sin(row * .46 - lane * .6 + side);
      const x = gap + side * (1.45 + stride * lane + stagger);
      const aim = Math.atan2(x - origin.x, origin.y - height);
      const pulse = .87 * Math.sin(lane * .57 - progress * 8.6 + side * 1.2) + .14 * side;
      const speed = 5.17 + pulse - (crossing && i === 1 ? .31 : 0);
      shots.push(patternBullet(origin, aim, speed, (i + (crossing ? 0 : lane)) % 2 ? 'accent' : 'primary'));
    }
  }
  return shots;
}
