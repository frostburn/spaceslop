import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});
after(()=>server.close());
const {Flight,STEP}=await server.ssrLoadModule('/src/game.ts');
const c=await server.ssrLoadModule('/src/io-crucible.ts');
const {ioWaves,IO_DURATION}=await server.ssrLoadModule('/src/io-layout.ts');
const {createCrucible,createSlag}=await server.ssrLoadModule('/src/io-crucible-rig.ts');
const carrier=(x=0,y=3)=>({x,y,lane:1,age:0,fire:c.CRUCIBLE_FIRST_POUR,hp:c.CRUCIBLE_HP,crucible:true});
const slag=(x=0,y=1)=>({x,y,lane:0,age:0,fire:Infinity,hp:1,slag:{vx:0,vy:-3.4}});
function combat(weapon='sentry'){
 const f=new Flight(weapon,[],'vex','io');f.stepStage=()=>{};f.cooldown=f.droneCooldown=1000;return f;
}

test('Crucibles cross slowly from alternating sides, telegraph every pour, and leave before the boss',()=>{
 const waves=ioWaves.filter(w=>w.crucible);assert.equal(waves.length,5);
 for(const wave of waves){
  const direction=wave.lanes[0];assert([1,-1].includes(direction));
  assert(Math.abs(c.crucibleMotion(IO_DURATION-wave.time,direction).x)>6.8);
  for(let t=0;t<=11;t+=.02){const a=c.crucibleMotion(t,1),b=c.crucibleMotion(t,-1);assert.equal(a.x,-b.x);assert.equal(a.y,b.y);assert(Number.isFinite(a.x+a.y));}
 }
 assert.equal(c.crucibleValve(0,c.CRUCIBLE_FIRST_POUR),0);
 const first = c.CRUCIBLE_FIRST_POUR, next = first + c.CRUCIBLE_POUR_INTERVAL;
 assert(c.crucibleValve(first - .01,first)>.98);
 assert(Math.abs(c.crucibleValve(first,next)-1)<1e-12);
 assert.equal(c.crucibleValve(first + .4,next),0);
 assert.equal(c.slagHeat(0),1);assert.equal(c.slagHeat(.9),0);assert.equal(c.slagHeat(20),0);
 assert(c.slagSpeed(0)>c.slagSpeed(.9));
});

test('a pouring carrier releases three aimed droplets from its valve without ordinary plasma or per-frame repeats',()=>{
 const f=new Flight('sentry',[],'vex','io');f.fire=()=>{};f.stepDroneWeapon=()=>{};
 const enemy=carrier();enemy.age=c.CRUCIBLE_FIRST_POUR-STEP;f.enemies=[enemy];f.player={x:2,y:-5};f.step(STEP);
 assert.equal(f.threats.length,0);const droplets=f.enemies.filter(e=>e.slag);assert.equal(droplets.length,3);
 assert.equal(enemy.fire,c.CRUCIBLE_FIRST_POUR+c.CRUCIBLE_POUR_INTERVAL);
 for(const d of droplets){assert(Math.abs(d.x-enemy.x)<.06);assert(Math.abs(d.y-(enemy.y+c.CRUCIBLE_MUZZLE_Y))<.06);assert(d.slag.vy<0);assert.equal(d.hp,1);}
 const middle=droplets[1],dx=f.player.x-enemy.x,dy=f.player.y-enemy.y-c.CRUCIBLE_MUZZLE_Y;
 assert(Math.abs(middle.slag.vx*dy-middle.slag.vy*dx)<1e-9);
 f.step(STEP);assert.equal(f.enemies.filter(e=>e.slag).length,3);
});

test('the full unsuppressed route fits the prewarmed carrier and slag pools',()=>{
 const f=new Flight('sentry',[],'vex','io');f.fire=()=>{};f.stepDroneWeapon=()=>{};
 const seen=new Set();let maxCarriers=0,maxSlag=0;
 for(let i=0;i<6002;i++){
  f.invulnerable=100;f.step(STEP);
  const carriers=f.enemies.filter(e=>e.crucible),droplets=f.enemies.filter(e=>e.slag);
  for(const e of carriers)seen.add(e);
  maxCarriers=Math.max(maxCarriers,carriers.length);maxSlag=Math.max(maxSlag,droplets.length);
 }
 assert.equal(seen.size,5);assert(maxCarriers>0&&maxCarriers<=c.CRUCIBLE_POOL);assert(maxSlag>=6&&maxSlag<=c.SLAG_POOL);
 assert.equal(f.phase,'approach');assert.equal(f.enemies.length,0);
});

test('ship, drone, cannon and homing shots hit the larger vessel and destroy molten or cooled slag',()=>{
 for(const options of [{},{drone:true},{wing:'cannon'},{wing:'homing',damage:.5}]){
  const f=combat(),enemy=carrier(.72,1);f.enemies=[enemy];
  f.shots=[{x:0,y:0,z:0,vx:0,vy:18,vz:0,...options}];f.step(.08);
  assert(enemy.hp<c.CRUCIBLE_HP,JSON.stringify(options));
 }
 for(const age of [0,1.2]){
  const f=combat(),d=slag(.2,1);d.age=age;f.enemies=[d];f.shots=[{x:.2,y:0,z:0,vx:0,vy:18,vz:0}];f.step(.08);
  assert.equal(d.hp,0);assert.equal(f.score,10);assert.equal(f.drops.length,0);
 }
});

test('Omega pierces slag into a carrier once, lasers choose the nearest target, and Towline and Pulse clear both',()=>{
 const f=combat(),d=slag(0,1),e=carrier(0,2);f.enemies=[d,e];
 f.shots=[{x:0,y:0,z:0,vx:0,vy:20,vz:0,wing:'omega',damage:4,pierced:new Set()}];f.step(.12);
 assert.equal(d.hp,0);assert.equal(e.hp,c.CRUCIBLE_HP-4);f.step(.01);assert.equal(e.hp,c.CRUCIBLE_HP-4);
 const laser=combat(),shield=slag(0,1),vessel=carrier(.8,3);laser.enemies=[vessel,shield];
 const wing=laser.wings[0];laser.stepLaser(wing,{x:0,y:-3},false,1);
 assert.equal(wing.laserTarget,shield);assert.equal(shield.hp,0);assert.equal(vessel.hp,c.CRUCIBLE_HP);
 laser.stepLaser(wing,{x:0,y:-3},false,1);assert.equal(wing.laserTarget,vessel);assert(vessel.hp<c.CRUCIBLE_HP);
 const tow=combat('towline'),td=slag(0,1),te=carrier(0,3);tow.player={x:0,y:0};tow.drone={x:0,y:5};tow.towlineCooldown=0;tow.enemies=[td,te];tow.stepDroneWeapon(STEP);
 assert.equal(td.hp,0);assert.equal(te.hp,c.CRUCIBLE_HP-3);
 te.reward={weapon:'cannon',remaining:1};tow.pulse();assert.equal(te.hp,0);assert.equal(tow.enemies.length,0);assert.equal(tow.drops.length,1);assert.equal(tow.score,310);
});

test('escaped or upward-moving slag expires, while contact damages hull and removes the hazard',()=>{
 const f=new Flight('sentry',[],'vex','io');f.fire=()=>{};f.stepDroneWeapon=()=>{};
 const old=slag(0,2);old.age=10;const up=slag(0,10);up.slag.vy=3;f.enemies=[old,up];f.step(STEP);assert.equal(f.enemies.length,0);
 const d=slag(f.player.x,f.player.y);f.enemies=[d];const hull=f.hull;f.step(STEP);assert.equal(f.hull,hull-1);assert.equal(d.hp,0);
});

test('carrier and slag rigs share geometry, keep valve pivots independent, and cool without geometry allocation',()=>{
 const a=createCrucible(),b=createCrucible(),ga=[],gb=[];
 a.root.traverse(o=>{if(o.isMesh)ga.push(o.geometry);});b.root.traverse(o=>{if(o.isMesh)gb.push(o.geometry);});ga.forEach((g,i)=>assert.equal(g,gb[i]));
 a.pose(1.7,1);b.pose(0,0);
 assert(a.root.getObjectByName('crucible-valve-L').position.x<b.root.getObjectByName('crucible-valve-L').position.x);
 const chunk=createSlag(),other=createSlag(),body=chunk.root.children[0],geometry=body.geometry;
 assert.equal(geometry,other.root.children[0].geometry);
 chunk.pose(0);assert.equal(body.material.uniforms.heat.value,1);
 chunk.pose(1.2);assert.equal(body.material.uniforms.heat.value,0);assert.equal(body.geometry,geometry);
 assert.equal(other.root.children[0].material.uniforms.heat.value,1);
 const bounds=new T.Box3().setFromObject(a.root);assert(bounds.getSize(new T.Vector3()).x>1.9);
});
