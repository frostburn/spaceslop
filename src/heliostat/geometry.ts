import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type Point3 = [number, number, number];

/** Static surfaces batch by material. Face UVs repeat at a metric scale. */
export function heliostatBatch(root: T.Group) {
  const buckets = new Map<T.Material, T.BufferGeometry[]>();
  function add(source: T.BufferGeometry, material: T.Material, at: Point3 = [0, 0, 0], rotation?: Point3, planar = false) {
    const geometry = source.index ? source.toNonIndexed() : source;
    if (geometry !== source) source.dispose();
    if (planar) {
      const p = geometry.attributes.position, normal = geometry.attributes.normal, uv = geometry.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const nx = Math.abs(normal.getX(i)), ny = Math.abs(normal.getY(i)), nz = Math.abs(normal.getZ(i));
        uv.setXY(i, (nx > ny && nx > nz ? p.getY(i) : p.getX(i)) * .65,
          (nz >= nx && nz >= ny ? p.getY(i) : p.getZ(i)) * .65);
      }
    }
    if (rotation) geometry.applyMatrix4(new T.Matrix4().makeRotationFromEuler(new T.Euler(...rotation)));
    geometry.translate(...at);
    const bucket = buckets.get(material) ?? []; bucket.push(geometry); buckets.set(material, bucket);
  }
  return {
    add,
    box(size: Point3, at: Point3, material: T.Material, bevel = 0, rotation?: Point3) {
      add(bevel ? new RoundedBoxGeometry(...size, 1, bevel) : new T.BoxGeometry(...size), material, at, rotation, true);
    },
    rod(a: Point3, b: Point3, radius: number, material: T.Material, sides = 10) {
      const start = new T.Vector3(...a), delta = new T.Vector3(...b).sub(start);
      const geometry = new T.CylinderGeometry(radius, radius, delta.length(), sides);
      const uv = geometry.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * radius * 4, uv.getY(i) * delta.length() * .65);
      geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), delta.clone().normalize()));
      add(geometry, material, start.addScaledVector(delta, .5).toArray() as Point3);
    },
    ring(radius: number, tube: number, at: Point3, material: T.Material, rotation: Point3 = [Math.PI / 2, 0, 0], segments = 40) {
      add(new T.TorusGeometry(radius, tube, 6, segments), material, at, rotation);
    },
    pipe(points: Point3[], radius: number, material: T.Material) {
      add(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), 24, radius, 6, false), material);
    },
    finish() {
      for (const [material, pieces] of buckets) {
        const geometry = mergeGeometries(pieces);
        for (const piece of pieces) piece.dispose();
        if (!geometry) throw new Error('Incompatible heliostat geometry');
        const mesh = new T.Mesh(geometry, material); mesh.receiveShadow = true;
        root.add(mesh);
      }
      buckets.clear();
    },
  };
}
