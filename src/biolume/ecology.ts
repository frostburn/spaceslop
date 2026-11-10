import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {groveScroll} from './route';
type Actor={x:number;y:number};
const COUNT=64,sites=Array.from({length:11},(_,i)=>({x:(i%2?1:-1)*(2.8+.35*Math.sin(i*3)),at:.65+i*.75}));
const hash=(i:number)=>{const n=Math.sin(i*127.1+31.7)*43758.5453;return n-Math.floor(n);};
/** Bounded scenery, driven only by the frozen presentation clock. */
export function createGroveEcology(){
 const root=new T.Group();root.name='grove-fireflies-and-sundews';
 const glow=new T.MeshBasicMaterial({color:0xc4ff66}),pink=new T.MeshBasicMaterial({color:0xff69d4});
 const leafMaterial=new T.MeshStandardMaterial({color:0x286042,emissive:0x133824,roughness:.9,side:T.DoubleSide});
 const sphere=new T.SphereGeometry(.025,5,4),leaf=new T.SphereGeometry(1,8,5);
 const flies=new T.InstancedMesh(sphere,glow,COUNT);flies.frustumCulled=false;root.add(flies);
 const halos=new T.InstancedMesh(sphere,new T.MeshBasicMaterial({color:0x9cff66,transparent:true,opacity:.12,depthWrite:false,blending:T.AdditiveBlending}),COUNT);halos.frustumCulled=false;root.add(halos);
 const pieces=Array.from({length:15},(_,k)=>sphere.clone().translate(.32+k*.028,Math.sin(k*9)*.12,.055));
 pieces.push(sphere.clone().translate(.72,0,.04));const glands=mergeGeometries(pieces);pieces.forEach(g=>g.dispose());
 const dummy=new T.Object3D(),plants=sites.map((site,i)=>{
  const group=new T.Group();root.add(group);
  const leaves=Array.from({length:10},(_,j)=>{
   const pivot=new T.Group();pivot.rotation.z=j*Math.PI/5+.12*Math.sin(j*7+i);group.add(pivot);
   const blade=new T.Mesh(leaf,leafMaterial);blade.position.x=.4;blade.scale.set(.42,.11,.025);pivot.add(blade);
   const tip=new T.Mesh(glands,pink);pivot.add(tip);
   return{pivot,tip,caught:-Infinity};
  });return{site,group,leaves};
 });
 const state=Array.from({length:COUNT},(_,i)=>({x:(hash(i)-.5)*8,y:(hash(i+100)-.5)*18,trap:-1,age:0}));
 let last=NaN,scroll=0,captures=0;
 function tipAt(index:number){const p=plants[Math.floor(index/10)],l=p.leaves[index%10];return{x:p.group.position.x/((22+2.9)/22)+.72*Math.cos(l.pivot.rotation.z)*Math.cos(l.pivot.rotation.y),y:p.group.position.y/((22+2.9)/22)+.72*Math.sin(l.pivot.rotation.z)*Math.cos(l.pivot.rotation.y)};}
 function update(stage:number,time:number,actors:readonly Actor[]=[]){
  if(time===last)return;
  const fresh=!Number.isFinite(last)||time<last||Math.abs(time-last)>1;
  const dt=fresh?0:Math.min(.12,time-last),next=groveScroll(stage)*16,travel=fresh?0:next-scroll;last=time;scroll=next;
  plants.forEach(p=>{const k=(22+2.9)/22;p.group.position.set(p.site.x*k,((p.site.at-.5)*16-next)*k,-2.9);p.group.scale.setScalar(k);p.group.visible=Math.abs(p.group.position.y)<10;
   p.leaves.forEach(l=>{if(fresh)l.caught=-Infinity;const age=time-l.caught;l.pivot.rotation.y=age<6?Math.min(1,age/1.6)*1.2:age<8?(8-age)/2*1.2:0;});});
  for(let i=0;i<COUNT;i++){
   const f=state[i];if(fresh){f.x=(hash(i)-.5)*8;f.y=(hash(i+100)-.5)*18;f.trap=-1;}
   f.age+=dt;
   if(f.trap>=0){const tip=tipAt(f.trap);f.x=tip.x;f.y=tip.y;if(time-plants[Math.floor(f.trap/10)].leaves[f.trap%10].caught>4.4){f.trap=-1;f.y=9+hash(i);}}
   else{
    f.y-=travel;let target=-1,distance=3;
    plants.forEach((p,pi)=>{if(!p.group.visible)return;p.leaves.forEach((l,li)=>{if(time-l.caught<8)return;const index=pi*10+li,t=tipAt(index),d=Math.hypot(t.x-f.x,t.y-f.y);if(d<distance){distance=d;target=index;}});});
    let vx=.27*Math.sin(time*1.3+i*7),vy=.2*Math.cos(time*.9+i*4);
    if(target>=0){const t=tipAt(target);vx+=(t.x-f.x)*.8;vy+=(t.y-f.y)*.8;}
    f.x+=vx*dt;f.y+=vy*dt;
    for(let pass=0;pass<4;pass++)for(const a of actors){const dx=f.x-a.x,dy=f.y-a.y,d=Math.hypot(dx,dy);if(d<1.05){const angle=d>1e-6?Math.atan2(dy,dx):i;f.x=a.x+Math.cos(angle)*1.05;f.y=a.y+Math.sin(angle)*1.05;}}
    if(target>=0){const t=tipAt(target);if(Math.hypot(t.x-f.x,t.y-f.y)<.15){f.trap=target;plants[Math.floor(target/10)].leaves[target%10].caught=time;captures++;}}
    if(f.y < -10)f.y=10;if(f.y>11)f.y=-9;f.x=Math.max(-4.2,Math.min(4.2,f.x));
   }
   const z=f.trap>=0?-2.8:-1.35,k=(22-z)/22;dummy.position.set(f.x*k,f.y*k,z);dummy.scale.setScalar(.7+.3*Math.sin(time*4+i));dummy.updateMatrix();flies.setMatrixAt(i,dummy.matrix);dummy.scale.multiplyScalar(3);dummy.updateMatrix();halos.setMatrixAt(i,dummy.matrix);
  }flies.instanceMatrix.needsUpdate=true;halos.instanceMatrix.needsUpdate=true;
 }
 return{root,update,state,plants,get captures(){return captures;}};
}
