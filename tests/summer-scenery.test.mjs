import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,define:{__ENCOUNTER_TEXTURES__:'{}'},server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const river=await server.ssrLoadModule('/src/summer/river.ts'),layout=await server.ssrLoadModule('/src/summer/layout.ts');
const {createLotusPalace}=await server.ssrLoadModule('/src/summer/palace.ts'),{createMammothAssets,createMammoth}=await server.ssrLoadModule('/src/summer/mammoths.ts');
const {createLevel}=await server.ssrLoadModule('/src/rendering/levels/summer.ts'),{Flight}=await server.ssrLoadModule('/src/game.ts');
const combat=await server.ssrLoadModule('/src/summer/combat.ts');

test('meander profiles match the shader across negative coordinates, bends and the palace mouth',()=>{
 // Evaluate the emitted arithmetic independently of the CPU sampler. This catches
 // malformed signed literals and divergence between planted banks and visible water.
 const source=river.summerRiverShader().replace('vec4 summerChannel(float y)','function channel(y)').replaceAll('float u=','let u=');
 const sample=new Function('clamp','vec4','return '+source)((x,a,b)=>Math.max(a,Math.min(b,x)),(...v)=>v);
 let length=0,previous=river.summerChannel(0),crossings=0,lastSign=Math.sign(previous.x);
 for(let y=-40;y<=350;y+=.37){const p=river.summerChannel(y),gpu=sample(y);assert(Math.abs(gpu[0]-p.x)<1e-6);assert(Math.abs(gpu[1]-p.width)<1e-6);assert(Math.abs(gpu[2]-p.slope)<1e-6);assert(Math.abs(gpu[3]-p.curve)<1e-6);assert(p.width>=1.3&&p.width<=1.95);assert(Math.abs(p.slope)<1.1);}
 for(let y=.1;y<=280;y+=.1){const p=river.summerChannel(y);length+=Math.hypot(.1,p.x-previous.x);previous=p;if(Math.sign(p.x)!==lastSign){crossings++;lastSign=Math.sign(p.x);}}
 assert(length/280>1.1&&length/280<1.4);assert(crossings>=12);assert.equal(river.summerRiver(layout.SUMMER_END),0);
 for(let y=0;y<280;y+=.5){const a=river.summerChannel(y-1e-4),b=river.summerChannel(y+1e-4),p=river.summerChannel(y);assert(Math.abs((b.x-a.x)/2e-4-p.slope)<.001);}
});

test('grazing mammoth bodies stay on dry ground along the curved river, including rotated adults and calves',()=>{
 for(const site of layout.mammothSites)for(let i=0;i<40;i++){
  const theta=i/40*Math.PI*2,x=1.3*Math.cos(theta)*site.size,y=2.3*Math.sin(theta)*site.size;
  const px=site.x+x*Math.cos(site.angle)-y*Math.sin(site.angle),py=site.y+x*Math.sin(site.angle)+y*Math.cos(site.angle);
  assert(river.summerShoreDistance(px,py)>.1,`mammoth body enters water at ${site.y}`);
 }
 const a=createMammothAssets(),adult=createMammoth(a),calf=createMammoth(a),texture=new T.Texture();a.setAtlas(texture);assert(adult.raster.visible&&calf.raster.visible&&!adult.fallback.visible);
 const pose=()=>{adult.root.updateMatrixWorld(true);const m=[];adult.root.traverse(o=>m.push(...o.matrixWorld.elements));return m;};adult.pose(5);const before=pose();adult.pose(12);adult.pose(5);assert.deepEqual(pose(),before);
});

test('three independent lotus renders flank the boss and its far wall without opaque canopies hiding the fight',()=>{
 const palace=createLotusPalace();palace.root.position.y=0;const blooms=palace.lotuses.blooms;assert.equal(blooms.length,3);
 const [left,right,wall]=blooms,camera=new T.PerspectiveCamera(40,9/16,.05,440);camera.position.z=22;camera.updateMatrixWorld(true);palace.root.updateMatrixWorld(true);
 const project=b=>b.node.getWorldPosition(new T.Vector3()).project(camera);assert(project(left).x<0&&project(right).x>0);assert(project(wall).y>new T.Vector3(0,4.2,-12).project(camera).y);
 for(const point of[new T.Vector3(0,4.2,-11.8),new T.Vector3(0,11.4,-15.8)]){
  const ray=new T.Raycaster(camera.position,point.clone().sub(camera.position).normalize(),0,camera.position.distanceTo(point)-.01);
  const opaque=ray.intersectObject(palace.root,true).filter(h=>h.object.visible&&!h.object.material.transparent);assert.equal(opaque.length,0,'architecture hides boss');
 }
 const texture=new T.Texture();palace.lotuses.setFlanks(texture);assert(left.raster.visible&&right.raster.visible&&!left.fallback.visible&&!right.fallback.visible);assert(wall.fallback.visible&&!wall.raster.visible);palace.lotuses.setWall(texture);assert(wall.raster.visible&&!wall.fallback.visible);
 palace.update(3);const gains=blooms.map(b=>b.gain.value);palace.update(3);assert.deepEqual(blooms.map(b=>b.gain.value),gains);palace.update(10);assert.notDeepEqual(blooms.map(b=>b.gain.value),gains);
});

test('river hydra bodies follow the bed around bends while their three flight-plane heads retain combat positions',async()=>{
 const plane=new T.Group(),scene=new T.Scene(),level=createLevel({plane,scene,signal:new AbortController().signal});plane.add(level.root);await level.ready;
 for(const at of[23.25,53,78.5]){
  const course={kind:'hydra',formation:'vee',slot:0,mirror:1,at},time=at+1,p=combat.summerMotion(1,0,course,time),f=new Flight('sentry',[],'vex','summer');
  f.time=time;f.enemies=[{...p,lane:0,age:1,fire:2.7,hp:10,summer:course}];level.update({flight:f,time,reveal:0,animationTime:time});plane.updateMatrixWorld(true);
  const body=level.models[0].getObjectByName('hydra-riverbed-body'),world=body.getWorldPosition(new T.Vector3());assert(Math.abs(world.x-river.summerRiver(world.y+layout.summerScroll(time)))<1e-8);
  assert.equal(level.models[0].position.x,p.x);assert.equal(level.models[0].position.y,p.y);
 }level.dispose();
});
