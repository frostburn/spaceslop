import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TITAN_CENTIPEDE_MUZZLE, TITAN_SCOUT_MUZZLE } from './titan-challenge';
import { addTitanSetae, cicadaAbdomen, cicadaEye, titanChitin } from './titan-insect-surfaces';
import { cicadaWingGeometry, mountCicadaWing } from './titan-wings';
import { centipedeFoot, CENTIPEDE_BODY_HEIGHT, type CentipedeGait } from './centipede-gait';

// Small patrol models share all GPU resources; each pool entry owns only its pivots.
const scoutShell = titanChitin(0x7f9690, .74); scoutShell.vertexColors = true;
const scoutRim = titanChitin(0xa9b3a0, .7);
const scoutJoint = new T.MeshStandardMaterial({ color: 0x234147, roughness: .8 });
const scoutEye = cicadaEye(0x594832, .004);
const shell = titanChitin(0xb74c44, .57);
const rim = titanChitin(0xebb16c, .7);
const joint = new T.MeshStandardMaterial({ color: 0x38212b, roughness: .83 });
const eye = new T.MeshStandardMaterial({ color: 0x93dccc, emissive: 0x2d746b, emissiveIntensity: .3, roughness: .24, metalness: .3 });
const wound = new T.MeshStandardMaterial({ color: 0x553923, roughness: .88 });
const membrane = new T.MeshPhysicalMaterial({ color: 0xb5c4b6, transparent: true, opacity: .30,
  roughness: .28, metalness: .08, clearcoat: .7, side: T.DoubleSide, depthWrite: false });
const vein = new T.LineBasicMaterial({ color: 0xa4a88d, transparent: true, opacity: .58, depthWrite: false });
const orb = new T.SphereGeometry(1, 16, 10);
const chargeLight = new T.MeshBasicMaterial({ color: 0xe8acff });
const up = new T.Vector3(0, 1, 0);

function oval(x: number, y: number, z: number, sx: number, sy: number, sz: number) {
  return orb.clone().scale(sx, sy, sz).translate(x, y, z);
}
function link(a: number[], b: number[], radius: number) {
  const start = new T.Vector3(...a), end = new T.Vector3(...b), delta = end.clone().sub(start);
  return new T.CylinderGeometry(radius * .55, radius, delta.length(), 6)
    .applyQuaternion(new T.Quaternion().setFromUnitVectors(up, delta.normalize()))
    .translate((start.x + end.x) / 2, (start.y + end.y) / 2, (start.z + end.z) / 2);
}
function merge(parts: T.BufferGeometry[]) {
  const geometry = mergeGeometries(parts);
  parts.forEach(part => part.dispose());
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
function mesh(parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material, name: string) {
  const part = new T.Mesh(geometry, material); part.name = name; parent.add(part); return part;
}

let scoutParts: ReturnType<typeof scoutGeometry> | undefined;
function scoutGeometry() {
  const body: T.BufferGeometry[] = [oval(0, 0, .08, .29, .44, .23), oval(0, .41, .15, .37, .22, .22)];
  const legs: T.BufferGeometry[] = [], eyes: T.BufferGeometry[] = [];
  const abdomen = cicadaAbdomen(.67, .267, .19, 5).translate(0, -.28, .058);
  body.push(abdomen);
  for (const side of [-1, 1]) {
    eyes.push(orb.clone().scale(.103, .141, .079).rotateZ(side * -.33).translate(side * .282, .442, .257));
    legs.push(link([side * .16, .5, .1], [side * .43, .73, .12], .018));
    for (let i = 0; i < 3; i++) {
      const y = .19 - i * .18;
      legs.push(link([side * .2, y, .0], [side * .49, y - .14, -.08], .04),
        link([side * .49, y - .14, -.08], [side * .60, y - .45, -.02], .023));
    }
  }
  const wing = cicadaWingGeometry(1.10, -.86, .66, .062, .15);
  const carapace = merge(body), positions = carapace.attributes.position, uv = carapace.attributes.uv, colors: number[] = [];
  const spots = [[-.19,.34,.22],[.21,-.15,.26],[-.12,-.62,.17],[.11,.56,.13]];
  for (let i=0;i<positions.count;i++) {
    const x=positions.getX(i),y=positions.getY(i);
    uv.setXY(i,x*.73+y*.21+.27,y*.65-x*.18+.45);
    const stain = spots.reduce((v,[cx,cy,r])=>v+Math.exp(-((x-cx)**2+(y-cy)**2)/(r*r)),0);
    const value = Math.max(.52,1-stain*.28);
    colors.push(value,value*.98,value*.94);
  }
  carapace.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  return { body: carapace, legs: merge(legs), eyes: merge(eyes), wing };
}

export function createCicadaScout() {
  const g = scoutParts ??= scoutGeometry(), root = new T.Group(); root.name = 'cicada-scout';
  mesh(root, g.body, scoutShell, 'scout-carapace');
  mesh(root, g.eyes, scoutEye, 'compound-eyes'); const feet = mesh(root, g.legs, scoutJoint, 'folded-legs');
  const muzzle = mesh(root, orb, chargeLight, 'scout-charge');
  muzzle.position.set(0, TITAN_SCOUT_MUZZLE, .31); muzzle.visible = false;
  addTitanSetae(root, 0, -.08, .32, .57, .76, 0);
  for (const side of [-1, 1]) addTitanSetae(root, side * .24, .31, .32, .30, .32, 0);
  const wings: { pivot: T.Group; side: number; rear: boolean; flex: (amount: number) => void }[] = [];
  for (const side of [-1, 1]) for (const rear of [true, false]) {
    const pivot = new T.Group(); pivot.name = `patrol-${rear ? 'hind' : 'fore'}wing-${side}`;
    pivot.position.set(side * .18, rear ? -.17 : .15, rear ? .32 : .34);
    const hinge = mesh(root, orb, scoutRim, 'dorsal-wing-hinge');
    hinge.position.copy(pivot.position).add(new T.Vector3(0, 0, -.035)); hinge.scale.set(.07, .10, .065);
    const { blade, flex } = mountCicadaWing(g.wing, membrane, vein); blade.scale.set(side * (rear ? .73 : 1), rear ? .76 : 1, 1);
    blade.rotation.z = side * (rear ? -.15 : .05);
    pivot.add(blade); root.add(pivot); wings.push({ pivot, side, rear, flex });
  }
  return { root, prime() { muzzle.visible = true; muzzle.scale.setScalar(.12); }, pose(time: number, bank = 0, charge = 0) {
    muzzle.visible = charge > 0;
    muzzle.scale.setScalar(.045 + charge * .105);
    root.rotation.y = bank; feet.rotation.x = Math.sin(time * 9) * .12;
    for (const { pivot, side, rear, flex } of wings) {
      // The full beat stays at or above the dorsal hinge, never beneath the shell.
      const beat = time * 48 + (rear ? .8 : 0);
      pivot.rotation.y = side * (-.16 + Math.sin(beat) * .14);
      pivot.rotation.z = side * Math.sin(beat - .3) * .045;
      flex(.5 + .5 * Math.sin(beat - .95));
    }
  } };
}

const femurLength = .41, tibiaLength = .48;
const toeBack = .071, toeHeight = .088;
const crawlerShadow = (() => {
  const pixels = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const radius = Math.hypot((x - 15.5) / 15.5, (y - 15.5) / 15.5);
    pixels[(y * 32 + x) * 4 + 3] = 121 * Math.max(0, 1 - radius * radius) ** 2;
  }
  const map = new T.DataTexture(pixels, 32, 32);
  map.magFilter = map.minFilter = T.LinearFilter; map.needsUpdate = true;
  return new T.MeshBasicMaterial({ map, transparent: true, depthWrite: false });
})();
const shadowPlate = new T.PlaneGeometry(1.42, 1.21);

let crawlerParts: ReturnType<typeof crawlerGeometry> | undefined;
function crawlerGeometry() {
  // Broader at the rear lip, with a raised spine and rolled-over margins.
  const armor = orb.clone(), positions = armor.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const taper = .96 - .18 * y;
    const keel = Math.max(0, z) * (1 - Math.abs(x)) ** 3 * .09;
    positions.setXYZ(i, x * .375 * taper, y * .43 - .07, .14 + z * .19 + keel);
  }
  armor.computeVertexNormals();
  const plates: T.BufferGeometry[] = [armor];
  for (const side of [-1, 1]) {
    plates.push(oval(side * .30, -.10, .1, .12, .28, .14),
      link([side * .32, -.15, .18], [side * .48, -.34, .26], .052));
  }
  const legs = {
    femur: merge([
      link([0, 0, 0], [0, femurLength, 0], .065),
      oval(0, femurLength, 0, .043, .057, .046),
    ]),
    tibia: merge([
      link([0, 0, 0], [0, tibiaLength, 0], .043),
      link([0, .13, 0], [.047, .20, .05], .024),
    ]),
    foot: link([0, 0, 0], [0, Math.hypot(toeBack, toeHeight), 0], .025),
  };
  const head: T.BufferGeometry[] = [oval(0, .21, .17, .34, .26, .23)], eyes: T.BufferGeometry[] = [], jaws: T.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    eyes.push(oval(side * .25, .31, .32, .075, .10, .07));
    head.push(link([side * .16, .37, .19], [side * .40, .64, .24], .029),
      link([side * .40, .64, .24], [side * .45, .85, .17], .018));
    jaws.push(link([side * .18, .36, .08], [side * .24, .58, .13], .073),
      link([side * .24, .58, .13], [side * .07, .67, .14], .044));
  }
  return { shell: merge(plates), joint: oval(0, .13, .07, .28, .40, .17),
    ridge: oval(0, -.25, .34, .27, .028, .036), legs, head: merge(head), eyes: merge(eyes), jaws: merge(jaws),
    stump: oval(0, .29, .16, .26, .08, .19) };
}

export function createCentipedeSection() {
  const g = crawlerParts ??= crawlerGeometry(), root = new T.Group(); root.name = 'centipede-section';
  mesh(root, g.joint, joint, 'flexible-joint'); mesh(root, g.shell, shell, 'overlapping-tergite');
  mesh(root, g.ridge, rim, 'tergite-ridge');
  const shadow = mesh(root, shadowPlate, crawlerShadow, 'ground-contact-shadow');
  shadow.position.z = -CENTIPEDE_BODY_HEIGHT + .007;
  const legs = [-1, 1].map(side => {
    const hip = new T.Group(), knee = new T.Group(), ankle = new T.Group();
    const socket = new T.Vector3(side * .26, -.05, .053);
    hip.name = 'walking-leg'; knee.name = 'walking-knee'; ankle.name = 'walking-ankle';
    mesh(hip, g.legs.femur, shell, 'femur');
    mesh(knee, g.legs.tibia, joint, 'tibia');
    mesh(ankle, g.legs.foot, joint, 'tarsus');
    root.add(hip, knee, ankle);
    return { side, socket, hip, knee, ankle };
  });
  const toe = new T.Vector3(), heel = new T.Vector3(), kneePoint = new T.Vector3();
  const axis = new T.Vector3(), bend = new T.Vector3(), direction = new T.Vector3();
  function poseLink(group: T.Group, from: T.Vector3, to: T.Vector3) {
    group.position.copy(from);
    group.quaternion.setFromUnitVectors(up, direction.subVectors(to, from).normalize());
  }
  const head = new T.Group(); head.name = 'original-head'; root.add(head);
  mesh(head, g.head, shell, 'head-and-antennae'); mesh(head, g.eyes, eye, 'head-eyes'); mesh(head, g.jaws, joint, 'mandibles');
  const muzzle = mesh(head, orb, chargeLight, 'centipede-charge');
  muzzle.position.set(0, TITAN_CENTIPEDE_MUZZLE, .28); muzzle.visible = false;
  const stump = mesh(root, g.stump, wound, 'severed-joint');
  return { root, prime() { head.visible = stump.visible = muzzle.visible = true; muzzle.scale.setScalar(.12); },
    pose(time: number, slot: number, originalHead: boolean, escaping: boolean, charge = 0, gait?: CentipedeGait) {
      head.visible = originalHead; stump.visible = slot === 0 && !originalHead;
      muzzle.visible = !escaping && charge > 0;
      muzzle.scale.setScalar(.045 + charge * .135);
      for (const [index, { side, socket, hip, knee, ankle }] of legs.entries()) {
        if (gait) toe.copy(centipedeFoot(gait, index, -root.rotation.z));
        else toe.set(side * .69, -.13, -CENTIPEDE_BODY_HEIGHT);
        heel.copy(toe); heel.y += toeBack; heel.z += toeHeight;
        axis.subVectors(heel, socket);
        const length = axis.length();
        axis.divideScalar(length);
        const reach = Math.min(length, femurLength + tibiaLength - .001);
        if (reach < length) {
          heel.copy(socket).addScaledVector(axis, reach);
          toe.copy(heel); toe.y -= toeBack; toe.z -= toeHeight;
        }
        const along = (femurLength ** 2 - tibiaLength ** 2 + reach ** 2) / (2 * reach);
        bend.set(side * .63, .08, .84);
        bend.addScaledVector(axis, -bend.dot(axis)).normalize();
        kneePoint.copy(socket).addScaledVector(axis, along)
          .addScaledVector(bend, Math.sqrt(Math.max(0, femurLength ** 2 - along ** 2)));
        poseLink(hip, socket, kneePoint);
        poseLink(knee, kneePoint, heel);
        poseLink(ankle, heel, toe);
      }
      head.rotation.z = Math.sin(time * 5) * .035;
    } };
}
