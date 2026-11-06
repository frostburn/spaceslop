import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ioCeramic,ioSteel,ioDark,ioRust,ioHot,ioTarget,ioWeather } from './io-materials';
import { calderaLocal, IO_FOOT_DROP } from './io-layout';

const box=ioWeather(new T.BoxGeometry(1,1,1,2,2,2)),orb=ioWeather(new T.SphereGeometry(1,16,10));
const up=new T.Vector3(0,1,0);
function part(parent:T.Object3D,g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number,sx=1,sy=1,sz=1){
  const p=new T.Mesh(g,m);p.position.set(x,y,z);p.scale.set(sx,sy,sz);parent.add(p);return p;
}
function bar(parent:T.Object3D,a:T.Vector3,b:T.Vector3,r:number,material:T.Material){
  const g=new T.CylinderGeometry(r,r,a.distanceTo(b),8),p=new T.Mesh(g,material);
  p.position.copy(a).add(b).multiplyScalar(.5);p.quaternion.setFromUnitVectors(up,b.clone().sub(a).normalize());parent.add(p);return p;
}
function ring(parent:T.Object3D,x:number,y:number,z:number,r:number,tube:number,m:T.Material){
  return part(parent,new T.TorusGeometry(r,tube,8,36),m,x,y,z);
}

let skipperTemplate:T.Group|undefined;
function skipperModel(){
  const root=new T.Group();root.name='io-skipper';
  const outline=new T.Shape();outline.moveTo(0,.73);outline.lineTo(-.53,-.45);outline.lineTo(0,-.25);outline.lineTo(.53,-.45);outline.closePath();
  const shell=ioWeather(new T.ExtrudeGeometry(outline,{depth:.17,bevelEnabled:true,bevelSize:.055,bevelThickness:.06,bevelSegments:1,steps:1}),591);
  part(root,shell,ioCeramic,0,0,.03);part(root,box,ioSteel,0,-.1,.20,.22,.63,.17);
  part(root,box,ioRust,0,.20,.30,.11,.22,.025);
  for(const side of [-1,1]){
    part(root,box,ioDark,side*.34,-.35,.06,.18,.24,.20);
    const jet=part(root,new T.ConeGeometry(.07,.40,8),ioHot,side*.34,-.61,.04);jet.rotation.z=Math.PI;jet.name='skipper-jet';
    part(root,box,ioSteel,side*.38,-.05,.13,.10,.28,.09);
  }
  const seams=mergeGeometries([-1,1].map(side=>new T.BoxGeometry(.028,.7,.025).rotateZ(side*.40).translate(side*.18,.03,.245)));
  part(root,seams,ioDark,0,0,0);return root;
}
export function createSkipper(){
  const root=(skipperTemplate??=skipperModel()).clone();const jets:T.Mesh[]=[];
  root.traverse(o=>{if(o.name==='skipper-jet')jets.push(o as T.Mesh);});
  return {root,pose(time:number,bank=0,jet=0){root.rotation.y=bank;root.rotation.x=Math.sin(time*3)*.06;
    jets.forEach((p,i)=>p.scale.y=.35+jet*.9+Math.sin(time*38+i)*.10);
  }};
}

export function createCaldera(){
  const root=new T.Group();root.name='caldera-engine';
  const chassis=new T.Group();chassis.name='caldera-chassis';root.add(chassis);
  part(chassis,box,ioSteel,0,0,-.3,6.2,2.4,2.2);
  part(chassis,box,ioDark,0,-.2,.84,4.2,1.8,.15);
  for(const side of [-1,1]){
    part(chassis,box,ioCeramic,side*2.6,.35,.42,.9,2.8,.75);
    part(chassis,box,ioRust,side*2.6,.4,.81,.92,.25,.025);
    for(let i=0;i<4;i++)part(chassis,box,ioSteel,side*2.6,-.55+i*.50,.89,.94,.05,.06);
    part(chassis,box,ioCeramic,side*1.1,-1.0,.48,1.7,.45,.70);
    // Registered power conduits with welded collar modules.
    bar(chassis,new T.Vector3(side*1.9,-.9,.78),new T.Vector3(side*1.9,1.7,.78),.08,ioRust);
    for(let j=0;j<4;j++)part(chassis,box,ioDark,side*1.9,-.7+j*.6,.8,.22,.08,.22);
  }
  const wheel=new T.Group();wheel.name='dredging-wheel';wheel.position.set(0,2.5,.50);chassis.add(wheel);
  ring(wheel,0,0,0,2.13,.23,ioSteel);ring(wheel,0,0,.14,1.70,.07,ioRust);
  part(wheel,new T.CylinderGeometry(.75,.75,.5,24).rotateX(Math.PI/2),ioDark,0,0,.1);
  part(wheel,new T.SphereGeometry(.54,20,12),ioHot,0,0,.33,1,1,.42);
  const bucket=ioWeather(mergeGeometries([
    new T.BoxGeometry(.9,.72,.14),new T.BoxGeometry(.9,.15,.48).translate(0,.30,.20),
    new T.BoxGeometry(.12,.62,.42).translate(-.4,0,.17),new T.BoxGeometry(.12,.62,.42).translate(.4,0,.17),
  ]),211);
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,x=Math.cos(a),y=Math.sin(a);
    bar(wheel,new T.Vector3(x*.65,y*.65,0),new T.Vector3(x*2.1,y*2.1,0),.09,ioSteel);
    const scoop=part(wheel,bucket,ioCeramic,x*2.08,y*2.08,.24);scoop.rotation.z=a-Math.PI/2;
    const tooth=part(wheel,box,ioDark,x*2.42,y*2.42,.40,.86,.12,.13);tooth.rotation.z=scoop.rotation.z;
  }
  // Cyan machinery is shielded by the wheel housing until a front support fails.
  const core=new T.Group();core.name='exposed-machinery';core.position.set(0,-.4,1.0);chassis.add(core);
  part(core,box,ioTarget,0,0,.08,1.1,.82,.20);
  for(let i=-2;i<=2;i++)part(core,box,ioSteel,i*.22,0,.22,.055,.9,.14);
  const shield=part(chassis,box,ioCeramic,0,-.4,1.32,1.6,1.25,.25);shield.name='core-shutter';
  const contactCore=new T.Object3D();contactCore.name='laser_contact_R';contactCore.position.z=.32;core.add(contactCore);
  const legTarget=part(chassis,new T.CylinderGeometry(.43,.43,.18,12).rotateX(Math.PI/2),ioTarget,-2.4,-.4,1.15);legTarget.name='support-coupling';
  const contactLeg=new T.Object3D();contactLeg.name='laser_contact_L';contactLeg.position.set(-2.4,-.4,1.25);chassis.add(contactLeg);
  const brokenLeg=new T.Group();brokenLeg.name='front-support';root.add(brokenLeg);
  const legs:{hip:T.Vector3;knee:T.Vector3;foot:T.Vector3;upper:T.Mesh;lower:T.Mesh;piston:T.Mesh;armor:T.Mesh;joint:T.Mesh;failed:boolean}[]=[];
  for(const side of [-1,1])for(let row=0;row<3;row++){
    const failed=side===-1&&row===0,parent=failed?brokenLeg:root;
    const hip=new T.Vector3(side*2.8,-.3,-.2-row*1.2),knee=new T.Vector3(side*(4.2+row*.3),-2.5,2.6-row*2.2),foot=new T.Vector3(side*(6.1+row*.25),-IO_FOOT_DROP,3.7-row*3.3);
    const upper=bar(parent,hip,knee,.22,ioSteel),lower=bar(parent,knee,foot,.19,ioSteel);
    const piston=bar(parent,hip.clone().lerp(knee,.35).add(new T.Vector3(0,0,.25)),knee.clone().lerp(foot,.3),.095,ioRust);
    const armor=part(parent,box,ioCeramic,0,0,0,.58,1.25,.5);
    const joint=part(parent,orb,ioDark,knee.x,knee.y,knee.z,.38,.38,.38);
    part(root,box,ioSteel,foot.x,foot.y,foot.z,1.15,.35,1.25);
    legs.push({hip,knee,foot,upper,lower,piston,armor,joint,failed});
  }
  // Side gantries and railings break up the silhouette without per-bolt meshes.
  for(const side of [-1,1]){
    part(chassis,box,ioSteel,side*2.9,.9,-1.2,1.1,.12,2.7);
    for(let j=0;j<5;j++)part(chassis,box,ioRust,side*3.35,1.25,-2.4+j*.55,.06,.7,.06);
    bar(chassis,new T.Vector3(side*3.35,1.6,-2.4),new T.Vector3(side*3.35,1.6,-.2),.035,ioSteel);
  }
  const a=new T.Vector3(),b=new T.Vector3(),q=new T.Vector3(),pistonA=new T.Vector3(),pistonB=new T.Vector3();
  function fit(mesh:T.Mesh,start:T.Vector3,end:T.Vector3,radius:number){
    // Existing cylinders are unit-scaled along their original length.
    const original=(mesh.geometry as T.CylinderGeometry).parameters.height;
    mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(up,q.copy(end).sub(start).normalize());
    mesh.scale.set(1,start.distanceTo(end)/original,1);
  }
  function pose(time:number,collapse=0,broken=false,windup=0){
    chassis.rotation.z=-.14*collapse;chassis.position.y=-.45*collapse;
    wheel.rotation.z=time*.55+collapse*.7;shield.visible=!broken;legTarget.visible=!broken;
    (legTarget.material as T.MeshStandardMaterial).emissiveIntensity=broken?0:1.0+windup;
    for(const leg of legs){
      const h=calderaLocal(leg.hip.x,leg.hip.y,leg.hip.z,collapse);a.set(h.x,h.y,h.z);
      b.copy(leg.knee);if(leg.failed){b.x-=collapse*.6;b.y-=collapse*1.5;b.z+=collapse*.7;}
      leg.joint.position.copy(b);
      fit(leg.upper,a,b,.22);fit(leg.lower,b,leg.foot,.19);
      fit(leg.piston,pistonA.copy(a).lerp(b,.35),pistonB.copy(b).lerp(leg.foot,.3),.095);
      leg.armor.position.copy(a).lerp(b,.48);leg.armor.quaternion.copy(leg.upper.quaternion);
    }
  }
  pose(0);
  return {root,pose};
}
// Ground height at the load-bearing anchor shelves, relative to the chassis.
