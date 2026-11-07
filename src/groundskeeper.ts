import { PRESERVE_BOSS_PITCH, PRESERVE_RISE, PRESERVE_WIDTH_SCALE } from './preserve-layout';

export const GROUNDSKEEPER_HP = 160;
export const GROUNDSKEEPER_CYCLE = 5.6;
export const GROUNDSKEEPER_WARN = 1;
export const GROUNDSKEEPER_STRIKE = 2.35;
export const GROUNDSKEEPER_END = 3.25;
export const GROUNDSKEEPER_FLOOR = -2.8;
export const GROUNDSKEEPER_RADIUS = 1.75;
export type GkPoint = { x: number; y: number; z: number };
export type GkAim = { x: number; y: number };
export type GkAttack = 'left rake' | 'right rake' | 'double slam' | 'lunge';
const sequence: GkAttack[] = ['left rake', 'right rake', 'double slam', 'lunge'];
export const gkSmooth = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t * t * (3 - 2 * t); };
const point = (x: number, y: number, z: number): GkPoint => ({ x, y, z });
const add = (a: GkPoint, b: GkPoint) => point(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: GkPoint, b: GkPoint) => point(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a: GkPoint, s: number) => point(a.x * s, a.y * s, a.z * s);
const dot = (a: GkPoint, b: GkPoint) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a: GkPoint) => mul(a, 1 / Math.max(1e-8, Math.hypot(a.x, a.y, a.z)));
const mix = (a: GkPoint, b: GkPoint, t: number) => add(mul(a, 1 - t), mul(b, t));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// These are the same rigid transform and final camera used by the scenery.
export function groundskeeperFlight(p: GkPoint): GkPoint {
  const c = Math.cos(PRESERVE_BOSS_PITCH), s = Math.sin(PRESERVE_BOSS_PITCH);
  const y = p.y + 11, z = p.z + GROUNDSKEEPER_FLOOR - PRESERVE_RISE;
  return point(p.x * PRESERVE_WIDTH_SCALE, y * c + z * s, -y * s + z * c);
}
function fromFlight(p: GkPoint): GkPoint {
  const c = Math.cos(PRESERVE_BOSS_PITCH), s = Math.sin(PRESERVE_BOSS_PITCH);
  return point(p.x / PRESERVE_WIDTH_SCALE, p.y * c - p.z * s - 11,
    p.y * s + p.z * c - GROUNDSKEEPER_FLOOR + PRESERVE_RISE);
}

export function groundskeeperAttack(time: number) {
  const cycle = Math.floor(Math.max(0, time) / GROUNDSKEEPER_CYCLE), age = Math.max(0, time) % GROUNDSKEEPER_CYCLE;
  const kind = sequence[cycle % sequence.length];
  return { cycle, age, kind, warning: age >= GROUNDSKEEPER_WARN && age < GROUNDSKEEPER_STRIKE,
    active: age >= GROUNDSKEEPER_STRIKE && age <= GROUNDSKEEPER_END,
    windup: gkSmooth((age - GROUNDSKEEPER_WARN) / (GROUNDSKEEPER_STRIKE - GROUNDSKEEPER_WARN)),
    stroke: gkSmooth((age - GROUNDSKEEPER_STRIKE) / (GROUNDSKEEPER_END - GROUNDSKEEPER_STRIKE)),
    recovery: gkSmooth((age - GROUNDSKEEPER_END) / 1.1) };
}

// Fixed-length, two-link arms. The renderer and collision share the solved wrist.
function arm(shoulder: GkPoint, goal: GkPoint, side: number) {
  const upper = 4.05, lower = 4.25, delta = sub(goal, shoulder), direction = norm(delta);
  const d = clamp(Math.hypot(delta.x, delta.y, delta.z), .3, upper + lower - .025);
  const wrist = add(shoulder, mul(direction, d)), pole = point(side * .35, .4, -1);
  const bend = norm(sub(pole, mul(direction, dot(pole, direction))));
  const along = (upper * upper - lower * lower + d * d) / (2 * d);
  const elbow = add(add(shoulder, mul(direction, along)), mul(bend, Math.sqrt(Math.max(0, upper * upper - along * along))));
  return { shoulder, elbow, wrist };
}

export function groundskeeperPose(time: number, aim: GkAim = { x: 0, y: -5.3 }, cancelledAt = -100) {
  const attack = groundskeeperAttack(time), { kind, windup, stroke, recovery } = attack;
  const cancelled = Math.floor(cancelledAt / GROUNDSKEEPER_CYCLE) === attack.cycle;
  const strength = (1 - recovery) * (cancelled ? 1 - gkSmooth((time - cancelledAt) / .45) : 1);
  const moving = gkSmooth((attack.age - GROUNDSKEEPER_STRIKE + .2) / .5) * strength;
  const side = kind === 'right rake' ? 1 : -1;
  const torso = point((side * .24 + aim.x * .35) * moving, -moving * (kind === 'lunge' ? 3.6 : 3.0), -moving * .55);
  const jaw = (.06 + windup * .65 + (kind === 'lunge' ? moving * .35 : 0)) * strength;
  let head = add(point(.17 * Math.sin(time * .6), -1.3, 14.1), torso);
  if (kind === 'lunge') {
    const target = fromFlight(point(aim.x, aim.y, -.2));
    head = mix(head, add(target, point(0, 1.4, .2)), moving * (1 - recovery));
  }
  const arms = [-1, 1].map(handSide => {
    const shoulder = add(point(handSide * 2.35, -1.1, 9.6), torso);
    const rest = add(point(handSide * 4.9, -2.4, 5.0), torso);
    const striking = kind === 'double slam' || (kind !== 'lunge' && side === handSide);
    let wrist = rest, direction = norm(point(0, -.28, -.96));
    if (striking) {
      const ready = add(point(handSide * 5.1, -.1, 12.1), torso);
      wrist = mix(rest, ready, windup * strength);
      if (attack.age >= GROUNDSKEEPER_STRIKE) {
        let tip: GkPoint;
        if (kind === 'double slam') {
          tip = mix(point(aim.x + handSide * 1.35, 3.5, -8), point(aim.x + handSide * 1.35, aim.y, .5), stroke);
        } else {
          const target = point(aim.x, aim.y, 0), t = stroke / .7;
          tip = t < 1 ? mix(point(side * 3.8, 3.3, -9), target, t)
            : mix(target, point(-side * 3.8, aim.y - 1, -8), (stroke - .7) / .3);
        }
        direction = norm(point(0, -.84, -.54));
        wrist = mix(rest, sub(fromFlight(tip), mul(direction, 4.55)), strength);
      }
    }
    const solved = arm(shoulder, wrist, handSide);
    const claws = [-1, 0, 1].map((finger) => {
      const base = add(solved.wrist, point(finger * .46, 0, 0));
      return [base, add(base, add(mul(direction, 2.2), point(0, -.65, .4))),
        add(base, mul(direction, 4.55 - Math.abs(finger) * .24))];
    });
    return { ...solved, direction, claws, side: handSide };
  });
  const feet = [-1, 1].map(s => point(s * 2.05, -.35 - (s === side ? moving * 1.2 : 0), 0));
  return { ...attack, cancelled, torso, head, jaw, feathers: windup * strength, arms, feet,
    neckBase: add(point(0, -.75, 10.0), torso) };
}
export type GroundskeeperPose = ReturnType<typeof groundskeeperPose>;

export function groundskeeperContact(time: number, aim: GkAim, cancelledAt: number) {
  const p = groundskeeperPose(time, aim, cancelledAt);
  return groundskeeperFlight(add(point(0, -2.35, 7.1), p.torso));
}

function segmentDistance(p: GkPoint, a: GkPoint, b: GkPoint) {
  const d = sub(b, a), t = clamp(dot(sub(p, a), d) / Math.max(1e-8, dot(d, d)), 0, 1);
  const q = sub(p, add(a, mul(d, t))); return Math.hypot(q.x, q.y, q.z);
}
export function groundskeeperHits(time: number, previous: number, aim: GkAim, player: GkAim, cancelledAt = -100) {
  const p = point(player.x, player.y, 0), old = groundskeeperPose(previous, aim, cancelledAt), now = groundskeeperPose(time, aim, cancelledAt);
  if (!now.active || now.cancelled) return false;
  if (now.kind === 'lunge') return segmentDistance(p, groundskeeperFlight(add(old.head, point(0, -1.4, -.2))), groundskeeperFlight(add(now.head, point(0, -1.4, -.2)))) < 1.15;
  for (const [a, hand] of now.arms.entries()) {
    if (now.kind !== 'double slam' && hand.side !== (now.kind === 'right rake' ? 1 : -1)) continue;
    for (const [i, curve] of hand.claws.entries()) for (let j = 0; j < curve.length; j++) {
      const current = groundskeeperFlight(curve[j]), before = groundskeeperFlight(old.arms[a].claws[i][j]);
      if (segmentDistance(p, before, current) < .65) return true;
      if (j && segmentDistance(p, groundskeeperFlight(curve[j - 1]), current) < .65) return true;
    }
  }
  return false;
}
