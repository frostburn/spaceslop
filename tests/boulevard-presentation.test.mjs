import assert from 'node:assert/strict';import{test,after}from'node:test';import * as T from 'three';import{createServer}from'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const{createBoulevardScenery}=await server.ssrLoadModule('/src/boulevard-scenery.ts'),weather=await server.ssrLoadModule('/src/boulevard-weather.ts'),{BOULEVARD_DECK}=await server.ssrLoadModule('/src/boulevard.ts');

test('road depressions hold level water below actual drainage points and remain continuous through pursuit recycling',()=>{
 const scene=createBoulevardScenery(),{road}=scene;assert(road.sites.length>=10&&road.sites.length<32);let wet=0,dry=0;
 for(let y=0;y<84;y+=.4)for(let x=-3.5;x<3.5;x+=.3){const h=road.field.sample(x,y);assert(h>=-.04&&h<.06);if(h<weather.ROAD_WATER)wet++;else dry++;assert(Math.abs(h-road.field.sample(x,y+84))<1e-12);}
 assert(wet>50&&dry>wet);for(const site of road.sites){assert(road.field.sample(site.x,site.y)<weather.ROAD_WATER-.015);assert(site.z>BOULEVARD_DECK+.4);}
 assert.equal(road.water.position.z,0);assert.equal(road.root.position.z,BOULEVARD_DECK+weather.ROAD_WATER);assert(road.ground.geometry.attributes.position.count>5000);
 // Reflector clones shader uniforms: moving ripples must retain the live source array.
 assert.equal(road.water.material.uniforms.impacts.value,road.rain.impacts);assert.equal(road.water.material.uniforms.relief.value,road.field.texture);
 scene.dispose();
});

test('drips hit their puddles under gravity, share the paused clock and reuse warmed instance storage',()=>{
 const scene=createBoulevardScenery(),{road}=scene,site=road.sites[0],fall=weather.dripState(0,site).fall;
 const impactTime=site.period+fall-site.phase,hit=weather.dripState(impactTime,site);assert(Math.abs(hit.z-BOULEVARD_DECK-weather.ROAD_WATER)<1e-10);assert(Math.abs(hit.impact)<1e-10);
 scene.update(5,0,impactTime+.15);assert(road.rain.impacts.some(v=>Math.abs(v.x-site.x)<1e-9&&Math.abs(v.y-site.y)<1e-9&&v.z>=0&&v.z<1.15));
 const matrices=road.rain.root.instanceMatrix.array.slice(),rings=road.rain.impacts.map(v=>v.clone()),count=road.rain.root.count;
 scene.update(5,0,impactTime+.15);assert.deepEqual(road.rain.root.instanceMatrix.array,matrices);assert.equal(road.rain.root.count,count);assert(road.rain.impacts.every((v,i)=>v.equals(rings[i])));
 road.prime(true);assert.equal(road.rain.root.count,road.sites.length);road.prime(false);assert.equal(road.rain.root.count,count);scene.dispose();
});

test('authored vector strokes keep both endpoints registered when fixed anatomy is batched',async()=>{
 const{vectorGeometry,vectorMaterial}=await server.ssrLoadModule('/src/boulevard-vectors.ts'),{mergeBoulevard}=await server.ssrLoadModule('/src/boulevard-geometry.ts');
 const root=new T.Group(),material=vectorMaterial();for(const x of[-2,2]){const mesh=new T.Mesh(vectorGeometry([{points:[[0,0,0],[1,0,0]]}]),material);mesh.position.set(x,3,4);mesh.rotation.z=Math.PI/2;mesh.scale.set(2,1,1);root.add(mesh);}mergeBoulevard(root);
 assert.equal(root.children.length,1);const g=root.children[0].geometry,key=(a,i)=>[a.getX(i),a.getY(i),a.getZ(i)].map(n=>n.toFixed(5)).join(','),p=g.attributes.position,q=g.attributes.otherPosition;
 const positions=new Set(Array.from({length:p.count},(_,i)=>key(p,i))),endpoints=new Set(Array.from({length:q.count},(_,i)=>key(q,i)));assert.deepEqual(endpoints,positions);assert.equal(positions.size,4);assert(positions.has('2.00000,5.00000,4.00000'));assert(!g.attributes.barycentric);
});

test('lens diffusion restores renderer state after capture failure and releases all its bounded targets',async()=>{
 const{createBoulevardGlow}=await server.ssrLoadModule('/src/boulevard-glow.ts'),glow=createBoulevardGlow(),initial=new T.WebGLRenderTarget(200,300);let target=initial,test=true;const viewport=new T.Vector4(3,4,111,222),scissor=new T.Vector4(7,8,99,100);
 const renderer={getDrawingBufferSize:v=>v.set(400,800),getRenderTarget:()=>target,getScissorTest:()=>test,getViewport:v=>v.copy(viewport),getScissor:v=>v.copy(scissor),setScissorTest:v=>{test=v;},setRenderTarget:v=>{target=v;viewport.set(0,0,v?.width??400,v?.height??800);},setViewport:v=>viewport.copy(v),setScissor:v=>scissor.copy(v),render:()=>{throw Error('capture failed');}};
 assert.throws(()=>glow.present(renderer,new T.Scene(),new T.Camera()),/capture failed/);assert.equal(target,initial);assert(test);assert.deepEqual(viewport.toArray(),[3,4,111,222]);assert.deepEqual(scissor.toArray(),[7,8,99,100]);assert.deepEqual(glow.targets.map(t=>[t.width,t.height]),[[400,800],[200,400],[200,400]]);
 let released=0;for(const t of glow.targets)t.addEventListener('dispose',()=>released++);glow.dispose();assert.equal(released,3);initial.dispose();
});
