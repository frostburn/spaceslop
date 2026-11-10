import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,define:{__ENCOUNTER_TEXTURES__:'{}'},server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});
after(()=>server.close());
const {createLevel}=await server.ssrLoadModule('/src/rendering/levels/summer.ts');
const {Flight}=await server.ssrLoadModule('/src/game.ts');
const {summerScroll}=await server.ssrLoadModule('/src/summer/layout.ts');
const {disposeScene}=await server.ssrLoadModule('/src/rendering/dispose.ts');
async function fixture(){
 const scene=new T.Scene(),plane=new T.Group();scene.add(plane);const level=createLevel({scene,plane,signal:new AbortController().signal});plane.add(level.root);await level.ready;
 return{scene,plane,level,flight:new Flight('sentry',[],'vex','summer'),sheet:level.root.getObjectByName('summer-cloud-sheet'),river:level.root.getObjectByName('summer-meltwater-meadow'),pool:level.root.getObjectByName('lotus-reflecting-pool')};
}

test('clouds stay above and outside the flight camera throughout meadow, approach and palace',async()=>{
 const {plane,level,flight,sheet}=await fixture(),camera=new T.PerspectiveCamera(40,9/16,.05,440);camera.position.z=22;camera.updateMatrixWorld(true);
 const clip=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),frustum=new T.Frustum().setFromProjectionMatrix(clip);
 for(const time of[0,12,45,78,98,100,102,105.99,106,118]){
  level.update({flight,time,reveal:time<100?0:Math.min(1,(time-100)/6),animationTime:time});plane.updateMatrixWorld(true);
  const bounds=new T.Box3().setFromObject(sheet);assert(bounds.min.z>camera.position.z);assert(!frustum.intersectsBox(bounds),'cloud sheet covers the action');
 }
 level.dispose();
});

test('river, pool and overhead clouds share the same world registration and frozen/replayable sky clock',async()=>{
 const {level,flight,sheet,river,pool}=await fixture(),sky=sheet.material.uniforms;
 for(const key of['summerSkyTime','summerSkyScroll','summerReflection']){assert.equal(river.material.uniforms[key],sky[key]);assert.equal(pool.material.uniforms[key],sky[key]);}
 const geometries=new Set(),materials=new Set();level.root.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);materials.add(o.material);}});
 for(const [time,animation]of[[12,11.5],[12,11.5],[106,105.5],[106,105.5],[12,11.5]]){
  level.update({flight,time,reveal:time<100?0:1,animationTime:animation});assert.equal(sky.summerSkyTime.value,animation);assert.equal(sky.summerSkyScroll.value,summerScroll(time));
  level.root.traverse(o=>{if(o.isMesh){assert(geometries.has(o.geometry));assert(materials.has(o.material));}});
 }
 level.dispose();
});

test('the normal scene owner releases cloud resources once and a new sector visit starts with its own sky',async()=>{
 const first=await fixture();let geometryDrops=0,materialDrops=0;
 first.sheet.geometry.addEventListener('dispose',()=>geometryDrops++);first.sheet.material.addEventListener('dispose',()=>materialDrops++);
 first.level.update({flight:first.flight,time:80,reveal:0,animationTime:75});first.level.dispose();first.level.dispose();disposeScene(first.scene);
 assert.equal(geometryDrops,1);assert.equal(materialDrops,1);assert.equal(first.scene.children.length,0);
 const second=await fixture();assert.notEqual(second.sheet.material.uniforms.summerSkyTime,first.sheet.material.uniforms.summerSkyTime);assert.equal(second.sheet.material.uniforms.summerSkyTime.value,0);second.level.dispose();disposeScene(second.scene);
});
