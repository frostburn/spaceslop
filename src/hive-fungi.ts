import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HEIGHT, WIDTH } from './game';
import { fungusCap, fungusGills, fungusStem, mycelium } from './hive-materials';
import { part, pivot } from './rig-geometry';

const cap = new T.LatheGeometry([
  [0, 0.34], [0.2, 0.36], [0.49, 0.31], [0.76, 0.18], [0.94, 0.02],
  [1, -0.035], [0.97, -0.09], [0.73, -0.15], [0.37, -0.21], [0, -0.22],
].reverse().map(([r, h]) => new T.Vector2(r, h)), 32).rotateX(Math.PI / 2);
const rim = new T.TorusGeometry(0.974, 0.026, 6, 40);
const bulb = new T.SphereGeometry(1, 16, 10);
const contact = new T.MeshBasicMaterial({ color: 0x100c12, transparent: true, opacity: 0.32, depthWrite: false });
const shadow = new T.CircleGeometry(1, 24);

function makeGills() {
  const points: number[] = [];
  for (let i = 0; i < 44; i++) {
    const angle = i * Math.PI * 2 / 44;
    const inner = i % 2 ? 0.35 : 0.15;
    const at = (r: number, delta: number, z: number) => [Math.cos(angle + delta) * r, Math.sin(angle + delta) * r, z];
    const a = at(inner, 0, -0.235);
    const b = at(0.90, -0.012, -0.12);
    const c = at(0.90, 0, -0.14);
    const d = at(0.90, 0.012, -0.12);
    points.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
  geometry.computeVertexNormals();
  return geometry;
}
const gills = makeGills();
const roots = mergeGeometries(Array.from({ length: 7 }, (_, i) => {
  const angle = i * Math.PI * 2 / 7 + Math.sin(i * 3.1) * 0.22;
  const reach = 0.31 + Math.sin(i * 4.7) * 0.08;
  return new T.TubeGeometry(new T.CatmullRomCurve3([
    new T.Vector3(0, 0, 0.025),
    new T.Vector3(Math.cos(angle + 0.2) * 0.2, Math.sin(angle + 0.2) * 0.2, 0.018),
    new T.Vector3(Math.cos(angle) * reach, Math.sin(angle) * reach, 0.005),
  ]), 6, 0.012, 5, false);
}));

const stems = [2.55, 3.05, 2.1].map((height, i) => {
  const end = new T.Vector3(0.22 + i * 0.07, 1.08 + i * 0.15, height);
  const curve = new T.CubicBezierCurve3(new T.Vector3(),
    new T.Vector3(-0.08, end.y * 0.24, height * 0.36),
    new T.Vector3(end.x * 0.8, end.y * 0.8, height * 0.84), end);
  return { end, geometry: new T.TubeGeometry(curve, 16, 0.095, 10, false) };
});

export function createMushroomCluster(seed = 0) {
  const root = new T.Group();
  const stain = part(root, shadow, contact, 0.03, -0.02, -0.026);
  stain.scale.set(0.48, 0.35, 1);
  part(root, roots, mycelium, 0, 0, 0);
  part(root, bulb, fungusStem, 0, 0, 0.05).scale.set(0.21, 0.17, 0.09);
  for (let i = 0; i < 3; i++) {
    const body = pivot(root, 'fruiting-body', i === 0 ? 0 : 0.15, (i - 1) * 0.16, 0);
    body.rotation.z = i === 0 ? Math.sin(seed * 1.7) * 0.18 : (i === 1 ? 1.7 : -1.8);
    body.scale.setScalar(i === 0 ? 1 : i === 1 ? 0.47 : 0.57);
    const stem = stems[(i + seed) % stems.length];
    part(body, stem.geometry, fungusStem, 0, 0, 0);
    const collar = part(body, bulb, fungusStem, 0, 0, 0.12);
    collar.scale.set(0.15, 0.13, 0.25);
    const crown = pivot(body, 'cap', stem.end.x, stem.end.y, stem.end.z);
    crown.rotation.set(0.24, 0.45 + i * 0.1, 0.13);
    crown.scale.set(0.76, 0.66, 0.85);
    part(crown, cap, fungusCap, 0, 0, 0);
    part(crown, gills, fungusGills, 0, 0, 0);
    part(crown, rim, fungusStem, 0, 0, -0.05);
  }
  return root;
}

// Coordinates refer to opaque pipe/rock patches in the reviewed strip, with V measured from its bottom.
export const hiveFungusAnchors = [
  [0.17, 0.10], [0.83, 0.17], [0.16, 0.25], [0.84, 0.31],
  [0.17, 0.40], [0.84, 0.46], [0.16, 0.53], [0.83, 0.60],
  [0.17, 0.69], [0.84, 0.76], [0.16, 0.84], [0.83, 0.91],
] as const;
export const HIVE_ROOT_DEPTH = -2.6;

export function createHiveFungi() {
  const root = new T.Group();
  root.name = 'hive-fruiting-bodies';
  const plants = hiveFungusAnchors.map(([u, v], i) => {
    const plant = createMushroomCluster(i);
    plant.name = `hive-fruit-${i}`;
    plant.rotation.z = u < 0.5 ? Math.PI : 0;
    root.add(plant);
    return { plant, u, v };
  });
  return {
    root,
    update(progress: number, screens: number, distance: number | undefined, hasForeground: boolean) {
      // Project the root onto exactly the same screen coordinate as its source pixel.
      // Only the stem and cap depart from this plane and gain foreground parallax.
      const scale = distance === undefined ? 1 : 1 - HIVE_ROOT_DEPTH / distance;
      for (const { plant, u, v } of plants) {
        const x = hasForeground ? (u - 0.5) * WIDTH : Math.sign(u - 0.5) * 3.43;
        const y = (v * screens - (screens - 1) * progress - 0.5) * HEIGHT;
        plant.position.set(x * scale, y * scale, HIVE_ROOT_DEPTH);
        plant.scale.setScalar(scale);
        plant.visible = Math.abs(y) < HEIGHT * 0.72;
      }
    },
  };
}
