import assert from 'node:assert/strict';
import { after,test } from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});
after(()=>server.close());
const {Flight,STEP,prismWaves}=await server.ssrLoadModule('/src/game.ts');
const {prismSolids,prismCrystals,prismCrystalY,prismScroll,PRISM_DURATION,PRISM_TRAVEL,PRISM_PITCH}=await server.ssrLoadModule('/src/prism-layout.ts');
const {IceCollision}=await server.ssrLoadModule('/src/ice-collision.ts');
const {FIGHTER_HULL}=await server.ssrLoadModule('/src/hive-collision.ts');
const {createPrismScenery,prismCrystalGeometry}=await server.ssrLoadModule('/src/prism-scenery.ts');

test('the three-screen cave uses only prototype ships and preserves repeat wing drops',()=>{
 assert.equal(PRISM_TRAVEL+16,48);assert.equal(PRISM_DURATION,24);assert.equal(prismWaves.length,6);
 assert(prismWaves.every(w=>!w.marine&&!w.ant&&w.raptor===undefined));
 assert.equal(new Set(prismWaves.map(w=>w.drop)).size,4);
 const f=new Flight('sentry',[],'vex','prism');let count=0;
 for(let i=0;i<26*60;i++){f.invulnerable=100;f.step(STEP);count=Math.max(count,f.enemies.length);assert(f.enemies.every(e=>!e.marine&&!e.ant&&!e.raptor));}
 assert(count>2&&count<=12);assert.equal(f.phase,'boss');assert.equal(f.bossMaxHealth,30);assert.equal(f.enemies.length,0);
 const before=f.bossHealth;f.pulse();assert.equal(f.bossHealth,before-6);
});

test('crystal contact preserves a clear central route and an open boss arena',()=>{
 const collision=new IceCollision(prismSolids,PRISM_TRAVEL);
 const actor={x:-3.95,y:0};
 for(let frame=0;frame<=1440;frame++){
  collision.update(frame/1440);collision.move(actor,0,0,FIGHTER_HULL);assert(!collision.overlaps(actor,FIGHTER_HULL));
  for(const y of [-7,-3,0,4,6])assert(!collision.overlaps({x:0,y},FIGHTER_HULL));
 }
 for(let x=-3.95;x<=3.95;x+=.2)for(const y of [-7.1,0,6.6])assert(!collision.overlaps({x,y},FIGHTER_HULL));
 assert(prismCrystals.filter(r=>r.solid).length===prismSolids.length);
 for(const r of prismCrystals.filter(r=>!r.solid))assert(r.root.z+r.direction.z*r.length<=-.749);
});

test('the cave keeps moving through the boss pursuit and recycles only beyond the near view',()=>{
 assert.equal(prismScroll(PRISM_DURATION),PRISM_TRAVEL);assert(prismScroll(60)>PRISM_TRAVEL);
 const forward=new T.Vector3(0,Math.cos(PRISM_PITCH),-Math.sin(PRISM_PITCH));
 assert(forward.distanceTo(new T.Vector3(0,9.5,-12).normalize())<1e-8);
 for(let t=0;t<330;t+=.2)for(let i=0;i<prismCrystals.length;i++){
  const y=prismCrystalY(i,t),next=prismCrystalY(i,t+.1);
  if(Math.abs(y)<20)assert(Math.abs(y-next-.1*PRISM_TRAVEL/PRISM_DURATION)<1e-7);
 }
});

test('crystal shells have closed root and tip surfaces',()=>{
 for(let seed=0;seed<4;seed++){
  const g=prismCrystalGeometry(seed),p=g.getAttribute('position'),edges=new Map();
  const key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e6)).join('/');
  for(let i=0;i<g.index.count;i+=3)for(let j=0;j<3;j++){
   const edge=[key(g.index.array[i+j]),key(g.index.array[i+(j+1)%3])].sort().join(':');edges.set(edge,(edges.get(edge)??0)+1);
  }
  assert([...edges.values()].every(count=>count===2));
 }
});

test('the river includes opted-in projectiles and excludes markers, restoring state after failure',()=>{
 const cave=createPrismScenery(),scene=new T.Scene(),actor=new T.Group(),threat=new T.Group(),marker=new T.Group(),light=new T.DirectionalLight();
 scene.add(cave.root,actor,threat,marker,light);cave.root.visible=true;actor.visible=false;cave.setReflectionActors([actor,threat]);cave.prime();
 scene.updateMatrixWorld(true);
 const mirror=cave.root.getObjectByName('prism-live-river'),camera=new T.PerspectiveCamera(39,9/16,.1,240);camera.position.z=32;camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 const original={tag:'canvas'},viewport=new T.Vector4(2,3,14,16);let target=original,scissor=true,currentViewport=viewport.clone(),draws=0;
 const renderer={xr:{enabled:true},shadowMap:{autoUpdate:true},autoClear:true,state:{buffers:{depth:{setMask(){}}}},
  getRenderTarget:()=>target,setRenderTarget:t=>{target=t;},getViewport:v=>v.copy(currentViewport),setViewport:v=>{currentViewport.copy(v);},
  getScissorTest:()=>scissor,setScissorTest:v=>{scissor=v;},
  render:()=>{draws++;assert(actor.visible);assert(threat.visible);assert(!marker.visible);assert(light.visible);assert(!mirror.visible);throw Error('mirror interrupted');},
 };
 assert.throws(()=>mirror.onBeforeRender(renderer,scene,camera,mirror.geometry,mirror.material,null),/mirror interrupted/);
 assert.equal(draws,1);assert.equal(target,original);assert(currentViewport.equals(viewport));assert(scissor);
 assert(!actor.visible&&threat.visible&&marker.visible&&mirror.visible);assert(renderer.xr.enabled&&renderer.shadowMap.autoUpdate);
});


test('the river remains below the lane and follows its forward axis throughout the camera pitch',()=>{
 const cave=createPrismScenery(),river=cave.root.getObjectByName('prism-live-river');
 for(const reveal of [0,.25,.5,.75,1]) {
  cave.update(1,reveal,32);cave.root.updateMatrixWorld(true);
  const normal=new T.Vector3(0,0,1).transformDirection(river.matrixWorld);
  const forward=new T.Vector3(0,1,0).transformDirection(river.matrixWorld);
  assert(Math.abs(normal.dot(forward))<1e-8);
  assert(river.getWorldPosition(new T.Vector3()).z<-.1);
  assert.equal(river.getRenderTarget().width,384);assert.equal(river.getRenderTarget().height,768);
 }
});

test('the HDR pass restores the caller target, viewport and scissor after a failed draw',async()=>{
 const {createPrismGlow}=await server.ssrLoadModule('/src/prism-glow.ts');
 const original={tag:'caller'},viewport=new T.Vector4(3,5,17,19);
 let target=original,scissor=true,currentViewport=viewport.clone();
 const renderer={capabilities:{maxSamples:4},getDrawingBufferSize:v=>v.set(450,800),
  getRenderTarget:()=>target,setRenderTarget:t=>{target=t;},getViewport:v=>v.copy(currentViewport),setViewport:v=>{currentViewport.copy(v);},
  getScissorTest:()=>scissor,setScissorTest:v=>{scissor=v;},
  render:()=>{assert.notEqual(target,original);assert(!scissor);throw Error('HDR interrupted');}};
 const glow=createPrismGlow(renderer);
 assert.throws(()=>glow.render(new T.Scene(),new T.PerspectiveCamera()),/HDR interrupted/);
 assert.equal(target,original);assert(currentViewport.equals(viewport));assert(scissor);
});

test('camera-driven facet flares use cave coordinates through the boss pitch',()=>{
 const cave=createPrismScenery(),river=cave.root.getObjectByName('prism-live-river'),camera=new T.PerspectiveCamera();
 const parent=new T.Group();parent.rotation.x=-Math.PI/2;parent.add(camera);camera.position.set(9,4,32);
 for(const reveal of [0,.5,1]) {
  cave.update(1,reveal,30);cave.capture({},camera);
  const expected=camera.getWorldPosition(new T.Vector3()).applyMatrix4(river.parent.matrixWorld.clone().invert());
  assert(river.material.uniforms.caveEye.value.distanceTo(expected)<1e-8);
 }
 camera.position.x=-9;cave.capture({},camera);assert.equal(river.material.uniforms.caveEye.value.x,-9);
});


test('live crystal capture includes bullets, excludes optical surfaces and restores state after failure',async()=>{
 const {createPrismScene}=await server.ssrLoadModule('/src/prism-scene.ts');
 const live=createPrismScene(),scene=new T.Scene(),plane=new T.Group(),root=new T.Group(),field=new T.Group();
 const bullet=new T.Group(),marker=new T.Group(),crystal=new T.Group(),glint=new T.Group();
 crystal.name='prism-crystals-0';glint.name='prism-facet-glints';field.add(crystal,glint);root.add(field);plane.add(root,bullet,marker);scene.add(plane);live.setActors([bullet]);
 const original={tag:'canvas'},viewport=new T.Vector4(1,2,17,19),layer={value:0};let target=original,scissor=true,current=viewport.clone();
 const renderer={getDrawingBufferSize:v=>v.set(600,1800),getRenderTarget:()=>target,setRenderTarget:v=>{target=v;},
  getViewport:v=>v.copy(current),setViewport:v=>{current.copy(v);},getScissorTest:()=>scissor,setScissorTest:v=>{scissor=v;},
  render:()=>{assert(bullet.visible&&!marker.visible&&!crystal.visible&&!glint.visible);assert.equal(layer.value,1);assert.equal(target.height,768);throw Error('scene interrupted');}};
 assert.throws(()=>live.capture(renderer,new T.PerspectiveCamera(),root,field,layer),/scene interrupted/);
 assert.equal(target,original);assert(current.equals(viewport));assert(scissor);assert.equal(layer.value,0);
 assert(bullet.visible&&marker.visible&&crystal.visible&&glint.visible);
});
