import { HEIGHT, WIDTH } from '../playfield';
import type { WingWeapon } from '../wing';
import { easeFleet, flagshipPorts, flankShips, FLEET_SPEED, fleetViewY, hullPoint, trenchPorts, trenchShip } from './route';

type Point = { x: number; y: number };
type FleetShot = Point & {
  z: number; vx: number; vy: number; vz: number; broadside?: true;
};
type Course = 'escort' | 'sweep' | 'pincer' | 'hold';

export type FleetSaucer = {
  course: Course;
  side: -1 | 1;
  slot: number;
  heavy: boolean;
  aim?: Point;
};

type FleetWave = {
  at: number;
  course: Course;
  side: -1 | 1;
  lanes: readonly number[];
  guard?: number;
  drop?: WingWeapon;
};

export const fleetWaves: readonly FleetWave[] = [
  { at: 2.1, course: 'escort', side: 1, lanes: [-1.35, .30, 1.8], drop: 'homing' },
  { at: 7.1, course: 'sweep', side: 1, lanes: [-1.8, -.15, 1.35], drop: 'cannon' },
  { at: 12.8, course: 'pincer', side: 1, lanes: [-2.15, 2.15], drop: 'laser' },
  { at: 17.9, course: 'hold', side: -1, lanes: [-1.7, .38, 2.13], guard: 1, drop: 'omega' },
  { at: 23.5, course: 'escort', side: -1, lanes: [-1.8, 0, 1.8] },
  { at: 29.0, course: 'sweep', side: -1, lanes: [-2, -.5, 1.1], drop: 'homing' },
  { at: 34.7, course: 'pincer', side: 1, lanes: [-2.3, 2.3], drop: 'cannon' },
  { at: 39.8, course: 'hold', side: 1, lanes: [-1.4, 1.1], guard: 0, drop: 'laser' },
  { at: 45.0, course: 'escort', side: 1, lanes: [-1.95, -.24, 1.6], drop: 'omega' },
  { at: 50.3, course: 'sweep', side: 1, lanes: [-1.75, 0, 1.75] },
  { at: 55.6, course: 'pincer', side: -1, lanes: [-2.18, 2.18], drop: 'homing' },
  { at: 60.6, course: 'hold', side: -1, lanes: [-1.96, .05, 1.9], guard: 1, drop: 'cannon' },
  { at: 65.6, course: 'sweep', side: 1, lanes: [-1.25, .15, 1.55] },
  { at: 71.2, course: 'escort', side: -1, lanes: [-1.5, 0, 1.5], drop: 'laser' },
  { at: 76.5, course: 'pincer', side: -1, lanes: [-1.45, 1.45], drop: 'omega' },
  { at: 82.3, course: 'hold', side: 1, lanes: [-1.4, .2, 1.55], guard: 1, drop: 'homing' },
  { at: 87.7, course: 'sweep', side: -1, lanes: [-1.4, 0, 1.45], drop: 'cannon' },
  { at: 92.8, course: 'pincer', side: 1, lanes: [-1.45, 1.45], guard: 1, drop: 'laser' },
];

export const FLEET_SAUCER_POOL = 12;
export const FLEET_SAUCER_STAGGER = .31;
export const FLEET_SAUCER_LIFE = 11;
export const FLEET_SAUCER_WINDUP = .78;

export function saucerSize(saucer: FleetSaucer) {
  return saucer.heavy ? .88 : .62;
}

function saucerX(age: number, lane: number, saucer: FleetSaucer) {
  const t = Math.max(0, age);
  if (saucer.course === 'pincer') {
    return lane + Math.sign(lane) * (2.2 * (1 - easeFleet(t / 2.25)) - 1.2 * easeFleet((t - 3.4) / 2.6))
      + .42 * Math.sin(t * 1.56 + saucer.slot);
  }
  if (saucer.course === 'sweep') {
    return lane + saucer.side * (3.2 * (1 - easeFleet(t / 3.1)) - 1.55 * easeFleet((t - 3.0) / 3.0))
      + .53 * Math.sin(t * 1.05 + saucer.slot * .7);
  }
  if (saucer.course === 'hold') {
    return lane + saucer.side * (1.75 * (1 - easeFleet(t / 2))) + .58 * Math.sin(t * 1.7 + saucer.slot * .9);
  }
  return lane + saucer.side * 2.9 * (1 - easeFleet(t / 2.45)) + .66 * Math.sin(t * 1.47 + saucer.slot * .68);
}

export function saucerPose(age: number, lane: number, saucer: FleetSaucer) {
  const t = Math.max(0, age);
  const phase = t * (saucer.heavy ? 2.3 : 3.1) + saucer.slot * 1.37 + saucer.side;
  const glide = saucer.course === 'hold' ? 2.8 * easeFleet((t - 2.2) / 2.7) : 0;
  const speed = saucerX(t + .025, lane, saucer) - saucerX(t - .025, lane, saucer);
  return {
    x: saucerX(t, lane, saucer),
    y: 10.2 - (saucer.course === 'hold' ? 2.34 : 2.15) * age + glide + .11 * Math.sin(phase),
    pitch: .16 + .16 * Math.cos(phase * .81) + .16 * easeFleet((t - 4.0) / 2.2),
    bank: .13 * Math.sin(phase) + .44 * Math.tanh(speed * 9),
    yaw: .18 * Math.sin(phase * .48),
  };
}

export function saucerCanFire(point: Point, saucer: FleetSaucer) {
  const radius = saucerSize(saucer);
  return Math.abs(point.x) <= WIDTH / 2 - radius - .12 && point.y < HEIGHT / 2 - radius - .45 && point.y > -3.85;
}

export function saucerVolley(origin: Point, target: Point, saucer: FleetSaucer): FleetShot[] {
  const aim = Math.atan2(target.x - origin.x, Math.max(1.1, origin.y - target.y));
  const radius = saucerSize(saucer);
  return (saucer.heavy ? [-.25, 0, .25] : [0]).map(spread => {
    const angle = aim + spread;
    const x = Math.sin(angle), y = -Math.cos(angle), speed = saucer.heavy ? 4.95 : 5.25;
    return { x: origin.x + x * .47 * radius, y: origin.y + y * .47 * radius, z: 0, vx: x * speed, vy: y * speed, vz: 0 };
  });
}

export const BROADSIDE_BARREL = .49;
const BROADSIDE_WINDUP = 1.06;
const BURST = [0, .17, .34] as const;
const BROADSIDE_FLASH = .16;

type GunSite = Point & { side: -1 | 1; fires: readonly number[] };

function gunSite(point: Point, side: -1 | 1, trench: boolean): GunSite {
  const targets = trench ? [2.65, -4.65] : [4.1, -4.75];
  const fires = targets.flatMap(y => {
    const at = (point.y - y) / FLEET_SPEED;
    return at < 3.2 ? [] : BURST.map(offset => at + offset);
  });
  return { ...point, side, fires };
}

export const broadsideGuns = [
  ...flankShips.flatMap(hull => flagshipPorts.map(([u, v]) => gunSite(hullPoint(hull, u, v), 1, false))),
  ...trenchPorts.map(([u, v, side]) => gunSite(hullPoint(trenchShip, u, v), side, true)),
];

export function broadsideSignal(gun: GunSite, time: number) {
  let charge = 0, flash = 0;
  for (const at of gun.fires) {
    const until = at - time;
    if (until > 0 && until < BROADSIDE_WINDUP) charge = Math.max(charge, 1 - until / BROADSIDE_WINDUP);
    if (until <= 0 && until > -BROADSIDE_FLASH) flash = Math.max(flash, 1 + until / BROADSIDE_FLASH);
  }
  return { charge, flash };
}

export function broadsideShots(from: number, to: number) {
  const shots: FleetShot[] = [];
  for (const gun of broadsideGuns) {
    const y = fleetViewY(gun.y, to);
    if (Math.abs(y) > HEIGHT / 2 - .24) continue;
    for (const at of gun.fires) {
      if (at <= from || at > to) continue;
      shots.push({ x: gun.x + BROADSIDE_BARREL * gun.side, y, z: 0, vx: gun.side * 6.3, vy: -.38, vz: 0, broadside: true });
    }
  }
  return shots;
}
