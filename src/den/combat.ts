type Point = { x: number; y: number };

export const DEN_HP = 105;
export const DEN_APPROACH = 1.6;
export const DEN_CYCLE = 5.6;
export const DEN_BURSTS = [1.48, 1.86, 2.27, 3.38] as const;
export const DEN_GUNS = [{ x: -1.49, y: -1.02 }, { x: 1.49, y: -1.02 }] as const;

const ease = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

export function denPose(time: number) {
  const cycle = Math.floor(Math.max(0, time) / DEN_CYCLE);
  const t = Math.max(0, time) % DEN_CYCLE;
  const side = cycle % 2 === 0 ? -1 : 1;
  const sweep = ease((t - 1.28) / 1.22);
  const turn = Math.sin(sweep * Math.PI) ** 2;
  const charge = ease((t - .45) / .83) * (1 - ease((t - 1.28) / .19));
  const throttle = .21 + .75 * Math.max(charge, turn, .65 * Math.exp(-((t - 3.33) ** 2) / .027));
  const burst = DEN_BURSTS.findIndex(at => t >= at && t < at + .13);
  return {
    x: side * (1.46 - 2.92 * sweep),
    y: 2.45 + 2.8 * ease(-time / DEN_APPROACH) + .13 * Math.sin(time * 2.1) - .83 * turn,
    bank: side * turn * .2 + .026 * Math.sin(time * 1.8),
    throttle,
    firingGun: burst < 0 ? -1 : (cycle + burst) % DEN_GUNS.length,
    flash: burst < 0 ? 0 : 1 - (t - DEN_BURSTS[burst]) / .13,
  };
}

type Pose = ReturnType<typeof denPose>;

export function denMount(pose: Pose, point: Point) {
  const c = Math.cos(pose.bank), s = Math.sin(pose.bank);
  return { x: pose.x + c * point.x - s * point.y, y: pose.y + s * point.x + c * point.y };
}

function ellipseEntry(a: Point, b: Point, pose: Pose, y: number, rx: number, ry: number) {
  const c = Math.cos(pose.bank), s = Math.sin(pose.bank);
  const project = (p: Point) => {
    const x = p.x - pose.x, py = p.y - pose.y;
    return { x: (c * x + s * py) / rx, y: (c * py - s * x - y) / ry };
  };
  const start = project(a), end = project(b);
  const outside = start.x ** 2 + start.y ** 2 - 1;
  if (outside <= 0) return 0;
  const dx = end.x - start.x, dy = end.y - start.y;
  const speed = dx * dx + dy * dy;
  const dot = start.x * dx + start.y * dy;
  const discriminant = dot * dot - speed * outside;
  if (speed === 0 || discriminant < 0 || dot >= 0) return Infinity;
  const entry = (-dot - Math.sqrt(discriminant)) / speed;
  return entry <= 1 ? entry : Infinity;
}

export function denBodyEntry(time: number, a: Point, b: Point) {
  const pose = denPose(time);
  return Math.min(
    ellipseEntry(a, b, pose, -.04, 1.66, 1.57),
    ellipseEntry(a, b, pose, 1.88, 1.21, 1.34),
  );
}
