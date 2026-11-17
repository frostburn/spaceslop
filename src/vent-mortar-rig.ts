import * as T from 'three';
import {mortarPose,MORTAR_REACH} from './vent-mortar';

function fallbackAtlas(){
 const size=256,canvas=document.createElement('canvas');canvas.width=size*3;canvas.height=size*2;const c=canvas.getContext('2d')!;
 for(let cell=0;cell<6;cell++){
  c.save();c.translate(cell%3*size,Math.floor(cell/3)*size);
  const shell=cell===0||cell===2||cell===3,neck=cell===4;
  const g=c.createRadialGradient(105,90,10,128,128,115);g.addColorStop(0,shell?'#a39879':'#8b4e45');g.addColorStop(1,shell?'#303d3e':'#381b22');c.fillStyle=g;
  c.beginPath();c.ellipse(128,128,shell?96:neck?51:83,cell===0?78:neck?106:99,cell===2?-.3:cell===3?.3:0,0,Math.PI*2);c.fill();
  c.strokeStyle=shell?'#c5c0a1':'#aa6d59';c.lineWidth=4;c.stroke();
  if(cell===0||cell===5){c.beginPath();c.ellipse(128,128,cell===0?58:42,cell===0?47:38,0,0,Math.PI*2);c.fillStyle=cell===0?'#251d22':'#dc8b24';c.fill();}
  c.globalCompositeOperation='source-atop';
  for(let i=0;i<23;i++){const x=45+(i*71%170),y=35+(i*37%188);c.strokeStyle=shell?(i%3?'#596362':'#c2b493'):'#512a2c';c.lineWidth=2+i%3;c.beginPath();c.moveTo(x,y);c.lineTo(x+18,y+8);c.stroke();}
  c.restore();
 }
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
}
export function createMortarAssets(fallback?:T.Texture){
 const material=new T.MeshBasicMaterial({map:fallback??fallbackAtlas(),alphaTest:.45,side:T.DoubleSide});
 const geometries=Array.from({length:6},(_,cell)=>{
  const g=new T.CircleGeometry(.5,28),uv=g.attributes.uv,col=cell%3,row=Math.floor(cell/3),pad=.015;
  for(let i=0;i<uv.count;i++)uv.setXY(i,(col+pad+uv.getX(i)*(1-pad*2))/3,1-(row+1-pad-uv.getY(i)*(1-pad*2))/2);
  return g;
 });
 return{material,geometries,setAtlas(texture:T.Texture){texture.anisotropy=4;material.map=texture;material.needsUpdate=true;}};
}
export function createVentMortar(assets:ReturnType<typeof createMortarAssets>){
 const root=new T.Group();root.name='vent-barnacle-mortar';
 const combat=new T.Group();combat.name='mortar-living-parts';root.add(combat);
 function part(parent:T.Object3D,cell:number,x:number,y:number,z:number,w:number,h:number){const mesh=new T.Mesh(assets.geometries[cell],assets.material);mesh.position.set(x,y,z);mesh.scale.set(w,h,1);parent.add(mesh);return mesh;}
 const base=part(root,0,0,0,.02,1.95,1.75);base.name='mortar-fixed-foot';
 const head=new T.Group();head.name='mortar-aim';combat.add(head);
 const flesh=part(head,1,0,.02,.09,1.15,1.25);flesh.name='mortar-body';
 const leaves=[-1,1].map(side=>{
  const pivot=new T.Group();pivot.name=side<0?'mortar-shell-L':'mortar-shell-R';pivot.position.set(side*.22,-.10,.19);head.add(pivot);
  part(pivot,side<0?2:3,side*.19,.28,0,.78,.95);return{side,pivot};
 });
 const neck=part(head,4,0,-.30,.14,.42,.52);neck.name='mortar-siphon';
 const mouth=part(head,5,0,-MORTAR_REACH,.23,.46,.46);mouth.name='mortar-aperture';
 const muzzle=new T.Object3D();muzzle.name='mortar-muzzle';head.add(muzzle);
 const ring=new T.Mesh(new T.CircleGeometry(.12,20),new T.MeshBasicMaterial({color:0xffa846,transparent:true,opacity:.3,blending:T.AdditiveBlending,depthWrite:false}));ring.position.z=.24;head.add(ring);
 function pose(age:number,nextFire:number,angle:number,patternCharge?:number){
  const p=mortarPose(age,nextFire,patternCharge);head.rotation.z=angle;
  flesh.scale.y=1.25*(1-.06*p.charge+.05*p.recoil);
  for(const{side,pivot}of leaves)pivot.rotation.z=-side*(-.18+p.opening*.72);
  neck.position.y=-.30-p.extension*.5;neck.scale.y=.52+p.extension;
  mouth.position.y=-MORTAR_REACH-p.extension;muzzle.position.set(0,mouth.position.y,.24);
  ring.position.y=mouth.position.y;ring.scale.setScalar(.6+p.charge*.3+p.recoil*.5);
  return p;
 }
 pose(0,1.8,0);return{root,combat,pose};
}
