import * as T from 'three';
import { preserveRandom } from './preserve-layout';

const rows = 64, sides = 64, length = 3.15, back = .75;
const profile = [[.75, .38, -.22, .51], [.5, .63, -.22, .76], [.25, .72, -.22, .78],
  [-.1, .73, -.2, .73], [-.35, .70, -.19, .61], [-.65, .64, -.18, .52],
  [-1.2, .57, -.17, .43], [-1.9, .53, -.15, .37], [-2.4, .43, -.12, .32]];
const openings = [12, 52].map(i => ({ i0: i - 4, i1: i + 4, j0: 45, j1: 59 }));
export const GROUNDSKEEPER_EYE = { x: .55, y: -.30, z: .52 };

// The scalp, socket and narial rim all sample the same skull surface. Nostrils
// replace patches of that surface with an inset tunnel, rather than covering it.
export function gkSkullPoint(y: number, angle: number, out = new T.Vector3()) {
  let j = 0;
  while (j < profile.length - 2 && y < profile[j + 1][0]) j++;
  const a = profile[j], b = profile[j + 1], t = T.MathUtils.clamp((a[0] - y) / (a[0] - b[0]), 0, 1);
  const width = T.MathUtils.lerp(a[1], b[1], t), floor = T.MathUtils.lerp(a[2], b[2], t), crown = T.MathUtils.lerp(a[3], b[3], t);
  const sine = Math.sin(angle), x = Math.sign(sine) * Math.abs(sine) ** .72 * width;
  const z = floor + (crown - floor) * (.5 + .5 * Math.cos(angle)) ** .82;
  const socket = Math.exp(-((y - GROUNDSKEEPER_EYE.y) ** 2 / .065 + (z - GROUNDSKEEPER_EYE.z) ** 2 / .018)) * T.MathUtils.smoothstep(Math.abs(x), .35, .6);
  return out.set(x - Math.sign(x) * socket * .15, y, z);
}

export function gkSkullNormal(y: number, angle: number, out = new T.Vector3()) {
  const along = gkSkullPoint(y - .001, angle).sub(gkSkullPoint(y + .001, angle));
  const around = gkSkullPoint(y, angle + .001).sub(gkSkullPoint(y, angle - .001));
  return out.crossVectors(along, around).normalize();
}

export function gkNaris(side: number) {
  const opening = openings[side > 0 ? 0 : 1];
  const y = back - (opening.j0 + opening.j1) / 2 / rows * length;
  const angle = (opening.i0 + opening.i1) / 2 / sides * Math.PI * 2;
  return { y, angle, surface: gkSkullPoint(y, angle), normal: gkSkullNormal(y, angle) };
}

export function gkSkullGeometry() {
  const positions: number[] = [], uv: number[] = [], colors: number[] = [], indices: number[] = [], seams: [number, number][] = [];
  const base = new T.Color(0x9b9179), patch = new T.Color(0x92704d), inner = new T.Color(0x302820), color = new T.Color();
  function vertex(p: T.Vector3, angle: number, depth = 0) {
    const index = positions.length / 3;
    positions.push(p.x, p.y, p.z); uv.push(angle / (Math.PI * 2), (back - p.y) / length);
    const eye = Math.exp(-((Math.abs(p.x) - GROUNDSKEEPER_EYE.x) ** 2 / .07 + (p.y - GROUNDSKEEPER_EYE.y) ** 2 / .30 + (p.z - GROUNDSKEEPER_EYE.z) ** 2 / .10));
    color.copy(base).lerp(patch, eye * .75).multiplyScalar(.87 + T.MathUtils.smoothstep(p.z, -.1, .7) * .13);
    color.lerp(inner, T.MathUtils.smoothstep(depth, .025, .23)); colors.push(color.r, color.g, color.b);
    return index;
  }
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= sides; i++) {
    const y = back - j / rows * length, angle = i / sides * Math.PI * 2;
    vertex(gkSkullPoint(y, angle), angle);
    if (i === 0) seams.push([j * (sides + 1), j * (sides + 1) + sides]);
    const hole = openings.some(h => i >= h.i0 && i < h.i1 && j >= h.j0 && j < h.j1);
    if (j < rows && i < sides && !hole) {
      const n = j * (sides + 1) + i;
      indices.push(n, n + sides + 1, n + 1, n + 1, n + sides + 1, n + sides + 2);
    }
  }
  for (const h of openings) {
    const edge: [number, number][] = [];
    for (let i = h.i0; i < h.i1; i++) edge.push([h.j0, i]);
    for (let j = h.j0; j < h.j1; j++) edge.push([j, h.i1]);
    for (let i = h.i1; i > h.i0; i--) edge.push([h.j1, i]);
    for (let j = h.j1; j > h.j0; j--) edge.push([j, h.i0]);
    const yc = back - (h.j0 + h.j1) / 2 / rows * length, ac = (h.i0 + h.i1) / 2 / sides * Math.PI * 2;
    const centerNormal = gkSkullNormal(yc, ac);
    let previous = edge.map(([j, i]) => j * (sides + 1) + i);
    // A low raised lip rolls into the opening, then narrows into a shaded nasal
    // passage. Its outer perimeter shares the original skin's indexed vertices.
    for (const [radius, inset] of [[1, -.035], [.76, .015], [.55, .18], [.22, .30]]) {
      const ring = edge.map(([j, i]) => {
        const x = (i - (h.i0 + h.i1) / 2) / ((h.i1 - h.i0) / 2), y = (j - (h.j0 + h.j1) / 2) / ((h.j1 - h.j0) / 2);
        const l = Math.hypot(x, y), angle = ac + x / l * .32 * radius, along = yc - y / l * .26 * radius;
        const p = gkSkullPoint(along, angle).addScaledVector(centerNormal, -inset); p.y += Math.max(0, inset) * .25;
        return vertex(p, angle, Math.max(0, inset));
      });
      for (let k = 0; k < edge.length; k++) {
        const next = (k + 1) % edge.length;
        indices.push(previous[k], ring[k], previous[next], previous[next], ring[k], ring[next]);
      }
      previous = ring;
    }
    const end = gkSkullPoint(yc, ac).addScaledVector(centerNormal, -.32); end.y += .08;
    const cap = vertex(end, ac, .32);
    for (let k = 0; k < edge.length; k++) indices.push(previous[k], cap, previous[(k + 1) % edge.length]);
  }
  for (const j of [0, rows]) {
    const y = back - j / rows * length, p = gkSkullPoint(y, 0).add(gkSkullPoint(y, Math.PI)).multiplyScalar(.5), cap = vertex(p, 0);
    let previous = Array.from({ length: sides + 1 }, (_, i) => j * (sides + 1) + i);
    if (j === rows) for (const radius of [.70, .30]) {
      const ring = previous.map((_, i) => {
        const point = gkSkullPoint(y, i / sides * Math.PI * 2).sub(p).multiplyScalar(radius).add(p);
        point.y -= .13 * Math.sqrt(1 - radius * radius);
        return vertex(point, i / sides * Math.PI * 2);
      });
      seams.push([ring[0], ring[sides]]);
      for (let i = 0; i < sides; i++) indices.push(previous[i], ring[i], previous[i + 1], previous[i + 1], ring[i], ring[i + 1]);
      previous = ring;
    }
    if (j === rows) positions[cap * 3 + 1] -= .13;
    for (let i = 0; i < sides; i++) {
      if (j === 0) indices.push(cap, previous[i], previous[i + 1]); else indices.push(cap, previous[i + 1], previous[i]);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  // The parametric seam is shared visually, including its lighting normal.
  const normals = geometry.attributes.normal, normal = new T.Vector3();
  for (const [a, b] of seams) {
    normal.fromBufferAttribute(normals, a).add(new T.Vector3().fromBufferAttribute(normals, b)).normalize();
    normals.setXYZ(a, normal.x, normal.y, normal.z); normals.setXYZ(b, normal.x, normal.y, normal.z);
  }
  return geometry;
}

export function gkScalpPlumage(feather: T.BufferGeometry, material: T.Material) {
  const count = 850, mesh = new T.InstancedMesh(feather, material, count), random = preserveRandom(201);
  const transform = new T.Object3D(), normal = new T.Vector3(), shaft = new T.Vector3(), across = new T.Vector3(), basis = new T.Matrix4(), tint = new T.Color();
  const flow = new T.Vector3(0, 1, -.15), light = new T.Color(0x8b785e);
  for (let i = 0; i < count; i++) {
    let y = .75 - 1.6 * (i + .5) / count + .035 * Math.sin(i * 1.7);
    const a = ((i * 2.399963) % (Math.PI * 2)) / (Math.PI * 2) * 3.5 - 1.75;
    if (Math.abs(y - GROUNDSKEEPER_EYE.y) < .32 && Math.abs(Math.abs(a) - .95) < .52) y = .40 + random() * .30;
    transform.position.copy(gkSkullPoint(y, a)); gkSkullNormal(y, a, normal); transform.position.addScaledVector(normal, .018);
    shaft.copy(flow).addScaledVector(normal, -normal.dot(flow)).normalize();
    across.crossVectors(shaft, normal).normalize(); shaft.crossVectors(normal, across).normalize();
    transform.quaternion.setFromRotationMatrix(basis.makeBasis(across, shaft, normal));
    const length = (.18 + .38 * T.MathUtils.smoothstep(y, -.85, -.25) + Math.max(0, y) * .25) * (.82 + random() * .28);
    transform.scale.set(length * 1.4, length, length); transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix);
    tint.setHex(0x65503f).lerp(light, 1 - T.MathUtils.smoothstep(y, -.6, .3)).multiplyScalar(.91 + random() * .17); mesh.setColorAt(i, tint);
  }
  mesh.name = 'layered-scalp-and-cheek-feathers'; mesh.computeBoundingSphere(); mesh.boundingSphere!.radius += .5;
  return mesh;
}
