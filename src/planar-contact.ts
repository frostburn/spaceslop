type Point = { x: number; y: number };

export function ellipseEntry(a: Point, b: Point, pose: Point & { bank: number }, y: number, rx: number, ry: number) {
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
