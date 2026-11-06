import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const v=await server.ssrLoadModule('/src/vent-layout.ts');
const {Flight,STEP,BOSS_PROJECTION}=await server.ssrLoadModule('/src/game.ts');
const {createVentGeology}=await server.ssrLoadModule('/src/vent-geology.ts');
const {createVentBoss}=await server.ssrLoadModule('/src/vent-boss.ts');
const {ventCardGeometry}=await server.ssrLoadModule('/src/vent-atlas.ts');
const {levels,readLevel}=await server.ssrLoadModule('/src/levels.ts');

test('Hadal has ten screens of prototype patrols and scenery sentries, a quiet approach and a winnable media-free boss',()=>{
 assert.equal(readLevel('vents'),'vents');assert.equal(levels.vents.duration,100);assert.equal(v.ventWaves.filter(w=>w.ventAnchor!==undefined).length,6);
 const f=new Flight('sentry',[],'vex','vents'),drops=new Set(),anchors=new Set();let peak=0,sawApproach=false,sawBoss=false;
 for(let i=0;i<11000&&!['won','lost'].includes(f.phase);i++){
  f.invulnerable=100;f.step(STEP);peak=Math.max(peak,f.enemies.length);
  for(const e of f.enemies){if(e.ventAnchor!==undefined)anchors.add(e.ventAnchor);if(e.drop)drops.add(e.drop);}
  if(f.phase==='approach'){sawApproach=true;assert.equal(f.transitionDuration,8);assert.equal(f.enemies.length+f.shots.length+f.threats.length,0);}
  if(f.phase==='boss')sawBoss=true;
 }
 assert(sawApproach&&sawBoss);assert.equal(f.phase,'won');assert.equal(anchors.size,6);assert.equal(drops.size,4);assert(peak<=12);
 const again=new Flight('sentry',[],'vex','vents');assert.equal(again.time,0);assert.equal(again.bossHealth,30);
});

test('scroll coasts with matching velocity at the cliff, and camera/boss positions are continuous with settled endpoints',()=>{
 const h=1e-4,d=v.VENT_DURATION,end=d+v.VENT_APPROACH;
 assert(Math.abs((v.ventScroll(d)-v.ventScroll(d-h))/h-v.VENT_SPEED)<1e-6);
 assert(Math.abs((v.ventScroll(d+h)-v.ventScroll(d))/h-v.VENT_SPEED)<2e-5);
 assert(Math.abs(v.ventScroll(end+h)-v.ventScroll(end-h))<1e-8);
 const pose=(t)=>{const rise=v.ventSmooth((t-d)/v.VENT_APPROACH),boss=v.ventBossPose(rise);return {...v.ventWorld(2,153,-2,t,rise),boss:v.ventWorld(boss.x,boss.y,boss.z,t,rise),frame:v.ventFrame(t,rise)};};
 for(let t=0;t<end;t+=.05){const a=pose(t),b=pose(t+.05);assert(Number.isFinite(a.x+a.y+a.z+a.boss.x+a.boss.y+a.boss.z));assert(Math.abs(b.frame.pitch-a.frame.pitch)<.02);}
 for(const t of [d,end]){
  const a=pose(t-h),b=pose(t),c=pose(t+h);
  for(const key of ['x','y','z'])assert(Math.abs((c[key]-b[key])/h-(b[key]-a[key])/h)<.001);
 }
 const final=v.ventBossPose(1),point=v.ventWorld(final.x,final.y,final.z,end,1);
 assert(Math.abs(point.x)<1e-8);assert(Math.abs(point.y-4.2)<1e-8);assert(Math.abs(point.z+12)<1e-8);
 assert(v.ventBossPose(0).x<-7);assert(v.ventBossPose(0).z<-6);
 const offset=final.y-v.ventFarEdge(0);for(let r=0;r<=1;r+=.02){const b=v.ventBossPose(r);assert(Math.abs(b.y-v.ventFarEdge(b.x)-offset)<1e-8,'proxy must follow the actual far rim');}
});

test('the corridor has an actual abyss gap and a cliff drop, with floor cards separated from head-on cells',()=>{
 const geology=createVentGeology(),shelf=geology.getObjectByName('finite-corridor-shelves'),wall=geology.getObjectByName('abyss-cliff-faces');
 const p=shelf.geometry.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);assert(y<=v.ventCliffEdge(x)+.0001||y>=v.ventFarEdge(x)-.0001,'seabed bridges the abyss');}
 wall.geometry.computeBoundingBox();assert(wall.geometry.boundingBox.min.z<-35);assert(wall.geometry.boundingBox.max.z>=1.4);
 for(let cell=0;cell<8;cell++){
  const uv=ventCardGeometry(cell).attributes.uv;
  for(let i=0;i<uv.count;i++){assert(uv.getX(i)>cell%4/4&&uv.getX(i)<(cell%4+1)/4);assert(cell<4?uv.getY(i)>.5:uv.getY(i)<.5);}
 }
});

test('anchored targets project from fixed world points and remain stationary relative to their shelves',()=>{
 for(let i=0;i<v.ventAnchors.length;i++)for(let t=v.ventAnchors[i].time;t<v.ventAnchors[i].time+12;t+=.2){
  const a=v.ventAnchors[i],point=v.ventWorld(a.x,a.y,a.z,t,0),actual=v.ventAnchorPoint(i,t),scale=40/(40-point.z);
  assert(Math.abs(actual.x-point.x*scale)<1e-9);assert(Math.abs(actual.y-point.y*scale)<1e-9);assert(actual.scale>0&&actual.scale<1);
 }
 const f=new Flight('sentry',[],'vex','vents');f.fire=()=>{};f.stepDroneWeapon=()=>{};
 const enemy={...v.ventAnchorPoint(0,9),ventAnchor:0,lane:0,age:0,fire:20,hp:2};f.enemies=[enemy];f.time=9;f.step(STEP);
 const expected=v.ventAnchorPoint(0,f.time);assert.equal(enemy.x,expected.x);assert.equal(enemy.y,expected.y);
});

test('prototype boss weakpoints match ordinary boss combat and every wing weapon can damage it',()=>{
 const rig=createVentBoss(),end=v.VENT_DURATION+v.VENT_APPROACH,b=v.ventBossPose(1),world=new T.Group();world.add(rig.root);world.rotation.x=-v.VENT_PITCH;
 const origin=v.ventWorld(0,0,0,end,1);world.position.set(origin.x,origin.y,origin.z);rig.root.position.set(b.x,b.y,b.z);rig.root.rotation.x=v.VENT_PITCH;world.updateMatrixWorld(true);
 const p=new T.Vector3();rig.root.getWorldPosition(p);assert(Math.abs(p.y-4.2)<1e-8);assert(Math.abs(p.z+12)<1e-8);
 for(const[side,name]of[[-1,'laser_contact_L'],[1,'laser_contact_R']]){rig.root.getObjectByName(name).getWorldPosition(p);assert(Math.abs(p.x-side*2.4)<1e-8);assert(Math.abs(p.y-4.2)<1e-8);}
 for(const weapon of ['homing','cannon','laser','omega']){
  const f=new Flight('sentry',[weapon,weapon],'vex','vents');f.phase='boss';f.cooldown=1000;f.droneCooldown=1000;
  for(let i=0;i<500&&f.bossHealth===30;i++){f.player.x=f.exposedCannonX*BOSS_PROJECTION-1.2;f.invulnerable=100;f.step(STEP);}
  assert(f.bossHealth<30,weapon);
 }
});
