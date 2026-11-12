import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const m=await server.ssrLoadModule('/src/vent-mortar.ts'),{Flight,STEP}=await server.ssrLoadModule('/src/game.ts');
const {createMortarAssets,createVentMortar}=await server.ssrLoadModule('/src/vent-mortar-rig.ts');
const {ventAnchorPoint}=await server.ssrLoadModule('/src/vent-layout.ts');
const assets=createMortarAssets(new T.DataTexture(new Uint8Array([255,255,255,255]),1,1));
function enemy(age=0){return{...ventAnchorPoint(0,9),lane:0,ventAnchor:0,ventScale:.8,age,fire:m.MORTAR_FIRST_FIRE,hp:m.MORTAR_HP};}

test('mortar feet stay cemented while independent plates open, the head aims and the siphon recoils',()=>{
 const a=createVentMortar(assets),b=createVentMortar(assets),base=a.root.getObjectByName('mortar-fixed-foot'),fixed=base.position.clone();
 a.pose(.2,1.8,0);const folded=a.root.getObjectByName('mortar-shell-L').rotation.z;
 a.pose(1.79,1.8,.6);assert(a.root.getObjectByName('mortar-shell-L').rotation.z>folded+.5);assert.equal(a.combat.children[0].rotation.z,.6);
 assert.deepEqual(base.position,fixed);assert.equal(b.root.getObjectByName('mortar-shell-L').rotation.z,folded);
 const charged=a.root.getObjectByName('mortar-aperture').position.y;a.pose(1.8,5.4,.6);assert(a.root.getObjectByName('mortar-aperture').position.y>charged);
 const ga=[],gb=[];a.root.traverse(o=>{if(o.isMesh)ga.push(o.geometry);});b.root.traverse(o=>{if(o.isMesh)gb.push(o.geometry);});assert.equal(ga[0],gb[0]);
 a.pose(1.79,1.8,.6);const pose=a.root.getObjectByName('mortar-shell-L').rotation.z;a.pose(5,5.4,-1);a.pose(1.79,1.8,.6);assert.equal(a.root.getObjectByName('mortar-shell-L').rotation.z,pose,'scrubbing must be deterministic');
});

test('the posed raster mouth and simulated volley origin agree for every aiming direction',()=>{
 const rig=createVentMortar(assets),e=enemy(1.8),point=new T.Vector3();rig.root.position.set(e.x,e.y,0);rig.root.scale.setScalar(e.ventScale);
 for(const angle of [-2.9,-1.2,0,.8,2.8]){
  rig.pose(e.age,e.fire,angle);rig.root.updateMatrixWorld(true);rig.root.getObjectByName('mortar-muzzle').getWorldPosition(point);const target=m.mortarMuzzle(e,angle);
  assert(Math.hypot(point.x-target.x,point.y-target.y)<1e-8);
 }
});

test('anchored mortars telegraph and fire a three-pearl fan with a distinct cadence and score',()=>{
 const f=new Flight('sentry',[],'vex','vents');f.fire=()=>{};f.stepDroneWeapon=()=>{};f.time=9;const e=enemy(1.8-STEP);f.enemies=[e];f.step(STEP);
 assert.equal(f.threats.length,3);assert.equal(e.fire,m.MORTAR_FIRST_FIRE+m.MORTAR_INTERVAL);assert(m.mortarPose(1.79,1.8).charge>.98);
 for(const shot of f.threats)assert(Math.abs(Math.hypot(shot.vx,shot.vy)-m.MORTAR_SHOT_SPEED)<1e-9);
 f.step(STEP);assert.equal(f.threats.length,3);f.damageEnemy(e,4);assert.equal(e.hp,0);assert.equal(f.score,150);
});

test('all projectile and laser weapon paths damage an anchored mortar; Towline and Pulse also destroy it',()=>{
 for(const options of [{},{drone:true},{wing:'homing',damage:.5},{wing:'cannon'},{wing:'omega',damage:4,pierced:new Set()}]){
  const f=new Flight('sentry',[],'vex','vents'),e=enemy();e.x=0;e.y=1;f.enemies=[e];f.stepStage=()=>{};f.cooldown=f.droneCooldown=1000;
  f.shots=[{x:0,y:0,z:0,vx:0,vy:15,vz:0,...options}];f.step(.08);assert(e.hp<4,JSON.stringify(options));
 }
 const laser=new Flight('sentry',[],'vex','vents'),e=enemy();e.x=0;e.y=1;laser.enemies=[e];laser.stepLaser(laser.wings[0],{x:0,y:-2},false,1);assert(e.hp<4);assert.equal(laser.wings[0].laserTarget,e);
 const tow=new Flight('towline',[],'vex','vents'),t=enemy();t.x=0;t.y=1;tow.enemies=[t];tow.player={x:0,y:0};tow.drone={x:0,y:3};tow.towlineCooldown=0;tow.stepDroneWeapon(STEP);assert.equal(t.hp,1);tow.pulse();assert.equal(t.hp,0);assert.equal(tow.score,150);
});

test('the full route fits the prewarmed mortar pool even when the player never shoots',()=>{
 const f=new Flight('sentry',[],'vex','vents');f.fire=()=>{};f.stepDroneWeapon=()=>{};let max=0;const seen=new Set();
 for(let i=0;i<6002;i++){f.invulnerable=100;f.step(STEP);const active=f.enemies.filter(e=>e.ventAnchor!==undefined&&!e.ventWorm);max=Math.max(max,active.length);active.forEach(e=>seen.add(e.ventAnchor));}
 assert.equal(seen.size,6);assert(max>0&&max<=m.MORTAR_POOL);assert.equal(f.phase,'approach');assert.equal(f.enemies.length,0);
});
