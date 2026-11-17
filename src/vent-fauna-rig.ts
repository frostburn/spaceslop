import * as T from 'three';
import {SHRIMP_FIRST_FIRE} from './vent-fauna';
import {wormPose,WORM_FIRST_ATTACK,WORM_INTERVAL,WORM_SEGMENTS} from './vent-worm';

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
function rasterAssets(columns:number,rows:number,texture:T.Texture,flexible=false){
 const material=new T.MeshBasicMaterial({map:texture,alphaTest:.5,side:T.DoubleSide});
 const jointMaterial=material.clone();
 const layers=new Map<number,T.MeshBasicMaterial>();
 const geometries=Array.from({length:columns*rows},(_,cell)=>{
  const geometry=new T.CircleGeometry(.5,28),uv=geometry.attributes.uv,pad=.012;
  for(let i=0;i<uv.count;i++)uv.setXY(i,(cell%columns+pad+uv.getX(i)*(1-2*pad))/columns,1-(Math.floor(cell/columns)+1-pad-uv.getY(i)*(1-2*pad))/rows);
  return geometry;
 });
 function part(parent:T.Object3D,cell:number,x:number,y:number,z:number,w:number,h:number){const mesh=new T.Mesh(geometries[cell],flexible&&cell>=6?jointMaterial:material);mesh.position.set(x,y,z);mesh.scale.set(w,h,1);parent.add(mesh);return mesh;}
 material.userData.fallback=texture;
 return{material,geometries,part,layerMaterial(layer:number){let m=layers.get(layer);if(!m){m=material.clone();m.polygonOffset=true;m.polygonOffsetFactor=-1;m.polygonOffsetUnits=-2*layer;layers.set(layer,m);}return m;},setAtlas(texture:T.Texture){texture.anisotropy=4;material.map=texture;material.needsUpdate=true;for(const m of layers.values()){m.map=texture;m.needsUpdate=true;}
  if(flexible){const image=texture.image as {width:number;height:number},rowCount=image.width/image.height>1.3?2:3;
   for(let cell=0;cell<6;cell++){const uv=geometries[cell].attributes.uv,base=new T.CircleGeometry(.5,28).attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,(cell%3+.012+base.getX(i)*.976)/3,1-(Math.floor(cell/3)+1-.012-base.getY(i)*.976)/rowCount);uv.needsUpdate=true;}
   jointMaterial.map=rowCount===3?texture:material.userData.fallback;jointMaterial.needsUpdate=true;
  }}};
}
export function createFaunaAssets(fallback?:T.Texture){return rasterAssets(3,3,fallback??fallbackAtlas(),true);}
export function createWormAssets(fallback?:T.Texture){
 if(fallback)return rasterAssets(3,2,fallback);
 const size=192,canvas=document.createElement('canvas');canvas.width=size*3;canvas.height=size*2;const g=canvas.getContext('2d')!;
 for(let cell=0;cell<6;cell++){
  g.save();g.translate(cell%3*size,Math.floor(cell/3)*size);
  const grad=g.createRadialGradient(75,65,3,96,96,85);grad.addColorStop(0,cell===0?'#a19a81':'#a26d62');grad.addColorStop(1,cell===0?'#263236':'#322027');g.fillStyle=grad;
  g.beginPath();g.ellipse(96,96,cell===0?82:cell===3||cell===4?32:69,cell===5?58:82,0,0,7);g.fill();
  g.save();g.globalCompositeOperation='source-atop';
  for(let i=0;i<13;i++){g.strokeStyle=i%3?'#4f3232':'#b39979';g.lineWidth=3;g.beginPath();g.moveTo(25,28+i*12);g.quadraticCurveTo(96,50+i*12,166,28+i*12);g.stroke();}g.restore();
  if(cell===0||cell===2){g.fillStyle='#10171b';g.beginPath();g.ellipse(96,cell===0?96:125,cell===0?54:42,cell===0?57:36,0,0,7);g.fill();}
  if(cell===2||cell===3||cell===4)for(let i=0;i<7;i++){const x=cell===2?58+i*12:cell===3?111:79,y=cell===2?122:40+i*17;g.fillStyle='#d7c49c';g.beginPath();g.moveTo(x-4,y-7);g.lineTo(x+5,y+4);g.lineTo(x+8,y-8);g.fill();}
  g.restore();
 }
 const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return rasterAssets(3,2,t);
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
 function pose(age:number,nextFire:number,patternCharge?:number){
  const charge=patternCharge??Math.max(0,1-(nextFire-age)/.45),swim=age*7;
  joints.forEach((joint,i)=>{joint.rotation.z=Math.sin(swim-i*.65)*(.08+i*.025);});
  for(const{pivot,elbow,side,pair}of limbs){pivot.rotation.z=-side*(pair===0?2.55+(patternCharge===undefined?.2:.32)*charge:1.2+.35*Math.sin(swim-pair*.8));elbow.rotation.z=side*(.65+.18*Math.sin(swim-pair*.8+.5));}
  for(const{pivot,side}of antennae)pivot.rotation.z=-side*(2.75+.08*Math.sin(age*2.5));
  shell.scale.x=.9*(1-.025*charge);
 }
 pose(0,SHRIMP_FIRST_FIRE);return{root,combat:root,pose};
}
export function createVentWorm(assets:Assets){
 const root=new T.Group();root.name='vent-burrow-worm';
 const foot=assets.part(root,0,0,0,.03,2.15,2.15);foot.name='worm-fixed-hole';

 const disabledMaterial=assets.material.clone();disabledMaterial.color.setHex(0x626d72);
 const combat=new T.Group();combat.name='worm-living-parts';root.add(combat);
 const aim=new T.Group();aim.name='worm-aim';combat.add(aim);
 const warningGeometry=new T.BufferGeometry(),warningPoints=new T.BufferAttribute(new Float32Array(17*3),3);warningGeometry.setAttribute('position',warningPoints);
 const warning=new T.Line(warningGeometry,new T.LineBasicMaterial({color:0xffb37a,transparent:true,opacity:.3,depthWrite:false}));warning.name='worm-lunge-warning';warning.frustumCulled=false;aim.add(warning);
 const body=Array.from({length:WORM_SEGMENTS},(_,i)=>{const m=assets.part(aim,1,0,0,.12+i*.001,.86,.7);m.name='worm-segment-'+i;m.material=assets.layerMaterial(i+1);return m;});
 const head=new T.Group();head.name='worm-head';head.position.z=.24;aim.add(head);
 assets.part(head,5,0,.18,0,.95,.7).material=assets.layerMaterial(WORM_SEGMENTS+1);assets.part(head,2,0,-.04,.01,1.1,1.1).material=assets.layerMaterial(WORM_SEGMENTS+2);
 const jaws=[-1,1].map(side=>{const p=new T.Group();p.name='worm-jaw-'+side;p.position.set(side*.25,-.26,.03);head.add(p);assets.part(p,side<0?3:4,side*.10,-.21,0,.52,.68).material=assets.layerMaterial(WORM_SEGMENTS+3+(side>0?1:0));return{side,p};});
 const muzzle=new T.Object3D();muzzle.name='worm-muzzle';muzzle.position.z=.28;aim.add(muzzle);
 function pose(age:number,nextAttack:number,angle:number,reach=8.5,bend=1){
  const p=wormPose(age,nextAttack,reach,bend),exposure=Math.min(1,p.length/.8);aim.rotation.z=angle;combat.visible=p.visible;
  warning.visible=p.phase==='windup';warning.material.opacity=.25+p.charge*.2;
  if(warning.visible){for(let i=0;i<17;i++){const u=i/16;warningPoints.setXYZ(i,Math.sin(Math.PI*u)*bend,-reach*u,.06);}warningPoints.needsUpdate=true;}
  body.forEach((mesh,i)=>{const a=p.joints[i],b=p.joints[i+1];mesh.visible=Boolean(a&&b);if(!a||!b)return;mesh.position.x=(a.x+b.x)/2;mesh.position.y=(a.y+b.y)/2;mesh.rotation.z=Math.atan2(b.x-a.x,a.y-b.y);mesh.scale.x=(1.4-i*.003)*exposure;mesh.scale.y=Math.hypot(a.x-b.x,a.y-b.y)+.32;});
  const end=p.joints.at(-1)!,previous=p.joints.at(-2)??{x:0,y:0};head.position.x=end.x;head.position.y=end.y;head.rotation.z=Math.atan2(end.x-previous.x,previous.y-end.y);head.scale.setScalar(exposure);muzzle.position.set(end.x,end.y,.28);
  for(const{side,p:joint}of jaws)joint.rotation.z=side*p.jaw*.65;
  return p;
 }
 // Prime every sprite cell before play; the initial live pose may be fully hidden.
 pose(WORM_FIRST_ATTACK+.7,WORM_FIRST_ATTACK+WORM_INTERVAL,0);warning.visible=true;return{root,combat,pose,setDisabled(disabled:boolean){if(disabledMaterial.map!==assets.material.map){disabledMaterial.map=assets.material.map;disabledMaterial.needsUpdate=true;}foot.material=disabled?disabledMaterial:assets.material;if(disabled)combat.visible=false;}};
}
