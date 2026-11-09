import * as T from 'three';
import {part,plating,pivot} from './rig-geometry';
import {mergeBoulevard} from './boulevard-geometry';
import {BOULEVARD_DECK} from './boulevard';
import {FOUNTAIN_Y} from './boulevard-layout';
import type {BoulevardMaterials} from './boulevard-materials';
const PERIOD=144,COUNT=16,BIKES=4,TRAIL_SAMPLES=22,TRAIL_TIME=.46;
const smooth=(a:number,b:number,x:number)=>T.MathUtils.smoothstep(x,a,b);
function roadY(time:number,scroll:number,speed:number,phase:number){return scroll+((phase+speed*time-scroll+38)%PERIOD+PERIOD)%PERIOD-38;}
function detour(x:number,y:number){return Math.sign(x)*(Math.abs(x)+Math.max(0,2.2-Math.abs(x))*(1-smooth(1.5,5,Math.abs(y-FOUNTAIN_Y))));}
type TrafficPose={x:number;y:number;direction:number;pass:number};
export function boulevardCarPose(time:number,scroll:number,index:number,out:TrafficPose={x:0,y:0,direction:0,pass:0}){
 const direction=index%2?1:-1,y=roadY(time,scroll,direction*2.6,index*PERIOD/COUNT),x=detour(direction*1.25,y);
 out.x=x;out.y=y;out.direction=direction;out.pass=0;return out;
}
export function boulevardBikePose(time:number,scroll:number,index:number,out:TrafficPose={x:0,y:0,direction:0,pass:0}){
 const direction=index%2?1:-1,y=roadY(time,scroll,direction*(direction>0?8:7.5),index*31+17);let pass=0;
 for(let i=0;i<COUNT;i++){if((i%2?1:-1)!==direction)continue;const carY=roadY(time,scroll,direction*2.6,i*PERIOD/COUNT);pass=Math.max(pass,Math.exp(-(((y-carY)/2.8)**2)));}
 const lane=1.25+.22*Math.sin(time*1.15+index*2.7)+1.15*pass;
 const fountain=1-smooth(3.5,8,Math.abs(y-FOUNTAIN_Y));out.x=direction*T.MathUtils.lerp(Math.abs(detour(direction*lane,y)),2.85,fountain);out.y=y;out.direction=direction;out.pass=pass;return out;
}
export function createBoulevardTraffic(m:BoulevardMaterials){
 const root=new T.Group();root.name='boulevard-background-traffic';
 const white=new T.MeshBasicMaterial({color:new T.Color(0xfff4dc).multiplyScalar(2),toneMapped:false}),red=new T.MeshBasicMaterial({color:new T.Color(0xff170a).multiplyScalar(2.2),toneMapped:false}),amber=new T.MeshBasicMaterial({color:0xff9f26,toneMapped:false}),rubber=new T.MeshStandardMaterial({color:0x13131b,roughness:.9});
 const car=new T.Group();part(car,new T.BoxGeometry(.42,.88,.18),m.shell,0,0,.08);part(car,new T.BoxGeometry(.33,.38,.13),m.glass,0,.06,.22);
 for(const side of[-1,1]){
  part(car,new T.BoxGeometry(.09,.028,.05),white,side*.135,-.447,.11);part(car,new T.BoxGeometry(.085,.027,.045),red,side*.14,.447,.11);
  for(const y of[-.27,.28])part(car,new T.CylinderGeometry(.077,.077,.045,8).rotateZ(Math.PI/2),rubber,side*.215,y,.025);
 }
 mergeBoulevard(car);
 const bikePaint=new T.MeshStandardMaterial({color:0x243238,roughness:.72,metalness:.18}),bikeFront=new T.MeshBasicMaterial({color:0xb2bbb1,toneMapped:false}),bikeRear=new T.MeshBasicMaterial({color:0x8a241b,toneMapped:false});
 const bike=new T.Group();for(const y of[-.27,.27])part(bike,new T.CylinderGeometry(.12,.12,.065,10).rotateZ(Math.PI/2),rubber,0,y,.08);
 part(bike,plating([[-.13,.30],[.13,.30],[.17,-.25],[0,-.43],[-.17,-.25]],.12,.025),bikePaint,0,0,.18);
 part(bike,new T.BoxGeometry(.09,.028,.04),bikeFront,0,-.41,.23);part(bike,new T.BoxGeometry(.07,.025,.035),bikeRear,0,.34,.24);
 part(bike,new T.CapsuleGeometry(.075,.19,3,6),rubber,0,.02,.33).rotation.x=.65;
 part(bike,new T.SphereGeometry(.095,8,6),bikePaint,0,-.08,.48);part(bike,new T.BoxGeometry(.36,.025,.025),rubber,0,-.18,.31);mergeBoulevard(bike);
 const indicatorGeometry=new T.BoxGeometry(.035,.04,.04);
 const cars=Array.from({length:COUNT},(_,i)=>{const r=car.clone(true),indicators=[-1,1].map(side=>{const turn=new T.Group();for(const y of[-.43,.43])part(turn,indicatorGeometry,amber,side*.19,y,.14);r.add(turn);return turn;});root.add(r);return{root:r,index:i,indicators};});
 const bikes=Array.from({length:BIKES},(_,i)=>{const r=new T.Group(),lean=pivot(r,'traffic-bike-lean',0,0,0);lean.add(bike.clone(true));root.add(r);return{root:r,lean,index:i};});
 const warmObjects=[...cars.map(c=>c.root),...bikes.map(b=>b.root),...cars.flatMap(c=>c.indicators)];let warmSaved:boolean[]=[];
 const trailMaterial=new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.45,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
 const trails=new T.InstancedMesh(new T.CylinderGeometry(1,1,1,6),trailMaterial,BIKES*TRAIL_SAMPLES);trails.name='boulevard-bike-light-trails';trails.instanceMatrix.setUsage(T.DynamicDrawUsage);trails.frustumCulled=false;root.add(trails);
 const dummy=new T.Object3D(),a=new T.Vector3(),b=new T.Vector3(),delta=new T.Vector3(),up=new T.Vector3(0,1,0),color=new T.Color();
 for(let i=0;i<trails.count;i++)trails.setColorAt(i,color.setRGB(0,0,0));
 const scratch=()=>({x:0,y:0,direction:0,pass:0}),position=scratch(),previous=scratch(),tangentA=scratch(),tangentB=scratch();
 const history=Array.from({length:TRAIL_SAMPLES+2},scratch),tails=Array.from({length:TRAIL_SAMPLES+1},()=>new T.Vector3());
 function tangent(time:number,scroll:number,index:number,bike=false){const pose=bike?boulevardBikePose:boulevardCarPose,p=pose(time,scroll,index,tangentA),q=pose(time+.015,scroll,index,tangentB);return Math.atan2(q.x-p.x,-(q.y-p.y));}
 return{root,cars,bikes,trails,update(scroll:number,time:number){
  for(const c of cars){const p=boulevardCarPose(time,scroll,c.index,position),angle=tangent(time,scroll,c.index);c.root.position.set(p.x,p.y,BOULEVARD_DECK+.08);c.root.rotation.z=angle;c.root.scale.setScalar(1-smooth(70,100,p.y-scroll));c.root.visible=p.y-scroll>-30&&p.y-scroll<100;
   const before=boulevardCarPose(time-.25,scroll,c.index,previous),turn=-(p.x-before.x)*p.direction;for(let i=0;i<2;i++)c.indicators[i].visible=Math.abs(turn)>.015&&((time+c.index*.23)%1)<.5&&(i===0?turn<0:turn>0);
  }
  for(const bike of bikes){const p=boulevardBikePose(time,scroll,bike.index,position),before=boulevardBikePose(time-.02,scroll,bike.index,previous),heading=Math.atan2(p.x-before.x,-(p.y-before.y));bike.root.position.set(p.x,p.y,BOULEVARD_DECK+.08);bike.root.rotation.z=heading;bike.root.scale.setScalar(1-smooth(70,100,p.y-scroll));bike.lean.rotation.y=T.MathUtils.clamp((p.x-before.x)*5,-.35,.35);bike.root.visible=p.y-scroll>-30&&p.y-scroll<100;
   for(let n=0;n<history.length;n++)boulevardBikePose(time-n/TRAIL_SAMPLES*TRAIL_TIME,scroll,bike.index,history[n]);
   for(let n=0;n<tails.length;n++){const q=history[n],r=history[n+1];delta.set(r.x-q.x,r.y-q.y,0).normalize();const lean=T.MathUtils.clamp((q.x-r.x)/(TRAIL_TIME/TRAIL_SAMPLES)*.1,-.35,.35),side=.24*Math.sin(lean);tails[n].set(q.x+delta.x*.34+delta.y*side,q.y+delta.y*.34-delta.x*side,BOULEVARD_DECK+.08+.24*Math.cos(lean));}
   for(let n=0;n<TRAIL_SAMPLES;n++){a.copy(tails[n]);b.copy(tails[n+1]);delta.subVectors(b,a);const distance=delta.length(),fade=(1-n/TRAIL_SAMPLES)**2*(1-smooth(70,100,history[n].y-scroll));
    dummy.position.copy(a).add(b).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(up,delta.normalize());dummy.scale.set(.012*(1-n/TRAIL_SAMPLES*.6),distance<2&&bike.root.visible?distance:0,.012*(1-n/TRAIL_SAMPLES*.6));dummy.updateMatrix();trails.setMatrixAt(bike.index*TRAIL_SAMPLES+n,dummy.matrix);trails.setColorAt(bike.index*TRAIL_SAMPLES+n,color.setRGB(.035*fade,.68*fade,.24*fade));
   }
  }trails.instanceMatrix.needsUpdate=true;if(trails.instanceColor)trails.instanceColor.needsUpdate=true;
 },prime(active:boolean){if(active){warmSaved=warmObjects.map(o=>o.visible);warmObjects.forEach(o=>o.visible=true);}else if(warmSaved.length){warmObjects.forEach((o,i)=>o.visible=warmSaved[i]);warmSaved=[];}trails.frustumCulled=false;}};
}
