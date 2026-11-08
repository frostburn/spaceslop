import * as T from 'three';
import { preserveBatch, preserveBeam, preservePart, type PreservePart } from './preserve-geometry';
import { PRESERVE_BAY, PRESERVE_DECK, PRESERVE_END, PRESERVE_START, preserveGround, preserveRandom, preserveHabitat } from './preserve-layout';
import type { PreserveMaterials } from './preserve-materials';

export function createPreserveStation(materials: PreserveMaterials) {
  const root = new T.Group(); root.name = 'orbital-preserve-structure';
  const box = new T.BoxGeometry(), glass = new T.BoxGeometry();
  for (let y = PRESERVE_START; y < PRESERVE_END; y += PRESERVE_BAY) {
    const parts: PreservePart[] = [], lights: PreservePart[] = [], windows: PreservePart[] = [], tubes: PreservePart[] = [], halos: PreservePart[] = [];
    const random = preserveRandom(4000 + y), bay = (y - PRESERVE_START) / PRESERVE_BAY;
    const block = (x: number, dy: number, z: number, sx: number, sy: number, sz: number, color: number, angle = 0) =>
      parts.push(preservePart(x, y + dy, z, sx, sy, sz, color, angle));
    const beam = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, w: number, d: number, color: number) =>
      parts.push(preserveBeam(new T.Vector3(ax, y + ay, az), new T.Vector3(bx, y + by, bz), w, d, color));
    for (const side of [-1, 1]) {
      // Ceiling-edge luminaires hang outside the clear flight aperture. Inner
      // UV strips give a hot-pink edge; white paired tubes supply the grow light.
      for (const dy of [2, 6]) {
        block(side * 3.88, dy, .18, .27, 2.85, .12, 0x59656c);
        for (const x of [3.84, 3.94]) tubes.push(preservePart(side * x, y + dy, .26, .045, 2.55, .045, 0xeaffff));
        tubes.push(preservePart(side * 3.73, y + dy, .25, .045, 2.65, .035, 0xff219e));
        halos.push(preservePart(side * 3.73, y + dy, .245, .22, 2.75, .012, 0xffffff));
        for (const end of [-1.35, 1.35]) block(side * 3.88, dy + end, .27, .28, .10, .12, 0x73838c);
      }
      // Separate soil-retaining wall, grated service walk and external hull.
      block(side * 3.58, 4, -4.6, .16, 8, 3.12, 0x5b5744);
      block(side * 3.58, 4, -3.00, .2, 8, .12, 0x999078);
      for (const x of [3.66, 4.46, 4.8]) block(side * x, 4, PRESERVE_DECK - .13, .12, 8, .22, 0x807d6b);
      block(side * 4.83, 4, -3.65, .24, 8, 1.2, 0x63665c);
      block(side * 4.99, 4, -3.52, .12, 8, .37, 0x858477);
      for (let i = 0; i < 4; i++) {
        const dy = i * 2 + 1;
        // Broken gratings expose genuine space below, rather than a dark plate.
        if ((i + bay + (side > 0 ? 2 : 0)) % 7 === 1) {
          beam(side * 3.68, dy - .9, -3.21, side * 4.4, dy + .15, -3.09, .09, .06, 0x67553f);
          continue;
        }
        for (let rung = 0; rung < 12; rung++) block(side * 4.04, dy - .91 + rung * .158, PRESERVE_DECK, .69, .045, .055, 0x939080);
        for (const x of [3.83, 4.08, 4.32]) block(side * x, dy, -3.08, .027, 1.87, .075, 0x464c43);
        block(side * 4.05, dy - .97, -3.05, .81, .085, .11, 0xaaa48d);
        // Railings, bracket gussets and small inset amber lamps.
        for (const x of [3.67, 4.43]) {
          block(side * x, dy, -2.82, .045, .055, .48, 0x9c8d68);
          block(side * x, dy, -2.59, .045, 1.84, .045, 0xa89974);
          block(side * x, dy, -2.78, .028, 1.84, .028, 0x786f57);
        }
        beam(side * 4.48, dy, -3.18, side * 4.84, dy, -3.8, .1, .12, 0x4c554d);
        block(side * 4.58, dy - .5, -3.07, .2, .38, .18, 0x2d3832);
        lights.push(preservePart(side * 4.58, y + dy - .5, -2.97, .085, .23, .018, 0xffffff));
        for (let stripe = 0; stripe < 3; stripe++) block(side * (3.8 + stripe * .17), dy - .97, -2.985, .08, .095, .02, 0xc2a15e, .4);
      }
      // Longitudinal service conduits sit beyond the rail, never in the lane.
      for (let i = 0; i < 3; i++) {
        block(side * (4.57 + i * .07), 4, -3.36, .045, 8, .055, i === 1 ? 0x827348 : 0x42534b);
        for (const dy of [.5, 4.5]) block(side * (4.57 + i * .07), dy, -3.35, .075, .09, .085, 0xa6a189);
      }
      // Incomplete greenhouse ribs turn outward and leave the center open.
      const ribY = 1.1 + (side > 0 ? 1.1 : 0);
      for (const dy of [ribY, ribY + 4.1]) {
        const a = new T.Vector3(side * 4.86, y + dy, -3.5), b = new T.Vector3(side * 4.75, y + dy, -.6);
        const c = new T.Vector3(side * 3.84, y + dy, .1), d = new T.Vector3(side * (bay % 3 === 1 ? 3.1 : 3.62), y + dy, .15);
        for (const [from, to] of [[a, b], [b, c], [c, d]]) {
          parts.push(preserveBeam(from, to, .12, .13, 0xa09e8b));
          const offset = new T.Vector3(0, .19, 0);
          parts.push(preserveBeam(from.clone().add(offset), to.clone().add(offset), .065, .08, 0x696f60));
        }
        beam(side * 4.86, dy - .38, -3.4, side * 4.72, dy + .04, -2.1, .1, .1, 0x666f60);
      }
      for (const x of [4.76, 4.3]) block(side * x, 4, x > 4.5 ? -.54 : -.18, .045, 8, .065, 0x7a8a7c);
      // A few individual panes survive; most of the roof is missing.
      if ((bay + side) % 3 !== 0) {
        const pane = preservePart(side * 4.42, y + 3.2, -.25, .62, 2.1, .018, 0x9fc6ad);
        pane.rotation.setFromAxisAngle(new T.Vector3(0, 1, 0), side * .64);
        windows.push(pane);
      }
      // A staggered lookout is supported from the hull, not floating over dirt.
      if ((bay % 2 === 0 ? -1 : 1) === side) {
        const py = 5.9;
        block(side * 3.03, py, -2.94, 1.03, 1.45, .16, 0x656e5b);
        for (let i = 0; i < 10; i++) block(side * 3.03, py - .65 + i * .14, -2.84, .96, .033, .035, 0xaaa18a);
        for (const dy of [py - .76, py + .76]) {
          beam(side * 2.54, dy, -3.0, side * 3.54, dy, -4.2, .09, .12, 0x747b67);
          block(side * 2.52, dy, -2.62, .045, .055, .56, 0xb3a17b);
          block(side * 3.01, dy, -2.35, 1.03, .045, .045, 0xa39773);
        }
        block(side * 2.52, py, -2.35, .045, 1.55, .045, 0x9e9273);
        block(side * 2.52, py, -2.59, .03, 1.55, .03, 0x7a8068);
      }
    }
    block(0, 4, -6.2, 7.2, 8, .3, 0x424e45);
    // Nursery curbs and irrigation headers make the maintained opening read
    // differently from the root-bound ravine and later rocky habitat.
    if (y >= 16 && y < 40) for (const side of [-1,1]) {
      for (const dy of [1.5,5.5]) {
        block(side*2.9,dy,-3.05,1.0,.12,.18,0x989274);
        block(side*2.4,dy+1.2,-3.15,.1,2.4,.3,0x737b61);
      }
      block(side*3.43,4,-2.85,.06,8,.07,0x8b9b7c);
      block(side*3.37,2,-2.78,.18,.22,.13,0xa59259);
    }
    // Buried, cracked paving interrupts the recess instead of a repeating flat path.
    for (let i = 0; i < (preserveHabitat(y+4).wet > .1 ? 0 : 4); i++) {
      const x = (random() - .5) * 2.3, dy = random() * 8, z = preserveGround(x, y + dy);
      block(x, dy, z - .03, .4 + random() * .6, .5 + random() * .7, .09, i % 3 === 0 ? 0x666855 : 0x7d7c65, (random() - .5) * .4);
    }
    const chunk = new T.Group(); chunk.name = 'preserve-station-bay';
    const structure = preserveBatch('station-metal', box, materials.metal, parts);
    structure.castShadow = false; // Avoid projecting the service grating's fine grid.
    chunk.add(structure);
    chunk.add(preserveBatch('station-lamps', box, materials.lamp, lights));
    for (const mesh of [preserveBatch('grow-light-tubes', box, materials.fluorescent, tubes), preserveBatch('uv-strip-halos', box, materials.uvGlow, halos)]) {
      mesh.castShadow = mesh.receiveShadow = false; chunk.add(mesh);
    }
    if (windows.length) {
      const panes = preserveBatch('broken-greenhouse-glass', glass, materials.glass, windows);
      panes.castShadow = false; chunk.add(panes);
    }
    root.add(chunk);
  }
  return root;
}
