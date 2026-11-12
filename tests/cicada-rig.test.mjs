import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { Group, Vector3 } from 'three';
import { createServer } from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,
 server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});
after(()=>server.close());
const {createCicada}=await server.ssrLoadModule('/src/cicada-rig.ts');
const {createBossLaserContact}=await server.ssrLoadModule('/src/laser-contact.ts');
const {cicadaFlight,CICADA_FIRE,CICADA_TRAVEL}=await server.ssrLoadModule('/src/cicada.ts');
const {Flight,STEP,BOSS_DEPTH,BOSS_Y,BOSS_PROJECTION}=await server.ssrLoadModule('/src/game.ts');

test('cicada has four articulated wings and six legs with finite, repeatable poses',()=>{
 const rig=createCicada(),wings=rig.root.children.filter(n=>/^(fore|hind)wing-/.test(n.name)),legs=rig.root.children.filter(n=>n.name.startsWith('leg-'));
 assert.equal(wings.length,4);assert.equal(legs.length,6);
 const snapshot=()=>{rig.root.updateMatrixWorld(true);const values=[];rig.root.traverse(n=>values.push(...n.matrixWorld.elements));return values;};
 rig.pose(1,.8,-2.4,0,0,1);const first=snapshot();
 const before=new Set();rig.root.traverse(n=>{if(n.geometry)before.add(n.geometry);});
 for(let i=0;i<80;i++){rig.pose(1,i%10/10,i%2?-2.4:2.4,0,0,i*.1);assert(snapshot().every(Number.isFinite));}
 rig.pose(1,.8,-2.4,0,0,1);assert.deepEqual(snapshot(),first);
 const after=new Set();rig.root.traverse(n=>{if(n.geometry)after.add(n.geometry);});assert.deepEqual(after,before);
});

test('banked cicada vents stay registered with combat and laser contact through the weave',()=>{
 const plane=new Group(),rig=createCicada(),flight=new Flight('sentry',[],'vex','titan');
 plane.rotation.x=-Math.PI/2;plane.add(rig.root);
 flight.phase='boss';
 const contact=createBossLaserContact(plane,rig.root);
 const positions=[];
 for(let i=0;i<160;i++){
  flight.time=i*.1;
  const p=cicadaFlight(flight.time);
  positions.push(p.x);
  rig.root.position.set(p.x,BOSS_Y+p.y,BOSS_DEPTH+p.z);
  rig.root.rotation.set(0,p.yaw,p.bank,'ZYX');
  for(const volley of [0,1]){
   flight.volley=volley;
   const side=volley?1:-1;
   const hit=contact(side,22);
   assert(Math.abs(hit.x-flight.exposedCannonX*BOSS_PROJECTION)<1e-9);
   assert(Math.abs(hit.y-flight.bossAimY*BOSS_PROJECTION)<1e-9);
   assert.equal(Math.sign(hit.x),side);
  }
 }
 assert(Math.max(...positions)-Math.min(...positions)>2.7);
});

test('volley origins follow the moving vent and a tracking laser keeps its lock',()=>{
 const flight=new Flight('sentry',[],'vex','wormhole');
 flight.phase='boss';
 const wing=flight.wings[0];
 wing.upgraded=true;
 for(let i=0;i<70;i++){
  flight.time=i*STEP;
  flight.stepLaser(wing,{x:flight.exposedCannonX*BOSS_PROJECTION,y:-4},true,STEP);
 }
 assert(wing.laserHold>1);
 flight.time=CICADA_FIRE+STEP/2;
 const origin=flight.cicadaMuzzle();
 flight.markers=[{x:2,y:-4}];
 flight.stepCicada();
 const [shot]=flight.threats;
 assert(new Vector3(shot.x,shot.y,shot.z).distanceTo(new Vector3(origin.x,origin.y,origin.z))<1e-9);
 assert(Math.hypot(shot.x+shot.vx*CICADA_TRAVEL-2,shot.y+shot.vy*CICADA_TRAVEL+4,shot.z+shot.vz*CICADA_TRAVEL)<1e-9);
 flight.stepLaser(wing,{x:flight.exposedCannonX*BOSS_PROJECTION,y:-4},true,STEP);
 assert.equal(wing.laserHold,0);
});

test('Titan world keeps ground/cloud separation and ends at the combat hit plane',async()=>{
 const {titanWorld,titanBossPoint}=await server.ssrLoadModule('/src/titan-frame.ts');
 for(let i=0;i<=100;i++){const rise=i/100,a=titanWorld(0,-4,rise),b=titanWorld(0,3,rise);assert(Math.abs(Math.hypot(a.y-b.y,a.z-b.z)-7)<1e-10);}
 const start=titanBossPoint(0),end=titanBossPoint(1);assert(start.y>12);assert(Math.abs(end.y-4.2)<1e-10);assert(Math.abs(end.z+12)<1e-10);
});

test('wing vein triangles fit within membranes and every leg has tibial spines',async()=>{
 const {Triangle,Vector3}=await import('three'),rig=createCicada(),p=new Vector3(),a=new Vector3(),b=new Vector3(),c=new Vector3(),triangle=new Triangle();
 for(const wing of rig.root.children.filter(n=>/^(fore|hind)wing-/.test(n.name))){
  const membrane=wing.children[0].geometry,veins=wing.children[1].geometry,triangles=[];
  for(let i=0;i<membrane.index.count;i+=3){triangles.push(new Triangle(new Vector3().fromBufferAttribute(membrane.attributes.position,membrane.index.getX(i)),new Vector3().fromBufferAttribute(membrane.attributes.position,membrane.index.getX(i+1)),new Vector3().fromBufferAttribute(membrane.attributes.position,membrane.index.getX(i+2))));}
  const used=new Set(veins.index.array);assert(used.size>100);
  for(const i of used){p.fromBufferAttribute(veins.attributes.position,i).setZ(0);assert(triangles.some(t=>t.containsPoint(p)),'vein outside membrane');}
 }
 for(const leg of rig.root.children.filter(n=>n.name.startsWith('leg-')))assert.equal(leg.children.filter(n=>n.name==='tibial-spine').length,5);
});


test('mirrored strip extensions share borders and mountains leave the flight corridor clear',async()=>{
 const {titanGroundTile}=await server.ssrLoadModule('/src/titan-layout.ts');
 const {createTitanMountains}=await server.ssrLoadModule('/src/titan-mountains.ts');
 for(const p of [0,.5,.933,1]){
  const top=titanGroundTile(0,0,0,p),next=titanGroundTile(0,0,1,p),bottom=titanGroundTile(9,0,0,p),previous=titanGroundTile(9,0,-1,p);
  assert.equal(top.y+8,next.y-8);assert.equal(bottom.y-8,previous.y+8);
  assert.equal(titanGroundTile(0,-1,0,p).x+4.5,top.x-4.5);
  assert.equal(next.flipY,-1);assert.equal(titanGroundTile(0,-1,0,p).flipX,-1);
 }
 let peaks=0;createTitanMountains().traverse(n=>{if(n.isMesh){const a=n.geometry.attributes.position;for(let i=0;i<a.count;i++){assert(Math.abs(a.getX(i))>=6);assert(Number.isFinite(a.getZ(i)));if(a.getZ(i)>12)peaks++;}}});assert(peaks>100);
});


test('the ocellar triangle clears the face ribs and main eyes and rostrum stay compact',async()=>{
 const {Box3}=await import('three'),rig=createCicada(),ribs=[],ocelli=[],eyes=[];let rostrum;
 rig.root.updateMatrixWorld(true);rig.root.traverse(n=>{if(n.name==='clypeal-rib')ribs.push(n);if(n.name==='ocellus')ocelli.push(n);if(n.name==='compound-eye')eyes.push(n);if(n.name==='rostrum')rostrum=n;});
 assert.equal(ocelli.length,3);assert.equal(eyes.length,2);const top=Math.max(...ribs.map(n=>new Box3().setFromObject(n).max.y));
 for(const eye of ocelli)assert(new Box3().setFromObject(eye).min.y>top+.05);
 for(const eye of eyes)assert(Math.max(...eye.scale.toArray())<.6);
 const box=new Box3().setFromObject(rostrum);assert(box.max.y-box.min.y<.7);
});

test('reference face ribs lie on the continuous clypeus and ocelli point downward',async()=>{
 const {Vector3,Raycaster}=await import('three'),rig=createCicada(),ribs=[],ocelli=[];let shield;
 rig.root.updateMatrixWorld(true);rig.root.traverse(n=>{if(n.name==='clypeal-rib')ribs.push(n);if(n.name==='clypeus')shield=n;if(n.name==='ocellus')ocelli.push(n);});
 assert.equal(ribs.length,16);const centre=ocelli.find(n=>Math.abs(n.position.x)<.01);assert(ocelli.filter(n=>n!==centre).every(n=>n.position.y>centre.position.y));
 const ray=new Raycaster(),point=new Vector3(),direction=new Vector3(0,0,-1);
 for(const rib of ribs)for(const t of [0,.25,.5,.75,1]){
  point.copy(rib.geometry.parameters.path.getPoint(t));rib.parent.localToWorld(point);ray.set(new Vector3(point.x,point.y,point.z+1),direction);const hit=ray.intersectObject(shield,false)[0];assert(hit,'rib misses face surface');assert(point.z-hit.point.z>0&&point.z-hit.point.z<.06,'floating or buried face rib');
 }
});
