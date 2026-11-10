import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,define:{__ENCOUNTER_TEXTURES__:'{}'},server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const {Flight,STEP}=await server.ssrLoadModule('/src/game.ts'),v=await server.ssrLoadModule('/src/summer/vortex.ts');
const {createVortexDrone}=await server.ssrLoadModule('/src/summer/vortex-rig.ts'),{createLevel}=await server.ssrLoadModule('/src/rendering/levels/summer.ts');
const {createMammothAssets,createMammoth}=await server.ssrLoadModule('/src/summer/mammoths.ts'),{createLowWisps}=await server.ssrLoadModule('/src/summer/wisps.ts');
const {disposeScene}=await server.ssrLoadModule('/src/rendering/dispose.ts');
const {WING_FORMATION}=await server.ssrLoadModule('/src/wing.ts');
const course={kind:'vortex',formation:'vee',slot:0,mirror:-1,at:19};
function fixture(age=0){
 const f=new Flight('sentry',[],'vex','summer');f.time=19+age;f.nextWave=22;f.invulnerable=f.cooldown=f.droneCooldown=1e5;
 const enemy={...v.vortexMotion(age,1.55),lane:1.55,age,fire:v.VORTEX_FIRE,hp:v.VORTEX_HP,summer:{...course}};f.enemies=[enemy];return{f,enemy};
}

test('top-down mammoth trunk tip stays behind its base through grazing, mirroring and calf scaling',()=>{
 const assets=createMammothAssets();assets.setAtlas(new T.Texture());
 for(const scale of[1,-1,.58,-.58]){
  const rig=createMammoth(assets);rig.root.position.z=-17.1;rig.root.scale.set(scale,Math.abs(scale),Math.abs(scale));rig.root.rotation.z=.28;
  for(let time=0;time<40;time+=.19){rig.pose(time,2.8);rig.root.updateMatrixWorld(true);const base=rig.root.getObjectByName('mammoth-trunk-base'),tip=rig.root.getObjectByName('mammoth-trunk-tip');assert(tip.getWorldPosition(new T.Vector3()).z<base.getWorldPosition(new T.Vector3()).z-.005);}
 }
});

test('Vortex waits for full entry and a warning, then emits exactly two spaced counterwound spiral bursts',()=>{
 for(const mirror of[-1,1]){
  const {f,enemy}=fixture(-3);enemy.summer.mirror=mirror;f.player={x:-3.8,y:-6.5};const seen=new Set(),emissions=[];
  for(let i=0;i<16*60;i++){
   f.step(STEP);const fresh=f.threats.filter(s=>!seen.has(s));fresh.forEach(s=>seen.add(s));
   if(!fresh.length)continue;
   assert(enemy.y<5.5&&enemy.age>=v.VORTEX_FIRE-1e-8,'attacks before entering');assert.equal(fresh.length,2);
   assert(fresh.every(s=>Math.abs(Math.hypot(s.vx,s.vy)-2.8)<1e-9));assert(Math.abs(fresh[0].vx+fresh[1].vx)<1e-9&&Math.abs(fresh[0].vy+fresh[1].vy)<1e-9);
   emissions.push({age:enemy.age,angle:Math.atan2(fresh[0].vy,fresh[0].vx)});
  }
  assert.equal(seen.size,80);assert.equal(emissions.length,40);assert(emissions[20].age-emissions[19].age>1.8,'no cooling window');
  for(let i=1;i<20;i++){const a=emissions[i].angle-emissions[i-1].angle,delta=Math.atan2(Math.sin(a),Math.cos(a));assert(Math.abs(delta-mirror*.294)<1e-8);}
  assert(v.vortexPhase(2.2).charge<1e-12);assert(v.vortexPhase(2.8).charge>.7);assert(!v.vortexPhase(6).firing);
 }
});

test('Vortex rotor remains articulated after batching and matches the live spiral muzzles',async()=>{
 const rig=createVortexDrone();assert.equal(rig.rotor.parent,rig.root);assert.equal(rig.rotor.children.length,5);
 const plane=new T.Group(),scene=new T.Scene(),level=createLevel({plane,scene,signal:new AbortController().signal});plane.add(level.root);await level.ready;
 const {f,enemy}=fixture(4);level.update({flight:f,time:f.time,reveal:0,animationTime:f.time});
 assert.equal(level.models[0].name,'vortex-drone');const rotor=level.models[0].getObjectByName('vortex-rotating-emitter');assert.equal(rotor.rotation.z,v.vortexAngle(enemy.age,course.mirror));
 rig.pose(2.8);assert(rig.warning.material.opacity>.5);rig.pose(6);assert.equal(rig.warning.material.opacity,0);
 level.dispose();
});

for(const weapon of['primary','sentry','towline','homing','cannon','laser','omega'])test('Vortex accepts '+weapon+' damage through the normal weapon path',()=>{
 const {f,enemy}=fixture(2.2),wing=['homing','cannon','laser','omega'].includes(weapon);enemy.fire=Infinity;
 f.cooldown=weapon==='primary'?0:1e5;f.droneCooldown=weapon==='sentry'||weapon==='towline'?0:1e5;f.droneWeapon=weapon==='towline'?'towline':'sentry';
 if(wing){const equipped=new Flight('sentry',[undefined,weapon],'vex','summer');f.wings=equipped.wings;}
 for(let i=0;i<360&&enemy.hp>0;i++){
  f.player={x:enemy.x-(wing?WING_FORMATION.x:0),y:-4};
  if(weapon==='sentry'){f.drone={x:enemy.x,y:-1};f.droneTarget={...f.drone};}
  if(weapon==='towline'){f.player={x:-3.5,y:enemy.y};f.drone={x:3.5,y:enemy.y};f.droneTarget={...f.drone};}
  f.step(STEP);
 }
 assert(enemy.hp<v.VORTEX_HP,weapon+' missed Vortex');
});

test('destroying a Vortex or using Pulse stops its later emission',()=>{
 for(const pulse of[false,true]){
  const {f,enemy}=fixture(2.95);if(pulse)f.pulse();else enemy.hp=0;
  for(let i=0;i<8*60;i++)f.step(STEP);assert.equal(f.threats.length,0);assert(!f.enemies.includes(enemy));
 }
});

test('low cloud veils are above the ship, remain transparent and fade before the palace',()=>{
 const wisps=createLowWisps();
 for(const veil of wisps.veils){assert(veil.position.z>0&&veil.position.z<6);assert(veil.material.transparent&&!veil.material.depthWrite);}
 wisps.update(32,12);const snapshot=wisps.veils.map(m=>({visible:m.visible,position:m.position.clone(),rotation:m.rotation.clone()}));
 wisps.update(32,12);wisps.veils.forEach((m,i)=>{assert(m.position.equals(snapshot[i].position));assert(m.rotation.equals(snapshot[i].rotation));});
 const restore=wisps.prime();assert(wisps.veils.every(m=>m.visible));restore();wisps.veils.forEach((m,i)=>{assert.equal(m.visible,snapshot[i].visible);assert(m.position.equals(snapshot[i].position));});
 wisps.update(258,92.15);assert.equal(wisps.fade.value,0);assert(wisps.veils.every(m=>!m.visible));
 const scene=new T.Scene();scene.add(wisps.root);let drops=0;wisps.veils[0].geometry.addEventListener('dispose',()=>drops++);disposeScene(scene);assert.equal(drops,1);
});
