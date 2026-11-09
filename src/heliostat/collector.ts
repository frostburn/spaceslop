import * as T from 'three';
import { heliostatBatch } from './geometry';
import type { HeliostatMaterials } from './materials';
import {heliostatSunspot} from './combat';

function photosphere() {
  const w = 256, h = 128, bytes = new Uint8Array(w * h * 4);
  const hash=(x:number,y:number)=>{let n=Math.imul((x+80)%80+471,374761393)^Math.imul((y+40)%40+37,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;};
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u=x/w*80,v=y/h*40,ix=Math.floor(u),iy=Math.floor(v);let d=4;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const px=ix+dx+.1+.8*hash(ix+dx,iy+dy),py=iy+dy+.1+.8*hash(ix+dx+23,iy+dy+17);d=Math.min(d,(u-px)**2+(v-py)**2);
    }
    const granule=.2+.68*Math.exp(-d*3.5)+hash(x,y)*.1;
    bytes.set([250,80+175*granule,8+80*granule,255], (y * w + x) * 4);
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
      b.add(g,m.hotCoil,[radial.x*(6.78+j*.16),radial.y*(6.78+j*.16),0]);
    }
    b.box([.14,.14,.28],[radial.x*6.2,radial.y*6.2,.8],m.amber);
  }
  b.finish();
  const sphere = new T.Mesh(new T.SphereGeometry(4.65,48,32), new T.MeshBasicMaterial({ map: photosphere(), color: 0xffffff }));
  sphere.name = 'artificial-star'; root.add(sphere);
  const spotMaterial=new T.MeshBasicMaterial({color:0x351009}),penumbra=new T.MeshBasicMaterial({color:0xb14d12});
  for(const side of[-1,1]){
    const p=heliostatSunspot(side),spot=new T.Group();spot.name='plasma-source-sunspot';spot.position.set(p.x,p.y,p.z);
    spot.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),spot.position.clone().normalize());root.add(spot);
    const rim=new T.Mesh(new T.SphereGeometry(1,24,12),penumbra);rim.scale.set(.68,.51,.045);rim.position.z=.035;spot.add(rim);
    const core=new T.Mesh(new T.SphereGeometry(1,24,12),spotMaterial);core.scale.set(.48,.34,.035);core.position.z=.08;spot.add(core);
  }
  const light = new T.PointLight(0xffcb8c, 1800, 160, 2); root.add(light);
  return { root, sphere, update(time: number) { sphere.rotation.y = time * .023; } };
}
