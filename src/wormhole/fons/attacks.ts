import { BOSS_CAMERA_DISTANCE, WIDTH } from '../../playfield';
import { FONS_CYCLE, fonsEase, fonsEmitter, fonsPhase, fonsPose, fonsTuskPaths, type FonsTusk } from './combat';
import type { FonsVariant } from './variants';

type Point = { x: number; y: number };
type Side = -1 | 1;
type Shot = Point & { z: number; vx: number; vy: number; vz: number; planar: true };
type Beam = { from: Point; to: Point; width: number; active: boolean; warning: number; impact?: number };

const standardVolleys = [1.02, 1.78, 2.54, 3.30];
const crownfire = [
  { at: 1.38, tusks: 'outer' },
  { at: 1.98, tusks: 'inner' },
  { at: 2.95, tusks: 'outer' },
  { at: 3.55, tusks: 'inner' },
] as const;
const crownfireCharge = .50;
const horizonCharge = 4.24;
const horizonStrike = 4.93;
const horizonReturn = 5.63;
const horizonEnd = 6.91;
const horizonAfterglow = 7.12;

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

export function fonsTuskTip(pose: ReturnType<typeof fonsPose>, side: Side, tusk: FonsTusk) {
  const path = fonsTuskPaths[tusk];
  const [localX, y, z] = path[path.length - 1];
  const x = localX * side;
  // The rig's XYZ Euler applies bank, yaw, then pitch to each tip. Its
  // depth compensation cancels out when projected back to the flight plane.
  const bankX = x * Math.cos(pose.bank) - y * Math.sin(pose.bank);
  const bankY = x * Math.sin(pose.bank) + y * Math.cos(pose.bank);
  const yawX = bankX * Math.cos(pose.yaw) + z * Math.sin(pose.yaw);
  const yawZ = z * Math.cos(pose.yaw) - bankX * Math.sin(pose.yaw);
  const pitchY = bankY * Math.cos(pose.pitch) - yawZ * Math.sin(pose.pitch);
  const pitchZ = bankY * Math.sin(pose.pitch) + yawZ * Math.cos(pose.pitch);
  const projection = 1 - pitchZ * pose.scale / BOSS_CAMERA_DISTANCE;
  return {
    x: (pose.x + yawX * pose.scale) / projection,
    y: (pose.y + pitchY * pose.scale) / projection,
  };
}

export function fonsCrownfireFlash(age: number, variant: FonsVariant) {
  if (variant === 'normal') return;
  for (const { at, tusks } of crownfire) {
    if (age <= at - crownfireCharge || age >= at + .10) continue;
    return {
      tusks,
      power: age < at
        ? .78 * fonsEase(at - crownfireCharge, at, age)
        : 1 - fonsEase(at, at + .10, age),
    };
  }
}

export function fonsAttackCue(age: number, variant: FonsVariant) {
  if (variant === 'invictus' && age >= horizonCharge && age < horizonEnd)
    return 'False Horizon · Watch the wall strike';
  if (variant !== 'normal' && age >= crownfire[0].at - crownfireCharge && age < 4.45)
    return 'Crownfire · Thread the staggered fans';
}

export function fonsBeams(time: number, variant: FonsVariant = 'normal', pose = fonsPose(time)): [Beam, Beam] {
  const { age, cycle } = fonsPhase(time);
  const side: Side = cycle % 2 ? 1 : -1;
  if (variant === 'invictus') {
    const wall = { x: side * (WIDTH / 2 - .22), y: 2.48 };
    const sweep = fonsEase(horizonReturn, horizonEnd, age);
    return [{
      from: fonsEmitter(pose, side), to: wall, width: .25,
      active: age >= horizonStrike && age < horizonReturn + .08,
      warning: age < horizonStrike ? fonsEase(horizonCharge, horizonStrike - .06, age) : 0,
    }, {
      from: wall, to: { x: side * mix(-3.15, 5.25, sweep), y: -8.7 }, width: .34,
      active: age >= horizonReturn && age < horizonEnd,
      warning: age < horizonReturn ? fonsEase(horizonStrike + .06, horizonReturn - .11, age) : 0,
      impact: fonsEase(horizonStrike, horizonStrike + .10, age) * (1 - fonsEase(horizonEnd - .12, horizonAfterglow, age)),
    }];
  }
  const offset = variant === 'rex' ? .44 : 0;
  function sweep(index: number): Beam {
    const direction: Side = index === 0 ? side : side === -1 ? 1 : -1;
    const start = (index === 0 ? 4.12 : 5.61) + offset;
    const stop = start + 1.04;
    const progress = fonsEase(start, stop, age);
    return {
      from: fonsEmitter(pose, direction),
      to: { x: direction * (index === 0 ? mix(5.2, -.56, progress) : mix(-.56, 5.2, progress)), y: -8.7 },
      width: index === 0 ? .27 : .32,
      active: age >= start && age < stop,
      warning: age < start ? fonsEase(start - .78, start - .06, age) : 0,
    };
  }
  return [sweep(0), sweep(1)];
}

export function fonsBeamHits(time: number, player: Point, variant: FonsVariant = 'normal') {
  return fonsBeams(time, variant).some(({ from, to, width, active }) => {
    if (!active) return false;
    const dx = to.x - from.x, dy = to.y - from.y;
    const along = ((player.x - from.x) * dx + (player.y - from.y) * dy) / (dx * dx + dy * dy);
    const t = Math.max(0, Math.min(1, along));
    return Math.hypot(player.x - from.x - dx * t, player.y - from.y - dy * t) < width + .18;
  });
}

export function fonsVolleys(time: number, dt: number, player: Point, variant: FonsVariant = 'normal') {
  const { age, cycle } = fonsPhase(time);
  const shots: Shot[] = [];
  const crossed = (at: number) => at > age - dt && at <= age;
  function emit(origin: Point, angle: number, speed: number) {
    shots.push({ ...origin, z: 0, vx: speed * Math.sin(angle), vy: -speed * Math.cos(angle), vz: 0, planar: true });
  }
  if (variant === 'normal') {
    for (const [index, at] of standardVolleys.entries()) {
      if (!crossed(at)) continue;
      const side: Side = (index + cycle) % 2 === 0 ? -1 : 1;
      const origin = fonsEmitter(fonsPose(cycle * FONS_CYCLE + at), side);
      const aim = Math.atan2(Math.max(-2.9, Math.min(2.9, player.x)) - origin.x, Math.max(2.9, origin.y - player.y));
      for (let i = -3; i <= 3; i++) emit(origin, aim + i * .17, 6.1 + .24 * Math.abs(i));
    }
    return shots;
  }

  for (const [index, { at, tusks }] of crownfire.entries()) {
    if (!crossed(at)) continue;
    const pose = fonsPose(cycle * FONS_CYCLE + at);
    const order = (cycle + Math.floor(index / 2)) % 2 === 0 ? -1 : 1;
    const outer = tusks === 'outer';
    // The second pair sends bolts into the first fan's gaps near the lower
    // flight lane. Fons alternates which side has more room in each doublet.
    for (let i = outer ? -3 : -2; i <= 2; i++) {
      const lane = i + (outer ? .5 : 0);
      const side = lane === 0 ? order : lane < 0 ? -1 : 1;
      const origin = fonsTuskTip(pose, side, tusks);
      const laneX = lane * 1.43 + order * .37;
      emit(origin, Math.atan2(laneX - origin.x, origin.y + 5.35), outer ? 6.30 : 6.65);
    }
  }
  return shots;
}
