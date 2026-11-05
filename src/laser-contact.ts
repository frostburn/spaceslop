import * as T from 'three';

type Point = { x: number; y: number };
const epsilon = 1e-7;
const axes = ['x', 'y'] as const;
const opaque = (material: T.Material) => material.visible && material.depthWrite && !material.transparent;

// Clip the screen-space beam against opaque model triangles. A ray at the simulation's
// z=0 would pass underneath raised shells; bounding boxes alone would hit empty space.
export function createLaserContactTrace(plane: T.Object3D) {
  const projection = new T.Matrix4(), relative = new T.Matrix4(), inverse = new T.Matrix4();
  const bounds = new T.Box3(), a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
  const result = new T.Vector2();
  return (origin: Point, end: Point, model: T.Object3D, distance?: number) => {
    result.set(end.x, end.y);
    const dx = end.x - origin.x, dy = end.y - origin.y, lengthSquared = dx * dx + dy * dy;
    if (lengthSquared < epsilon || !model.visible) return result;
    model.updateWorldMatrix(true, true);
    inverse.copy(plane.matrixWorld).invert();
    // The camera always looks along the flight plane's local -Z axis. Project onto
    // its z=0 plane, including the hive perspective and the boss camera distance.
    projection.set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, distance ? -1 / distance : 0, 1);
    let nearest = 1;
    model.traverseVisible((object) => {
      if (!(object instanceof T.Mesh)) return;
      if (Array.isArray(object.material) ? !object.material.some(opaque) : !opaque(object.material)) return;
      const geometry = object.geometry as T.BufferGeometry;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      if (!geometry.boundingBox) return;
      relative.copy(projection).multiply(inverse).multiply(object.matrixWorld);
      bounds.copy(geometry.boundingBox).applyMatrix4(relative);
      let low = 0, high = nearest;
      for (const axis of axes) {
        const delta = axis === 'x' ? dx : dy;
        if (Math.abs(delta) < epsilon) {
          if (origin[axis] < bounds.min[axis] || origin[axis] > bounds.max[axis]) return;
        } else {
          const t0 = (bounds.min[axis] - origin[axis]) / delta, t1 = (bounds.max[axis] - origin[axis]) / delta;
          low = Math.max(low, Math.min(t0, t1)); high = Math.min(high, Math.max(t0, t1));
        }
      }
      if (low > high) return;
      const positions = geometry.getAttribute('position'), indices = geometry.index;
      const start = geometry.drawRange.start, count = indices?.count ?? positions.count;
      const stop = Math.min(count, start + geometry.drawRange.count);
      for (let i = start; i + 2 < stop; i += 3) {
        a.fromBufferAttribute(positions, indices ? indices.getX(i) : i).applyMatrix4(relative);
        b.fromBufferAttribute(positions, indices ? indices.getX(i + 1) : i + 1).applyMatrix4(relative);
        c.fromBufferAttribute(positions, indices ? indices.getX(i + 2) : i + 2).applyMatrix4(relative);
        let first = Infinity, last = -Infinity;
        for (let edge = 0; edge < 3; edge++) {
          const p = edge === 0 ? a : edge === 1 ? b : c, q = edge === 0 ? b : edge === 1 ? c : a;
          const sp = (p.x - origin.x) * dy - (p.y - origin.y) * dx;
          const sq = (q.x - origin.x) * dy - (q.y - origin.y) * dx;
          if (sp * sq > 0) continue;
          if (Math.abs(sp - sq) < epsilon) {
            if (Math.abs(sp) > epsilon) continue;
            const tp = ((p.x - origin.x) * dx + (p.y - origin.y) * dy) / lengthSquared;
            const tq = ((q.x - origin.x) * dx + (q.y - origin.y) * dy) / lengthSquared;
            first = Math.min(first, tp, tq); last = Math.max(last, tp, tq);
          } else {
            const fraction = sp / (sp - sq);
            const x = p.x + (q.x - p.x) * fraction, y = p.y + (q.y - p.y) * fraction;
            const t = ((x - origin.x) * dx + (y - origin.y) * dy) / lengthSquared;
            first = Math.min(first, t); last = Math.max(last, t);
          }
        }
        if (last >= 0 && first <= nearest) nearest = Math.max(0, first);
      }
    });
    return result.set(origin.x + dx * nearest, origin.y + dy * nearest);
  };
}
