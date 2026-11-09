import * as T from 'three';
import { heliostatBatch, type Point3 } from './heliostat-geometry';
import type { HeliostatMaterials } from './heliostat-materials';
import { addServiceMachinery, coolingCell, dockingCell, type HeliostatBayKind } from './heliostat-machinery';

export function createHeliostatBay(m: HeliostatMaterials,kind:HeliostatBayKind='generation') {
  const root = new T.Group(); root.name = 'modeled-corridor-bay';
  const b = heliostatBatch(root), casings = new T.Group(); root.add(casings);
  const shell = heliostatBatch(casings);
  for (const side of [-1, 1]) {
    const x = side * 6.2;
    b.box([4.6, 27, .5], [side * 6.7, 4, -3.65], m.dark, .06);
    b.box([4.4,1.2,.3],[side*6.7,18,-3.65],m.dark,.035);
    b.box([.24, 27, .24], [side * 4.3, 4, -3.3], m.titanium);
    for (let i = 0; i < 14; i++) {
      const y = -8 + i * 1.9;
      b.box([1.25, .12, .09], [side * 4.95, y, -3.32], m.titanium);
      b.rod([side * 4.08, y, -3.3], [side * 4.08, y, -2.28], .034, m.titanium);
      b.box([.18, .13, .06], [side * 4.12, y, -2.21], i % 4 ? m.cyan : m.amber);
    }
    b.rod([side * 4.08, -8, -2.28], [side * 4.08, 16.7, -2.28], .035, m.titanium);
    for (const y of [-2, 8]) {
      if(kind==='cooling'){coolingCell(b,shell,m,x,y);continue;}
      if(kind==='docking'&&y<0){dockingCell(b,shell,m,x,y);continue;}
      shell.box([3.2, 4.8, .3], [x, y, -2.85], m.titanium, .08);
      shell.box([.3, 4.8, 3.65], [x + side * 1.45, y, -.95], m.ceramic, .08);
      shell.box([2.7, .32, 3.65], [x, y - 2.2, -.95], m.ceramic, .07);
      shell.box([2.7, .32, 3.65], [x, y + 2.2, -.95], m.ceramic, .07);
      // A high shoulder and small roofs leave an actual inspection opening.
      shell.box([.65, 4.2, .22], [x + side * 1.05, y, 1.0], m.ceramic, .05);
      shell.box([2.4, .6, .22], [x, y - 1.7, 1.0], m.titanium, .03);
      shell.box([2.4, .6, .22], [x, y + 1.7, 1.0], m.titanium, .03);
      for (const face of [-1,1]) {
        const fy = y + face*2.39;
        b.box([2.3,.08,.13],[x,fy,.55],m.titanium);
        b.box([1.75,.08,.64],[x,fy,-1.7],m.graphite,.025);
        for(let v=0;v<5;v++)b.box([1.6,.11,.045],[x,fy+face*.025,-1.94+v*.115],m.titanium);
        b.box([.1,.09,.36],[x-side*.94,fy,-.35],m.cyan);
        for(const dx of[-1.05,1.05])for(const z of[-2.3,.4])
          b.rod([x+dx,fy-face*.04,z],[x+dx,fy+face*.06,z],.043,m.dark,6);
      }
      for (let c = 0; c < 2; c++) {
        const cx = x + (c - .5) * 1.14;
        b.rod([cx, y - 1.6, -.9], [cx, y + 1.6, -.9], .42, m.graphite, 16);
        for (let turn = 0; turn < 11; turn++) b.ring(.48, .052, [cx, y - 1.35 + turn * .27, -.9], m.copper);
        for (const end of [-1, 1]) b.rod([cx, y + end * 1.55, -.9], [cx, y + end * 1.75, -.9], .59, m.titanium, 14);
        b.rod([cx, y + 1.7, -.9], [cx, y + 1.7, .9], .12, m.copper);
        b.box([.32, .4, .12], [cx, y + 1.7, .95], m.cyan, .03);
      }
      for (let v = 0; v < 7; v++) b.box([.72, .13, .06], [x + side * 1.08, y - .9 + v * .3, 1.14], m.graphite);
      for (const yy of [-2.05, 2.05]) b.rod([x - side * 1.35, y + yy, -2.7], [x - side * 1.35, y + yy, 1.3], .09, m.titanium);
      b.box([.14, 3.8, .14], [x - side * 1.35, y, 1.3], m.titanium);
    }
    shell.box([2.9, 2.6, 1.65], [x, 3, -2.3], m.blue, .13);
    for (let p = 0; p < 2; p++) {
      const cx = x + (p - .5) * 1.2;
      b.rod([cx, 1.65, -2.1], [cx, 2.0, -2.1], .46, m.titanium, 16);
      b.ring(.29, .06, [cx, 1.6, -2.1], m.copper);
      b.rod([cx, 1.55, -2.1], [cx, 1.7, -2.1], .08, m.titanium);
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2;
        b.rod([cx, 1.6, -2.1], [cx + Math.cos(a) * .27, 1.6, -2.1 + Math.sin(a) * .27], .025, m.titanium, 6);
      }
      const inletY=kind==='cooling'?6.3:5.7,inletZ=kind==='cooling'?-1.65:-.9;
      b.pipe([[cx, 3.2, -1.45], [cx, 3.2, -.8], [cx, 4.1, -.6], [cx,inletY,inletZ]], .12, m.copper);
      b.rod([cx,inletY-.15,inletZ],[cx,inletY+.25,inletZ],.2,m.titanium,12);
      b.box([.6, .13, .28], [cx, 1.6, -1.7], m.cyan, .02);
    }
    for (let p = 0; p < 3; p++) {
      const cx = x + side * (1.75 + p * .25);
      b.rod([cx, -8.5, -2.8], [cx, 16.5, -2.8], .085, m.copper);
      b.pipe([[cx,16.5,-2.8],[cx,17.5,-2.6],[cx,18.5,-2.6],[cx,19.5,-2.8]],.085,m.copper);
      for (let j = 0; j < 9; j++) b.rod([cx, -8 + j * 3, -2.8], [cx, -7.88 + j * 3, -2.8], .13, m.titanium);
    }
    for (const y of [-1, 10]) {
      const tilt = side * .34;
      b.box([2.5, 6.4, .23], [side * 9.2, y, -1.55], m.titanium, .03, [0, tilt, 0]);
      for (let f = 0; f < 18; f++) b.box([2.3, .13, .55],
        [side * 9.2, y - 2.95 + f * .35, -1.32], m.graphite, 0, [0, tilt, 0]);
      for (const yy of [-2.9, 2.9]) b.rod([side * 7.8, y + yy, -3.5], [side * 10.2, y + yy, -1.2], .08, m.dark);
    }
    for (const y of [-6.5, 13]) {
      b.rod([side * 4.55, y, -3], [side * 4.55, y, 2.3], .075, m.titanium);
      shell.box([.32, .38, .8], [side * 4.55, y, 2.1], m.dark, .05);
      b.box([.18, .4, .5], [side * 4.55, y, 2.12], m.amber, .025);
    }
  }
  for (const y of [-8.7, 17.5]) {
    b.box([16.8, .35, .38], [0, y, -4], m.dark);
    for (let i = -8; i < 8; i++) b.rod([i, y, -4], [i + 1, y, -3.45], .045, m.titanium, 6);
  }
  shell.box([11.7, .7, .75], [0, 16.5, 4.7], m.dark, .08);
  for (const side of [-1, 1]) b.rod([side * 5.5, 16.5, -3.3], [side * 5.5, 16.5, 4.5], .15, m.titanium);
  for (let i = -5; i <= 5; i++) b.box([.42, .12, .12], [i, 16.1, 4.7], m.amber);
  b.finish(); shell.finish();
  casings.traverse(node => { if (node instanceof T.Mesh) node.castShadow = true; });
  addServiceMachinery(root,m,kind);
  return { root, casings };
}

export function createHeliostatBus(m: HeliostatMaterials) {
  const root = new T.Group(), b = heliostatBatch(root);
  root.name='electric-service-bus';
  for (const side of [-1, 1]) {
    const points: Point3[] = Array.from({ length: 23 }, (_, i) => [side * 4.38 + Math.sin(i * 3.7) * .06, -6 + i * .9, -1.6 + Math.sin(i * 7) * .08]);
    for (let i = 1; i < points.length; i++) b.rod(points[i - 1], points[i], .015, m.cyan, 5);
  }
  b.finish(); return root;
}
