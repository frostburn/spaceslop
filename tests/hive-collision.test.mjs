import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

// Reuse Vite's TypeScript loader; the collision simulation has no DOM or image dependency.
const server = await createServer({ root: new URL('..', import.meta.url).pathname, configFile: false,
  server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, entries: [] }, appType: 'custom' });
after(() => server.close());
const { Flight, STEP } = await server.ssrLoadModule('/src/game.ts');
const { HiveCollision, FIGHTER_HULL, DRONE_HULL } = await server.ssrLoadModule('/src/hive-collision.ts');
const { hiveCollisionRecipes, hiveRoot, projectHivePoint } = await server.ssrLoadModule('/src/hive-layout.ts');
const colony = hiveCollisionRecipes[0];
const capCenter = { x: 0, y: 0 };
const cloud = colony.bodies[0].cap;
const projected = cloud.map((point) => {
  const out = { x: 0, y: 0 };
  projectHivePoint(hiveRoot(colony.u, colony.v, 0), point, 26, out);
  return out;
});
capCenter.x = (Math.min(...projected.map(p => p.x)) + Math.max(...projected.map(p => p.x))) / 2;
capCenter.y = (Math.min(...projected.map(p => p.y)) + Math.max(...projected.map(p => p.y))) / 2;

test('a keyboard approach stops at the cap and mushroom contact does not damage hull', () => {
  const flight = new Flight('sentry', [], 'vex', 'broodlock');
  flight.player.y = capCenter.y;
  for (let i = 0; i < 25; i++) flight.steer(-1, 0, STEP);
  const before = { ...flight.player };
  flight.steer(-1, 0, 0.15);
  assert(flight.player.x > capCenter.x + 0.7);
  assert(Math.hypot(flight.player.x - before.x, flight.player.y - before.y) < 6.5 * 0.15);
  assert.equal(flight.hull, 4);
  const collision = new HiveCollision(); collision.update(0, 26);
  assert(!collision.overlaps(flight.player, FIGHTER_HULL));
});

test('blocked touch intent releases immediately when the next drag moves away', () => {
  const flight = new Flight('sentry', [], 'vex', 'broodlock');
  flight.player.y = capCenter.y;
  flight.aimBy(-4, 0);
  for (let i = 0; i < 100; i++) flight.steer(0, 0, STEP);
  const blockedX = flight.player.x;
  assert(blockedX > capCenter.x + 0.7);
  flight.aimBy(0.35, 0);
  for (let i = 0; i < 8; i++) flight.steer(0, 0, STEP);
  assert(flight.player.x >= blockedX + 0.34);
});

test('small and large movement steps remain outside stems and caps', () => {
  const collision = new HiveCollision(); collision.update(0, 26);
  for (const size of [0.035, 0.43, 1.4]) {
    const point = { x: -1.5, y: capCenter.y - 0.25 };
    let touched = false;
    for (let i = 0; i < 50; i++) {
      touched = collision.move(point, -size, size * 0.5, DRONE_HULL) || touched;
      assert(!collision.overlaps(point, DRONE_HULL), `embedded after step ${i}, size ${size}`);
    }
    assert(touched);
    assert(point.x >= -3.95 && point.x <= 3.95 && point.y >= -7.1 && point.y <= 6.6);
  }
});

test('scrolling growth cannot trap a craft at the edge and the middle lane stays open', () => {
  const collision = new HiveCollision();
  const left = { x: -3.9, y: -7.1 }, right = { x: 3.9, y: 6.6 };
  for (let step = 0; step <= 1680; step++) {
    collision.update(step / 1680, 26);
    for (const craft of [left, right]) {
      collision.move(craft, 0, 0, FIGHTER_HULL);
      assert(!collision.overlaps(craft, FIGHTER_HULL), `edge trap at ${step}`);
      assert(craft.x >= -3.95 && craft.x <= 3.95 && craft.y >= -7.1 && craft.y <= 6.6);
    }
    for (const y of [-6, 0, 6]) assert(!collision.overlaps({ x: 0, y }, FIGHTER_HULL));
  }
});

test('the drone parks before an obstructed goal and Glint measures the completed move', () => {
  const flight = new Flight('towline', [], 'glint', 'broodlock');
  flight.drone.x = -0.9; flight.drone.y = capCenter.y;
  flight.deployDrone(-3.95, capCenter.y);
  for (let i = 0; i < 35; i++) flight.step(STEP);
  assert.equal(flight.droneTarget, undefined);
  assert(Math.hypot(flight.drone.x + 0.9, flight.drone.y - capCenter.y) < 3);
  assert(!flight.perkMessage.includes('Hot Dock'));
  const collision = new HiveCollision(); collision.update(flight.hiveProgress, 26);
  assert(!collision.overlaps(flight.drone, DRONE_HULL));
});

test('boss footprints use the final view and the preserve keeps unrestricted movement', () => {
  const collision = new HiveCollision(); collision.update(1, 22);
  for (let y = -7; y < 6.6; y += 0.2) assert(!collision.overlaps({ x: 0, y }, FIGHTER_HULL));
  const flight = new Flight('sentry', [], 'vex', 'preserve');
  flight.player.y = capCenter.y;
  flight.steer(-1, 0, 1);
  assert.equal(flight.player.x, -3.95);
});
