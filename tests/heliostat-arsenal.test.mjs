import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,define:{__ENCOUNTER_TEXTURES__:'{}'},
  server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});
after(()=>server.close());
const c=await server.ssrLoadModule('/src/heliostat/crawler.ts'),combat=await server.ssrLoadModule('/src/heliostat/combat.ts');
const {Flight,STEP}=await server.ssrLoadModule('/src/game.ts');
const {createHeliostatScenery}=await server.ssrLoadModule('/src/heliostat/scenery.ts');
const {createCrawlerAssets,createCrawlerRig}=await server.ssrLoadModule('/src/heliostat/crawler-rig.ts');
const {tiltFlightCamera}=await server.ssrLoadModule('/src/rendering/flight-camera.ts');
const {WING_FORMATION}=await server.ssrLoadModule('/src/wing.ts');

test('crawlers ride actual station rails, expose their cutter before warning, and project onto their combat proxies',()=>{
  const scenery=createHeliostatScenery(),rig=createCrawlerRig(createCrawlerAssets(scenery.materials)),camera=new T.PerspectiveCamera(T.MathUtils.radToDeg(2*Math.atan(8/combat.HELIOSTAT_DISTANCE)),9/16,.1,600);
  tiltFlightCamera(camera,combat.HELIOSTAT_DISTANCE,.46,new T.Quaternion());camera.updateMatrixWorld(true);
  for(let site=0;site<c.crawlerSites.length;site++)for(const age of[.4,1.4,2.6,3.9,5.4]){
    const time=c.crawlerSites[site].at-4+age,p=c.crawlerPose({site,aimY:-5.3},time);
    scenery.update(time,0,time,0,0,true);scenery.root.updateMatrixWorld(true);rig.pose(p,time);rig.root.updateMatrixWorld(true);
    const hit=new T.Raycaster(new T.Vector3(p.side*c.CRAWLER_RAIL_X,p.physicalY,c.CRAWLER_RAIL_Z+.08),new T.Vector3(0,0,-1),0,.14).intersectObject(scenery.route.root,true);
    assert(hit.length,'crawler wheels cross a gap in the modeled rail');
    const projection=rig.head.getWorldPosition(new T.Vector3()).project(camera);assert(Math.abs(projection.x*4.5-p.x)<1e-7);assert(Math.abs(projection.y*8-p.y)<1e-7);
    if(p.warning||p.hot){assert.equal(p.head.z,0);assert(p.y+.5<8);assert(p.brace>.95);}
  }scenery.materials.releaseTextures();
});

test('crawler sleeves stay seated through the lift and the opening cutter meets its beam origin', () => {
  const scenery = createHeliostatScenery();
  const rig = createCrawlerRig(createCrawlerAssets(scenery.materials));
  const sleeves = rig.root.getObjectsByProperty('name', 'crawler-mast-sleeve');
  const shields = rig.root.getObjectsByProperty('name', 'crawler-cutter-shield');
  const light = rig.root.getObjectByName('crawler-emitter');
  const wheel = rig.root.getObjectByName('crawler-wheel');
  const tread = wheel.children[0];
  const world = new T.Vector3();
  assert.equal(sleeves.length, 4);
  for (const site of [0, 1]) for (const age of [0, 0.8, 1.4, 2.5, 3.55, 4.5]) {
    const time = c.crawlerSites[site].at - 4 + age;
    const p = c.crawlerPose({ site, aimY: -4.3 }, time);
    rig.pose(p, time);
    rig.root.updateMatrixWorld(true);
    const top = sleeves.at(-1).localToWorld(new T.Vector3(0, 0.70, 0));
    assert(top.distanceTo(new T.Vector3(p.head.x, p.head.y, p.head.z - 0.08)) < 1e-8);
    for (let i = 1; i < sleeves.length; i++) {
      assert(sleeves[i].position.y - sleeves[i - 1].position.y < 1.4);
      assert.deepEqual(sleeves[i].scale.toArray(), [1, 1, 1]);
    }
    wheel.getWorldPosition(world);
    const ray = new T.Raycaster(world.clone().setZ(c.CRAWLER_RAIL_Z - 0.06), new T.Vector3(0, 0, 1));
    const footprint = ray.intersectObject(tread, false)[0].point.z;
    assert(Math.abs(footprint - c.CRAWLER_RAIL_Z - 0.031) < 0.007);
    if (p.warning || p.hot) {
      assert(light.getWorldPosition(world).distanceTo(new T.Vector3(p.muzzle.x, p.muzzle.y, 0.06)) < 1e-8);
    }
    assert(shields[0].rotation.z < 0 && shields[1].rotation.z > 0);
    assert(Math.abs(Math.abs(shields[0].rotation.z) - (0.042 + 0.32 * p.charge)) < 1e-9);
  }
  scenery.materials.releaseTextures();
});

test('the crawler locks aim once, warns harmlessly and sweeps only its marked half of the lane',()=>{
  for(let site=0;site<c.crawlerSites.length;site++){
    const state={site},at=c.crawlerSites[site].at;
    c.stepCrawler(state,at-1.2,{x:0,y:-5.3});assert.equal(state.aimY,-5.3);
    c.stepCrawler(state,at-.5,{x:3,y:1});assert.equal(state.aimY,-5.3);
    const p=c.crawlerPose(state,at+.3),mid={x:(p.muzzle.x+p.target.x)/2,y:(p.muzzle.y+p.target.y)/2};
    assert(p.hot);assert(c.crawlerHits(state,at+.3,at+.3-STEP,mid));assert(!c.crawlerHits(state,at-1,at-1-STEP,mid));
    for(let t=at-.2;t<at+1.5;t+=STEP)for(const y of[-6,-4,-2,0,2])assert(!c.crawlerHits(state,t,t-STEP,{x:-p.side*2.8,y}));
  }
});

test('a destroyed crawler immediately loses its beam and never produces ordinary bullets',()=>{
  const f=new Flight('sentry',[],'vex','heliostat'),state={site:0,aimY:-5.3};f.nextCrawler=c.crawlerSites.length;f.nextWave=20;f.cooldown=f.droneCooldown=1e5;
  f.time=c.crawlerSites[0].at+.3;const p=c.crawlerPose(state,f.time);f.player={x:(p.muzzle.x+p.target.x)/2,y:(p.muzzle.y+p.target.y)/2};
  f.enemies=[{x:p.x,y:p.y,lane:p.x,age:4,fire:Infinity,hp:c.CRAWLER_HP,crawler:state}];f.step(STEP);assert.equal(f.hull,3);assert.equal(f.threats.length,0);
  f.pulse();assert.equal(f.enemies.length,0);f.invulnerable=0;for(let i=0;i<30;i++)f.step(STEP);assert.equal(f.hull,3);
});

for(const weapon of['primary','homing','cannon','laser','omega','sentry','towline','pulse'])test(`exposed crawler cutter accepts ${weapon}`,()=>{
  const wing=['homing','cannon','laser','omega'].includes(weapon),f=new Flight(weapon==='towline'?'towline':'sentry',wing?[weapon]:[],'vex','heliostat');
  f.time=c.crawlerSites[0].at-1;f.nextCrawler=c.crawlerSites.length;f.nextWave=20;f.invulnerable=1e5;
  const state={site:0,aimY:-6},p=c.crawlerPose(state,f.time),enemy={x:p.x,y:p.y,lane:p.x,age:3,fire:Infinity,hp:c.CRAWLER_HP,crawler:state};f.enemies=[enemy];
  f.player={x:p.x+(wing?WING_FORMATION.x:0),y:-5.3};f.cooldown=weapon==='primary'?0:1e5;f.droneCooldown=weapon==='sentry'?0:1e5;f.towlineCooldown=0;
  if(weapon==='sentry')f.deployDrone(p.x,p.y-2);
  if(weapon==='towline'){f.player={x:p.x-.8,y:p.y};f.drone={x:p.x+.8,y:p.y};}
  if(weapon==='pulse')f.pulse();else for(let i=0;i<180;i++)f.step(STEP);
  assert(enemy.hp<c.CRAWLER_HP,weapon+' missed the raised cutting head');
});

test('half-health escalation preserves locked attacks, alternates the leading lens and keeps late channels collidable',()=>{
  const f=new Flight('sentry',[],'vex','heliostat');f.phase='boss';f.cooldown=f.droneCooldown=1e5;f.invulnerable=1e5;
  const stepTo=t=>{while(f.time<t-1e-8)f.step(STEP);};
  stepTo(1);const old=structuredClone(f.markers);f.bossHealth=combat.HELIOSTAT_HP/2;f.step(STEP);assert(!f.heliostatUnstable);
  f.bossHealth=combat.HELIOSTAT_HP/2-1;f.step(STEP);assert(f.heliostatUnstable);assert.equal(f.heliostatPattern,0);assert.deepEqual(f.markers,old);
  stepTo(5.1);assert.equal(f.heliostatPattern,1);assert.deepEqual(f.markers,combat.heliostatLockTargets(f.player,1));
  stepTo(6.7);assert(combat.heliostatPlasmaPhase(f.time,1,f.heliostatPattern).hot);assert(!combat.heliostatPlasmaPhase(f.time,-1,f.heliostatPattern).hot);
  const locked=structuredClone(f.markers);f.invulnerable=0;f.player={...locked[0]};f.step(STEP);assert.equal(f.hull,4);
  stepTo(7.2);assert.equal(f.hull,3);f.step(STEP);assert.equal(f.hull,3);assert.deepEqual(f.markers,locked);
  f.pulse();assert.deepEqual(f.heliostatTargets,[]);f.invulnerable=0;stepTo(8.2);assert.equal(f.hull,3);
  stepTo(9.5);assert.equal(f.heliostatPattern,-1);assert.equal(f.threats.length,0);
});

test('unstable lens shards are deterministic, harmless background geometry and included in priming',()=>{
  const s=createHeliostatScenery();s.update(115,1,115,0,0,true,{unstable:2.3,pattern:1,attackTime:7});s.root.updateMatrixWorld(true);
  const mesh=s.boss.debris.root;assert(mesh.visible);const before=Array.from(mesh.instanceMatrix.array),colors=Array.from(mesh.instanceColor.array);
  s.update(115,1,115,0,0,true,{unstable:2.3,pattern:1,attackTime:7});assert.deepEqual(Array.from(mesh.instanceMatrix.array),before);assert.deepEqual(Array.from(mesh.instanceColor.array),colors);
  const matrix=new T.Matrix4(),point=new T.Vector3();for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix).applyMatrix4(mesh.matrixWorld);assert(point.z<-9);}
  s.boss.pose(115,0,0,{unstable:2.3,pattern:1,attackTime:7,active:false});s.boss.root.traverse(o=>{if(o.isPointLight)assert.equal(o.intensity,12,'canceled channel still charges its lens');});
  s.update(115,1,115,0,0,true);assert(!mesh.visible);const geometry=mesh.geometry,restore=s.boss.prime();assert(mesh.visible);restore();assert(!mesh.visible);assert.equal(mesh.geometry,geometry);s.materials.releaseTextures();
});
