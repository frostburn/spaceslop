import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';

const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,
  server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});
after(()=>server.close());
const {wingPoint,createWingGeometry,poseWingGeometry,createRasterGlider}=await server.ssrLoadModule('/src/biolume/modules.ts');

test('flapping bends symmetric wing tips while the body and wing roots stay attached',()=>{
  for(const x of[0,.12,.23])assert.deepEqual(wingPoint(x,.4,0),wingPoint(x,.4,Math.PI/10));
  const up=wingPoint(1.5,.2,Math.PI/10),down=wingPoint(1.5,.2,3*Math.PI/10),left=wingPoint(-1.5,.2,Math.PI/10);
  assert(up.z-down.z>1,'wing tips do not lift and lower');
  assert(down.x-up.x>.15,'top-down flap has no visible foreshortening');
  assert.equal(left.x,-up.x);assert.equal(left.z,up.z);assert.equal(up.y,.2);
});

test('scrubbing reconstructs the same wing mesh and normals without accumulating deformation',()=>{
  const g=createWingGeometry(),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
  poseWingGeometry(g,.3);const first=p.array.slice(),normal=n.array.slice();
  poseWingGeometry(g,.9);assert.notDeepEqual(p.array,first);assert.notDeepEqual(n.array,normal);
  poseWingGeometry(g,.3);assert.deepEqual(p.array,first);assert.deepEqual(n.array,normal);
  assert.equal(g.attributes.position,p);assert.equal(g.attributes.normal,n);assert.equal(g.attributes.uv,uv);
  assert(Array.from(p.array).every(Number.isFinite));assert(Array.from(n.array).every(Number.isFinite));
  for(let i=0;i<p.count;i++){assert(new T.Vector3().fromBufferAttribute(p,i).length()<g.boundingSphere.radius);assert(Math.abs(new T.Vector3().fromBufferAttribute(n,i).length()-1)<1e-5);}
  g.dispose();
});

test('paused glider avoids vertex uploads and an optional image keeps the same geometry',()=>{
  const r=createRasterGlider({value:1}),g=r.mesh.geometry,p=g.attributes.position;
  r.pose(1);const version=p.version;r.pose(1);assert.equal(p.version,version);
  assert.equal(r.available,false);const art=new T.Texture();r.setArt(art);assert.equal(r.available,true);assert.equal(r.mesh.geometry,g);
  r.setArt(undefined);assert.equal(r.available,false);assert.equal(r.mesh.geometry,g);
  r.release();g.dispose();r.mesh.material.dispose();art.dispose();
});
