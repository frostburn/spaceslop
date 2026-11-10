import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';

let imageMode='error',frames=0,abortAtFrame=Infinity,abort;
const canvases=[];
globalThis.HTMLImageElement=class {};
globalThis.Image=class extends HTMLImageElement{
 naturalWidth=864;naturalHeight=15360;onload=null;onerror=null;
 set src(value){if(value)queueMicrotask(()=>imageMode==='load'?this.onload?.():this.onerror?.());}
};
globalThis.window={setTimeout};
globalThis.requestAnimationFrame=callback=>setImmediate(()=>{frames++;if(frames===abortAtFrame)abort?.abort();callback(0);});
globalThis.document={createElement(){const context=new Proxy({}, {get:()=>()=>{},set:()=>true});const canvas={width:0,height:0,getContext:()=>context};canvases.push(canvas);return canvas;}};
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,define:{__ENCOUNTER_TEXTURES__:JSON.stringify({biolumeBackdrop:'grove-test.webp'})},server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});
after(()=>server.close());
const {Flight,STEP,BOSS_DEPTH,BOSS_Y,BOSS_CAMERA_DISTANCE}=await server.ssrLoadModule('/src/game.ts');
const route=await server.ssrLoadModule('/src/biolume/route.ts'),combat=await server.ssrLoadModule('/src/biolume/combat.ts');
const assets=await server.ssrLoadModule('/src/biolume/plate-assets.ts');
const {createLevel}=await server.ssrLoadModule('/src/rendering/levels/biolume.ts');
const {createInterceptorRig}=await server.ssrLoadModule('/src/encounter-rigs.ts');
const {createBossLaserContact}=await server.ssrLoadModule('/src/laser-contact.ts');
const {disposeScene}=await server.ssrLoadModule('/src/rendering/dispose.ts');

test('ten complete screens align across both layers and coast continuously into a fixed clearing',()=>{
 assert.equal(route.groveScroll(0),0);assert(Math.abs(route.groveScroll(100)-9)<1e-12);assert.equal(route.groveScroll(120),route.groveScroll(100));
 let previous=-1;
 for(let time=0;time<=100;time+=.1){const s=route.groveScroll(time);assert(s>=previous);previous=s;
  for(const foreground of[false,true]){const h=route.grovePlateHeight(foreground?route.GROVE_LEAF_Z:route.GROVE_GROUND_Z);for(let i=0;i<9;i++)assert(Math.abs(route.groveTileY(i+1,time,foreground)-route.groveTileY(i,time,foreground)-h)<1e-10);}
 }
 const h=.0001,velocity=t=>(route.groveScroll(t+h)-route.groveScroll(t-h))/(2*h);
 assert(Math.abs(velocity(96-h)-velocity(96+h))<1e-6);assert(velocity(100)<1e-6);
 assert(Math.abs(route.groveForegroundScroll(100)-9)<1e-12);
 let maxPods=0;for(let time=0;time<107;time+=.1)maxPods=Math.max(maxPods,route.grovePods.filter(s=>Math.abs(route.groveSitePoint(s,time).y)<10).length);assert(maxPods<=route.GROVE_POD_POOL);
});

test('the full quiet-to-nursery patrol fits the warmed pool and waits until visible before firing',()=>{
 const f=new Flight('sentry',[],'vex','biolume');f.invulnerable=1e5;f.cooldown=f.droneCooldown=1e5;
 const kinds=new Set(),drops=new Set();let maximum=0,shots=0;
 for(let time=0;time<100;time+=STEP){
  const prior=new Set(f.threats);f.step(STEP);maximum=Math.max(maximum,f.enemies.length);
  for(const enemy of f.enemies){assert(enemy.grove,'Another sector enemy leaked into the grove');kinds.add(enemy.grove.kind);if(enemy.drop)drops.add(enemy.drop);assert(Number.isFinite(enemy.x+enemy.y+enemy.heading));}
  for(const shot of f.threats)if(!prior.has(shot)){shots++;assert(shot.y<6.6&&shot.y>-6.9&&Math.abs(shot.x)<4.3,'A hidden glider fired');}
 }
 assert(maximum<=combat.GROVE_ENEMY_POOL,`Pool needs ${maximum} rigs`);assert(shots>30);assert.equal(kinds.size,3);assert.equal(drops.size,4);
 assert.equal(f.phase,'approach');assert.equal(f.enemies.length,0);assert.equal(f.transitionDuration,6);
 for(let i=0;i<370;i++)f.step(STEP);assert.equal(f.phase,'boss');
});

test('flock paths and headings remain finite and continuous through entry, looping trains and bank hovers',()=>{
 for(const wave of combat.groveWaves)for(let slot=0;slot<wave.lanes.length;slot++){
  const course={...wave.grove,slot};let last;
  for(let age=-2.5;age<12;age+=.02){const p=combat.groveMotion(age,wave.lanes[slot],course);assert(Number.isFinite(p.x+p.y+p.heading+p.bank));if(last)assert(Math.hypot(p.x-last.x,p.y-last.y)<.18);last=p;}
 }
 assert(combat.groveWaves.at(-1).time<90);
});

test('plate decoding yields ten bounded, guttered textures without uploading a tall source',async()=>{
 imageMode='load';frames=0;const maps=await assets.loadGrovePlate('biolumeBackdrop',new AbortController().signal);
 assert.equal(maps.length,10);assert.equal(frames,10);
 maps.forEach(map=>{assert(map.image.width<=720);assert(map.image.height<=1288);assert.equal(map.generateMipmaps,false);assert.equal(map.colorSpace,T.SRGBColorSpace);map.dispose();});
 const small=assets.plateSlice(432,7680,4);assert.equal(small.width,432);assert.equal(small.screenHeight,768);assert(small.cropStart>0&&small.cropEnd<1);
 imageMode='error';
});

test('canceling a sliced plate releases partial canvases and publishes no late textures',async()=>{
 imageMode='load';frames=0;abortAtFrame=2;abort=new AbortController();const start=canvases.length;
 const maps=await assets.loadGrovePlate('biolumeBackdrop',abort.signal);assert.deepEqual(maps,[]);
 assert.equal(canvases.length-start,1);assert.equal(canvases.at(-1).width,1);assert.equal(canvases.at(-1).height,1);
 abortAtFrame=Infinity;imageMode='error';
});

test('prototype draconian stays above the painted floor with unchanged projected cannon contacts',async()=>{
 const plane=new T.Group(),scene=new T.Scene();scene.add(plane);const level=createLevel({plane,scene,signal:new AbortController().signal});plane.add(level.root);await level.ready;
 assert.equal(level.keyIntensity,0);assert.equal(level.skyIntensity,0);assert.equal(level.fixedCamera,true);
 let lights=0;level.root.traverse(n=>{if(n.isPointLight)lights++;});assert.equal(lights,8);
 const f=new Flight('sentry',[],'vex','biolume');f.phase='boss';
 const frame={flight:f,time:108,reveal:1,animationTime:108,distance:22,elapsed:0,newFlight:false,fighterSpeed:0,droneSpeed:0};level.update(frame);plane.updateMatrixWorld(true);
 const canonical=createInterceptorRig(2.4);canonical.root.position.set(0,BOSS_Y,BOSS_DEPTH);plane.add(canonical.root);canonical.pose(1,0,f.exposedCannonX,f.firedCannonX,0);plane.updateMatrixWorld(true);
 const original=createBossLaserContact(plane,canonical.root);
 for(const side of[-2.4,2.4]){const a=level.contact(side,BOSS_CAMERA_DISTANCE,f),b=original(side,BOSS_CAMERA_DISTANCE);assert(Math.hypot(a.x-b.x,a.y-b.y)<1e-8);}
 const bounds=new T.Box3().setFromObject(level.boss);assert(bounds.min.z>route.GROVE_GROUND_Z+1,'Backdrop hides the boss');
 const first=level.root.children.flatMap(n=>n.children).map(n=>n.uuid);level.update(frame);assert.deepEqual(level.root.children.flatMap(n=>n.children).map(n=>n.uuid),first);
 level.dispose();level.dispose();disposeScene(scene);
});

for(const weapon of['primary','sentry','towline','homing','cannon','laser','omega','pulse'])test(`the temporary draconian can be damaged with ${weapon}`,()=>{
 const wing=['homing','cannon','laser','omega'].includes(weapon),f=new Flight(weapon==='towline'?'towline':'sentry',wing?[weapon]:[],'vex','biolume');f.phase='boss';f.invulnerable=1000;
 if(weapon!=='primary')f.cooldown=1e5;if(weapon!=='sentry')f.droneCooldown=weapon==='towline'?0:1e5;
 if(weapon==='pulse')f.pulse();else for(let i=0;i<1000&&f.phase==='boss';i++){
  const x=f.exposedCannonX*22/34;f.player={x:weapon==='towline'?-2.8:0,y:weapon==='towline'?BOSS_Y*22/34:-4};f.drone={x:weapon==='towline'?2.8:x,y:weapon==='towline'?BOSS_Y*22/34:-2};f.step(STEP);
 }
 assert(f.bossHealth<f.bossMaxHealth,`${weapon} did no damage`);
 if(weapon==='primary')assert.equal(f.phase,'won');
});
