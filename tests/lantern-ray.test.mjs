import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
globalThis.document={createElement(){return{width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{},set:()=>true})};}};
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,define:{__ENCOUNTER_TEXTURES__:'{}'},server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const {Flight,STEP,BOSS_PROJECTION}=await server.ssrLoadModule('/src/game.ts');
const ray=await server.ssrLoadModule('/src/biolume/lantern-ray.ts');
const {createLanternRay,createRaySeekerAssets,createRaySeekerRig}=await server.ssrLoadModule('/src/biolume/lantern-ray-rig.ts');
function orb(x=0,y=-2){return{x,y,lane:x,age:0,fire:Infinity,hp:ray.RAY_SEEKER_HP,rayOrb:{heading:0,previousX:x,previousY:y}};}
function quiet(weapon){const wing=['homing','cannon','laser','omega'].includes(weapon),f=new Flight(weapon==='towline'?'towline':'sentry',wing?[weapon]:[],'vex','biolume');f.phase='boss';f.stepBoss=()=>{};f.invulnerable=1000;f.cooldown=weapon==='primary'?0:1e5;f.droneCooldown=weapon==='sentry'?0:weapon==='towline'?0:1e5;for(const w of f.wings)w.cooldown=0;return f;}

test('the Lantern Ray bends wings and tail from rest, updates finite normals and skips frozen uploads',()=>{
 const r=createLanternRay(),g=r.mesh.geometry,p=g.attributes.position,n=g.attributes.normal;
 r.pose(1.2);const first=p.array.slice(),normal=n.array.slice();r.pose(4.3);assert.notDeepEqual(p.array,first);assert.notDeepEqual(n.array,normal);
 r.pose(1.2);assert.deepEqual(p.array,first);assert.deepEqual(n.array,normal);const version=p.version;r.pose(1.2);assert.equal(p.version,version);
 for(let i=0;i<p.count;i++){assert(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));assert(g.boundingBox.containsPoint(new T.Vector3().fromBufferAttribute(p,i)));assert(Math.abs(new T.Vector3().fromBufferAttribute(n,i).length()-1)<1e-5);}
 assert.equal(r.glow.clock.value,1.2);r.pose(3.9);assert(r.glow.seeker.value>.5);assert.equal(r.glow.fan.value,0);
 const art=new T.Texture();r.setArt(art);r.pose(3.9);assert.equal(r.mesh.geometry,g);assert.equal(p.version,version+1);r.release();assert.equal(r.mesh.material.map,null);g.dispose();r.mesh.material.dispose();art.dispose();
});

test('organ anchors follow exactly the same deformed coordinates and projection as combat',()=>{
 assert.equal(ray.RAY_PROJECTION,BOSS_PROJECTION);const r=createLanternRay();
 for(const time of[0,1.2,4.1,7,19]){r.pose(time);r.root.updateMatrixWorld(true);for(const side of[-1,1]){const p=r.root.getObjectByName(side<0?'laser_contact_L':'laser_contact_R').getWorldPosition(new T.Vector3()),a=ray.rayShotPoint(p),b=ray.rayOrgan(time,side);assert(Math.hypot(a.x-b.x,a.y-b.y)<1e-8);}}
 r.release();r.mesh.geometry.dispose();r.mesh.material.dispose();
});

test('seekers curve at a capped turn rate and expire within the warmed pool budget',()=>{
 const e=orb(1,2);e.rayOrb.heading=Math.PI-.001;const before=e.rayOrb.heading;ray.stepRaySeeker(e,{x:-2,y:6},STEP);assert(Math.abs(e.rayOrb.heading-before)<=.82*STEP+1e-12);assert(Math.abs(Math.hypot(e.x-1,e.y-2)-2.25*STEP)<1e-12);
 const f=new Flight('sentry',[],'vex','biolume');f.phase='boss';f.bossHealth=40;f.cooldown=f.droneCooldown=1e5;f.invulnerable=1e5;let maximum=0,shots=0;
 for(let i=0;i<3600;i++){f.player.x=3*Math.sin(i*STEP*.4);f.step(STEP);maximum=Math.max(maximum,f.enemies.length);shots=Math.max(shots,f.threats.length);for(const e of f.enemies)assert(e.rayOrb&&e.age<=8);}
 assert(maximum>1&&maximum<=ray.RAY_SEEKER_POOL);assert(shots<128);
});

for(const weapon of['primary','sentry','homing','cannon','laser','omega','towline'])test(`${weapon} destroys a seeking lantern into one eight-bullet straight burst`,()=>{
 const f=quiet(weapon);f.player={x:0,y:-4};f.drone={x:0,y:-4};
 if(weapon==='towline'){f.player={x:-1,y:-2};f.drone={x:1,y:-2};}
 const x=['homing','cannon','laser','omega'].includes(weapon)?f.wingOrigin(-1).x:0,e=orb(x,-2);f.enemies=[e];let burst;
 for(let i=0;i<400&&e.hp>0;i++){f.step(STEP);if(e.hp===0)burst=f.threats.slice();}
 assert.equal(e.hp,0,`${weapon} missed`);assert.equal(f.score,25);assert.equal(burst.length,8);assert(burst.every(s=>s.planar&&s.z===0&&s.vz===0&&Math.abs(Math.hypot(s.vx,s.vy)-3.6)<1e-10));
 const count=f.threats.length;f.damageEnemy(e,20);assert.equal(f.threats.length,count,'dead lantern burst twice');
});

test('laser stops at a seeker before the boss, and contact uses its actual model',()=>{
 const f=quiet('laser');f.player={x:0,y:-4};const e=orb(f.wingOrigin(-1).x,-2);f.enemies=[e];const hp=f.bossHealth;f.step(STEP);
 assert(e.hp<ray.RAY_SEEKER_HP);assert.equal(f.wings[0].laserTarget,e);assert.equal(f.bossHealth,hp);assert(f.wings[0].beamEnd.y<-2);
});

test('Omega pierces successive seekers once; burst bullets remain planar during a boss fight',()=>{
 const f=quiet('omega');f.player={x:0,y:-4};const x=f.wingOrigin(-1).x,a=orb(x,-2.6),b=orb(x,-1.2);f.enemies=[a,b];
 for(let i=0;i<30&&b.hp>0;i++)f.step(STEP);assert.equal(a.hp,0);assert.equal(b.hp,0);assert.equal(f.score,50);assert.equal(f.threats.length,16);
 const s=f.threats[0],before={x:s.x,y:s.y};f.step(STEP);assert(f.threats.includes(s));assert(Math.abs(s.x-before.x-s.vx*STEP)<1e-10);assert(Math.abs(s.y-before.y-s.vy*STEP)<1e-10);
});

test('relative swept interception catches a fast crossing and rejects a distant orb',()=>{
 const e=orb();e.rayOrb.previousX=-1;e.x=1;assert(Number.isFinite(ray.rayOrbEntry(e,{x:0,y:-4},{x:0,y:0})));assert.equal(ray.rayOrbEntry(e,{x:3,y:-4},{x:3,y:0}),Infinity);
});

test('Pulse clears seekers without a secondary burst, and victory freezes the pose and clears hazards',()=>{
 const f=quiet('primary');f.time=9.4;f.enemies=[orb()];f.threats=ray.raySeekerBurst({x:3,y:3},0);f.pulse();assert(f.enemies.every(e=>e.hp===0));assert.equal(f.threats.length,0);f.step(0);assert.equal(f.enemies.length,0);
 f.enemies=[orb()];f.damageBoss(1000);assert.equal(f.phase,'won');assert.equal(f.enemies.length,0);assert.equal(f.threats.length,0);const time=f.rayTime;f.step(2);assert.equal(f.rayTime,time);assert.equal(time,9.4);
 const fresh=new Flight('sentry',[],'vex','biolume');assert.equal(fresh.bossHealth,ray.RAY_HP);assert.equal(fresh.enemies.length,0);
});

test('pooled seekers share GPU resources and animate without replacing buffers',()=>{
 const a=createRaySeekerAssets(),one=createRaySeekerRig(a),two=createRaySeekerRig(a),e=orb();one.pose(e);e.age=2;one.pose(e);two.pose(e);assert.equal(one.root.children[0].geometry,two.root.children[0].geometry);assert.equal(one.root.children[0].material,two.root.children[0].material);assert.equal(a.body.attributes.position.version,0);
 for(const [key,v]of Object.entries(a))if(v.dispose)v.dispose();
});
