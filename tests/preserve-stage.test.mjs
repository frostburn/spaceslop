import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import * as T from 'three';
import {createServer} from 'vite';

const server = await createServer({root: new URL('..', import.meta.url).pathname, configFile: false,
  server: {middlewareMode: true, hmr: false, ws: false}, optimizeDeps: {noDiscovery: true, entries: []}, appType: 'custom'});
after(() => server.close());
const layout = await server.ssrLoadModule('/src/preserve-layout.ts');
const {createPreserveScenery} = await server.ssrLoadModule('/src/preserve-scenery.ts');
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
      assert(p.getZ(i) < -2.7, 'scenery must remain below flight/combat geometry');
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
  for (const p of layout.preservePools) assert(layout.preserveGround(p.x, p.y) < -4.1);
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
    for (const a of Object.values(o.geometry.attributes)) assert(a.array.every(Number.isFinite));
    triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
    if (o.isInstancedMesh) {
      assert(o.instanceMatrix.array.every(Number.isFinite));
      assert(o.boundingSphere && Number.isFinite(o.boundingSphere.radius));
      batches++;
    }
    if (o.name === 'fern-crowns') assert(o.geometry === scenery.foliage.root.getObjectByName('fern-crowns').geometry);
  });
  assert(triangles < 500_000, `whole preserve + rotunda + boss triangle budget: ${triangles}`);
  assert(batches < 85, `scenery batch budget: ${batches}`);
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
  for (const [time, exit] of [[4, 0], [12, 0], [14, 0], [14.6, .5], [15.25, 1], [25, 1]]) {
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
