// Microraptor-inspired flock routes. The combat plane stays fixed; apparent
// climbing comes from the bird's pitch, wing stroke and banking, not its hitbox.
export type FlyerFormation = 'chevron' | 'crossing' | 'slalom' | 'loop' | 'swoop';
export type FlyerCourse = { formation: FlyerFormation; mirror: number; slot: number; count: number };
export const FLYER_HP = 3, FLYER_POOL = 10, FLYER_DELAY = .64;
export const FLYER_LOOP_ENTRY = 2.5, FLYER_LOOP_DURATION = 2 * Math.PI / 1.6;
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };
const integral = (t: number, duration: number) => {
  const u = clamp(t / duration);
  return duration * (u ** 3 - u ** 4 / 2) + Math.max(0, t - duration);
};
export function flyerDelay(course: FlyerCourse) {
  return ['slalom', 'loop', 'swoop'].includes(course.formation) ? course.slot * FLYER_DELAY : 0;
}
function flyerPoint(age: number, lane: number, course: FlyerCourse) {
  const t = age - flyerDelay(course), m = course.mirror;
  if (course.formation === 'loop') {
    const turn = clamp(t - FLYER_LOOP_ENTRY, 0, FLYER_LOOP_DURATION), a = turn * 1.6;
    return { x: -m * 1.75 * Math.cos(a), y: t < FLYER_LOOP_ENTRY ? 10.8 - 3 * t
      : t > FLYER_LOOP_ENTRY + FLYER_LOOP_DURATION ? 3.3 - 3 * (t - FLYER_LOOP_ENTRY - FLYER_LOOP_DURATION) : 3.3 - 1.875 * Math.sin(a) };
  }
  if (course.formation === 'slalom') return { x: m * 2.05 * Math.sin(t * 1.12), y: 10.8 - t * 2.75 };
  if (course.formation === 'crossing') return { x: lane * Math.cos(Math.PI * smooth((t - 1.15) / 3.8)), y: 10.8 + course.slot * 1.6 - 2.9 * t };
  if (course.formation === 'swoop') return {
    x: lane * Math.cos(Math.PI * .65 * smooth((t - .85) / 3.3)) + m * .4 * Math.sin(t * 1.3),
    y: 10.8 - 2.3 * t - 3.8 * integral(t - 1.25, 1) + 2.6 * integral(t - 3.1, .7),
  };
  return { x: lane + m * .38 * Math.sin(t * 1.15), y: 10.8 + Math.abs(course.slot - (course.count - 1) / 2) * .95 - 2.7 * t };
}
export function flyerMotion(age: number, lane: number, course: FlyerCourse) {
  const p = flyerPoint(age, lane, course), a = flyerPoint(age - .002, lane, course), b = flyerPoint(age + .002, lane, course);
  const vx = (b.x - a.x) / .004, vy = (b.y - a.y) / .004;
  const ax = (b.x - 2 * p.x + a.x) / .000004, ay = (b.y - 2 * p.y + a.y) / .000004;
  let bank = clamp((vx * ay - vy * ax) / Math.max(.5, vx * vx + vy * vy) * .48, -.58, .58);
  if (course.formation === 'loop') {
    const turn = age - flyerDelay(course) - FLYER_LOOP_ENTRY;
    bank *= smooth(turn / .35) * smooth((FLYER_LOOP_DURATION - turn) / .35);
  }
  return { ...p, vx, vy, heading: Math.atan2(vx, -vy), bank, speed: Math.hypot(vx, vy) };
}
export function flyerStroke(age: number, course: FlyerCourse) {
  const t = age - flyerDelay(course), cycle = ((t + course.slot * .17) % 2.8 + 2.8) % 2.8;
  const burst = smooth(cycle / .18) * (1 - smooth((cycle - .9) / .35));
  const tuck = course.formation === 'swoop' ? .36 * smooth((t - 1.25) / .6) * (1 - smooth((t - 3.1) / .7)) : 0;
  return { stroke: Math.sin(t * 15) * .52 * burst, tuck, tail: Math.sin(t * 2.4) * .055, burst };
}
type Point = { x: number; y: number };
type FlyerBody = Point & { heading?: number; age: number; flyer: FlyerCourse };
// The stout body and inner remiges take hits; wispy tips and the long tail are
// deliberately forgiving. All weapons and contact share these rotated lobes.
export function flyerHulls(body: FlyerBody) {
  const c = Math.cos(body.heading ?? 0), s = Math.sin(body.heading ?? 0);
  const tuck = flyerStroke(body.age, body.flyer).tuck;
  return [{ x: 0, y: -.04, radius: .29 }, { x: 0, y: -.46, radius: .18 }, { x: 0, y: .38, radius: .18 },
    { x: -.43 * (1 - tuck), y: .03, radius: .18 }, { x: .43 * (1 - tuck), y: .03, radius: .18 }]
    .map(p => ({ x: body.x + p.x * c - p.y * s, y: body.y + p.x * s + p.y * c, radius: p.radius }));
}
export function flyerBodyHit(body: FlyerBody, a: Point, b: Point, padding = 0) {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  return flyerHulls(body).some(p => {
    const t = length ? clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / length) : 0;
    return (p.x - a.x - dx * t) ** 2 + (p.y - a.y - dy * t) ** 2 <= (p.radius + padding) ** 2;
  });
}
export function flyerBeamEntry(body: FlyerBody, origin: Point) {
  let first = Infinity;
  for (const p of flyerHulls(body)) {
    const d = p.radius ** 2 - (origin.x - p.x) ** 2;
    if (d < 0) continue;
    const half = Math.sqrt(d);
    if (p.y + half >= origin.y && p.y - half <= 9) first = Math.min(first, Math.max(origin.y, p.y - half));
  }
  return first;
}
