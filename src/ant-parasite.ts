import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { antGaster } from './ant-shell';
import { fungusCap, fungusStem, mycelium } from './hive-materials';
import { part } from './rig-geometry';

const sphere = new T.SphereGeometry(1, 12, 8);
const stems: T.BufferGeometry[] = [];
const clubs: T.BufferGeometry[] = [];
for (let i = 0; i < 4; i++) {
  const angle = i * 2.4;
  const height = 0.35 + (i % 3) * 0.12;
  const end = new T.Vector3(Math.cos(angle) * 0.16, Math.sin(angle) * 0.12, height);
  const bend = new T.Vector3(end.x * 0.2 - 0.045, end.y * 0.4, height * 0.53);
  const curve = new T.CatmullRomCurve3([new T.Vector3(), bend, end]);
  stems.push(new T.TubeGeometry(curve, 9, 0.022 - i * 0.002, 6, false));
  const tip = sphere.clone().scale(0.066, 0.057, 0.12 + i * 0.013);
  tip.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), curve.getTangent(1)));
  tip.translate(end.x, end.y, end.z);
  clubs.push(tip);
  if (i % 2 === 0) {
    const fork = new T.Vector3(end.x - 0.12, end.y + 0.08, height * 0.84);
    stems.push(new T.TubeGeometry(new T.CatmullRomCurve3([curve.getPoint(0.48),
      new T.Vector3(fork.x, fork.y, height * 0.57), fork]), 6, 0.013, 5, false));
    clubs.push(sphere.clone().scale(0.046, 0.041, 0.083).translate(fork.x, fork.y, fork.z));
  }
}
const stalks = mergeGeometries(stems);
const tips = mergeGeometries(clubs);
const headCurve = new T.CatmullRomCurve3([
  new T.Vector3(0, 0, -0.024), new T.Vector3(0.012, -0.03, 0.14), new T.Vector3(-0.082, 0.012, 0.32),
  new T.Vector3(-0.174, 0.144, 0.55), new T.Vector3(-0.16, 0.23, 0.63),
]);
const headStalk = new T.TubeGeometry(headCurve, 18, 0.034, 8, false);
const headClub = sphere.clone().scale(0.074, 0.071, 0.135);
headClub.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), headCurve.getTangent(1)));
const headEnd = headCurve.getPoint(1);
headClub.translate(headEnd.x, headEnd.y, headEnd.z);

const holdfast = mergeGeometries([
  sphere.clone().scale(0.103, 0.084, 0.06).translate(0, 0, -0.022),
  sphere.clone().scale(0.057, 0.069, 0.043).translate(0.067, 0.025, -0.026),
  sphere.clone().scale(0.060, 0.045, 0.033).translate(-0.067, -0.036, -0.028),
]);

const web: T.BufferGeometry[] = [];
for (const side of [-1, 1]) for (let branch = 0; branch < 4; branch++) {
  const y = -0.235 + branch * 0.147;
  const startY = side < 0 ? -0.30 : -0.25;
  const points = Array.from({ length: 11 }, (_, i) => {
    const t = i / 10;
    const angle = side * (0.98 - 0.54 * Math.sin(t * 1.65) + t * (branch % 2) * 0.26);
    return antGaster.point(T.MathUtils.lerp(startY, y, t), angle, 0.0035);
  });
  web.push(new T.TubeGeometry(new T.CatmullRomCurve3(points), 16, 0.0048 + (branch % 2) * 0.0015, 5, false));
}
const parasiteWeb = mergeGeometries(web);

export function createParasiteColony() {
  const root = new T.Group();
  root.name = 'parasite-colony';
  part(root, holdfast, mycelium, 0, 0, 0);
  part(root, stalks, fungusStem, 0, 0, 0);
  part(root, tips, fungusCap, 0, 0, 0);
  return root;
}

export function addParasiteWeb(parent: T.Group) {
  part(parent, parasiteWeb, mycelium, 0, 0, 0);
}

export function createHeadStem() {
  const root = new T.Group();
  root.name = 'head-fruiting-stem';
  part(root, holdfast, mycelium, 0, 0, 0);
  part(root, headStalk, fungusStem, 0, 0, 0);
  part(root, headClub, fungusCap, 0, 0, 0);
  return root;
}
