import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Outline = readonly (readonly [number, number])[];
type Profile = readonly (readonly [radius: number, depth: number])[];
type TileBounds = readonly [left: number, bottom: number, right: number, top: number];

// The approved sheet is a front projection. UVs on both sides share that
// projection, but the material fades the paint out around the shell bevel.
export function paintCrabTile(geometry: T.BufferGeometry, cell: number, bounds: TileBounds, crop: TileBounds = [0, 0, 1, 1]) {
  const position = geometry.getAttribute('position');
  const uv = new T.Float32BufferAttribute(new Float32Array(position.count * 2), 2);
  const [left, bottom, right, top] = bounds;
  for (let i = 0; i < position.count; i++) {
    const u = T.MathUtils.clamp((position.getX(i) - left) / (right - left), 0, 1);
    const v = T.MathUtils.clamp((position.getY(i) - bottom) / (top - bottom), 0, 1);
    uv.setXY(i, (cell % 4 + 0.012 + 0.976 * T.MathUtils.lerp(crop[0], crop[2], u)) / 4,
      1 - (Math.floor(cell / 4) + 0.988 - 0.976 * T.MathUtils.lerp(crop[1], crop[3], v)) / 3);
  }
  return geometry.setAttribute('uv', uv);
}

function rings(rows: number, sides: number, point: (row: number, angle: number, p: T.Vector3) => void) {
  const shape: number[] = [], indices: number[] = [], p = new T.Vector3();
  for (let row = 0; row < rows; row++) for (let i = 0; i <= sides; i++) {
    point(row, (i % sides) / sides * Math.PI * 2, p);
    shape.push(p.x, p.y, p.z);
    if (row === rows - 1 || i === sides) continue;
    const a = row * (sides + 1) + i, b = a + sides + 1;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(shape, 3)).setIndex(indices).computeVertexNormals();
  const normal = geometry.getAttribute('normal'), n = new T.Vector3(), m = new T.Vector3();
  for (let row = 0; row < rows; row++) {
    const first = row * (sides + 1), last = first + sides;
    n.fromBufferAttribute(normal, first).add(m.fromBufferAttribute(normal, last)).normalize();
    normal.setXYZ(first, n.x, n.y, n.z);
    normal.setXYZ(last, n.x, n.y, n.z);
  }
  return geometry;
}

function colorCrab(geometry: T.BufferGeometry, paint: (x: number, y: number, z: number, out: T.Color) => void) {
  const p = geometry.getAttribute('position'), color = new T.Color(), colors: number[] = [];
  for (let i = 0; i < p.count; i++) {
    paint(p.getX(i), p.getY(i), p.getZ(i), color);
    colors.push(color.r, color.g, color.b);
  }
  return geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
}

const slate = new T.Color(0x586068), oxide = new T.Color(0x9b6d54);
function plated(geometry: T.BufferGeometry) {
  return colorCrab(geometry, (x, y, z, out) => {
    const seam = Math.max(0, Math.sin(y * 15 + Math.abs(x) * 2.4 + z * 3.5)) ** 7;
    const grain = Math.sin(38 * x + Math.sin(y * 23)) * Math.cos(y * 24 + z * 32);
    out.copy(slate).lerp(oxide, 0.59 * seam).multiplyScalar(0.96 + 0.17 * grain);
  });
}

function plate(outline: Outline, profile: Profile, ridges: number, centerX = 0) {
  const contour = new T.CatmullRomCurve3(outline.map(([x, y]) => new T.Vector3(x, y, 0)), true);
  const shape = rings(profile.length, 56, (row, angle, p) => {
    const [r, z] = profile[row];
    contour.getPoint(angle / (2 * Math.PI), p);
    const rim = 1 + r * r * (0.018 * Math.sin(angle * 19) + 0.012 * Math.cos(angle * 27));
    p.x = centerX + (p.x - centerX) * r * rim;
    p.y *= r * rim;
    const ridge = Math.sin(p.y * 10 + 1.4 * Math.abs(p.x));
    p.z = z + ridges * Math.max(0, ridge) ** 4 + 0.017 * r * Math.sin(angle * 19);
  });
  return plated(shape);
}

export const crabCarapace = paintCrabTile(plate([
  [0, 1.48], [-0.67, 1.44], [-1.37, 1.21], [-1.92, 0.91], [-2.39, 0.47], [-2.53, 0.04],
  [-2.36, -0.33], [-1.83, -0.71], [-0.9, -0.91], [0, -0.98], [0.94, -0.88], [1.86, -0.68],
  [2.35, -0.33], [2.54, 0.04], [2.38, 0.49], [1.89, 0.90], [1.32, 1.23], [0.57, 1.43],
], [[0, 0.38], [0.22, 0.49], [0.42, 0.51], [0.59, 0.47], [0.74, 0.38], [0.87, 0.23], [0.96, 0.05],
  [1, -0.24], [0.97, -0.49], [0.87, -0.75], [0.7, -0.97], [0.49, -1.1], [0.23, -1.17], [0, -1.19]], 0.13),
  0, [-2.7, -1.25, 2.7, 1.85]);

export function crabApron(side: number) {
  const cover = plate([[0.02, 0.76], [-0.39, 0.84], [-0.88, 0.92], [-1.18, 0.95], [-1.29, 0.62],
    [-1.32, 0.1], [-1.29, -0.43], [-1.25, -0.85], [-0.92, -0.72], [-0.43, -0.51], [0.03, -0.04]],
  [[0, 0.12], [0.20, 0.131], [0.37, 0.139], [0.54, 0.132], [0.68, 0.110], [0.84, 0.078], [0.96, 0.048],
    [1, 0.017], [0.98, -0.049], [0.85, -0.119], [0.65, -0.15], [0.40, -0.17], [0, -0.177]], 0.033, -0.64);
  paintCrabTile(cover, 1, [-1.29, -0.94, 0.13, 1.02], [0.5, 0, 1, 1]);
  if (side < 0) {
    const uv = cover.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 0.75 - uv.getX(i));
  }
  return cover;
}

export const crabPalm = paintCrabTile(plate([
  [0.19, 0.68], [-0.29, 0.64], [-0.67, 0.48], [-0.86, 0.15], [-0.83, -0.25], [-0.56, -0.60],
  [-0.22, -0.75], [0.24, -0.73], [0.67, -0.55], [0.81, -0.19], [0.79, 0.24], [0.57, 0.55],
], [[0, 0.46], [0.28, 0.46], [0.51, 0.43], [0.73, 0.35], [0.92, 0.21], [1, 0.02], [0.96, -0.18],
  [0.81, -0.35], [0.51, -0.50], [0.27, -0.53], [0, -0.54]], 0.08), 7, [-0.95, -0.84, 0.90, 1.65]);

type LinkRing = readonly [y: number, width: number, depth: number];
function armor(cell: number, profile: readonly LinkRing[], crop: TileBounds) {
  const mesh = rings(profile.length, 16, (row, angle, p) => {
    const [y, width, depth] = profile[row];
    const rib = 1 + 0.10 * Math.cos(angle * 5);
    p.set(-width * rib * Math.sin(angle), y, depth * rib * Math.cos(angle));
  });
  return paintCrabTile(plated(mesh), cell, [-0.36, -0.54, 0.36, 0.54], crop);
}

export const crabFemur = armor(3, [[-0.54, 0, 0], [-0.49, 0.16, 0.16], [-0.43, 0.22, 0.21],
  [-0.31, 0.24, 0.23], [-0.28, 0.34, 0.27], [-0.19, 0.29, 0.26], [0.03, 0.30, 0.25],
  [0.09, 0.36, 0.30], [0.24, 0.31, 0.26], [0.40, 0.24, 0.22], [0.50, 0.17, 0.17], [0.54, 0, 0]],
  [0.16, 0.20, 0.84, 0.82]);
export const crabTibia = armor(4, [[-0.54, 0, 0], [-0.49, 0.12, 0.12], [-0.35, 0.15, 0.14],
  [-0.13, 0.19, 0.17], [-0.09, 0.26, 0.24], [0.04, 0.23, 0.22], [0.18, 0.27, 0.24],
  [0.27, 0.30, 0.28], [0.40, 0.27, 0.24], [0.51, 0.16, 0.18], [0.54, 0, 0]], [0.19, 0, 0.81, 0.84]);
export const crabArm = armor(6, [[-0.62, 0, 0], [-0.53, 0.24, 0.26], [-0.38, 0.32, 0.29],
  [-0.25, 0.29, 0.30], [-0.20, 0.37, 0.34], [0.0, 0.35, 0.35], [0.25, 0.34, 0.31],
  [0.38, 0.37, 0.35], [0.54, 0.23, 0.24], [0.62, 0, 0]], [0.08, 0.18, 0.92, 0.83]);

export function crabHook(path: readonly (readonly [number, number, number])[], widths: readonly number[], depth: number, bone: boolean) {
  const curve = new T.CatmullRomCurve3(path.map(p => new T.Vector3(...p)));
  const rows = 18, sides = 12;
  const g = new T.TubeGeometry(curve, rows, 1, sides, false), position = g.attributes.position;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows, center = curve.getPointAt(t), u = t * (widths.length - 1);
    const i = Math.min(widths.length - 2, Math.floor(u)), w = T.MathUtils.lerp(widths[i], widths[i + 1], u - i);
    for (let col = 0; col <= sides; col++) {
      const j = row * (sides + 1) + col;
      position.setXYZ(j, center.x + (position.getX(j) - center.x) * w,
        center.y + (position.getY(j) - center.y) * w, center.z + (position.getZ(j) - center.z) * w * depth);
    }
  }
  g.computeVertexNormals();
  if (!bone) return plated(g);
  const ivory = new T.Color(0xac9a7e);
  return colorCrab(g, (x, y, z, out) => out.copy(ivory).multiplyScalar(0.87 + 0.13 * Math.sin(y * 24 + x * 13 + z * 11)));
}

export const crabToe = paintCrabTile(crabHook([[0, 0.58, 0], [-0.04, 0.36, 0.06], [-0.085, 0.01, 0.07],
  [-0.053, -0.30, 0.038], [0, -0.50, 0]], [0.135, 0.162, 0.123, 0.061, 0], 0.92, true),
  5, [-0.24, -0.53, 0.24, 0.57], [0.12, 0, 0.83, 0.87]);

export function crabCup(profile: Profile, width: number, height: number, textureCell: number) {
  const geometry = rings(profile.length, 48, (row, angle, p) => {
    const [r, depth] = profile[row];
    const rib = 1 + 0.04 * Math.sin(angle * 9) + 0.028 * Math.cos(angle * 13);
    p.set(r * rib * width * Math.cos(angle), -r * rib * height * Math.sin(angle), depth + 0.03 * r * Math.cos(angle * 9));
  });
  const lip = new T.Color(0x81584e), lining = new T.Color(0x16272a);
  colorCrab(geometry, (x, y, z, out) => {
    const r = Math.hypot(x / width, y / height);
    out.copy(lining).lerp(lip, T.MathUtils.smoothstep(r, 0.62, 1.01))
      .multiplyScalar(0.94 + 0.14 * Math.sin(z * 23 + Math.atan2(y, x) * 9));
  });
  return paintCrabTile(geometry, textureCell, [-width * 1.15, -height * 1.15, width * 1.15, height * 1.15]);
}

const barnacle = rings(11, 13, (row, angle, p) => {
  const [r, z] = [[0, -0.19], [0.64, -0.15], [1, -0.04], [0.86, 0.25], [0.69, 0.64], [0.60, 0.83],
    [0.52, 0.88], [0.36, 0.81], [0.34, 0.65], [0.25, 0.27], [0, 0.23]][row];
  const ridge = 1 + 0.12 * Math.cos(angle * 6) + 0.06 * Math.sin(angle * 3);
  p.set(r * ridge * Math.cos(angle), -0.93 * r * ridge * Math.sin(angle), z + r * Math.sin(angle * 7) * 0.095);
});
const chalk = new T.Color(0xb9ae94), wet = new T.Color(0x4b463b);
colorCrab(barnacle, (x, y, z, out) => out.copy(wet).lerp(chalk, T.MathUtils.smoothstep(Math.hypot(x, y), 0.31, 0.67))
  .multiplyScalar(0.86 + 0.22 * Math.cos(Math.atan2(y, x) * 6 + z * 3)));

type Growth = readonly [x: number, y: number, size: number, back?: boolean];
export function crabBarnacles(shell: T.BufferGeometry, sites: readonly Growth[]) {
  const target = new T.Mesh(shell), ray = new T.Raycaster();
  const front = new T.Vector3(0, 0, 1), origin = new T.Vector3(), normal = new T.Vector3();
  const parts: T.BufferGeometry[] = [];
  for (const [x, y, size, back] of sites) for (let i = 0; i < 4; i++) {
    const phase = i * 2.4 + x * 9 + y;
    const reach = i ? size * (0.62 + 0.13 * i) : 0, side = back ? -1 : 1;
    ray.set(origin.set(x + reach * Math.cos(phase), y + reach * Math.sin(phase), side * 3), normal.set(0, 0, -side));
    const hit = ray.intersectObject(target, false)[0];
    if (!hit?.normal) continue;
    const scale = size * (i ? 0.43 + 0.10 * (i % 3) : 1);
    const surface = hit.normal.normalize(), orientation = new T.Quaternion().setFromUnitVectors(front, surface);
    const at = hit.point.addScaledVector(surface, -0.05 * scale);
    parts.push(barnacle.clone().scale(scale, scale * (0.83 + i * 0.045), scale * (1 + 0.14 * i))
      .rotateZ(phase).applyQuaternion(orientation).translate(at.x, at.y, at.z));
  }
  const merged = mergeGeometries(parts);
  for (const geometry of parts) geometry.dispose();
  return merged;
}
