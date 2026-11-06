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
  assert(triangles < 300_000, `scenery triangle budget: ${triangles}`);
  assert(batches < 60, `scenery batch budget: ${batches}`);
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
