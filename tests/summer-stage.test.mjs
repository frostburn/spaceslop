import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,define:{__ENCOUNTER_TEXTURES__:'{}'},server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});
after(()=>server.close());
const {Flight,STEP,BOSS_PROJECTION}=await server.ssrLoadModule('/src/game.ts');
const c=await server.ssrLoadModule('/src/summer/combat.ts'),layout=await server.ssrLoadModule('/src/summer/layout.ts');
const {createLevel}=await server.ssrLoadModule('/src/rendering/levels/summer.ts');
const {WING_FORMATION}=await server.ssrLoadModule('/src/wing.ts');
const vortex=await server.ssrLoadModule('/src/summer/vortex.ts');

test('full summer route has three hydras, varied aerial formations, repeat drops and bounded prewarmed pools',()=>{
 const f=new Flight('sentry',[],'vex','summer');f.invulnerable=f.cooldown=f.droneCooldown=1e5;
 const roster=new Set(),formations=new Set(),drops=new Set(),hydras=new Set(),spirals=new Set();let maxima={scout:0,drone:0,hydra:0,vortex:0};
 for(let i=0;i<6001&&f.phase==='stage';i++){
  f.step(STEP);const counts={scout:0,drone:0,hydra:0,vortex:0};
  for(const e of f.enemies){assert(e.summer,'wrong sector enemy');roster.add(e.summer.kind);formations.add(e.summer.formation);counts[e.summer.kind]++;if(e.drop)drops.add(e.drop);if(e.summer.kind==='hydra')hydras.add(e.summer.at);assert(Number.isFinite(e.x+e.y));}
  for(const kind of Object.keys(counts))maxima[kind]=Math.max(maxima[kind],counts[kind]);
  for(const e of f.enemies)if(e.summer.kind==='vortex')spirals.add(e.summer.at);
 }
 assert.equal(f.phase,'approach');assert.equal(f.nextWave,22);assert.equal(f.transitionDuration,6);assert.equal(f.stageDuration,100);
 assert.deepEqual([...roster].sort(),['drone','hydra','scout','vortex']);assert.equal(hydras.size,3);assert.equal(spirals.size,4);assert.equal(formations.size,4);assert.equal(drops.size,4);
 assert(maxima.scout<=c.SUMMER_AIR_POOL/2&&maxima.drone<=c.SUMMER_AIR_POOL/2&&maxima.hydra<=c.SUMMER_HYDRA_POOL);
 assert(maxima.vortex<=vortex.VORTEX_POOL);
 for(let i=0;i<361;i++)f.step(STEP);assert.equal(f.phase,'boss');assert.equal(f.bossHealth,layout.SUMMER_HP);
});

test('river hydras stay rooted to the same meltwater while every visible head accepts shots, beams and contact',()=>{
 const course={kind:'hydra',formation:'vee',at:23.25,slot:0,mirror:1};
 for(const time of[21,23.25,25,27]){const p=c.summerMotion(time-course.at,0,course,time);assert.equal(p.y+layout.summerScroll(time),course.at*layout.SUMMER_SPEED+7);assert.equal(p.x,layout.summerRiver(p.y+layout.summerScroll(time)));}
 const e={x:.7,y:2};
 for(const side of[-1,0,1]){const h=c.hydraHead(23,side),x=e.x+h.x,y=e.y+h.y;assert(c.hydraHit(e,23,{x,y:y-3},{x,y:y+3}));assert(c.hydraHit(e,23,{x,y},{x,y},.16));assert(Number.isFinite(c.hydraBeamEntry(e,23,{x,y:-5})));}
 assert(!c.hydraHit(e,23,{x:4,y:-5},{x:4,y:8}));assert.equal(c.hydraBeamEntry(e,23,{x:4,y:-5}),Infinity);
 // Actual shared weapon paths must dispatch to the flanking head, not only its central proxy.
 for(const weapon of['cannon','homing','omega','laser','towline']){
  const f=new Flight(weapon==='towline'?'towline':'sentry',weapon==='towline'?[]:[weapon],'vex','summer');f.nextWave=22;f.time=23;f.cooldown=f.droneCooldown=1e5;f.invulnerable=100;
  const p=c.summerMotion(0,0,course,f.time),enemy={...p,lane:0,age:0,fire:1e5,hp:20,summer:course};f.enemies=[enemy];
  const h=c.hydraHead(f.time,-1);f.player={x:enemy.x+h.x+WING_FORMATION.x,y:-5.3};
  if(weapon==='towline'){f.player={x:-3,y:enemy.y};f.drone={x:3,y:enemy.y};f.droneCooldown=0;}
  for(let i=0;i<180;i++)f.step(STEP);assert(enemy.hp<20,weapon+' missed a visible head');
 }
});

for(const weapon of['primary','sentry','towline','homing','cannon','laser','omega'])test('lotus hydra takes '+weapon+' damage on its central crown',()=>{
 const wing=['homing','cannon','laser','omega'].includes(weapon),f=new Flight(weapon==='towline'?'towline':'sentry',wing?[undefined,weapon]:[],'vex','summer');f.phase='boss';f.invulnerable=100;f.cooldown=weapon==='primary'?0:1e5;f.droneCooldown=weapon==='sentry'||weapon==='towline'?0:1e5;
 const x=f.exposedCannonX*BOSS_PROJECTION;
 if(wing)f.player.x=x-WING_FORMATION.x;
 if(weapon==='sentry'){f.drone={x,y:-3};f.droneTarget={...f.drone};}
 if(weapon==='towline'){f.player={x:-3,y:f.bossAimY*BOSS_PROJECTION};f.drone={x:3,y:f.player.y};}
 const hp=f.bossHealth;for(let i=0;i<180;i++)f.step(STEP);assert(f.bossHealth<hp);
});

test('the palace enters by scrolling and coasting to rest; the boss and all contacts share one fixed top-down frame',async()=>{
 const plane=new T.Group(),scene=new T.Scene();scene.add(plane);const level=createLevel({plane,scene,signal:new AbortController().signal});plane.add(level.root);await level.ready;
 const f=new Flight('sentry',[],'vex','summer');let previous;
 assert.equal(level.fixedCamera,true);assert.equal(level.stageDistance,22);
 for(let i=0;i<=120;i++){
  const time=100+i*.05;level.update({flight:f,time,reveal:i/120,animationTime:time});plane.updateMatrixWorld(true);
  assert.deepEqual(level.orientation(time,i/120),{pitch:0,bank:0,viewPitch:0});
  const p=level.boss.getWorldPosition(new T.Vector3());assert.equal(p.z,-12);assert.equal(p.y,layout.SUMMER_END+4.2-layout.summerScroll(time));if(previous)assert(p.distanceTo(previous)<.15);previous=p;
 }
 assert(previous.distanceTo(new T.Vector3(0,4.2,-12))<1e-8);assert(Math.abs(layout.summerScroll(106.001)-layout.summerScroll(106))<1e-9);
 const contact=level.contact(0,22,f);assert(Math.abs(contact.x)<1e-8);assert(contact.y>2.4&&contact.y<2.9);
 const dome=level.root.getObjectByName('palace-glass-dome');assert(dome);assert(dome.material.opacity<=.12&&!dome.material.depthWrite);
 const bounds=new T.Box3().setFromObject(dome);assert(bounds.min.z<-12&&bounds.max.z>0&&bounds.max.z<22,'glass fails to enclose player/boss below camera');
 level.dispose();
});

test('prewarming restores nested culling/placements and the whole route reuses its uploaded geometry',async()=>{
 const level=createLevel({plane:new T.Group(),scene:new T.Scene(),signal:new AbortController().signal});await level.ready;
 const before=new Map();level.root.traverse(o=>before.set(o,{cull:o.frustumCulled,visible:o.visible,position:o.position.clone(),geometry:o.geometry}));
 level.prepare();level.afterWarmup();
 for(const[o,b]of before){assert.equal(o.frustumCulled,b.cull);assert.equal(o.visible,b.visible);assert(o.position.equals(b.position));assert.equal(o.geometry,b.geometry);}
 const geometry=new Set([...before.values()].map(b=>b.geometry).filter(Boolean)),f=new Flight('sentry',[],'vex','summer');
 for(const time of[0,40,79,98,102,106,110])level.update({flight:f,time,reveal:time<100?0:1,animationTime:time});
 level.root.traverse(o=>{if(o.geometry)assert(geometry.has(o.geometry),'new geometry during first appearance');});
 level.dispose();
});

test('a river hydra enters fully before firing, then its three projectiles emerge from its three mouths',()=>{
 const f=new Flight('sentry',[],'vex','summer'),course={kind:'hydra',formation:'vee',at:23.25,slot:0,mirror:1};
 f.nextWave=22;f.time=course.at;f.cooldown=f.droneCooldown=1e5;f.player={x:3.8,y:-6.5};f.invulnerable=100;
 const p=c.summerMotion(0,0,course,f.time),e={...p,lane:0,age:0,fire:2.7,hp:10,summer:course};f.enemies=[e];
 for(let i=0;i<150;i++)f.step(STEP);assert.equal(f.threats.length,0);
 while(!f.threats.length)f.step(STEP);assert.equal(f.threats.length,3);assert(e.y<1,'first attack precedes full entry');
 f.threats.forEach((shot,i)=>{const h=c.hydraHead(f.time,i-1);assert(Math.abs(shot.x-shot.vx*STEP-e.x-h.x)<1e-9);assert(Math.abs(shot.y-shot.vy*STEP-e.y-h.y+.65)<1e-9);});
});
