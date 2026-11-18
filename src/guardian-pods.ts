import * as T from 'three';
import { BOSS_MUZZLE_Z } from './encounters';
import { antPlate, sporeCup, sporeGlow } from './hive-materials';
import { part, pivot } from './rig-geometry';

const recoilDepth = 0.29;

function sporeArm(cannonX: number) {
  const spans = 24, sides = 12;
  const curve = new T.CubicBezierCurve3(
    new T.Vector3(0.55, 0.97, 0.55), new T.Vector3(1.19, 1.16, 0.45),
    new T.Vector3(cannonX - 0.42, 0.21, 0.71), new T.Vector3(cannonX, 0.10, 0.56),
  );
  const geometry = new T.TubeGeometry(curve, spans, 1, sides, false);
  const position = geometry.getAttribute('position');
  const colors: number[] = [];
  const shell = new T.Color(0xc4977b), crease = new T.Color(0x583a31), tint = new T.Color();
  for (let i = 0; i <= spans; i++) {
    const t = i / spans, center = curve.getPointAt(t);
    const fold = (0.5 + 0.5 * Math.cos(Math.PI * 14 * t)) ** 3 * Math.sin(Math.PI * t);
    const width = 0.18 + 0.1 * Math.sin(Math.PI * t) ** 2 - 0.033 * fold;
    for (let j = 0; j <= sides; j++) {
      const index = i * (sides + 1) + j;
      position.setXYZ(index,
        center.x + (position.getX(index) - center.x) * width,
        center.y + (position.getY(index) - center.y) * width,
        center.z + (position.getZ(index) - center.z) * width * 0.84);
      tint.copy(shell).lerp(crease, fold * 0.63);
      colors.push(tint.r, tint.g, tint.b);
    }
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  // Both arms share a morph. The first rings are embedded in the carapace;
  // the last ring translates the same distance as the cup it supports.
  const kicked = geometry.clone(), target = kicked.getAttribute('position');
  for (let i = 0; i <= spans; i++) {
    const movement = recoilDepth * T.MathUtils.smoothstep(i / spans, 0.08, 1);
    for (let j = 0; j <= sides; j++) {
      const index = i * (sides + 1) + j;
      target.setZ(index, position.getZ(index) - movement);
    }
  }
  kicked.computeVertexNormals();
  geometry.morphAttributes.position = [target];
  geometry.morphAttributes.normal = [kicked.getAttribute('normal')];
  return geometry;
}

function sporeOrgan() {
  // Profile folds over the lip and returns down the inner wall of the cup.
  const profile = [
    [0, -0.43], [0.152, -0.40], [0.26, -0.33], [0.342, -0.22], [0.385, -0.105],
    [0.405, 0.023], [0.394, 0.101], [0.35, 0.151], [0.305, 0.135],
    [0.276, 0.08], [0.254, 0.002], [0.214, -0.064], [0.138, -0.111], [0, -0.119],
  ];
  const sides = 56;
  const geometry = new T.LatheGeometry(profile.map(([radius, depth]) => new T.Vector2(radius, depth)), sides)
    .rotateX(Math.PI / 2);
  const position = geometry.getAttribute('position');
  const brown = new T.Color(0x9e674c), edge = new T.Color(0xf1d19e), throat = new T.Color(0x4a2526);
  const colors: number[] = [], color = new T.Color();
  for (let i = 0; i <= sides; i++) {
    const angle = i / sides * Math.PI * 2;
    const scallop = 0.65 * Math.cos(angle * 7) + 0.35 * Math.cos(angle * 11 + 0.7);
    for (let row = 0; row < profile.length; row++) {
      const index = i * profile.length + row;
      const fluting = scallop * T.MathUtils.smoothstep(profile[row][0], 0.12, 0.39);
      const radiusScale = 1 + 0.078 * fluting;
      position.setXYZ(index, position.getX(index) * radiusScale, position.getY(index) * radiusScale,
        position.getZ(index) + 0.047 * fluting);
      color.copy(row >= 9 ? throat : brown).lerp(edge, Math.max(0, 1 - Math.abs(row - 7) / 3) * 0.93);
      color.multiplyScalar(0.94 + 0.13 * scallop);
      colors.push(color.r, color.g, color.b);
    }
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3)).computeVertexNormals();
  return geometry;
}

const cup = sporeOrgan();
const membrane = new T.SphereGeometry(1, 22, 16).scale(0.86, 0.81, 0.74);

export function createGuardianPods(root: T.Group, cannonX: number) {
  const armGeometry = sporeArm(cannonX);
  const pods = [-1, 1].map(side => {
    const arm = part(root, armGeometry, antPlate, 0, 0, 0);
    arm.name = side < 0 ? 'spore-arm_L' : 'spore-arm_R';
    arm.scale.x = side;
    const pod = pivot(root, side < 0 ? 'muzzle_L' : 'muzzle_R', side * cannonX, 0, 0);
    part(pod, cup, sporeCup, 0, 0, BOSS_MUZZLE_Z);
    const glow = part(pod, membrane, sporeGlow, 0, 0, BOSS_MUZZLE_Z);
    glow.scale.setScalar(0.19);
    pivot(glow, side < 0 ? 'laser_contact_L' : 'laser_contact_R', 0, 0, 1.05);
    return { side, arm, pod, glow };
  });

  return (windup: number, activeX: number, firedX: number, recoil: number) => {
    for (const { side, arm, pod, glow } of pods) {
      const kick = side === Math.sign(firedX) ? recoil : 0;
      const charge = side === Math.sign(activeX) ? windup : 0;
      arm.morphTargetInfluences![0] = kick;
      pod.position.z = -recoilDepth * kick;
      glow.scale.setScalar(0.19 + charge * 0.1 + kick * 0.06);
    }
  };
}
