import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';
import { Matrix4, Vector3 } from 'three';
const server = await createServer({ root: new URL('..', import.meta.url).pathname, configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, entries: [] }, appType: 'custom' });
after(() => server.close());
const { createTitanAmbient, titanGroundPoint } = await server.ssrLoadModule('/src/titan-ambient.ts');

test('registered vents scroll with the plate and ambient layers stay below combat', () => {
  assert.deepEqual(titanGroundPoint(360,11520,0),{x:0,y:8});
  assert.deepEqual(titanGroundPoint(360,1280,1),{x:0,y:-8});
  const ambient=createTitanAmbient(),matrix=new Matrix4(),point=new Vector3();
  for(let step=0;step<=180;step++){
    ambient.update(step/180,step/2);
    for(const name of ['titan-vent-exhaust','titan-drifting-haze']){
      const batch=ambient.root.getObjectByName(name),alpha=batch.geometry.getAttribute('puffAlpha');
      for(let i=0;i<batch.count;i++){
        batch.getMatrixAt(i,matrix);assert(matrix.elements.every(Number.isFinite));point.setFromMatrixPosition(matrix);
        assert(point.z < -1); assert(alpha.getX(i)>=0 && alpha.getX(i)<=.61);
      }
    }
    ambient.root.traverse(node=>{
      if(node.isMesh)assert(!node.material.depthWrite || !node.material.transparent);
    });
  }
});

test('ambient motion is deterministic at pause/replay and does not grow GPU resources', () => {
  const ambient=createTitanAmbient();
  const resources=()=>{const geometry=new Set(),materials=new Set();ambient.root.traverse(n=>{if(n.geometry)geometry.add(n.geometry);if(n.material)materials.add(n.material);});return{geometry:[...geometry],materials:[...materials]};};
  const snapshot=()=>{ambient.root.updateMatrixWorld(true);const result=[];ambient.root.traverse(n=>{
    if(n.isInstancedMesh){result.push(...n.instanceMatrix.array,...n.geometry.attributes.puffAlpha.array);}
    if(n.isPoints)result.push(...n.geometry.attributes.position.array);
    if(n.name.startsWith('titan-maintenance-crawler-'))result.push(...n.matrixWorld.elements);
    if(n.name==='work-arm'||n.name==='survey-scanner')result.push(...n.matrixWorld.elements);
  });return result;};
  const before=resources();ambient.update(.5,45);const pose=snapshot();
  ambient.update(.5,45);assert.deepEqual(snapshot(),pose,'paused frame drifted');
  for(let i=0;i<=90;i++)ambient.update(i/90,i);
  ambient.update(.5,45);assert.deepEqual(snapshot(),pose,'scrubbing/replaying changed the same pose');
  assert.deepEqual(resources(),before);
  const bots=ambient.root.children.filter(n=>n.name.startsWith('titan-maintenance-crawler-'));
  assert(bots.length>3);assert(bots.filter(n=>n.visible).length<=2);
});
