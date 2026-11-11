import { ellipseEntry } from '../../planar-contact';

type Point = { x: number; y: number };
type Side = -1 | 1;
export const FONS_NAME = 'FONS INVERSUS';
export const FONS_HP = 124;
export const FONS_APPROACH = 3.25;
export const FONS_CYCLE = 18.6;
export const FONS_RAIN_AT = 11.65;
export const FONS_RAIN_END = 14.65;
const PULL_AT = 7.05;
const RELEASE_AT = 10.25;
const shotsAt = [1.02, 2.12, 3.22] as const;

const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export function fonsEase(a: number, b: number, value: number) {
  const u = clamp((value - a) / (b - a));
  return u * u * (3 - 2 * u);
}

export function fonsPhase(time: number) {
  const cycle = Math.floor(Math.max(0, time) / FONS_CYCLE);
  const age = time - cycle * FONS_CYCLE;
  const rain = age >= FONS_RAIN_AT && age < FONS_RAIN_END;
  return {
    cycle, age, rain,
    warning: fonsEase(FONS_RAIN_AT - 1.0, FONS_RAIN_AT, age) * (age < FONS_RAIN_AT ? 1 : 0),
    pull: fonsEase(PULL_AT - .45, PULL_AT + 1.2, age) * (1 - fonsEase(RELEASE_AT - .3, RELEASE_AT + .45, age)),
    lift: fonsEase(PULL_AT + .2, FONS_RAIN_AT + .25, age) * (1 - fonsEase(FONS_RAIN_END, FONS_RAIN_END + 1.4, age)),
    recovery: fonsEase(FONS_RAIN_END - .1, FONS_RAIN_END + .42, age) * (1 - fonsEase(FONS_RAIN_END + .9, FONS_RAIN_END + 1.8, age)),
  };
}

export function fonsPose(time: number) {
  const state = fonsPhase(time);
  const t = Math.max(0, time);
  const arrival = fonsEase(-FONS_APPROACH + .2, -.10, time);
  const stride = 1 - state.lift * .66;
  return {
    x: (1.38 * Math.sin(t * 1.04) + .27 * Math.sin(t * 1.92)) * stride * arrival,
    y: 3.64 + 1.25 * (1 - arrival) + (.48 * Math.sin(t * 1.4) + .19 * Math.sin(t * 2.51)) * stride,
    depth: mix(-74, -7.8, arrival) - .72 * Math.sin(t * .78),
    scale: mix(.18, 1, arrival),
    yaw: (.45 * Math.sin(t * 1.04 + .65) + .10 * Math.sin(t * 1.8)) * stride,
    pitch: .10 * Math.cos(t * 1.35) - state.lift * .19,
    bank: (.225 * Math.sin(t * 1.04 + .9) - .063 * Math.sin(t * 1.77)) * stride,
  };
}

export function fonsBodyEntry(time: number, a: Point, b: Point) {
  const pose = fonsPose(time);
  // The mirror is solid and the moving cloth is cosmetic. Yaw changes its
  // projected width and the contact follows the same center as the rig.
  return ellipseEntry(a, b, pose, 0, .85 * Math.cos(pose.yaw), 1.35);
}

export function fonsEmitter(pose: ReturnType<typeof fonsPose>, side: Side) {
  const x = side * 1.22, y = -.88;
  const c = Math.cos(pose.bank), s = Math.sin(pose.bank);
  return { x: pose.x + x * c - y * s, y: pose.y + x * s + y * c };
}

export function fonsBeams(time: number, pose = fonsPose(time)) {
  const { age, cycle } = fonsPhase(time);
  const order: Side = cycle % 2 ? 1 : -1;
  return [0, 1].map(index => {
    const side: Side = index === 0 ? order : order === -1 ? 1 : -1;
    const start = index === 0 ? 4.12 : 5.61;
    const stop = start + 1.04;
    const active = age >= start && age < stop;
    const warning = age < start ? fonsEase(start - .78, start - .06, age) : 0;
    const sweep = fonsEase(start, stop, age);
    return {
      from: fonsEmitter(pose, side),
      to: { x: side * (index === 0 ? mix(5.2, -.56, sweep) : mix(-.56, 5.2, sweep)), y: -8.7 },
      width: index === 0 ? .27 : .32,
      active, warning,
    };
  });
}

export function fonsBeamHits(time: number, player: Point) {
  return fonsBeams(time).some(({ from, to, width, active }) => {
    if (!active) return false;
    const dx = to.x - from.x, dy = to.y - from.y;
    const t = clamp(((player.x - from.x) * dx + (player.y - from.y) * dy) / (dx * dx + dy * dy));
    return Math.hypot(player.x - from.x - dx * t, player.y - from.y - dy * t) < width + .18;
  });
}

export function fonsVolleys(time: number, dt: number, player: Point) {
  const { age, cycle } = fonsPhase(time);
  const shots: (Point & { z: number; vx: number; vy: number; vz: number; planar: true })[] = [];
  for (const [index, at] of shotsAt.entries()) {
    if (at <= age - dt || at > age) continue;
    const side: Side = (index + cycle) % 2 === 0 ? -1 : 1;
    const origin = fonsEmitter(fonsPose(cycle * FONS_CYCLE + at), side);
    const aim = Math.atan2(clamp(player.x, -2.9, 2.9) - origin.x, Math.max(2.9, origin.y - player.y));
    for (let i = -3; i <= 3; i++) {
      const angle = aim + i * .17;
      const speed = 5.35 + .24 * Math.abs(i);
      shots.push({ ...origin, z: 0, vx: speed * Math.sin(angle), vy: -speed * Math.cos(angle), vz: 0, planar: true });
    }
  }
  return shots;
}

const wallSites = [
  { side: -1, y: 1.28, rx: 1.15, ry: .67, drift: .32, lane: -2.1 },
  { side: 1, y: .42, rx: 1.03, ry: .76, drift: -.29, lane: 2.18 },
] as const;

export function fonsRocks(time: number, pose = fonsPose(time)) {
  const { age } = fonsPhase(time);
  return wallSites.map((site, index) => {
    const start = PULL_AT + index * .32;
    const swallow = 9.60 + index * .22;
    const pull = fonsEase(start, swallow, age);
    const eat = fonsEase(.69, 1, pull);
    const dropAge = age - RELEASE_AT - index * .21;
    const ejected = dropAge >= 0;
    const release = fonsEase(0, .88, dropAge);
    const fall = Math.max(0, dropAge - .88);
    const pastRain = Math.max(0, age - FONS_RAIN_END);
    const anchorX = site.side * 4.49, anchorY = site.y + .16 * Math.sin(time * .78 + index);
    const x = ejected ? mix(pose.x, site.lane + site.drift * fall, release) : mix(anchorX, pose.x, pull);
    const fallY = 2.24 - index * .45 - fall * 1.24 - pastRain * pastRain * .45;
    const y = ejected ? mix(pose.y - .48, fallY, release) : mix(anchorY, pose.y - .20, pull);
    const scale = ejected ? mix(.16, 1, release) : 1 - .93 * eat;
    return {
      x, y, rx: site.rx * scale, ry: site.ry * scale,
      depth: ejected ? mix(-6.5, .22, release) : mix(-4.4, -7.2, pull),
      spin: .16 * Math.sin(time * .91 + index) + site.side * (pull * .47 + release * .31),
      pull: !ejected && age >= start && age < swallow ? fonsEase(start, start + .36, age) * (1 - eat) : 0,
      visible: ejected ? y > -9.6 : age < swallow,
      falling: ejected && release >= 1 && y > -9.6,
      cover: site.rx * .78 * scale,
    };
  });
}

type Rocks = ReturnType<typeof fonsRocks>;
export function fonsSheltered(rocks: Rocks, player: Point) {
  return rocks.some(rock => rock.falling && player.y < rock.y && Math.abs(player.x - rock.x) < rock.cover);
}

export function fonsRockHits(rocks: Rocks, player: Point) {
  return rocks.some(rock => rock.falling &&
    ((player.x - rock.x) / (rock.cover + .15)) ** 2 + ((player.y - rock.y) / (rock.ry * .82 + .15)) ** 2 < 1);
}
