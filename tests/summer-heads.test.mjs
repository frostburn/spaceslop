import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,define:{__ENCOUNTER_TEXTURES__:'{}'},server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const {Flight,STEP,BOSS_PROJECTION}=await server.ssrLoadModule('/src/game.ts'),h=await server.ssrLoadModule('/src/summer/hydra-targets.ts');
const {createHydraAssets,createRiverHydra}=await server.ssrLoadModule('/src/summer/hydra.ts'),{WING_FORMATION}=await server.ssrLoadModule('/src/wing.ts');
const layout=await server.ssrLoadModule('/src/summer/layout.ts');
const riverHP=h.HYDRA_HEAD_HP,bossHP=h.HYDRA_BOSS_HEAD_HP;
function fixture(boss=false,weapon='primary'){
 const wing=['homing','cannon','laser','omega'].includes(weapon),f=new Flight(weapon==='towline'?'towline':'sentry',wing?[undefined,weapon]:[],'vex','summer');
 f.nextWave=22;f.invulnerable=100;f.cooldown=f.droneCooldown=1e5;
 const enemy={x:0,y:0,lane:0,age:0,fire:Infinity,hp:3*riverHP,hydra:h.createHydraState(),summer:{kind:'hydra',formation:'vee',slot:0,mirror:1,at:0}};
 if(boss){f.phase='boss';f.stepBoss=()=>{};}else{f.enemies=[enemy];f.stepStage=()=>{};}
 return{f,enemy,state:boss?f.summerHydra:enemy.hydra};
}

test('each river head absorbs only its own damage and the final head awards one kill/drop',()=>{
 const {f,enemy,state}=fixture();enemy.reward={weapon:'laser',remaining:1};
 f.damageEnemy(enemy,100,false,-1);assert.deepEqual(state.hp,[0,riverHP,riverHP]);assert.equal(enemy.hp,2*riverHP);assert.equal(f.score,0);assert.equal(f.drops.length,0);
 assert(enemy.hitPoint.z>.5,'damage particles are behind the fallback head');
 f.damageEnemy(enemy,100,false,-1);assert.deepEqual(state.hp,[0,riverHP,riverHP]);
 f.damageEnemy(enemy,riverHP,false,0);assert.equal(enemy.hp,riverHP);assert.equal(f.score,0);
 f.damageEnemy(enemy,riverHP,false,1);assert.equal(enemy.hp,0);assert.equal(f.score,100);assert.equal(f.drops.length,1);f.damageEnemy(enemy,100);assert.equal(f.score,100);
});

test('all three boss heads must be destroyed, with no overflow and no forced order',()=>{
 for(const order of[[-1,0,1],[1,-1,0],[0,1,-1]]){
  const {f,state}=fixture(true);
  for(let i=0;i<3;i++){f.damageBoss(100,false,order[i]);assert.equal(state.hp[order[i]+1],0);assert.equal(f.bossHealth,(2-i)*bossHP);assert.equal(f.phase,i===2?'won':'boss');}
  assert.equal(f.score,1000);f.damageBoss(100);assert.equal(f.score,1000);
 }
});

for(const boss of[false,true])for(const weapon of['primary','sentry','towline','homing','cannon','laser','omega'])test((boss?'boss':'river')+' heads take independent '+weapon+' damage',()=>{
 for(const side of h.HYDRA_SIDES){
  const {f,enemy,state}=fixture(boss,weapon),initial=[...state.hp],wing=['homing','cannon','laser','omega'].includes(weapon);
  f.cooldown=weapon==='primary'?0:1e5;f.droneCooldown=weapon==='sentry'?0:1e5;f.towlineCooldown=0;
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
 const {enemy,state}=fixture();h.damageHydraHead(state,0,riverHP,0);
 const p=h.hydraHead(0,0),origin={x:p.x,y:-4};assert.equal(h.hydraContact(enemy,0,origin,{x:p.x,y:5}),undefined);assert.equal(h.hydraBeamEntry(enemy,0,origin),Infinity);assert(!h.hydraHit(enemy,0,p,p,.16));
 const left=h.hydraHead(0,-1);assert.equal(h.hydraContact(enemy,0,{x:left.x,y:-4},{x:left.x,y:5}).side,-1);
 const boss=h.createHydraState(bossHP);h.damageHydraHead(boss,0,bossHP,0);const bp=h.hydraBossHead(0,0);assert.equal(h.hydraBossContact(boss,0,bp),undefined);
});

test('an in-flight locked round cannot transfer a destroyed head hit to a surviving head',()=>{
 const {f,state}=fixture(true);f.fire({x:0,y:-4});assert.equal(f.shots[0].hydraTarget,0);f.damageBoss(bossHP,false,0);
 for(let i=0;i<40;i++)f.step(STEP);assert.deepEqual(state.hp,[bossHP,0,bossHP]);assert.equal(f.bossHealth,2*bossHP);
});

test('each head silences its own river mouth and boss telegraph/volley',()=>{
 const {f,enemy}=fixture();f.stepStage=Object.getPrototypeOf(f).stepStage;enemy.fire=0;f.damageEnemy(enemy,riverHP,false,0);f.stepStage(STEP);assert.equal(f.threats.length,2);
 const b=fixture(true).f;b.stepBoss=Object.getPrototypeOf(b).stepBoss;b.time=.7;b.stepBoss(STEP);assert.equal(b.markers.length,3);b.damageBoss(bossHP,false,0);assert.equal(b.markers.length,2);b.time=1.2;b.stepBoss(STEP);assert.equal(b.threats.length,2);
 const origins=b.threats.map(s=>s.x).sort((a,b)=>a-b);assert.deepEqual(origins,[-1,1].map(s=>h.hydraBossHead(b.time,s).x));
 b.time=1.8;b.stepBoss(STEP);b.time=2.7;b.stepBoss(STEP);assert(b.markers.some(m=>m.x===b.player.x&&m.y===b.player.y),'surviving mouths never target the player');
});

test('Pulse damages heads separately and laser buildup resets on changing heads',()=>{
 const stage=fixture();stage.f.pulse();assert.deepEqual(stage.state.hp,[0,0,0]);assert.equal(stage.f.score,100);
 const {f,state}=fixture(true);f.pulse();assert.deepEqual(state.hp,Array(3).fill(bossHP-6));assert.equal(f.bossHealth,3*(bossHP-6));
 const l=fixture(false,'laser'),wing=l.f.wings[1];l.f.stepLaser(wing,{x:0,y:-3},false,.5);l.f.stepLaser(wing,{x:0,y:-3},false,.5);assert(wing.laserHold>0);
 l.f.damageEnemy(l.enemy,100,false,0);const left=h.hydraHead(0,-1);l.f.stepLaser(wing,{x:left.x,y:-3},false,STEP);assert.equal(wing.laserHead,-1);assert.equal(wing.laserHold,0);
});

test('original front roots and settled reach are preserved without socket-cover balls',()=>{
 const assets=createHydraAssets(),rig=createRiverHydra(assets),state=h.createHydraState();rig.pose(0,0,0,state);rig.root.updateMatrixWorld(true);
 const camera=new T.PerspectiveCamera(39,1,.05,600);camera.position.z=22;camera.updateMatrixWorld(true);
 const geometries=new Set();rig.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});
 assert(!('stump' in assets));assert(!rig.root.children.some(o=>o.geometry===assets.round),'added socket-cover ball');
 for(const n of rig.necks){
  const head=h.hydraHead(0,n.side);assert.equal(n.head.position.x,head.x);assert.equal(n.head.position.y,head.y);
  const strip=n.segments[0],p=new T.Vector3(0,.5-.11/strip.scale.y,0).applyMatrix4(strip.matrixWorld).project(camera),q=new T.Vector3(n.side*.9+.11,2.9,-16.2).project(camera);
  assert(Math.hypot(p.x-q.x,p.y-q.y)<1e-7,'original attachment moved');
  assert(n.anchor.position.z>n.fallbackHead.position.z+n.fallbackHead.scale.z,'laser anchor is buried in the fallback head');
 }
 h.damageHydraHead(state,-1,riverHP,1);rig.pose(1.2,0,0,state);assert(rig.necks[0].head.visible&&rig.necks[0].head.position.z<.2);
 rig.pose(2,0,0,state);assert(!rig.necks[0].head.visible&&!rig.necks[0].fallbackHead.visible);assert(rig.necks[1].head.visible&&rig.necks[2].head.visible);
 assets.setAtlas(new T.Texture());rig.pose(3,0,0,state);assert(rig.necks[0].segments.every(s=>!s.visible));rig.root.traverse(o=>{if(o.geometry)assert(geometries.has(o.geometry));});
 rig.pose(0,0,0,h.createHydraState());assert(rig.necks.every(n=>n.head.visible&&n.fallbackHead.visible));
});

test('river heads spawn at the projected front sockets and blend into the unchanged combat pose',()=>{
 const kHead=22/21.8,kBody=22/38.2;
 for(const x of[-2,0,2])for(const y of[15.4,13,11,10]){
  const p=h.hydraEntryHead(h.hydraHead(0,0),{x,y},1.2);
  assert(Math.abs((y+p.y+.62)*kHead-(y+2.9)*kBody)<1e-8,'head spawns beyond its socket');
  assert(Math.abs((x+p.x)*kHead-(x+1.2)*kBody)<1e-8);
 }
 for(const side of h.HYDRA_SIDES){const rest=h.hydraHead(12,side);assert.deepEqual(h.hydraEntryHead(rest,{x:2,y:2},-1),rest);}
 let previous;
 for(let y=15.4;y>=-2;y-=.02){
  const p=h.hydraEntryHead(h.hydraHead(0,0),{x:1,y},.8),screen=new T.Vector2((1+p.x)*kHead,(y+p.y)*kHead);
  if(previous)assert(screen.distanceTo(previous)<.04,'entry jumps');previous=screen;
 }
});

test('entry rendering and all head hitboxes use the same spawn placement',()=>{
 const rig=createRiverHydra(createHydraAssets()),time=21,enemy={x:1.5,y:12,hydra:h.createHydraState()};
 const bodyX=layout.summerRiver(enemy.y+layout.summerScroll(time)+3.9)-enemy.x;
 rig.root.position.set(enemy.x,enemy.y,0);rig.pose(time,0,bodyX,enemy.hydra);
 for(const side of h.HYDRA_SIDES){
  const p=h.riverHydraHead(enemy,time,side),head=rig.necks[side+1].head.position;
  assert(Math.hypot(head.x-p.x,head.y-p.y)<1e-9,'visible head and hitbox disagree at spawn');
  const hit=h.hydraContact(enemy,time,{x:enemy.x+p.x,y:enemy.y+p.y-2},{x:enemy.x+p.x,y:enemy.y+p.y+2});assert.equal(hit?.side,side);
 }
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
