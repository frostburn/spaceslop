import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {createServer} from 'vite';
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true},appType:'custom'});after(()=>server.close());
const {createGroveEcology}=await server.ssrLoadModule('/src/biolume/ecology.ts');
test('bounded fireflies wander, avoid actors, and freeze with the presentation clock',()=>{
 const a=createGroveEcology(),b=createGroveEcology();
 for(let i=0;i<2400;i++){const time=i/60;for(const e of[a,b])e.update(time,time,[{x:0,y:-4}]);
 for(const f of a.state){assert(Number.isFinite(f.x+f.y));assert(Math.hypot(f.x,f.y+4)>=1.04);}}
 assert.equal(a.state.length,64);assert.equal(a.root.children.length,2);assert.deepEqual(a.state,b.state);
 const before=structuredClone(a.state);a.update(40,2399/60);assert.deepEqual(a.state,before);
});

test('atlas bark crop is normalized and fern roots stay attached while swaying',async()=>{
 const {createGroveBranch,BRANCH_CROP,FERN_SITES}=await server.ssrLoadModule('/src/biolume/branch.ts');
 const T=await import('three'),b=createGroveBranch();assert(BRANCH_CROP.every(n=>n>=0&&n<=1));assert.equal(FERN_SITES.length,3);
 b.setArt(new T.Texture());b.update(12,1);const roots=b.crowns.map(c=>c.position.toArray());b.update(13,2);assert.deepEqual(b.crowns.map(c=>c.position.toArray()),roots);assert(b.crowns.every(c=>c.parent===b.root));b.release();
});
