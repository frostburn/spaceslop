import * as T from 'three';

type Point = { x: number; y: number };
const epsilon = 1e-7;
const axes = ['x', 'y'] as const;
const opaque = (material: T.Material) => material.visible && material.depthWrite && !material.transparent;

// Boss damage belongs to the exposed muzzle, not the nearest edge of the whole hull.
// Use the posed model anchor so recoil and the guardian's expanding vent stay aligned.
export function createBossLaserContact(plane: T.Object3D, model: T.Object3D) {
  const left = model.getObjectByName('laser_contact_L')!, right = model.getObjectByName('laser_contact_R')!;
  const point = new T.Vector3(), result = new T.Vector2();
  return (cannonX: number, distance: number) => {
    (cannonX < 0 ? left : right).getWorldPosition(point);
    plane.worldToLocal(point);
    const projection = distance / (distance - point.z);
    return result.set(point.x * projection, point.y * projection);
  };
}

// Clip the screen-space beam against opaque model triangles. A ray at the simulation's
// z=0 would pass underneath raised shells; bounding boxes alone would hit empty space.
export function createLaserContactTrace(plane: T.Object3D) {
  const projection = new T.Matrix4(), relative = new T.Matrix4(), inverse = new T.Matrix4();
  const bounds = new T.Box3(), a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
  const result = new T.Vector2();
  const posed = new WeakMap<T.SkinnedMesh,Float32Array>();
  return (origin: Point, end: Point, model: T.Object3D, distance?: number) => {
    result.set(end.x, end.y);
    const dx = end.x - origin.x, dy = end.y - origin.y, lengthSquared = dx * dx + dy * dy;
    if (lengthSquared < epsilon || !model.visible) return result;
    model.updateWorldMatrix(true, false);
    model.updateMatrixWorld(true);
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
      bounds.copy(geometry.boundingBox);
      // Animated marine tails/necks may leave the bind-pose bounds. Exact vertices
      // below are skinned; this conservative envelope only avoids premature rejection.
      if(object instanceof T.SkinnedMesh)bounds.expandByScalar(1.6);
      bounds.applyMatrix4(relative);
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
      let deformed: Float32Array | undefined;
      if(object instanceof T.SkinnedMesh) {
        deformed=posed.get(object);
        if(!deformed || deformed.length!==positions.count*3){deformed=new Float32Array(positions.count*3);posed.set(object,deformed);}
        // Transform each unique vertex once, rather than once for every indexed
        // triangle using it. The scratch buffer persists across laser frames.
        for(let i=0;i<positions.count;i++){object.getVertexPosition(i,a);deformed[i*3]=a.x;deformed[i*3+1]=a.y;deformed[i*3+2]=a.z;}
      }
      for (let i = start; i + 2 < stop; i += 3) {
        const ia=indices?indices.getX(i):i,ib=indices?indices.getX(i+1):i+1,ic=indices?indices.getX(i+2):i+2;
        if(deformed){a.fromArray(deformed,ia*3);b.fromArray(deformed,ib*3);c.fromArray(deformed,ic*3);}
        else {object.getVertexPosition(ia,a);object.getVertexPosition(ib,b);object.getVertexPosition(ic,c);}
        a.applyMatrix4(relative);b.applyMatrix4(relative);c.applyMatrix4(relative);
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
