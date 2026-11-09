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
    assert(warning.warning&&!warning.hot);assert(hot.hot);assert(c.electricPose(site,at+6).hot&&c.electricPose(site,at+6).visible,'gate vanished while still in view');
    assert(!c.electricHits(site,at-2.2,at-2.2-STEP,{x:3,y:warning.y}));
    assert(c.electricHits(site,at-1.1,at-1.1-STEP,{x:hot.gap>0?-3:3,y:hot.y}));
    for(let t=at-3;t<at+3;t+=STEP)assert(!c.electricHits(site,t,t-STEP,{x:hot.gap,y:c.electricPose(site,t).y}));
  }
  const time=c.electricSites[0].at-1.1,p=c.electricPose(0,time);
  for(const safe of[false,true]){const f=new Flight('sentry',[],'vex','heliostat');f.time=time;f.nextWave=20;f.player={x:safe?p.gap:3,y:p.y};f.step(STEP);assert.equal(f.hull,safe?4:3);f.step(STEP);assert.equal(f.hull,safe?4:3);}
});

test('continuous plasma crosses the flight plane exactly at its locked contact and has a harmless grow/fade',()=>{
  assert(!c.heliostatPlasmaPhase(c.HELIOSTAT_FIRE+.1).hot);assert(c.heliostatPlasmaPhase(c.HELIOSTAT_FIRE+.4).hot);
  assert(!c.heliostatPlasmaPhase(c.HELIOSTAT_FIRE+c.HELIOSTAT_CHANNEL+.1).hot);
  for(const side of[-1,1]){
    const target={x:side*1.3,y:-4.5},path=c.heliostatPlasmaControls(side,target),hit=c.heliostatPlasmaPoint(.84,path);
    assert(Math.hypot(hit.x-target.x,hit.y-target.y,hit.z)<1e-9);let last=-20;
    for(let i=0;i<=1000;i++){const p=c.heliostatPlasmaPoint(i/1000,path);assert(Number.isFinite(p.x+p.y+p.z));assert(p.z>=last);last=p.z;}
    const a=c.heliostatPlasmaPoint(.84-1e-7,path),b=c.heliostatPlasmaPoint(.84+1e-7,path);assert(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<1e-4);
    assert(c.heliostatPlasmaHits(2.5,[target],target));assert(!c.heliostatPlasmaHits(2.5,[target],{x:target.x+1,y:target.y}));
  }
});

test('regulator channels locked plasma without creating bullets, and Pulse interrupts the current channel',()=>{
  const f=new Flight('sentry',[],'vex','heliostat');f.phase='boss';f.cooldown=f.droneCooldown=1e5;f.player={x:1,y:-4};
  for(let i=0;i<50;i++)f.step(STEP);const locked=structuredClone(f.markers);assert.equal(locked.length,2);
  f.player={x:-3,y:-6};for(let i=0;i<115;i++)f.step(STEP);
  assert.equal(f.threats.length,0);assert.deepEqual(f.markers,locked);assert.deepEqual(f.heliostatTargets,locked);
  f.player={...locked[0]};const hull=f.hull;f.step(STEP);assert.equal(f.hull,hull-1);
  f.pulse();assert.deepEqual(f.heliostatTargets,[]);const after=f.hull;
  for(let i=0;i<12;i++){f.invulnerable=0;f.step(STEP);}assert.equal(f.hull,after);
});

test('man o’war first fire waits for its full body and a visible charge, including negative entry ages',()=>{
  const f=new Flight('sentry',[],'vex','heliostat');f.nextWave=20;f.cooldown=f.droneCooldown=1e5;f.invulnerable=1e5;
  const course={kind:'guard',formation:'vee',slot:0,mirror:1},lane=-2.15,p=c.heliostatMotion(-3,lane,course);
  const enemy={...p,lane,age:-3,fire:c.HELIOSTAT_GUARD_FIRE,hp:8,heliostat:course};f.enemies=[enemy];
  let shot=false;for(let i=0;i<700;i++){
    const before=f.threats.length;f.step(STEP);
    if(enemy.age<c.HELIOSTAT_GUARD_FIRE)assert.equal(f.threats.length,0);
    if(f.threats.length>before){shot=true;assert(enemy.y+1.5<8);assert(enemy.y>=-5.2);assert(enemy.age>=c.HELIOSTAT_GUARD_FIRE);break;}
  }assert(shot);
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

test('deep service islands share templates, stay below flight and restore priming state',async()=>{
  const {createHeliostatMaterials}=await server.ssrLoadModule('/src/heliostat/materials.ts'),{createUnderworks}=await server.ssrLoadModule('/src/heliostat/underworks.ts');
  const m=createHeliostatMaterials(),s=createUnderworks(m);assert.equal(s.islands.length,15);
  for(let t=0;t<=108;t+=.5){s.update(t);assert(s.islands.filter(i=>i.root.visible).length<=4);}
  const bounds=new T.Box3().setFromObject(s.root);assert(bounds.max.z < -10,'background machinery intersects combat altitude');
  s.root.visible=false;const before=s.islands.map(i=>[i.root.position.y,i.root.visible]),restore=s.prepare(50);assert(s.root.visible);assert.equal(s.islands.filter(i=>i.root.visible).length,3);
  restore();assert(!s.root.visible);assert.deepEqual(s.islands.map(i=>[i.root.position.y,i.root.visible]),before);m.releaseTextures();
});

test('raster guards share atlas geometry, keep their 3D fallback and freeze rig poses',async()=>{
  const {createHeliostatMaterials}=await server.ssrLoadModule('/src/heliostat/materials.ts'),{createGuardAssets,createHeliostatGuard}=await server.ssrLoadModule('/src/heliostat/guard.ts'),{actorPose}=await server.ssrLoadModule('/src/heliostat/actors.ts');
  const m=createHeliostatMaterials(),a=createGuardAssets(m),one=createHeliostatGuard(a),two=createHeliostatGuard(a),pose=actorPose(one);
  pose(2,0,.8);assert(one.getObjectByName('guard-fallback').visible);assert(!one.getObjectByName('guard-raster').visible);
  const texture=new T.Texture();a.setAtlas(texture);pose(2,0,.8);assert(one.getObjectByName('guard-raster').visible);assert(!one.getObjectByName('guard-fallback').visible);
  assert.equal(one.getObjectByName('guard-raster-body').geometry,two.getObjectByName('guard-raster-body').geometry);
  const before=one.getObjectsByProperty('name','guard-filament').map(n=>n.quaternion.toArray());pose(2,0,.8);assert.deepEqual(one.getObjectsByProperty('name','guard-filament').map(n=>n.quaternion.toArray()),before);
  texture.dispose();m.releaseTextures();
});

test('sunspot feed cores stay visible through the actual distant plant geometry',async()=>{
  const scene=new T.Scene(),plane=new T.Group();scene.add(plane);const level=createLevel({scene,plane,signal:new AbortController().signal});plane.add(level.root);await level.ready;
  const f=new Flight('sentry',[],'vex','heliostat');f.phase='boss';f.time=2.8;f.markers=[{x:-.75,y:-5.3},{x:.75,y:-5.3}];
  level.update({flight:f,time:110.8,reveal:1,animationTime:110.8});scene.updateMatrixWorld(true);
  const opaque=[];level.root.traverseVisible(o=>{if(o.isMesh&&!o.material.transparent)opaque.push(o);});
  for(const feed of level.boss.getObjectByName('sunspot-feed-ducts').children){
    const mesh=feed.children[0],u=mesh.material.uniforms,curve=new T.CubicBezierCurve3(u.a.value,u.b.value,u.c.value,u.d.value);
    for(const t of[.2,.4,.6,.8]){
      const p=curve.getPoint(t).applyMatrix4(mesh.matrixWorld),camera=new T.Vector3(0,0,22),delta=p.clone().sub(camera),distance=delta.length();
      const hit=new T.Raycaster(camera,delta.normalize(),0,distance-.05).intersectObjects(opaque,false);
      assert(!hit.length,'plant obscures a sunspot feed at '+t);
    }
  }level.dispose();
});
