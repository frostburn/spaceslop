import * as T from 'three';
import { BOSS_MUZZLE_Z, raptorFlight } from './encounters';

function part(
  parent: T.Group, geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number,
) {
  const mesh = new T.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function pivot(parent: T.Group, name: string, x: number, y: number, z: number) {
  const group = new T.Group();
  group.name = name;
  group.position.set(x, y, z);
  parent.add(group);
  return group;
}

function polygon(vertices: [number, number][]) {
  return new T.ShapeGeometry(new T.Shape(vertices.map(([x, y]) => new T.Vector2(x, y))));
}

const flat = (color: number) => new T.MeshBasicMaterial({ color, side: T.DoubleSide });
const armor = (color: number) => new T.MeshStandardMaterial({ color, roughness: 0.56, flatShading: true });

export function createRaptorRig() {
  const root = new T.Group();
  const skin = armor(0x786466);
  const feather = flat(0x9b7657);
  const edge = flat(0x536894);
  const oval = new T.SphereGeometry(1, 8, 6);
  part(root, oval, skin, 0, 0.05, 0.14).scale.set(0.23, 0.53, 0.18);
  for (const side of [-1, 1]) {
    const leg = part(root, polygon([[0.11, -0.09], [0.26, -0.19], [0.31, -0.53],
      [0.21, -0.43], [0.16, -0.55], [0.17, -0.32]]), feather, 0, 0, 0.11);
    leg.scale.x = side;
  }
  const head = pivot(root, 'head', 0, 0.43, 0.16);
  part(head, oval, skin, 0, 0.12, 0.04).scale.set(0.15, 0.26, 0.12);
  part(head, new T.ConeGeometry(0.12, 0.31, 4), skin, 0, 0.32, 0.04);

  const wings = ([-1, 1] as const).map((side) => {
    const shoulder = pivot(root, side < 0 ? 'shoulder_L' : 'shoulder_R', side * 0.16, 0.17, 0.13);
    const fan = pivot(shoulder, side < 0 ? 'fan_L' : 'fan_R', 0, 0, 0);
    fan.scale.x = side;
    part(fan, polygon([[0, 0.04], [0.65, 0.19], [0.79, 0.06], [0.42, -0.24], [0, -0.22]]), feather, 0, 0, 0);
    const outer = pivot(fan, side < 0 ? 'wrist_L' : 'wrist_R', 0.53, 0.1, 0.02);
    for (let i = 0; i < 4; i++) {
      const y = -i * 0.105;
      part(outer, polygon([[0, y + 0.1], [0.72 - i * 0.09, y - 0.14], [0.22, y - 0.12], [0, y - 0.05]]),
        i % 2 ? edge : feather, 0, 0, i * 0.003);
    }
    return { side, shoulder, outer };
  });

  const tail = pivot(root, 'tail', 0, -0.34, 0.12);
  part(tail, polygon([[-0.11, 0], [0.11, 0], [0.07, -0.86], [0, -1.05], [-0.07, -0.86]]), feather, 0, 0, 0);
  const vanes = ([-1, 1] as const).map((side) => {
    const vane = pivot(tail, side < 0 ? 'tail_L' : 'tail_R', 0, -0.35, 0.02);
    part(vane, polygon([[0, 0], [side * 0.12, -0.28], [side * 0.08, -0.68], [0, -0.55]]), edge, 0, 0, 0);
    return { side, vane };
  });

  return {
    root,
    pose(age: number) {
      const { pose, progress } = raptorFlight(age);
      const ease = progress * progress * (3 - 2 * progress);
      let tuck = 0;
      if (pose === 'fold') tuck = ease;
      else if (pose === 'dive') tuck = 1;
      else if (pose === 'flare') tuck = 1 - ease;
      const spread = pose === 'flare' ? Math.sin(progress * Math.PI) : 0;
      for (const { side, shoulder, outer } of wings) {
        shoulder.rotation.z = -side * (0.1 + 1.15 * tuck - 0.26 * spread);
        shoulder.rotation.y = -side * (0.13 * Math.sin(age * 6) * (1 - tuck));
        outer.rotation.z = -0.52 * tuck + 0.16 * spread;
      }
      head.rotation.x = -0.28 * tuck + 0.16 * spread;
      tail.rotation.z = 0.12 * Math.sin(age * 4) * (1 - tuck);
      for (const { side, vane } of vanes) vane.rotation.z = side * (0.08 + 0.52 * spread);
    },
  };
}

export function createInterceptorRig(cannonX: number) {
  const root = new T.Group();
  const steel = armor(0x4b5369);
  const bronze = armor(0x9d6444);
  const harness = armor(0x333d4c);
  const shadow = flat(0x141c2b);
  const crest = flat(0xc78157);
  const eye = flat(0xf7c068);
  part(root, new T.OctahedronGeometry(1), bronze, 0, -0.25, 0).scale.set(1.65, 2.0, 0.8);
  part(root, new T.CircleGeometry(0.99, 6), bronze, 0, 0.65, 0.73).scale.set(1.32, 1.16, 1);
  part(root, new T.CircleGeometry(0.93, 6), shadow, 0, 0.65, 0.75).scale.set(1.28, 1.13, 1);
  part(root, polygon([[-0.68, 0], [0.68, 0], [0, -1.31]]), steel, 0, -0.32, 0.85);

  const cannons = ([-1, 1] as const).map((side) => {
    const wing = pivot(root, side < 0 ? 'wing_L' : 'wing_R', 0, 0, 0);
    wing.scale.x = side;
    part(wing, polygon([[0.95, 0.42], [3.82, 1.04], [3.54, 0.29], [2.22, -0.35], [0.93, -0.27]]),
      steel, 0, 0, 0.14);
    part(wing, polygon([[1.46, 0.26], [3.54, 0.74], [2.5, 0.11], [1.56, -0.14]]),
      bronze, 0, 0, 0.18);
    const pod = pivot(root, side < 0 ? 'cannon_L' : 'cannon_R', side * cannonX, 0, 0);
    part(pod, new T.BoxGeometry(1.01, 0.63, 0.72), harness, 0, 0, 0.14);
    const barrel = part(pod, new T.CylinderGeometry(0.31, 0.36, 0.54, 8), bronze, 0, 0, BOSS_MUZZLE_Z - 0.27);
    barrel.rotation.x = Math.PI / 2;
    const muzzle = pivot(pod, side < 0 ? 'muzzle_L' : 'muzzle_R', 0, 0, BOSS_MUZZLE_Z);
    part(muzzle, new T.CircleGeometry(0.235, 8), shadow, 0, 0, 0.003);
    const glow = part(muzzle, new T.CircleGeometry(0.21, 8),
      new T.MeshBasicMaterial({ color: 0xff9251, transparent: true, depthWrite: false }), 0, 0, 0.008);
    return { side, pod, glow };
  });

  const pilot = pivot(root, 'pilot', 0, 0.31, 0.9);
  const oval = new T.SphereGeometry(1, 8, 6);
  part(pilot, oval, harness, 0, 0, 0).scale.set(0.61, 0.34, 0.15);
  const neck = pivot(pilot, 'pilot_neck', 0, 0.14, 0.04);
  neck.scale.setScalar(1.48);
  const skin = armor(0x98867a);
  part(neck, oval, skin, 0, 0.28, 0.02).scale.set(0.29, 0.37, 0.22);
  part(neck, oval, skin, 0, 0.19, 0.23).scale.set(0.20, 0.14, 0.32);
  const jaw = pivot(neck, 'pilot_jaw', 0, 0.07, 0.12);
  part(jaw, oval, skin, 0, 0, 0.17).scale.set(0.18, 0.065, 0.24);
  for (const side of [-1, 1]) {
    part(neck, new T.CircleGeometry(0.046, 8), eye, side * 0.19, 0.31, 0.205);
  }
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 0.115;
    part(neck, polygon([[x - 0.075, 0.47], [x - 0.12, 0.79 - Math.abs(x) * 0.48], [x + 0.06, 0.51]]),
      crest, 0, 0, 0.06 + i * 0.003);
  }

  return {
    root,
    pose(reveal: number, windup: number, activeX: number, firedX: number, recoil: number) {
      for (const { side, pod, glow } of cannons) {
        const kick = side === Math.sign(firedX) ? recoil : 0;
        pod.position.z = -0.29 * kick;
        glow.material.opacity = Math.min(1, 0.14 + (side === Math.sign(activeX) ? 0.73 * windup : 0) + kick);
        glow.scale.setScalar(0.82 + 0.18 * windup + 0.24 * kick);
      }
      neck.rotation.y = 0.63 * (1 - reveal) + 0.17 * Math.sign(activeX) * windup;
      neck.rotation.x = 0.21 * windup + 0.13 * recoil;
      jaw.rotation.x = 0.23 * recoil;
      pilot.position.y = 0.31 - 0.09 * windup;
    },
  };
}
