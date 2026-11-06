import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const m=await server.ssrLoadModule('/src/vent-fauna.ts'),v=await server.ssrLoadModule('/src/vent-layout.ts'),{Flight,STEP}=await server.ssrLoadModule('/src/game.ts');
const {createFaunaAssets,createWormAssets,createVentShrimp,createVentWorm}=await server.ssrLoadModule('/src/vent-fauna-rig.ts');
const {createLaserContactTrace}=await server.ssrLoadModule('/src/laser-contact.ts');
const assets=createFaunaAssets(new T.DataTexture(new Uint8Array([255,255,255,255]),1,1));
const wormAssets=createWormAssets(new T.DataTexture(new Uint8Array([255,255,255,255]),1,1));
const course={formation:'weave',mirror:1,slot:0};
function shrimp(){return{x:0,y:1,lane:0,age:0,fire:1.9,hp:3,heading:0,shrimp:course};}
function worm(){return{...v.ventAnchorPoint(6,19.4),lane:0,ventAnchor:6,ventWorm:true,ventScale:.8,mortarAngle:0,age:4.3,fire:10.2,hp:8,wormReach:8.5,wormBend:1,wormLocked:true};}

test('shrimp formations mirror, keep their train separation, and enter/exit a real loop with continuous tangents',()=>{
 for(const formation of ['weave','cross','curl'])for(let age=0;age<10;age+=.05){
  const a=m.shrimpMotion(age,formation==='cross'?1.9:0,{formation,mirror:1,slot:0}),b=m.shrimpMotion(age,formation==='cross'?-1.9:0,{formation,mirror:-1,slot:0});
  assert(Math.abs(a.x+b.x)<1e-8);assert.equal(a.y,b.y);assert(Number.isFinite(a.heading+a.speed));assert(Math.abs(a.x)<2.5);
 }
 for(const t of [1.15,4.45]){
  const c={formation:'curl',mirror:1,slot:0},a=m.shrimpMotion(t-1e-4,0,c),b=m.shrimpMotion(t+1e-4,0,c);
  assert(Math.hypot(a.x-b.x,a.y-b.y)<.001);assert(Math.abs(Math.atan2(Math.sin(a.heading-b.heading),Math.cos(a.heading-b.heading)))<.002);
 }
 let reversed=false;for(let t=1.15;t<4.45;t+=.05)if(m.shrimpMotion(t,0,{formation:'curl',mirror:1,slot:0}).heading>Math.PI/2)reversed=true;assert(reversed,'loop must turn back upstream');
 for(let slot=1;slot<4;slot++){const a=m.shrimpMotion(3,0,{formation:'curl',mirror:1,slot:0}),b=m.shrimpMotion(3+slot*.48,0,{formation:'curl',mirror:1,slot});assert(Math.hypot(a.x-b.x,a.y-b.y)<1e-8);}
});

test('shrimp articulation remains deterministic and the long worm feeds through a fixed hole',()=>{
 const a=createVentShrimp(assets),b=createVentShrimp(assets),w=createVentWorm(wormAssets),foot=w.root.getObjectByName('worm-fixed-hole'),fixed=foot.position.clone();
 assert.equal(a.root.getObjectByName('shrimp-carapace').geometry,b.root.getObjectByName('shrimp-carapace').geometry);
 a.pose(1,1.9);const tail=a.root.getObjectByName('shrimp-tail-1').rotation.z;a.pose(4,5);a.pose(1,1.9);assert.equal(a.root.getObjectByName('shrimp-tail-1').rotation.z,tail);
 assert.notEqual(a.root.getObjectByName('shrimp-limb-2').rotation.z,a.root.getObjectByName('shrimp-limb-4').rotation.z);
 w.pose(0,3.6,.8);assert.equal(w.combat.visible,false);w.pose(4.3,10.2,.8);assert(w.combat.visible);assert(w.root.getObjectByName('worm-head').position.y<-8);
 assert.deepEqual(foot.position,fixed);assert(!w.combat.children.includes(foot));const head=w.root.getObjectByName('worm-head').position.clone();w.pose(5.8,10.2,-.8);w.pose(4.3,10.2,.8);assert.deepEqual(w.root.getObjectByName('worm-head').position,head);
});

test('worm extension and withdrawal are continuous, connected and hide every living hitbox in the hole',()=>{
 for(const boundary of [2.7,3.6,4.25,4.55,5.85]){
  const pose=t=>m.wormPose(t,t>=3.6?10.2:3.6,10,.8),a=pose(boundary-1e-5),b=pose(boundary+1e-5);assert(Math.abs(a.length-b.length)<.001);
 }
 const e=worm();e.age=0;e.fire=3.6;assert.equal(m.faunaHulls(e).length,0);e.age=4.3;e.fire=10.2;const hull=m.faunaHulls(e);assert(hull.length>15);
 for(let i=1;i<hull.length;i++)assert(Math.hypot(hull[i].x-hull[i-1].x,hull[i].y-hull[i-1].y)<hull[i].radius+hull[i-1].radius);
 e.age=6;assert.equal(m.faunaHulls(e).length,0);
});

test('posed worm heads and shrimp muzzles agree with combat throughout turns and the entire attack',()=>{
 const point=new T.Vector3();
 for(const isWorm of [false,true])for(const angle of [-2.5,-.5,0,1.3])for(const age of [0,3.3,3.6,4.3,5.3,6]){
  const e=isWorm?worm():shrimp(),rig=isWorm?createVentWorm(wormAssets):createVentShrimp(assets);e.age=age;e.fire=age>=3.6?10.2:3.6;e.mortarAngle=e.heading=angle;
  rig.root.position.set(e.x,e.y,0);rig.root.scale.setScalar(e.ventScale??1);if(isWorm)rig.pose(age,e.fire,angle,e.wormReach,e.wormBend);else{rig.root.rotation.z=angle;rig.pose(age,e.fire);}
  rig.root.updateMatrixWorld(true);rig.root.getObjectByName(isWorm?'worm-muzzle':'shrimp-muzzle').getWorldPosition(point);const expected=m.faunaMuzzle(e);assert(Math.hypot(point.x-expected.x,point.y-expected.y)<1e-8);
 }
});

test('worm locks its attack during the warning, lunges without projectiles and reacquires after retreat',()=>{
 const f=new Flight('sentry',[],'vex','vents'),e=worm();f.time=19.7;f.nextWave=100;f.fire=()=>{};f.stepDroneWeapon=()=>{};e.age=2.7-STEP;e.fire=3.6;e.wormLocked=false;f.enemies=[e];f.invulnerable=100;
 f.step(STEP);const angle=e.mortarAngle,reach=e.wormReach;assert(e.wormLocked);f.player={x:-3,y:-3};f.step(.1);assert.equal(e.mortarAngle,angle);assert.equal(e.wormReach,reach);
 while(e.age<5.9)f.step(STEP);assert.equal(f.threats.length,0);assert(!e.wormLocked);assert.notEqual(e.mortarAngle,angle);assert.equal(e.fire,10.2);
 const patrol=new Flight('sentry',[],'vex','vents'),s=shrimp();patrol.nextWave=100;patrol.fire=()=>{};patrol.stepDroneWeapon=()=>{};s.age=1.9-STEP;patrol.enemies=[s];patrol.step(STEP);assert.equal(patrol.threats.length,2);assert.equal(s.fire,5);
});

test('the worm body hurts the ship along its length without dying on contact',()=>{
 const f=new Flight('sentry',[],'vex','vents'),e=worm();f.time=19.4;f.nextWave=100;f.fire=()=>{};f.stepDroneWeapon=()=>{};f.enemies=[e];
 f.stepStage(0);const p=m.faunaHulls(e)[8];f.player={x:p.x,y:p.y};f.stepStage(0);assert.equal(f.hull,3);assert.equal(e.hp,8);f.stepStage(0);assert.equal(f.hull,3);
});

test('laser ablation meets the long living body and ignores the inert hiding-hole rim',()=>{
 const plane=new T.Group(),w=createVentWorm(wormAssets);plane.add(w.root);w.pose(4.3,10.2,0);plane.updateMatrixWorld(true);const trace=createLaserContactTrace(plane);
 assert(trace({x:0,y:-12},{x:0,y:1},w.combat,40).y<-8.4);
 assert.equal(trace({x:-.95,y:-3},{x:-.95,y:1},w.combat,40).y,1);assert(trace({x:-.95,y:-3},{x:-.95,y:1},w.root,40).y<1);
});

test('all weapons damage the extended body, hidden worms ignore aimed fire and lasers choose the nearest body',()=>{
 for(const isWorm of [false,true]){
  for(const options of [{},{drone:true},{wing:'homing',damage:.5},{wing:'cannon'},{wing:'omega',damage:4,pierced:new Set()}]){
   const f=new Flight('sentry',[],'vex','vents'),target=isWorm?worm():shrimp();target.x=0;target.y=1;const before=target.hp;f.enemies=[target];f.stepStage=()=>{};f.cooldown=f.droneCooldown=1000;
   f.shots=[{x:0,y:-.4,z:0,vx:0,vy:25,vz:0,...options}];f.step(.1);assert(target.hp<before,JSON.stringify({isWorm,...options}));
  }
  const f=new Flight('towline',[],'vex','vents'),target=isWorm?worm():shrimp();target.x=0;target.y=1;f.enemies=[target];const before=target.hp;f.stepLaser(f.wings[0],{x:0,y:-9},false,1);assert(target.hp<before);assert.equal(f.wings[0].laserTarget,target);
  target.hp=before;f.player={x:0,y:-9};f.drone={x:0,y:3};f.droneCooldown=0;f.stepDroneWeapon(STEP);assert(target.hp<before);f.pulse();assert.equal(target.hp,0);
 }
 const f=new Flight('sentry',[],'vex','vents'),w=worm(),s=shrimp();w.x=s.x=0;w.y=3;s.y=-1;f.enemies=[s,w];f.stepLaser(f.wings[0],{x:0,y:-9},false,.1);assert.equal(f.wings[0].laserTarget,w);
 w.age=0;w.fire=3.6;f.enemies=[w];f.stepLaser(f.wings[0],{x:0,y:-9},false,.1);assert.equal(f.wings[0].laserTarget,undefined);
});

test('the full non-shooting route fits prewarmed pools, spawns all fauna and clears before the abyss swing',()=>{
 const f=new Flight('sentry',[],'vex','vents');f.fire=()=>{};f.stepDroneWeapon=()=>{};const forms=new Set(),worms=new Set(),drops=new Set();let maxShrimp=0,maxWorm=0;
 for(let i=0;i<6002;i++){
  f.invulnerable=100;f.step(STEP);maxShrimp=Math.max(maxShrimp,f.enemies.filter(e=>e.shrimp).length);maxWorm=Math.max(maxWorm,f.enemies.filter(e=>e.ventWorm).length);
  for(const e of f.enemies){if(e.shrimp)forms.add(e.shrimp.formation);if(e.ventWorm)worms.add(e.ventAnchor);if(e.drop)drops.add(e.drop);}
 }
 assert.equal(forms.size,3);assert.equal(worms.size,4);assert.equal(drops.size,4);assert(maxShrimp<=m.SHRIMP_POOL);assert(maxWorm<=m.WORM_POOL);assert.equal(f.phase,'approach');assert.equal(f.enemies.length,0);
});
