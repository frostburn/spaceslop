import assert from 'node:assert/strict';import{test,after}from'node:test';import * as T from 'three';import{createServer}from'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});after(()=>server.close());
const{createBoulevardScenery}=await server.ssrLoadModule('/src/boulevard-scenery.ts'),weather=await server.ssrLoadModule('/src/boulevard-weather.ts'),{BOULEVARD_DECK}=await server.ssrLoadModule('/src/boulevard.ts');

test('road depressions hold level water below actual drainage points and remain continuous through pursuit recycling',()=>{
 const scene=createBoulevardScenery(),{road}=scene;assert(road.sites.length>=10&&road.sites.length<32);let wet=0,dry=0;
 for(let y=0;y<84;y+=.4)for(let x=-3.5;x<3.5;x+=.3){const h=road.field.sample(x,y);assert(h>=-.04&&h<.06);if(h<weather.ROAD_WATER)wet++;else dry++;assert(Math.abs(h-road.field.sample(x,y+84))<1e-12);}
 assert(wet>50&&dry>wet*3);for(const site of road.sites){assert(road.field.sample(site.x,site.y)<weather.ROAD_WATER-.015);assert(site.z>BOULEVARD_DECK+.4);}
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


test('palm crowns clear nearby roofs and their trunks remain on the promenade',()=>{
 const scene=createBoulevardScenery(),matrix=new T.Matrix4(),point=new T.Vector3(),scale=new T.Vector3(),q=new T.Quaternion();
 for(const chunk of scene.chunks){
  const buildings=chunk.getObjectByName('boulevard-masonry');let roof=-Infinity;
  buildings.geometry.computeBoundingBox();for(let i=0;i<buildings.count;i++){buildings.getMatrixAt(i,matrix);roof=Math.max(roof,buildings.geometry.boundingBox.clone().applyMatrix4(matrix).max.z);}
  for(const name of['boulevard-organic-palms','boulevard-wire-palms']){const crowns=chunk.getObjectByName(name);for(let i=0;i<crowns.count;i++){crowns.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);assert(point.z-.5>roof+.35,'crown intersects neighboring building');}}
  const trunks=chunk.getObjectByName('boulevard-palm-trunks');for(let i=0;i<trunks.count;i++){trunks.getMatrixAt(i,matrix);matrix.decompose(point,q,scale);assert(Math.abs(point.x)-scale.x>3.6&&Math.abs(point.x)+scale.x<4.05,'trunk is inside a roof or the road');}
 }scene.dispose();
});

test('mountains remain behind the pursuit city and back faces hide scenery while leaving interiors open',()=>{
 const scene=createBoulevardScenery();scene.horizon.geometry.computeBoundingBox();
 for(const time of[100,107,180,300]){scene.update(time,1,time);const near=scene.horizon.position.y+scene.horizon.geometry.boundingBox.min.y*scene.horizon.scale.y;assert(near>Math.max(...scene.chunks.map(c=>c.position.y+14))+20);}
 const shell=new T.Mesh(new T.BoxGeometry(1,1,1),scene.materials.backFaces);shell.updateMatrixWorld(true);
 const ray=new T.Raycaster(new T.Vector3(0,-3,0),new T.Vector3(0,1,0)),hit=ray.intersectObject(shell)[0];assert(hit&&Math.abs(hit.distance-3.5)<1e-9,'rear surface should sit behind internal machinery');assert(scene.materials.backFaces.depthWrite&&!scene.materials.backFaces.transparent);scene.dispose();
});

test('friendly light gain applies once to session-owned emitters and leaves paint and other actors unchanged',async()=>{
 const{boostFriendlyGlow}=await server.ssrLoadModule('/src/rendering/friendly-glow.ts'),{createFighterRig,createScoutRig}=await server.ssrLoadModule('/src/ship-rigs.ts');
 const ship=createFighterRig(),other=createFighterRig(),enemy=createScoutRig(),rootColors=root=>{const colors=[];root.traverse(o=>{if(o.isMesh&&o.material.color)colors.push(o.material.color.toArray());});return colors;};
 const otherBefore=rootColors(other.root),enemyBefore=rootColors(enemy);let led,paint,jet;ship.root.traverse(o=>{if(o.isMesh){if(o.material.isMeshBasicMaterial)led??=o.material;if(o.material.isMeshStandardMaterial)paint??=o.material;if(o.material.isShaderMaterial)jet??=o.material;}});
 const lightBefore=led.color.clone(),paintBefore=paint.color.clone();boostFriendlyGlow([ship.root,ship.root],2.5);assert(led.color.equals(lightBefore.multiplyScalar(2.5)));assert(paint.color.equals(paintBefore));assert.equal((jet.fragmentShader.match(/gl_FragColor.rgb \*=/g)||[]).length,1);assert.deepEqual(rootColors(other.root),otherBefore);assert.deepEqual(rootColors(enemy),enemyBefore);
});

test('venue windows reveal recessed modeled rooms behind structural columns',async()=>{
 const{addBoulevardVenue}=await server.ssrLoadModule('/src/boulevard-venues.ts'),{boulevardBatch}=await server.ssrLoadModule('/src/boulevard-geometry.ts');
 const parts=Object.fromEntries(['solid','metal','pink','cyan','warm','round','marquee','water','windows','rooms','columns'].map(k=>[k,[]]));
 addBoulevardVenue(parts,0,0,1,6,0,3,3,2,0);
 const group=new T.Group(),box=new T.BoxGeometry(1,1,1),m=new T.MeshBasicMaterial();for(const name of['solid','rooms'])group.add(boulevardBatch(name,box,m,parts[name]));group.updateMatrixWorld(true);
 const ray=x=>new T.Raycaster(new T.Vector3(x,-3.5,.5),new T.Vector3(0,1,0)).intersectObject(group)[0];
 assert(ray(6).distance>2.55,'window should look into a recessed room');assert(ray(5.545).distance<2.2,'load-bearing jamb must stand in front of the interior');assert(parts.windows.every(p=>Math.min(p.sx,p.sy,p.sz)>.02));
});

test('fountain stays below combat, diverts ground cars and freezes its existing spray buffer',()=>{
 const s=createBoulevardScenery(),f=s.fountain,matrices=f.drops.instanceMatrix.array;
 assert(new T.Box3().setFromObject(f.root).max.z<-.8,'fountain intrudes into flight plane');
 s.prime(true);s.prime(false);assert.equal(f.drops.frustumCulled,false);
 for(let time=30;time<46;time+=.1){s.update(time,0,time);for(const c of s.traffic)assert(Math.hypot(c.root.position.x,c.root.position.y-f.root.position.y)>1.8,'ground car intersects fountain basin');}
 s.update(37,0,37);const frozen=matrices.slice();s.update(37,0,37);assert.equal(matrices,f.drops.instanceMatrix.array);assert.deepEqual(matrices,frozen);s.update(37,0,37.2);assert.notDeepEqual(matrices,frozen);
 const widths=new Set();for(const chunk of s.chunks){assert(!chunk.getObjectByName('boulevard-facade-cards'));const rooms=chunk.getObjectByName('boulevard-room-interiors');assert(rooms?.count>0);const masonry=chunk.getObjectByName('boulevard-masonry'),m=new T.Matrix4();for(let i=0;i<masonry.count;i++){masonry.getMatrixAt(i,m);widths.add(m.elements[0].toFixed(2));}}assert(widths.size>50,'buildings repeat identical footprints');s.dispose();
});

test('cruiser hover remains gentle and laser contact follows its posed cyan core',async()=>{
 const{createPursuitCruiser}=await server.ssrLoadModule('/src/boulevard-rigs.ts'),{createBossLaserContact}=await server.ssrLoadModule('/src/laser-contact.ts'),{BOULEVARD_PITCH,boulevardBossPoint}=await server.ssrLoadModule('/src/boulevard.ts');
 const s=createBoulevardScenery(),rig=createPursuitCruiser(s.materials),plane=new T.Group(),contact=createBossLaserContact(plane,rig.root),p=boulevardBossPoint(107,1);plane.add(rig.root);rig.root.position.set(p.x,p.y,p.z);rig.root.rotation.x=-BOULEVARD_PITCH;
 let spread=0,first;for(let t=0;t<60;t+=.1){rig.pose(t,0,0);plane.updateMatrixWorld(true);const a=rig.root.getObjectByName('laser_contact_C').getWorldPosition(new T.Vector3()),c=contact(0,22).clone();assert(c.distanceTo(new T.Vector2(a.x*22/(22-a.z),a.y*22/(22-a.z)))<1e-9);assert(Math.hypot(c.x,c.y-4.2*22/34)<.35,'hover moves core outside broad combat proxy');first??=c;spread=Math.max(spread,c.distanceTo(first));}
 assert(spread>.05);rig.pose(8,0,0);const body=rig.root.getObjectByName('cruiser-hover-frame');body.updateMatrix();const matrix=body.matrix.clone();rig.pose(8,0,0);body.updateMatrix();assert(body.matrix.equals(matrix));s.dispose();
});
