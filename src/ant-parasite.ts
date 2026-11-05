import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fungusCap, fungusStem } from './hive-materials';
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

const crustParts: T.BufferGeometry[] = [];
for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
  const x = side * (0.24 + Math.sin(i * 1.8) * 0.045), y = -0.28 + i * 0.14;
  crustParts.push(sphere.clone().scale(0.07, 0.095, 0.045).translate(x, y, 0.18));
  crustParts.push(new T.TubeGeometry(new T.CatmullRomCurve3([
    new T.Vector3(side * 0.05, -0.34, 0.26), new T.Vector3(side * 0.1, y - 0.04, 0.26),
    new T.Vector3(x, y, 0.19),
  ]), 6, 0.013, 5, false));
}
const crust = mergeGeometries(crustParts);

export function createParasiteColony() {
  const root = new T.Group();
  root.name = 'parasite-colony';
  part(root, stalks, fungusStem, 0, 0, 0);
  part(root, tips, fungusCap, 0, 0, 0);
  return root;
}

export function addParasiteCrust(parent: T.Group) {
  part(parent, crust, fungusStem, 0, 0, 0);
}
