import { BOSS_CAMERA_DISTANCE, WIDTH } from '../../playfield';
import { patternBullet, type PatternColor } from '../../challenge-patterns';
import { FONS_CYCLE, FONS_RAIN_END, fonsEase, fonsEmitter, fonsPhase, fonsPose, fonsTuskPaths, type FonsTusk } from './combat';
import type { FonsVariant } from './variants';

type Point = { x: number; y: number };
type Side = -1 | 1;
type Shot = Point & { z: number; vx: number; vy: number; vz: number; planar: true; pattern?: PatternColor };
type Beam = { from: Point; to: Point; width: number; active: boolean; warning: number; impact?: number };

const standardVolleys = [1.02, 1.78, 2.54, 3.30];
type Barrage = { first: number; spacing: number; rows: number };
const crownfire = {
  rex: [{ first: 1.12, spacing: .126, rows: 22 }, { first: FONS_RAIN_END + 2.14, spacing: .156, rows: 6 }],
  invictus: [{ first: 1.04, spacing: .117, rows: 22 }, { first: FONS_RAIN_END + 1.89, spacing: .144, rows: 8 }],
} satisfies Record<Exclude<FonsVariant, 'normal'>, readonly Barrage[]>;
const horizonRows = { first: 4.96, spacing: .145, rows: 7 };
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

const endOf = (barrage: Barrage) => barrage.first + (barrage.rows - 1) * barrage.spacing;

function crownfireTusks(row: number, encore: boolean): FonsTusk {
  return (row + Number(encore)) % 2 === 0 ? 'outer' : 'inner';
}

export function fonsCrownfireStart(variant: Exclude<FonsVariant, 'normal'>) {
  return crownfire[variant][0].first - crownfireCharge;
}

export function fonsCrownfireFlash(age: number, variant: FonsVariant) {
  const power = { outer: 0, inner: 0 };
  if (variant === 'normal') return power;
  for (const [index, barrage] of crownfire[variant].entries()) {
    if (age <= barrage.first - crownfireCharge || age > endOf(barrage) + .13) continue;
    for (const tusks of ['outer', 'inner'] as const) {
      const first = barrage.first + (crownfireTusks(0, index > 0) === tusks ? 0 : barrage.spacing);
      if (age <= first - crownfireCharge) continue;
      const row = Math.max(0, Math.min(barrage.rows - 1, Math.floor((age - barrage.first + 1e-8) / barrage.spacing)));
      const elapsed = Math.max(0, age - barrage.first - row * barrage.spacing);
      const live = age < first ? .68 * fonsEase(first - crownfireCharge, first, age)
        : Math.max(0, 1 - elapsed / .13) * (crownfireTusks(row, index > 0) === tusks ? 1 : .26);
      power[tusks] = live;
    }
  }
  return power;
}

export function fonsAttackCue(age: number, variant: FonsVariant) {
  if (variant === 'invictus' && age >= horizonCharge && age < horizonEnd)
    return age < horizonReturn ? 'False Horizon · Move away from the glowing wall' : 'False Horizon · Stay ahead of the sweep';
  if (variant !== 'normal') {
    if (crownfire[variant].some(barrage => age >= barrage.first - crownfireCharge && age < endOf(barrage) + .35))
      return variant === 'rex' ? 'Crownfire · Follow the gap between the fans' : 'Crownfire · Follow the opening in the braid';
  }
}

function horizonWall(cycle: number) {
  const side: Side = cycle % 2 ? 1 : -1;
  return { side, x: side * (WIDTH / 2 - .22), y: 2.48 };
}

export function fonsBeams(time: number, variant: FonsVariant = 'normal', pose = fonsPose(time)): [Beam, Beam] {
  const { age, cycle } = fonsPhase(time);
  const side: Side = cycle % 2 ? 1 : -1;
  if (variant === 'invictus') {
    const { x, y } = horizonWall(cycle);
    const wall = { x, y };
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

function royalFan(time: number, variant: Exclude<FonsVariant, 'normal'>, target: Point, cycle: number,
  row: number, barrage: Barrage, encore: boolean) {
  const pose = fonsPose(time);
  const invictus = variant === 'invictus';
  const tusks = crownfireTusks(row, encore);
  const progress = row / (barrage.rows - 1);
  const turn = cycle % 2 ? -1 : 1;
  const phase = progress * Math.PI * 2;
  // Finish toward the side opposite the False Horizon warning, which is mirrored each cycle.
  const sweep = invictus ? -1.55 * Math.cos(progress * Math.PI) + .46 * Math.sin(phase * 2)
    : 1.78 * Math.cos(phase + .25);
  const gap = target.x * .22 + turn * sweep * (encore ? .66 : 1);
  const height = -6.10;
  const count = encore ? 9 : 11;
  const shots = [];
  for (const side of [-1, 1] as const) {
    const origin = fonsTuskTip(pose, side, tusks);
    const direction = invictus && tusks === 'inner' && !encore ? -side : side;
    for (let lane = 0; lane < count; lane++) {
      const ripple = Math.sin(phase * 1.25 - lane * .51 + side * turn);
      const stagger = tusks === 'inner' ? .21 : 0;
      const x = gap + direction * (1.64 + stagger + lane * .43 + .13 * ripple);
      const aim = Math.atan2(x - origin.x, origin.y - height);
      const speed = 5.18 + .27 * ripple + (tusks === 'inner' ? -.15 : .15) + (invictus ? .12 : 0);
      const primary = invictus ? (lane + row) % 2 === 0 : side === turn;
      shots.push(patternBullet(origin, aim, speed, primary ? 'primary' : 'accent'));
    }
  }
  return shots;
}

function horizonFan(cycle: number, row: number) {
  const { side, x, y } = horizonWall(cycle);
  const phase = row / (horizonRows.rows - 1);
  return Array.from({ length: 8 }, (_, lane) => {
    // The shards spread through the upper chamber while the beam sweeps below.
    const aim = -side * (1.32 + lane * .052 + phase * .13);
    return patternBullet({ x, y }, aim, 4.87 + .19 * Math.sin(row * .63 - lane * .58), lane % 2 ? 'accent' : 'primary');
  });
}

export function fonsVolleys(time: number, dt: number, player: Point, variant: FonsVariant = 'normal', crownfireTarget = player): Shot[] {
  const { age, cycle } = fonsPhase(time);
  const shots: Shot[] = [];
  const crossed = (at: number) => at > age - dt && at <= age;
  if (variant === 'normal') {
    for (const [index, at] of standardVolleys.entries()) {
      if (!crossed(at)) continue;
      const side: Side = (index + cycle) % 2 === 0 ? -1 : 1;
      const origin = fonsEmitter(fonsPose(cycle * FONS_CYCLE + at), side);
      const aim = Math.atan2(Math.max(-2.9, Math.min(2.9, player.x)) - origin.x, Math.max(2.9, origin.y - player.y));
      for (let i = -3; i <= 3; i++) {
        const angle = aim + i * .17, speed = 6.1 + .24 * Math.abs(i);
        shots.push({ ...origin, z: 0, vx: speed * Math.sin(angle), vy: -speed * Math.cos(angle), vz: 0, planar: true });
      }
    }
    return shots;
  }

  for (const [index, barrage] of crownfire[variant].entries()) {
    for (let row = 0; row < barrage.rows; row++) {
      const at = barrage.first + row * barrage.spacing;
      if (crossed(at)) shots.push(...royalFan(cycle * FONS_CYCLE + at, variant, crownfireTarget, cycle, row, barrage, index > 0));
    }
  }
  if (variant === 'invictus') for (let row = 0; row < horizonRows.rows; row++) {
    if (crossed(horizonRows.first + row * horizonRows.spacing)) shots.push(...horizonFan(cycle, row));
  }
  return shots;
}
