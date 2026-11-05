import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { Group } from 'three';
import { createServer } from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,
 server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});
after(()=>server.close());
const {createCicada}=await server.ssrLoadModule('/src/cicada-rig.ts');
const {createBossLaserContact}=await server.ssrLoadModule('/src/laser-contact.ts');

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

test('posed cicada laser contacts remain in the simulation thorax weakpoint windows',()=>{
 const plane=new Group(),rig=createCicada();plane.rotation.x=-Math.PI/2;plane.add(rig.root);rig.root.position.set(0,4.2,-12);
 const contact=createBossLaserContact(plane,rig.root),projection=22/34;
 for(let i=0;i<60;i++)for(const side of [-1,1]){
  rig.pose(1,.7,side*2.4,0,0,i*.1);plane.updateMatrixWorld(true);const hit=contact(side*2.4,22);
  assert(Math.abs(hit.x-side*2.4*projection)<.1);assert(Math.abs(hit.y-4.2*projection)<.1);
 }
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
