import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';

const server = await createServer({root: new URL('..', import.meta.url).pathname, configFile: false,
  server: {middlewareMode: true, hmr: false, ws: false}, optimizeDeps: {noDiscovery: true, entries: []}, appType: 'custom'});
after(() => server.close());
const layout = await server.ssrLoadModule('/src/preserve-layout.ts');
const {createPreserveScenery} = await server.ssrLoadModule('/src/preserve-scenery.ts');
const {Flight,STEP}=await server.ssrLoadModule('/src/game.ts');
const {preserveWaves}=await server.ssrLoadModule('/src/preserve-waves.ts');
const {levelTextures} = await server.ssrLoadModule('/src/assets/catalog.ts');
const scenery = createPreserveScenery();

test('orbital preserve has a continuous recessed soil bed with watertight chunk boundaries', () => {
  const chunks = [];
  scenery.root.traverse(o => { if (o.name === 'preserve-soil-chunk') chunks.push(o); });
  assert(chunks.length >= 4);
  const cols = 49, rows = 41;
  for (const [index, chunk] of chunks.entries()) {
    const p = chunk.geometry.attributes.position, n = chunk.geometry.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      assert(Math.abs(p.getZ(i) - layout.preserveGround(p.getX(i), p.getY(i))) < 1e-5);
      assert(p.getZ(i) < -1.5, 'terraces must remain below flight/combat geometry');
      if(Math.abs(p.getX(i))<1.5)assert(p.getZ(i)<-2.7,'the broad central aerial lane stays clear');
      assert(Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < 1e-6);
    }
    if (!index) continue;
    const previous = chunks[index - 1].geometry.attributes;
    for (let col = 0; col < cols; col++) for (const attr of ['position', 'normal']) {
      const a = previous[attr], b = chunk.geometry.attributes[attr];
      for (let axis = 0; axis < 3; axis++) assert.equal(a.array[((rows - 1) * cols + col) * 3 + axis], b.array[col * 3 + axis]);
    }
  }
  assert(layout.preserveGround(0, 12) < layout.preserveGround(3, 12) - .7);
  for (const p of layout.preservePools) {
    assert(layout.preserveGround(p.x,p.y)<p.z-.35);
    for(let a=0;a<Math.PI*2;a+=.2)assert(layout.preserveGround(p.x+Math.cos(a)*p.rx*1.15,p.y+Math.sin(a)*p.ry*1.15)>p.z+.12);
  }
});

test('roots meet terrain, leave the play plane clear and use bounded shared foliage batches', () => {
  assert(scenery.foliage.rootPaths.length > 100);
  for (const path of scenery.foliage.rootPaths) for (const [i, p] of path.entries()) {
    const gap = p.z - layout.preserveGround(p.x, p.y);
    assert(gap >= .044 && gap <= .326);
    if (i === path.length - 1) assert(gap < .05);
  }
  let triangles = 0, batches = 0;
  scenery.root.traverse(o => {
    if (!(o instanceof T.Mesh)) return;
    if(o.material.vertexColors)assert(o.geometry.getAttribute('color'),'vertex-tinted material has no color attribute and renders black');
    for (const a of Object.values(o.geometry.attributes)) assert(a.array.every(Number.isFinite));
    triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
    if (o.isInstancedMesh) {
      assert(o.instanceMatrix.array.every(Number.isFinite));
      assert(o.boundingSphere && Number.isFinite(o.boundingSphere.radius));
      batches++;
    }
    if (o.name === 'fern-crowns') assert(o.geometry === scenery.foliage.root.getObjectByName('fern-crowns').geometry);
  });
  assert(triangles < 1_200_000, `whole preserve + rotunda + boss triangle budget: ${triangles}`);
  assert(batches < 210, `scenery batch budget: ${batches}`);
  assert(!levelTextures.preserve.includes('preserve'), 'the mirrored raster plate must not load');
  const sky = scenery.root.getObjectByName('preserve-distant-stars').geometry.attributes.position;
  for (let i = 0; i < sky.count; i++) assert(sky.getZ(i) < -50, 'stars must stay behind the whole habitat');
});

test('straight travel, actor wakes, pause, restart and approach reuse the same geometry and lighting', () => {
  const fronds = scenery.foliage.root.getObjectByName('fern-crowns'), buffer = fronds.instanceMatrix.array;
  const geometries = [], materials = [];
  scenery.root.traverse(o => { if (o.isMesh) { geometries.push(o.geometry); materials.push(o.material); } });
  const snapshot = () => {
    const g = [], m = [];
    scenery.root.traverse(o => { if (o.isMesh) { g.push(o.geometry); m.push(o.material); } });
    assert.deepEqual(g, geometries); assert.deepEqual(m, materials);
  };
  scenery.update(0, 0, 0, 0, [], true); const initial = Array.from(buffer);
  const crown = scenery.foliage.crowns[0];
  const actor = {x: crown.x * layout.PRESERVE_WIDTH_SCALE + .15,
    y: crown.y * Math.cos(layout.PRESERVE_PITCH) + crown.z * Math.sin(layout.PRESERVE_PITCH), strength: 1};
  scenery.update(0, 0, .4, .4, [actor]); assert.notDeepEqual(Array.from(buffer), initial);
  const frozen = Array.from(buffer);
  scenery.update(0, 0, .4, 0, [actor]); assert.deepEqual(Array.from(buffer), frozen);
  scenery.update(0, 0, 0, 0, [], true); assert.deepEqual(Array.from(buffer), initial);
  for (const [time, exit] of [[0,0],[12,0],[35,0],[50,0],[70,0],[95,0],[100,0],[103,.5],[106,1],[125,1]]) {
    scenery.update(time, exit, time);
    assert.equal(scenery.world.position.x, 0); assert.equal(scenery.world.rotation.z, 0);
    assert(scenery.world.visible, 'do not change the lighting program count at boss contact');
    snapshot();
  }
  scenery.prime(true);
  scenery.root.traverse(o => { if (o.isMesh) assert(!o.frustumCulled); });
  scenery.prime(false);
  scenery.root.traverse(o => { if (o.isMesh) assert(o.frustumCulled); });
});

test('rotunda floor plates have disjoint top faces and real clearance above the base floor',()=>{
 const arena=scenery.arena.root,plates=arena.getObjectByName('rotunda-apron-plates'),floor=arena.getObjectByName('rotunda-base-floor');
 assert(plates&&floor);arena.updateWorldMatrix(true,true);
 const relative=arena.matrixWorld.clone().invert().multiply(plates.matrixWorld),instance=new T.Matrix4(),matrix=new T.Matrix4(),v=new T.Vector3(),polygons=[];
 const positions=plates.geometry.attributes.position;
 for(let i=0;i<plates.count;i++){
  plates.getMatrixAt(i,instance);matrix.multiplyMatrices(relative,instance);const vertices=new Map();
  for(let j=0;j<positions.count;j++){
   v.fromBufferAttribute(positions,j).applyMatrix4(matrix);assert(v.z>floor.position.z+.02,'panel bottom is coplanar with the floor');
   if(positions.getZ(j)<-.001)continue;vertices.set(`${v.x.toFixed(5)},${v.y.toFixed(5)}`,{x:v.x,y:v.y});
  }
  const polygon=[...vertices.values()],center={x:polygon.reduce((s,p)=>s+p.x,0)/polygon.length,y:polygon.reduce((s,p)=>s+p.y,0)/polygon.length};
  polygon.sort((a,b)=>Math.atan2(a.y-center.y,a.x-center.x)-Math.atan2(b.y-center.y,b.x-center.x));polygons.push(polygon);
 }
 const overlaps=(a,b)=>{
  for(const polygon of[a,b])for(let i=0;i<polygon.length;i++){
   const p=polygon[i],q=polygon[(i+1)%polygon.length],nx=q.y-p.y,ny=p.x-q.x;
   const pa=a.map(v=>v.x*nx+v.y*ny),pb=b.map(v=>v.x*nx+v.y*ny);
   if(Math.max(...pa)<Math.min(...pb)+1e-5||Math.max(...pb)<Math.min(...pa)+1e-5)return false;
  }
  return true;
 };
 for(let i=0;i<polygons.length;i++)for(let j=i+1;j<polygons.length;j++)assert(!overlaps(polygons[i],polygons[j]),`floor plates ${i} and ${j} overlap`);
 for(let x=-3.5;x<=3.5;x+=.25)for(let y=layout.PRESERVE_ARENA_Y-13;y<=layout.PRESERVE_END;y+=.25){
  if(Math.hypot(x,(y-layout.PRESERVE_ARENA_Y)/1.1)>layout.PRESERVE_ARENA_RADIUS)continue;
  assert(layout.preserveGround(x,y)<layout.PRESERVE_ARENA_FLOOR-.3,'incoming terrain intersects the arena floor');
 }
});

test('ten-screen route starts in space, enters a genuinely open dock, and has populated habitats through the last patrol',()=>{
 const f=new Flight('sentry',[],'vex','preserve');assert.equal(f.stageDuration,100);
 const projectedTravel=f.stageDuration*layout.PRESERVE_SPEED*Math.cos(layout.PRESERVE_PITCH)*38/(38+4.25);
 assert(projectedTravel/16>8.8&&projectedTravel/16<9.5,'travel plus the initial view should cover about ten screens');
 const ground=scenery.root.getObjectByName('preserve-soil-chunk').geometry.attributes.position;
 assert(ground.getY(0)>=layout.PRESERVE_DOCK_Y,'the space approach has no hidden ground plate');
 scenery.update(0,0);scenery.root.updateMatrixWorld(true);const dock=scenery.dock.root,armor=dock.getObjectByName('dock-armored-structure');
 for(const x of[-2.6,0,2.6])for(const z of[0,.65]){
  const ray=new T.Raycaster(dock.localToWorld(new T.Vector3(x,-4,z)),new T.Vector3(0,1,0).transformDirection(dock.matrixWorld),0,6);
  assert.equal(ray.intersectObject(armor).length,0,'a frame or blast door closes the flight aperture');
 }
 const drops=new Map();for(const wave of preserveWaves)if(wave.drop)drops.set(wave.drop,(drops.get(wave.drop)??0)+1);
 for(const weapon of['homing','cannon','laser','omega'])assert(drops.get(weapon)>=3);
 assert(preserveWaves[0].time>=2&&preserveWaves.at(-1).time<=f.stageDuration-6);
 assert(preserveWaves.filter(w=>w.raptor!==undefined).length>=10);
 let maxRaptors=0,maxScouts=0;
 while(f.phase==='stage'){
  f.invulnerable=100;f.step(STEP);maxRaptors=Math.max(maxRaptors,f.enemies.filter(e=>e.raptor).length);maxScouts=Math.max(maxScouts,f.enemies.filter(e=>!e.raptor).length);
 }
 assert.equal(f.phase,'approach');assert.equal(f.enemies.length,0);assert(maxRaptors>0&&maxRaptors<=3&&maxScouts<=12);
});

test('stream basins contain the water, terrain varies by habitat, and whitewater stays above its flowing surface',()=>{
 for(let y=layout.PRESERVE_WATER_START;y<=layout.PRESERVE_WATER_END;y+=.3){
  const w=layout.preserveWater(y);assert(layout.preserveGround(w.x,y)<w.z-.25,'water floats above an uncarved ground plane');
  for(const side of[-1,1])assert(layout.preserveGround(w.x+side*w.width*1.05,y)>w.z+.15,'water edge is not concealed by its bank');
 }
 assert(layout.preserveWater(65).width>layout.preserveWater(54).width*1.8,'the ravine needs a broad pool');
 assert(layout.preserveGround(-2.4,112)>layout.preserveGround(.4,112)+1.0,'the dry habitat has a raised terraced bank');
 assert(scenery.root.getObjectByName('cycad-crowns'));assert(scenery.root.getObjectByName('fan-leaf-crowns'));
 const spray=scenery.irrigation.root.getObjectByName('spillway-whitewater'),buffer=spray.instanceMatrix.array,matrix=new T.Matrix4(),p=new T.Vector3();
 scenery.irrigation.update(4.2);const frozen=buffer.slice();
 for(let i=0;i<spray.count;i++){spray.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix);assert(p.z>layout.preserveWater(p.y).z+.03,'foam is hidden beneath the water');}
 scenery.irrigation.update(4.2);assert.deepEqual(buffer,frozen);scenery.irrigation.update(9);scenery.irrigation.update(4.2);assert.deepEqual(buffer,frozen);assert.equal(spray.instanceMatrix.array,buffer);
});

test('long scenery is culled to a bounded view and shadow projection snaps while preserving sunlight direction',()=>{
 const camera=new T.PerspectiveCamera(2*Math.atan(8/38)*180/Math.PI,9/16,.1,300);camera.position.z=38;camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const sun=scenery.world.children.find(o=>o.isDirectionalLight&&o.castShadow),offset=new T.Vector3(-22,-12,35),basis=new T.Matrix4().lookAt(offset,new T.Vector3(),new T.Vector3(0,1,0));
 const right=new T.Vector3().setFromMatrixColumn(basis,0),up=new T.Vector3().setFromMatrixColumn(basis,1);
 for(let time=0;time<=100;time+=3){
  scenery.update(time,0,time,1/60);scenery.root.updateMatrixWorld(true);let triangles=0,calls=0;
  scenery.root.traverse(o=>{if(!o.isMesh||o.frustumCulled&&!frustum.intersectsObject(o))return;calls++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);});
  assert(triangles<300_000&&calls<65,`visible scenery budget at ${time}: ${triangles} triangles / ${calls} calls`);
  assert(sun.position.clone().sub(sun.target.position).distanceTo(offset)<1e-10);
  for(const[axis,texel]of[[right,28/2048],[up,72/2048]]){const q=sun.target.position.dot(axis)/texel;assert(Math.abs(q-Math.round(q))<1e-8,'shadow window drifts between texels');}
 }
});
