import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const {createBurnerBubbles,createVentHeat}=await server.ssrLoadModule('/src/vent-effects.ts');
const {createVentFormations}=await server.ssrLoadModule('/src/vent-formations.ts');

test('bubble trails remain behind moving nozzles, freeze on pause, reset, and retain bounded buffers',()=>{
 const bubbles=createBurnerBubbles(32),plane=new T.Group(),ship=new T.Group(),nozzle=new T.Group(),flame=new T.Mesh();plane.add(ship,bubbles.root);ship.add(nozzle);nozzle.add(flame);flame.scale.y=.6;
 const renderer={getDrawingBufferSize:v=>v.set(720,1280)},position=bubbles.root.geometry.attributes.position,opacity=bubbles.root.geometry.attributes.opacity;
 bubbles.update(plane,[flame],.05,1,renderer);assert(opacity.array.some(a=>a>0));const old=position.getX(0);ship.position.x=8;
 bubbles.update(plane,[flame],.05,1.05,renderer);assert(Math.abs(position.getX(0)-old)<.1,'old bubbles teleport with the ship');assert(position.array.some(x=>x>7));
 const frozen=Array.from(position.array);bubbles.update(plane,[flame],0,1.05,renderer);assert.deepEqual(Array.from(position.array),frozen);
 for(let i=0;i<500;i++)bubbles.update(plane,[flame],.05,2+i*.05,renderer);assert.equal(position.count,32);assert(position.array.every(Number.isFinite));
 bubbles.reset();assert(opacity.array.every(a=>a===0));ship.visible=false;bubbles.update(plane,[flame],.1,30,renderer);assert(opacity.array.every(a=>a===0),'hidden nozzles emit bubbles');
});

test('heat capture excludes itself, bounds mobile resolution and restores renderer state even on failure',()=>{
 const heat=createVentHeat([{x:2,y:3,z:1}]),scene=new T.Scene(),camera=new T.PerspectiveCamera(),previous={name:'screen'},v=new T.Vector4(0,0,16,16),s=new T.Vector4(3,4,12,13);scene.add(heat.root);
 let target=previous,scissor=true,draws=0;
 const renderer={getDrawingBufferSize:p=>p.set(1440,2560),getRenderTarget:()=>target,getViewport:p=>p.copy(v),getScissor:p=>p.copy(s),getScissorTest:()=>scissor,setViewport:p=>v.copy(p),setScissor:p=>s.copy(p),setScissorTest:b=>scissor=b,setRenderTarget:t=>target=t,render:()=>{draws++;assert(!heat.root.visible);assert.equal(target.height,640);assert.equal(target.width,360);assert(target.depthTexture);throw Error('test draw failure');}};
 assert.throws(()=>heat.capture(renderer,scene,camera),/test draw failure/);assert.equal(draws,1);assert(heat.root.visible);assert.equal(target,previous);assert(scissor);assert.deepEqual(v.toArray(),[0,0,16,16]);assert.deepEqual(s.toArray(),[3,4,12,13]);
});

test('landscape modules progress from pale terraces and colonies to chimney clusters and fractured basalt',()=>{
 const f=createVentFormations();assert.deepEqual(f,createVentFormations());const route=f.filter(p=>!p.front&&p.tier==='near');
 assert(route.some(p=>p.y<36&&p.cell===8));assert(route.some(p=>p.y>36&&p.y<76&&p.cell===10));assert(route.some(p=>p.y>112&&p.cell===11));assert(!route.some(p=>p.y>112&&p.cell===8));
 assert(f.some(p=>p.front&&p.cell>=12));assert(f.every(p=>p.cell>=0&&p.cell<16));
});

test('fine bubbles disperse at different velocities and clear within seven tenths after emission stops',()=>{
 const b=createBurnerBubbles(128),plane=new T.Group(),nozzle=new T.Group(),flame=new T.Mesh();plane.add(nozzle,b.root);nozzle.add(flame);const renderer={getDrawingBufferSize:v=>v.set(720,1280)};
 for(let i=0;i<8;i++)b.update(plane,[flame],.05,i*.05,renderer);
 const g=b.root.geometry;assert(Math.max(...g.attributes.radius.array)<.075);assert(new Set(Array.from(g.attributes.position.array).filter(x=>x!==0).map(x=>x.toFixed(3))).size>12);
 nozzle.visible=false;for(let i=0;i<7;i++)b.update(plane,[flame],.1,1+i*.1,renderer);assert(g.attributes.opacity.array.every(x=>x===0));
});

test('decorative mollusks share barnacle shell resources and remain rooted while breathing',async()=>{
 const {createMortarAssets}=await server.ssrLoadModule('/src/vent-mortar-rig.ts'),{createVentColonies,ventColonyPlacements}=await server.ssrLoadModule('/src/vent-colonies.ts');
 const assets=createMortarAssets(new T.Texture()),colonies=createVentColonies(assets),placements=ventColonyPlacements();assert(placements.length>40);assert(placements.every(p=>p.size<.6));assert.deepEqual(placements,ventColonyPlacements());
 const base=colonies.root.children[0],shell=colonies.root.children[1],a=new T.Matrix4(),b=new T.Matrix4();base.getMatrixAt(0,a);shell.getMatrixAt(0,b);colonies.update(3);const c=new T.Matrix4(),d=new T.Matrix4();base.getMatrixAt(0,c);shell.getMatrixAt(0,d);assert.deepEqual(a.elements,c.elements);assert.notDeepEqual(b.elements,d.elements);assert.equal(shell.material,assets.material);assert.equal(shell.geometry,assets.geometries[2]);
 const texture=new T.Texture();assets.setAtlas(texture);assert.equal(shell.material.map,texture);
});
