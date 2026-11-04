import * as T from 'three';
import { BOSS_MUZZLE_Z, raptorFlight } from './encounters';
import { part, pivot, plating, polygon } from './rig-geometry';

const flat = (color: number) => new T.MeshBasicMaterial({ color, side: T.DoubleSide });
const armor = (color: number) => new T.MeshStandardMaterial({ color, roughness: 0.58, flatShading: true });

const smoothHide = (color: number) => new T.MeshStandardMaterial({ color, roughness: 0.68 });

const featherMaterial = new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide });

export function setFeatherTexture(texture: T.Texture) {
  featherMaterial.map = texture;
  featherMaterial.needsUpdate = true;
}

function plume(parent: T.Group, x: number, y: number, z: number, length: number, width: number,
  angle: number, rootColor: number, tipColor: number) {
  const geo = polygon([[0, 0], [-width * 0.45, length * 0.27], [-width * 0.4, length * 0.68],
    [width * 0.08, length], [width * 0.42, length * 0.62], [width * 0.5, length * 0.28]]);
  const positions = geo.getAttribute('position');
  const base = new T.Color(rootColor);
  const tip = new T.Color(tipColor);
  const tint = new T.Color();
  const colors: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const along = positions.getY(i) / length;
    tint.copy(base).lerp(tip, Math.min(1, along * 1.38));
    colors.push(tint.r, tint.g, tint.b);
    uv.push(0.5 + positions.getX(i) / width, along);
  }
  geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  const blade = part(parent, geo, featherMaterial, x, y, z);
  blade.rotation.z = angle;
  return blade;
}

export function createRaptorRig() {
  const root = new T.Group();
  const ochre = 0xe8ae60;
  const cobalt = 0x658bd2;
  const umber = 0x633a35;
  const skin = smoothHide(0x94664e);
  const shadow = flat(0x36232d);
  const toes = flat(0xc59067);
  const oval = new T.SphereGeometry(1, 24, 16);
  part(root, oval, skin, 0, 0.02, 0.17).scale.set(0.28, 0.48, 0.21);
  part(root, oval, smoothHide(0xbb8f65), 0, 0.16, 0.24).scale.set(0.18, 0.32, 0.16);
  for (const side of [-1, 1]) {
    part(root, oval, skin, side * 0.19, -0.19, 0.15).scale.set(0.135, 0.23, 0.12);
    const claw = part(root, polygon([[0.14, -0.18], [0.27, -0.23], [0.32, -0.49],
      [0.25, -0.43], [0.24, -0.57], [0.18, -0.44], [0.15, -0.50], [0.17, -0.32]]), toes, 0, 0, 0.17);
    claw.scale.x = side;
  }

  const head = pivot(root, 'head', 0, 0.36, 0.23);
  part(head, oval, skin, 0, 0.12, 0.04).scale.set(0.18, 0.26, 0.14);
  part(head, oval, shadow, 0, 0.29, 0.025).scale.set(0.12, 0.21, 0.1);
  part(head, oval, smoothHide(0xcea27b), 0, 0.3, 0.075).scale.set(0.105, 0.2, 0.095);
  for (const side of [-1, 1]) {
    part(head, new T.CircleGeometry(0.034, 6), flat(0xffd673), side * 0.118, 0.18, 0.153);
    plume(head, side * 0.095, 0.12, 0.126, 0.32, 0.09, Math.PI + side * 0.27, umber, ochre);
  }

  const wings = ([-1, 1] as const).map((side) => {
    // The folded fans overlap in projection. Give each wing its own depth band.
    const depth = side < 0 ? 0.14 : 0.25;
    const shoulder = pivot(root, side < 0 ? 'shoulder_L' : 'shoulder_R', side * 0.19, 0.17, depth);
    const fan = pivot(shoulder, side < 0 ? 'fan_L' : 'fan_R', 0, 0, 0);
    fan.scale.x = side;
    part(fan, polygon([[0, 0.12], [0.57, 0.22], [0.89, 0.12], [0.59, -0.21], [0.18, -0.3], [0, -0.2]]),
      flat(0x9c674a), 0, 0, 0);
    for (let i = 0; i < 4; i++) {
      plume(fan, 0.17 + i * 0.125, 0.12 + i * 0.021, 0.014 + i * 0.007, 0.5 - i * 0.025, 0.18,
        -2.55 + i * 0.12, umber, i % 2 ? ochre : cobalt);
    }
    const outer = pivot(fan, side < 0 ? 'wrist_L' : 'wrist_R', 0.57, 0.12, 0.046);
    for (let i = 0; i < 6; i++) {
      plume(outer, 0.035 - i * 0.03, 0.065 - i * 0.049, i * 0.007, 0.91 - i * 0.063, 0.18,
        -1.53 - i * 0.16, 0x815345, i === 0 || i === 3 || i === 4 ? cobalt : ochre);
    }
    return { side, shoulder, outer };
  });

  const tail = pivot(root, 'tail', 0, -0.34, 0.14);
  plume(tail, 0, 0, 0, 1.06, 0.23, Math.PI, umber, ochre);
  const vanes = ([-1, 1] as const).map((side) => {
    const vane = pivot(tail, side < 0 ? 'tail_L' : 'tail_R', 0, -0.35, side < 0 ? 0.025 : 0.055);
    plume(vane, side * 0.05, 0, 0, 0.72, 0.13, Math.PI + side * 0.12, umber, cobalt);
    plume(vane, side * 0.06, 0.02, -0.01, 0.56, 0.11, Math.PI + side * 0.26, umber, ochre);
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
  const steel = armor(0x65768b);
  const bronze = armor(0xca8454);
  const darkPlate = armor(0x3a444d);
  const trim = flat(0xddab78);
  const shadow = flat(0x1c2230);
  const signal = flat(0xfdad66);
  const insignia = flat(0xe0c89f);
  part(root, plating([[-1.39, 0.87], [-0.7, 1.57], [0.7, 1.57], [1.39, 0.87],
    [1.45, -0.52], [0, -1.72], [-1.45, -0.52]], 0.45), steel, 0, 0, -0.86);
  part(root, plating([[-0.56, 1.79], [-0.33, 2.16], [0.33, 2.16], [0.56, 1.79]], 0.27, 0.037),
    darkPlate, 0, 0, -0.23);
  part(root, plating([[-2.23, 0.92], [-1.96, 2.78], [-0.97, 3.94], [0.97, 3.94],
    [1.96, 2.78], [2.23, 0.92], [1.86, -0.91], [0, -3.28], [-1.86, -0.91]], 0.58),
    darkPlate, 0, 0, -0.36);
  part(root, plating([[-1.67, 0.12], [-0.85, -0.02], [0, -0.48], [0.85, -0.02],
    [1.67, 0.12], [1.68, -0.85], [0, -3.09], [-1.68, -0.85]], 0.21), bronze, 0, 0, 0.26);
  part(root, polygon([[-0.09, -0.58], [0.17, -0.66], [0.14, -2.51], [0, -2.88], [-0.12, -2.44]]),
    trim, 0, 0, 0.56);
  for (const side of [-1, 1]) {
    const cheek = part(root, plating([[0.83, -0.27], [1.62, -0.08], [1.51, -0.77], [0.69, -1.59]],
      0.13, 0.03), steel, 0, 0, 0.46);
    cheek.scale.x = side;
    const intake = part(root, new T.BoxGeometry(0.34, 0.085, 0.045), signal, side * 1.25, -0.55, 0.653);
    intake.rotation.z = side * 0.76;
  }

  const cockpit = pivot(root, 'cockpit', 0, 0.35, 0.08);
  cockpit.scale.set(1.65, 1.91, 1.11);
  const canopyFrame: [number, number][] = [[-1.23, 0.24], [-1.34, 0.91], [-0.84, 1.79],
    [0.85, 1.79], [1.34, 0.91], [1.23, 0.24], [0.74, -0.03], [-0.74, -0.03]];
  part(cockpit, plating(canopyFrame, 0.16), bronze, 0, 0, 0.43);
  const interior = part(cockpit, polygon(canopyFrame), shadow, 0, 0.1, 0.68);
  interior.scale.set(0.88, 0.85, 1);
  part(cockpit, polygon([[-0.89, 0.25], [-0.63, 0.34], [0.63, 0.34], [0.89, 0.25], [0.67, 0.04], [-0.67, 0.04]]),
    steel, 0, 0, 1.13);
  for (let i = -2; i <= 2; i++) {
    part(cockpit, new T.BoxGeometry(0.045, 0.053, 0.025), signal, i * 0.14, 0.21, 1.145);
  }

  const cannons = ([-1, 1] as const).map((side) => {
    const wing = pivot(root, side < 0 ? 'wing_L' : 'wing_R', 0, 0, 0);
    wing.scale.x = side;
    part(wing, plating([[1.2, 0.8], [3.89, 2.22], [5.51, 3.45], [4.93, 0.8], [3.12, -0.34], [1.2, -0.51]],
      0.22), darkPlate, 0, 0, -0.51);
    part(wing, plating([[1.13, 0.86], [3.51, 2.32], [5.83, 4.91], [5.17, 1.63], [4.08, 0.32],
      [3.25, -0.29], [2.57, -0.57], [1.13, -0.54]], 0.29), steel, 0, 0, -0.25);
    part(wing, plating([[3.29, 1.92], [5.63, 4.54], [5.0, 1.63], [4.19, 0.83]],
      0.09, 0.039), bronze, 0, 0, 0.07);
    part(wing, polygon([[4.36, 1.56], [5.48, 3.81], [5.24, 2.68], [4.86, 1.67]]),
      flat(0xa14e39), 0, 0, 0.22);
    part(wing, plating([[1.3, 0.43], [4.15, 1.13], [3.77, 0.67], [2.85, 0.26], [1.35, -0.07]], 0.09),
      bronze, 0, 0, 0.08);
    part(wing, plating([[1.3, 0.64], [2.57, 0.94], [3.24, 0.99], [2.49, 0.75], [1.44, 0.44]],
      0.066, 0.022), steel, 0, 0, 0.23);
    part(wing, plating([[2.88, 0.05], [3.53, 0.25], [3.81, 0.42], [3.53, -0.08],
      [3.03, -0.32]], 0.092, 0.028), darkPlate, 0, 0, 0.11);
    part(wing, polygon([[2.68, 0.54], [3.91, 1.01], [3.5, 0.79], [2.74, 0.49]]), insignia, 0, 0, 0.25);
    for (let i = 0; i < 4; i++) {
      part(wing, polygon([[2.78 + i * 0.22, 0.53 + i * 0.081],
        [2.63 + i * 0.25, 0.75 + i * 0.075], [2.99 + i * 0.21, 0.62 + i * 0.079]]),
        insignia, 0, 0, 0.25);
    }
    for (const y of [-0.24, -0.36]) {
      const slit = part(wing, new T.BoxGeometry(0.43, 0.045, 0.03), signal, 3.16, y, 0.14);
      slit.rotation.z = 0.21;
    }

    const pod = pivot(root, side < 0 ? 'cannon_L' : 'cannon_R', side * cannonX, 0, 0);
    part(pod, plating([[-0.59, 0.21], [-0.44, 0.43], [0.44, 0.43], [0.59, 0.21],
      [0.51, -0.36], [-0.51, -0.36]], 0.52), darkPlate, 0, 0, 0.04);
    const barrel = part(pod, new T.CylinderGeometry(0.32, 0.38, 0.57, 8), bronze, 0, 0, BOSS_MUZZLE_Z - 0.285);
    barrel.rotation.x = Math.PI / 2;
    const sleeve = part(pod, new T.CylinderGeometry(0.34, 0.39, 0.15, 8), steel,
      0, 0, BOSS_MUZZLE_Z - 0.17);
    sleeve.rotation.x = Math.PI / 2;
    for (const x of [-0.43, 0.43]) {
      part(pod, new T.BoxGeometry(0.085, 0.36, 0.14), steel, x, 0, 0.57);
    }
    const muzzle = pivot(pod, side < 0 ? 'muzzle_L' : 'muzzle_R', 0, 0, BOSS_MUZZLE_Z);
    part(muzzle, new T.CircleGeometry(0.246, 8), shadow, 0, 0, 0.005);
    part(muzzle, new T.RingGeometry(0.234, 0.282, 8), trim, 0, 0, 0.012);
    const glow = part(muzzle, new T.CircleGeometry(0.22, 10),
      new T.MeshBasicMaterial({ color: 0xff9251, transparent: true, depthWrite: false }), 0, 0, 0.021);
    return { side, pod, glow };
  });

  const pilot = pivot(cockpit, 'pilot', 0, 0.27, 0.87);
  const oval = new T.SphereGeometry(1, 24, 16);
  const skin = smoothHide(0xa87e62);
  const face = smoothHide(0xcead85);
  const eye = flat(0xffce6c);
  part(pilot, oval, smoothHide(0x3a444d), 0, 0, 0).scale.set(0.68, 0.39, 0.21);
  for (const side of [-1, 1]) {
    const strap = part(pilot, new T.BoxGeometry(0.09, 0.38, 0.075), trim, side * 0.34, 0.02, 0.2);
    strap.rotation.z = side * 0.33;
    part(pilot, oval, skin, side * 0.54, -0.01, 0.24).scale.set(0.14, 0.12, 0.11);
  }
  const neck = pivot(pilot, 'pilot_neck', 0, 0.2, 0.05);
  neck.scale.setScalar(1.58);
  part(neck, oval, skin, 0, 0.25, 0).scale.set(0.26, 0.35, 0.2);
  part(neck, oval, face, 0, 0.18, 0.25).scale.set(0.185, 0.124, 0.35);
  const jaw = pivot(neck, 'pilot_jaw', 0, 0.068, 0.12);
  part(jaw, oval, shadow, 0, 0.033, 0.19).scale.set(0.182, 0.043, 0.29);
  part(jaw, oval, skin, 0, 0, 0.175).scale.set(0.167, 0.055, 0.28);
  for (const side of [-1, 1]) {
    part(neck, new T.CircleGeometry(0.057, 8), shadow, side * 0.174, 0.294, 0.18);
    part(neck, new T.CircleGeometry(0.038, 8), eye, side * 0.176, 0.291, 0.191);
    part(neck, new T.PlaneGeometry(0.009, 0.051), shadow, side * 0.172, 0.29, 0.197);
    const brow = part(neck, new T.BoxGeometry(0.12, 0.043, 0.05), face, side * 0.16, 0.334, 0.179);
    brow.rotation.z = side * 0.34;
    part(neck, new T.CircleGeometry(0.024, 6), shadow, side * 0.091, 0.188, 0.537);
    for (let i = 0; i < 3; i++) {
      plume(neck, side * (0.19 - i * 0.033), 0.19 - i * 0.053, 0.13,
        0.18, 0.07, Math.PI + side * (0.36 + i * 0.10), 0x73534a, 0xc3a180);
    }
  }
  const crest = pivot(neck, 'pilot_crest', 0, 0.45, 0.01);
  for (let i = -3; i <= 3; i++) {
    plume(crest, i * 0.071, -Math.abs(i) * 0.021, 0.013 * (3 - Math.abs(i)),
      0.43 - Math.abs(i) * 0.052, 0.119, 0.29 - i * 0.15, 0x6d3732, i % 2 ? 0xec9a55 : 0xbf6448);
  }

  return {
    root,
    setArmorTexture(texture: T.Texture) {
      for (const material of [steel, bronze]) {
        material.map = texture;
        material.needsUpdate = true;
      }
    },
    setScaleTexture(texture: T.Texture) {
      for (const material of [skin, face]) {
        material.map = texture;
        material.needsUpdate = true;
      }
    },
    pose(reveal: number, windup: number, activeX: number, firedX: number, recoil: number) {
      for (const { side, pod, glow } of cannons) {
        const kick = side === Math.sign(firedX) ? recoil : 0;
        const charge = side === Math.sign(activeX) ? windup : 0;
        pod.position.z = -0.29 * kick;
        glow.material.opacity = Math.min(1, 0.18 + 0.7 * charge + kick);
        glow.scale.setScalar(0.8 + 0.21 * charge + 0.22 * kick);
      }
      neck.rotation.y = 0.57 + 0.53 * (1 - reveal) + 0.16 * Math.sign(activeX) * windup;
      neck.rotation.x = 0.18 * windup + 0.13 * recoil;
      jaw.rotation.x = 0.07 + 0.12 * windup + 0.28 * recoil;
      crest.rotation.x = -0.14 * recoil;
      pilot.position.y = 0.27 - 0.08 * windup;
    },
  };
}
