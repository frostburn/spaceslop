import * as T from 'three';
import { heliostatBatch } from './geometry';
import type { HeliostatMaterials } from './materials';
import {heliostatSunspot} from './combat';
import {createHeliostatStar} from './star';

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
  const star=createHeliostatStar(),sphere=star.sphere;root.add(sphere,star.halo);
  const spotMaterial=new T.MeshBasicMaterial({color:0x351009}),penumbra=new T.MeshBasicMaterial({color:0xb14d12});
  for(const side of[-1,1]){
    const p=heliostatSunspot(side),spot=new T.Group();spot.name='plasma-source-sunspot';spot.position.set(p.x,p.y,p.z);
    spot.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),spot.position.clone().normalize());root.add(spot);
    const rim=new T.Mesh(new T.SphereGeometry(1,24,12),penumbra);rim.scale.set(.68,.51,.045);rim.position.z=.035;spot.add(rim);
    const core=new T.Mesh(new T.SphereGeometry(1,24,12),spotMaterial);core.scale.set(.48,.34,.035);core.position.z=.08;spot.add(core);
  }
  const light = new T.PointLight(0xffdfb2, 2800, 160, 2); root.add(light);
  return { root, sphere, update:star.update };
}
