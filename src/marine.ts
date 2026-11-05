export type MarineKind = 'ichthyosaur' | 'plesiosaur';
export type MarineFormation = 'chevron' | 'pincer' | 'slalom' | 'loop';
export type MarineSchool = { formation: MarineFormation; slot: number; count: number; mirror: number };
export const marineSpecs = {
  ichthyosaur: { hp: 3, radius: 0.5, halfLength: 1.04, speed: 2.75 },
  plesiosaur: { hp: 9, radius: 0.62, halfLength: 1.55, speed: 1.25 },
} as const;

export const SCHOOL_DELAY = .8;
export const LOOP_ENTRY = (8.6 - 2.6) / 3.4;
export const LOOP_DURATION = Math.PI * 2 / 1.55;
export function schoolDelay(school?: MarineSchool) {
  return school && (school.formation === 'loop' || school.formation === 'slalom') ? school.slot * SCHOOL_DELAY : 0;
}

// Absolute routes let every member follow the same path at a fixed time separation.
// Loop entry/exit share the circle's downward tangent; no teleport or heading snap.
export function marineMotion(kind: MarineKind, age: number, lane: number, school?: MarineSchool) {
  let x: number, y: number, vx: number, vy: number, bank: number;
  const t = age - schoolDelay(school), sweep = kind === 'plesiosaur';
  const hunt = sweep ? 0 : Math.max(0, Math.min(1, (t - 1.25) / .7));
  const speed = marineSpecs[kind].speed + hunt * 1.15;
  if (!sweep && school?.formation === 'loop') {
    const turn = Math.max(0, Math.min(LOOP_DURATION, t - LOOP_ENTRY)), angle = turn * 1.55;
    const inside = t >= LOOP_ENTRY && t <= LOOP_ENTRY + LOOP_DURATION;
    x = -school.mirror * 1.9 * Math.cos(angle);
    y = t < LOOP_ENTRY ? 8.6 - t * 3.4 : t > LOOP_ENTRY + LOOP_DURATION
      ? 2.6 - (t - LOOP_ENTRY - LOOP_DURATION) * 3.4 : 2.6 - 2.2 * Math.sin(angle);
    vx = inside ? school.mirror * 1.9 * 1.55 * Math.sin(angle) : 0;
    vy = inside ? -2.2 * 1.55 * Math.cos(angle) : -3.4;
    const ease = Math.min(1, turn / .25, (LOOP_DURATION - turn) / .25);
    bank = -school.mirror * Math.max(0, ease) * .5;
  } else if (!sweep && school?.formation === 'slalom') {
    x = school.mirror * 1.85 * Math.sin(t * .95);
    y = 8.6 - t * 3.2;
    vx = school.mirror * 1.85 * .95 * Math.cos(t * .95); vy = -3.2;
    bank = school.mirror * Math.sin(t * .95) * .45;
  } else if (!sweep && school?.formation === 'pincer') {
    const side = lane < 0 ? -1 : 1;
    x = side * (1.45 + .65 * Math.cos(t * 1.1));
    y = 8.6 + Math.floor(school.slot / 2) * 2.3 - t * 3.4;
    vx = -side * .65 * 1.1 * Math.sin(t * 1.1); vy = -3.4;
    bank = side * Math.cos(t * 1.1) * .4;
  } else {
    const chevron = !sweep && school?.formation === 'chevron';
    const frequency = sweep ? .75 : chevron ? 1.15 : 1.7;
    const amplitude = sweep ? .35 : chevron ? .38 : .55;
    const chase = Math.max(0, t - 1.25), chaseDistance = chase < .7 ? chase * chase / 1.4 : chase - .35;
    x = lane + Math.sin(t * frequency) * amplitude;
    y = 8.6 + (chevron ? Math.abs(school.slot - (school.count - 1) / 2) * 1.8 : 0)
      - marineSpecs[kind].speed * t - (sweep ? 0 : chaseDistance * 1.15);
    vx = Math.cos(t * frequency) * amplitude * frequency; vy = -speed;
    bank = Math.cos(t * frequency) * (sweep ? .055 : .55);
  }
  return { x, y, vx, vy, speed: sweep ? speed : Math.hypot(vx, vy), heading: Math.atan2(vx, -vy), bank, hunt };
}

type Point = { x: number; y: number };
type MarineBody = Point & { marine: MarineKind; heading?: number };
export function marineBodyAxis(body: MarineBody) {
  const spec = marineSpecs[body.marine], length = spec.halfLength - spec.radius;
  const dx = Math.sin(body.heading ?? 0) * length, dy = -Math.cos(body.heading ?? 0) * length;
  return { start: { x: body.x - dx, y: body.y - dy }, end: { x: body.x + dx, y: body.y + dy }, radius: spec.radius };
}
function pointSegmentSquared(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
  return (p.x - a.x - dx * t) ** 2 + (p.y - a.y - dy * t) ** 2;
}
// Segment/capsule distance also catches fast projectiles crossing a sideways animal.
export function marineBodyHit(body: MarineBody, a: Point, b: Point, padding = 0) {
  const { start, end, radius } = marineBodyAxis(body);
  const cross = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const intersects = cross(a, b, start) * cross(a, b, end) < 0 && cross(start, end, a) * cross(start, end, b) < 0;
  return intersects || Math.min(pointSegmentSquared(a, start, end), pointSegmentSquared(b, start, end),
    pointSegmentSquared(start, a, b), pointSegmentSquared(end, a, b)) <= (radius + padding) ** 2;
}

export const LEVIATHAN_HP = 60;
export const LEVIATHAN_INTERVAL = 3.2;
export const LEVIATHAN_WINDUP = .55;
export const LEVIATHAN_FIRE = 1.45;
export const LEVIATHAN_TRAVEL = .85;
export function leviathanMotion(time: number) {
  const elapsed = Math.max(0,time) % LEVIATHAN_INTERVAL;
  const windup = Math.max(0,Math.min(1,(elapsed - LEVIATHAN_WINDUP) / (LEVIATHAN_FIRE - LEVIATHAN_WINDUP)));
  const recoil = elapsed < LEVIATHAN_FIRE ? 0 : Math.max(0,1-(elapsed-LEVIATHAN_FIRE)/.45);
  return { windup: elapsed < LEVIATHAN_FIRE ? windup : 0, recoil,
    jaw: elapsed < LEVIATHAN_FIRE ? .02 + windup * .88 : .02 + recoil * .90 };
}
