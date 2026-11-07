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
const {createGroundskeeper}=await server.ssrLoadModule('/src/groundskeeper-rig.ts');
const {gkSkullGeometry,gkNaris,gkSkullPoint,gkSkullNormal}=await server.ssrLoadModule('/src/groundskeeper-skull.ts');
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

test('diagonal attacks, paired slams and recovery keep the rendered limbs outside the abdomen',()=>{
 const rig=createGroundskeeper(),torso=rig.root.getObjectByName('heavy-torso');
 const skin=torso.children.find(o=>o.isMesh&&o.material===rig.materials.down);
 const shell=new T.Mesh(skin.geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));shell.updateMatrixWorld();
 const center=new T.Vector3(0,-.1,6.9),ray=new T.Raycaster(),q=new T.Vector3(),direction=new T.Vector3(),offset=new T.Vector3();
 for(const x of[-3.5,0,3.5])for(const y of[-6.8,-5.3,0,5.5])for(const cycle of[0,1,2])for(const age of[0,1.8,2.35,2.6,2.85,3.05,3.25,3.5,3.8,4.1,4.35]){
  const time=cycle*g.GROUNDSKEEPER_CYCLE+age,p=rig.pose(time,{x,y});rig.root.updateMatrixWorld(true);offset.set(p.torso.x,p.torso.y,p.torso.z);
  for(const arm of p.arms){
   assert(Math.abs(Math.hypot(arm.elbow.x-arm.shoulder.x,arm.elbow.y-arm.shoulder.y,arm.elbow.z-arm.shoulder.z)-g.GROUNDSKEEPER_UPPER_ARM)<1e-6);
   assert(Math.abs(Math.hypot(arm.wrist.x-arm.elbow.x,arm.wrist.y-arm.elbow.y,arm.wrist.z-arm.elbow.z)-g.GROUNDSKEEPER_FOREARM)<1e-6);
  }
  for(const side of[-1,1])for(const[name,length]of[['upper-arm',g.GROUNDSKEEPER_UPPER_ARM],['forearm',g.GROUNDSKEEPER_FOREARM]]){
   const mesh=rig.root.getObjectByName(`${name}-${side}`).children.find(o=>o.isMesh&&!o.isInstancedMesh),positions=mesh.geometry.attributes.position;
   // Probe the actual tapered limb surface, allowing only the shoulder's first
   // fifth to merge into its attachment. No proxy hitbox supplies the verdict.
   for(let i=0;i<positions.count;i+=8){
    const t=(positions.getY(i)+mesh.position.y)/length;if(t<(name==='upper-arm'?.2:0)||t>1)continue;
    q.fromBufferAttribute(positions,i);mesh.localToWorld(q);q.sub(offset);direction.subVectors(q,center);const distance=direction.length();direction.normalize();ray.set(center,direction);
    const surface=ray.intersectObject(shell)[0];assert(surface&&distance>surface.distance+.03,`${name} enters abdomen: time=${time}, aim=${x},${y}, side=${side}`);
   }
  }
 }
 shell.material.dispose();
});

test('nostrils are recessed skin openings with lined passages and a closed manifold skull',()=>{
 const geometry=gkSkullGeometry(),mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.FrontSide}));mesh.updateMatrixWorld();
 const ray=new T.Raycaster();
 for(const side of[-1,1]){
  const naris=gkNaris(side);ray.set(naris.surface.clone().addScaledVector(naris.normal,.5),naris.normal.clone().negate());
  const hit=ray.intersectObject(mesh)[0];assert(hit&&hit.distance>.70&&hit.distance<.86,'ray enters a deep passage instead of hitting an unbroken snout');
  const y=naris.y+.42,skin=gkSkullPoint(y,naris.angle),normal=gkSkullNormal(y,naris.angle);
  ray.set(skin.addScaledVector(normal,.5),normal.negate());assert(Math.abs(ray.intersectObject(mesh)[0].distance-.5)<.03,'adjacent skin stays at the outer surface');
 }
 const p=geometry.attributes.position,ids=[],vertices=new Map(),edges=new Map();
 for(let i=0;i<p.count;i++){
  const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');if(!vertices.has(key))vertices.set(key,vertices.size);ids.push(vertices.get(key));
 }
 for(let i=0;i<geometry.index.count;i+=3){
  const triangle=[0,1,2].map(j=>ids[geometry.index.getX(i+j)]);
  for(let j=0;j<3;j++){const a=triangle[j],b=triangle[(j+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;edges.set(key,(edges.get(key)??0)+1);}
 }
 assert([...edges.values()].every(count=>count===2),'nasal rims and tunnel caps share a watertight skin boundary');
 geometry.dispose();mesh.material.dispose();
});

test('arm bends keep their lengths and avoid frame flips through attacks, recovery and Pulse',()=>{
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
 for(const x of[-3.5,0,3.5])for(const y of[-6.8,-5.3,0,5.5])for(const cancelledAt of[-100,2.5,8.5]){
  let previous;
  for(let frame=0;frame<=g.GROUNDSKEEPER_CYCLE*4*60;frame++){
   const time=frame/60,p=g.groundskeeperPose(time,{x,y},cancelledAt);
   for(const[i,arm]of p.arms.entries()){
    assert(Math.abs(distance(arm.shoulder,arm.elbow)-g.GROUNDSKEEPER_UPPER_ARM)<1e-6);
    assert(Math.abs(distance(arm.elbow,arm.wrist)-g.GROUNDSKEEPER_FOREARM)<1e-6);
    if(previous)assert(distance(arm.elbow,previous.arms[i].elbow)<2,'an elbow flips across its bend circle in a single simulation step');
   }
   previous=p;
  }
 }
});
