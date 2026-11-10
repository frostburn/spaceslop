import * as T from 'three';
import {batchAircraft} from './aircraft';
import {vortexAngle,vortexPhase} from './vortex';
export function createVortexDrone(){
  const root=new T.Group();root.name='vortex-drone';
  const hull=new T.MeshStandardMaterial({color:0x484b64,metalness:.6,roughness:.48}),rim=new T.MeshStandardMaterial({color:0xb7b2a5,metalness:.55,roughness:.45}),dark=new T.MeshStandardMaterial({color:0x202b34,roughness:.72});
  const hot=new T.MeshBasicMaterial({color:0xffa956});
  const core=new T.Mesh(new T.CylinderGeometry(.42,.52,.24,24).rotateX(Math.PI/2),hull);root.add(core);
  const window=new T.Mesh(new T.SphereGeometry(.28,16,10),dark);window.scale.z=.38;window.position.z=.2;root.add(window);
  root.add(new T.Mesh(new T.TorusGeometry(.66,.075,8,36),rim));
  for(let i=0;i<3;i++){
    const a=i*Math.PI*2/3,spar=new T.Mesh(new T.BoxGeometry(.18,.55,.16),hull);spar.position.set(Math.cos(a)*.53,Math.sin(a)*.53,0);spar.rotation.z=a-Math.PI/2;root.add(spar);
    const lamp=new T.Mesh(new T.SphereGeometry(.06,8,6),hot);lamp.position.set(Math.cos(a)*.72,Math.sin(a)*.72,.03);root.add(lamp);
  }
  batchAircraft(root);
  const rotor=new T.Group();rotor.name='vortex-rotating-emitter';rotor.position.z=.28;root.add(rotor);
  const arm=new T.Mesh(new T.BoxGeometry(1.42,.13,.12),rim);rotor.add(arm);
  for(const side of[-1,1]){
    const nozzle=new T.Mesh(new T.CylinderGeometry(.115,.14,.3,12).rotateZ(Math.PI/2),dark);nozzle.position.x=side*.63;rotor.add(nozzle);
    const muzzle=new T.Mesh(new T.CircleGeometry(.085,12),hot);muzzle.position.set(side*.71,0,.1);rotor.add(muzzle);
  }
  const warning=new T.Mesh(new T.RingGeometry(.47,.52,40),new T.MeshBasicMaterial({color:0xffc67b,transparent:true,opacity:0,depthWrite:false}));warning.position.z=.42;root.add(warning);
  return{root,rotor,warning,pose(age:number,mirror=1){
    const state=vortexPhase(age);rotor.rotation.z=vortexAngle(age,mirror);
    warning.material.opacity=state.charge*.82+(state.firing?.28:0);warning.scale.setScalar(1+.18*state.charge);
    root.rotation.x=.035*Math.sin(age*1.2);root.rotation.y=.045*Math.sin(age*.9+.8);
  }};
}
