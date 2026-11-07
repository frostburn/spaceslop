import { PRESERVE_BOSS_PITCH, PRESERVE_RISE, PRESERVE_WIDTH_SCALE } from './preserve-layout';

export const GROUNDSKEEPER_HP = 160;
export const GROUNDSKEEPER_CYCLE = 5.6;
export const GROUNDSKEEPER_WARN = 1;
export const GROUNDSKEEPER_STRIKE = 2.35;
export const GROUNDSKEEPER_END = 3.25;
export const GROUNDSKEEPER_FLOOR = -2.8;
export const GROUNDSKEEPER_RADIUS = 1.75;
export const GROUNDSKEEPER_BELLY = { x: 0, y: -2.65, z: 6.95 };
export const GROUNDSKEEPER_UPPER_ARM = 3.2;
export const GROUNDSKEEPER_FOREARM = 3.45;
export const GROUNDSKEEPER_RAKE_FOLLOW = 2.5;
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
const cross = (a: GkPoint, b: GkPoint) => point(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
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

// A lateral elbow pole, canted slightly back, keeps the elbow outside the rib
// cage and lets the forearm fold forward. Both bones and the hand use this same
// hinge frame; aiming a bone alone leaves its longitudinal roll unconstrained.
function arm(shoulder: GkPoint, goal: GkPoint, side: number) {
  const upper = GROUNDSKEEPER_UPPER_ARM, lower = GROUNDSKEEPER_FOREARM, delta = sub(goal, shoulder), direction = norm(delta);
  const d = clamp(Math.hypot(delta.x, delta.y, delta.z), .3, upper + lower - .025);
  const wrist = add(shoulder, mul(direction, d));
  const along = (upper * upper - lower * lower + d * d) / (2 * d);
  const outward = norm(sub(point(side, 0, 0), mul(direction, side * direction.x)));
  const tangent = cross(direction, outward), angle = -side * .6;
  const bend = add(mul(outward, Math.cos(angle)), mul(tangent, Math.sin(angle))), hinge = norm(cross(direction, bend));
  const elbow = add(add(shoulder, mul(direction, along)), mul(bend, Math.sqrt(Math.max(0, upper * upper - along * along))));
  return { shoulder, elbow, wrist, hinge };
}

export function groundskeeperPose(time: number, aim: GkAim = { x: 0, y: -5.3 }, cancelledAt = -100) {
  const attack = groundskeeperAttack(time), { kind, windup, stroke, recovery } = attack;
  const cancelled = Math.floor(cancelledAt / GROUNDSKEEPER_CYCLE) === attack.cycle;
  const strength = (1 - recovery) * (cancelled ? 1 - gkSmooth((time - cancelledAt) / .45) : 1);
  const moving = gkSmooth((attack.age - GROUNDSKEEPER_STRIKE + .2) / .5) * strength;
  const side = kind === 'right rake' ? 1 : -1;
  const lunge = kind === 'lunge' ? moving : 0;
  // Independent, slightly uneven rhythms avoid a metronomic idle loop. Quiet
  // the weight shift during warnings/contact; breathing continues underneath.
  const resting = 1 - .9 * Math.max(windup * strength, moving);
  const phase = time * 1.32 + .12 * Math.sin(time * .31);
  const breath = Math.sin(phase + .22 * Math.sin(phase)) * (.7 + .3 * resting);
  const sway = (t: number) => .16 * Math.sin(t * .53) + .035 * Math.sin(t * .91);
  const torso = point((side * .24 + aim.x * .35) * moving + sway(time) * resting,
    -moving * (kind === 'lunge' ? 4.8 : 3.6) + .055 * Math.sin(time * .67) * resting,
    -moving * (kind === 'lunge' ? 1.35 : .55) + .035 * breath);
  const torsoScale = point(1 + .009 * breath, 1 + .017 * breath, 1 + .008 * breath);
  const attached = (p: GkPoint) => add(point(p.x * torsoScale.x, (p.y + .1) * torsoScale.y - .1,
    (p.z - 6.9) * torsoScale.z + 6.9), torso);
  const jaw = (windup * .37 + lunge * .20) * strength;
  const headPitch = .12 + lunge * .40 + (.015 * Math.sin(time * .7) + .008 * breath) * resting;
  const headYaw = (.34 + .065 * Math.sin(time * .55)) * (1 - lunge);
  let head = add(point(.08 * Math.sin(time * .6) + (sway(time - .55) - sway(time)) * resting,
    -4 + .04 * Math.sin(time * .67 - .45) * resting, 11.8 + .045 * breath), torso);
  if (kind === 'lunge') {
    const target = fromFlight(point(aim.x, aim.y, -.2));
    head = mix(head, sub(target, headOffset(headPitch, headYaw)), moving * (1 - recovery));
  }
  const arms = [-1, 1].map(handSide => {
    const shoulder = attached(point(handSide * 2.6, -2.2, 8.5));
    const rest = add(point(handSide * 4.5 + (sway(time - .38) - sway(time)) * resting,
      -4 + .055 * Math.sin(time * .67 - .6 - handSide * .15) * resting,
      (handSide < 0 ? 5.2 : 4.9) + .025 * breath), torso);
    const striking = kind === 'double slam' || (kind !== 'lunge' && side === handSide);
    const restDirection = norm(point(-handSide * .14, -.35, -.93));
    let wrist = rest, direction = restDirection;
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
            : mix(target, point(clamp(aim.x - side * GROUNDSKEEPER_RAKE_FOLLOW, -3.8, 3.8), aim.y - 1, -4), (stroke - .7) / .3);
        }
        // Turn the claws across the lane while the wrist stays ahead of the
        // chest. Sending the wrist to the far side pulled the arm through it.
        const reach = gkSmooth(stroke / .4);
        const sweepDirection = norm(point(kind === 'double slam' ? 0 : -side * .8 * gkSmooth(stroke / .4), -.65, -.65 + 1.05 * gkSmooth((aim.y + 3) / 8.5)));
        direction = norm(mix(restDirection, sweepDirection, reach * strength));
        wrist = mix(rest, mix(ready, sub(fromFlight(tip), mul(sweepDirection, 4.55)), reach), strength);
      }
    }
    // Cross-body travel and recovery follow the front of the abdomen. A soft
    // lateral gate leaves the outside windup free while keeping the wrist clear.
    const crossing = 1 - gkSmooth((handSide * (wrist.x - torso.x) - 2.6) / 1.4);
    wrist.y = Math.min(wrist.y, torso.y - 3.6 - 2.4 * crossing);
    wrist.z = Math.max(wrist.z, torso.z + 3 + 2 * crossing);
    const solved = arm(shoulder, wrist, handSide);
    const across = norm(sub(solved.hinge, mul(direction, dot(solved.hinge, direction))));
    const palmNormal = cross(across, direction);
    const claws = [-1, 0, 1].map((finger) => {
      const base = add(solved.wrist, add(mul(across, finger * .46), mul(direction, Math.abs(finger) * .1)));
      return [base, add(base, add(mul(direction, 2.2), add(mul(across, handSide * .9 + finger * .22), mul(palmNormal, -1.2)))),
        add(base, add(mul(direction, 4.55 - Math.abs(finger) * .24), mul(across, finger * .4)))];
    });
    return { ...solved, across, direction, claws, side: handSide };
  });
  const feet = [-1, 1].map(s => point(s * 2.15, -.35 - (s === side ? moving * (kind === 'lunge' ? 3.5 : 1.2) : 0),
    s === side ? Math.sin(moving * Math.PI) * (kind === 'lunge' ? .45 : .22) : 0));
  return { ...attack, cancelled, torso, torsoScale, head, headPitch, headYaw, jaw, feathers: windup * strength, arms, feet,
    hips: [-1, 1].map(s => attached(point(s * 1.7, .75, 5.8))),
    belly: attached(GROUNDSKEEPER_BELLY), neckBase: attached(point(0, -1.4, 8.9)) };
}
export type GroundskeeperPose = ReturnType<typeof groundskeeperPose>;

function headOffset(pitch: number, yaw: number) {
  const y = -1.75 * Math.cos(pitch) + .05 * Math.sin(pitch);
  return point(-y * Math.sin(yaw), y * Math.cos(yaw), -1.75 * Math.sin(pitch) - .05 * Math.cos(pitch));
}
export function groundskeeperMuzzle(p: GroundskeeperPose) { return add(p.head, headOffset(p.headPitch, p.headYaw)); }

export function groundskeeperContact(time: number, aim: GkAim, cancelledAt: number) {
  const p = groundskeeperPose(time, aim, cancelledAt);
  return groundskeeperFlight(p.belly);
}

function segmentDistance(p: GkPoint, a: GkPoint, b: GkPoint) {
  const d = sub(b, a), t = clamp(dot(sub(p, a), d) / Math.max(1e-8, dot(d, d)), 0, 1);
  const q = sub(p, add(a, mul(d, t))); return Math.hypot(q.x, q.y, q.z);
}
export function groundskeeperHits(time: number, previous: number, aim: GkAim, player: GkAim, cancelledAt = -100) {
  const p = point(player.x, player.y, 0), old = groundskeeperPose(previous, aim, cancelledAt), now = groundskeeperPose(time, aim, cancelledAt);
  if (!now.active || now.cancelled) return false;
  if (now.kind === 'lunge') return segmentDistance(p, groundskeeperFlight(groundskeeperMuzzle(old)), groundskeeperFlight(groundskeeperMuzzle(now))) < 1.15;
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
