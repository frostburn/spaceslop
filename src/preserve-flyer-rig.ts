import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyRelief, texturedSurface } from './encounter-surfaces';
import { part, pivot } from './rig-geometry';
import { flyerStroke, type FlyerCourse } from './preserve-flyer';
import { flyerLoft, flyerSkinTube, flyerSkinPoint, flyerTorsoProfile, flyerSkullProfile, FLYER_EYE } from './preserve-flyer-geometry';
import { preserveRandom } from './preserve-layout';

// Narrow asymmetric vanes, raised shafts and overlapping coverts give the four
// fans a readable silhouette even without the optional reviewed feather map.
function feather(length: number, width: number, seed: number) {
  const rows=6;
  const p: number[] = [], uv: number[] = [], color: number[] = [], index: number[] = [];
  const base = new T.Color(0x36524d), edge = new T.Color(0x8ca89a), tint = new T.Color();
  for (let row = 0; row <= rows; row++) for (let j = 0; j < 5; j++) {
    const t = row / rows, x = (j - 2) / 2, arch = Math.sin(Math.PI * t);
    const w = width * (.018 + .5 * arch ** .65) * (x < 0 ? .72 : 1);
    p.push(x * w + .035 * t * t, length * t, width * arch * (.18 * (1 - x * x) - .08 * x));
    uv.push(j / 4, t);
    tint.copy(base).lerp(edge, T.MathUtils.smoothstep(t, .72 + seed * .035, .96) * .72);
    tint.multiplyScalar(.86 + .13 * Math.cos(seed * 9) + .16 * (1 - x * x));
    color.push(tint.r, tint.g, tint.b);
    if (row < rows && j < 4) { const a = row * 5 + j; index.push(a, a + 1, a + 5, a + 1, a + 6, a + 5); }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(p.map(() => 0), 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new T.Float32BufferAttribute(color, 3));
  g.setIndex(index); g.computeVertexNormals(); return g;
}
function fan(hind: boolean) {
  const pieces: T.BufferGeometry[] = [];
  for (let row = 0; row < 2; row++) for (let i = 0; i < (row ? 9 : 12); i++) {
    const u = i / (row ? 8 : 11), x = .04 + u * (hind ? .5 : .93);
    const g = feather((row ? .25 : .62) * (1 - u * .26) * (hind ? .83 : 1), row ? .12 : .14, i + row * 17);
    g.rotateZ(-.3 - u * (hind ? .35 : .68));
    g.translate(x, u * (hind ? .16 : .22) - row * .035, row * .036 + .015 * Math.sin(i * 2)); pieces.push(g);
  }
  const g = mergeGeometries(pieces); pieces.forEach(p => p.dispose()); return g;
}
function bodyPlumage() {
  const pieces: T.BufferGeometry[] = [],random=preserveRandom(571),matrix=new T.Matrix4();
  for (let i=0;i<54;i++) {
    const y=.50-i/53*.99+(random()-.5)*.025,a=((i*2.399963)%(Math.PI*2))/(Math.PI*2)*3.5-1.75;
    const p=flyerSkinPoint(flyerTorsoProfile,y,a),along=flyerSkinPoint(flyerTorsoProfile,y-.001,a).sub(flyerSkinPoint(flyerTorsoProfile,y+.001,a));
    const normal=along.cross(flyerSkinPoint(flyerTorsoProfile,y,a+.001).sub(flyerSkinPoint(flyerTorsoProfile,y,a-.001))).normalize();
    const shaft=new T.Vector3(0,1,0).addScaledVector(normal,-normal.y).normalize(),across=shaft.clone().cross(normal).normalize();
    const g = feather(.14+random()*.065,.065+random()*.022,i);
    matrix.makeBasis(across,shaft,normal);matrix.setPosition(p.addScaledVector(normal,.006));g.applyMatrix4(matrix);
    pieces.push(g);
  }
  const g = mergeGeometries(pieces); pieces.forEach(p => p.dispose()); return g;
}
function headPlumage() {
  const pieces: T.BufferGeometry[] = [];
  for (let row = 0; row < 3; row++) for (let side = -1; side <= 1; side++) {
    const g = feather(.14, .078, row * 3 + side); g.rotateZ(-side * .3);
    g.translate(side * .073, -.13 + row * .075, .17 - Math.abs(side) * .027); pieces.push(g);
  }
  const g = mergeGeometries(pieces); pieces.forEach(p => p.dispose()); return g;
}
function batchFixed(group: T.Group) {
  for (const child of group.children) if (child instanceof T.Group) batchFixed(child);
  const buckets = new Map<T.Material, T.Mesh[]>();
  for (const child of group.children) if (child instanceof T.Mesh && !child.castShadow && !Array.isArray(child.material)) {
    const meshes = buckets.get(child.material) ?? []; meshes.push(child); buckets.set(child.material, meshes);
  }
  for (const [material, meshes] of buckets) {
    if (meshes.length < 2) continue;
    const copies = meshes.map(m => { m.updateMatrix(); return m.geometry.clone().applyMatrix4(m.matrix); });
    const g = mergeGeometries(copies); copies.forEach(c => c.dispose());
    const merged = new T.Mesh(g, material); merged.receiveShadow = true;
    merged.name = meshes.find(m => m.name === 'toothed-dinosaur-snout')?.name ?? 'batched-microraptor-anatomy';
    group.remove(...meshes); group.add(merged);
  }
}
export function createFlyerAssets() {
  const plumage = texturedSurface(new T.MeshPhysicalMaterial({ vertexColors: true, side: T.DoubleSide,
    roughness: .5, metalness: .12, iridescence: .62, iridescenceIOR: 1.32, iridescenceThicknessMinimum: 160, iridescenceThicknessMaximum: 340, bumpScale: .055 }), .5, 2.2);
  const skin = texturedSurface(new T.MeshStandardMaterial({ vertexColors:true, roughness: .8, bumpScale: .045 }), .49, 2.4);
  const breast = texturedSurface(new T.MeshStandardMaterial({ vertexColors:true, roughness: .86, bumpScale:.035 }), .5, 1.4);
  const eye = new T.MeshStandardMaterial({ color: 0xdb9e43, roughness: .27 });
  const dark = new T.MeshStandardMaterial({ color: 0x131d1c, roughness: .65 });
  const ivory = new T.MeshStandardMaterial({ color: 0xb6b99d, roughness: .7 });
  const orb = new T.SphereGeometry(1, 16, 10);
  const tailSkin = flyerSkinTube([[0,0,0],[0,.33,.025],[.015,.72,.035],[0,1.1,.045]],[.092,.062,.032,.009]);
  const fanPieces: T.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const g = feather(.44 + .07 * (1 - Math.abs(i - 3) / 3), .105, i);
    g.rotateZ((i - 3) * .09); g.translate((i - 3) * .025, .83, .04 + i * .002); fanPieces.push(g);
  }
  const tailFan = mergeGeometries(fanPieces); fanPieces.forEach(g => g.dispose());
  return { plumage, skin, breast, eye, dark, ivory, orb, tailSkin, tailFan, template: undefined as T.Group | undefined,
    torso:flyerLoft(flyerTorsoProfile),skull:flyerLoft(flyerSkullProfile,56,40,true),
    jaw:flyerLoft([[.12,.08,-.082,-.06],[-.06,.12,-.098,-.074],[-.24,.08,-.084,-.064],[-.38,.058,-.065,-.044],[-.44,.009,-.025,-.015]],28,24),
    foreSkin:flyerSkinTube([[0,0,0],[.27,-.035,.008],[.56,.04,.01],[.88,.18,.01]],[.072,.061,.038,.012]),
    hindSkin:flyerSkinTube([[0,0,0],[.15,.08,-.025],[.22,.16,-.075],[.36,.25,-.055]],[.074,.059,.031,.012]),
    hook:flyerSkinTube([[0,0,0],[0,.038,-.008],[.004,.068,-.032],[.006,.075,-.052]],[.012,.010,.006,.0008],10,6),
    foreFan: fan(false), hindFan: fan(true), mantle: bodyPlumage(), crown: headPlumage(), tooth: new T.ConeGeometry(.014, .055, 5),
    setFeathers: (texture: T.Texture) => applyRelief(texture, [plumage,breast]),
    setScales: (texture: T.Texture) => applyRelief(texture, [skin]) };
}
export function createPreserveFlyer(a: ReturnType<typeof createFlyerAssets>) {
  if(a.template)return animateFlyer(a.template.clone(true));
  const root = new T.Group(); root.name = 'microraptor';
  const animal = pivot(root, 'microraptor-bank', 0, 0, 0);
  function oval(parent: T.Object3D, name: string, material: T.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number) {
    const m = part(parent, a.orb, material, x, y, z); m.name = name; m.scale.set(sx, sy, sz); return m;
  }
  part(animal,a.torso,a.breast,0,0,0).name='feathered-ribcage';
  part(animal, a.mantle, a.plumage, 0, 0, 0).name = 'mantle-feathers';
  const head = pivot(animal, 'microraptor-head', 0, -.53, .09);
  part(head,a.crown,a.plumage,0,0,0).name='head-feathers';
  part(head,a.skull,a.skin,0,0,0).name='toothed-dinosaur-snout';
  part(head,a.jaw,a.skin,0,0,0).name='lower-jaw';
  for (const side of [-1, 1]) {
    const socket=pivot(head,`recessed-eye-${side}`,side*FLYER_EYE.x,FLYER_EYE.y,FLYER_EYE.z);
    socket.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),new T.Vector3(side*.65,-.5,.27).normalize());
    oval(socket,'amber-eye',a.eye,0,0,0,.023,.031,.018);
    oval(socket,'eye-pupil',a.dark,0,-.005,.014,.010,.017,.005);
    for (let i = 0; i < 4; i++) {
      const y=-.15-i*.045,p=flyerSkinPoint(flyerSkullProfile,y,side*(Math.PI-Math.asin(.65)),true);
      const tooth = part(head, a.tooth, a.ivory, p.x, y, p.z-.006);
      tooth.rotation.x = -Math.PI / 2; tooth.scale.set(.65,.36,.65);
    }
  }
  for (const side of [-1, 1]) {
    const fore = pivot(animal, side < 0 ? 'forewing-left' : 'forewing-right', side * .17, -.17, .07);
    const fan = part(fore, a.foreFan, a.plumage, 0, 0, 0); fan.scale.x = side;
    part(fore,a.foreSkin,a.breast,0,0,0).scale.x=side;
    const hind = pivot(animal, side < 0 ? 'hindwing-left' : 'hindwing-right', side * .14, .3, -.04);
    const legFan = part(hind, a.hindFan, a.plumage, 0, 0, 0); legFan.scale.x = side;
    part(hind,a.hindSkin,a.breast,0,0,0).scale.x=side;
    for (let toe = 0; toe < 3; toe++) {
      const claw = part(hind, a.hook, a.ivory, side * (.31 + toe * .025), .26 - toe * .025, -.06);
      claw.rotation.z=-side*(toe-1)*.18;
      part(fore,a.hook,a.ivory,side*(.58+toe*.035),.085+toe*.02,-.005).rotation.z=-side*.45;
    }
  }
  const tail = pivot(animal, 'long-bony-tail', 0, .34, .015);
  part(tail, a.tailSkin, a.breast, 0, 0, 0);
  part(tail, a.tailFan, a.plumage, 0, 0, 0).name = 'narrow-tail-fan';
  // Only the broad body casts a shadow: tiny vane shadows shimmer at game scale.
  animal.traverse(o => { if (o instanceof T.Mesh) o.receiveShadow = true; });
  animal.getObjectByName('feathered-ribcage')!.castShadow = true;
  batchFixed(animal);a.template=root;
  return animateFlyer(root);
}
function animateFlyer(root:T.Group){
  const animal=root.getObjectByName('microraptor-bank')!,head=root.getObjectByName('microraptor-head')!,tail=root.getObjectByName('long-bony-tail')!;
  const wings=[-1,1].map(side=>({side,fore:root.getObjectByName(side<0?'forewing-left':'forewing-right')!,hind:root.getObjectByName(side<0?'hindwing-left':'hindwing-right')!}));
  return { root,
    prime(active:boolean){root.traverse(o=>{if(o instanceof T.Mesh)o.frustumCulled=!active;});},
    pose(age: number, course: FlyerCourse, bank: number, heading = 0) {
      const p = flyerStroke(age, course);
      root.rotation.z = heading; animal.rotation.y = bank;
      head.rotation.x = -.09 - p.tuck * .3;
      for (const { side, fore, hind } of wings) {
        fore.rotation.y = -side * (.08 + p.stroke); fore.rotation.z = side * p.tuck;
        hind.rotation.y = -side * (.12 + p.stroke * .3); hind.rotation.z = side * (p.tuck * .52 + .05);
      }
      tail.rotation.z = p.tail - bank * .18; tail.rotation.x = -.04 + p.stroke * .09;
      return p;
    } };
}
