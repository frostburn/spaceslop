import * as T from 'three';
import { heliostatBatch } from './geometry';
import type { HeliostatMaterials } from './materials';

function photosphere() {
  const w = 256, h = 128, bytes = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / (w - 1) * Math.PI * 2, v = y / (h - 1) * Math.PI;
    const cells = Math.sin(u * 19 + Math.sin(v * 42)) * Math.sin(v * 49);
    const spot = Math.max(0, (Math.sin(u * 5 + Math.sin(v * 7)) * Math.sin(v * 9) - .86) / .14);
    bytes.set([245 - spot * 125 + cells * 8, 175 - spot * 130 + cells * 12, 77 - spot * 61, 255], (y * w + x) * 4);
  }
  const map = new T.DataTexture(bytes, w, h); map.colorSpace = T.SRGBColorSpace;
  map.magFilter = T.LinearFilter; map.minFilter = T.LinearMipmapLinearFilter;
  map.generateMipmaps = true; map.wrapS = T.RepeatWrapping; map.needsUpdate = true; return map;
}

/** Complete paired hoops, cross-braced in depth, enclose the artificial star. */
export function createHeliostatCollector(m: HeliostatMaterials) {
  const root = new T.Group(); root.name = 'complete-stellar-collector';
  root.position.set(0, 62, 8); root.rotation.x = Math.PI / 2;
  const b = heliostatBatch(root);
  for (const z of [-.75, .75]) for (const radius of [6.3, 8.2])
    b.ring(radius, .17, [0,0,z], m.titanium, [0,0,0]);
  for (let i = 0; i < 20; i++) {
    const a = i * Math.PI / 10, next = a + Math.PI / 10, radial = new T.Vector3(Math.cos(a), Math.sin(a), 0);
    for (const z of [-.75,.75]) b.rod([radial.x*6.3,radial.y*6.3,z], [radial.x*8.2,radial.y*8.2,z], .08, m.dark);
    b.rod([radial.x*8.2,radial.y*8.2,-.75],[Math.cos(next)*8.2,Math.sin(next)*8.2,.75], .065, m.titanium);
    b.rod([radial.x*6.3,radial.y*6.3,-.75],[radial.x*6.3,radial.y*6.3,.75], .07, m.titanium);
    const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1), radial);
    b.rod([radial.x*6.65,radial.y*6.65,0],[radial.x*7.9,radial.y*7.9,0], .29, m.graphite, 12);
    for (let j = 0; j < 7; j++) {
      const g = new T.TorusGeometry(.33,.038,5,24); g.applyQuaternion(q);
      b.add(g,m.copper,[radial.x*(6.78+j*.16),radial.y*(6.78+j*.16),0]);
    }
    b.box([.14,.14,.28],[radial.x*6.2,radial.y*6.2,.8],m.amber);
  }
  b.finish();
  const sphere = new T.Mesh(new T.SphereGeometry(4.65,48,32), new T.MeshBasicMaterial({ map: photosphere(), color: 0xffffff }));
  sphere.name = 'artificial-star'; root.add(sphere);
  const light = new T.PointLight(0xffcb8c, 1800, 160, 2); root.add(light);
  return { root, sphere, update(time: number) { sphere.rotation.y = time * .023; } };
}
