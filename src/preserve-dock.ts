import * as T from 'three';
import { preserveBatch, preserveBeam, preservePart, type PreservePart } from './preserve-geometry';
import { PRESERVE_DOCK_Y } from './preserve-layout';
import type { PreserveMaterials } from './preserve-materials';

// An actual open aperture in the end of the habitat. No floor or backdrop
// extends into the approach; structural beams and navigation booms frame space.
export function createPreserveDock(m: PreserveMaterials) {
  const root = new T.Group(); root.name = 'preserve-spaceport'; root.position.y = PRESERVE_DOCK_Y;
  const parts: PreservePart[] = [], lamps: PreservePart[] = [], box = new T.BoxGeometry();
  const block = (x: number, y: number, z: number, sx: number, sy: number, sz: number, color: number) =>
    parts.push(preservePart(x, y, z, sx, sy, sz, color));
  const beam = (a: number[], b: number[], width: number, depth: number, color: number) =>
    parts.push(preserveBeam(new T.Vector3(a[0],a[1],a[2]), new T.Vector3(b[0],b[1],b[2]), width, depth, color));
  // Deep jambs, blast-door pockets, armored header and exposed lower girders.
  for (const side of [-1, 1]) {
    block(side * 4.25, .9, -2.15, 1.55, 4.7, 6.9, 0x7a7d73);
    block(side * 3.55, -.8, -1.8, .24, .5, 4.4, 0x3d4843);
    block(side * 3.74, -.95, -1.8, .14, .25, 4.7, 0xa6a08e);
    block(side * 4.27, -1.47, -1.7, .7, .18, 2.2, 0x454b42);
    for (let i = 0; i < 7; i++) {
      block(side * 4.4, -.9 + i * .63, 1.35, 1.2, .49, .16, i % 3 ? 0x8c8b79 : 0x5e6a61);
      for (const z of [-4.5, -3.6, -2.7, -1.8, -.9]) block(side * 4.95, -.4 + i * .55, z, .09, .3, .09, 0x3e4c46);
    }
    for (let j = 0; j < 5; j++) {
      block(side * 4.1, -1.58, -3.9 + j * .8, .68, .025, .16, 0xc6a258);
      block(side * (4.9 + j * .12), 2, -.2, .08, 2.7, .42, 0x343f3c);
    }
    // Approach beacons sit on separated booms with open space between them.
    beam([side * 4.3, -1, -4.2], [side * 3.35, -7, -3.8], .13, .15, 0x5b6f64);
    for (const y of [-3.3, -6.8]) {
      beam([side * 3.65, y, -3.8], [side * 3, y, -3.8], .09, .1, 0x868873);
      block(side * 3, y, -3.67, .27, .3, .2, 0x2c3933);
      lamps.push(preservePart(side * 3, y, -3.52, .14, .18, .1, side < 0 ? 0xe8ac47 : 0x6ce6ad));
    }
    for (const y of [-.5, 1.5, 3.5]) beam([side * 4, y, -5], [side * 5.2, y, -4.2], .18, .18, 0x687769);
  }
  block(0, -1.0, 1.45, 7.2, 1.15, .62, 0x92917e);
  block(0, -.92, 1.84, 6.9, 1.0, .15, 0x56665a);
  block(0, -1.61, 1.38, 6.3, .07, .26, 0xb9a16c);
  for (let x = -3; x <= 3; x += .5) block(x, -1.65, 1.38, .21, .025, .27, 0x41483c);
  for (const x of [-2, 0, 2]) lamps.push(preservePart(x, -1.16, 1.03, .54, .36, .055, 0xffd39b));
  // Inset armor patches, diagonal top markings, conduit clamps and bolt heads
  // remain legible from the near-top-down flight camera.
  for (let i=0;i<12;i++) {
    const x=-3.05+i*.55;
    const stripe=preservePart(x,-.93,1.927,.15,.7,.025,i%2?0x3b443b:0xc4aa66,.42);parts.push(stripe);
    for(const y of[-1.32,-.54])block(x,y,1.96,.065,.07,.035,0xb5b39b);
  }
  for(const side of[-1,1]) {
    for(const dy of[-.45,.8,2.05,3.3]) {
      block(side*4.03,dy,1.49,.7,.6,.08,dy<1?0x858b7b:0x576d63);
      for(const dx of[-.25,.25])block(side*4.03+dx,dy-.23,1.55,.065,.065,.04,0xb8b5a1);
    }
    for(const x of[3.83,4.12])block(side*x,1.5,1.6,.055,3.8,.07,0xa28d60);
    for(const y of[.2,1.5,2.8])block(side*3.98,y,1.65,.51,.09,.07,0x4e5b50);
  }
  // The entry sill is below the ship, and the central door stays fully open.
  block(0, -.55, -5.6, 7.1, 1.6, .55, 0x606f60);
  for (const x of [-2.9, -1.45, 0, 1.45, 2.9]) beam([x, -.8, -5.8], [x, 4.2, -6.1], .18, .22, 0x454f48);
  block(0, 3.0, -6.2, 7.2, 4, .35, 0x455249);
  // Small off-lane utility berth and parked maintenance tug.
  block(-5.35, 1.2, -3.2, 1.65, 2.3, .2, 0x747969);
  beam([-5.9, 1.1, -3.3], [-4.8, 1.1, -4.8], .14, .16, 0x6b7565);
  block(-5.4, 1.3, -2.83, .7, 1.1, .5, 0xb49a52);
  block(-5.4, 1.0, -2.5, .48, .5, .25, 0x406568);
  for (const x of [-5.87, -4.93]) block(x, 1.5, -2.9, .24, .95, .24, 0x555f58);
  root.add(preserveBatch('dock-armored-structure', box, m.metal, parts));
  const lampMaterial = m.lamp.clone(); lampMaterial.color.setHex(0xffffff);
  const beacons = preserveBatch('dock-navigation-lights', box, lampMaterial, lamps); beacons.castShadow = false; root.add(beacons);
  const fieldGeometry = new T.BufferGeometry().setFromPoints([
    new T.Vector3(-3.42, -.9, -5.1), new T.Vector3(-3.42, -.9, .98),
    new T.Vector3(-3.42, -.9, .98), new T.Vector3(3.42, -.9, .98),
    new T.Vector3(3.42, -.9, .98), new T.Vector3(3.42, -.9, -5.1),
  ]);
  const field = new T.LineSegments(fieldGeometry, new T.LineBasicMaterial({color:0x8ed9d1, transparent:true, opacity:.32})); root.add(field);
  return { root, update(time: number) { lampMaterial.color.setScalar(.83 + .17 * Math.sin(time * 2.1) ** 2); } };
}
