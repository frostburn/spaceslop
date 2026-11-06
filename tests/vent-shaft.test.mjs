import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const v=await server.ssrLoadModule('/src/vent-layout.ts'),c=await server.ssrLoadModule('/src/vent-crab.ts'),{Flight}=await server.ssrLoadModule('/src/game.ts'),{createVentGeology}=await server.ssrLoadModule('/src/vent-geology.ts');
const {createVentFormations}=await server.ssrLoadModule('/src/vent-formations.ts');
function frame(time,rise){const f=v.ventFrame(time,rise),p=v.ventWorld(0,0,0,time,rise);return new T.Matrix4().compose(new T.Vector3(p.x,p.y,p.z),new T.Quaternion().setFromEuler(new T.Euler(-f.pitch,0,f.yaw,'XYZ')),new T.Vector3(1,1,1));}
function eye(time,rise){const distance=40+(22-40)*rise;return new T.Vector3(0,0,distance).applyMatrix4(frame(time,rise).invert());}

test('the approach carries the camera beyond the near lip and over a deep, uncapped circular shaft',()=>{
 const start=eye(100,0),end=eye(108,1);assert(start.y<v.ventCliffEdge(start.x));assert(end.y>v.ventCliffEdge(end.x)+10);assert(Math.hypot(end.x,end.y-v.VENT_SHAFT_Y)<v.VENT_SHAFT_RADIUS-10);assert(end.z>5);
 const geology=createVentGeology();geology.updateMatrixWorld(true);const ray=new T.Raycaster(end,new T.Vector3(0,0,-1));assert.equal(ray.intersectObject(geology,true).length,0,'open water must extend downward without an opaque floor');
 const downward=new T.Raycaster(new T.Vector3(4,140,2),new T.Vector3(0,0,-1)).intersectObject(geology,true);assert(Math.abs(downward[0].point.z-v.ventFloor(4,140))<.5,'rim shelf covers the existing corridor floor');
 const wall=geology.getObjectByName('abyss-cliff-faces').geometry.attributes.position;let low=0;for(let i=0;i<wall.count;i++)low=Math.min(low,wall.getZ(i));assert(low<-70);
});

test('world transforms agree with the scene matrix throughout peering and circular tracking',()=>{
 for(const time of [0,99.9,100,102,104,106,108,110,111,114.5,116,120,134]){
  const rise=v.ventSmooth((time-100)/8),m=frame(time,rise);for(const point of [[3,153,-2],[0,201,-20],[-8,180,-40]]){const p=new T.Vector3(...point).applyMatrix4(m),q=v.ventWorld(...point,time,rise);assert(Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)<1e-9);}
 }
});

test('both claws and the gills remain in front of the terrain through the reveal and every scurry',()=>{
 const geology=createVentGeology();geology.updateMatrixWorld(true);
 for(const time of [103,104,105,106,107,108,110,111,113,114.5,116,119,122]){
  const rise=v.ventSmooth((time-100)/8),fight=Math.max(0,time-108),boss=v.ventBossPose(rise,fight),origin=eye(time,rise),orbit=v.ventOrbit(fight);
  const rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),-orbit.yaw).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),v.VENT_PITCH));
  for(const x of [-2.4,0,2.4]){const target=new T.Vector3(x,0,.815).applyQuaternion(rotation).add(new T.Vector3(boss.x,boss.y,boss.z)),direction=target.clone().sub(origin),length=direction.length();const ray=new T.Raycaster(origin,direction.normalize(),0,length-.05);assert.equal(ray.intersectObject(geology,true).length,0,'terrain obscures weakpoint at '+time);}
 }
 const fronts=createVentFormations().filter(f=>f.front);assert(fronts.length>100);for(const f of fronts)assert(Math.hypot(f.x,f.y-v.VENT_SHAFT_Y)>v.VENT_CRAB_RADIUS+2,'wall artwork intrudes into the crab space');
});

test('scurrying moves the crab sideways while the circular wall counter-scrolls, with stable combat depth',()=>{
 const a=v.ventWorld(0,v.VENT_SHAFT_Y+24,-12,108,1),b=v.ventWorld(0,v.VENT_SHAFT_Y+24,-12,111,1);assert(b.x<a.x-5);
 for(const t of [0,2,3,6,8,11,12,26]){
  const boss=v.ventBossPose(1,t),p=v.ventWorld(boss.x,boss.y,boss.z,108+t,1),f=new Flight('sentry',[],'vex','vents');f.phase='boss';f.time=t;
  assert(Math.abs(p.x-v.ventOrbit(t).offsetX)<1e-8);assert(Math.abs(p.y-4.2)<1e-8);assert(Math.abs(p.z+12)<1e-8);assert(Math.abs(f.exposedCannonX-(p.x+f.crabTargetX))<1e-8);
  f.damageBoss(12);f.damageBoss(12);assert(f.crabCoreOpen);assert(Math.abs(f.exposedCannonX-p.x)<1e-8);
 }
 assert(v.ventOrbit(3).angle>0&&v.ventOrbit(8).angle<0);assert.equal(v.ventOrbit(4).speed,0);
});

test('planted feet hold their wall anchors while other legs take sideways steps',()=>{
 const worldFeet=t=>{const o=v.ventOrbit(t),boss=v.ventBossPose(1,t),r=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),-o.yaw).multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),v.VENT_PITCH));return c.crabFeet(1,t).map(p=>new T.Vector3(p.x,p.y,p.z).applyQuaternion(r).add(new T.Vector3(boss.x,boss.y,boss.z)));};
 let planted=0,lifted=0;for(const t of [1.4,1.7,2,2.3,5.5,6.5,7]){const a=worldFeet(t),b=worldFeet(t+1e-5),o=v.ventOrbit(t);for(let i=0;i<8;i++){const phase=((o.angle*24/1.25+i*.31)%1+1)%1,radius=Math.hypot(a[i].x,a[i].y-v.VENT_SHAFT_Y);if(phase>.03&&phase<.62){assert(a[i].distanceTo(b[i])<1e-7);planted++;}if(radius<23.4)lifted++;}}
 assert(planted>10);assert(lifted>5);
});

test('normal ship fire keeps damaging a moving claw without relaxing phase locks',()=>{
 const f=new Flight('sentry',[],'vex','vents');f.phase='boss';f.time=2;f.stepBoss=()=>{};f.cooldown=f.droneCooldown=1000;f.fire(f.player);assert.equal(f.shots[0].crabTarget,f.crabTargetX);const before=f.bossHealth;f.step(.4);assert(f.bossHealth<before);
});
