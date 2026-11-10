import assert from 'node:assert/strict';
import {test,after} from 'node:test';
import {createServer} from 'vite';
const server=await createServer({configFile:false,server:{middlewareMode:true,hmr:false},optimizeDeps:{noDiscovery:true},appType:'custom'});after(()=>server.close());
const {createGroveEcology}=await server.ssrLoadModule('/src/biolume/ecology.ts');
test('bounded fireflies catch, avoid actors, and freeze with the presentation clock',()=>{
 const a=createGroveEcology(),b=createGroveEcology();
 for(let i=0;i<2400;i++){const time=i/60;for(const e of[a,b])e.update(time,time,[{x:0,y:-4}]);
 for(const f of a.state){assert(Number.isFinite(f.x+f.y));if(f.trap<0)assert(Math.hypot(f.x,f.y+4)>=1.04);}}
 assert.equal(a.state.length,64);assert(a.captures>0);assert.deepEqual(a.state,b.state);
 const before=structuredClone(a.state);a.update(40,2399/60);assert.deepEqual(a.state,before);
});
