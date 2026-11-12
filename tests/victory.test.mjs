import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import * as T from 'three';
import { createServer } from 'vite';

const server = await createServer({
  root: new URL('..', import.meta.url).pathname,
  configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, entries: [] },
  appType: 'custom',
});
after(() => server.close());
const { BOSS_DEPTH, Flight, STEP } = await server.ssrLoadModule('/src/game.ts');
const { createBossDefeat, createVictoryFlares, VICTORY_DURATION } = await server.ssrLoadModule('/src/rendering/victory.ts');

test('a lethal projectile clears in-flight ordnance and records the final boss time', () => {
  const flight = new Flight('sentry', [], 'vex', 'broodlock');
  flight.phase = 'boss';
  flight.time = 2;
  flight.bossHealth = 1;
  flight.cooldown = flight.droneCooldown = 100;
  flight.markers = [{ x: 0, y: -4 }];
  flight.shots = [
    { x: 2, y: -4, z: 0, vx: 0, vy: 15, vz: 0 },
    { x: flight.exposedCannonX, y: flight.bossAimY, z: BOSS_DEPTH + .1, vx: 0, vy: 0, vz: -20, wing: 'omega', damage: 3, pierced: new Set() },
  ];
  flight.step(STEP);
  assert.equal(flight.phase, 'won');
  assert.equal(flight.score, 1000);
  assert.equal(flight.shots.length + flight.threats.length + flight.markers.length, 0);
  assert.equal(flight.bossTime, 2 + STEP);
  flight.step(10);
  assert.equal(flight.bossTime, 2 + STEP);
  assert.equal(flight.score, 1000);
});

test('the defeat rig starts from the authored pose and resets for a replay', () => {
  const plane = new T.Group(), scenery = new T.Group(), boss = new T.Group();
  scenery.position.set(0, -35, -4);
  scenery.rotation.x = .24;
  boss.position.set(1, 38, -12);
  plane.add(scenery);
  scenery.add(boss);
  const before = boss.getWorldPosition(new T.Vector3());
  const defeat = createBossDefeat(boss, plane, 'io');
  assert(boss.getWorldPosition(new T.Vector3()).distanceTo(before) < 1e-9);
  const bursts = [];
  const emit = (point, tint) => bursts.push({ point: point.clone(), tint });
  assert(defeat.pose(0, emit));
  assert(boss.getWorldPosition(new T.Vector3()).distanceTo(before) < 1e-9);
  assert(defeat.pose(.5, emit));
  assert(boss.getWorldPosition(new T.Vector3()).distanceTo(before) > .3);
  assert.equal(bursts.length, 3);
  assert(!defeat.pose(.5, emit));
  defeat.pose(VICTORY_DURATION, emit);
  assert.equal(boss.visible, false);
  defeat.reset();
  assert.equal(boss.visible, true);
  assert(boss.getWorldPosition(new T.Vector3()).distanceTo(before) < 1e-9);
  assert(defeat.pose(0, emit));
});

test('the final freeze frame holds two visible flare volleys until the next flight', () => {
  for (const lane of createVictoryFlares()) {
    lane.pose(.9);
    assert.equal(lane.root.visible, false);
    lane.pose(VICTORY_DURATION);
    const live = lane.root.children.filter(flare => flare.visible && flare.scale.x > .5);
    assert.equal(live.length, 2);
    assert(live.every(flare => flare.position.y > 0));
    const frozen = live.map(flare => flare.position.y);
    lane.pose(VICTORY_DURATION);
    assert.deepEqual(live.map(flare => flare.position.y), frozen);
    lane.pose();
    assert.equal(lane.root.visible, false);
  }
});
