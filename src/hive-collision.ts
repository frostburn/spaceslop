import { HEIGHT } from './playfield';
import { hiveCollisionRecipes, hiveRoot, projectHivePoint } from './hive-layout';

type Point = { x: number; y: number };
type Bounds = { minX: number; maxX: number; minY: number; maxY: number };
type Capsule = Bounds & { a: Point; b: Point; radius: number };
type Polygon = Bounds & { points: Point[] };
type Solid = Capsule | Polygon;
export type HullCircle = { x: number; y: number; radius: number };
export const FIGHTER_HULL: readonly HullCircle[] = [
  { x: 0, y: 0, radius: 0.34 }, { x: -0.51, y: 0, radius: 0.29 }, { x: 0.51, y: 0, radius: 0.29 },
  { x: 0, y: 0.58, radius: 0.22 }, { x: 0, y: -0.56, radius: 0.25 },
];
export const DRONE_HULL: readonly HullCircle[] = [{ x: 0, y: 0, radius: 0.33 }];
export const POD_HULL: readonly HullCircle[] = [{ x: 0, y: 0, radius: 0.27 }];
const FLIGHT_BOUNDS: Bounds = { minX: -3.95, maxX: 3.95, minY: -7.1, maxY: 6.6 };
export const POD_BOUNDS: Bounds = { minX: -4.12, maxX: 4.12, minY: -7.76, maxY: 7.76 };
const bounds = (): Bounds => ({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

function convexHull(cloud: Point[], hull: Point[]) {
  cloud.sort((a, b) => a.x - b.x || a.y - b.y);
  hull.length = 0;
  for (const point of cloud) {
    while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) hull.pop();
    hull.push(point);
  }
  const lower = hull.length + 1;
  for (let i = cloud.length - 2; i >= 0; i--) {
    const point = cloud[i];
    while (hull.length >= lower && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) hull.pop();
    hull.push(point);
  }
  hull.pop();
}

function nearest(point: Point, a: Point, b: Point, out: Point) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  out.x = a.x + dx * t;
  out.y = a.y + dy * t;
}

export class HiveCollision {
  private progress = NaN;
  private distance = NaN;
  private solids: Solid[] = [];
  private query = { x: 0, y: 0 };
  private correction = { x: 0, y: 0 };
  private sample = { x: 0, y: 0 };
  private colonies = hiveCollisionRecipes.map((recipe) => ({
    recipe,
    bodies: recipe.bodies.map((body) => ({
      recipe: body,
      spine: body.spine.map(() => ({ x: 0, y: 0, radius: 0 })),
      segments: body.spine.slice(1).map((): Capsule => ({ ...bounds(), a: { x: 0, y: 0 }, b: { x: 0, y: 0 }, radius: 0 })),
      cloud: body.cap.map((source) => ({ x: 0, y: 0, source })),
      cap: { ...bounds(), points: [] } as Polygon,
    })),
  }));

  update(progress: number, distance: number) {
    if (progress === this.progress && distance === this.distance) return;
    this.progress = progress;
    this.distance = distance;
    this.solids.length = 0;
    for (const colony of this.colonies) {
      const root = hiveRoot(colony.recipe.u, colony.recipe.v, progress);
      if (Math.abs(root.y) > HEIGHT * 0.78) continue;
      for (const body of colony.bodies) {
        for (let i = 0; i < body.spine.length; i++) {
          const source = body.recipe.spine[i], target = body.spine[i];
          target.radius = source.radius * projectHivePoint(root, source.point, distance, target);
        }
        for (let i = 0; i < body.segments.length; i++) {
          const segment = body.segments[i];
          segment.a = body.spine[i]; segment.b = body.spine[i + 1];
          segment.radius = Math.max(body.spine[i].radius, body.spine[i + 1].radius);
          segment.minX = Math.min(segment.a.x, segment.b.x) - segment.radius;
          segment.maxX = Math.max(segment.a.x, segment.b.x) + segment.radius;
          segment.minY = Math.min(segment.a.y, segment.b.y) - segment.radius;
          segment.maxY = Math.max(segment.a.y, segment.b.y) + segment.radius;
          this.solids.push(segment);
        }
        for (const point of body.cloud) projectHivePoint(root, point.source, distance, point);
        convexHull(body.cloud, body.cap.points);
        const cap = body.cap;
        cap.minX = cap.minY = Infinity; cap.maxX = cap.maxY = -Infinity;
        for (const point of cap.points) {
          cap.minX = Math.min(cap.minX, point.x); cap.maxX = Math.max(cap.maxX, point.x);
          cap.minY = Math.min(cap.minY, point.y); cap.maxY = Math.max(cap.maxY, point.y);
        }
        this.solids.push(cap);
      }
    }
  }

  private penetration(point: Point, radius: number, solid: Solid) {
    if (point.x + radius < solid.minX || point.x - radius > solid.maxX ||
      point.y + radius < solid.minY || point.y - radius > solid.maxY) return false;
    let inside = false, distance = Infinity, nearestX = 0, nearestY = 0;
    if ('radius' in solid) {
      nearest(point, solid.a, solid.b, this.query);
      nearestX = this.query.x; nearestY = this.query.y;
      radius += solid.radius;
      distance = Math.hypot(point.x - nearestX, point.y - nearestY);
    } else {
      inside = true;
      for (let i = 0; i < solid.points.length; i++) {
        const a = solid.points[i], b = solid.points[(i + 1) % solid.points.length];
        if (cross(a, b, point) < 0) inside = false;
        nearest(point, a, b, this.query);
        const d = Math.hypot(point.x - this.query.x, point.y - this.query.y);
        if (d < distance) { distance = d; nearestX = this.query.x; nearestY = this.query.y; }
      }
    }
    if (!inside && distance >= radius - 1e-6) return false;
    const depth = inside ? distance + radius + 1e-5 : radius - distance + 1e-5;
    const normal = inside ? -1 : 1;
    if (distance < 1e-8) {
      this.correction.x = (point.x < 0 ? 1 : -1) * depth;
      this.correction.y = 0;
    } else {
      this.correction.x = (point.x - nearestX) / distance * depth * normal;
      this.correction.y = (point.y - nearestY) / distance * depth * normal;
    }
    return true;
  }

  overlaps(point: Point, hull: readonly HullCircle[]) {
    for (const circle of hull) {
      this.sample.x = point.x + circle.x; this.sample.y = point.y + circle.y;
      for (const solid of this.solids) if (this.penetration(this.sample, circle.radius, solid)) return true;
    }
    return false;
  }

  private bound(point: Point, limits: Bounds) {
    point.x = Math.max(limits.minX, Math.min(limits.maxX, point.x));
    point.y = Math.max(limits.minY, Math.min(limits.maxY, point.y));
  }

  move(point: Point, dx: number, dy: number, hull: readonly HullCircle[], limits = FLIGHT_BOUNDS) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.09));
    let blocked = false;
    for (let step = 0; step < steps; step++) {
      point.x += dx / steps; point.y += dy / steps;
      this.bound(point, limits);
      for (let iteration = 0; iteration < 14; iteration++) {
        let moved = false;
        for (const circle of hull) for (const solid of this.solids) {
          this.sample.x = point.x + circle.x; this.sample.y = point.y + circle.y;
          if (!this.penetration(this.sample, circle.radius, solid)) continue;
          point.x += this.correction.x; point.y += this.correction.y;
          this.bound(point, limits);
          moved = blocked = true;
        }
        if (!moved) break;
      }
      // A scrolling colony can pin a stationary craft against a screen edge. Release it
      // toward the open central lane rather than leaving it embedded or trapped.
      if (this.overlaps(point, hull)) {
        const x = point.x, direction = x < 0 ? 1 : -1;
        for (let i = 1; i <= 50; i++) {
          point.x = x + direction * i * 0.08;
          this.bound(point, limits);
          if (!this.overlaps(point, hull)) break;
        }
        blocked = true;
      }
    }
    return blocked;
  }
}
