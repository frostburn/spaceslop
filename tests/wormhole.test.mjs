import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { Color } from 'three';
import { createServer } from 'vite';

const server = await createServer({
  root: new URL('..', import.meta.url).pathname, configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, entries: [] }, appType: 'custom',
});
after(() => server.close());
const { Flight, STEP, BOSS_CAMERA_DISTANCE, BOSS_Y, BOSS_PROJECTION } = await server.ssrLoadModule('/src/game.ts');
const { levels } = await server.ssrLoadModule('/src/levels.ts');
const { wormholeFrame, WORMHOLE_APPROACH } = await server.ssrLoadModule('/src/wormhole/route.ts');
const { CICADA_FIRE, CICADA_HP, CICADA_WINDUP } = await server.ssrLoadModule('/src/cicada.ts');
const { wormholeReflectionPose, createWormholeReflection } = await server.ssrLoadModule('/src/wormhole/reflection.ts');
const { createFighterRig } = await server.ssrLoadModule('/src/ship-rigs.ts');

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

test('introductory ordnance recedes toward the tunnel horizon', () => {
  const flight = new Flight('sentry', ['homing', 'laser'], 'vex', 'wormhole');
  const horizon = BOSS_Y * BOSS_PROJECTION;
  flight.step(STEP);
  assert.equal(flight.shots.length, 3);
  for (const shot of flight.shots) {
    assert(shot.vz < 0 && shot.z < 0);
    assert(Math.abs(-BOSS_CAMERA_DISTANCE * shot.vy / shot.vz - horizon) < 1e-8);
  }
  const origin = flight.wingOrigin(1), beam = flight.wings[1].beamEnd;
  assert(beam.x > 0 && beam.x < origin.x);
  assert(beam.y > origin.y && beam.y < horizon);
});

test('ship reflection fades in at the walls and blends across the corners', () => {
  const horizon = BOSS_Y * BOSS_PROJECTION;
  assert.equal(wormholeReflectionPose(0, -5.3, horizon), undefined);
  const left = wormholeReflectionPose(-3.95, -5.3, horizon);
  const right = wormholeReflectionPose(3.95, -5.3, horizon);
  assert.equal(left.x, -right.x);
  assert.equal(left.y, right.y);
  assert.equal(right.nx, 1);
  assert.equal(right.strength, 1);
  assert(wormholeReflectionPose(3.3, -5.3, horizon).strength < right.strength);
  const bottom = wormholeReflectionPose(0, -7.1, horizon);
  const corner = wormholeReflectionPose(3.95, -7.1, horizon);
  assert.equal(bottom.ny, -1);
  assert(corner.nx > 0 && corner.ny < 0);
  assert(Math.abs(corner.x) < 9 / 16 && Math.abs(corner.y) < 1);
  assert(Math.abs(Math.hypot(corner.nx, corner.ny) - 1) < 1e-8);
});

test('reflection capture primes once, restores renderer state, and disposes the target', () => {
  const reflection = createWormholeReflection(createFighterRig().root);
  const clear = new Color(0x6633ff), originalColor = clear.clone();
  let alpha = .75, target = null, draws = 0, disposed = false, fail = false;
  const renderer = {
    getRenderTarget: () => target,
    setRenderTarget: value => { target = value; },
    getClearAlpha: () => alpha,
    getClearColor: color => color.copy(clear),
    setClearColor(color, opacity) { clear.set(color); alpha = opacity; },
    render() {
      assert.equal(alpha, 0);
      assert.equal(target.texture, reflection.texture);
      if (draws++ === 0) target.addEventListener('dispose', () => { disposed = true; });
      if (fail) throw Error('Capture interrupted');
    },
  };
  reflection.capture(renderer, undefined);
  assert.equal(draws, 0);
  reflection.prime();
  reflection.capture(renderer, undefined);
  reflection.capture(renderer, undefined);
  assert.equal(draws, 1);
  const edge = wormholeReflectionPose(3.8, -5.3, BOSS_Y * BOSS_PROJECTION);
  fail = true;
  assert.throws(() => reflection.capture(renderer, edge), /interrupted/);
  assert.equal(draws, 2);
  assert.equal(target, null);
  assert.equal(alpha, .75);
  assert(clear.equals(originalColor));
  reflection.dispose();
  assert(disposed);
});
