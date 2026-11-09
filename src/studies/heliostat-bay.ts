import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { panelFace } from './heliostat-layout';

type Point = [number, number, number];

/** Collect static geometry once; artwork and proxy detail remain separate. */
function batch(root: T.Group) {
  const geometries = new Map<T.Material, T.BufferGeometry[]>();
  function add(geometry: T.BufferGeometry, material: T.Material, at: Point = [0, 0, 0]) {
    geometry.translate(...at);
    const list = geometries.get(material) ?? []; list.push(geometry); geometries.set(material, list);
  }
  return {
    add,
    box: (size: Point, at: Point, material: T.Material) => add(new T.BoxGeometry(...size), material, at),
    rod(a: Point, b: Point, radius: number, material: T.Material) {
      const start = new T.Vector3(...a), end = new T.Vector3(...b), delta = end.clone().sub(start);
      const g = new T.CylinderGeometry(radius, radius, delta.length(), 8);
      g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize()));
      add(g, material, start.add(end).multiplyScalar(.5).toArray() as Point);
    },
    finish() {
      for (const [material, list] of geometries) {
        const geometry = mergeGeometries(list);
        for (const source of list) source.dispose();
        if (!geometry) throw new Error('Incompatible corridor geometry');
        root.add(new T.Mesh(geometry, material));
      }
      geometries.clear();
    },
  };
}

export function createHeliostatBay() {
  const root = new T.Group(), proxy = new T.Group(), faces = new T.Group();
  root.name = 'corridor-bay'; proxy.name = 'procedural-panel-detail'; faces.name = 'rectified-art-faces';
  root.add(proxy, faces);
  const titanium = new T.MeshStandardMaterial({ color: 0x948b79, roughness: .8, metalness: .42 });
  const dark = new T.MeshStandardMaterial({ color: 0x202b2d, roughness: .87, metalness: .25 });
  const copper = new T.MeshStandardMaterial({ color: 0xa76839, roughness: .48, metalness: .65 });
  const black = new T.MeshStandardMaterial({ color: 0x101a20, roughness: .92 });
  const cyan = new T.MeshBasicMaterial({ color: new T.Color(.3, 1.25, 1.45) });
  const amber = new T.MeshBasicMaterial({ color: new T.Color(1.6, .56, .12) });
  // Rectified panels contain local recess AO, so broad external lighting belongs
  // to the actual frame; avoid double-lighting those painted recesses.
  const panels = new T.MeshBasicMaterial({ color: 0xc7c4ba });
  const structure = batch(root), fallback = batch(proxy), artwork = batch(faces);

  function module(at: Point, size: Point, tiles: Point) {
    const [w, d, h] = size;
    structure.box(size, at, dark);
    artwork.add(panelFace('front', w, d, h, tiles[0]), panels, at);
    const back = panelFace('front', w, d, h, tiles[0]); back.rotateZ(Math.PI);
    artwork.add(back, panels, at);
    for (const side of [-1, 1]) {
      const g = panelFace('side', w, d, h, tiles[1]);
      if (side < 0) g.rotateZ(Math.PI);
      artwork.add(g, panels, at);
    }
    artwork.add(panelFace('top', w, d, h, tiles[2]), panels, at);
    // Real corner posts and cap beams close the silhouette at every angle.
    for (const x of [-w / 2, w / 2]) for (const y of [-d / 2, d / 2])
      structure.box([.1, .1, h + .12], [at[0] + x, at[1] + y, at[2]], titanium);
    for (const z of [-h / 2, h / 2]) {
      for (const y of [-d / 2, d / 2]) structure.box([w + .18, .12, .12],
        [at[0], at[1] + y, at[2] + z], titanium);
      for (const x of [-w / 2, w / 2]) structure.box([.12, d, .12],
        [at[0] + x, at[1], at[2] + z], titanium);
      for (let i = 0; i < 7; i++) fallback.box([w * .76, d * .045, .035],
        [at[0], at[1] + (i - 3) * d * .11, at[2] + h / 2 + .025], black);
    }
    for (const y of [-1, 1]) {
      for (let i = 0; i < 13; i++) fallback.box([w * .82, .04, .045],
        [at[0], at[1] + y * (d / 2 + .02), at[2] + (i - 6) * h * .064], titanium);
      fallback.box([.13, .05, h * .62], [at[0], at[1] + y * (d / 2 + .045), at[2]], cyan);
    }
  }

  for (const side of [-1, 1]) {
    const x = side * 5.85;
    // A shallow tower, a lower radiator and a genuinely recessed pump well.
    module([x, 1.8, -.9], [2.6, 2.8, 4.6], [0, 1, 2]);
    module([side * 7.6, 6, -2.4], [2.1, 4.4, 2.8], [3, 1, 2]);
    module([x, 9, -2.5], [2.6, 2.5, 1.7], [4, 1, 2]);
    module([side * 5.5, -3.5, -3.05], [1.3, 3.3, 1.0], [5, 5, 2]);
    structure.box([2.8, 15, .4], [side * 6.3, 3, -3.6], titanium);
    structure.box([.3, 15, .18], [side * 4.75, 3, -3.4], copper);
    for (let i = 0; i < 8; i++) {
      const y = -3.6 + i * 1.9;
      structure.box([1.4, .15, .1], [side * 4.8, y, -3.18], titanium);
      structure.rod([side * 4.1, y, -3.1], [side * 4.1, y, -2.3], .035, titanium);
      structure.box([.18, .12, .07], [side * 4.12, y, -2.2], i % 3 ? cyan : amber);
      structure.rod([side * 7.5, y, -3.7], [side * 5.1, y + 1.9, -4.5], .045, dark);
    }
    structure.rod([side * 4.1, -3.6, -2.3], [side * 4.1, 9.7, -2.3], .028, titanium);
    // Conduits and flanges cast their own silhouette beyond the printed panels.
    for (let p = 0; p < 3; p++) {
      const xx = x + (p - 1) * .47;
      structure.rod([xx, -4.8, -2.35], [xx, 9.9, -2.35], .11, copper);
      for (let j = 0; j < 7; j++) structure.rod([xx, -4.7 + j * 2.3, -2.35],
        [xx, -4.57 + j * 2.3, -2.35], .15, titanium);
    }
    // An outboard radiator has thickness, not a billboard silhouette.
    for (let n = 0; n < 9; n++) structure.box([1.8, .09, .26],
      [side * 8.6, 3 + n * .55, -1.3 + n * .12], black);
    structure.rod([side * 4.6, .4, -.2], [side * 4.6, .4, 2.8], .065, titanium);
    structure.box([.28, .22, .8], [side * 4.6, .4, 2.5], dark);
    structure.box([.12, .24, .5], [side * 4.6, .4, 2.5], amber);
    for (let i = 0; i < 4; i++) {
      const y = -.8 + i * 1.2;
      structure.rod([side * 7, y, -3.4], [side * 8.8, y + 1.3, -1.5], .05, titanium);
    }
  }
  // Low crossmembers pass below z=0 flight/bullets. No raster can obstruct it.
  for (const y of [-4.5, 10.5]) {
    structure.box([14.7, .3, .3], [0, y, -4.1], dark);
    for (let i = -6; i < 7; i++) structure.rod([i, y, -4.1], [i + 1, y, -3.55], .04, titanium);
  }
  structure.finish(); fallback.finish(); artwork.finish();
  faces.visible = false;
  return {
    root, panels,
    setArt(texture: T.Texture | undefined, enabled: boolean) {
      panels.map = texture ?? null; panels.needsUpdate = true;
      faces.visible = !!texture && enabled; proxy.visible = !faces.visible;
    },
  };
}
