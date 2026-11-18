import { PRESERVE_BOSS_PITCH, PRESERVE_RISE, PRESERVE_WIDTH_SCALE } from './preserve-layout';

export const GROUNDSKEEPER_HP = 160;
export const GROUNDSKEEPER_CYCLE = 5.05;
export const GROUNDSKEEPER_WARN = 1;
export const GROUNDSKEEPER_STRIKE = 2.35;
export const GROUNDSKEEPER_END = 3.25;
export const GROUNDSKEEPER_FLOOR = -2.8;
export const GROUNDSKEEPER_RADIUS = 1.75;
export const GROUNDSKEEPER_BELLY = { x: 0, y: -2.65, z: 6.95 };
export const GROUNDSKEEPER_UPPER_ARM = 3.2;
export const GROUNDSKEEPER_FOREARM = 3.45;
export const GROUNDSKEEPER_THIGH = 3.1;
export const GROUNDSKEEPER_SHIN = 2.65;
export const GROUNDSKEEPER_TARSUS = 1.7;
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

// Intersect the two bone-length spheres in the chosen bend plane. Keep a
// little flexion at full reach so the joint retains a readable silhouette.
function twoBone(root: GkPoint, direction: GkPoint, distance: number, bend: GkPoint, upper: number, lower: number) {
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  return add(root, add(mul(direction, along), mul(bend, Math.sqrt(Math.max(0, upper * upper - along * along)))));
}
function perpendicular(axis: GkPoint, direction: GkPoint) {
  return norm(sub(axis, mul(direction, dot(axis, direction))));
}

const middleClaw = 4.55;

// Hand-local keratin paths, measured from the carpal joint. The rig builds
// these once and combat moves the same curves with the posed hand.
export function groundskeeperClaw(side: number, finger: number) {
  const outer = Math.abs(finger);
  return [point(finger * .48, 1.13 - outer * .16, -.13),
    point(side * .50 + finger * .63, 2.67 - outer * .14, -.79),
    point(finger * .82, middleClaw - outer * .29, 0)];
}
const clawShapes = [-1, 1].map(side => [-1, 0, 1].map(finger => groundskeeperClaw(side, finger)));

function clawArm(shoulder: GkPoint, goal: GkPoint, pole: GkPoint, wristFlex: number) {
  // Fold the forearm and middle claw into a triangle with a known wrist
  // angle. Its diagonal is the elbow-to-tip reach of the outer two links.
  const forearm = GROUNDSKEEPER_FOREARM, upper = GROUNDSKEEPER_UPPER_ARM;
  const reach = Math.sqrt(forearm ** 2 + middleClaw ** 2 + 2 * forearm * middleClaw * Math.cos(wristFlex));
  const wristOffset = Math.asin(middleClaw * Math.sin(wristFlex) / reach);
  const extension = (elbowFlex: number) => Math.sqrt(upper ** 2 + reach ** 2 + 2 * upper * reach * Math.cos(elbowFlex + wristOffset));
  const delta = sub(goal, shoulder), axis = norm(delta);
  const distance = clamp(Math.hypot(delta.x, delta.y, delta.z), extension(2.10), extension(.30));
  const bend = perpendicular(pole, axis), hinge = norm(cross(axis, bend));
  const tip = add(shoulder, mul(axis, distance));
  const elbow = twoBone(shoulder, axis, distance, bend, upper, reach);
  const line = norm(sub(tip, elbow));
  const wrist = twoBone(elbow, line, reach, cross(hinge, line), forearm, middleClaw);
  return { shoulder, elbow, wrist, hinge, across: hinge, direction: norm(sub(tip, wrist)) };
}

function leg(hip: GkPoint, foot: GkPoint, side: number) {
  const ankle = add(foot, point(0, .15, .64));
  // The heel sits behind the toes. As the hip advances it pulls the hock
  // forward over the planted foot, leaving the knee free to fold in front.
  const heelAxis = norm(point(side * .07, .60 + .07 * (hip.y - foot.y), 1));
  const hock = add(ankle, mul(heelAxis, GROUNDSKEEPER_TARSUS));
  const delta = sub(hock, hip), axis = norm(delta);
  const bend = perpendicular(point(side * .28, -1, 0), axis);
  const knee = twoBone(hip, axis, Math.hypot(delta.x, delta.y, delta.z), bend, GROUNDSKEEPER_THIGH, GROUNDSKEEPER_SHIN);
  return { hip, knee, hock, ankle };
}

export function groundskeeperPose(time: number, aim: GkAim = { x: 0, y: -5.3 }, cancelledAt = -100) {
  const attack = groundskeeperAttack(time), { kind, windup, stroke, recovery } = attack;
  const cancelled = Math.floor(cancelledAt / GROUNDSKEEPER_CYCLE) === attack.cycle;
  const strength = (1 - recovery) * (cancelled ? 1 - gkSmooth((time - cancelledAt) / .45) : 1);
  const moving = gkSmooth((attack.age - GROUNDSKEEPER_STRIKE + .2) / .5) * strength;
  const side = kind === 'right rake' ? 1 : -1;
  const lunge = kind === 'lunge' ? moving : 0;
  const highLunge = lunge * gkSmooth((aim.y + 3.8) / 9);
  // Independent, slightly uneven rhythms avoid a metronomic idle loop. Quiet
  // the weight shift during warnings/contact; breathing continues underneath.
  const resting = 1 - .9 * Math.max(windup * strength, moving);
  const phase = time * 1.32 + .12 * Math.sin(time * .31);
  const breath = Math.sin(phase + .22 * Math.sin(phase)) * (.7 + .3 * resting);
  const sway = (t: number) => .16 * Math.sin(t * .53) + .035 * Math.sin(t * .91);
  const torso = point((side * .24 + aim.x * .35) * moving + sway(time) * resting,
    -moving * (kind === 'lunge' ? 4.8 : 3.6) + highLunge * 2.6 + .055 * Math.sin(time * .67) * resting,
    -moving * (kind === 'lunge' ? 1.35 : .55) + highLunge * 2.5 + .035 * breath);
  const torsoScale = point(1 + .009 * breath, 1 + .017 * breath, 1 + .008 * breath);
  const rake = kind === 'left rake' || kind === 'right rake';
  const load = windup * strength * (1 - stroke);
  const torsoPitch = -.10 * load + moving * (kind === 'lunge' ? .42 : .24) - highLunge * .69;
  const torsoYaw = rake ? side * (.20 * load - .33 * stroke * strength) : lunge * aim.x * .065;
  const cp = Math.cos(torsoPitch), sp = Math.sin(torsoPitch), cy = Math.cos(torsoYaw), sy = Math.sin(torsoYaw);
  const attached = (p: GkPoint) => {
    const x = p.x * torsoScale.x, y = (p.y + .1) * torsoScale.y, z = (p.z - 6.9) * torsoScale.z;
    const pitchedY = cp * y - sp * z;
    return add(torso, point(cy * x - sy * pitchedY, -.1 + sy * x + cy * pitchedY, 6.9 + sp * y + cp * z));
  };
  const jaw = (windup * .37 + lunge * .20) * strength;
  const headPitch = .12 + lunge * .40 - highLunge * .9 + (.015 * Math.sin(time * .7) + .008 * breath) * resting;
  const headYaw = (.34 + .065 * Math.sin(time * .55)) * (1 - lunge) + lunge * aim.x * .11;
  let head = add(point(.08 * Math.sin(time * .6) + (sway(time - .55) - sway(time)) * resting,
    -4 + .04 * Math.sin(time * .67 - .45) * resting, 11.8 + .045 * breath), torso);
  if (kind === 'lunge') {
    const target = fromFlight(point(aim.x, aim.y, -.2));
    head = mix(head, sub(target, headOffset(headPitch, headYaw)), moving * (1 - recovery));
  }
  const arms = [-1, 1].map(handSide => {
    const striking = kind === 'double slam' || (kind !== 'lunge' && side === handSide);
    const shoulder = attached(point(handSide * 2.6, -2.2, 8.5));
    const rest = add(point(handSide * 3.92 + (sway(time - .38) - sway(time)) * resting,
      -5.65 + .055 * Math.sin(time * .67 - .6 - handSide * .15) * resting,
      (handSide < 0 ? .94 : .68) + .025 * breath - Math.min(0, torso.z)), torso);
    let tip = rest;
    const guard = striking ? windup * strength : 0;
    if (striking) {
      // Open the folded arm into a high, forward-facing guard. Both the windup
      // and recovery pass outside the breast before the claws cross the lane.
      const ready = attached(point(handSide * 5.55, -6.9, 13.7));
      tip = mix(rest, ready, windup);
      tip.y -= 2.5 * 4 * windup * (1 - windup);
      if (stroke > 0) {
        const slam = kind === 'double slam';
        const target = fromFlight(point(aim.x + (slam ? handSide * 1.35 : 0), aim.y, slam ? .5 : 0));
        if (slam) tip = mix(ready, target, stroke);
        else {
          // Match the approach arc's exit tangent to the follow-through.
          const follow = fromFlight(point(clamp(aim.x - side * GROUNDSKEEPER_RAKE_FOLLOW, -3.8, 3.8), aim.y - 1, -4));
          const cut = .7, exit = sub(follow, target);
          if (stroke < cut) {
            const t = stroke / cut, lead = sub(target, mul(exit, .5 * cut / (1 - cut)));
            tip = mix(mix(ready, lead, t), mix(lead, target, t), t);
          } else tip = mix(target, follow, (stroke - cut) / (1 - cut));
        }
      }
      const retract = 4 * strength * (1 - strength) * windup;
      tip = add(mix(rest, tip, strength), point(handSide * .8 * retract, -4.6 * retract, 0));
    }
    const committed = striking ? stroke * strength : 0;
    const pole = point(handSide, .48 - .85 * guard - .7 * committed, -.22 + .36 * guard);
    const solved = clawArm(shoulder, tip, pole, .58 + .20 * guard);
    const { across, direction } = solved;
    const palmNormal = cross(across, direction);
    const claws = clawShapes[handSide < 0 ? 0 : 1].map(curve => curve.map(p =>
      add(solved.wrist, add(mul(across, p.x), add(mul(direction, p.y), mul(palmNormal, p.z))))));
    return { ...solved, claws, side: handSide };
  });
  const feet = [-1, 1].map(s => point(s * 2.15, -.35 - (s === side ? moving * (kind === 'lunge' ? 3.5 : 1.2) : 0),
    s === side ? Math.sin(moving * Math.PI) * (kind === 'lunge' ? .45 : .22) : 0));
  const hips = [-1, 1].map(s => attached(point(s * 1.7, .75, 5.8)));
  const legs = feet.map((foot, i) => leg(hips[i], foot, i === 0 ? -1 : 1));
  return { ...attack, cancelled, torso, torsoScale, torsoPitch, torsoYaw, head, headPitch, headYaw, jaw, feathers: windup * strength, arms, feet,
    hips, legs,
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
