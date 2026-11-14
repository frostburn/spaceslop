import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const c=await server.ssrLoadModule('/src/vent-crab.ts'),v=await server.ssrLoadModule('/src/vent-layout.ts'),{createVentBoss}=await server.ssrLoadModule('/src/vent-boss.ts'),{Flight,STEP,BOSS_PROJECTION}=await server.ssrLoadModule('/src/game.ts');
const {createBossLaserContact}=await server.ssrLoadModule('/src/laser-contact.ts');
const {ventChallengeBoss}=await server.ssrLoadModule('/src/vent-challenge.ts');

test('the crab has two individually breakable claws and a protected core, with capped phase damage',()=>{
 const f=new Flight('sentry',[],'vex','vents');f.phase='boss';assert.equal(f.bossHealth,c.CRAB_HP);assert.equal(f.bossMaxHealth,c.CRAB_HP);
 f.damageBoss(100);assert.deepEqual(f.crabClawHealth,[0,12]);assert.equal(f.bossHealth,52);assert.equal(f.exposedCannonX,c.CRAB_TARGET_X);assert(!f.crabCoreOpen);
 f.damageBoss(100);assert.equal(f.bossHealth,40);assert(f.crabCoreOpen);assert.equal(f.exposedCannonX,0);assert.equal(f.crabOpening,0);
 f.time+=.8;assert.equal(f.crabOpening,1);assert.deepEqual(f.crabBreakPose,[1,1]);f.damageBoss(39);assert.equal(f.bossHealth,1);f.damageBoss(1);assert.equal(f.phase,'won');assert.equal(f.score,1000);
 const restart=new Flight('sentry',[],'vex','vents');assert.deepEqual(restart.crabClawHealth,[12,12]);assert(!restart.crabCoreOpen);
});

test('ship shots committed to a broken claw cannot hit a different claw or the newly exposed core',()=>{
 for(const both of [false,true]){
  const f=new Flight('sentry',[],'vex','vents');f.phase='boss';f.fire(f.player);const shot=f.shots[0];assert.equal(shot.crabTarget,-c.CRAB_TARGET_X);
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
   else if(mode==='towline'){const x=f.exposedCannonX*BOSS_PROJECTION,y=f.bossAimY*BOSS_PROJECTION;f.player={x,y:y-2};f.drone={x,y:y+2};f.droneCooldown=100;f.towlineCooldown=0;f.stepDroneWeapon(STEP);}
   else {f.cooldown=f.droneCooldown=1000;f.fire(mode==='drone'?{x:f.exposedCannonX*BOSS_PROJECTION,y:f.bossAimY*BOSS_PROJECTION}:f.player,mode==='drone');for(let i=0;i<28;i++){f.invulnerable=100;f.step(STEP);}}
   assert(f.bossHealth<before,mode+' phase '+phase);
  }
 }
});

test('claw charges retain three locked warnings and the core attack expands to five',()=>{
 for(const core of [false,true]){
  const f=new Flight('sentry',[],'vex','vents');f.phase='boss';if(core){f.damageBoss(12);f.damageBoss(12);}f.time=.6;f.stepBoss();assert.equal(f.markers.length,core?5:3);const points=f.markers.map(p=>({...p}));
  f.player.x=3;f.player.y=4;f.time=1.18;const origin=f.exposedCannonX;f.stepBoss();assert.deepEqual(f.markers,points);assert.equal(f.threats.length,core?5:3);for(const t of f.threats)assert.equal(t.x,origin);
 }
});

test('challenge Sovereign locks its aim, rotates the gap and adds more rows from its gills on the next lock', () => {
 for (const mode of ['bullet-hell', 'hardcore']) {
  const f = new Flight('sentry', [], 'vex', 'vents', undefined, mode);
  f.phase = 'boss';
  f.fire = () => {};
  f.stepDroneWeapon = () => {};
  f.invulnerable = 200;
  assert.equal(f.bossHealth, 2 * ventChallengeBoss.clawHealth + ventChallengeBoss.coreHealth);
  function advance(time) {
   const rows = [];
   while (f.time < time) {
    f.threats = [];
    f.step(STEP);
    if (f.threats.length) rows.push(f.threats);
   }
   return rows;
  }
  advance(.42);
  const lock = { ...f.player };
  assert.deepEqual(f.markers, [lock]);
  assert(f.cannonWindup > 0);
  f.player.x = 3;
  const [first] = advance(ventChallengeBoss.first + .02);
  assert.equal(first.length, 11);
  assert.equal(f.crabTargetX, -c.CRAB_TARGET_X);
  assert(first.every(shot => shot.planar && shot.z === 0 && shot.pattern));
  const bearing = shot => Math.atan2(shot.vx, -shot.vy);
  const gap = row => (bearing(row[0]) + bearing(row.find(shot => shot.pattern === 'accent'))) / 2;
  const rest = advance(ventChallengeBoss.interval);
  assert.equal(rest.length, ventChallengeBoss.rows - 1);
  assert(gap(rest[4]) > gap(first) + .2);
  assert(bearing(first[5]) - bearing(first[0]) > .47);
  assert.equal(f.firedCrabTarget, -c.CRAB_TARGET_X);
  assert.equal(f.crabTargetX, c.CRAB_TARGET_X);
  advance(ventChallengeBoss.interval + .5);
  f.damageBoss(1000);
  f.damageBoss(1000);
  assert.equal(f.bossHealth, ventChallengeBoss.coreHealth);
  assert.equal(advance(2 * ventChallengeBoss.interval).length, ventChallengeBoss.rows);
  assert.equal(advance(3 * ventChallengeBoss.interval).length, ventChallengeBoss.exposedRows);
  assert.equal(f.firedCrabTarget, 0);
  f.damageBoss(ventChallengeBoss.coreHealth);
  assert.equal(f.phase, 'won');
 }
});

test('eight articulated feet brace on the visible inner wall throughout the camera transform',()=>{
 const feet=c.crabFeet(1),boss=v.ventBossPose(1),co=Math.cos(v.VENT_PITCH),si=Math.sin(v.VENT_PITCH);assert.equal(feet.length,8);
 for(const p of feet){const x=boss.x+p.x,y=boss.y+p.y*co-p.z*si,z=boss.z+p.y*si+p.z*co;assert(Math.abs(Math.hypot(x,y-v.VENT_SHAFT_Y)-(v.VENT_SHAFT_RADIUS-.5))<1e-8);assert(z<boss.z);}
 for(let reveal=0;reveal<=1;reveal+=.02){const a=c.crabFeet(reveal),b=c.crabFeet(reveal+1e-5);for(let i=0;i<8;i++)assert(Math.hypot(a[i].x-b[i].x,a[i].y-b[i].y,a[i].z-b[i].z)<.005);}
});

test('raster rig has independent claws/apron, continuous limbs, extra barnacles and deterministic scrubbing',()=>{
 const r=createVentBoss();r.pose(1,.8,-2.4,-2.4,.2,1,[0,0],0);const finger=r.root.getObjectByName('crab-finger-0').rotation.z;r.pose(.5,0,0,0,0,4,[1,1],1);assert(r.root.getObjectByName('crab-apron-1').rotation.y>1);assert(r.root.getObjectByName('crab-crusher').rotation.z>.8);
 r.pose(1,.8,-2.4,-2.4,.2,1,[0,0],0);assert.equal(r.root.getObjectByName('crab-finger-0').rotation.z,finger);
 for(let i=0;i<8;i++){const upper=r.root.getObjectByName('crab-leg-upper-'+i),lower=r.root.getObjectByName('crab-leg-lower-'+i);assert(upper.scale.y>1);assert(lower.scale.y>1);for(const n of [...upper.quaternion.toArray(),...lower.position.toArray()])assert(Number.isFinite(n));}
 const meshes=[];r.root.traverse(o=>{if(o.isMesh)meshes.push(o);});assert(meshes.filter(m=>m.name==='crab-barnacle-colony').length>=20);const texture=new T.Texture();r.setAtlas(texture);for(const mesh of meshes)if(mesh.material.map)assert.equal(mesh.material.map,texture);
});

test('cropped armor overlaps its neighbor at the knee and planted toe through the descent and scurry', () => {
 const rig = createVentBoss();
 const part = (name, i) => rig.root.getObjectByName(`crab-${name}-${i}`);
 const inPart = (point, mesh) => mesh.worldToLocal(rig.root.localToWorld(point.clone()));
 for (const [reveal, time] of [[.25,106], [1,108], [1,110], [1,114.5]]) {
  rig.pose(reveal, .6, -2.4, -2.4, 1, time);
  rig.root.updateMatrixWorld(true);
  const feet = c.crabFeet(reveal, Math.max(0, time - v.VENT_DURATION - v.VENT_APPROACH));
  for (let i = 0; i < c.CRAB_LEGS; i++) {
   const upper = part('leg-upper', i), lower = part('leg-lower', i), toe = part('foot', i);
   const knee = part('knee', i).position.clone();
   knee.z -= .11;
   const tip = new T.Vector3().copy(feet[i]).divideScalar(v.VENT_CRAB_SCALE);
   const ankle = new T.Vector3(0, .39, 0).applyMatrix4(toe.matrix);
   assert(Math.abs(inPart(knee, upper).y) < .48 && Math.abs(inPart(knee, lower).y) < .48);
   assert(Math.abs(inPart(ankle, lower).y) < .5);
   assert(inPart(tip, toe).y > -.5 && inPart(tip, toe).y < -.3);
  }
 }
 const uv = part('leg-upper', 0).geometry.attributes.uv;
 for (let i = 0; i < uv.count; i++)
  assert(uv.getY(i) > .72 && uv.getY(i) < .95, 'upper leg sampled an open socket end');
});

test('outer legs attach higher on the shell and neither link stretches through a scurry', () => {
 const rig = createVentBoss();
 const start = v.VENT_DURATION + v.VENT_APPROACH;
 for (let time = 0; time <= 12; time += .05) {
  rig.pose(1, 0, 0, 0, 0, start + time);
  for (const side of [0, 1]) {
   let previous;
   for (let i = side; i < c.CRAB_LEGS; i += 2) {
    const upper = rig.root.getObjectByName(`crab-leg-upper-${i}`);
    const lower = rig.root.getObjectByName(`crab-leg-lower-${i}`);
    const knee = rig.root.getObjectByName(`crab-knee-${i}`).position.clone();
    knee.z -= .11;
    const hip = upper.position.clone().multiplyScalar(2).sub(knee);
    if (previous) {
     assert(Math.abs(hip.x) - Math.abs(previous.x) > .2);
     assert(hip.y - previous.y > .2);
    }
    previous = hip;
    assert(upper.scale.y < 3.1 && lower.scale.y < 3.1);
   }
  }
 }
});

test('claw and central laser contacts follow posed anchors and recoil after either phase change',()=>{
 const plane=new T.Group(),r=createVentBoss();plane.add(r.root);r.root.position.set(0,4.2,-12);const contact=createBossLaserContact(plane,r.root);
 for(const target of [-c.CRAB_TARGET_X,c.CRAB_TARGET_X,0]){r.pose(1,1,target,target,1,2,[0,0],target===0?1:0);plane.updateMatrixWorld(true);const p=contact(target,22),anchor=r.root.getObjectByName(target<0?'laser_contact_L':target>0?'laser_contact_R':'laser_contact_C'),q=anchor.getWorldPosition(new T.Vector3()),scale=22/(22-q.z);assert(Math.hypot(p.x-q.x*scale,p.y-q.y*scale)<1e-8);assert.equal(q.x,target);}
});
