import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,define:{__ENCOUNTER_TEXTURES__:'{}'},server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const {Flight,STEP,BOSS_PROJECTION}=await server.ssrLoadModule('/src/game.ts'),h=await server.ssrLoadModule('/src/summer/hydra-targets.ts');
const {createHydraAssets,createRiverHydra}=await server.ssrLoadModule('/src/summer/hydra.ts'),{WING_FORMATION}=await server.ssrLoadModule('/src/wing.ts');
function fixture(boss=false,weapon='primary'){
 const wing=['homing','cannon','laser','omega'].includes(weapon),f=new Flight(weapon==='towline'?'towline':'sentry',wing?[undefined,weapon]:[],'vex','summer');
 f.nextWave=22;f.invulnerable=100;f.cooldown=f.droneCooldown=1e5;
 const enemy={x:0,y:0,lane:0,age:0,fire:Infinity,hp:12,hydra:h.createHydraState(),summer:{kind:'hydra',formation:'vee',slot:0,mirror:1,at:0}};
 if(boss){f.phase='boss';f.stepBoss=()=>{};}else{f.enemies=[enemy];f.stepStage=()=>{};}
 return{f,enemy,state:boss?f.summerHydra:enemy.hydra};
}

test('each river head absorbs only its own damage and the final head awards one kill/drop',()=>{
 const {f,enemy,state}=fixture();enemy.drop='laser';
 f.damageEnemy(enemy,100,false,-1);assert.deepEqual(state.hp,[0,4,4]);assert.equal(enemy.hp,8);assert.equal(f.score,0);assert.equal(f.drops.length,0);
 assert(enemy.hitPoint.z>.5,'damage particles are behind the fallback head');
 f.damageEnemy(enemy,100,false,-1);assert.deepEqual(state.hp,[0,4,4]);
 f.damageEnemy(enemy,4,false,0);assert.equal(enemy.hp,4);assert.equal(f.score,0);
 f.damageEnemy(enemy,4,false,1);assert.equal(enemy.hp,0);assert.equal(f.score,100);assert.equal(f.drops.length,1);f.damageEnemy(enemy,100);assert.equal(f.score,100);
});

test('all three boss heads must be destroyed, with no overflow and no forced order',()=>{
 for(const order of[[-1,0,1],[1,-1,0],[0,1,-1]]){
  const {f,state}=fixture(true);
  for(let i=0;i<3;i++){f.damageBoss(100,false,order[i]);assert.equal(state.hp[order[i]+1],0);assert.equal(f.bossHealth,(2-i)*30);assert.equal(f.phase,i===2?'won':'boss');}
  assert.equal(f.score,1000);f.damageBoss(100);assert.equal(f.score,1000);
 }
});

for(const boss of[false,true])for(const weapon of['primary','sentry','towline','homing','cannon','laser','omega'])test((boss?'boss':'river')+' heads take independent '+weapon+' damage',()=>{
 for(const side of h.HYDRA_SIDES){
  const {f,enemy,state}=fixture(boss,weapon),initial=[...state.hp],wing=['homing','cannon','laser','omega'].includes(weapon);
  f.cooldown=weapon==='primary'?0:1e5;f.droneCooldown=weapon==='sentry'||weapon==='towline'?0:1e5;
  for(let i=0;i<180&&state.hp[side+1]===initial[side+1];i++){
   const p=boss?h.hydraBossHead(f.time,side):h.hydraHead(f.time,side),k=boss?BOSS_PROJECTION:1;
   f.player={x:p.x*k-(wing?WING_FORMATION.x:0),y:-4};
   if(weapon==='sentry'){f.drone={x:p.x*k,y:-3};f.droneTarget=undefined;}
   if(weapon==='towline'){f.player={x:p.x*k,y:p.y*k-1.5};f.drone={x:p.x*k,y:p.y*k+1.5};f.droneTarget=undefined;}
   f.step(STEP);
  }
  assert(state.hp[side+1]<initial[side+1],weapon+' missed '+side);
  h.HYDRA_SIDES.filter(s=>s!==side).forEach(s=>assert.equal(state.hp[s+1],initial[s+1],weapon+' damaged a different head'));
  if(!boss)assert.equal(enemy.hp,state.hp.reduce((a,b)=>a+b,0));
 }
});

test('dead heads leave swept shot, beam, touch and Towline contact and cannot shield a living head',()=>{
 const {enemy,state}=fixture();h.damageHydraHead(state,0,4,0);
 const p=h.hydraHead(0,0),origin={x:p.x,y:-4};assert.equal(h.hydraContact(enemy,0,origin,{x:p.x,y:5}),undefined);assert.equal(h.hydraBeamEntry(enemy,0,origin),Infinity);assert(!h.hydraHit(enemy,0,p,p,.16));
 const left=h.hydraHead(0,-1);assert.equal(h.hydraContact(enemy,0,{x:left.x,y:-4},{x:left.x,y:5}).side,-1);
 const boss=h.createHydraState(30);h.damageHydraHead(boss,0,30,0);const bp=h.hydraBossHead(0,0);assert.equal(h.hydraBossContact(boss,0,bp),undefined);
});

test('an in-flight locked round cannot transfer a destroyed head hit to a surviving head',()=>{
 const {f,state}=fixture(true);f.fire({x:0,y:-4});assert.equal(f.shots[0].hydraTarget,0);f.damageBoss(30,false,0);
 for(let i=0;i<40;i++)f.step(STEP);assert.deepEqual(state.hp,[30,0,30]);assert.equal(f.bossHealth,60);
});

test('each head silences its own river mouth and boss telegraph/volley',()=>{
 const {f,enemy}=fixture();f.stepStage=Object.getPrototypeOf(f).stepStage;enemy.fire=0;f.damageEnemy(enemy,4,false,0);f.stepStage(STEP);assert.equal(f.threats.length,2);
 const b=fixture(true).f;b.stepBoss=Object.getPrototypeOf(b).stepBoss;b.time=.7;b.stepBoss(STEP);assert.equal(b.markers.length,3);b.damageBoss(30,false,0);assert.equal(b.markers.length,2);b.time=1.2;b.stepBoss(STEP);assert.equal(b.threats.length,2);
 const origins=b.threats.map(s=>s.x).sort((a,b)=>a-b);assert.deepEqual(origins,[-1,1].map(s=>h.hydraBossHead(b.time,s).x));
 b.time=1.8;b.stepBoss(STEP);b.time=2.7;b.stepBoss(STEP);assert(b.markers.some(m=>m.x===b.player.x&&m.y===b.player.y),'surviving mouths never target the player');
});

test('Pulse damages heads separately and laser buildup resets on changing heads',()=>{
 const stage=fixture();stage.f.pulse();assert.deepEqual(stage.state.hp,[0,0,0]);assert.equal(stage.f.score,100);
 const {f,state}=fixture(true);f.pulse();assert.deepEqual(state.hp,[24,24,24]);assert.equal(f.bossHealth,72);
 const l=fixture(false,'laser'),wing=l.f.wings[1];l.f.stepLaser(wing,{x:0,y:-3},false,.5);l.f.stepLaser(wing,{x:0,y:-3},false,.5);assert(wing.laserHold>0);
 l.f.damageEnemy(l.enemy,100,false,0);const left=h.hydraHead(0,-1);l.f.stepLaser(wing,{x:left.x,y:-3},false,STEP);assert.equal(wing.laserHead,-1);assert.equal(wing.laserHold,0);
});

test('shorter regular reach and buried collars cover roots; defeated heads collapse in both render paths',()=>{
 const assets=createHydraAssets(),rig=createRiverHydra(assets),state=h.createHydraState();rig.pose(0,0,0,state);rig.root.updateMatrixWorld(true);
 const torso=new T.Box3().setFromObject(rig.root.getObjectByName('hydra-riverbed-body'));
 const geometries=new Set();rig.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});
 for(const n of rig.necks){assert(n.head.position.y>.6);const p=n.collar.position;assert(p.x>torso.min.x&&p.x<torso.max.x&&p.y>torso.min.y&&p.y<torso.max.y,'socket root lies outside torso');assert(p.z>torso.max.z,'collar cannot cover painted socket');assert(n.anchor.position.z>n.fallbackHead.position.z+n.fallbackHead.scale.z,'laser anchor is buried in the fallback head');}
 h.damageHydraHead(state,-1,4,1);rig.pose(1.2,0,0,state);assert(rig.necks[0].head.visible&&rig.necks[0].head.position.z<.2);
 rig.pose(2,0,0,state);assert(!rig.necks[0].head.visible&&!rig.necks[0].fallbackHead.visible);assert(rig.necks[1].head.visible&&rig.necks[2].head.visible);
 assets.setAtlas(new T.Texture());rig.pose(3,0,0,state);assert(rig.necks[0].segments.every(s=>!s.visible));rig.root.traverse(o=>{if(o.geometry)assert(geometries.has(o.geometry));});
 rig.pose(0,0,0,h.createHydraState());assert(rig.necks.every(n=>n.head.visible&&n.fallbackHead.visible));
});

test('neck strip joints stay registered to the actual workshop camera at different zooms and angles',()=>{
 const rig=createRiverHydra(createHydraAssets());rig.root.position.set(1.3,2,-3);rig.root.rotation.z=.2;
 for(const eye of[[0,2,45],[4,2,35],[-7,-4,28]]){
  const camera=new T.PerspectiveCamera(39,1,.05,600);camera.position.set(...eye);camera.lookAt(0,2,-5);camera.updateMatrixWorld(true);
  rig.pose(3,0,0,undefined,3,camera);rig.root.updateMatrixWorld(true);
  for(const n of rig.necks)for(let i=0;i<4;i++){
   const a=n.segments[i],b=n.segments[i+1];
   const p=new T.Vector3(0,-(.5-.11/a.scale.y),0).applyMatrix4(a.matrixWorld).project(camera),q=new T.Vector3(0,.5-.11/b.scale.y,0).applyMatrix4(b.matrixWorld).project(camera);
   assert(Math.hypot(p.x-q.x,p.y-q.y)<1e-7,'neck seam changes with camera');
  }
 }
});
