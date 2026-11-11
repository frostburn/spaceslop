import * as T from 'three';
import {groveScroll} from './route';
type Actor={x:number;y:number};
const COUNT=64;
const hash=(i:number)=>{const n=Math.sin(i*127.1+31.7)*43758.5453;return n-Math.floor(n);};
/** Harmless, bounded background insects; the presentation clock freezes them. */
export function createGroveEcology(){
 const root=new T.Group();root.name='grove-fireflies';
 const sphere=new T.SphereGeometry(.025,5,4);
 const flies=new T.InstancedMesh(sphere,new T.MeshBasicMaterial({color:0xc4ff66}),COUNT);flies.frustumCulled=false;root.add(flies);
 const halos=new T.InstancedMesh(sphere,new T.MeshBasicMaterial({color:0x9cff66,transparent:true,opacity:.12,depthWrite:false,blending:T.AdditiveBlending}),COUNT);halos.frustumCulled=false;root.add(halos);
 const dummy=new T.Object3D(),state=Array.from({length:COUNT},(_,i)=>({x:(hash(i)-.5)*8,y:(hash(i+100)-.5)*18}));
 let last=NaN,scroll=0;
 function update(stage:number,time:number,actors:readonly Actor[]=[]){
  if(time===last)return;
  const next=groveScroll(stage)*16,fresh=!Number.isFinite(last)||time<last||Math.abs(time-last)>1||Math.abs(next-scroll)>3;
  const dt=fresh?0:Math.min(.12,time-last),travel=fresh?0:next-scroll;last=time;scroll=next;
  for(let i=0;i<COUNT;i++){
   const f=state[i];if(fresh){f.x=(hash(i)-.5)*8;f.y=(hash(i+100)-.5)*18;}
   f.x+=.27*Math.sin(time*1.3+i*7)*dt;f.y+=.2*Math.cos(time*.9+i*4)*dt-travel;
   if(f.y < -10)f.y=10;if(f.y>11)f.y=-9;f.x=Math.max(-4.2,Math.min(4.2,f.x));
   for(let pass=0;pass<4;pass++)for(const a of actors){const dx=f.x-a.x,dy=f.y-a.y,d=Math.hypot(dx,dy);if(d<1.05){const angle=d>1e-6?Math.atan2(dy,dx):i;f.x=a.x+Math.cos(angle)*1.05;f.y=a.y+Math.sin(angle)*1.05;}}
   const z=-1.35,k=(22-z)/22;dummy.position.set(f.x*k,f.y*k,z);dummy.scale.setScalar(.7+.3*Math.sin(time*4+i));dummy.updateMatrix();flies.setMatrixAt(i,dummy.matrix);dummy.scale.multiplyScalar(3);dummy.updateMatrix();halos.setMatrixAt(i,dummy.matrix);
  }flies.instanceMatrix.needsUpdate=true;halos.instanceMatrix.needsUpdate=true;
 }
 return{root,update,state};
}
