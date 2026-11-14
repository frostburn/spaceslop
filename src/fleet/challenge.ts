import { bossPatternCharge, patternBullet, stepPatternBurst, type BossPattern } from '../challenge-patterns';
import { wingRewardForWave } from '../wing';
import { FLEET_BOSS_MOUNTS, fleetBossPose, type FleetBossPort } from './boss';
import { saucerCanFire, saucerSize, type broadsideShots, type FleetSaucer } from './combat';
import { projectedSaucerMount } from './route';

type Point = { x: number; y: number };
type Patrol = readonly [at: number, course: FleetSaucer['course'], side: FleetSaucer['side'], lanes: readonly number[], guard?: number];

const patrols: readonly Patrol[] = [
  [1.4, 'escort', 1, [-2.2, -.75, .75, 2.2]], [4.8, 'pincer', -1, [-2.15, 2.15, -.75, .75]],
  [8.2, 'sweep', 1, [-2.4, -1.05, .25, 1.65]], [11.7, 'hold', -1, [-2.25, .15, 2.3], 1],
  [15.1, 'escort', -1, [-2.4, -.85, .85, 2.4]], [18.55, 'pincer', 1, [2.1, -2.1, .75, -.75]],
  [21.95, 'sweep', -1, [2.4, 1.05, -.25, -1.65]], [25.45, 'hold', 1, [-2.2, -.15, 2.15], 1],
  [28.95, 'escort', 1, [-2.4, -.8, .8, 2.4]], [32.4, 'pincer', -1, [-2.25, 2.25, -.75, .75]],
  [35.8, 'sweep', 1, [-2.5, -1.1, .24, 1.7]], [39.25, 'hold', -1, [-2.35, .4, 2.2], 0],
  [42.75, 'pincer', 1, [2.15, -2.15, .8, -.8]], [46.1, 'escort', -1, [-2.45, -.85, .85, 2.45]],
  [49.6, 'sweep', -1, [2.45, 1.05, -.2, -1.7]], [53, 'hold', 1, [-2.2, -.35, 2.3], 2],
  [56.5, 'escort', 1, [-2.35, -.8, .8, 2.35]], [59.95, 'pincer', -1, [-2.2, 2.2, -.8, .8]],
  [63.4, 'sweep', 1, [-2.4, -1.15, .25, 1.65]], [66.85, 'hold', -1, [-2.15, -.3, 2.25], 1],
  [70.2, 'escort', -1, [-2.3, -.8, .8, 2.3]], [73.5, 'pincer', 1, [2.1, -2.1, .75, -.75]],
  [76.8, 'sweep', -1, [2.45, 1, -.2, -1.65]], [80.15, 'hold', 1, [-2.2, .1, 2.2], 1],
  [83.55, 'escort', 1, [-2.4, -.8, .8, 2.4]], [86.85, 'sweep', 1, [-2.5, -1.1, .2, 1.75]],
  [90.2, 'pincer', -1, [-2.25, 2.25, -.8, .8]], [93.6, 'hold', -1, [-2.2, .2, 2.2], 1],
];
const drops = ['homing', 'cannon', 'laser', 'omega'] as const;
export const fleetChallengeWaves = patrols.map(([at, course, side, lanes, guard], index) => ({
  at, course, side, lanes, guard, drop: wingRewardForWave(drops, index),
}));

export const FLEET_CHALLENGE_PACE = 1.23;
const escortFire = { windup: .67, rows: 5, spacing: .185, rest: 3.7 };
const crossingFire = { ...escortFire, rows: 4 };
const guardFire = { windup: .89, rows: 7, spacing: .183, rest: 3.65 };

export function fleetChallengeTiming(saucer: FleetSaucer) {
  return saucer.heavy ? guardFire : saucer.course === 'pincer' ? crossingFire : escortFire;
}

export function fleetChallengeFirstShot(saucer: FleetSaucer) {
  return (saucer.course === 'hold' ? 2.02 : 1.59) + .15 * (saucer.slot % 2);
}

export function stepFleetChallengeSaucer(enemy: Point & Parameters<typeof stepPatternBurst>[0],
  saucer: FleetSaucer, player: Point, time: number) {
  const timing = fleetChallengeTiming(saucer);
  const muzzle = { x: enemy.x, y: enemy.y - .47 * saucerSize(saucer) };
  const open = { x: 1.39 * Math.sin(time * .37 + .72) + player.x * .14, y: -6.05 };
  const visible = saucerCanFire(enemy, saucer) && muzzle.y > Math.max(-2.55, player.y + 2.5);
  const burst = stepPatternBurst(enemy, open, visible, timing);
  if (!burst) return;
  const turn = (burst.row / (timing.rows - 1) - .5) * Math.PI;
  const gap = burst.target.x + saucer.side * .49 * Math.sin(turn);
  const arcs = saucer.heavy ? [-4, -3, -2, -1, 1, 2, 3, 4] : [-3, -2, -1, 1, 2, 3];
  return arcs.map(lane => {
    const side = Math.sign(lane), distance = Math.abs(lane) - 1;
    const ripple = Math.cos(turn + distance * .81 + side * saucer.side * .45);
    const x = gap + side * (1.5 + distance * .58 + .19 * ripple);
    const aim = Math.atan2(x - muzzle.x, muzzle.y - burst.target.y);
    return patternBullet(muzzle, aim, 5.34 + .19 * ripple - .07 * distance,
      (lane + saucer.slot) % 2 ? 'primary' : 'accent');
  });
}

export function fleetChallengeBroadside(bolts: ReturnType<typeof broadsideShots>) {
  return bolts.flatMap(bolt => {
    const side = Math.sign(bolt.vx);
    return [.24, .43].map((down, i) => patternBullet({ x: bolt.x, y: bolt.y },
      side * (Math.PI / 2 - down), 5.22 - i * .37, i === 0 ? 'primary' : 'accent'));
  });
}

export const fleetChallengeBoss = { health: 268, interval: 6.4, lockAt: .5,
  first: 1.18, spacing: .17, rows: 21 } satisfies BossPattern & { health: number };
const sideRows = 13;
const wheelStart = fleetChallengeBoss.first + sideRows * fleetChallengeBoss.spacing;
const wheelTiming = { ...fleetChallengeBoss, first: wheelStart, lockAt: wheelStart - .64 };

export function fleetChallengeGunSignal(time: number, port: FleetBossPort) {
  if (time < 0) return { charge: 0, flash: 0 };
  const phase = time % fleetChallengeBoss.interval, wheel = port === 2;
  const timing = wheel ? wheelTiming : fleetChallengeBoss;
  const rows = wheel ? timing.rows - sideRows : sideRows;
  const row = (phase - timing.first) / timing.spacing;
  const charge = bossPatternCharge(phase, timing, rows);
  const flash = row >= 0 && row < rows ? Math.max(0, 1 - (row % 1) * 2.4) : 0;
  return { charge, flash };
}

export function fleetChallengeBossRow(time: number, target: Point, cycle: number, row: number) {
  const pose = fleetBossPose(time);
  const reverse = cycle % 2 ? -1 : 1;
  const height = Math.max(-5.65, Math.min(-4.1, target.y));
  if (row >= sideRows) {
    const origin = projectedSaucerMount(pose, FLEET_BOSS_MOUNTS[2]);
    const spoke = row - sideRows;
    const gap = target.x * .28 + reverse * (1.42 - .38 * spoke);
    const count = 30, shots = [];
    for (let i = 0; i < count; i++) {
      const angle = i * 2 * Math.PI / count + reverse * (.064 * spoke + .11);
      const x = origin.x + (origin.y - height) * Math.tan(angle);
      // Turn the wheel around a gap that travels along the lower flight lane.
      if (Math.cos(angle) > 0 && Math.abs(x - gap) < 1.62) continue;
      shots.push(patternBullet(origin, angle, 4.95 + .2 * (i % 2) + .18 * Math.sin(spoke * .8),
        (i + spoke) % 2 ? 'primary' : 'accent'));
    }
    return shots;
  }

  const progress = row / (sideRows - 1);
  const gap = target.x * .23 + reverse * (2 * progress - 1) * 1.7;
  const shots = [];
  for (const port of [0, 1] as const) {
    const origin = projectedSaucerMount(pose, FLEET_BOSS_MOUNTS[port]);
    const side = (port === 0 ? -1 : 1) * (cycle % 4 < 2 ? 1 : -1);
    for (let i = 0; i < 11; i++) {
      const curl = Math.sin(i * .5 - progress * 2.6 + side * .55);
      const x = gap + side * (1.53 + .48 * i + .14 * curl);
      const aim = Math.atan2(x - origin.x, origin.y - height);
      shots.push(patternBullet(origin, aim, 5.25 + .37 * curl + .10 * side * reverse,
        port === 0 ? 'primary' : 'accent'));
    }
  }
  return shots;
}
