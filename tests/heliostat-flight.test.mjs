import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,
  define:{__ENCOUNTER_TEXTURES__:'{}'},server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});
after(()=>server.close());
const c=await server.ssrLoadModule('/src/heliostat/combat.ts');
const {Flight,STEP,BOSS_PROJECTION}=await server.ssrLoadModule('/src/game.ts');
const {WING_FORMATION}=await server.ssrLoadModule('/src/wing.ts');
const {createLevel}=await server.ssrLoadModule('/src/rendering/levels/heliostat.ts');

test('complete Heliostat route fits its prewarmed drone/guard pools and grants all accessories',()=>{
  const f=new Flight('sentry',[],'vex','heliostat');f.invulnerable=1e5;f.cooldown=f.droneCooldown=1e5;
  const encountered=new Set(),drops=new Set();let maxD=0,maxG=0;
  for(let i=0;i<6001&&f.phase==='stage';i++){
    f.step(STEP);const drones=f.enemies.filter(e=>e.heliostat?.kind==='drone'),guards=f.enemies.filter(e=>e.heliostat?.kind==='guard');
    maxD=Math.max(maxD,drones.length);maxG=Math.max(maxG,guards.length);
    for(const e of f.enemies){assert(e.heliostat,'prototype fauna leaked into station');encountered.add(e.heliostat.kind);if(e.drop)drops.add(e.drop);assert(Number.isFinite(e.x+e.y));}
  }
  assert.equal(f.phase,'approach');assert.equal(f.nextWave,20);assert.equal(f.transitionDuration,8);
  assert.deepEqual([...encountered].sort(),['drone','guard']);assert.equal(drops.size,4);
  assert(maxD<=c.HELIOSTAT_DRONE_POOL);assert(maxG<=c.HELIOSTAT_GUARD_POOL);
  for(let i=0;i<481;i++)f.step(STEP);assert.equal(f.phase,'boss');assert.equal(f.bossHealth,c.HELIOSTAT_HP);
});

test('capacitors warn harmlessly, hurt only across active filaments, and leave a genuine safe gap',()=>{
  for(let site=0;site<c.electricSites.length;site++){
    const at=c.electricSites[site].at,warning=c.electricPose(site,at-2.2),hot=c.electricPose(site,at-1.1);
    assert(warning.warning&&!warning.hot);assert(hot.hot);
    assert(!c.electricHits(site,at-2.2,at-2.2-STEP,{x:3,y:warning.y}));
    assert(c.electricHits(site,at-1.1,at-1.1-STEP,{x:hot.gap>0?-3:3,y:hot.y}));
    for(let t=at-3;t<at+3;t+=STEP)assert(!c.electricHits(site,t,t-STEP,{x:hot.gap,y:c.electricPose(site,t).y}));
  }
  const time=c.electricSites[0].at-1.1,p=c.electricPose(0,time);
  for(const safe of[false,true]){const f=new Flight('sentry',[],'vex','heliostat');f.time=time;f.nextWave=20;f.player={x:safe?p.gap:3,y:p.y};f.step(STEP);assert.equal(f.hull,safe?4:3);f.step(STEP);assert.equal(f.hull,safe?4:3);}
});

test('plasma packets cannot duplicate or disappear at fixed-step and cycle boundaries',()=>{
  const whole=c.heliostatPackets(0,44),stepped=[];
  for(let i=1;i<=2640;i++)stepped.push(...c.heliostatPackets((i-1)*STEP,i*STEP));
  assert.deepEqual(stepped,whole);assert.equal(whole.length,60);assert.equal(new Set(whole.map(p=>`${p.cycle}:${p.pulse}`)).size,60);
});

test('regulator locks its two target lanes before six paired plasma packets',()=>{
  const f=new Flight('sentry',[],'vex','heliostat');f.phase='boss';f.cooldown=f.droneCooldown=1e5;f.invulnerable=1e5;f.player={x:1,y:-4};
  for(let i=0;i<50;i++)f.step(STEP);const locked=structuredClone(f.markers);assert.equal(locked.length,2);
  f.player={x:-3,y:-6};for(let i=0;i<115;i++)f.step(STEP);
  assert.equal(f.threats.length,12);assert.deepEqual(f.markers,locked);
  for(const [i,shot]of f.threats.entries()){
    const t=-shot.z/shot.vz;assert(Math.abs(shot.x+shot.vx*t-locked[i%2].x)<1e-8);assert(Math.abs(shot.y+shot.vy*t-locked[i%2].y)<1e-8);
  }
});

for(const weapon of['homing','cannon','laser','omega','sentry','towline','pulse'])test(`regulator accepts ${weapon} damage on its visible aperture`,()=>{
  const wing=['homing','cannon','laser','omega'].includes(weapon);
  const f=new Flight(weapon==='towline'?'towline':'sentry',wing?[undefined,weapon]:[],'vex','heliostat');
  f.phase='boss';f.invulnerable=1e5;f.cooldown=1e5;f.stepBoss=()=>{};
  if(wing){f.droneCooldown=1e5;f.player.x=-WING_FORMATION.x;}
  if(weapon==='sentry')f.drone={x:0,y:-4};
  if(weapon==='towline'){f.player={x:-2,y:4.2*BOSS_PROJECTION};f.drone={x:2,y:4.2*BOSS_PROJECTION};}
  const before=f.bossHealth;if(weapon==='pulse')f.pulse();else for(let i=0;i<180;i++)f.step(STEP);
  assert(f.bossHealth<before,weapon+' missed the boss');
});

test('the physical boss, its laser contact and star-feed ducts remain continuous through the swing',async()=>{
  const plane=new T.Group(),scene=new T.Scene();scene.add(plane);const level=createLevel({plane,scene,signal:new AbortController().signal});plane.add(level.root);await level.ready;
  const f=new Flight('sentry',[],'vex','heliostat');let previous;
  for(let i=0;i<=100;i++){
    const reveal=i/100,time=100+i*.08;level.update({flight:f,time,reveal,animationTime:time});plane.updateMatrixWorld(true);
    const p=level.boss.getWorldPosition(new T.Vector3());if(previous)assert(p.distanceTo(previous)<.4);previous=p;
    const expected=c.heliostatBossPoint(time,reveal);assert(p.distanceTo(new T.Vector3(expected.x,expected.y,expected.z))<1e-8);
  }
  assert(previous.distanceTo(new T.Vector3(0,4.2,-12))<1e-8);
  const contact=level.contact(0,22,f);assert(Math.abs(contact.x)<1e-8);assert(Math.abs(contact.y-4.2*22/(22+11.2))<1e-8);
  const anchor=level.boss.getObjectByName('laser_contact_C').position;
  const ray=new T.Raycaster(new T.Vector3(anchor.x,anchor.y-3,anchor.z).applyMatrix4(level.boss.matrixWorld),new T.Vector3(0,1,0).transformDirection(level.boss.matrixWorld));
  const hit=ray.intersectObject(level.boss,true).find(h=>!h.object.material.transparent);
  assert(hit&&Math.abs(hit.distance-3)<1e-6,'laser anchor floats off the visible aperture');
  assert(level.boss.getObjectByName('sunspot-feed-ducts'));
  level.dispose();
});

test('fallback level composes background safely after a failed foreground render',async()=>{
  const scene=new T.Scene(),level=createLevel({plane:new T.Group(),scene,signal:new AbortController().signal});await level.ready;
  const background=new T.Color(0x123456);scene.background=background;let calls=0;
  const renderer={autoClear:true,getDrawingBufferSize:v=>v.set(390,844),clear(){},clearDepth(){},render(){if(++calls===2)throw Error('interrupted');}};
  assert.throws(()=>level.present(renderer,scene,new T.Camera()),/interrupted/);assert.equal(renderer.autoClear,true);assert.equal(scene.background,background);
  level.dispose();
});

test('flight prewarm restores nested route culling and shared geometry after priming every variant',async()=>{
  const level=createLevel({plane:new T.Group(),scene:new T.Scene(),signal:new AbortController().signal});await level.ready;
  const before=new Map();level.root.traverse(o=>{if(o.isMesh)before.set(o,[o.frustumCulled,o.geometry]);});
  level.prepare();assert([...before.keys()].every(m=>!m.frustumCulled));level.afterWarmup();
  for(const[m,[cull,geometry]]of before){assert.equal(m.frustumCulled,cull);assert.equal(m.geometry,geometry);}
  level.dispose();
});
