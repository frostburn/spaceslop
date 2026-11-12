import * as T from 'three';
import { addBurner, burnerMaterial, poseBurners, shipBurners } from '../burners';
import { DEN_GUNS, denPose } from './combat';

const BIKE_SCALE = .00845;
const GRIP_HEIGHT = (300 - 166) * BIKE_SCALE;
const SHEET_WIDTH = 1536;
const SHEET_HEIGHT = 1024;
const RIDER_SCALE = .00565;
const THROTTLE_X = (611 - 801) * RIDER_SCALE;

// Each card's origin is its attachment point in the full atlas. Normalized
// UVs keep these registrations when the owner resizes the whole sheet.
function card(material: T.MeshBasicMaterial, rect: readonly [number, number, number, number],
  anchor: readonly [number, number], scale: number, segments = 1) {
  const [left, top, right, bottom] = rect;
  const geometry = new T.PlaneGeometry(1, 1, segments, segments);
  const position = geometry.getAttribute('position') as T.BufferAttribute;
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    const x = T.MathUtils.lerp(left, right, uv.getX(i));
    const y = T.MathUtils.lerp(bottom, top, uv.getY(i));
    position.setXYZ(i, (x - anchor[0]) * scale, (anchor[1] - y) * scale, 0);
    uv.setXY(i, x / SHEET_WIDTH, 1 - y / SHEET_HEIGHT);
  }
  const mesh = new T.Mesh(geometry, material);
  if (segments > 1) {
    position.setUsage(T.DynamicDrawUsage);
    mesh.frustumCulled = false;
  }
  return mesh;
}

function featherBend(mesh: T.Mesh, side: -1 | 0 | 1, phase: number) {
  const positions = mesh.geometry.getAttribute('position');
  const rest = Float32Array.from(positions.array);
  return (time: number, throttle: number, bank: number) => {
    const sway = .065 * Math.sin(time * 3.7 + phase) + .048 * throttle * Math.sin(time * 10 + phase);
    for (let i = 0; i < positions.count; i++) {
      const x = rest[i * 3], y = rest[i * 3 + 1];
      const weight = Math.min(1, (x * x + y * y) / 2.6);
      const ripple = Math.sin(time * 7 + y * 3.4 + phase) * .05 * throttle;
      positions.setXYZ(i, x + weight * (sway - .49 * bank - side * throttle * .12),
        y + weight * (side ? .29 * throttle + ripple : -.14 * throttle),
        weight * (ripple - side * bank * .32));
    }
    positions.needsUpdate = true;
  };
}

function throttleHand(mesh: T.Mesh) {
  const positions = mesh.geometry.getAttribute('position');
  const vertices: { i: number; x: number; y: number; weight: number }[] = [];
  // The rider's right fist is on screen left. Twist around the handlebar
  // and blend through the cuff into the forearm, keeping the grip planted.
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i) - THROTTLE_X, y = positions.getY(i);
    const distance = Math.hypot(x / .5, y / .58);
    if (distance < 1) vertices.push({ i, x, y, weight: 1 - T.MathUtils.smoothstep(distance, .46, 1) });
  }
  return (rev: number) => {
    const roll = -.96 * rev, curl = -.57 * rev;
    const c = Math.cos(curl), s = Math.sin(curl), flat = Math.cos(roll), depth = Math.sin(roll);
    for (const { i, x, y, weight } of vertices) {
      positions.setXYZ(i, THROTTLE_X + x + weight * (x * (c - 1) - y * flat * s),
        y + weight * (x * s + y * (flat * c - 1)), y * depth * weight);
    }
    positions.needsUpdate = true;
  };
}

function createPlaceholder(bike: T.Group, rider: T.Group) {
  const iron = new T.MeshStandardMaterial({ color: 0x465065, metalness: .62, roughness: .44 });
  const enamel = new T.MeshStandardMaterial({ color: 0x903b37, metalness: .36, roughness: .53 });
  const skin = new T.MeshStandardMaterial({ color: 0xa2876c, roughness: .77 });
  const leather = new T.MeshStandardMaterial({ color: 0x362d2d, roughness: .86 });
  const brass = new T.MeshStandardMaterial({ color: 0xb1753b, metalness: .5, roughness: .48 });
  const lamp = new T.MeshBasicMaterial({ color: 0xffb643 });
  const ball = new T.SphereGeometry(1, 14, 10);
  const box = new T.BoxGeometry(1, 1, 1);
  const wedge = new T.ConeGeometry(1, 1, 4);
  function add(root: T.Group, geometry: T.BufferGeometry, material: T.Material,
    x: number, y: number, z: number, w: number, h: number, d: number) {
    const mesh = new T.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    root.add(mesh);
    return mesh;
  }
  add(bike, wedge, enamel, 0, -.15, .02, .69, 3.35, .23).rotation.z = Math.PI;
  add(bike, box, iron, 0, GRIP_HEIGHT, .1, 2.41, .16, .19);
  add(bike, ball, leather, 0, 1.55, 0, .49, .61, .19);
  for (const side of [-1, 1]) {
    add(bike, ball, iron, side * .89, .12, 0, .53, .84, .23);
    add(bike, ball, lamp, side * .89, -.17, .23, .28, .29, .1);
    add(bike, wedge, iron, side * 1.46, -.19, .01, .3, 2.59, .2).rotation.z = Math.PI + side * .29;
    add(bike, box, brass, side * 1.34, -.51, .14, .14, .86, .1).rotation.z = side * .29;
    add(rider, ball, iron, side * .72, 1.16, .11, .34, .46, .2).rotation.z = side * .31;
    add(rider, ball, skin, side * .94, .46, .13, .22, .62, .19).rotation.z = side * .34;
    add(rider, ball, lamp, side * .2, 1.84, .35, .08, .044, .05).rotation.z = side * .26;
  }
  add(rider, ball, leather, 0, .8, .07, .78, .84, .26);
  add(rider, ball, skin, 0, 1.92, .12, .43, .51, .28);
  add(rider, wedge, skin, 0, 1.59, .32, .29, .65, .17).rotation.z = Math.PI;
  for (let i = -2; i <= 2; i++) {
    add(rider, wedge, i % 2 ? iron : enamel, .17 * i, 2.29, .03, .15, .9 - Math.abs(i) * .1, .13).rotation.z = -.22 * i;
    for (const side of [-1, 1]) {
      add(rider, ball, i % 2 ? iron : enamel, side * (1.02 + .105 * i), .8 + .09 * i, -.06,
        .11, .69, .11).rotation.z = side * (1.02 + .19 * i);
    }
  }
  add(rider, ball, skin, 1.04, -.02, .14, .19, .22, .17);
  return add(rider, ball, skin, THROTTLE_X, -.02, .14, .19, .22, .17);
}

export function createDenBiker() {
  const root = new T.Group(), rider = new T.Group();
  root.name = 'gantry-chief';
  rider.position.set(0, GRIP_HEIGHT, .2);
  root.add(rider);
  const fallbackBike = new T.Group(), fallbackRider = new T.Group();
  const grip = createPlaceholder(fallbackBike, fallbackRider);
  root.add(fallbackBike);
  rider.add(fallbackRider);

  const material = new T.MeshBasicMaterial({ color: 0xffffff, alphaTest: .32, alphaToCoverage: true });
  const bike = card(material, [4, 10, 510, 505], [259, 300], BIKE_SCALE);
  const body = card(material, [539, 10, 1063, 482], [801, 413], RIDER_SCALE, 40);
  body.name = 'gantry-rider';
  const twistThrottle = throttleHand(body);
  body.position.z = .11;
  const crest = card(material, [1095, 6, 1500, 460], [1318, 439], .00335, 14);
  const left = card(material, [18, 533, 485, 1010], [447, 601], .00338, 14);
  const right = card(material, [570, 534, 1020, 1008], [611, 602], .00338, 14);
  crest.position.set(0, 1.63, .035);
  left.position.set(-.79, 1.34, -.034);
  right.position.set(.79, 1.34, -.034);
  root.add(bike);
  rider.add(crest, left, right, body);
  const cards = [bike, crest, left, right, body];
  cards.forEach(mesh => { mesh.visible = false; });
  const bend = [featherBend(crest, 0, .6), featherBend(left, -1, 2.3), featherBend(right, 1, 4.7)];

  const burner = burnerMaterial(0xff6624);
  for (const x of [-.89, .89]) addBurner(root, burner, x, -.17, .37, .24, 1.7);
  const plumes = shipBurners(root);
  const flashMaterial = new T.MeshBasicMaterial({ color: 0xff9a3c, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
  const flashShape = new T.ConeGeometry(.13, .39, 5).rotateZ(Math.PI).translate(0, -.12, 0);
  const flashes = DEN_GUNS.map(gun => {
    const mesh = new T.Mesh(flashShape, flashMaterial);
    mesh.position.set(gun.x, gun.y, .6);
    root.add(mesh);
    return mesh;
  });
  return {
    root,
    setArt(texture: T.Texture) {
      material.map = texture;
      material.needsUpdate = true;
      fallbackBike.visible = fallbackRider.visible = false;
      cards.forEach(mesh => { mesh.visible = true; });
    },
    pose(time: number, alive: boolean) {
      const pose = denPose(time);
      root.visible = alive;
      root.position.set(pose.x, pose.y, .07);
      root.rotation.z = pose.bank;
      rider.rotation.x = .025 + pose.throttle * .125;
      if (body.visible) twistThrottle(pose.rev);
      else grip.rotation.set(-.96 * pose.rev, 0, -.57 * pose.rev);
      for (const deform of bend) deform(time, pose.throttle, pose.bank);
      poseBurners(plumes, time, alive ? pose.throttle : 0);
      flashMaterial.opacity = pose.flash;
      flashes.forEach((flash, index) => {
        flash.visible = alive && index === pose.firingGun;
        flash.scale.setScalar(.66 + .85 * pose.flash);
      });
    },
  };
}
