import * as T from 'three';
import { antEye, antJoint, antPlate, antShell, sporeGlow } from './hive-materials';
import { part, pivot } from './rig-geometry';
import { addParasiteWeb, createHeadStem, createParasiteColony } from './ant-parasite';
import { antMold, gasterMold, headMold, thoraxMold } from './ant-mold';
import { antGaster, antHead, antThorax } from './ant-shell';
import { createGuardianPods } from './guardian-pods';

export type AntKind = 'worker' | 'soldier';
const oval = new T.SphereGeometry(1, 16, 12);
const poreRim = new T.TorusGeometry(1, 0.22, 6, 18);
const up = new T.Vector3(0, 1, 0), forward = new T.Vector3(0, 0, 1);
const origin = new T.Vector3();
const femur = new T.LatheGeometry([
  [0.65, -0.5], [0.79, -0.40], [1, -0.21], [0.98, 0.02], [0.76, 0.30], [0.50, 0.5],
].map(([r, y]) => new T.Vector2(r, y)), 10);
const tibia = new T.LatheGeometry([
  [0.83, -0.5], [0.89, -0.38], [0.78, -0.14], [0.62, 0.2], [0.41, 0.5],
].map(([r, y]) => new T.Vector2(r, y)), 8);
const claw = new T.CylinderGeometry(0.12, 0.94, 1, 7);
const jawOutline = new T.Shape();
jawOutline.moveTo(0, 0);
jawOutline.quadraticCurveTo(0.235, 0.02, 0.256, 0.28);
jawOutline.quadraticCurveTo(0.279, 0.52, 0.03, 0.61);
for (const [x, y] of [[0.08, 0.445], [0.163, 0.38], [0.101, 0.321], [0.166, 0.29],
  [0.087, 0.233], [0.133, 0.207], [0.053, 0.15], [0, 0]]) jawOutline.lineTo(x, y);
const mandible = new T.ExtrudeGeometry(jawOutline, {
  depth: 0.045, bevelEnabled: true, bevelSize: 0.013, bevelThickness: 0.019, bevelSegments: 2, curveSegments: 12,
});
const flagellum = new T.TubeGeometry(new T.CatmullRomCurve3([
  origin, new T.Vector3(0.12, 0.032, 0.03), new T.Vector3(0.172, 0.152, 0.053),
  new T.Vector3(0.135, 0.272, 0.033), new T.Vector3(0.091, 0.305, 0.019),
]), 12, 0.012, 6, false);

function link(parent: T.Group, geometry: T.BufferGeometry, material: T.Material, from: T.Vector3, to: T.Vector3, width: number) {
  const mesh = part(parent, geometry, material, 0, 0, 0);
  mesh.position.copy(from).lerp(to, 0.5);
  const direction = to.clone().sub(from), length = direction.length();
  mesh.quaternion.setFromUnitVectors(up, direction.divideScalar(length));
  mesh.scale.set(width, length, width * 0.87);
}

function surfaceMount(parent: T.Group, name: string, shell: typeof antGaster, y: number, angle: number) {
  const p = shell.point(y, angle);
  const mount = pivot(parent, name, p.x, p.y, p.z);
  mount.quaternion.setFromUnitVectors(forward, shell.outward(y, angle));
  return mount;
}

function installGrowth(parent: T.Group, shell: typeof antGaster, y: number, angle: number, scale: number) {
  const mount = surfaceMount(parent, 'fungal-root', shell, y, angle);
  const colony = createParasiteColony();
  colony.scale.setScalar(scale);
  mount.add(colony);
}

export function createAntRig(kind: AntKind = 'worker') {
  const root = new T.Group();
  const abdomen = pivot(root, 'gaster', 0, -0.56, 0.19);
  part(abdomen, antGaster.geometry, antPlate, 0, 0, 0).name = 'gaster-shell';
  part(abdomen, gasterMold, antMold, 0, 0, 0).name = 'gaster-mold';
  addParasiteWeb(abdomen);
  installGrowth(abdomen, antGaster, -0.30, -0.96, 0.74);
  installGrowth(abdomen, antGaster, -0.25, 0.96, 0.58);

  part(root, oval, antJoint, 0, -0.181, 0.181).scale.set(0.08, 0.128, 0.08);
  part(root, oval, antShell, 0, -0.193, 0.194).scale.set(0.101, 0.065, 0.093);
  part(root, antThorax.geometry, antPlate, 0, 0, 0).name = 'thorax-shell';
  part(root, thoraxMold, antMold, 0, 0, 0).name = 'thorax-mold';
  installGrowth(root, antThorax, 0.08, 0.82, 0.37);

  const head = pivot(root, 'head', 0, 0.49, 0.2);
  part(head, antHead.geometry, antPlate, 0, 0, 0).name = 'head-shell';
  part(head, headMold, antMold, 0, 0, 0).name = 'head-mold';
  const headStem = surfaceMount(head, 'fungal-root', antHead, -0.057, -0.13);
  headStem.add(createHeadStem());
  installGrowth(head, antHead, -0.135, -0.68, 0.28);

  const legs: { side: number; index: number; hip: T.Group; knee: T.Group; ankle: T.Group }[] = [];
  const feelers: { side: number; root: T.Group; elbow: T.Group }[] = [];
  const jaws: { side: number; root: T.Group }[] = [];
  const vents: T.Mesh[] = [];
  for (const side of [-1, 1]) {
    const socket = surfaceMount(head, 'eye-socket', antHead, 0.031, side * 1.13);
    part(socket, oval, antJoint, 0, 0, -0.018).scale.set(0.088, 0.111, 0.048);
    const eye = part(socket, oval, antEye, 0, 0, 0.004);
    eye.name = 'clouded-eye';
    eye.scale.set(0.068, 0.091, 0.039);

    const jaw = pivot(head, 'mandible', side * 0.114, 0.206, 0.039);
    part(jaw, oval, antShell, 0, 0, 0.012).scale.set(0.062, 0.058, 0.056);
    part(jaw, mandible, antJoint, 0, 0.014, 0).scale.x = side;
    jaws.push({ side, root: jaw });

    const feeler = pivot(head, 'antenna', side * 0.141, 0.16, 0.145);
    const joint = new T.Vector3(side * 0.137, 0.163, 0.035);
    part(feeler, oval, antShell, 0, 0, 0).scale.setScalar(0.032);
    link(feeler, tibia, antJoint, origin, joint, 0.028);
    const elbow = pivot(feeler, 'antennal-elbow', joint.x, joint.y, joint.z);
    part(elbow, oval, antJoint, 0, 0, 0).scale.setScalar(0.02);
    part(elbow, flagellum, antShell, 0, 0, 0).scale.x = side;
    feelers.push({ side, root: feeler, elbow });

    for (let i = 0; i < 3; i++) {
      const attachment = antThorax.point(0.234 - i * 0.161, side * 1.83, -0.025);
      const hip = pivot(root, 'leg', attachment.x, attachment.y, attachment.z);
      part(hip, oval, antJoint, 0, 0, 0).scale.set(0.083, 0.058, 0.059);
      const distalFemur = new T.Vector3(side * (0.351 + i * 0.033), 0.104 - i * 0.11, 0.034);
      link(hip, femur, antShell, origin, distalFemur, 0.057 - i * 0.003);
      const knee = pivot(hip, 'knee', distalFemur.x, distalFemur.y, distalFemur.z);
      part(knee, oval, antJoint, 0, 0, 0).scale.set(0.041, 0.046, 0.043);
      const distalTibia = new T.Vector3(side * 0.23, -0.208 - i * 0.056, -0.094);
      link(knee, tibia, antShell, origin, distalTibia, 0.045 - i * 0.003);
      const ankle = pivot(knee, 'tarsus', distalTibia.x, distalTibia.y, distalTibia.z);
      const toe = new T.Vector3(side * 0.071, -0.078, -0.034);
      link(ankle, tibia, antJoint, origin, toe, 0.021);
      link(ankle, claw, antJoint, toe, new T.Vector3(side * 0.101, -0.104, -0.016), 0.012);
      legs.push({ side, index: i, hip, knee, ankle });

      const vent = surfaceMount(abdomen, 'spore-pore', antGaster, -0.226 + i * 0.173, side * 0.66);
      part(vent, poreRim, antJoint, 0, 0, -0.002).scale.set(0.036, 0.052, 0.041);
      const membrane = part(vent, oval, sporeGlow, 0, 0, -0.003);
      membrane.scale.set(0.025, 0.036, 0.017);
      vents.push(membrane);
    }
  }

  function setKind(value: AntKind) {
    const soldier = value === 'soldier';
    head.scale.set(soldier ? 1.36 : 1, soldier ? 1.13 : 1, soldier ? 1.14 : 1);
    for (const jaw of jaws) jaw.root.scale.set(soldier ? 0.95 : 0.66, soldier ? 0.94 : 0.6, soldier ? 1 : 0.70);
  }
  setKind(kind);
  return {
    root, setKind,
    pose(time: number, windup = 0) {
      for (const { side, index, hip, knee, ankle } of legs) {
        const phase = time * 9 + (index % 2) * Math.PI + (side < 0 ? Math.PI : 0);
        const lift = Math.max(0, Math.cos(phase)) * (1 - 0.64 * windup);
        hip.rotation.set(0, -side * (0.26 * lift - 0.061 * windup), side * (0.22 * Math.sin(phase) - 0.067 * windup));
        knee.rotation.set(0, side * (0.025 + 0.18 * lift), side * (0.10 + 0.19 * lift));
        ankle.rotation.set(0, -side * 0.21 * lift, side * 0.36 * lift);
      }
      for (const { root: feeler, elbow, side } of feelers) {
        const f = time * 3 + side * 0.61;
        feeler.rotation.set(0.081 * Math.sin(f), 0, side * (0.049 + 0.14 * Math.sin(f * 0.79) - 0.123 * windup));
        elbow.rotation.z = side * (0.24 * Math.sin(f - 0.9) + 0.14 * windup);
      }
      for (const { root: jaw, side } of jaws) jaw.rotation.z = side * (0.08 - windup * 0.28 + Math.sin(time * 4) * 0.031);
      abdomen.scale.set(1 + windup * 0.05, 1 + windup * 0.021, 1 + windup * 0.085);
      for (const vent of vents) vent.scale.set(0.025 + 0.013 * windup, 0.036 + 0.019 * windup, 0.017 + 0.023 * windup);
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
  const posePods = createGuardianPods(root, cannonX);
  return {
    root,
    pose(reveal: number, windup: number, activeX: number, firedX: number, recoil: number, time: number) {
      ant.pose(time * 0.46 + reveal * 0.62, windup);
      posePods(windup, activeX, firedX, recoil);
    },
  };
}
