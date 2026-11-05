import * as T from 'three';
import { BOSS_MUZZLE_Z } from './encounters';
import { antEye, antJoint, antSeam, antShell, fungusStem, sporeGlow } from './hive-materials';
import { part, pivot } from './rig-geometry';
import { addParasiteCrust, createParasiteColony } from './ant-parasite';

export type AntKind = 'worker' | 'soldier';
const oval = new T.SphereGeometry(1, 20, 14);
const limb = new T.CylinderGeometry(0.72, 1, 1, 10);
const up = new T.Vector3(0, 1, 0);
const suture = new T.TorusGeometry(0.3, 0.012, 5, 24).rotateX(Math.PI / 2);
const gaster = new T.LatheGeometry([
  [0, -0.47], [0.15, -0.43], [0.28, -0.3], [0.34, -0.08],
  [0.32, 0.13], [0.21, 0.31], [0.09, 0.37], [0, 0.38],
].map(([r, y]) => new T.Vector2(r, y)), 24);
const jawOutline = new T.Shape();
jawOutline.moveTo(0, 0);
jawOutline.quadraticCurveTo(0.28, 0.11, 0.23, 0.36);
jawOutline.quadraticCurveTo(0.2, 0.56, 0.01, 0.61);
for (const [x, y] of [[0.07, 0.43], [0.13, 0.36], [0.075, 0.33], [0.135, 0.25],
  [0.065, 0.22], [0.08, 0.12], [0, 0]]) jawOutline.lineTo(x, y);
const mandible = new T.ExtrudeGeometry(jawOutline, {
  depth: 0.055, bevelEnabled: true, bevelSize: 0.018, bevelThickness: 0.018, bevelSegments: 3, curveSegments: 10,
});
const antenna = new T.TubeGeometry(new T.CatmullRomCurve3([
  new T.Vector3(), new T.Vector3(0.14, 0.15, 0.025),
  new T.Vector3(0.29, 0.2, 0.08), new T.Vector3(0.22, 0.52, 0.04),
]), 10, 0.018, 6, false);
const guardianArm = new T.TubeGeometry(new T.CatmullRomCurve3([
  new T.Vector3(-1.9, 0.85, 0.34), new T.Vector3(-1.25, 0.7, 0.5),
  new T.Vector3(-0.48, 0.34, 0.65), new T.Vector3(0, 0, BOSS_MUZZLE_Z - 0.1),
]), 16, 0.2, 12, false);

function link(parent: T.Group, from: T.Vector3, to: T.Vector3, width: number) {
  const mesh = part(parent, limb, antJoint, 0, 0, 0);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  const direction = to.clone().sub(from);
  mesh.quaternion.setFromUnitVectors(up, direction.clone().normalize());
  mesh.scale.set(width, direction.length(), width);
}

export function createAntRig(kind: AntKind = 'worker') {
  const root = new T.Group();
  const abdomen = pivot(root, 'gaster', 0, -0.56, 0.19);
  part(abdomen, gaster, antShell, 0, 0, 0).scale.z = 0.78;
  addParasiteCrust(abdomen);
  for (const y of [-0.23, 0.02, 0.21]) {
    const band = part(abdomen, suture, antSeam, 0, y, 0);
    band.scale.set(y > 0.1 ? 0.84 : 1, 1, y > 0.1 ? 0.65 : 0.77);
  }
  part(root, oval, antJoint, 0, -0.16, 0.17).scale.set(0.095, 0.15, 0.1);
  part(root, oval, antShell, 0, -0.12, 0.2).scale.set(0.12, 0.09, 0.12);
  part(root, oval, antShell, 0, 0.08, 0.19).scale.set(0.23, 0.27, 0.19);
  part(root, oval, antShell, 0, 0.22, 0.19).scale.set(0.25, 0.14, 0.2);
  const head = pivot(root, 'head', 0, 0.49, 0.2);
  part(head, oval, antShell, 0, 0, 0).scale.set(0.29, 0.27, 0.2);
  part(head, oval, antShell, 0, 0.15, 0.035).scale.set(0.23, 0.15, 0.17);
  part(head, oval, antJoint, 0, 0.255, 0.035).scale.set(0.12, 0.055, 0.08);

  const legs: { side: number; index: number; root: T.Group; knee: T.Group }[] = [];
  const feelers: { side: number; root: T.Group }[] = [];
  const jaws: { side: number; root: T.Group }[] = [];
  const vents: T.Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = part(head, oval, antEye, side * 0.252, 0.035, 0.11);
    eye.scale.set(0.065, 0.105, 0.075);
    const jaw = pivot(head, 'mandible', side * 0.09, 0.22, 0.015);
    part(jaw, mandible, antJoint, 0, 0, 0).scale.x = side;
    jaws.push({ side, root: jaw });
    const feeler = pivot(head, 'antenna', side * 0.16, 0.17, 0.17);
    part(feeler, antenna, antJoint, 0, 0, 0).scale.x = side;
    part(feeler, oval, antShell, side * 0.22, 0.52, 0.04).scale.set(0.029, 0.066, 0.026);
    feelers.push({ side, root: feeler });

    for (let i = 0; i < 3; i++) {
      const leg = pivot(root, 'leg', side * 0.18, 0.23 - i * 0.19, 0.14);
      const kneeAt = new T.Vector3(side * (0.34 + i * 0.025), 0.1 - i * 0.095, 0.035);
      link(leg, new T.Vector3(), kneeAt, 0.051);
      part(leg, oval, antShell, kneeAt.x, kneeAt.y, kneeAt.z).scale.setScalar(0.058);
      const knee = pivot(leg, 'knee', kneeAt.x, kneeAt.y, kneeAt.z);
      const ankle = new T.Vector3(side * 0.27, -0.24 - i * 0.055, -0.095);
      link(knee, new T.Vector3(), ankle, 0.033);
      link(knee, ankle, new T.Vector3(ankle.x + side * 0.09, ankle.y - 0.11, -0.13), 0.018);
      legs.push({ side, index: i, root: leg, knee });

      const vent = part(abdomen, oval, sporeGlow, side * 0.17, -0.2 + i * 0.16, 0.224);
      vent.scale.set(0.039, 0.065, 0.026);
      vents.push(vent);
    }
    const infection = createParasiteColony();
    infection.position.set(side * 0.19, -0.3, 0.22);
    infection.rotation.set(side * 0.15, side * 0.32, side * 0.8);
    infection.scale.setScalar(side < 0 ? 0.9 : 0.72);
    abdomen.add(infection);
  }
  const shoulderGrowth = createParasiteColony();
  shoulderGrowth.position.set(0.14, 0.05, 0.34);
  shoulderGrowth.scale.setScalar(0.5);
  shoulderGrowth.rotation.y = 0.4;
  root.add(shoulderGrowth);
  const headGrowth = createParasiteColony();
  headGrowth.position.set(-0.15, -0.13, 0.15);
  headGrowth.scale.setScalar(0.38);
  headGrowth.rotation.y = -0.45;
  head.add(headGrowth);

  function setKind(value: AntKind) {
    head.scale.set(value === 'soldier' ? 1.36 : 1, value === 'soldier' ? 1.13 : 1, value === 'soldier' ? 1.14 : 1);
    for (const jaw of jaws) jaw.root.scale.setScalar(value === 'soldier' ? 0.9 : 0.66);
  }
  setKind(kind);
  return {
    root, setKind,
    pose(time: number, windup = 0) {
      for (const leg of legs) {
        const cycle = time * 9 + (leg.index % 2) * Math.PI + (leg.side < 0 ? Math.PI : 0);
        leg.root.rotation.z = leg.side * 0.23 * Math.sin(cycle);
        leg.root.position.z = 0.14 + Math.max(0, Math.cos(cycle)) * 0.04;
        leg.knee.rotation.z = leg.side * (0.1 + Math.cos(cycle) * 0.12);
      }
      for (const { root: feeler, side } of feelers) feeler.rotation.z = side * (0.05 + Math.sin(time * 2.3) * 0.09);
      for (const { root: jaw, side } of jaws) jaw.rotation.z = side * (0.07 + windup * 0.22 + Math.sin(time * 4) * 0.025);
      abdomen.scale.set(1 + windup * 0.05, 1 + windup * 0.025, 1 + windup * 0.08);
      for (const vent of vents) vent.scale.set(0.039 + windup * 0.015, 0.065 + windup * 0.015, 0.026 + windup * 0.025);
    },
  };
}

export function createHiveGuardian(cannonX: number) {
  const root = new T.Group();
  const ant = createAntRig('soldier');
  ant.root.scale.setScalar(3.15);
  ant.root.rotation.z = Math.PI;
  ant.root.position.y = 2.25;
  root.add(ant.root);
  const jaws = [-1, 1].map((side) => {
    const pod = pivot(root, side < 0 ? 'muzzle_L' : 'muzzle_R', side * cannonX, 0, 0);
    part(pod, guardianArm, antShell, 0, 0, 0).scale.x = side;
    for (let i = 0; i < 3; i++) {
      part(pod, oval, antShell, side * (-1.35 + i * 0.45), 0.64 - i * 0.2, 0.52 + i * 0.08)
        .scale.set(0.32, 0.24, 0.25);
    }
    part(pod, oval, fungusStem, 0, 0, BOSS_MUZZLE_Z - 0.13).scale.set(0.33, 0.31, 0.21);
    const lip = part(pod, suture, antJoint, 0, 0, BOSS_MUZZLE_Z - 0.02);
    lip.rotation.x = Math.PI / 2;
    const glow = part(pod, oval, sporeGlow, 0, 0, BOSS_MUZZLE_Z);
    glow.scale.setScalar(0.19);
    return { side, pod, glow };
  });
  return {
    root,
    pose(reveal: number, windup: number, activeX: number, firedX: number, recoil: number) {
      ant.pose(reveal * 2 + windup, windup);
      for (const { side, pod, glow } of jaws) {
        const kick = side === Math.sign(firedX) ? recoil : 0;
        const charge = side === Math.sign(activeX) ? windup : 0;
        pod.position.z = -0.29 * kick;
        glow.scale.setScalar(0.19 + charge * 0.1 + kick * 0.06);
      }
    },
  };
}
