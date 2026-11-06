import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { IoDetail } from './io-detail';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ioCeramic,ioBand,ioSafety,ioSteel,ioChrome,ioDark,ioRust,ioHot,ioFurnace,ioHeatGlow,ioTarget,ioWeather } from './io-materials';
import { calderaLocal, IO_FOOT_DROP, IO_WHEEL_SCALE, IO_WHEEL_Y } from './io-layout';

const box=ioWeather(new RoundedBoxGeometry(1,1,1,2,.08)),orb=ioWeather(new T.SphereGeometry(1,16,10));
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
    const plate=part(root,box,ioCeramic,side*.29,-.10,.245,.26,.48,.10);plate.rotation.z=side*.30;
    part(root,box,ioBand,side*.28,-.24,.308,.19,.08,.025);
    part(root,box,ioDark,side*.15,-.27,.31,.09,.25,.025);
    for(let j=0;j<3;j++)part(root,box,ioSteel,side*.15,-.35+j*.07,.33,.10,.016,.015);
  }
  const seams=mergeGeometries([-1,1].map(side=>new T.BoxGeometry(.028,.7,.025).rotateZ(side*.40).translate(side*.18,.03,.245)));
  part(root,seams,ioDark,0,0,0);
  root.traverse(o=>{if(o instanceof T.Mesh&&!o.name.includes('jet')){o.castShadow=o.receiveShadow=true;}});return root;
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
  const detail=new IoDetail();
  for(const side of [-1,1]){
    detail.box(side*2.65,.4,-.15,1.2,3.4,1.65,ioCeramic);
    detail.box(side*2.65,-.20,.825,1.21,.28,.045,ioBand);
    detail.box(side*1.15,.55,1.02,1.8,1.05,.25,ioCeramic,side*.06);
    detail.bolts(side*1.15,.55,1.18,1.45,.72,ioSteel);
    for(let j=0;j<6;j++)detail.box(side*(1.0+j*.14),.57,1.18,.05,.62,.07,ioDark);
    detail.pipe([[side*2.12,-1,1.05],[side*2.1,.35,1.12],[side*1.9,1.3,.85],[side*1.5,1.7,.5]],.075,ioChrome);
    detail.box(side*2.9,1.65,-1.3,.95,.55,2.6,ioSteel);
    for(let j=0;j<5;j++){
      detail.rod([side*3.38,1.85,-2.45+j*.52],[side*3.38,2.35,-2.45+j*.52],.025,ioSafety);
      detail.box(side*2.9,1.94,-2.35+j*.52,.7,.025,.065,ioDark);
    }
    detail.rod([side*3.38,2.35,-2.45],[side*3.38,2.35,-.2],.035,ioSafety);
    // Tall rear heat exchangers and flanged exhaust stacks give the silhouette scale.
    detail.box(side*2.5,2.5,-1.25,1.1,2.3,1.0,ioSteel);
    for(let j=0;j<8;j++)detail.box(side*2.5,1.55+j*.24,-.7,1.05,.055,.08,ioChrome);
    detail.rod([side*2.55,2.5,-1.6],[side*2.55,5.35,-1.6],.16,ioRust);
    for(let j=0;j<4;j++)detail.rod([side*2.55,3+j*.65,-1.6],[side*2.55,3.06+j*.65,-1.6],.22,ioSteel);
  }
  detail.finish(chassis,'caldera-machinery-detail');
  const wheel=new T.Group();wheel.name='dredging-wheel';wheel.position.set(0,IO_WHEEL_Y,.50);wheel.scale.setScalar(IO_WHEEL_SCALE);chassis.add(wheel);
  ring(wheel,0,0,0,2.13,.23,ioSteel);ring(wheel,0,0,.14,1.70,.07,ioRust);
  part(wheel,new T.CylinderGeometry(1.75,1.75,.20,40).rotateX(Math.PI/2),ioDark,0,0,-.22);
  ring(wheel,0,0,.18,1.10,.12,ioChrome);
  part(wheel,new T.CylinderGeometry(.75,.75,.5,24).rotateX(Math.PI/2),ioDark,0,0,.1);
  part(wheel,new T.SphereGeometry(.54,20,12),ioFurnace,0,0,.33,1.25,1.25,.65);
  const heatGlow=new T.Sprite(ioHeatGlow);heatGlow.position.z=.75;heatGlow.scale.set(3.1,3.1,1);wheel.add(heatGlow);
  const furnaceLight=new T.PointLight(0xff6315,14,6,2);furnaceLight.position.z=.9;wheel.add(furnaceLight);
  const bucket=ioWeather(mergeGeometries([
    new RoundedBoxGeometry(1.24,1.10,.18,1,.035),new T.BoxGeometry(1.24,.17,.52).translate(0,.46,.21),
    new T.BoxGeometry(.12,1.0,.42).translate(-.56,0,.17),new T.BoxGeometry(.12,1.0,.42).translate(.56,0,.17),
  ].map(g=>{if(!g.index)return g;const flat=g.toNonIndexed();g.dispose();return flat;})),211);
  const rotorDetail=new IoDetail();
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4,x=Math.cos(a),y=Math.sin(a);
    bar(wheel,new T.Vector3(x*.65,y*.65,0),new T.Vector3(x*2.1,y*2.1,0),.09,ioSteel);
    const scoop=part(wheel,bucket,ioCeramic,x*2.08,y*2.08,.24);scoop.rotation.z=a-Math.PI/2;
    const tooth=part(wheel,box,ioDark,x*2.57,y*2.57,.40,1.23,.14,.15);tooth.rotation.z=scoop.rotation.z;
    rotorDetail.box(x*2.15,y*2.15,.48,.60,.12,.10,ioRust,scoop.rotation.z);
    for(const k of [-1,1]){
      rotorDetail.rod([x*.8-y*k*.065,y*.8+x*k*.065,.21],[x*1.85-y*k*.065,y*1.85+x*k*.065,.21],.045,ioChrome);
      rotorDetail.box(x*2.13-y*k*.31,y*2.13+x*k*.31,.51,.065,.065,.045,ioSteel);
    }
  }
  rotorDetail.finish(wheel,'wheel-brackets');
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
    const armor=part(parent,box,ioCeramic,0,0,0,.95,2.0,.92);
    const upperDetail=new IoDetail();
    upperDetail.box(0,-.24,.51,.96,.18,.035,ioBand);
    upperDetail.bolts(0,0,.53,.71,.78,ioSteel);
    for(const k of [-1,1])upperDetail.box(k*.36,.07,.53,.05,.80,.045,ioDark);
    upperDetail.finish(armor,'support-armor-fasteners');
    const joint=part(parent,orb,ioSteel,knee.x,knee.y,knee.z,.58,.58,.58);
    ring(joint,0,0,.9,.66,.10,ioChrome);
    const length=(lower.geometry as T.CylinderGeometry).parameters.height;
    part(lower,box,ioCeramic,0,-.2,0,.88,length*.45,.78);
    part(lower,box,ioBand,0,-length*.15,.40,.89,.32,.04);
    for(const k of [-1,1]){
      bar(lower,new T.Vector3(k*.28,-length*.42,.38),new T.Vector3(k*.28,length*.35,.38),.055,ioChrome);
      part(armor,box,ioSteel,k*.48,0,.56,.08,.8,.08);
    }
    const footMesh=part(root,box,ioSteel,foot.x,foot.y,foot.z,1.15,.35,1.25);footMesh.name='caldera-foot';
    for(const toe of [-1,0,1])part(root,box,ioDark,foot.x+toe*.38,foot.y+.10,foot.z+.64,.22,.50,.6);
    legs.push({hip,knee,foot,upper,lower,piston,armor,joint,failed});
  }
  // Side gantries and railings break up the silhouette without per-bolt meshes.
  for(const side of [-1,1]){
    part(chassis,box,ioSteel,side*2.9,.9,-1.2,1.1,.12,2.7);
    for(let j=0;j<5;j++)part(chassis,box,ioRust,side*3.35,1.25,-2.4+j*.55,.06,.7,.06);
    bar(chassis,new T.Vector3(side*3.35,1.6,-2.4),new T.Vector3(side*3.35,1.6,-.2),.035,ioSteel);
  }
  const a=new T.Vector3(),b=new T.Vector3(),q=new T.Vector3(),pistonA=new T.Vector3(),pistonB=new T.Vector3();
  function fit(mesh:T.Mesh,start:T.Vector3,end:T.Vector3,_radius:number){
    // Existing cylinders are unit-scaled along their original length.
    const original=(mesh.geometry as T.CylinderGeometry).parameters.height;
    mesh.position.copy(start).add(end).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(up,q.copy(end).sub(start).normalize());
    mesh.scale.set(1,start.distanceTo(end)/original,1);
  }
  function pose(time:number,collapse=0,broken=false,windup=0){
    chassis.rotation.z=-.14*collapse;chassis.position.y=-.45*collapse;
    wheel.rotation.z=time*.55+collapse*.7;shield.visible=!broken;legTarget.visible=!broken;
    heatGlow.scale.setScalar(3.1+Math.sin(time*2.3)*.12);
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
  root.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
  pose(0);
  return {root,pose};
}
// Ground height at the load-bearing anchor shelves, relative to the chassis.
