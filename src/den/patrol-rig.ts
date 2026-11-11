import * as T from 'three';
import { addBurner, burnerMaterial, poseBurners, shipBurners } from '../burners';
import { denPatrolFrame } from './patrol';

// Measured on the original 1536×1024 atlas. The last pair marks the same
// chassis point in every view, so cropped poses share a world-space pivot.
const frames = [
  [97, 31, 313, 461, 206, 269],
  [466, 30, 681, 453, 567, 264],
  [837, 39, 1095, 441, 955, 262],
  [1184, 52, 1508, 423, 1335, 262],
  [24, 585, 370, 914, 201, 766],
  [389, 605, 747, 872, 569, 757],
  [768, 621, 1143, 865, 962, 755],
] as const;

function frameGeometry([left, top, right, bottom, pivotX, pivotY]: typeof frames[number], mirror: boolean) {
  const scale = .00525, sign = mirror ? -1 : 1;
  const geometry = new T.PlaneGeometry((right - left) * scale, (bottom - top) * scale);
  geometry.translate(((left + right) / 2 - pivotX) * scale * sign, (pivotY - (top + bottom) / 2) * scale, 0);
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    const x = mirror ? 1 - uv.getX(i) : uv.getX(i);
    uv.setXY(i, T.MathUtils.lerp(left, right, x) / 1536, 1 - T.MathUtils.lerp(bottom, top, uv.getY(i)) / 1024);
  }
  return geometry;
}

function placeholder() {
  const root = new T.Group();
  const armor = new T.MeshStandardMaterial({ color: 0x534959, metalness: .43, roughness: .59 });
  const red = new T.MeshStandardMaterial({ color: 0x913932, roughness: .68 });
  const hide = new T.MeshStandardMaterial({ color: 0xa68568, roughness: .83 });
  const amber = new T.MeshBasicMaterial({ color: 0xffb54b });
  const sphere = new T.SphereGeometry(1, 12, 8);
  const taper = new T.ConeGeometry(1, 1, 4).rotateZ(Math.PI);
  const part = (geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number, w: number, h: number, d: number) => {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    root.add(mesh);
    return mesh;
  };
  part(taper, red, 0, -.16, .08, .45, 1.73, .20);
  part(sphere, armor, 0, .27, .17, .27, .46, .22);
  part(sphere, hide, 0, .02, .34, .18, .25, .18);
  for (const side of [-1, 1]) {
    part(sphere, armor, side * .39, .14, .09, .15, .47, .16);
    part(sphere, amber, side * .39, -.19, .18, .09, .07, .075);
    part(sphere, hide, side * .19, -.06, .24, .067, .24, .1).rotation.z = side * .43;
  }
  for (let i = -2; i <= 2; i++) {
    part(taper, red, i * .056, .21, .38, .06, .42 - .045 * Math.abs(i), .045).rotation.z = .17 * i;
  }
  return root;
}

export function createDenPatrols(count: number) {
  const left = frames.map((frame, i) => {
    const geometry = frameGeometry(frame, false);
    geometry.name = `patrol-left-${i}`;
    return geometry;
  });
  const right = frames.map((frame, i) => {
    if (!i) return left[0];
    const geometry = frameGeometry(frame, true);
    geometry.name = `patrol-right-${i}`;
    return geometry;
  });
  const art = new T.MeshBasicMaterial({ color: 0xffffff, alphaTest: .31, alphaToCoverage: true });
  const model = placeholder();
  const jets = burnerMaterial(0xff812d);
  const warningShape = new T.RingGeometry(.047, .096, 14);
  const warningMaterial = new T.MeshBasicMaterial({ color: 0xffb650, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
  const rigs = Array.from({ length: count }, () => {
    const root = new T.Group(), effects = new T.Group(), fallback = model.clone();
    root.name = 'draconian-patrol';
    const card = new T.Mesh(left[0], art);
    card.name = 'patrol-heading';
    card.position.z = .19;
    card.visible = false;
    for (const x of [-.38, .38]) addBurner(effects, jets, x, .34, .10, .14, .87).rotation.z = Math.PI;
    const plumes = shipBurners(effects);
    const warning = new T.Mesh(warningShape, warningMaterial);
    warning.position.set(0, -.82, .34);
    warning.visible = false;
    effects.add(warning);
    root.add(fallback, card, effects);
    return {
      root,
      useArt() { card.visible = true; fallback.visible = false; },
      pose(x: number, y: number, heading: number, size: number, throttle: number, charge: number, time: number) {
        root.visible = true;
        root.position.set(x, y, .12);
        root.scale.setScalar(size);
        const frame = denPatrolFrame(heading);
        card.geometry = (frame.mirror ? right : left)[frame.index];
        card.rotation.z = frame.bank;
        effects.rotation.z = fallback.rotation.z = heading;
        poseBurners(plumes, time, throttle);
        warning.visible = charge > 0;
        warning.scale.setScalar(.55 + 1.3 * charge);
      },
    };
  });
  return {
    rigs,
    setArt(map: T.Texture) {
      art.map = map;
      art.needsUpdate = true;
      rigs.forEach(rig => rig.useArt());
    },
    dispose() {
      for (const geometry of new Set([...left, ...right])) geometry.dispose();
    },
  };
}
