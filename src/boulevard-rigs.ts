import * as T from 'three';
import {part,pivot,plating} from './rig-geometry';
import {mergeBoulevard} from './boulevard-geometry';
import {hovercarVectors,cruiserWingVectors} from './boulevard-vectors';
import {cruiserHull,cruiserCanopy,cruiserStrut} from './boulevard-cruiser-geometry';
import type {BoulevardMaterials} from './boulevard-materials';
export function createHovercar(m:BoulevardMaterials,heavy=false){
 const root=new T.Group();root.name=heavy?'boulevard-armored-hovercar':'boulevard-pursuit-hovercar';
 const hull=plating([[-.42,.75],[.42,.75],[.64,-.25],[.42,-.8],[-.42,-.8],[-.64,-.25]],.22,.035);
 part(root,hull,m.shell,0,0,-.08);part(root,hovercarVectors(),m.wire,0,0,0);
 const cockpit=part(root,plating([[-.26,.36],[.26,.36],[.32,-.13],[-.32,-.13]],.12,.025),m.glass,0,0,.16);cockpit.rotation.x=-.12;
 for(const side of[-1,1]){
  part(root,new T.BoxGeometry(.10,.9,.12),m.chrome,side*.48,.1,.14);
  part(root,new T.BoxGeometry(.055,.83,.035),m.pink,side*.54,.1,.20);
  part(root,new T.BoxGeometry(.22,.045,.045),m.amber,side*.23,-.74,.12);
 }
 const jet=part(root,new T.ConeGeometry(.13,.45,8).rotateX(Math.PI/2),m.cyan,0,.94,.02);jet.name='hovercar-exhaust';
 if(heavy){root.scale.set(1.15,1.3,1.25);for(const side of[-1,1])part(root,new T.BoxGeometry(.3,1.0,.23),m.chrome,side*.52,.12,.02);}
 mergeBoulevard(root);return{root};
}
export function cloneHovercar(template:T.Group){const root=template.clone(true);return{root,pose(time:number,bank:number){root.rotation.y=bank;const body=root.getObjectByName('hovercar-exhaust');if(body)body.scale.y=.75+.22*Math.sin(time*13);}};}
export function createPursuitCruiser(m:BoulevardMaterials){
 const root=new T.Group();root.name='pursuit-cruiser';
 const main=cruiserHull();part(root,main,m.shell,0,0,0);
 const canopy=cruiserCanopy();part(root,canopy,m.glass,0,0,0);
 // Metallic windshield ribs and a split roof give the cabin real depth from every view.
 for(const side of[-1,1]){
  part(root,cruiserStrut(new T.Vector3(side*1.62,-.83,1.01),new T.Vector3(side*1.4,.88,1.89)),m.chrome,0,0,0);
  part(root,cruiserStrut(new T.Vector3(side*.78,-1.75,.56),new T.Vector3(side*1.18,-.80,1.01),.028),m.pink,0,0,0);
 }
 part(root,cruiserStrut(new T.Vector3(0,-.83,1.01),new T.Vector3(0,.88,1.89),.045),m.chrome,0,0,0);
 part(root,cruiserStrut(new T.Vector3(-1.4,.88,1.89),new T.Vector3(1.4,.88,1.89),.06),m.chrome,0,0,0);
 part(root,new T.BoxGeometry(2.85,.44,.10),m.shell,0,1.03,1.83);
 for(const side of[-1,1]){
  part(root,new T.BoxGeometry(.85,.11,.075),m.amber,side*.82,-1.81,.42);
  part(root,new T.BoxGeometry(1.0,.14,.13),m.chrome,side*.82,-1.78,.31);
 }
 part(root,new T.BoxGeometry(1.1,.16,.21),m.cyan,0,-1.86,.11).name='cruiser-core';
 const wings=[-1,1].map(side=>{
  const wing=pivot(root,'cruiser-wing-'+side,side*2.25,.2,0);
  const plate=plating([[0,-.8],[side*1.7,-1.5],[side*2.5,.7],[side*1.9,1.8],[0,1.0]],.25,.07);
  if(side>0)part(wing,plate,m.chrome,0,0,.08);else{
   const rotor=part(wing,new T.CylinderGeometry(.48,.5,1.6,12),m.chrome,side*.9,.2,.05);rotor.rotation.z=.1;
   part(wing,new T.CylinderGeometry(.22,.22,1.8,10),m.pink,side*.9,.2,.08);
   for(let y=0;y<4;y++)part(wing,new T.TorusGeometry(.51,.045,5,12).rotateX(Math.PI/2),m.chrome,side*.9,-.45+y*.42,.05);
  }
  part(wing,cruiserWingVectors(side),m.wire,0,0,0);
  if(side<0){
   for(const[x,y]of[[0,-.8],[side*1.7,-1.5],[side*2.5,.7],[side*1.9,1.8],[0,1.0]])part(wing,new T.CylinderGeometry(.035,.035,.55,6).rotateX(Math.PI/2),m.cyan,x,y,-.06);
  }else for(let k=0;k<3;k++)part(wing,new T.BoxGeometry(.055,1.4,.04),m.shell,side*(.7+k*.38),.2,.42);
  part(wing,new T.BoxGeometry(.11,1.2,.23),m.pink,side*1.6,.2,.25);
  return wing;
 });
 const guns=[-1,1].map(side=>{
  const base=pivot(root,'cruiser-cannon-'+side,side*2.4,-1.15,-.19);
  part(base,new T.CylinderGeometry(.48,.58,.8,12),m.chrome,0,0,0);
  for(let k=-1;k<=1;k++)part(base,new T.BoxGeometry(.9,.045,.08),m.shell,0,k*.2,.38);
  const rotor=pivot(base,'rotary-barrels-'+side,0,-.7,0);
  for(let i=0;i<6;i++){const angle=i/6*Math.PI*2,x=Math.cos(angle)*.27,z=Math.sin(angle)*.27;
   part(rotor,new T.CylinderGeometry(.08,.08,.85,8),m.chrome,x,0,z);
   part(rotor,new T.CylinderGeometry(.085,.085,.03,10),m.shell,x,-.43,z);
   part(rotor,new T.TorusGeometry(.078,.020,5,10).rotateX(Math.PI/2),m.chrome,x,-.45,z);
  }
  return{base,rotor};
 });
 const vents:T.Mesh[]=[];
 for(const side of[-1,1]){
  part(root,new T.BoxGeometry(.9,.65,.4),m.shell,side*1.9,1.1,1.0);
  for(let i=0;i<4;i++)vents.push(part(root,new T.BoxGeometry(.7,.045,.04),m.pink,side*1.9,.89+i*.13,1.21));
 }
 for(const name of['laser_contact_L','laser_contact_C','laser_contact_R'])pivot(root,name,0,-1.87,.20);
 mergeBoulevard(root);
 return{root,pose(time:number,charge:number,recoil:number){guns.forEach(g=>{g.rotor.rotation.y=time*(2+charge*12);g.base.position.y=-1.15+recoil*.22;});wings.forEach((w,i)=>w.rotation.y=(i?1:-1)*(.035+.035*Math.sin(time*.7)));},guns,vents};
}
