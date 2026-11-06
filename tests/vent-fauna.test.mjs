import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const m=await server.ssrLoadModule('/src/vent-fauna.ts'),v=await server.ssrLoadModule('/src/vent-layout.ts'),{Flight,STEP}=await server.ssrLoadModule('/src/game.ts');
const {createFaunaAssets,createVentShrimp,createVentWorm}=await server.ssrLoadModule('/src/vent-fauna-rig.ts');
const {createLaserContactTrace}=await server.ssrLoadModule('/src/laser-contact.ts');
const assets=createFaunaAssets(new T.DataTexture(new Uint8Array([255,255,255,255]),1,1));
const course={formation:'weave',mirror:1,slot:0};
function shrimp(){return{x:0,y:1,lane:0,age:0,fire:1.9,hp:3,heading:0,shrimp:course};}
function worm(){return{...v.ventAnchorPoint(6,19.4),lane:0,ventAnchor:6,ventWorm:true,ventScale:.8,mortarAngle:0,age:0,fire:2.4,hp:6};}

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

test('rigs share raster resources, have independent limbs, retain fixed tube feet and scrub deterministically',()=>{
 const a=createVentShrimp(assets),b=createVentShrimp(assets),w=createVentWorm(assets),foot=w.root.getObjectByName('worm-fixed-tube'),fixed=foot.position.clone();
 assert.equal(a.root.getObjectByName('shrimp-carapace').geometry,b.root.getObjectByName('shrimp-carapace').geometry);
 a.pose(1,1.9);const tail=a.root.getObjectByName('shrimp-tail-1').rotation.z;a.pose(4,5);a.pose(1,1.9);assert.equal(a.root.getObjectByName('shrimp-tail-1').rotation.z,tail);
 assert.notEqual(a.root.getObjectByName('shrimp-limb-2').rotation.z,a.root.getObjectByName('shrimp-limb-4').rotation.z);
 w.pose(2.39,2.4,.8);const extended=w.root.getObjectByName('worm-crown').position.y;w.pose(2.75,7,.8);assert(w.root.getObjectByName('worm-crown').position.y>extended+.2);assert.deepEqual(foot.position,fixed);assert(!w.combat.children.includes(foot));
});

test('posed mouth anchors and combat origins match throughout shrimp turns and worm charge/recoil',()=>{
 const point=new T.Vector3();
 for(const isWorm of [false,true])for(const angle of [-2.5,-.5,0,1.3])for(const age of [.2,2.39,2.4,2.65]){
  const e=isWorm?worm():shrimp(),rig=isWorm?createVentWorm(assets):createVentShrimp(assets);e.age=age;e.fire=age>=2.4?7:2.4;e.mortarAngle=e.heading=angle;
  rig.root.position.set(e.x,e.y,0);rig.root.scale.setScalar(e.ventScale??1);if(isWorm)rig.pose(age,e.fire,angle);else{rig.root.rotation.z=angle;rig.pose(age,e.fire);}
  rig.root.updateMatrixWorld(true);rig.root.getObjectByName(isWorm?'worm-muzzle':'shrimp-muzzle').getWorldPosition(point);const expected=m.faunaMuzzle(e);assert(Math.hypot(point.x-expected.x,point.y-expected.y)<1e-8);
 }
});

test('shrimp paired shots and worm five-pearl fans fire once from living mouths at their own cadence',()=>{
 for(const isWorm of [false,true]){
  const f=new Flight('sentry',[],'vex','vents'),e=isWorm?worm():shrimp(),first=isWorm?2.4:1.9;f.time=isWorm?19.4:2.6;f.nextWave=100;f.fire=()=>{};f.stepDroneWeapon=()=>{};e.age=first-STEP;f.enemies=[e];f.step(STEP);
  assert.equal(f.threats.length,isWorm?5:2);assert.equal(e.fire,first+(isWorm?4.6:3.1));
  for(const shot of f.threats)assert(Math.abs(Math.hypot(shot.vx,shot.vy)-(isWorm?3.2:4.8))<1e-8);
  f.step(STEP);assert.equal(f.threats.length,isWorm?5:2);f.damageEnemy(e,10);assert.equal(f.score,isWorm?200:125);
 }
});

test('worm laser ablation meets the raised crown and ignores the wide inert mineral rim',()=>{
 const plane=new T.Group(),w=createVentWorm(assets);plane.add(w.root);w.pose(2.4,2.4,0);plane.updateMatrixWorld(true);const trace=createLaserContactTrace(plane);
 const living=trace({x:0,y:-3},{x:0,y:1},w.combat,40);assert(living.y<-.95,'beam should meet the extended crown before the base');
 assert.equal(trace({x:.68,y:-3},{x:.68,y:1},w.combat,40).y,1);assert(trace({x:.68,y:-3},{x:.68,y:1},w.root,40).y<1,'control beam crosses the decorative tube');
});

test('all weapons use rotated shrimp bodies and articulated worm flesh instead of decorative tube rims',()=>{
 const e=shrimp();e.heading=Math.PI/2;assert(m.faunaBodyHit(e,{x:-2,y:1},{x:2,y:1}));assert(!m.faunaBodyHit(e,{x:-2,y:2.3},{x:2,y:2.3}));
 const w=worm();w.x=w.y=0;const head=m.faunaMuzzle(w);assert(m.faunaBodyHit(w,head,head));assert(!m.faunaBodyHit(w,{x:.64,y:0},{x:.64,y:0}));
 for(const isWorm of [false,true]){
  for(const options of [{},{drone:true},{wing:'homing',damage:.5},{wing:'cannon'},{wing:'omega',damage:4,pierced:new Set()}]){
   const f=new Flight('sentry',[],'vex','vents'),target=isWorm?worm():shrimp();target.x=0;target.y=1;target.age=2.3;const before=target.hp;f.enemies=[target];f.stepStage=()=>{};f.cooldown=f.droneCooldown=1000;
   f.shots=[{x:0,y:-.4,z:0,vx:0,vy:25,vz:0,...options}];f.step(.1);assert(target.hp<before,JSON.stringify({isWorm,...options}));
  }
  const f=new Flight('towline',[],'vex','vents'),target=isWorm?worm():shrimp();target.x=0;target.y=1;f.enemies=[target];const before=target.hp;f.stepLaser(f.wings[0],{x:0,y:-2},false,1);assert(target.hp<before);assert.equal(f.wings[0].laserTarget,target);
  target.hp=before;f.player={x:0,y:-1};f.drone={x:0,y:3};f.droneCooldown=0;f.stepDroneWeapon(STEP);assert(target.hp<before);f.pulse();assert.equal(target.hp,0);
 }
});

test('the full non-shooting route fits prewarmed pools, spawns all fauna and clears before the abyss swing',()=>{
 const f=new Flight('sentry',[],'vex','vents');f.fire=()=>{};f.stepDroneWeapon=()=>{};const forms=new Set(),worms=new Set(),drops=new Set();let maxShrimp=0,maxWorm=0;
 for(let i=0;i<6002;i++){
  f.invulnerable=100;f.step(STEP);maxShrimp=Math.max(maxShrimp,f.enemies.filter(e=>e.shrimp).length);maxWorm=Math.max(maxWorm,f.enemies.filter(e=>e.ventWorm).length);
  for(const e of f.enemies){if(e.shrimp)forms.add(e.shrimp.formation);if(e.ventWorm)worms.add(e.ventAnchor);if(e.drop)drops.add(e.drop);}
 }
 assert.equal(forms.size,3);assert.equal(worms.size,4);assert.equal(drops.size,4);assert(maxShrimp<=m.SHRIMP_POOL);assert(maxWorm<=m.WORM_POOL);assert.equal(f.phase,'approach');assert.equal(f.enemies.length,0);
});
