import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const c=await server.ssrLoadModule('/src/vent-crab.ts'),v=await server.ssrLoadModule('/src/vent-layout.ts'),{createVentBoss}=await server.ssrLoadModule('/src/vent-boss.ts'),{Flight,STEP,BOSS_PROJECTION}=await server.ssrLoadModule('/src/game.ts');
const {createBossLaserContact}=await server.ssrLoadModule('/src/laser-contact.ts');

test('the crab has two individually breakable claws and a protected core, with capped phase damage',()=>{
 const f=new Flight('sentry',[],'vex','vents');f.phase='boss';assert.equal(f.bossHealth,c.CRAB_HP);assert.equal(f.bossMaxHealth,c.CRAB_HP);
 f.damageBoss(100);assert.deepEqual(f.crabClawHealth,[0,12]);assert.equal(f.bossHealth,52);assert.equal(f.exposedCannonX,2.4);assert(!f.crabCoreOpen);
 f.damageBoss(100);assert.equal(f.bossHealth,40);assert(f.crabCoreOpen);assert.equal(f.exposedCannonX,0);assert.equal(f.crabOpening,0);
 f.time+=.8;assert.equal(f.crabOpening,1);assert.deepEqual(f.crabBreakPose,[1,1]);f.damageBoss(39);assert.equal(f.bossHealth,1);f.damageBoss(1);assert.equal(f.phase,'won');assert.equal(f.score,1000);
 const restart=new Flight('sentry',[],'vex','vents');assert.deepEqual(restart.crabClawHealth,[12,12]);assert(!restart.crabCoreOpen);
});

test('ship shots committed to a broken claw cannot hit a different claw or the newly exposed core',()=>{
 for(const both of [false,true]){
  const f=new Flight('sentry',[],'vex','vents');f.phase='boss';f.fire(f.player);const shot=f.shots[0];assert.equal(shot.crabTarget,-2.4);
  f.damageBoss(12);if(both)f.damageBoss(12);const health=f.bossHealth;shot.x=-2.4;shot.y=4.2;shot.z=-11.99;
  f.cooldown=f.droneCooldown=1000;f.stepBoss=()=>{};f.step(STEP);assert.equal(f.bossHealth,health);
 }
});

test('all wings, main gun, drone, Towline and Pulse damage claw and core phases',()=>{
 for(const phase of [0,1,2]){
  for(const weapon of ['homing','cannon','omega','laser']){
   const f=new Flight('sentry',[weapon,weapon],'vex','vents');f.phase='boss';for(let i=0;i<phase;i++)f.damageBoss(12);const before=f.bossHealth;f.cooldown=f.droneCooldown=1000;
   for(let i=0;i<600&&f.bossHealth===before;i++){f.player.x=f.exposedCannonX*BOSS_PROJECTION-1.2;f.invulnerable=100;f.step(STEP);}assert(f.bossHealth<before,weapon+' phase '+phase);
  }
  for(const mode of ['ship','drone','towline','pulse']){
   const f=new Flight(mode==='towline'?'towline':'sentry',[],'vex','vents');f.phase='boss';for(let i=0;i<phase;i++)f.damageBoss(12);const before=f.bossHealth;
   if(mode==='pulse')f.pulse();
   else if(mode==='towline'){const x=f.exposedCannonX*BOSS_PROJECTION,y=f.bossAimY*BOSS_PROJECTION;f.player={x,y:y-2};f.drone={x,y:y+2};f.droneCooldown=0;f.stepDroneWeapon(STEP);}
   else {f.cooldown=f.droneCooldown=1000;f.fire(mode==='drone'?{x:f.exposedCannonX*BOSS_PROJECTION,y:f.bossAimY*BOSS_PROJECTION}:f.player,mode==='drone');for(let i=0;i<28;i++){f.invulnerable=100;f.step(STEP);}}
   assert(f.bossHealth<before,mode+' phase '+phase);
  }
 }
});

test('claw charges retain three locked warnings and the core attack expands to five',()=>{
 for(const core of [false,true]){
  const f=new Flight('sentry',[],'vex','vents');f.phase='boss';if(core){f.damageBoss(12);f.damageBoss(12);}f.time=.6;f.stepBoss();assert.equal(f.markers.length,core?5:3);const points=f.markers.map(p=>({...p}));
  f.player.x=3;f.player.y=4;f.time=1.18;f.stepBoss();assert.deepEqual(f.markers,points);assert.equal(f.threats.length,core?5:3);for(const t of f.threats)assert.equal(t.x,core?0:-2.4);
 }
});

test('eight articulated feet settle on the actual far-rim floor throughout the camera transform',()=>{
 const feet=c.crabFeet(1),boss=v.ventBossPose(1),co=Math.cos(v.VENT_PITCH),si=Math.sin(v.VENT_PITCH);assert.equal(feet.length,8);
 for(const p of feet){const x=boss.x+p.x,y=boss.y+p.y*co-p.z*si,z=boss.z+p.y*si+p.z*co;assert(Math.abs(z-v.ventFarFloor(x,y))<1e-8);assert(y>=v.ventFarEdge(x));}
 for(let reveal=0;reveal<=1;reveal+=.02){const a=c.crabFeet(reveal),b=c.crabFeet(reveal+1e-5);for(let i=0;i<8;i++)assert(Math.hypot(a[i].x-b[i].x,a[i].y-b[i].y,a[i].z-b[i].z)<.005);}
});

test('raster rig has independent claws/apron, continuous limbs, extra barnacles and deterministic scrubbing',()=>{
 const r=createVentBoss();r.pose(1,.8,-2.4,-2.4,.2,1,[0,0],0);const finger=r.root.getObjectByName('crab-finger-0').rotation.z;r.pose(.5,0,0,0,0,4,[1,1],1);assert(r.root.getObjectByName('crab-apron-1').rotation.y>1);assert(r.root.getObjectByName('crab-crusher').rotation.z>.8);
 r.pose(1,.8,-2.4,-2.4,.2,1,[0,0],0);assert.equal(r.root.getObjectByName('crab-finger-0').rotation.z,finger);
 for(let i=0;i<8;i++){const upper=r.root.getObjectByName('crab-leg-upper-'+i),lower=r.root.getObjectByName('crab-leg-lower-'+i);assert(upper.scale.y>1);assert(lower.scale.y>1);for(const n of [...upper.quaternion.toArray(),...lower.position.toArray()])assert(Number.isFinite(n));}
 const meshes=[];r.root.traverse(o=>{if(o.isMesh)meshes.push(o);});assert(meshes.filter(m=>m.name==='crab-barnacle-colony').length>=20);const texture=new T.Texture();r.setAtlas(texture);for(const mesh of meshes)if(mesh.material.map)assert.equal(mesh.material.map,texture);
});

test('claw and central laser contacts follow posed anchors and recoil after either phase change',()=>{
 const plane=new T.Group(),r=createVentBoss();plane.add(r.root);r.root.position.set(0,4.2,-12);const contact=createBossLaserContact(plane,r.root);
 for(const target of [-2.4,2.4,0]){r.pose(1,1,target,target,1,2,[0,0],target===0?1:0);plane.updateMatrixWorld(true);const p=contact(target,22),anchor=r.root.getObjectByName(target<0?'laser_contact_L':target>0?'laser_contact_R':'laser_contact_C'),q=anchor.getWorldPosition(new T.Vector3()),scale=22/(22-q.z);assert(Math.hypot(p.x-q.x*scale,p.y-q.y*scale)<1e-8);assert.equal(q.x,target);}
});
