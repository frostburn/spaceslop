import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';
const server = await createServer({ root: new URL('..', import.meta.url).pathname, configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, entries: [] }, appType: 'custom' });
after(() => server.close());
const { Flight, STEP, iceWaves } = await server.ssrLoadModule('/src/game.ts');
const { IceCollision } = await server.ssrLoadModule('/src/ice-collision.ts');
const { ICE_DURATION, ICE_TRAVEL, ICE_SCREENS, iceSolids } = await server.ssrLoadModule('/src/ice-layout.ts');
const { FIGHTER_HULL, DRONE_HULL } = await server.ssrLoadModule('/src/hive-collision.ts');

test('Frostwake traverses ten screens with a complete original-roster wave schedule', () => {
  assert.equal(ICE_TRAVEL + 16, ICE_SCREENS * 16);
  assert.equal(ICE_DURATION, 90); assert.equal(iceWaves.length, 20);
  assert(iceWaves.some(w => w.raptor !== undefined));
  assert(iceWaves.every(w => !w.ant));
  assert.equal(new Set(iceWaves.map(w => w.drop).filter(Boolean)).size, 4);
  assert(ICE_DURATION - iceWaves.at(-1).time >= 8);
});

test('solid outcrops keep the center open and scrolling cannot pin a fighter at either edge', () => {
  const collision = new IceCollision(), left = { x: -3.95, y: -7 }, right = { x: 3.95, y: 6.6 };
  for (let i = 0; i <= 5400; i++) {
    collision.update(i / 5400);
    for (const point of [left, right]) {
      collision.move(point, 0, 0, FIGHTER_HULL);
      assert(!collision.overlaps(point, FIGHTER_HULL), `embedded at frame ${i}`);
    }
    for (const y of [-7, -3, 0, 4, 6]) assert(!collision.overlaps({ x: 0, y }, FIGHTER_HULL));
  }
  collision.update(1);
  for (let x = -3.95; x <= 3.95; x += .2) for (const y of [-7.1, -5, 0, 5, 6.6])
    assert(!collision.overlaps({ x, y }, FIGHTER_HULL), `boss arena blocked at ${x}, ${y}`);
});

test('fast touch movement and drone docking stop at solid ice without hull damage', () => {
  const rock = iceSolids[0], f = new Flight('sentry', [], 'glint', 'ice');
  f.player.y = rock.y; f.aimBy(-3.95, 0); f.steer(0, 0, 1);
  const collision = new IceCollision(); collision.update(0);
  assert(!collision.overlaps(f.player, FIGHTER_HULL)); assert.equal(f.hull, 4);
  f.drone.y = rock.y; f.deployDrone(rock.x, rock.y);
  for (let i = 0; i < 80; i++) f.step(STEP);
  collision.update(f.hiveProgress);
  assert(!collision.overlaps(f.drone, DRONE_HULL)); assert.equal(f.droneTarget, undefined);
});

test('a media-free simulation completes the full schedule and reaches the draconian boss', () => {
  const f = new Flight('sentry', [], 'vex', 'ice');
  let maxEnemies = 0, sawRaptor = false;
  for (let i = 0; i < (ICE_DURATION + 1.5) * 60; i++) {
    f.invulnerable = 100; f.step(STEP);
    maxEnemies = Math.max(maxEnemies, f.enemies.length); sawRaptor ||= f.enemies.some(e => e.raptor);
  }
  assert(sawRaptor); assert(maxEnemies <= 12, `renderer pool exceeded: ${maxEnemies}`);
  assert.equal(f.phase, 'boss'); assert.equal(f.enemies.length, 0);
  assert.equal(f.stageDuration, 90); assert.equal(f.bossHealth, 30);
  f.pulse(); f.pulse(); assert.equal(f.bossHealth, 18);
});
