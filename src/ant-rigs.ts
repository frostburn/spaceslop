import * as T from 'three';
import { BOSS_MUZZLE_Z } from './encounters';
import { part, pivot, plating } from './rig-geometry';

const shell = new T.MeshStandardMaterial({ color: 0x783748, roughness: 0.55 });
const joint = new T.MeshStandardMaterial({ color: 0x2c2438, roughness: 0.72 });
const fungus = new T.MeshStandardMaterial({ color: 0xd8bba4, roughness: 0.85 });
const amber = new T.MeshBasicMaterial({ color: 0xffb05b });
const oval = new T.SphereGeometry(1, 12, 8);
const limb = new T.CylinderGeometry(1, 0.8, 1, 6);
const up = new T.Vector3(0, 1, 0);
const mandible = plating([[0.05, 0.53], [0.19, 0.58], [0.2, 0.76], [0.06, 0.88], [0.115, 0.72]], 0.045, 0.008);

function link(parent: T.Group, from: T.Vector3, to: T.Vector3, width: number) {
  const mesh = part(parent, limb, joint, 0, 0, 0);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  const direction = to.clone().sub(from);
  mesh.quaternion.setFromUnitVectors(up, direction.clone().normalize());
  mesh.scale.set(width, direction.length(), width);
}

export function createAntRig() {
  const root = new T.Group();
  part(root, oval, shell, 0, -0.52, 0.11).scale.set(0.33, 0.43, 0.24);
  part(root, oval, joint, 0, -0.19, 0.08).scale.set(0.12, 0.16, 0.11);
  part(root, oval, shell, 0, 0.04, 0.12).scale.set(0.23, 0.28, 0.19);
  part(root, oval, shell, 0, 0.42, 0.13).scale.set(0.27, 0.24, 0.17);
  const sac = part(root, oval, amber, 0, -0.51, 0.32);
  sac.scale.set(0.17, 0.24, 0.06);
  const legs: { side: number; index: number; root: T.Group }[] = [];

  for (const side of [-1, 1]) {
    part(root, oval, amber, side * 0.17, 0.49, 0.249).scale.set(0.045, 0.068, 0.028);
    const jaw = part(root, mandible, joint, 0, 0, 0.13);
    jaw.scale.x = side;
    link(root, new T.Vector3(side * 0.16, 0.55, 0.15), new T.Vector3(side * 0.41, 0.76, 0.19), 0.022);
    link(root, new T.Vector3(side * 0.41, 0.76, 0.19), new T.Vector3(side * 0.32, 1.02, 0.16), 0.017);
    for (let i = 0; i < 3; i++) {
      const leg = pivot(root, 'leg', side * 0.17, 0.23 - i * 0.23, 0.09);
      const knee = new T.Vector3(side * (0.42 + i * 0.025), 0.15 - i * 0.11, 0.03);
      const foot = new T.Vector3(side * (0.62 + i * 0.02), -0.18 - i * 0.075, -0.035);
      link(leg, new T.Vector3(), knee, 0.042);
      link(leg, knee, foot, 0.026);
      legs.push({ side, index: i, root: leg });
    }
    for (let i = 0; i < 3; i++) {
      part(root, oval, fungus, side * (0.085 + i * 0.045), -0.33 - i * 0.12, 0.29)
        .scale.set(0.054, 0.076, 0.07);
    }
  }
  return {
    root,
    pose(time: number, windup = 0) {
      for (const leg of legs) leg.root.rotation.z =
        leg.side * 0.22 * Math.sin(time * 9 + leg.index * 2.1 + (leg.side < 0 ? Math.PI : 0));
      sac.scale.set(0.17 + windup * 0.055, 0.24 + windup * 0.06, 0.06 + windup * 0.07);
    },
  };
}

export function createHiveGuardian(cannonX: number) {
  const root = new T.Group();
  const ant = createAntRig();
  ant.root.scale.setScalar(3.15);
  ant.root.rotation.z = Math.PI;
  ant.root.position.y = 2.25;
  root.add(ant.root);
  const jaws = [-1, 1].map((side) => {
    const pod = pivot(root, side < 0 ? 'muzzle_L' : 'muzzle_R', side * cannonX, 0, 0);
    const jaw = part(pod, plating([[-2.05, 0.87], [-1.36, 0.83], [-0.12, 0.57], [0.4, 0.06],
      [0.27, -0.36], [-0.14, -0.4], [-0.37, -0.05], [-1.28, 0.19], [-2.05, 0.36]], 0.21),
      shell, 0, 0, 0.72);
    jaw.scale.x = side;
    part(pod, oval, fungus, 0, 0, BOSS_MUZZLE_Z - 0.13).scale.set(0.31, 0.29, 0.2);
    const glow = part(pod, oval, amber, 0, 0, BOSS_MUZZLE_Z);
    glow.scale.setScalar(0.2);
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
        glow.scale.setScalar(0.2 + charge * 0.09 + kick * 0.06);
      }
    },
  };
}
