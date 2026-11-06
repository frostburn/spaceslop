import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';
const server=await createServer({root:new URL('..',import.meta.url).pathname,configFile:false,server:{middlewareMode:true,hmr:false,ws:false},optimizeDeps:{noDiscovery:true,entries:[]},appType:'custom'});
after(()=>server.close());
const layout=await server.ssrLoadModule('/src/io-layout.ts');
const {Flight,STEP,BOSS_PROJECTION}=await server.ssrLoadModule('/src/game.ts');
const {createCaldera,createSkipper}=await server.ssrLoadModule('/src/io-rigs.ts');
const {createIoScenery}=await server.ssrLoadModule('/src/io-scenery.ts');
const {readLevel}=await server.ssrLoadModule('/src/levels.ts');

test('Io is a ten-screen 100-second route with eighteen Skipper waves, repeat accessories and a quiet eight-second approach',()=>{
 assert.equal(readLevel('io'),'io');assert.equal(layout.IO_DURATION,100);assert.equal(layout.ioWaves.length,18);
 const f=new Flight('sentry',[],'vex','io'),drops=new Set();let maximum=0;
 for(let i=0;i<6002;i++){f.invulnerable=100;f.step(STEP);for(const e of f.enemies){assert(e.skipper);if(e.drop)drops.add(e.drop);}maximum=Math.max(maximum,f.enemies.length);}
 assert.equal(drops.size,4);assert(maximum<=layout.IO_SKIPPER_POOL);assert.equal(f.phase,'approach');
 assert.equal(f.transitionDuration,8);assert.equal(f.enemies.length+f.shots.length+f.threats.length,0);
 while(f.phase==='approach'){assert.equal(f.threats.length+f.shots.length,0);f.step(STEP);}assert.equal(f.phase,'boss');assert.equal(f.bossHealth,72);
});

test('world travel coasts to rest without a velocity discontinuity and all anchored scenery retains world distances',()=>{
 const {ioScroll,ioWorld,IO_DURATION:d,IO_APPROACH:a}=layout,h=1e-4;
 assert(Math.abs((ioScroll(d)-ioScroll(d-h))/h-1.6)<1e-5);
 assert(Math.abs((ioScroll(d+h)-ioScroll(d))/h-1.6)<2e-5);
 assert(Math.abs((ioScroll(d+a)-ioScroll(d+a-h))/h)<2e-5);
 assert.equal(ioScroll(200),layout.IO_FINAL_SCROLL);
 for(let i=0;i<=100;i++){
  const rise=i/100,p=ioWorld(48,-2,layout.IO_DURATION+layout.IO_APPROACH*rise,rise),q=ioWorld(52,3,layout.IO_DURATION+layout.IO_APPROACH*rise,rise);
  assert(Math.abs(Math.hypot(p.x-q.x,p.y-q.y,p.z-q.z)-Math.sqrt(41))<1e-10);
 }
 const below=ioWorld(layout.IO_FINAL_SCROLL,-3,layout.IO_DURATION+layout.IO_APPROACH,1);assert(below.z<0);
});

test('support absorbs exactly 20 damage before one failure, reveals the core, and collapse remains frozen at results',()=>{
 const f=new Flight('sentry',[],'vex','io');f.phase='boss';
 f.damageBoss(19);assert(!f.ioLegBroken);assert.equal(f.exposedCannonX,-2.4);
 f.damageBoss(10,true);assert(f.ioLegBroken);assert.equal(f.bossHealth,52);assert.equal(f.bossLaserDamage,1);assert.equal(f.ioCollapse,0);
 f.invulnerable=100;f.cooldown=f.droneCooldown=100;for(let i=0;i<73;i++)f.step(STEP);
 assert.equal(f.ioCollapse,1);assert(Math.abs(f.exposedCannonX)<.1);assert(f.bossAimY<4);
 f.damageBoss(100);assert.equal(f.phase,'won');assert.equal(f.score,1000);const collapse=f.ioCollapse;f.step(100);assert.equal(f.ioCollapse,collapse);
});

test('ship, sentry, homing, cannon, omega, laser, Towline and Pulse all damage the correct support target',()=>{
 for(const kind of ['ship','drone','homing','cannon','omega']){
  const f=new Flight('sentry',[],'vex','io');f.phase='boss';f.cooldown=f.droneCooldown=100;
  f.shots=[{x:f.exposedCannonX,y:f.bossAimY,z:-11.9,vx:0,vy:0,vz:-12,damage:1,targetsBoss:kind==='ship',bossSupport:true,drone:kind==='drone',wing:['homing','cannon','omega'].includes(kind)?kind:undefined}];
  f.step(STEP);assert.equal(f.bossHealth,71,kind);
 }
 const laser=new Flight('sentry',['laser'],'vex','io');laser.phase='boss';laser.cooldown=laser.droneCooldown=100;
 laser.player.x=laser.exposedCannonX*BOSS_PROJECTION+1.22;laser.step(STEP);assert(laser.bossHealth<72);assert(laser.bossLaserDamage>0);
 const tow=new Flight('towline',[],'vex','io');tow.phase='boss';tow.cooldown=100;tow.droneCooldown=0;tow.player={x:-3,y:tow.bossAimY*BOSS_PROJECTION};tow.drone={x:3,y:tow.player.y};
 tow.step(STEP);assert.equal(tow.bossHealth,70);
 for(let i=0;i<5;i++)tow.step(STEP);assert.equal(tow.bossHealth,70,'same Towline pulse cannot repeat damage');
 const pulse=new Flight('sentry',[],'vex','io');pulse.phase='boss';pulse.charges=5;
 for(let i=0;i<4;i++)pulse.pulse();assert.equal(pulse.bossHealth,52);assert(pulse.ioLegBroken);pulse.pulse();assert.equal(pulse.bossHealth,46);
});

test('Caldera warnings lock before rotating wheel shots fire and the broken support changes attack spacing',()=>{
 const patterns=[];
 for(const broken of [false,true]){
  const f=new Flight('sentry',[],'vex','io');f.phase='boss';f.cooldown=f.droneCooldown=100;f.invulnerable=100;
  if(broken)f.damageBoss(20);
  for(let i=0;i<55;i++)f.step(STEP);assert.equal(f.markers.length,3);const locked=f.markers.map(p=>({...p}));
  f.player.x=3;for(let i=0;i<45;i++)f.step(STEP);assert.deepEqual(f.markers,locked);assert.equal(f.threats.length,3);
  patterns.push(locked.map(p=>p.y));assert(f.threats.every(t=>t.vz>0&&Number.isFinite(t.vx+t.vy)));
 }
 assert.notDeepEqual(...patterns);
});

test('rig weakpoint anchors and rotor phase agree with combat through the complete support collapse',()=>{
 const rig=createCaldera(),world=new T.Group();world.add(rig.root);
 rig.root.position.set(0,layout.IO_BOSS_Y,layout.IO_BOSS_Z);rig.root.rotation.x=Math.PI/2;
 world.rotation.x=-layout.IO_PITCH;const origin=layout.ioWorld(0,0,layout.IO_DURATION+layout.IO_APPROACH,1);world.position.set(0,origin.y,origin.z);
 const point=new T.Vector3();
 for(let i=0;i<=20;i++){
  const collapse=i/20,broken=i>0;rig.pose(31,collapse,broken);world.updateMatrixWorld(true);
  const anchor=rig.root.getObjectByName(broken?'laser_contact_R':'laser_contact_L');anchor.getWorldPosition(point);
  const expected=layout.calderaContact(collapse,broken);assert(point.distanceTo(new T.Vector3(expected.x,expected.y,expected.z))<1e-8);
  const wheel=rig.root.getObjectByName('dredging-wheel');assert.equal(wheel.rotation.z,31*.55+collapse*.7);
 }
});

test('the landscape has real relief and a separate lake/crust, and all six foot shelves share the same frame',async()=>{
 const scene=createIoScenery();
 const land=scene.root.getObjectByName('io-heightfield');
 let min=Infinity,max=-Infinity;for(const chunk of land.children){const positions=chunk.geometry.attributes.position;for(let i=0;i<positions.count;i++){min=Math.min(min,positions.getZ(i));max=Math.max(max,positions.getZ(i));}}
 assert(max-min>4);assert.equal(scene.root.getObjectByName('caldera-lava-lake').position.z,-6.85);
 assert(scene.root.getObjectByName('broken-lava-crust').geometry.attributes.position.count>1000);
 assert(scene.root.getObjectByName('caldera-rock-volumes').isInstancedMesh);
 scene.update(layout.IO_DURATION+layout.IO_APPROACH,1);scene.root.updateMatrixWorld(true);const feet=[];
 scene.boss.root.traverse(o=>{if(o.name==='caldera-foot')feet.push(o);});assert.equal(feet.length,6);
 const before=feet.map(o=>o.getWorldPosition(new T.Vector3()).toArray());scene.boss.pose(40,1,true);scene.root.updateMatrixWorld(true);
 assert.deepEqual(feet.map(o=>o.getWorldPosition(new T.Vector3()).toArray()),before,'support collapse must not slide ground anchors');
 const geometry=new Set();scene.root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);});
 for(let i=0;i<10;i++){scene.update(layout.IO_DURATION+i*.8,i/10);scene.boss.pose(i,i/10,true);}
 const after=new Set();scene.root.traverse(o=>{if(o.geometry)after.add(o.geometry);});assert.deepEqual(after,geometry);
});

test('Skippers share GPU geometry, and their arcing formations clear the route before the approach',()=>{
 const a=createSkipper(),b=createSkipper(),ga=[],gb=[];a.root.traverse(o=>{if(o.geometry)ga.push(o.geometry);});b.root.traverse(o=>{if(o.geometry)gb.push(o.geometry);});
 ga.forEach((g,i)=>assert.equal(g,gb[i]));
 for(const wave of layout.ioWaves)for(const[lane,slot]of wave.lanes.map((l,i)=>[l,i])){
  const end=layout.skipperMotion(layout.IO_DURATION-wave.time,lane,slot);assert(end.y<-9);
  for(let t=0;t<6;t+=1/60){const p=layout.skipperMotion(t,lane,slot);assert(Number.isFinite(p.x+p.y+p.heading+p.jet));assert(Math.abs(p.x)<3.5);}
 }
});

test('a media-free simulation reaches the boss, visibly breaks its support, wins, and can restart cleanly',()=>{
 const f=new Flight('sentry',[],'vex','io');let sawSupport=false;
 for(let i=0;i<12000&&!['won','lost'].includes(f.phase);i++){f.invulnerable=100;f.step(STEP);sawSupport ||= f.ioLegBroken;}
 assert.equal(f.phase,'won');assert(sawSupport);assert(f.score>=1000);
 const again=new Flight('sentry',[],'vex','io');assert.equal(again.bossHealth,72);assert(!again.ioLegBroken);assert.equal(again.time,0);
});

test('ship shots already committed to the failed support cannot damage the newly exposed core',()=>{
 const f=new Flight('sentry',[],'vex','io');f.phase='boss';f.cooldown=f.droneCooldown=100;
 f.fire(f.player);assert.equal(f.shots[0].bossSupport,true);f.damageBoss(20);assert.equal(f.bossHealth,52);
 for(let i=0;i<30;i++)f.step(STEP);assert.equal(f.bossHealth,52);
 f.fire(f.player);assert.equal(f.shots[0].bossSupport,false);for(let i=0;i<30;i++)f.step(STEP);assert(f.bossHealth<52);
});

test('Io dust remains finite, camera-facing and pooled throughout the route and camera approach',()=>{
 const scene=createIoScenery(),dust=scene.root.getObjectByName('ballistic-vent-plumes');
 assert(dust.isInstancedMesh);assert(!dust.castShadow);assert(!dust.material.depthWrite);
 const matrices=dust.instanceMatrix.array,opacity=dust.geometry.attributes.opacity,mask=dust.material.uniforms.map.value;
 assert(mask.isDataTexture);assert(mask.generateMipmaps);
 for(let t=0;t<=90;t+=.7){
  scene.update(t,Math.min(1,t/(layout.IO_DURATION+layout.IO_APPROACH)));
  assert.equal(dust.instanceMatrix.array,matrices);assert.equal(dust.geometry.attributes.opacity,opacity);
  assert(matrices.every(Number.isFinite));assert(opacity.array.every(a=>Number.isFinite(a)&&a>=0&&a<=.43));
 }
 scene.update(12.3,1);const frozen=Array.from(matrices);scene.update(12.3,1);assert.deepEqual(Array.from(matrices),frozen);
 scene.update(13.3,1);assert.notDeepEqual(Array.from(matrices),frozen,'time must animate the pooled plumes');
});

test('reviewed surfaces propagate to every Io terrain and painted material, while fallback lighting stays finite',async()=>{
 const m=await server.ssrLoadModule('/src/io-materials.ts');
 const hdr=m.ioEnvironment.image.data;assert(hdr.every(h=>Number.isFinite(T.DataUtils.fromHalfFloat(h))));
 const scene=createIoScenery(),sun=scene.world.children.find(o=>o.isDirectionalLight);
 assert(sun.castShadow);assert(sun.shadow.mapSize.x>=1024);assert(scene.root.getObjectByName('io-basalt-scree').count>300);
 const heat=scene.root.getObjectByName('broken-lava-crust').geometry.attributes.temperature.array;
 assert(heat.every(t=>t>=0&&t<=1));assert(heat.some(t=>t>.1));assert(heat.some(t=>t===0));
 const rock=new T.Texture(),paint=new T.Texture();m.setIoRockTexture(rock);m.setIoCeramicTexture(paint);
 for(const material of [m.ioGround,m.ioRock,m.ioCrust]){assert.equal(material.map,rock);assert.equal(material.bumpMap,rock);}
 for(const material of [m.ioCeramic,m.ioBand,m.ioSilo,m.ioSiloBand]){assert.equal(material.map,paint);assert.equal(material.bumpMap,paint);}
 for(const rise of [0,.3,.7,1]){m.poseIoEnvironment(rise);assert(Number.isFinite(m.ioChrome.envMapRotation.x));}
});

test('shadow texel phase stays fixed to terrain during scrolling and the entire camera rotation',()=>{
 const scene=createIoScenery(),sun=scene.world.children.find(o=>o.isDirectionalLight),plane=new T.Group();plane.add(scene.root);
 const point=new T.Vector3(),reference=[];
 for(let i=0;i<=(layout.IO_DURATION+layout.IO_APPROACH)*10;i++){
  const time=i/10,rise=layout.smooth01((time-layout.IO_DURATION)/layout.IO_APPROACH);plane.rotation.x=(rise-1)*Math.PI/2;
  scene.update(time,rise);plane.updateMatrixWorld(true);sun.shadow.updateMatrices(sun);
  const phase=[];
  for(const [x,y,z] of [[1,14,-3],[-3,27,0],[6,51,-2]]){
   point.set(x,y,z);scene.world.localToWorld(point);point.project(sun.shadow.camera);
   phase.push((point.x+1)*sun.shadow.mapSize.x/2,(point.y+1)*sun.shadow.mapSize.y/2);
  }
  if(!i)reference.push(...phase);
  else phase.forEach((v,j)=>assert(Math.abs(v-reference[j]-Math.round(v-reference[j]))<1e-7,'terrain slides between light texels'));
 }
});

test('production terrain chunks meet with identical heights and normals across the full ten screens',()=>{
 const scene=createIoScenery(),chunks=scene.root.getObjectByName('io-heightfield').children,edges=new Map();let shared=0;
 assert(chunks.length>=10);
 for(const chunk of chunks){
  chunk.geometry.computeBoundingBox();const p=chunk.geometry.attributes.position,n=chunk.geometry.attributes.normal;
  for(let i=0;i<p.count;i++){
   assert(Number.isFinite(p.getZ(i)));
   if(Math.abs(p.getY(i)-chunk.geometry.boundingBox.min.y)<1e-5||Math.abs(p.getY(i)-chunk.geometry.boundingBox.max.y)<1e-5){
    const key=`${p.getX(i)},${p.getY(i)}`,value=[p.getZ(i),n.getX(i),n.getY(i),n.getZ(i)];
    if(edges.has(key)){assert.deepEqual(value,edges.get(key));shared++;}else edges.set(key,value);
   }
  }
 }
 assert(shared>1500);
 const g=chunks[1].geometry,p=g.attributes.position,firstY=p.getY(0);let columns=0;while(columns<p.count&&p.getY(columns)===firstY)columns++;
 assert(new Set(Array.from({length:columns},(_,i)=>p.getY(columns+i))).size>10,'interior terrain rows must not form a square lattice');
 assert(scene.root.getObjectByName('io-bank-talus').count>400);

 assert(layout.ioGroundHeight(0,layout.IO_BREACH_Y)<-7,'molten breach must cut into the terrain');
 assert(layout.ioGroundHeight(0,layout.IO_APRON_Y)<-7,'rim spill must be revealed ahead of the boss basin');
});

test('conveyors, ore, burners, smoke and lava animate from the same pausable clock without allocating geometry',async()=>{
 const {createIoIndustry,ioSites}=await server.ssrLoadModule('/src/io-industry.ts');
 const industry=createIoIndustry(),scene=createIoScenery(),ore=industry.root.getObjectByName('conveyor-ore');
 const belts=[];industry.root.traverse(o=>{if(o.name==='moving-conveyor-belt')belts.push(o);});
 assert(belts.length>=7);assert(ioSites.filter(s=>s[1]>=90&&s[1]<150).length>=10);assert(industry.burners.length>=20);
 const arrays=ore.instanceMatrix.array,initial=Array.from(arrays),map=belts[0].material.map;
 industry.update(1.25);assert.equal(ore.instanceMatrix.array,arrays);assert.notDeepEqual(Array.from(arrays),initial);assert(map.offset.y<0);
 const moving=Array.from(arrays),offset=map.offset.y;industry.update(1.25);assert.deepEqual(Array.from(arrays),moving);assert.equal(map.offset.y,offset);
 const smoke=scene.root.getObjectByName('ballistic-vent-plumes'),jets=scene.root.getObjectByName('io-burner-jets'),lava=scene.root.getObjectByName('molten-refinery-breach');
 const geometry=new Set();scene.root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);});
 for(let t=0;t<=108;t+=.6){scene.update(t,layout.smooth01((t-100)/8));assert.equal(jets.material.uniforms.clock.value,t);assert.equal(lava.material.uniforms.clock.value,t);}
 const after=new Set();scene.root.traverse(o=>{if(o.geometry)after.add(o.geometry);});assert.deepEqual(after,geometry);
 assert.equal(lava.material.uniforms.thermal.value.magFilter,T.LinearFilter);
 scene.prime(true);scene.prime(false);assert(!smoke.frustumCulled);assert(!jets.frustumCulled);assert(!scene.root.getObjectByName('conveyor-ore').frustumCulled);
});

test('straight perspective flight keeps a fixed stage heading and angle, then joins the boss frame smoothly',()=>{
 const scene=createIoScenery(),point=new T.Vector3(),pitches=[],banks=[],path=[];
 const rise=t=>layout.smooth01((t-layout.IO_DURATION)/layout.IO_APPROACH);
 for(let time=0;time<=108;time+=.5){
  const f=layout.ioFrame(time,rise(time));pitches.push(f.pitch);banks.push(f.bank);path.push(layout.ioChannel(f.scroll));
  scene.update(time,rise(time));scene.root.updateMatrixWorld(true);
  point.set(-2,126,3);scene.world.localToWorld(point);
  const expected=layout.ioWorld(126,3,time,rise(time),-2);
  assert(point.distanceTo(new T.Vector3(expected.x,expected.y,expected.z))<1e-8,'render and authored world must use the same complete 3D frame');
 }
 assert(Math.max(...path)-Math.min(...path)>4);assert(banks.every(b=>b===0));
 for(let t=0;t<=100;t+=.1){const f=layout.ioFrame(t,0);assert.equal(f.pitch,28*Math.PI/180);assert.equal(f.trackX,0);assert.equal(f.bank,0);assert.equal(f.height,layout.IO_STAGE_HEIGHT);}

 assert(Math.max(...pitches)-Math.min(...pitches)>.4);
 const sample=t=>{const p=layout.ioWorld(160,0,t,rise(t),3);return new T.Vector3(p.x,p.y,p.z);},h=1e-4;
 for(const boundary of [100,108]){
  const center=sample(boundary),before=center.clone().sub(sample(boundary-h)).divideScalar(h),after=sample(boundary+h).sub(center).divideScalar(h);
  assert(before.distanceTo(after)<.002,'camera velocity must not jump at stage/approach/boss boundaries');
 }
 const final=layout.ioFrame(108,1);assert.equal(final.pitch,layout.IO_PITCH);assert.equal(final.bank,0);assert.equal(final.trackX,0);assert.equal(final.height,layout.IO_HEIGHT);
});

test('conveyor loads are rough yellow sulfur and burner ribbons keep their registered roots and shared clock',async()=>{
 const {createIoIndustry}=await server.ssrLoadModule('/src/io-industry.ts'),{createIoBurnerFlames}=await server.ssrLoadModule('/src/io-flames.ts');
 const industry=createIoIndustry(),ore=industry.root.getObjectByName('conveyor-ore');
 assert(ore.material.color.r>.8&&ore.material.color.g>.5&&ore.material.color.b<.1);assert(ore.material.roughness>.8);assert(ore.instanceColor);
 const flame=createIoBurnerFlames(industry.burners),jets=flame.root.getObjectByName('io-burner-jets'),cores=flame.root.getObjectByName('io-burner-cores'),matrix=new T.Matrix4(),p=new T.Vector3();
 assert.equal(jets.count,industry.burners.length);assert.equal(jets.geometry.type,'PlaneGeometry');assert(!jets.geometry.attributes.sheet);assert.equal(cores.geometry.type,'PlaneGeometry');assert(!jets.frustumCulled);assert(!cores.material.depthWrite);
 for(let i=0;i<jets.count;i++){jets.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix);assert(p.distanceTo(industry.burners[i])<1e-4);}
 const map=jets.material.uniforms.turbulence.value,data=map.image.data;assert(map.generateMipmaps);assert.equal(map.magFilter,T.LinearFilter);
 flame.update(4.25);assert.equal(jets.material.uniforms.clock.value,4.25);assert.equal(cores.material.uniforms.clock,jets.material.uniforms.clock);assert.equal(map.image.data,data);
});

test('conveyor loading and receiving ports conceal loop resets, and sulfur drops into the receiving bin',async()=>{
 const {createIoIndustry}=await server.ssrLoadModule('/src/io-industry.ts'),industry=createIoIndustry(),ore=industry.root.getObjectByName('conveyor-ore'),matrix=new T.Matrix4(),p=new T.Vector3(),port=new T.Vector3();
 industry.root.updateMatrixWorld(true);
 for(const [i,belt]of industry.belts.entries()){
  for(const [root,name,endpoint]of [[belt.source,'loading-port',belt.a],[belt.sink,'receiving-port',belt.b]]){
   root.getObjectByName(name).getWorldPosition(port);assert(port.distanceTo(endpoint.clone().addScaledVector(belt.up,.14))<1e-6);
   for(const side of [-.6,0,.6]){
    const origin=new T.Vector3(side,-.65,2).applyQuaternion(belt.q).add(port),direction=port.clone().sub(origin),distance=direction.length();
    const ray=new T.Raycaster(origin,direction.normalize(),0,distance),hits=ray.intersectObject(root,true);
    assert(hits.some(h=>h.distance<distance-.1),'sulfur reset must be covered by opaque transfer machinery');
   }
  }
  industry.update(0);ore.getMatrixAt(i*6,matrix);p.setFromMatrixPosition(matrix);belt.source.getObjectByName('loading-port').getWorldPosition(port);assert(p.distanceTo(port)<1e-4);
  industry.update((belt.length+.5)/.8);ore.getMatrixAt(i*6,matrix);p.setFromMatrixPosition(matrix);belt.sink.getObjectByName('receiving-port').getWorldPosition(port);
  assert(Math.abs(p.x-port.x)<1e-4&&Math.abs(p.y-port.y)<1e-4);assert(p.z<port.z-.7,'end-of-belt loads must descend into the covered bin');
 }
});

test('painted silo bands share one tapered shell without overlapping wall surfaces',async()=>{
 const {ioSiloWall}=await server.ssrLoadModule('/src/io-silo.ts');
 for(const radius of [.48,.83,1.13]){
  const h=2.8,base=.6,wall=ioSiloWall(radius,h,base,.3,Math.PI*2),meshes=wall.map(p=>new T.Mesh(p.geometry,new T.MeshBasicMaterial()));
  for(const z of [base+.15,base+h*.53,base+h-.15])for(const angle of [.1,.7,1.5,3.5]){
   const origin=new T.Vector3(Math.cos(angle)*(radius+2),Math.sin(angle)*(radius+2),z),direction=new T.Vector3(-Math.cos(angle),-Math.sin(angle),0),ray=new T.Raycaster(origin,direction);
   const hits=ray.intersectObjects(meshes),distances=[];
   for(const hit of hits)if(!distances.some(d=>Math.abs(d-hit.distance)<1e-6))distances.push(hit.distance);
   assert.equal(distances.length,1,'only one outward-facing wall may occupy a radial ray at any paint height');
  }
 }
});


test('burner side fade is restricted to near-overhead views and the workshop shares the stage renderer',async()=>{
 const {ioFlameTopWeight}=await server.ssrLoadModule('/src/io-flames.ts'),{createIoBurnerStudy}=await server.ssrLoadModule('/src/io-burner.ts');
 assert.equal(ioFlameTopWeight(0),0);assert.equal(ioFlameTopWeight(.9),0);assert.equal(ioFlameTopWeight(.99),1);assert.equal(ioFlameTopWeight(1),1);
 assert(Math.abs(ioFlameTopWeight(.945)-.5)<1e-12);
 let previous=0;for(let i=0;i<=100;i++){const w=ioFlameTopWeight(i/100);assert(w>=previous&&w>=0&&w<=1);previous=w;}
 const rig=createIoBurnerStudy(),side=rig.root.getObjectByName('io-burner-jets'),top=rig.root.getObjectByName('io-burner-cores');
 assert.equal(side.count,1);assert.equal(side.material.uniforms.lowerHalf.value,0);assert.equal(top.material.uniforms.lowerHalf.value,1);assert.equal(side.material.vertexShader,top.material.vertexShader);assert.equal(side.material.fragmentShader,top.material.fragmentShader);rig.pose(2.5);assert.equal(side.material.uniforms.clock.value,2.5);assert.equal(top.material.uniforms.clock,side.material.uniforms.clock);
 assert.equal(top.material.uniforms.turbulence.value,side.material.uniforms.turbulence.value);
});

test('conveyor service corridors clear every vessel cluster and retain connected terminal ports',async()=>{
 const {ioConveyorClearance,ioSiteX}=await server.ssrLoadModule('/src/io-placement.ts');
 const {createIoIndustry,ioSites}=await server.ssrLoadModule('/src/io-industry.ts');
 const industry=createIoIndustry(),sites=industry.root.children.filter(c=>c.name.startsWith('io-site-'));
 let relocated=0;
 for(let i=0;i<ioSites.length;i++){
  const [sx,y,kind]=ioSites[i],site=sites[i],side=Math.sign(sx),x=ioSiteX(sx,y,kind);
  assert.equal(site.position.x,x);assert.equal(site.position.y,y);assert.equal(site.position.z,layout.ioGroundHeight(x,y));
  assert(!ioConveyorClearance(x+(kind==='pump'?0:side*.6),y+.6,kind==='pump'?1.1:2.5,kind==='pump'?1.8:3.4));
  const original=sx-side*.55+layout.ioChannel(y);assert((x-original)*side>=0);if(Math.abs(x-original)>.01)relocated++;
 }
 assert.equal(relocated,0,'authored transfer yards must fit without displacing the vessel clusters');
 for(const belt of industry.belts){
  assert(ioConveyorClearance(belt.a.x,belt.a.y));assert(ioConveyorClearance(belt.b.x,belt.b.y));
  assert(belt.source.position.distanceTo(belt.a)<1e-6);assert(belt.sink.position.distanceTo(belt.b)<1e-6);
 }
});
