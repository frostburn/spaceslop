import type { HullCircle } from './hive-collision';
import { iceScroll, iceSolids } from './ice-layout';

type Point = { x: number; y: number };
const flightBounds = { minX: -3.95, maxX: 3.95, minY: -7.1, maxY: 6.6 };
export class IceCollision {
  private solids = iceSolids.map((rock) => ({ x: rock.x, y: rock.y, radius: rock.radius * 1.04 }));
  update(progress: number, _distance?: number) {
    const scroll = iceScroll(progress);
    this.solids.forEach((solid, i) => { solid.y = iceSolids[i].y - scroll; });
  }
  overlaps(point: Point, hull: readonly HullCircle[]) {
    return this.solids.some((solid) => Math.abs(solid.y - point.y) < 3 && hull.some((circle) =>
      Math.hypot(point.x + circle.x - solid.x, point.y + circle.y - solid.y) < circle.radius + solid.radius - 1e-6));
  }
  move(point: Point, dx: number, dy: number, hull: readonly HullCircle[], bounds = flightBounds) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 0.08));
    let blocked = false;
    const bound = () => {
      point.x = Math.max(bounds.minX, Math.min(bounds.maxX, point.x));
      point.y = Math.max(bounds.minY, Math.min(bounds.maxY, point.y));
    };
    for (let step = 0; step < steps; step++) {
      point.x += dx / steps; point.y += dy / steps; bound();
      for (let pass = 0; pass < 12; pass++) {
        let moved = false;
        for (const solid of this.solids) {
          if (Math.abs(solid.y - point.y) > 3) continue;
          for (const circle of hull) {
            const x = point.x + circle.x - solid.x, y = point.y + circle.y - solid.y;
            const distance = Math.hypot(x, y), radius = circle.radius + solid.radius;
            if (distance >= radius) continue;
            const depth = radius - distance + 1e-5;
            point.x += distance > 1e-8 ? x / distance * depth : (point.x < 0 ? 1 : -1) * depth;
            point.y += distance > 1e-8 ? y / distance * depth : 0;
            bound(); moved = blocked = true;
          }
        }
        if (!moved) break;
      }
      if (this.overlaps(point, hull)) {
        const x = point.x, direction = x < 0 ? 1 : -1;
        for (let i = 1; i <= 60 && this.overlaps(point, hull); i++) { point.x = x + direction * i * 0.08; bound(); }
        blocked = true;
      }
    }
    return blocked;
  }
}
