import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { preserveRandom } from './preserve-layout';

// Merge only fixed children of an articulation group. Animated pivots and
// instanced coats retain their identity; teeth and toes need no individual draws.
export function mergeGkFixed(group: T.Group) {
  for (const child of group.children) if (child instanceof T.Group) mergeGkFixed(child);
  const buckets = new Map<T.Material, T.Mesh[]>();
  for (const child of group.children) if (child instanceof T.Mesh && !(child instanceof T.InstancedMesh) && !Array.isArray(child.material)) {
    const list = buckets.get(child.material) ?? []; list.push(child); buckets.set(child.material, list);
  }
  for (const [material, meshes] of buckets) {
    if (meshes.length < 2) continue;
    const copies = meshes.map(mesh => { mesh.updateMatrix(); return mesh.geometry.clone().applyMatrix4(mesh.matrix); });
    const merged = mergeGeometries(copies); copies.forEach(g => g.dispose());
    const mesh = new T.Mesh(merged, material); mesh.name = 'merged-fixed-anatomy'; group.remove(...meshes); group.add(mesh);
  }
}

export function gkFeatherGeometry() {
  const p: number[] = [], uv: number[] = [], colors: number[] = [], indices: number[] = [];
  const rows = 8;
  for (let j = 0; j <= rows; j++) for (let i = 0; i < 3; i++) {
    const t = j / rows, side = i - 1, w = .16 * Math.sin(Math.PI * t) ** .65;
    p.push(side * w + .035 * t * t, t, .045 * Math.sin(t * Math.PI) * (1 - Math.abs(side)) - .075 * t * t);
    uv.push(i / 2, t); const c = i === 1 ? 1 : .74; colors.push(c, c, c);
    if (j < rows && i < 2) { const n = j * 3 + i; indices.push(n, n + 1, n + 3, n + 1, n + 4, n + 3); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  g.setIndex(indices); g.computeVertexNormals(); return g;
}

export function gkPlumage(geometry: T.BufferGeometry, material: T.Material, center: T.Vector3, radius: T.Vector3,
  count: number, seed: number, length: number, dark = false, flow = new T.Vector3(0, 0, -1)) {
  const mesh = new T.InstancedMesh(geometry, material, count), random = preserveRandom(seed);
  const n = new T.Vector3(), p = new T.Vector3(), shaft = new T.Vector3(), across = new T.Vector3();
  const m = new T.Matrix4(), rotation = new T.Quaternion(), scale = new T.Vector3(), color = new T.Color();
  for (let i = 0; i < count; i++) {
    const z = 1 - 2 * (i + .5) / count, a = i * 2.399963229728653 + (random() - .5) * .4, ring = Math.sqrt(1 - z * z);
    p.set(Math.cos(a) * ring, Math.sin(a) * ring, z);
    n.set(p.x / radius.x, p.y / radius.y, p.z / radius.z).normalize();
    p.multiply(radius).add(center);
    shaft.copy(flow).addScaledVector(n, -flow.dot(n));
    if (shaft.lengthSq() < .001) shaft.set(0, -1, -.2).addScaledVector(n, .1);
    shaft.normalize(); across.crossVectors(shaft, n).normalize(); shaft.crossVectors(n, across).normalize();
    rotation.setFromRotationMatrix(m.makeBasis(across, shaft, n));
    const l = length * (.75 + random() * .45);
    scale.set(l * (.8 + random() * .3), l, l);
    m.compose(p, rotation, scale); mesh.setMatrixAt(i, m);
    const back = dark || n.y > .2;
    color.setHex(back ? [0x685344, 0x78624b, 0x8e7353, 0x5b5841][i % 4] : [0xb7ab8b, 0xc6b99a, 0xa89d80, 0xd0c3a1][i % 4]);
    mesh.setColorAt(i, color);
  }
  mesh.name = 'coarse-feather-plumage'; mesh.castShadow = mesh.receiveShadow = true;
  mesh.computeBoundingSphere(); mesh.boundingSphere!.radius += .7; return mesh;
}

// Closed UV-seamed head volumes, elongated along Y; Z is the dinosaur's up axis.
export function gkSnout(sections: readonly (readonly [number, number, number, number])[]) {
  const p: number[] = [], uv: number[] = [], indices: number[] = [], sides = 32;
  for (const [j, [y, width, floor, crown]] of sections.entries()) for (let i = 0; i <= sides; i++) {
    const a = i / sides * Math.PI * 2;
    p.push(Math.sin(a) * width, y, floor + (crown - floor) * (.5 + .5 * Math.cos(a)));
    uv.push(i / sides, j / (sections.length - 1));
    if (j < sections.length - 1 && i < sides) { const n = j * (sides + 1) + i; indices.push(n, n + sides + 1, n + 1, n + 1, n + sides + 1, n + sides + 2); }
  }
  for (const j of [0, sections.length - 1]) {
    const index = p.length / 3, [y, , floor, crown] = sections[j]; p.push(0, y, (floor + crown) / 2); uv.push(.5, j / (sections.length - 1));
    for (let i = 0; i < sides; i++) { const n = j * (sides + 1) + i; if (j === 0) indices.push(index, n, n + 1); else indices.push(index, n + 1, n); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals();
  const n = g.attributes.normal;
  for (let j = 0; j < sections.length; j++) { const a = j * (sides + 1), b = a + sides;
    const normal = new T.Vector3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, normal.x, normal.y, normal.z); n.setXYZ(b, normal.x, normal.y, normal.z);
  }
  return g;
}

// Streaming a fixed-size closed tube avoids first-use buffers or gapped neck joints.
export function gkTube(rows = 22, sides = 16) {
  const geometry = new T.BufferGeometry(), p = new Float32Array((rows + 1) * (sides + 1) * 3), uv = [], indices = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= sides; i++) {
    uv.push(i / sides, j / rows);
    if (j < rows && i < sides) { const a = j * (sides + 1) + i; indices.push(a, a + 1, a + sides + 1, a + 1, a + sides + 2, a + sides + 1); }
  }
  for (let i = 1; i < sides - 1; i++) {
    const end = rows * (sides + 1); indices.push(0, i + 1, i, end, end + i, end + i + 1);
  }
  // End rings sit inside their connected parent volumes.
  const pos = new T.BufferAttribute(p, 3).setUsage(T.DynamicDrawUsage);
  geometry.setAttribute('position', pos); geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices);
  const across = new T.Vector3(), up = new T.Vector3(), normal = new T.Vector3(), q = new T.Vector3();
  return { geometry, pose(curve: T.CatmullRomCurve3, startRadius: number, endRadius: number) {
    for (let j = 0; j <= rows; j++) {
      const t = j / rows, c = curve.getPoint(t); normal.copy(curve.getTangent(t));
      across.set(1, 0, 0); if (Math.abs(normal.x) > .9) across.set(0, 1, 0);
      across.addScaledVector(normal, -across.dot(normal)).normalize(); up.crossVectors(normal, across).normalize();
      const r = j === 0 || j === rows ? .015 : T.MathUtils.lerp(startRadius, endRadius, t);
      for (let i = 0; i <= sides; i++) {
        const a = (i % sides) / sides * Math.PI * 2;
        q.copy(c).addScaledVector(across, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r);
        pos.setXYZ(j * (sides + 1) + i, q.x, q.y, q.z);
      }
    }
    pos.needsUpdate = true; geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  } };
}
