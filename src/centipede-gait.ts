type Point = { x: number; y: number };
type Foot = {
  contact: Point;
  start: Point;
  end: Point;
  progress: number;
  duration: number;
};
export type CentipedeGait = { center: Point; heading: number; feet: [Foot, Foot] };
export const CENTIPEDE_BODY_HEIGHT = .29;

function stance(center: Point, heading: number, side: number, stride: number): Point {
  const forward = -.13 + stride;
  return {
    x: center.x + Math.sin(heading) * forward + side * .69 * Math.cos(heading),
    y: center.y + Math.cos(heading) * forward - side * .69 * Math.sin(heading),
  };
}

export function createCentipedeGait(center: Point, heading: number, slot: number): CentipedeGait {
  function foot(side: number): Foot {
    const contact = stance(center, heading, side, .17 * Math.sin(slot * .85 + side * Math.PI / 2));
    return { contact, start: contact, end: contact, progress: 1, duration: .15 };
  }
  return { center, heading, feet: [foot(-1), foot(1)] };
}

export function stepCentipedeGait(gait: CentipedeGait, center: Point, heading: number, dt: number) {
  const dx = center.x - gait.center.x, dy = center.y - gait.center.y;
  const turn = Math.atan2(Math.sin(heading - gait.heading), Math.cos(heading - gait.heading));
  gait.center = center;
  gait.heading = heading;
  const speed = Math.hypot(dx, dy) / Math.max(dt, 1e-6);
  function landing(side: number, remaining: number) {
    const leadTime = (remaining + .075) / Math.max(dt, 1e-6);
    const lookAhead = Math.max(-.43, Math.min(.43, turn * leadTime));
    const target = stance(center, heading + lookAhead, side, 0);
    const lead = Math.min(.29 / Math.max(Math.hypot(dx, dy), 1e-6), leadTime);
    return { x: target.x + dx * lead, y: target.y + dy * lead };
  }
  let swinging = gait.feet.some(foot => foot.progress < 1);
  for (const [index, foot] of gait.feet.entries()) {
    const side = index ? 1 : -1;
    if (foot.progress < 1) {
      foot.progress = Math.min(1, foot.progress + dt / foot.duration);
      foot.end = landing(side, foot.duration * (1 - foot.progress));
      if (foot.progress === 1) foot.contact = foot.end;
      continue;
    }
    const neutral = stance(center, heading, side, 0);
    const error = Math.hypot(foot.contact.x - neutral.x, foot.contact.y - neutral.y);
    // The second foot can start to lift early if the body pivots sharply.
    if (error < (swinging ? .37 : .19)) continue;
    foot.duration = .16 - .065 * Math.min(1, speed / 4 + Math.abs(turn) / .12);
    foot.start = foot.contact;
    foot.end = landing(side, foot.duration);
    foot.progress = 0;
    swinging = true;
  }
}

export function centipedeFoot(gait: CentipedeGait, index: number, heading: number) {
  const foot = gait.feet[index], t = foot.progress;
  const eased = t * t * (3 - 2 * t);
  const x = foot.start.x + (foot.end.x - foot.start.x) * eased - gait.center.x;
  const y = foot.start.y + (foot.end.y - foot.start.y) * eased - gait.center.y;
  return { x: Math.cos(heading) * x - Math.sin(heading) * y,
    y: Math.sin(heading) * x + Math.cos(heading) * y,
    z: -CENTIPEDE_BODY_HEIGHT + .19 * Math.sin(Math.PI * t) ** 2 };
}
