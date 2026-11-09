import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,
 server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});
after(()=>server.close());
const m=await server.ssrLoadModule('/src/preserve-flyer.ts');
const {createFlyerAssets,createPreserveFlyer}=await server.ssrLoadModule('/src/preserve-flyer-rig.ts');
const geometry=await server.ssrLoadModule('/src/preserve-flyer-geometry.ts');
const {Flight,STEP}=await server.ssrLoadModule('/src/game.ts');
const course={formation:'loop',mirror:1,slot:0,count:4};
const angle=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

test('all five flock routes have finite continuous tangents, offscreen entry, bounded banks and a finite exit',()=>{
 const signatures=new Set();
 for(const formation of['chevron','crossing','slalom','loop','swoop'])for(const mirror of[-1,1])for(let slot=0;slot<4;slot++){
  const c={...course,formation,mirror,slot},lane=(slot-1.5)*1.5*mirror;
  assert(m.flyerMotion(0,lane,c).y>=10.8);
  assert(m.flyerMotion(14,lane,c).y<-9,'routes must leave the pool without a timeout teleport');
  for(let age=0;age<14;age+=.025){
   const p=m.flyerMotion(age,lane,c),next=m.flyerMotion(age+.001,lane,c);
   assert(Object.values(p).every(Number.isFinite));assert(Math.abs(p.x)<3.1);assert(Math.abs(p.bank)<=.58);
   assert(p.speed>=2.2&&p.speed<8);assert(Math.hypot(p.x-next.x,p.y-next.y)<.008);
   assert(Math.abs(angle(p.heading,next.heading))<.006,'facing snaps instead of following the curve');
   assert(Math.abs(p.vx-next.vx)<.025&&Math.abs(p.vy-next.vy)<.025);
  }
  if(mirror===1&&slot===0)signatures.add([2,3,4,5].map(t=>m.flyerMotion(t,lane,c).x.toFixed(2)).join(','));
 }
 assert.equal(signatures.size,5);
});

test('delayed loop/slalom trains follow the leader curve, with continuous downward entry and exit',()=>{
 for(const formation of['loop','slalom','swoop'])for(let slot=1;slot<4;slot++)for(let age=0;age<11;age+=.2){
  const c={...course,formation},a=m.flyerMotion(age,1,c),b=m.flyerMotion(age+slot*m.FLYER_DELAY,1,{...c,slot});
  assert(Math.hypot(a.x-b.x,a.y-b.y)<1e-10);assert(Math.abs(angle(a.heading,b.heading))<1e-9);
 }
 for(const t of[m.FLYER_LOOP_ENTRY,m.FLYER_LOOP_ENTRY+m.FLYER_LOOP_DURATION]){
  const a=m.flyerMotion(t-1e-5,0,course),b=m.flyerMotion(t+1e-5,0,course);
  assert(Math.hypot(a.x-b.x,a.y-b.y)<.0001);assert(Math.abs(angle(a.heading,b.heading))<.0001);assert(Math.abs(a.bank-b.bank)<.001);
 }
 const top=m.flyerMotion(m.FLYER_LOOP_ENTRY+m.FLYER_LOOP_DURATION/2,0,course);assert(top.vy>2.9,'the line must complete a real upstream turn');
});

test('preserve has dinosaurs in every former scout slot, all patterns/drops and a bounded prewarmed flock',()=>{
 const f=new Flight('sentry',[],'vex','preserve');f.cooldown=f.droneCooldown=1e6;f.player.x=3.95;
 const formations=new Set(),drops=new Set();let maximum=0,raptors=0;
 while(f.phase==='stage'){
  f.invulnerable=100;f.step(STEP);maximum=Math.max(maximum,f.enemies.filter(e=>e.flyer).length);raptors=Math.max(raptors,f.enemies.filter(e=>e.raptor).length);
  for(const e of f.enemies){assert(e.flyer||e.raptor||e.ambusher,'scout ship remains in preserve');if(e.flyer){formations.add(e.flyer.formation);assert.equal(e.fire,Infinity);if(e.drop)drops.add(e.drop);}}
  assert.equal(f.threats.length,0,'flying dinosaurs should attack by flight instead of firing scout projectiles');
 }
 assert.equal(formations.size,5);assert.equal(drops.size,4);assert(maximum>3&&maximum<=m.FLYER_POOL);assert(raptors>0&&raptors<=3);
 assert.equal(f.phase,'approach');assert.equal(f.enemies.length,0);assert.equal(new Flight('sentry',[],'vex','preserve').nextWave,0);
});

function enemy(heading=0,y=0){return{x:0,y,heading,lane:0,age:2,fire:Infinity,hp:m.FLYER_HP,flyer:course,drop:'cannon'};}
// Freeze route integration only in this weapon-focused fixture so each authored
// orientation can be hit; the complete route test above exercises real motion.
function quiet(e,drone='sentry') {const f=new Flight(drone,[],'vex','preserve');f.enemies=[e];f.nextWave=f.nextAmbusher=100;f.cooldown=f.droneCooldown=1000;f.time=4;f.stepStage=()=>{};return f;}
test('rotated feathered anatomy accepts bullets, all sidearms, nearest laser contact, Towline and Pulse',()=>{
 for(const heading of[0,.8,Math.PI/2,Math.PI]){
  const e=enemy(heading);assert(m.flyerBodyHit(e,{x:0,y:-9},{x:0,y:9}));assert(!m.flyerBodyHit(e,{x:3,y:-9},{x:3,y:9}));assert(Number.isFinite(m.flyerBeamEntry(e,{x:0,y:-9})));
  for(const wing of[undefined,'cannon','homing','omega']){
   const target=enemy(heading),f=quiet(target);
   f.shots=[{x:0,y:wing==='homing'?-.35:-1,z:0,vx:0,vy:120,vz:0,wing,damage:2,pierced:wing==='omega'?new Set():undefined}];
   f.step(STEP);assert.equal(target.hp,0,`${wing??'ship'} misses a sideways dinosaur`);assert.equal(f.score,100);assert.equal(f.drops.length,1);
  }
  const a=enemy(heading),b=enemy(heading,2),f=quiet(a);f.enemies=[b,a];const w=f.wings[0];w.weapon='laser';
  f.stepLaser(w,{x:0,y:-7},false,.2);assert.equal(w.laserTarget,a);assert(a.hp<m.FLYER_HP);assert.equal(b.hp,m.FLYER_HP);
  f.stepLaser(w,{x:0,y:-7},false,3);assert.equal(a.hp,0);f.stepLaser(w,{x:0,y:-7},false,.2);assert.equal(w.laserTarget,b);
  const t=enemy(heading),tow=quiet(t,'towline');tow.player={x:0,y:-2};tow.drone={x:0,y:2};tow.droneCooldown=0;tow.step(STEP);assert.equal(t.hp,0);
  const p=enemy(heading),pulse=quiet(p);pulse.pulse();assert.equal(p.hp,0);assert.equal(pulse.score,100);assert.equal(pulse.drops.length,1);
 }
});

test('four articulated fans, toothed snout and narrow long tail share resources and scrub without reallocating',()=>{
 const a=createFlyerAssets(),rig=createPreserveFlyer(a),other=createPreserveFlyer(a),geometries=new Set();let triangles=0,calls=0;
 for(const name of['forewing-left','forewing-right','hindwing-left','hindwing-right','toothed-dinosaur-snout','long-bony-tail','narrow-tail-fan'])assert(rig.root.getObjectByName(name));
 rig.root.traverse(o=>{if(o.isMesh){calls++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;geometries.add(o.geometry);for(const attr of Object.values(o.geometry.attributes))assert(attr.array.every(Number.isFinite));}});
 assert(triangles<20000&&calls<=24,`${triangles} triangles, ${calls} draws per bird`);
 assert.equal(rig.root.getObjectByName('narrow-tail-fan').geometry,other.root.getObjectByName('narrow-tail-fan').geometry);
 const matrices=()=>{rig.root.updateMatrixWorld(true);const result=[];rig.root.traverse(o=>result.push(...o.matrixWorld.elements));return result;};
 rig.pose(2.2,course,.3,1.2);const first=matrices();rig.pose(5,course,-.4,-1);rig.pose(2.2,course,.3,1.2);assert.deepEqual(matrices(),first);
 rig.root.traverse(o=>{if(o.isMesh)assert(geometries.has(o.geometry));});
 const texture=new T.Texture();a.setFeathers(texture);assert.equal(a.plumage.map,texture);assert.equal(a.plumage.bumpMap,texture);
 const box=new T.Box3().setFromObject(rig.root);assert(!box.isEmpty());
});

test('sculpted muzzle has inset nasal passages, watertight boundaries and protected eye sockets',()=>{
 const a=createFlyerAssets(),skull=a.skull,mesh=new T.Mesh(skull,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld(true);
 for(const side of[-1,1]){
  const y=T.MathUtils.lerp(geometry.flyerSkullProfile[0][0],geometry.flyerSkullProfile.at(-1)[0],42/56);
  const skin=geometry.flyerSkinPoint(geometry.flyerSkullProfile,y,side*Math.PI/2,true),ray=new T.Raycaster(skin.clone().add(new T.Vector3(side*.1,0,0)),new T.Vector3(-side,0,0));
  assert(ray.intersectObject(mesh)[0].distance>.117,'nostril is a black dot on the surface instead of an inset passage');
  const outside=geometry.flyerSkinPoint(geometry.flyerSkullProfile,y+.07,side*Math.PI/2,true);
  ray.set(outside.clone().add(new T.Vector3(side*.1,0,0)),new T.Vector3(-side,0,0));assert(Math.abs(ray.intersectObject(mesh)[0].distance-.1)<.004,'skin beside the naris must remain continuous');
  const eye=geometry.FLYER_EYE,p=geometry.flyerSkinPoint(geometry.flyerSkullProfile,eye.y,side*1.08,true),bare=geometry.flyerSkinPoint(geometry.flyerSkullProfile,eye.y,side*1.08,false);
  assert(Math.abs(p.x)<Math.abs(bare.x)-.006,'eye sits on a bulging sphere rather than in a recess');
 }
 const p=skull.attributes.position,ids=[],vertices=new Map(),edges=new Map();
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join(',');if(!vertices.has(key))vertices.set(key,vertices.size);ids.push(vertices.get(key));}
 for(let i=0;i<skull.index.count;i+=3){const t=[0,1,2].map(j=>ids[skull.index.getX(i+j)]);for(let j=0;j<3;j++){const a=t[j],b=t[(j+1)%3],key=a<b?`${a}:${b}`:`${b}:${a}`;edges.set(key,(edges.get(key)??0)+1);}}
 assert([...edges.values()].every(n=>n===2),'nasal rims and caps leave an open edge');
 mesh.material.dispose();
});
