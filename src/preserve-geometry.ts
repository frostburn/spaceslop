import * as T from 'three';

export type PreservePart = { position: T.Vector3; scale: T.Vector3; rotation: T.Quaternion; color: T.Color };

// All repeated station details in a bay share one geometry and draw call.
export function preserveBatch(name: string, geometry: T.BufferGeometry, material: T.Material, parts: PreservePart[]) {
  const mesh = new T.InstancedMesh(geometry, material, parts.length), matrix = new T.Matrix4();
  mesh.name = name;
  for (const [i, p] of parts.entries()) {
    mesh.setMatrixAt(i, matrix.compose(p.position, p.rotation, p.scale));
    mesh.setColorAt(i, p.color);
  }
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.computeBoundingSphere();
  return mesh;
}

export function preservePart(x: number, y: number, z: number, sx: number, sy: number, sz: number, color: number, rz = 0): PreservePart {
  return { position: new T.Vector3(x, y, z), scale: new T.Vector3(sx, sy, sz),
    rotation: new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), rz), color: new T.Color(color) };
}

export function preserveBeam(a: T.Vector3, b: T.Vector3, width: number, depth: number, color: number): PreservePart {
  return { position: a.clone().add(b).multiplyScalar(.5), scale: new T.Vector3(width, a.distanceTo(b), depth),
    rotation: new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize()), color: new T.Color(color) };
}

// Continuous, tapering volumes for trunks, roots and branches. Roots follow the
// heightfield at their centers and are buried enough to meet the soil naturally.
export function preserveLimb(points: T.Vector3[], radius: number, endRadius: number, seed: number) {
  const curve = new T.CatmullRomCurve3(points), rings = 14, sides = 8;
  const positions: number[] = [], uvs: number[] = [], colors: number[] = [], indices: number[] = [];
  const along = new T.Vector3(), across = new T.Vector3(), up = new T.Vector3(), p = new T.Vector3();
  const length = curve.getLength();
  for (let j = 0; j <= rings; j++) {
    const t = j / rings;
    along.copy(curve.getTangent(t));
    across.set(0, 0, 1);
    if (Math.abs(across.dot(along)) > .94) across.set(0, 1, 0);
    across.cross(along).normalize(); up.crossVectors(along, across).normalize();
    const center = curve.getPoint(t), r = radius * (1 - t) ** 1.15 + endRadius * t;
    for (let i = 0; i <= sides; i++) {
      const a = (i % sides) / sides * Math.PI * 2;
      const swell = 1 + Math.sin(a * 3 + seed) * .12 + Math.sin(a * 5 + t * 3) * .045;
      p.copy(center).addScaledVector(across, Math.cos(a) * r * swell).addScaledVector(up, Math.sin(a) * r * swell);
      positions.push(p.x, p.y, p.z); uvs.push(i / sides, t * length * .8);
      const moss = .5 + .5 * Math.sin(p.y * 1.7 + p.x + seed);
      colors.push(.65 + moss * .2, .64 + moss * .22, .51 + moss * .08);
      if (j < rings && i < sides) { const n = j * (sides + 1) + i; indices.push(n, n + 1, n + sides + 1, n + 1, n + sides + 2, n + sides + 1); }
    }
  }
  // Closed ends are embedded in their parent volume, never hollow tubes.
  for (const j of [0, rings]) {
    const center = curve.getPoint(j / rings), index = positions.length / 3;
    positions.push(center.x, center.y, center.z); uvs.push(.5, j / rings * length * .8); colors.push(.7, .68, .52);
    for (let i = 0; i < sides; i++) {
      const a = j * (sides + 1) + i;
      if (j === 0) indices.push(index, a + 1, a); else indices.push(index, a, a + 1);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  g.setIndex(indices); g.computeVertexNormals();
  return g;
}

export function preserveFrond() {
  const positions: number[] = [], colors: number[] = [], uv: number[] = [];
  type V = [number, number, number];
  function tri(a: V, b: V, c: V, shades: number[]) {
    positions.push(...a, ...b, ...c);
    for (const [i, p] of [a, b, c].entries()) { colors.push(shades[i], shades[i], shades[i]); uv.push(p[0] * 1.6 + .5, p[1]); }
  }
  const stem = (t: number): V => [.17 * t * t, t, .24 * Math.sin(t * Math.PI) - .13 * t * t];
  for (let i = 0; i < 16; i++) {
    const a = stem(i / 16), b = stem((i + 1) / 16), w = .009 * (1 - i / 17);
    tri([a[0] - w, a[1], a[2]], [a[0] + w, a[1], a[2]], b, [.55, .86, .8]);
  }
  for (let i = 0; i < 12; i++) for (const side of [-1, 1]) {
    const t = .065 + i * .073 + (side > 0 ? .018 : 0), spread = Math.sin(Math.PI * (t + .05));
    const [x, y, z] = stem(t), dx = side * (.025 + .23 * spread), dy = .035 + .09 * spread, width = .014 + .025 * spread;
    const base: V = [x, y, z], ridge: V = [x + dx * .5, y + dy * .5, z + .025];
    const tip: V = [x + dx, y + dy, z - .035 * spread];
    const a: V = [x + dx * .43, y + dy * .43 + width, z], b: V = [x + dx * .43, y + dy * .43 - width, z - .012];
    tri(base, b, ridge, [.55, .7, 1]); tri(b, tip, ridge, [.7, .8, 1]);
    tri(base, ridge, a, [.55, 1, .81]); tri(ridge, tip, a, [1, .8, .81]);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  return g;
}
