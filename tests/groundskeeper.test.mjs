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
 const center=new T.Vector3(0,-.1,6.9),ray=new T.Raycaster(),q=new T.Vector3(),direction=new T.Vector3();
 for(const x of[-3.5,0,3.5])for(const y of[-6.8,-5.3,0,5.5])for(const cycle of[0,1,2])for(const age of[0,1.8,2.35,2.6,2.85,3.05,3.25,3.5,3.8,4.1,4.35]){
  const time=cycle*g.GROUNDSKEEPER_CYCLE+age,p=rig.pose(time,{x,y});rig.root.updateMatrixWorld(true);
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
    q.fromBufferAttribute(positions,i);mesh.localToWorld(q);torso.worldToLocal(q);direction.subVectors(q,center);const distance=direction.length();direction.normalize();ray.set(center,direction);
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

test('resting elbows fold back and down, and both arm sections preserve the elbow hinge axis',()=>{
 const rig=createGroundskeeper(),v=p=>new T.Vector3(p.x,p.y,p.z),xAxis=new T.Vector3(1,0,0),yAxis=new T.Vector3(0,1,0);
 const rest=rig.pose(0);
 for(const arm of rest.arms){
  const upper=v(arm.elbow).sub(v(arm.shoulder)),lower=v(arm.wrist).sub(v(arm.elbow));
  const bend=T.MathUtils.radToDeg(upper.angleTo(lower));
  assert(bend>60&&bend<115,'resting elbow has an open flexion angle');
  assert(arm.elbow.z<arm.shoulder.z-1.2&&arm.elbow.y>arm.shoulder.y+.3,'humerus descends back toward the elbow');
 }
 for(const x of[-3.5,0,3.5])for(const y of[-6.8,0,5.5])for(const t of[0,1.8,2.5,2.85,3.25,3.85,8.5,8.85,14.1,19.4]){
  const p=rig.pose(t,{x,y});
  for(const arm of p.arms){
   const upper=rig.root.getObjectByName(`upper-arm-${arm.side}`),lower=rig.root.getObjectByName(`forearm-${arm.side}`);
   const u=v(arm.elbow).sub(v(arm.shoulder)).normalize(),l=v(arm.wrist).sub(v(arm.elbow)).normalize(),hinge=u.clone().cross(l).normalize();
   const ux=xAxis.clone().applyQuaternion(upper.quaternion),lx=xAxis.clone().applyQuaternion(lower.quaternion);
   assert(Math.abs(ux.dot(hinge))>1-1e-6&&ux.dot(lx)>1-1e-6,'a bone rolls away from the shared hinge plane');
   assert(yAxis.clone().applyQuaternion(upper.quaternion).dot(u)>1-1e-6&&yAxis.clone().applyQuaternion(lower.quaternion).dot(l)>1-1e-6);
   const palm=rig.root.getObjectByName(`palm-${arm.side}`),direction=v(arm.direction),across=ux.clone().addScaledVector(direction,-ux.dot(direction)).normalize();
   assert(xAxis.clone().applyQuaternion(palm.quaternion).dot(across)>1-1e-6,'hand acquires independent forearm twist');
   const claw=rig.root.getObjectByName(`claw-${arm.side}-1`),positions=claw.geometry.attributes.position,curve=new T.CatmullRomCurve3(arm.claws[1].map(v)),tangent=curve.getTangent(0);
   const expected=across.clone().addScaledVector(tangent,-across.dot(tangent)).normalize(),actual=new T.Vector3().fromBufferAttribute(positions,0).sub(new T.Vector3().fromBufferAttribute(positions,6)).normalize();
   assert(actual.dot(expected)>1-1e-6,'flattened claw cross-section rolls independently of its hand');
  }
 }
});

test('both pupils face forward and have clear sight past the skull and feather hood',()=>{
 const rig=createGroundskeeper();rig.pose(0);rig.root.updateMatrixWorld(true);
 const head=rig.root.getObjectByName('dinosaur-head'),skull=head.getObjectByName('long-scaled-muzzle'),coat=head.children.filter(o=>o.isInstancedMesh),ray=new T.Raycaster();
 for(const side of[-1,1]){
  const socket=head.getObjectByName(`eye-${side}`),axis=new T.Vector3(0,0,1).applyQuaternion(socket.quaternion);
  assert(axis.dot(new T.Vector3(0,-1,0))>.9,'eye points laterally instead of toward the snout');
  const pupil=head.getObjectByName(`pupil-${side}`),origin=pupil.getWorldPosition(new T.Vector3());
  for(const x of[-.5,0,.5]){
   const direction=head.localToWorld(new T.Vector3(x,-6,.52)).sub(origin).normalize();ray.set(origin.clone().addScaledVector(direction,.015),direction);ray.far=6;
   assert.equal(ray.intersectObjects([skull,...coat]).length,0,'snout or scalp obstructs the forward field of view');
  }
 }
});

test('neck feathers retain seeded placement while varying their width, length and cant',()=>{
 const rig=createGroundskeeper(),neck=rig.root.getObjectByName('raised-neck-hackles'),matrix=new T.Matrix4(),position=new T.Vector3(),rotation=new T.Quaternion(),scale=new T.Vector3();
 rig.pose(0);const initial=neck.instanceMatrix.array.slice(),widths=[],lengths=[];
 for(let i=0;i<neck.count;i++){neck.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);widths.push(scale.x);lengths.push(scale.y);}
 const average=a=>a.reduce((s,v)=>s+v,0)/a.length,mean=average(lengths),variance=average(lengths.map(v=>(v-mean)**2));
 const adjacent=lengths.slice(1).reduce((sum,v,i)=>sum+(v-mean)*(lengths[i]-mean),0)/(lengths.length-1)/variance;
 assert(Math.max(...widths)-Math.min(...widths)>.2,'neck vanes all have the same width');
 assert(Math.abs(adjacent)<.15,'periodic feather sizing creates repeating rows');
 rig.pose(1.8);rig.pose(0);assert.deepEqual(neck.instanceMatrix.array,initial,'variation must not reroll during animation or reset');
});

test('quiet breathing and weight shifts deform the chest while the feet stay planted and poses remain repeatable',()=>{
 const rig=createGroundskeeper(),body=rig.root.getObjectByName('heavy-torso'),widths=[],shifts=[],heads=[],v=p=>new T.Vector3(p.x,p.y,p.z);
 let previous;
 for(let frame=0;frame<=360;frame++){
  const t=-6+frame/60,p=rig.pose(t);rig.root.updateMatrixWorld(true);
  widths.push(body.scale.y);shifts.push(body.position.x);heads.push(p.head.x-p.torso.x);
  for(const side of[-1,1]){
   const foot=rig.root.getObjectByName(`foot-${side}`);assert(foot.getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(side*2.15,-.35,0))<1e-8,'idle motion slides or lifts a foot');
  }
  const marker=rig.root.getObjectByName('laser_contact_C').getWorldPosition(new T.Vector3()),onBody=body.localToWorld(v(g.GROUNDSKEEPER_BELLY));
  assert(marker.distanceTo(onBody)<1e-6,'breathing separates the target from its visible body');
  if(previous){assert(v(p.head).distanceTo(v(previous.head))<.02);for(let i=0;i<2;i++)assert(v(p.arms[i].elbow).distanceTo(v(previous.arms[i].elbow))<.02);}
  previous=p;
 }
 const range=a=>Math.max(...a)-Math.min(...a);
 assert(range(widths)>.025&&range(widths)<.04,'breathing should be visible but restrained');
 assert(range(shifts)>.15&&range(shifts)<.4,'weight shift should stay within the planted stance');
 assert(range(heads)>.04,'head follows with some independent neck motion');
 rig.pose(-3.7);const before=rig.root.getObjectByName('raised-neck-hackles').instanceMatrix.array.slice();rig.pose(2.9);rig.pose(-3.7);
 assert.deepEqual(rig.root.getObjectByName('raised-neck-hackles').instanceMatrix.array,before,'scrubbing and reset must not accumulate motion');
});

test('idle clock is continuous into the approach and boss, then freezes on results',()=>{
 const f=new Flight('sentry',[],'vex','preserve');f.time=f.stageDuration-STEP;const a=f.groundskeeperTime;f.step(STEP);
 assert.equal(f.phase,'approach');assert(Math.abs(f.groundskeeperTime-a-STEP)<1e-7);
 f.time=f.transitionDuration-STEP;const b=f.groundskeeperTime;f.step(STEP);
 assert.equal(f.phase,'boss');assert(Math.abs(f.groundskeeperTime-b-STEP)<1e-7);
 f.time=.73;f.damageBoss(1e5);assert.equal(f.groundskeeperTime,.73);f.step(5);assert.equal(f.groundskeeperTime,.73);
 const fresh=new Flight('sentry',[],'vex','preserve');assert.equal(fresh.groundskeeperTime,-fresh.stageDuration-fresh.transitionDuration);
});
