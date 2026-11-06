import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const {createTitanClouds}=await server.ssrLoadModule('/src/titan-clouds.ts');
const {TITAN_CLOUD_RELIEF}=await server.ssrLoadModule('/src/titan-cloud-relief.ts');
const {TITAN_PITCH}=await server.ssrLoadModule('/src/titan-frame.ts');

test('cloud relief leaves the lowest combat flight position above every bank',()=>{
 const lowestFlightHeight=12-7.1*Math.sin(TITAN_PITCH);
 for(let i=0;i<3;i++)assert(1+i*1.2+TITAN_CLOUD_RELIEF[i]<lowestFlightHeight-.5);
});

test('clouds share bounded near-field geometry and pause/replay without surface drift',()=>{
 const clouds=createTitanClouds(),sheets=clouds.root.children.filter(n=>n.name.startsWith('titan-cloud-')&&n.name!=='titan-cloud-deck');
 assert.equal(sheets.length,3);assert(sheets.every(n=>n.geometry===sheets[0].geometry));
 const positions=sheets[0].geometry.attributes.position;assert(positions.count<40000);
 const xs=[...new Set(Array.from({length:positions.count},(_,i)=>positions.getX(i)).filter(x=>Math.abs(x)<5))].sort((a,b)=>a-b);
 for(let i=1;i<xs.length;i++)assert(xs[i]-xs[i-1]<.75,'cloud bank undersampled near flight corridor');
 function pose(){clouds.root.updateMatrixWorld(true);return sheets.map(s=>[...s.matrixWorld.elements,s.material.uniforms.time.value,s.material.uniforms.density.value,s.material.uniforms.heightScale.value]);}
 clouds.update(96,.5,58);const first=pose();clouds.update(96,.5,58);assert.deepEqual(pose(),first);
 clouds.update(130,1,22);clouds.update(96,.5,58);assert.deepEqual(pose(),first);
});
