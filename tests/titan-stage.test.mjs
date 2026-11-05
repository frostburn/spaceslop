import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';
const server = await createServer({ root: new URL('..', import.meta.url).pathname, configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, entries: [] }, appType: 'custom' });
after(() => server.close());
const { Flight, STEP, titanWaves } = await server.ssrLoadModule('/src/game.ts');
const { TITAN_DURATION, TITAN_SCREENS, titanTileY } = await server.ssrLoadModule('/src/titan-layout.ts');
const { titanMask } = await server.ssrLoadModule('/src/titan-mask.ts');
const { titanLights } = await server.ssrLoadModule('/src/titan-features.ts');

test('the ten-screen plate scrolls bottom to top with uninterrupted viewport coverage', () => {
  assert.equal(titanTileY(9, 0), 0); assert.equal(titanTileY(0, 1), 0);
  for (let i = 0; i <= 5400; i++) {
    const p = i / 5400;
    const intervals = Array.from({ length: TITAN_SCREENS }, (_, j) => titanTileY(j, p)).sort((a,b) => a-b);
    assert(intervals[0] - 8 <= -8 && intervals.at(-1) + 8 >= 8);
    for (let j = 1; j < intervals.length; j++) assert(Math.abs(intervals[j] - intervals[j-1] - 16) < 1e-10);
  }
});

test('prototype patrols span the route, repeat all accessories and end without a boss', () => {
  assert.equal(TITAN_DURATION, 90);
  assert.equal(titanWaves.length, 20);
  for (const kind of ['homing','cannon','laser','omega']) assert(titanWaves.filter(w => w.drop === kind).length > 1);
  assert(TITAN_DURATION - titanWaves.at(-1).time >= 8);
  const f = new Flight('sentry', [], 'vex', 'titan');
  const observed = new Set(); let maxEnemies = 0;
  for (let frame = 0; frame < 5402; frame++) {
    // Observe the complete schedule regardless of damage; browser QA covers an unmodified run.
    f.invulnerable = 100; f.step(STEP);
    for (const enemy of f.enemies) {
      assert(!enemy.raptor && !enemy.ant && !enemy.marine);
      if (enemy.drop) observed.add(enemy.drop);
    }
    assert(!['approach','boss'].includes(f.phase));
    maxEnemies = Math.max(maxEnemies, f.enemies.length);
  }
  assert(maxEnemies > 0 && maxEnemies <= 12);
  assert.equal(observed.size, 4); assert.equal(f.phase, 'won'); assert.equal(f.hiveProgress, 1);
  assert.equal(f.enemies.length + f.shots.length + f.threats.length + f.drops.length + f.markers.length, 0);
  for (const wing of f.wings) assert.equal(wing.beamEnd, undefined);
  const score = f.score; f.step(10); assert.equal(f.score, score); assert.equal(f.hiveProgress, 1);
});

test('a failed Titan run retains its position and a new flight starts at the opening', () => {
  const f = new Flight('sentry', [], 'vex', 'titan');
  f.time = 32; f.hull = 1; f.threats = [{...f.player, z:0,vx:0,vy:0,vz:0}];
  f.step(STEP); assert.equal(f.phase, 'lost');
  const progress = f.hiveProgress; assert(progress > .35 && progress < .36);
  f.step(90); assert.equal(f.hiveProgress, progress);
  assert.equal(new Flight('sentry', [], 'vex', 'titan').hiveProgress, 0);
});

test('procedural mask retains pipe and lamp animation with no river channel', () => {
  const w = 720, h = 128, top = 5800, pixels = new Uint8ClampedArray(w*h*4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([80,70,55,255], i);
  const pipeX = 620;
  pixels.set([12,15,18,255], (50*w+100)*4);
  pixels.set([40,180,200,255], (50*w+pipeX)*4);
  const mask = titanMask(pixels,w,h,top,12800);
  assert(mask.every((value,i) => i%4 !== 0 || value === 0), 'river channel must remain unused');
  assert(mask[(50*w+pipeX)*4+1] > 200);
  assert.equal(mask[(50*w+400)*4], 0); assert.equal(mask[(50*w+400)*4+1], 0);
  // The same cyan pixel outside the pipe's registered section stays unaffected.
  assert.equal(titanMask(pixels,w,h,10000,12800)[(50*w+pipeX)*4+1], 0);
  const [lx,ly] = titanLights[0], lamp = new Uint8ClampedArray(w*32*4);
  lamp.set([190,225,250,255], (16*w+lx)*4);
  assert(titanMask(lamp,w,32,ly-16,12800)[(16*w+lx)*4+2] > 200);
});
