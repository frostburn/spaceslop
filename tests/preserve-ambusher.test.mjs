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
  return{x:p.head.x,y:p.head.y,lane:p.home.x,age:0,fire:Infinity,hp:a.AMBUSHER_HP,ambusher:state,reward:{weapon:'cannon',remaining:1}};
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
  const before=e.hp;f.player={x:p.head.x,y:-7};f.drone={x:p.head.x,y:2};f.towlineCooldown=0;f.stepDroneWeapon(STEP);assert(e.hp<before);
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

test('Spinosaurus has a closed tall sail, a terminal snout rosette and a vertically deep tail',async()=>{
  const {ambusherSnoutWidth}=await server.ssrLoadModule('/src/preserve-ambusher-geometry.ts');
  assert.equal(a.AMBUSHER_SPECIES,'Spinosaurus aegyptiacus');assert(ambusherSnoutWidth(-1.26)>ambusherSnoutWidth(-.98)*1.4);
  const rig=createPoolAmbusher(createAmbusherMaterials()),sail=rig.root.getObjectByName('ambusher-sail').geometry,tail=rig.root.getObjectByName('ambusher-tail').geometry;
  sail.computeBoundingBox();const size=sail.boundingBox.getSize(new T.Vector3());assert(size.z>1.5&&size.x<.12&&size.y>2.2);
  const p=tail.attributes.position,x=[],z=[];for(let i=12*13;i<13*13;i++){x.push(p.getX(i));z.push(p.getZ(i));}
  assert((Math.max(...z)-Math.min(...z))>(Math.max(...x)-Math.min(...x))*3,'tail remains a round terrestrial taper');
  const probe=new T.Mesh(sail,new T.MeshBasicMaterial()),ray=new T.Raycaster(new T.Vector3(1,0,1.1),new T.Vector3(-1,0,0));probe.updateMatrixWorld(true);
  assert(ray.intersectObject(probe).length,'closed membrane has inward normals');probe.material.dispose();
});

test('defeat starts at the struck pose, falls broadside continuously and keeps the rendered head aligned',()=>{
  const rig=createPoolAmbusher(createAmbusherMaterials()),sail=rig.root.getObjectByName('ambusher-sail'),positions=sail.geometry.attributes.position;
  for(let site=0;site<5;site++)for(const age of[0,.7,1.35,1.8,2.5]){
    const {state,start}=attack(site),time=start+age,before=a.ambusherPose(state,time);a.defeatAmbusher(state,time);const first=a.ambusherPose(state,time);
    assert.deepEqual(first.root,before.root);assert(Math.abs(first.roll)<1e-8);assert.equal(first.pitch,before.pitch);assert.equal(first.jaw,before.jaw);
    const locked=JSON.stringify(state),marker=rig.root.getObjectByName('ambusher-bite-tip');let previous=first;
    for(let frame=0;frame<=100;frame++){
      const t=time+frame/60,p=a.ambusherPose(state,t);rig.pose(p);rig.root.updateMatrixWorld(true);
      assert(marker.getWorldPosition(new T.Vector3()).distanceTo(v(p.mouth))<1e-7,'rolled skull no longer agrees with pose');
      assert(v(p.root).distanceTo(v(previous.root))<.13,'root jumps during the fall');assert(Math.abs(p.roll-previous.roll)<.05);
      assert.equal(p.hulls.length,0);assert(!p.active&&!p.warning);assert.equal(rig.root.getObjectByName('ambusher-warning-line').visible,false);
      assert.equal(rig.root.getObjectByName('ambusher-splash').visible,false);previous=p;
    }
    assert(Math.abs(Math.abs(previous.roll)-Math.PI/2)<1e-8);
    a.stepAmbusher(state,time+3,{x:3,y:0},3);assert.equal(JSON.stringify(state),locked,'a corpse reacquires a target');
    const p1=a.ambusherPose(state,time+2),p2=a.ambusherPose(state,time+2.5);
    assert(Math.abs(p1.root.y-p2.root.y-layout.PRESERVE_SPEED*.5)<1e-8,'corpse detaches from the moving habitat');
  }
  const projectedWidth=p=>{rig.pose(p);rig.root.updateMatrixWorld(true);const xs=[];for(let i=0;i<positions.count;i++){const q=new T.Vector3().fromBufferAttribute(positions,i);sail.localToWorld(q);xs.push(a.ambusherProjection(q).x);}return Math.max(...xs)-Math.min(...xs);};
  const {state,start}=attack();state.heading=state.fromHeading=state.attackHeading=0;
  const upright=projectedWidth(a.ambusherPose(state,start));a.defeatAmbusher(state,start);
  assert(projectedWidth(a.ambusherPose(state,start+a.AMBUSHER_FALL))>upright*5,'sideways fall does not expose the sail to the game camera');
  rig.pose(a.ambusherStudy(3.8,true));rig.animal.updateMatrix();const actual=rig.animal.matrix.clone();rig.pose(a.ambusherStudy(5,true));rig.pose(a.ambusherStudy(3.8,true));rig.animal.updateMatrix();assert.deepEqual(rig.animal.matrix,actual);
});

test('defeated ambushers persist harmlessly for the fall, award once, and leave no state after expiry or restart',()=>{
  for(const pulse of[false,true]){
    const {state,bite}=attack(),enemy=target(state,bite),f=quiet(bite,enemy);
    if(pulse)f.pulse();else f.damageEnemy(enemy,enemy.hp);
    assert.equal(state.defeatedAt,bite);assert.equal(f.score,200);assert.equal(f.drops.length,1);assert(f.enemies.includes(enemy));
    const snapshot={...f.player},hull=f.hull,score=f.score;f.step(a.AMBUSHER_FALL);assert(f.enemies.includes(enemy));assert.equal(f.hull,hull);assert.deepEqual(f.player,snapshot);
    f.stepLaser(f.wings[0],{x:enemy.x,y:-9},false,1);assert.equal(f.wings[0].laserTarget,undefined);
    const missile={x:enemy.x-1,y:-7,vx:0,vy:5};f.guideMissile(missile,false,.1);assert.equal(missile.vx,0);
    assert(!a.ambusherBodyHit(state,f.time,{x:-4,y:-9},{x:4,y:9}));assert(!a.ambusherHits(state,f.time,f.time-1/60,f.player));
    f.damageEnemy(enemy,10);assert.equal(f.score,score);f.step(a.AMBUSHER_CORPSE_TIME);assert(!f.enemies.includes(enemy));
    f.time=f.stageDuration;f.step(0);assert.equal(f.phase,'approach');assert.equal(f.enemies.length,0);
    assert.equal(new Flight('sentry',[],'vex','preserve').enemies.length,0);assert.equal(a.createAmbusherState(0).defeatedAt,undefined);
  }
});

test('one tongue stays in the lower mouth and every tooth root is buried in its actual jaw mesh',async()=>{
 const {ambusherToothRoot}=await server.ssrLoadModule('/src/preserve-ambusher-mouth.ts');
 const materials=createAmbusherMaterials(),rig=createPoolAmbusher(materials),head=rig.root.getObjectByName('ambusher-head'),jaw=rig.root.getObjectByName('ambusher-jaw');
 const tongues=[];rig.root.traverse(o=>{if(o.isMesh&&o.material===materials.tongue)tongues.push(o);});assert.equal(tongues.length,1);assert.equal(tongues[0].parent,jaw);
 assert.equal(head.getObjectByName('ambusher-palate').material,materials.palate);assert(materials.palate.color.getHSL({}).l<materials.tongue.color.getHSL({}).l*.5);
 const ray=new T.Raycaster(),probeMaterial=new T.MeshBasicMaterial({side:T.DoubleSide}),q=new T.Vector3();
 for(const upper of[true,false]){
  const bone=upper?head.children.find(o=>o.isMesh&&o.material===materials.skin):rig.root.getObjectByName('ambusher-mandible'),probe=new T.Mesh(bone.geometry,probeMaterial);probe.updateMatrixWorld(true);
  for(const side of[-1,1])for(let i=0;i<11;i++){
   const root=ambusherToothRoot(upper,side,i),radius=upper?.022:.020;
   for(let sample=0;sample<8;sample++){
    const a=sample/8*Math.PI*2,x=root.x+Math.cos(a)*radius,y=root.y+Math.sin(a)*radius;
    ray.set(q.set(x,y,-1),new T.Vector3(0,0,1));const bottom=ray.intersectObject(probe)[0];ray.set(q.set(x,y,1),new T.Vector3(0,0,-1));const top=ray.intersectObject(probe)[0];
    assert(bottom&&top&&root.z>bottom.point.z+.0001&&root.z<top.point.z-.0001,`floating ${upper?'upper':'lower'} tooth: ${side}, ${i}`);
   }
  }
 }
 probeMaterial.dispose();
 for(const time of[0,1.7,2.7,3.8]){
  rig.pose(a.ambusherStudy(time));rig.root.updateMatrixWorld(true);
  for(const upper of[true,false])for(const side of[-1,1]){
   const marker=rig.root.getObjectByName(`ambusher-tooth-root-${upper?'upper':'lower'}-${side}-5`),point=marker.getWorldPosition(new T.Vector3()),bone=upper?head:jaw;
   bone.worldToLocal(point);assert(point.distanceTo(v(ambusherToothRoot(upper,side,5)))<1e-7);
  }
  rig.root.traverse(o=>{if(o.isMesh&&/limb-skin|gape-skin/.test(o.name))assert(o.geometry.attributes.position.array.every(Number.isFinite));});
 }
});
