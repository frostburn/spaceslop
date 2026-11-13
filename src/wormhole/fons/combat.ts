import { ellipseEntry } from '../../planar-contact';
import { WIDTH } from '../../playfield';

type Point = { x: number; y: number };
type Side = -1 | 1;
export const FONS_HP = 144;
export const FONS_APPROACH = 3.25;
export const FONS_CYCLE = 18.6;
export const FONS_RAIN_AT = 11.65;
export const FONS_RAIN_END = 14.65;
const BREACH_AT = 7.12;

export const fonsTuskPaths = {
  inner: [[.44, -1.02, .47], [.49, -1.41, .77], [.77, -1.53, .94], [.98, -1.29, .93], [.99, -.91, .86]],
  outer: [[.68, -.56, .40], [1.12, -.86, .68], [1.61, -.70, .91], [1.83, -.17, 1.01], [1.71, .50, .91]],
} as const;
export type FonsTusk = keyof typeof fonsTuskPaths;

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
  const wrap = fonsEase(FONS_RAIN_AT - 2.30, FONS_RAIN_AT - 1.10, age) *
    (1 - fonsEase(FONS_RAIN_END + .12, FONS_RAIN_END + 1.20, age));
  return {
    cycle, age, rain, wrap, shielded: wrap >= .93,
    warning: fonsEase(FONS_RAIN_AT - 1.0, FONS_RAIN_AT, age) * (age < FONS_RAIN_AT ? 1 : 0),
    openingRifts: age >= BREACH_AT && age < FONS_RAIN_AT - 1.0,
    lift: fonsEase(BREACH_AT + .13, FONS_RAIN_AT + .25, age) * (1 - fonsEase(FONS_RAIN_END, FONS_RAIN_END + 1.4, age)),
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
  // Keep contact aligned to the projected mirror as the rig yaws. The
  // closed cloak intercepts damage to this same target.
  return ellipseEntry(a, b, pose, 0, .85 * Math.cos(pose.yaw), 1.35);
}

export function fonsEmitter(pose: ReturnType<typeof fonsPose>, side: Side) {
  const x = side * 1.22, y = -.88;
  const c = Math.cos(pose.bank), s = Math.sin(pose.bank);
  return { x: pose.x + x * c - y * s, y: pose.y + x * s + y * c };
}

const wallSites = [
  { side: -1, y: 3.58, rx: 1.15, ry: .67, drift: .265, lane: -2.19 },
  { side: 1, y: 2.67, rx: 1.03, ry: .76, drift: -.25, lane: 2.24 },
] as const;

export function fonsRocks(time: number) {
  const { age } = fonsPhase(time);
  return wallSites.map((site, index) => {
    const breach = BREACH_AT + index * .49;
    const emerge = breach + .57;
    const settled = 10.28 + index * .37;
    const entry = fonsEase(emerge, settled, age);
    const fall = Math.max(0, age - settled);
    const drift = fall + .29 * Math.expm1(-fall / .29);
    const pastRain = Math.max(0, age - FONS_RAIN_END);
    const recession = fonsEase(0, FONS_CYCLE - FONS_RAIN_END, pastRain);
    const opening = fonsEase(breach, breach + .82, age) * (1 - fonsEase(settled - .62, settled + .14, age));
    const x = mix(site.side * (WIDTH / 2 + 1.22), site.lane, entry) + site.drift * drift;
    const y = mix(site.y + .37, 2.51 - index * .41, entry) - drift * 1.20 - .35 * pastRain * pastRain;
    const scale = mix(.62, 1, entry) / (1 + recession * 2.6);
    const depth = mix(-17, .22, entry) - recession * 57.2;
    const visible = age >= emerge && y + site.ry * scale > -8.1;
    const covering = age >= settled && depth > -1.3 && visible;
    return {
      x, y, rx: site.rx * scale, ry: site.ry * scale,
      depth, visible, covering,
      spin: .15 * Math.sin(time * .91 + index) + site.side * (entry * .47 + drift * .15),
      cover: site.rx * .78 * scale,
      rift: {
        x: site.side * (WIDTH / 2 - .22),
        y: site.y,
        opening,
        side: site.side,
        clipping: entry < .90,
      },
    };
  });
}

type Rocks = ReturnType<typeof fonsRocks>;
export function fonsSheltered(rocks: Rocks, player: Point) {
  return rocks.some(rock => rock.covering && player.y < rock.y && Math.abs(player.x - rock.x) < rock.cover);
}

export function fonsRockHits(rocks: Rocks, player: Point) {
  return rocks.some(rock => rock.covering &&
    ((player.x - rock.x) / (rock.cover + .15)) ** 2 + ((player.y - rock.y) / (rock.ry * .82 + .15)) ** 2 < 1);
}
