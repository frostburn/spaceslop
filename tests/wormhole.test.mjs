import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({
  root: new URL('..', import.meta.url).pathname, configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, entries: [] }, appType: 'custom',
});
after(() => server.close());
const { Flight, STEP } = await server.ssrLoadModule('/src/game.ts');
const { levels } = await server.ssrLoadModule('/src/levels.ts');
const { wormholeFrame, WORMHOLE_APPROACH } = await server.ssrLoadModule('/src/wormhole/route.ts');
const { CICADA_FIRE, CICADA_HP, CICADA_WINDUP } = await server.ssrLoadModule('/src/cicada.ts');

test('the traveling aperture centers and opens before the cicada reaches combat depth', () => {
  const end = levels.wormhole.duration;
  const start = wormholeFrame(0, end);
  const approach = wormholeFrame(end, end);
  const open = wormholeFrame(end + 2.5, end);
  const combat = wormholeFrame(end + WORMHOLE_APPROACH, end);
  const settled = wormholeFrame(end + WORMHOLE_APPROACH + 3, end);
  assert.equal(start.lensStrength, 0);
  assert(!approach.bossVisible && open.bossVisible);
  assert(approach.lensX < 0 && approach.lensY > 0);
  assert(open.lensRadius > approach.lensRadius && open.echo > approach.echo);
  assert(open.arrival > 0 && open.arrival < 1);
  assert.equal(combat.arrival, 1);
  assert.equal(combat.wingSpread, 1);
  assert.equal(Math.hypot(combat.lensX, combat.lensY), 0);
  assert(settled.lensStrength < combat.lensStrength);
  assert(settled.echo < combat.echo);

  let previous = start.travel;
  for (let tick = 1; tick < 60 * 30; tick++) {
    const frame = wormholeFrame(tick * STEP, end);
    assert(Object.values(frame).every(value => typeof value === 'boolean' || Number.isFinite(value)));
    assert(frame.travel > previous);
    previous = frame.travel;
  }
});

test('the preview has a quiet approach, then the Titan rematch telegraphs and fires', () => {
  const flight = new Flight('sentry', [], 'vex', 'wormhole');
  for (let tick = 0; tick <= Math.ceil(flight.stageDuration / STEP) && flight.phase === 'stage'; tick++) {
    flight.step(STEP);
    assert.equal(flight.enemies.length + flight.drops.length + flight.threats.length, 0);
  }
  assert.equal(flight.phase, 'approach');
  assert.equal(flight.transitionDuration, WORMHOLE_APPROACH);
  for (let tick = 0; tick <= Math.ceil(WORMHOLE_APPROACH / STEP) && flight.phase === 'approach'; tick++) {
    flight.step(STEP);
    assert.equal(flight.shots.length + flight.threats.length, 0);
  }
  assert.equal(flight.phase, 'boss');
  assert.equal(flight.bossMaxHealth, CICADA_HP);
  assert.equal(flight.bossHealth, CICADA_HP);
  const firstVent = flight.exposedCannonX;
  while (flight.time < CICADA_WINDUP + .17) flight.step(STEP);
  const locked = flight.markers.map(marker => ({ ...marker }));
  assert.equal(locked.length, 3);
  assert(flight.cannonWindup > 0 && flight.cannonWindup < 1);
  assert(flight.bossHealth < CICADA_HP);
  flight.player.x = 2;
  while (flight.time < CICADA_FIRE + .08) flight.step(STEP);
  assert.deepEqual(flight.markers, locked);
  assert.equal(flight.firedCannonX, firstVent);
  assert.equal(flight.exposedCannonX, -firstVent);
  assert.equal(flight.threats.length, 3);
  assert(flight.threats.every(shot => shot.vz > 0 && shot.z < 0));
});
