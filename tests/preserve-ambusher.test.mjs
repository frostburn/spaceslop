import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';

const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,
  server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});
after(()=>server.close());
const a=await server.ssrLoadModule('/src/preserve-ambusher.ts');
const layout=await server.ssrLoadModule('/src/preserve-layout.ts');
const {Flight,STEP}=await server.ssrLoadModule('/src/game.ts');
const {createAmbusherMaterials,createPoolAmbusher}=await server.ssrLoadModule('/src/preserve-ambusher-rig.ts');
const {createLaserContactTrace}=await server.ssrLoadModule('/src/laser-contact.ts');
const v=p=>new T.Vector3(p.x,p.y,p.z);
function attack(site=0,aim={x:0,y:-5.3}) {
  const state=a.createAmbusherState(site),start=a.ambusherSites[site].y/layout.PRESERVE_SPEED;
  a.stepAmbusher(state,start,aim,STEP);assert.equal(state.attackAt,start);
  return{state,start,bite:start+a.AMBUSHER_WINDUP+a.AMBUSHER_LEAP+.05};
}
function target(state,time) {
  const p=a.ambusherPose(state,time);
  return{x:p.head.x,y:p.head.y,lane:p.home.x,age:0,fire:Infinity,hp:a.AMBUSHER_HP,ambusher:state,drop:'cannon'};
}
function quiet(time,enemy,drone='sentry') {
  const f=new Flight(drone,[],'vex','preserve');f.time=time;f.enemies=[enemy];
  f.cooldown=f.droneCooldown=1000;f.nextWave=100;f.nextAmbusher=100;
  return f;
}

test('five bank-anchored ambushers scroll in before view, fit the warmed pool and leave a quiet approach',()=>{
  const f=new Flight('sentry',[],'vex','preserve');f.cooldown=f.droneCooldown=1e5;
  const seen=new Set(),warned=new Set();let maximum=0;
  while(f.phase==='stage'){
    f.invulnerable=100;f.step(STEP);
    const enemies=f.enemies.filter(e=>e.ambusher);maximum=Math.max(maximum,enemies.length);
    for(const e of enemies){
      const home=a.ambusherHome(e.ambusher.site,f.time),p=a.ambusherPose(e.ambusher,f.time);
      if(!seen.has(e.ambusher.site)){assert(home.y>11.9,'spawn must happen beyond the viewport');seen.add(e.ambusher.site);}
      assert.equal(home.x,a.ambusherSites[e.ambusher.site].x*layout.PRESERVE_WIDTH_SCALE);
      assert.equal(home.y,a.ambusherSites[e.ambusher.site].y-layout.preserveScroll(f.time));
      if(p.warning)warned.add(e.ambusher.site);
    }
  }
  assert.equal(seen.size,5);assert.equal(warned.size,5);assert(maximum<=a.AMBUSHER_POOL);
  assert.equal(f.phase,'approach');assert.equal(f.enemies.length,0);assert.equal(f.threats.length,0);
  assert.equal(new Flight('sentry',[],'vex','preserve').nextAmbusher,0);
  const other=new Flight('sentry',[],'vex','prototype');other.stepStage(0);assert(!other.enemies.some(e=>e.ambusher));
});

test('aim locks through the warning, the bite reaches it in 3D and an opposite-bank sidestep is safe',()=>{
  for(let site=0;site<5;site++){
    const {state,start,bite}=attack(site),locked={...state.aim},safe={x:-a.ambusherSites[site].side*3.4,y:-5.3};
    a.stepAmbusher(state,start+.6,safe,.6);assert.deepEqual(state.aim,locked);
    const p=a.ambusherPose(state,bite);assert.equal(p.phase,'bite');assert(v(p.mouth).distanceTo(v({...locked,z:0}))<1e-8);
    let hits=0;
    for(let age=0;age<a.AMBUSHER_DURATION;age+=STEP){
      if(a.ambusherHits(state,start+age,start+age-STEP,locked))hits++;
      assert(!a.ambusherHits(state,start+age,start+age-STEP,safe),'a marked center attack reaches the far edge');
      if(age<a.AMBUSHER_WINDUP||age>a.AMBUSHER_WINDUP+a.AMBUSHER_LEAP+a.AMBUSHER_BITE)
        assert(!a.ambusherHits(state,start+age,start+age-STEP,locked),'warning and retreat must be safe');
    }
    assert(hits>0);
    const f=quiet(bite,target(state,bite));f.player={...locked};f.stepStage(0);assert.equal(f.hull,3);f.stepStage(0);assert.equal(f.hull,3);assert.equal(f.enemies[0].hp,a.AMBUSHER_HP);
    assert.equal(f.threats.length,0,'jumping bites must not fire projectiles');
    for(const boundary of[a.AMBUSHER_WINDUP,a.AMBUSHER_WINDUP+a.AMBUSHER_LEAP,a.AMBUSHER_WINDUP+a.AMBUSHER_LEAP+a.AMBUSHER_BITE,a.AMBUSHER_DURATION]){
      const x=a.ambusherPose(state,start+boundary-1e-5),y=a.ambusherPose(state,start+boundary+1e-5);
      assert(v(x.head).distanceTo(v(y.head))<.001);assert(v(x.root).distanceTo(v(y.root))<.001);
    }
    a.stepAmbusher(state,start+a.AMBUSHER_DURATION+.1,safe,STEP);assert.equal(state.attackAt,start,'cooldown prevents immediate repeat');
  }
});

test('submerged anatomy has no flight-plane hitbox; raised heads accept swept hits and laser entry',()=>{
  for(let site=0;site<5;site++){
    const {state,start,bite}=attack(site),rest=a.createAmbusherState(site);
    assert.equal(a.ambusherHulls(rest,start).length,0);
    assert(!a.ambusherBodyHit(rest,start,{x:0,y:-20},{x:0,y:20}));
    const p=a.ambusherPose(state,bite),origin={x:p.head.x,y:-9},end={x:p.head.x,y:9};
    assert(a.ambusherBodyHit(state,bite,origin,end));assert(!a.ambusherBodyHit(state,bite,{x:4,y:-9},{x:4,y:9}));
    assert(Number.isFinite(a.ambusherBeamEntry(state,bite,origin)));assert.equal(a.ambusherBeamEntry(rest,start,origin),Infinity);
    assert(a.ambusherHulls(state,start+.65).length>0,'rising warning offers a counterattack window');
  }
});

test('bullets, cannon, homing, Omega, laser, Towline and Pulse use exposed anatomy and award one drop',()=>{
  const {state,start,bite}=attack(),p=a.ambusherPose(state,bite);
  for(const options of[{},{drone:true},{wing:'cannon'},{wing:'homing',damage:.5},{wing:'omega',damage:4,pierced:new Set()}]){
    const e=target(state,bite),f=quiet(bite,e);f.stepStage=()=>{};
    f.shots=[{x:p.head.x,y:p.head.y-.9,z:0,vx:0,vy:18,vz:0,...options}];f.step(.05);assert(e.hp<a.AMBUSHER_HP,JSON.stringify(options));
  }
  const e=target(state,bite),f=quiet(bite,e,'towline');
  f.stepLaser(f.wings[0],{x:p.head.x,y:-9},false,.1);assert(e.hp<a.AMBUSHER_HP);assert.equal(f.wings[0].laserTarget,e);
  assert.equal(f.wings[0].beamEnd.y,9,'visual tracing must reach the actual posed model');
  const before=e.hp;f.player={x:p.head.x,y:-7};f.drone={x:p.head.x,y:2};f.droneCooldown=0;f.stepDroneWeapon(STEP);assert(e.hp<before);
  f.pulse();assert.equal(e.hp,0);assert.equal(f.score,200);assert.equal(f.drops.length,1);f.damageEnemy(e,6);assert.equal(f.score,200);assert.equal(f.drops.length,1);
  const buried=target(a.createAmbusherState(0),start),hidden=quiet(start,buried);
  hidden.stepLaser(hidden.wings[0],{x:buried.x,y:-9},false,1);assert.equal(buried.hp,a.AMBUSHER_HP);
  const missile={x:buried.x-1,y:-7,vx:0,vy:5};hidden.guideMissile(missile,false,.1);assert.equal(missile.vx,0,'homing must not chase a submerged target');
});

test('laser selects the nearest anatomical intersection rather than the buried home or head center',()=>{
  const {state,bite}=attack(),e=target(state,bite),f=quiet(bite,e),p=a.ambusherPose(state,bite);
  const x=p.mouth.x,entry=a.ambusherBeamEntry(state,bite,{x,y:-9}),scout={x,y:entry+.1,lane:x,age:0,fire:Infinity,hp:2};
  f.enemies=[scout,e];f.stepLaser(f.wings[0],{x,y:-9},false,.1);assert.equal(f.wings[0].laserTarget,e);assert.equal(scout.hp,2);
});

test('rigged bite tip agrees with combat, feet stay on the bank, curled tails clear the rails and buffers are reused',()=>{
  const materials=createAmbusherMaterials(),rig=createPoolAmbusher(materials),neck=rig.root.getObjectByName('ambusher-neck'),tail=rig.root.getObjectByName('ambusher-tail');
  const buffers=[neck.geometry.attributes.position.array,tail.geometry.attributes.position.array],geometries=[];
  rig.root.traverse(o=>{if(o.isMesh)geometries.push(o.geometry);});
  for(let site=0;site<5;site++){
    const {state,start}=attack(site);
    for(const age of[0,.55,1.1,1.4,1.8,2.3,2.94,3]){
      const p=a.ambusherPose(state,start+age);rig.pose(p);rig.root.updateMatrixWorld(true);
      assert(rig.root.getObjectByName('ambusher-bite-tip').getWorldPosition(new T.Vector3()).distanceTo(v(p.mouth))<1e-8);
      if(p.out===0)for(const foot of rig.animal.children.filter(o=>o.name==='ambusher-foot'))assert(Math.abs(foot.getWorldPosition(new T.Vector3()).z-p.home.z)<1e-8);
      if(!p.out){const vertices=tail.geometry.attributes.position,point=new T.Vector3();for(let i=0;i<vertices.count;i++){point.fromBufferAttribute(vertices,i);tail.localToWorld(point);assert(Math.abs(point.x)<3.2,'tail cuts through a station rail');}}
      assert.equal(neck.geometry.attributes.position.array,buffers[0]);assert.equal(tail.geometry.attributes.position.array,buffers[1]);
      for(const mesh of[neck,tail]){assert(mesh.geometry.attributes.position.array.every(Number.isFinite));assert(Number.isFinite(mesh.geometry.boundingSphere.radius));}
    }
  }
  rig.pose(a.ambusherStudy(1.6));const frozen=tail.geometry.attributes.position.array.slice();rig.pose(a.ambusherStudy(3));rig.pose(a.ambusherStudy(1.6));assert.deepEqual(tail.geometry.attributes.position.array,frozen);
  assert.deepEqual(a.ambusherStudy(0).home,a.ambusherStudy(5).home,'workshop bank must remain in the inspection frame');
  const after=[];rig.root.traverse(o=>{if(o.isMesh)after.push(o.geometry);});assert.deepEqual(after,geometries);
  const head=rig.root.getObjectByName('ambusher-head'),skull=head.children.find(o=>o.isMesh&&o.material===materials.skin),probe=new T.Mesh(skull.geometry,new T.MeshBasicMaterial());probe.updateMatrixWorld(true);
  const ray=new T.Raycaster(new T.Vector3(0,-.65,1),new T.Vector3(0,0,-1)),hit=ray.intersectObject(probe)[0];assert(hit&&hit.distance<.9,'snout normals face inward');probe.material.dispose();
});

test('laser ablation traces the rendered face in the tilted camera and excludes warning graphics',()=>{
  const rig=createPoolAmbusher(createAmbusherMaterials()),plane=new T.Group();plane.add(rig.root);
  const {state,bite}=attack(),p=a.ambusherPose(state,bite);rig.pose(p);plane.updateMatrixWorld(true);
  const trace=createLaserContactTrace(plane),point=a.ambusherProjection(p.head),origin={x:point.x,y:-9},end={x:point.x,y:9};
  const contact=trace(origin,end,rig.animal,layout.PRESERVE_DISTANCE,layout.PRESERVE_PITCH);
  assert(contact.y<9&&contact.y>-7,'contact must reach the actual living model');
  assert.equal(rig.animal.getObjectByName('ambusher-locked-target'),undefined);
});
