import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { addTitanSetae, titanChitin } from './titan-insect-surfaces';

// Small patrol models share all GPU resources; each pool entry owns only its pivots.
const scoutShell = titanChitin(0x7f9690, .74); scoutShell.vertexColors = true;
const scoutRim = titanChitin(0xa9b3a0, .7);
const scoutJoint = new T.MeshStandardMaterial({ color: 0x234147, roughness: .8 });
const scoutEye = new T.MeshStandardMaterial({ color: 0xe2a94e, roughness: .24, metalness: .2 });
const shell = titanChitin(0xb74c44, .57);
const rim = titanChitin(0xebb16c, .7);
const joint = new T.MeshStandardMaterial({ color: 0x38212b, roughness: .83 });
const eye = new T.MeshStandardMaterial({ color: 0x93dccc, emissive: 0x2d746b, emissiveIntensity: .3, roughness: .24, metalness: .3 });
const wound = new T.MeshStandardMaterial({ color: 0x553923, roughness: .88 });
const membrane = new T.MeshPhysicalMaterial({ color: 0xb5c4b6, transparent: true, opacity: .38,
  roughness: .28, metalness: .08, clearcoat: .7, side: T.DoubleSide, depthWrite: false });
const vein = new T.LineBasicMaterial({ color: 0xc0c9b4, transparent: true, opacity: .8, depthWrite: false });
const orb = new T.SphereGeometry(1, 16, 10);
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
  const body = [oval(0, 0, .08, .29, .44, .23), oval(0, .41, .15, .37, .22, .22)];
  const ribs: T.BufferGeometry[] = [], legs: T.BufferGeometry[] = [], eyes: T.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) body.push(oval(0, -.39 - i * .105, .04, .24 - i * .031, .13, .17 - i * .018));
  for (let i = 0; i < 4; i++) ribs.push(oval(0, -.31 - i * .12, .17, .22 - i * .03, .023, .075));
  for (const side of [-1, 1]) {
    eyes.push(oval(side * .31, .46, .24, .12, .14, .11));
    legs.push(link([side * .16, .5, .1], [side * .43, .73, .12], .018));
    for (let i = 0; i < 3; i++) {
      const y = .19 - i * .18;
      legs.push(link([side * .2, y, .0], [side * .49, y - .14, -.08], .04),
        link([side * .49, y - .14, -.08], [side * .60, y - .45, -.02], .023));
    }
  }
  // Every vein point is inside the simple convex wing outline.
  const shape = new T.Shape(); shape.moveTo(0, 0);
  shape.bezierCurveTo(.35, .24, .98, -.10, 1.08, -.86);
  shape.bezierCurveTo(.99, -1.07, .40, -.90, 0, -.12); shape.closePath();
  const wing = new T.ShapeGeometry(shape, 16), lines: number[] = [];
  for (const [x, y] of [[.39, -.12], [.66, -.33], [.87, -.57], [.98, -.83], [.75, -.85], [.48, -.66]])
    lines.push(.025, -.06, .006, x, y, .006);
  lines.push(.39, -.12, .006, .48, -.66, .006, .66, -.33, .006, .75, -.85, .006,
    .87, -.57, .006, .98, -.83, .006);
  const veins = new T.BufferGeometry(); veins.setAttribute('position', new T.Float32BufferAttribute(lines, 3));
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
  return { body: carapace, ribs: merge(ribs), legs: merge(legs), eyes: merge(eyes), wing, veins };
}

export function createCicadaScout() {
  const g = scoutParts ??= scoutGeometry(), root = new T.Group(); root.name = 'cicada-scout';
  mesh(root, g.body, scoutShell, 'scout-carapace'); mesh(root, g.ribs, scoutRim, 'abdomen-ribs');
  mesh(root, g.eyes, scoutEye, 'compound-eyes'); const feet = mesh(root, g.legs, scoutJoint, 'folded-legs');
  addTitanSetae(root, 0, -.08, .32, .57, .76, 0);
  for (const side of [-1, 1]) addTitanSetae(root, side * .24, .31, .32, .30, .32, 0);
  const wings: { pivot: T.Group; side: number; rear: boolean }[] = [];
  for (const side of [-1, 1]) for (const rear of [true, false]) {
    const pivot = new T.Group(); pivot.name = `patrol-${rear ? 'hind' : 'fore'}wing-${side}`;
    pivot.position.set(side * .18, rear ? -.17 : .15, rear ? .32 : .34);
    const hinge = mesh(root, orb, scoutRim, 'dorsal-wing-hinge');
    hinge.position.copy(pivot.position).add(new T.Vector3(0, 0, -.035)); hinge.scale.set(.07, .10, .065);
    const blade = new T.Group(); blade.scale.set(side * (rear ? .73 : 1), rear ? .76 : 1, 1);
    blade.rotation.z = side * (rear ? -.15 : .05);
    mesh(blade, g.wing, membrane, 'wing-membrane'); blade.add(new T.LineSegments(g.veins, vein));
    pivot.add(blade); root.add(pivot); wings.push({ pivot, side, rear });
  }
  return { root, pose(time: number, bank = 0) {
    root.rotation.y = bank; feet.rotation.x = Math.sin(time * 9) * .12;
    for (const { pivot, side, rear } of wings) {
      // The full beat stays at or above the dorsal hinge, never beneath the shell.
      pivot.rotation.y = side * (-.16 + Math.sin(time * 48 + (rear ? .8 : 0)) * .14);
      pivot.rotation.z = side * Math.sin(time * 48) * .04;
    }
  } };
}

let crawlerParts: ReturnType<typeof crawlerGeometry> | undefined;
function crawlerGeometry() {
  const plates: T.BufferGeometry[] = [oval(0, -.07, .15, .36, .43, .24)];
  for (const side of [-1, 1]) {
    plates.push(oval(side * .30, -.10, .1, .12, .28, .14),
      link([side * .32, -.15, .18], [side * .48, -.34, .26], .052));
  }
  const legs = [-1, 1].map(side => merge([
    link([0, 0, 0], [side * .28, -.13, -.04], .064),
    link([side * .28, -.13, -.04], [side * .47, -.43, -.10], .043),
    link([side * .47, -.43, -.10], [side * .53, -.52, -.01], .025),
    link([side * .28, -.13, -.04], [side * .44, -.08, .03], .032),
  ]));
  const head: T.BufferGeometry[] = [oval(0, .21, .17, .34, .26, .23)], eyes: T.BufferGeometry[] = [], jaws: T.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    eyes.push(oval(side * .25, .31, .32, .075, .10, .07));
    head.push(link([side * .16, .37, .19], [side * .40, .64, .24], .029),
      link([side * .40, .64, .24], [side * .45, .85, .17], .018));
    jaws.push(link([side * .18, .36, .08], [side * .24, .58, .13], .073),
      link([side * .24, .58, .13], [side * .07, .67, .14], .044));
  }
  return { shell: merge(plates), joint: oval(0, .13, .07, .28, .40, .17),
    ridge: oval(0, -.20, .33, .25, .035, .052), legs, head: merge(head), eyes: merge(eyes), jaws: merge(jaws),
    stump: oval(0, .29, .16, .26, .08, .19) };
}

export function createCentipedeSection() {
  const g = crawlerParts ??= crawlerGeometry(), root = new T.Group(); root.name = 'centipede-section';
  mesh(root, g.joint, joint, 'flexible-joint'); mesh(root, g.shell, shell, 'overlapping-tergite');
  mesh(root, g.ridge, rim, 'tergite-ridge');
  const legs = g.legs.map((geometry, i) => {
    const pivot = new T.Group(); pivot.position.set(i === 0 ? -.28 : .28, -.05, .04);
    mesh(pivot, geometry, joint, 'walking-leg'); root.add(pivot); return pivot;
  });
  const head = new T.Group(); head.name = 'original-head'; root.add(head);
  mesh(head, g.head, shell, 'head-and-antennae'); mesh(head, g.eyes, eye, 'head-eyes'); mesh(head, g.jaws, joint, 'mandibles');
  const stump = mesh(root, g.stump, wound, 'severed-joint');
  return { root, prime() { head.visible = stump.visible = true; },
    pose(time: number, slot: number, originalHead: boolean, escaping: boolean) {
      head.visible = originalHead; stump.visible = slot === 0 && !originalHead;
      const gait = time * (escaping ? 22 : 14) - slot * .85;
      legs.forEach((leg, i) => {
        const phase = gait + i * Math.PI;
        leg.rotation.z = Math.sin(phase) * .30;
        leg.rotation.y = Math.cos(phase) * .22;
      });
      head.rotation.z = Math.sin(time * 5) * .035;
    } };
}
