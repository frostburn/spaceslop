import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});
after(()=>server.close());
const layout=await server.ssrLoadModule('/src/io-layout.ts');
const {Flight,STEP,BOSS_PROJECTION}=await server.ssrLoadModule('/src/game.ts');
const {createCaldera,createSkipper}=await server.ssrLoadModule('/src/io-rigs.ts');
const {createIoScenery}=await server.ssrLoadModule('/src/io-scenery.ts');
const {readLevel}=await server.ssrLoadModule('/src/levels.ts');

test('Io is a two-screen 20-second slice, with five Skipper waves, all accessories, and a quiet eight-second approach',()=>{
 assert.equal(readLevel('io'),'io');assert.equal(layout.IO_DURATION,20);assert.equal(layout.ioWaves.length,5);
 const f=new Flight('sentry',[],'vex','io'),drops=new Set();let maximum=0;
 for(let i=0;i<1202;i++){f.invulnerable=100;f.step(STEP);for(const e of f.enemies){assert(e.skipper);if(e.drop)drops.add(e.drop);}maximum=Math.max(maximum,f.enemies.length);}
 assert.equal(drops.size,4);assert(maximum<=layout.IO_SKIPPER_POOL);assert.equal(f.phase,'approach');
 assert.equal(f.transitionDuration,8);assert.equal(f.enemies.length+f.shots.length+f.threats.length,0);
 while(f.phase==='approach'){assert.equal(f.threats.length+f.shots.length,0);f.step(STEP);}assert.equal(f.phase,'boss');assert.equal(f.bossHealth,72);
});

test('world travel coasts to rest without a velocity discontinuity and all anchored scenery retains world distances',()=>{
 const {ioScroll,ioWorld,IO_DURATION:d,IO_APPROACH:a}=layout,h=1e-4;
 assert(Math.abs((ioScroll(d)-ioScroll(d-h))/h-1.6)<1e-5);
 assert(Math.abs((ioScroll(d+h)-ioScroll(d))/h-1.6)<2e-5);
 assert(Math.abs((ioScroll(d+a)-ioScroll(d+a-h))/h)<2e-5);
 assert.equal(ioScroll(200),layout.IO_FINAL_SCROLL);
 for(let i=0;i<=100;i++){
  const rise=i/100,p=ioWorld(48,-2,20+8*rise,rise),q=ioWorld(52,3,20+8*rise,rise);
  assert(Math.abs(Math.hypot(p.y-q.y,p.z-q.z)-Math.sqrt(41))<1e-10);
 }
 const below=ioWorld(layout.IO_FINAL_SCROLL,-3,28,1);assert(below.z<0);
});

test('support absorbs exactly 20 damage before one failure, reveals the core, and collapse remains frozen at results',()=>{
 const f=new Flight('sentry',[],'vex','io');f.phase='boss';
 f.damageBoss(19);assert(!f.ioLegBroken);assert.equal(f.exposedCannonX,-2.4);
 f.damageBoss(10,true);assert(f.ioLegBroken);assert.equal(f.bossHealth,52);assert.equal(f.bossLaserDamage,1);assert.equal(f.ioCollapse,0);
 f.invulnerable=100;f.cooldown=f.droneCooldown=100;for(let i=0;i<73;i++)f.step(STEP);
 assert.equal(f.ioCollapse,1);assert(Math.abs(f.exposedCannonX)<.1);assert(f.bossAimY<4);
 f.damageBoss(100);assert.equal(f.phase,'won');assert.equal(f.score,1000);const collapse=f.ioCollapse;f.step(100);assert.equal(f.ioCollapse,collapse);
});

test('ship, sentry, homing, cannon, omega, laser, Towline and Pulse all damage the correct support target',()=>{
 for(const kind of ['ship','drone','homing','cannon','omega']){
  const f=new Flight('sentry',[],'vex','io');f.phase='boss';f.cooldown=f.droneCooldown=100;
  f.shots=[{x:f.exposedCannonX,y:f.bossAimY,z:-11.9,vx:0,vy:0,vz:-12,damage:1,targetsBoss:kind==='ship',bossSupport:true,drone:kind==='drone',wing:['homing','cannon','omega'].includes(kind)?kind:undefined}];
  f.step(STEP);assert.equal(f.bossHealth,71,kind);
 }
 const laser=new Flight('sentry',['laser'],'vex','io');laser.phase='boss';laser.cooldown=laser.droneCooldown=100;
 laser.player.x=laser.exposedCannonX*BOSS_PROJECTION+1.22;laser.step(STEP);assert(laser.bossHealth<72);assert(laser.bossLaserDamage>0);
 const tow=new Flight('towline',[],'vex','io');tow.phase='boss';tow.cooldown=100;tow.droneCooldown=0;tow.player={x:-3,y:tow.bossAimY*BOSS_PROJECTION};tow.drone={x:3,y:tow.player.y};
 tow.step(STEP);assert.equal(tow.bossHealth,70);
 for(let i=0;i<5;i++)tow.step(STEP);assert.equal(tow.bossHealth,70,'same Towline pulse cannot repeat damage');
 const pulse=new Flight('sentry',[],'vex','io');pulse.phase='boss';pulse.charges=5;
 for(let i=0;i<4;i++)pulse.pulse();assert.equal(pulse.bossHealth,52);assert(pulse.ioLegBroken);pulse.pulse();assert.equal(pulse.bossHealth,46);
});

test('Caldera warnings lock before rotating wheel shots fire and the broken support changes attack spacing',()=>{
 const patterns=[];
 for(const broken of [false,true]){
  const f=new Flight('sentry',[],'vex','io');f.phase='boss';f.cooldown=f.droneCooldown=100;f.invulnerable=100;
  if(broken)f.damageBoss(20);
  for(let i=0;i<55;i++)f.step(STEP);assert.equal(f.markers.length,3);const locked=f.markers.map(p=>({...p}));
  f.player.x=3;for(let i=0;i<45;i++)f.step(STEP);assert.deepEqual(f.markers,locked);assert.equal(f.threats.length,3);
  patterns.push(locked.map(p=>p.y));assert(f.threats.every(t=>t.vz>0&&Number.isFinite(t.vx+t.vy)));
 }
 assert.notDeepEqual(...patterns);
});

test('rig weakpoint anchors and rotor phase agree with combat through the complete support collapse',()=>{
 const rig=createCaldera(),world=new T.Group();world.add(rig.root);
 rig.root.position.set(0,layout.IO_BOSS_Y,layout.IO_BOSS_Z);rig.root.rotation.x=Math.PI/2;
 world.rotation.x=-layout.IO_PITCH;const origin=layout.ioWorld(0,0,28,1);world.position.set(0,origin.y,origin.z);
 const point=new T.Vector3();
 for(let i=0;i<=20;i++){
  const collapse=i/20,broken=i>0;rig.pose(31,collapse,broken);world.updateMatrixWorld(true);
  const anchor=rig.root.getObjectByName(broken?'laser_contact_R':'laser_contact_L');anchor.getWorldPosition(point);
  const expected=layout.calderaContact(collapse,broken);assert(point.distanceTo(new T.Vector3(expected.x,expected.y,expected.z))<1e-8);
  const wheel=rig.root.getObjectByName('dredging-wheel');assert.equal(wheel.rotation.z,31*.55+collapse*.7);
 }
});

test('the landscape has real relief and a separate lake/crust, and all six foot shelves share the same frame',async()=>{
 const scene=createIoScenery();
 const land=scene.root.getObjectByName('io-heightfield'),positions=land.geometry.attributes.position;
 let min=Infinity,max=-Infinity;for(let i=0;i<positions.count;i++){min=Math.min(min,positions.getZ(i));max=Math.max(max,positions.getZ(i));}
 assert(max-min>4);assert.equal(scene.root.getObjectByName('caldera-lava-lake').position.z,-6.85);
 assert(scene.root.getObjectByName('broken-lava-crust').geometry.attributes.position.count>1000);
 assert(scene.root.getObjectByName('caldera-rock-volumes').isInstancedMesh);
 scene.update(28,1);scene.root.updateMatrixWorld(true);const feet=[];
 scene.boss.root.traverse(o=>{if(o.name==='caldera-foot')feet.push(o);});assert.equal(feet.length,6);
 const before=feet.map(o=>o.getWorldPosition(new T.Vector3()).toArray());scene.boss.pose(40,1,true);scene.root.updateMatrixWorld(true);
 assert.deepEqual(feet.map(o=>o.getWorldPosition(new T.Vector3()).toArray()),before,'support collapse must not slide ground anchors');
 const geometry=new Set();scene.root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);});
 for(let i=0;i<10;i++){scene.update(20+i*.8,i/10);scene.boss.pose(i,i/10,true);}
 const after=new Set();scene.root.traverse(o=>{if(o.geometry)after.add(o.geometry);});assert.deepEqual(after,geometry);
});

test('Skippers share GPU geometry, and their arcing formations clear the route before the approach',()=>{
 const a=createSkipper(),b=createSkipper(),ga=[],gb=[];a.root.traverse(o=>{if(o.geometry)ga.push(o.geometry);});b.root.traverse(o=>{if(o.geometry)gb.push(o.geometry);});
 ga.forEach((g,i)=>assert.equal(g,gb[i]));
 for(const wave of layout.ioWaves)for(const[lane,slot]of wave.lanes.map((l,i)=>[l,i])){
  const end=layout.skipperMotion(20-wave.time,lane,slot);assert(end.y<-9);
  for(let t=0;t<6;t+=1/60){const p=layout.skipperMotion(t,lane,slot);assert(Number.isFinite(p.x+p.y+p.heading+p.jet));assert(Math.abs(p.x)<3.5);}
 }
});

test('a media-free simulation reaches the boss, visibly breaks its support, wins, and can restart cleanly',()=>{
 const f=new Flight('sentry',[],'vex','io');let sawSupport=false;
 for(let i=0;i<7200&&!['won','lost'].includes(f.phase);i++){f.invulnerable=100;f.step(STEP);sawSupport ||= f.ioLegBroken;}
 assert.equal(f.phase,'won');assert(sawSupport);assert(f.score>=1000);
 const again=new Flight('sentry',[],'vex','io');assert.equal(again.bossHealth,72);assert(!again.ioLegBroken);assert.equal(again.time,0);
});

test('ship shots already committed to the failed support cannot damage the newly exposed core',()=>{
 const f=new Flight('sentry',[],'vex','io');f.phase='boss';f.cooldown=f.droneCooldown=100;
 f.fire(f.player);assert.equal(f.shots[0].bossSupport,true);f.damageBoss(20);assert.equal(f.bossHealth,52);
 for(let i=0;i<30;i++)f.step(STEP);assert.equal(f.bossHealth,52);
 f.fire(f.player);assert.equal(f.shots[0].bossSupport,false);for(let i=0;i<30;i++)f.step(STEP);assert(f.bossHealth<52);
});

test('Io dust remains finite, camera-facing and pooled throughout the route and camera approach',()=>{
 const scene=createIoScenery(),dust=scene.root.getObjectByName('ballistic-vent-plumes');
 assert(dust.isInstancedMesh);assert(!dust.castShadow);assert(!dust.material.depthWrite);
 const matrices=dust.instanceMatrix.array,opacity=dust.geometry.attributes.opacity,mask=dust.material.uniforms.map.value;
 assert(mask.isDataTexture);assert(mask.generateMipmaps);
 for(let t=0;t<=90;t+=.7){
  scene.update(t,Math.min(1,t/28));
  assert.equal(dust.instanceMatrix.array,matrices);assert.equal(dust.geometry.attributes.opacity,opacity);
  assert(matrices.every(Number.isFinite));assert(opacity.array.every(a=>Number.isFinite(a)&&a>=0&&a<=.27));
 }
 scene.update(12.3,1);const frozen=Array.from(matrices);scene.update(12.3,1);assert.deepEqual(Array.from(matrices),frozen);
 scene.update(13.3,1);assert.notDeepEqual(Array.from(matrices),frozen,'time must animate the pooled plumes');
});

test('reviewed surfaces propagate to every Io terrain and painted material, while fallback lighting stays finite',async()=>{
 const m=await server.ssrLoadModule('/src/io-materials.ts');
 const hdr=m.ioEnvironment.image.data;assert(hdr.every(h=>Number.isFinite(T.DataUtils.fromHalfFloat(h))));
 const scene=createIoScenery(),sun=scene.world.children.find(o=>o.isDirectionalLight);
 assert(sun.castShadow);assert(sun.shadow.mapSize.x>=1024);assert(scene.root.getObjectByName('io-basalt-scree').count>300);
 const heat=scene.root.getObjectByName('broken-lava-crust').geometry.attributes.temperature.array;
 assert(heat.every(t=>t>=0&&t<=1));assert(heat.some(t=>t>.1));assert(heat.some(t=>t===0));
 const rock=new T.Texture(),paint=new T.Texture();m.setIoRockTexture(rock);m.setIoCeramicTexture(paint);
 for(const material of [m.ioGround,m.ioRock,m.ioCrust]){assert.equal(material.map,rock);assert.equal(material.bumpMap,rock);}
 for(const material of [m.ioCeramic,m.ioBand]){assert.equal(material.map,paint);assert.equal(material.bumpMap,paint);}
 for(const rise of [0,.3,.7,1]){m.poseIoEnvironment(rise);assert(Number.isFinite(m.ioChrome.envMapRotation.x));}
});
