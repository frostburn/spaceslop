import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});
after(()=>server.close());
const g=await server.ssrLoadModule('/src/groundskeeper.ts'),layout=await server.ssrLoadModule('/src/preserve-layout.ts');
const {Flight,STEP,BOSS_PROJECTION}=await server.ssrLoadModule('/src/game.ts');
const {createPreserveScenery}=await server.ssrLoadModule('/src/preserve-scenery.ts');
const {createBossLaserContact}=await server.ssrLoadModule('/src/laser-contact.ts');
const quiet=()=>{const f=new Flight('sentry',[],'vex','preserve');f.phase='boss';f.cooldown=f.droneCooldown=1e5;return f;};

test('preserve enters a quiet six-second rotunda approach, then a dedicated dinosaur fight',()=>{
 const f=new Flight('sentry',[],'vex','preserve');assert.equal(f.bossHealth,g.GROUNDSKEEPER_HP);
 f.time=f.stageDuration;f.step(0);assert.equal(f.phase,'approach');assert.equal(f.transitionDuration,6);
 while(f.phase==='approach'){assert.equal(f.enemies.length+f.shots.length+f.threats.length,0);f.step(STEP);}
 assert.equal(f.phase,'boss');assert.equal(f.bossMaxHealth,160);assert.equal(f.exposedCannonX,0);
 f.cooldown=f.droneCooldown=1e5;
 for(let i=0;i<336*4;i++){f.invulnerable=100;f.step(STEP);assert.equal(f.threats.length,0,'physical attacks must not fire the former cannon volleys');}
});

test('rakes, paired slams and lunges hit only their physical contact paths; opposite-side dodges are safe',()=>{
 for(let cycle=0;cycle<4;cycle++){
  const aim={x:0,y:-5.3},victim=cycle===2?{x:1.35,y:-5.3}:aim,safe=cycle===2?aim:{x:-3.3,y:-5.3};let hit=false;
  for(let i=0;i<336;i++){
   const t=cycle*g.GROUNDSKEEPER_CYCLE+i*STEP;
   if(g.groundskeeperHits(t,t-STEP,aim,victim))hit=true;
   assert(!g.groundskeeperHits(t,t-STEP,aim,safe),`safe lane contacted in cycle ${cycle} at ${t}`);
   assert(!g.groundskeeperHits(t,t-STEP,aim,victim,cycle*g.GROUNDSKEEPER_CYCLE+2.3),'Pulse cancels this attack');
  }
  assert(hit,`attack ${cycle} never reaches its warning lane`);
 }
 const idle=quiet();for(let i=0;i<336;i++)idle.step(STEP);assert.equal(idle.hull,3,'one rake costs one hull, rather than one per claw/frame');
});

test('warning aim locks once, Pulse interrupts once, and new runs reset the attack state',()=>{
 const f=quiet();while(f.time<1.1)f.step(STEP);const locked={...f.groundskeeperAim};
 f.player.x=-3.5;while(f.time<2.6)f.step(STEP);assert.deepEqual(f.groundskeeperAim,locked);
 f.pulse();const cancelled=f.groundskeeperCancelledAt;assert(cancelled>2);assert.equal(f.bossHealth,154);
 while(f.time<5.6)f.step(STEP);assert.equal(f.hull,4);
 while(f.time<6.7)f.step(STEP);assert.equal(f.groundskeeperAim.x,-3.5);assert.equal(f.groundskeeperCancelledAt,cancelled);
 const restart=quiet();assert.equal(restart.groundskeeperCancelledAt,-100);assert.equal(restart.bossHealth,160);
});

test('ordinary fire, sentry, every sidearm, Towline and Pulse damage the animal without mechanical weakpoints',()=>{
 for(const kind of ['ship','drone','homing','cannon','omega']){
  const f=quiet();f.invulnerable=100;
  if(kind==='ship')f.fire(f.player);
  else if(kind==='drone')f.fire({x:0,y:f.bossAimY*BOSS_PROJECTION},true);
  else{f.player.x=1.22;f.equip(f.wings[0],kind);f.wings[0].cooldown=0;f.stepWing(f.wings[0],true,STEP);f.wings[0].weapon=undefined;}
  for(let i=0;i<50;i++)f.step(STEP);assert(f.bossHealth<160,kind);
 }
 const laser=quiet();laser.stepLaser(laser.wings[0],{x:0,y:-5.3},true,.5);assert(laser.bossHealth<160);assert(laser.bossLaserDamage>0);
 const tow=quiet();tow.player={x:0,y:-5.3};tow.drone={x:0,y:3};tow.droneCooldown=0;Object.defineProperty(tow,'droneWeapon',{value:'towline'});tow.stepDroneWeapon(STEP);assert.equal(tow.bossHealth,158);
 const pulse=quiet();pulse.time=2.8;pulse.pulse();assert.equal(pulse.bossHealth,154);pulse.damageBoss(1000);assert.equal(pulse.phase,'won');assert.equal(pulse.score,1000);assert.equal(pulse.groundskeeperTime,2.8);pulse.step(10);assert.equal(pulse.groundskeeperTime,2.8);
});

test('rotunda transform coasts continuously, and posed claw geometry/contact anchors agree with combat math',()=>{
 const d=14,h=1e-4;assert(Math.abs((layout.preserveScroll(d)-layout.preserveScroll(d-h))/h-layout.PRESERVE_SPEED)<1e-5);
 assert(Math.abs((layout.preserveScroll(d+h)-layout.preserveScroll(d))/h-layout.PRESERVE_SPEED)<1e-4);
 assert.equal(layout.preserveScroll(80),layout.PRESERVE_FINAL_SCROLL);
 const scene=createPreserveScenery(),plane=new T.Group();plane.add(scene.root);
 const contact=createBossLaserContact(plane,scene.boss.root),buffers=[];
 scene.boss.root.traverse(o=>{if(o.isMesh)buffers.push([o.geometry,o.geometry.attributes.position.array]);});
 for(const time of [0,1.9,2.93,3.25,8.5,14.1,19.4]){
  scene.update(20+time,1);const aim={x:.7,y:-5.3},pose=scene.boss.pose(time,aim);
  plane.updateMatrixWorld(true);const pure=g.groundskeeperContact(time,aim,-100),actual=contact(0,22);
  assert(Math.abs(actual.y-pure.y*22/(22-pure.z))<1e-6);assert(Math.abs(actual.x-pure.x*22/(22-pure.z))<1e-6);
  for(let hand=0;hand<2;hand++)for(let finger=0;finger<3;finger++){
   const mesh=scene.boss.root.getObjectByName(`claw-${hand===0?-1:1}-${finger}`),p=mesh.geometry.attributes.position,v=new T.Vector3();
   const tip=new T.Vector3();for(let i=22*13;i<22*13+12;i++){v.fromBufferAttribute(p,i);tip.add(v);}tip.multiplyScalar(1/12);mesh.localToWorld(tip);
   const expected=g.groundskeeperFlight(pose.arms[hand].claws[finger][2]);assert(tip.distanceTo(new T.Vector3(expected.x,expected.y,expected.z))<1e-5);
  }
  const muzzle=new T.Vector3(0,-1.75,-.05);scene.boss.root.getObjectByName('dinosaur-head').localToWorld(muzzle);
  const pureMuzzle=g.groundskeeperFlight(g.groundskeeperMuzzle(pose));assert(muzzle.distanceTo(new T.Vector3(pureMuzzle.x,pureMuzzle.y,pureMuzzle.z))<1e-5,'posed muzzle matches lunge collision');
  for(let foot=0;foot<2;foot++){
   const shadow=scene.boss.root.getObjectByName(`foot-${foot===0?-1:1}`).getObjectByName('foot-contact-shadow');
   const anchor=shadow.getWorldPosition(new T.Vector3()),f=pose.feet[foot],expected=g.groundskeeperFlight({x:f.x,y:f.y-.55,z:.01});
   assert(anchor.distanceTo(new T.Vector3(expected.x,expected.y,expected.z))<1e-5,'contact shadow stays on deck during a lifted step');
  }
  for(const[geometry,array]of buffers){assert.equal(geometry.attributes.position.array,array);assert(array.every(Number.isFinite));}
 }
 const skull=scene.boss.root.getObjectByName('long-scaled-muzzle').geometry;skull.computeBoundingBox();const size=skull.boundingBox.getSize(new T.Vector3());assert(size.y>size.x*1.8,'face retains an elongated dinosaur muzzle');
});
