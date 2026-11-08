import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyRelief, texturedSurface } from './encounter-surfaces';
import { part, pivot } from './rig-geometry';
import { flyerStroke, type FlyerCourse } from './preserve-flyer';

// Narrow asymmetric vanes, raised shafts and overlapping coverts give the four
// fans a readable silhouette even without the optional reviewed feather map.
function feather(length: number, width: number, seed: number) {
  const p: number[] = [], uv: number[] = [], color: number[] = [], index: number[] = [];
  const base = new T.Color(0x36524d), edge = new T.Color(0x8ca89a), tint = new T.Color();
  for (let row = 0; row <= 9; row++) for (let j = 0; j < 5; j++) {
    const t = row / 9, x = (j - 2) / 2, arch = Math.sin(Math.PI * t);
    const w = width * (.018 + .5 * arch ** .65) * (x < 0 ? .72 : 1);
    p.push(x * w + .035 * t * t, length * t, width * arch * (.18 * (1 - x * x) - .08 * x));
    uv.push(j / 4, t);
    tint.copy(base).lerp(edge, T.MathUtils.smoothstep(t, .72 + seed * .035, .96) * .72);
    tint.multiplyScalar(.86 + .13 * Math.cos(seed * 9) + .16 * (1 - x * x));
    color.push(tint.r, tint.g, tint.b);
    if (row < 9 && j < 4) { const a = row * 5 + j; index.push(a, a + 1, a + 5, a + 1, a + 6, a + 5); }
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
  const pieces: T.BufferGeometry[] = [];
  for (let row = 0; row < 6; row++) for (let side = -1; side <= 1; side++) {
    const g = feather(.23 + .035 * Math.sin(row * 7 + side), .105, row * 3 + side);
    g.rotateZ(-side * .25); g.translate(side * (.09 + row * .009), -.4 + row * .125, .21 - Math.abs(side) * .05);
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
  const skin = texturedSurface(new T.MeshStandardMaterial({ color: 0x6f7160, roughness: .8, bumpScale: .045 }), .49, 2.4);
  const breast = texturedSurface(new T.MeshStandardMaterial({ color: 0x626f60, roughness: .86, bumpScale:.035 }), .5, 1.4);
  const eye = new T.MeshStandardMaterial({ color: 0xdb9e43, roughness: .27 });
  const dark = new T.MeshStandardMaterial({ color: 0x131d1c, roughness: .65 });
  const ivory = new T.MeshStandardMaterial({ color: 0xb6b99d, roughness: .7 });
  const orb = new T.SphereGeometry(1, 20, 12);
  const tailSkin = new T.TubeGeometry(new T.CatmullRomCurve3([
    new T.Vector3(0, 0, 0), new T.Vector3(0, .4, .025), new T.Vector3(.015, .82, .035), new T.Vector3(0, 1.1, .045),
  ]), 18, .045, 7, false);
  const tailPosition=tailSkin.getAttribute('position');
  for(let i=0;i<tailPosition.count;i++){
    const t=Math.floor(i/8)/18,f=1-t*.8;
    tailPosition.setX(i,tailPosition.getX(i)*f);
    tailPosition.setZ(i,.04*t+(tailPosition.getZ(i)-.04*t)*f);
  }
  tailSkin.computeVertexNormals();
  const fanPieces: T.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const g = feather(.44 + .07 * (1 - Math.abs(i - 3) / 3), .105, i);
    g.rotateZ((i - 3) * .09); g.translate((i - 3) * .025, .83, .04 + i * .002); fanPieces.push(g);
  }
  const tailFan = mergeGeometries(fanPieces); fanPieces.forEach(g => g.dispose());
  return { plumage, skin, breast, eye, dark, ivory, orb, tailSkin, tailFan, template: undefined as T.Group | undefined,
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
  oval(animal, 'feathered-ribcage', a.breast, 0, .02, .02, .225, .39, .2);
  part(animal, a.mantle, a.plumage, 0, 0, 0).name = 'mantle-feathers';
  oval(animal, 'neck', a.breast, 0, -.36, .09, .14, .26, .13);
  const head = pivot(animal, 'microraptor-head', 0, -.53, .09);
  part(head,a.crown,a.plumage,0,0,0).name='head-feathers';
  oval(head, 'skull', a.skin, 0, -.06, .055, .145, .2, .125);
  oval(head, 'toothed-dinosaur-snout', a.skin, 0, -.24, .025, .096, .19, .072);
  oval(head, 'lower-jaw', a.breast, 0, -.22, -.035, .086, .19, .028);
  for (const side of [-1, 1]) {
    oval(head, 'orbital-brow', a.breast, side * .112, -.09, .095, .049, .084, .06);
    oval(head, 'amber-eye', a.eye, side * .137, -.12, .097, .025, .041, .028);
    oval(head, 'eye-pupil', a.dark, side * .148, -.13, .112, .012, .025, .017);
    oval(head, 'side-nostril', a.dark, side * .075, -.32, .055, .012, .023, .011);
    for (let i = 0; i < 4; i++) {
      const tooth = part(head, a.tooth, a.ivory, side * (.07 - i * .005), -.18 - i * .045, -.026);
      tooth.rotation.x = -Math.PI / 2; tooth.scale.y = .65;
    }
  }
  for (const side of [-1, 1]) {
    const fore = pivot(animal, side < 0 ? 'forewing-left' : 'forewing-right', side * .17, -.17, .07);
    const fan = part(fore, a.foreFan, a.plumage, 0, 0, 0); fan.scale.x = side;
    oval(fore, 'feathered-upper-arm', a.breast, side * .23, .015, 0, .29, .07, .065).rotation.z = side * .1;
    const hind = pivot(animal, side < 0 ? 'hindwing-left' : 'hindwing-right', side * .14, .3, -.04);
    const legFan = part(hind, a.hindFan, a.plumage, 0, 0, 0); legFan.scale.x = side;
    oval(hind, 'feathered-hindleg', a.breast, side * .15, .12, -.015, .17, .085, .07);
    for (let toe = 0; toe < 3; toe++) {
      const claw = part(hind, a.tooth, a.ivory, side * (.31 + toe * .025), .26 - toe * .025, -.06);
      claw.rotation.x = Math.PI / 2; claw.scale.set(.8, 1.4, .8);
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
