import * as T from 'three';
import {wormPose,SHRIMP_FIRST_FIRE,WORM_FIRST_FIRE} from './vent-fauna';

function fallbackAtlas(){
 const size=192,c=document.createElement('canvas');c.width=c.height=size*3;const g=c.getContext('2d')!;
 for(let cell=0;cell<9;cell++){
  g.save();g.translate(cell%3*size,Math.floor(cell/3)*size);
  const worm=cell>=6,thin=cell===3||cell===4||cell===6||cell===8;
  const grad=g.createRadialGradient(74,64,3,96,96,85);grad.addColorStop(0,worm?cell===8?'#aba681':'#98594f':'#c5bca2');grad.addColorStop(1,worm?'#3d222b':'#695749');g.fillStyle=grad;
  g.beginPath();g.ellipse(96,96,thin?34:cell===0?51:77,cell===1?48:79,0,0,Math.PI*2);g.fill();g.strokeStyle=worm?'#afa17a':'#dfd3b6';g.lineWidth=4;g.stroke();
  g.save();g.globalCompositeOperation='source-atop';
  for(let i=0;i<22;i++){g.strokeStyle=i%3?'#624d43':'#cbbb91';g.lineWidth=2;g.beginPath();g.moveTo(25+i*23%145,35+i*37%135);g.lineTo(45+i*23%145,46+i*37%135);g.stroke();}g.restore();
  if(cell===0){g.fillStyle='#1a2226';for(const x of [58,134]){g.beginPath();g.ellipse(x,136,12,16,0,0,7);g.fill();}}
  if(cell===5||cell===7){g.fillStyle=cell===5?'#121e20':'#13302b';g.beginPath();g.ellipse(96,96,cell===5?47:30,cell===5?51:34,0,0,7);g.fill();}
  g.restore();
 }
 const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
}
export function createFaunaAssets(fallback?:T.Texture){
 const material=new T.MeshBasicMaterial({map:fallback??fallbackAtlas(),alphaTest:.5,side:T.DoubleSide});
 const geometries=Array.from({length:9},(_,cell)=>{
  const geometry=new T.CircleGeometry(.5,28),uv=geometry.attributes.uv,pad=.012;
  for(let i=0;i<uv.count;i++)uv.setXY(i,(cell%3+pad+uv.getX(i)*(1-2*pad))/3,1-(Math.floor(cell/3)+1-pad-uv.getY(i)*(1-2*pad))/3);
  return geometry;
 });
 function part(parent:T.Object3D,cell:number,x:number,y:number,z:number,w:number,h:number){const mesh=new T.Mesh(geometries[cell],material);mesh.position.set(x,y,z);mesh.scale.set(w,h,1);parent.add(mesh);return mesh;}
 return{material,geometries,part,setAtlas(texture:T.Texture){texture.anisotropy=4;material.map=texture;material.needsUpdate=true;}};
}
type Assets=ReturnType<typeof createFaunaAssets>;
export function createVentShrimp(assets:Assets){
 const root=new T.Group();root.name='vent-shrimp';
 const shell=assets.part(root,0,0,-.25,.16,.9,1.15);shell.name='shrimp-carapace';
 const tail=new T.Group();tail.name='shrimp-abdomen';tail.position.y=.1;root.add(tail);
 assets.part(tail,6,0,.32,.02,.34,.9);
 let parent=tail;
 const joints=Array.from({length:3},(_,i)=>{const pivot=new T.Group();pivot.name='shrimp-tail-'+i;pivot.position.set(0,i===0?0:.17,.11-i*.015);parent.add(pivot);assets.part(pivot,1,0,.13,0,.66-i*.10,.48);parent=pivot;return pivot;});
 const fan=assets.part(parent,2,0,.32,0,.65,.5);fan.name='shrimp-tail-fan';
 const limbs=Array.from({length:6},(_,i)=>{
  const side=i%2?-1:1,pair=Math.floor(i/2),pivot=new T.Group();pivot.name='shrimp-limb-'+i;pivot.position.set(side*.22,-.4+pair*.23,.08);root.add(pivot);
  const claw=pair===0,length=claw?.4:.3;assets.part(pivot,3,0,length*.35,0,claw?.18:.14,length);
  const elbow=new T.Group();elbow.position.y=length*.7;elbow.position.z=.01;pivot.add(elbow);assets.part(elbow,4,0,claw?.20:.14,0,claw?.22:.14,claw?.5:.36);
  return{pivot,elbow,side,pair};
 });
 const muzzle=new T.Object3D();muzzle.name='shrimp-muzzle';muzzle.position.set(0,-.73,.2);root.add(muzzle);
 const antennae=[-1,1].map(side=>{const pivot=new T.Group();pivot.position.set(side*.12,-.62,.12);root.add(pivot);assets.part(pivot,3,0,.31,0,.045,.72);return{pivot,side};});
 function pose(age:number,nextFire:number){
  const charge=Math.max(0,1-(nextFire-age)/.45),swim=age*7;
  joints.forEach((joint,i)=>{joint.rotation.z=Math.sin(swim-i*.65)*(.08+i*.025);});
  for(const{pivot,elbow,side,pair}of limbs){pivot.rotation.z=-side*(pair===0?2.55+.2*charge:1.2+.35*Math.sin(swim-pair*.8));elbow.rotation.z=side*(.65+.18*Math.sin(swim-pair*.8+.5));}
  for(const{pivot,side}of antennae)pivot.rotation.z=-side*(2.75+.08*Math.sin(age*2.5));
  shell.scale.x=.9*(1-.025*charge);
 }
 pose(0,SHRIMP_FIRST_FIRE);return{root,combat:root,pose};
}
export function createVentWorm(assets:Assets){
 const root=new T.Group();root.name='vent-tube-worm';
 const foot=assets.part(root,5,0,0,.03,1.5,1.5);foot.name='worm-fixed-tube';
 const combat=new T.Group();combat.name='worm-living-parts';root.add(combat);
 const aim=new T.Group();aim.name='worm-aim';combat.add(aim);
 const body=Array.from({length:3},(_,i)=>{const m=assets.part(aim,6,0,0,.12+i*.02,.52-i*.04,.5);m.name='worm-segment-'+i;return m;});
 const crown=new T.Group();crown.name='worm-crown';crown.position.z=.23;aim.add(crown);
 const petals=Array.from({length:6},(_,i)=>{const p=new T.Group();p.rotation.z=i*Math.PI/3;const leaf=assets.part(p,8,0,.24,0,.30,.58);crown.add(p);return leaf;});
 assets.part(crown,7,0,0,.02,.62,.62);
 const muzzle=new T.Object3D();muzzle.name='worm-muzzle';muzzle.position.z=.28;aim.add(muzzle);
 function pose(age:number,nextFire:number,angle:number){
  const p=wormPose(age,nextFire);aim.rotation.z=angle;
  body.forEach((mesh,i)=>{const a=p.joints[i],b=p.joints[i+1];mesh.position.x=(a.x+b.x)/2;mesh.position.y=(a.y+b.y)/2;mesh.rotation.z=Math.atan2(b.x-a.x,a.y-b.y);mesh.scale.y=Math.hypot(a.x-b.x,a.y-b.y)+.25;});
  const head=p.joints[3];crown.position.x=head.x;crown.position.y=head.y;muzzle.position.set(head.x,head.y,.28);
  petals.forEach((leaf,i)=>{leaf.scale.y=.34+p.open*.24;leaf.position.y=.14+p.open*.10;leaf.rotation.z=.12*Math.sin(age*1.8+i)*(1-p.open);});
  return p;
 }
 pose(0,WORM_FIRST_FIRE,0);return{root,combat,pose};
}
