import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HEIGHT } from './playfield';
import {
  HIVE_ROOT_DEPTH, hiveFungusAnchors, hiveRoot, mushroomBodies, mushroomCapProfile, mushroomStemRadius, mushroomStems,
} from './hive-layout';
import { fungusCap, fungusGills, fungusStem, mycelium } from './hive-materials';
import { part, pivot } from './rig-geometry';

export { HIVE_ROOT_DEPTH, hiveFungusAnchors } from './hive-layout';
const cap = new T.LatheGeometry([...mushroomCapProfile].reverse().map(([r, h]) => new T.Vector2(r, h)), 32)
  .rotateX(Math.PI / 2);
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

const stems = mushroomStems.map(({ curve }) => {
  const segments = 28, sides = 10;
  const geometry = new T.TubeGeometry(curve, segments, 1, sides, false);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, center = curve.getPoint(t), radius = mushroomStemRadius(t);
    for (let j = 0; j <= sides; j++) {
      const index = i * (sides + 1) + j;
      positions.setXYZ(index, center.x + (positions.getX(index) - center.x) * radius,
        center.y + (positions.getY(index) - center.y) * radius, center.z + (positions.getZ(index) - center.z) * radius);
    }
  }
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute('normal');
  for (let i = 0; i <= segments; i++) {
    const first = i * (sides + 1), last = first + sides;
    const normal = new T.Vector3().fromBufferAttribute(normals, first)
      .add(new T.Vector3().fromBufferAttribute(normals, last)).normalize();
    for (const index of [first, last]) normals.setXYZ(index, normal.x, normal.y, normal.z);
  }
  return geometry;
});

export function createMushroomCluster(seed = 0) {
  const root = new T.Group();
  const stain = part(root, shadow, contact, 0.03, -0.02, -0.026);
  stain.scale.set(0.48, 0.35, 1);
  part(root, roots, mycelium, 0, 0, 0);
  part(root, bulb, fungusStem, 0, 0, 0.05).scale.set(0.21, 0.17, 0.09);
  for (const recipe of mushroomBodies(seed)) {
    const body = pivot(root, 'fruiting-body', recipe.offset.x, recipe.offset.y, recipe.offset.z);
    body.rotation.z = recipe.angle;
    body.scale.setScalar(recipe.scale);
    const stem = mushroomStems[recipe.stem];
    part(body, stems[recipe.stem], fungusStem, 0, 0, 0);
    const collar = part(body, bulb, fungusStem, 0, 0, 0.12);
    collar.scale.set(0.15, 0.13, 0.25);
    const crown = pivot(body, 'cap', stem.end.x, stem.end.y, stem.end.z);
    crown.quaternion.copy(stem.crownRotation);
    crown.scale.set(0.76, 0.66, 0.85);
    part(crown, cap, fungusCap, 0, 0, 0);
    part(crown, gills, fungusGills, 0, 0, 0);
    part(crown, rim, fungusStem, 0, 0, -0.05);
  }
  return root;
}

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
    update(progress: number, distance: number | undefined) {
      // Project the root onto exactly the same screen coordinate as its source pixel.
      // Only the stem and cap depart from this plane and gain foreground parallax.
      const scale = distance === undefined ? 1 : 1 - HIVE_ROOT_DEPTH / distance;
      for (const { plant, u, v } of plants) {
        const { x, y } = hiveRoot(u, v, progress);
        plant.position.set(x * scale, y * scale, HIVE_ROOT_DEPTH);
        plant.scale.setScalar(scale);
        plant.visible = Math.abs(y) < HEIGHT * 0.72;
      }
    },
  };
}
