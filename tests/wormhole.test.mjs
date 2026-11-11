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
const { FONS_APPROACH, FONS_HP, FONS_RAIN_AT, FONS_RAIN_END, fonsPhase, fonsPose, fonsRocks, fonsSheltered, fonsBeamHits, fonsBeams } =
  await server.ssrLoadModule('/src/wormhole/fons/combat.ts');
const { createFonsMantle } = await server.ssrLoadModule('/src/wormhole/fons/mantle.ts');
const { createFonsLightning } = await server.ssrLoadModule('/src/wormhole/fons/lightning.ts');

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

test('defeating the cicada flows into Fons with the same flight and continuous travel', () => {
  const flight = new Flight('sentry', ['cannon'], 'vex', 'wormhole');
  flight.time = flight.stageDuration;
  flight.step(0);
  while (flight.phase === 'approach') flight.step(STEP);
  for (let tick = 0; tick < 90; tick++) flight.step(STEP);
  assert(flight.markers.length > 0);
  flight.hull = 2;
  flight.bossHealth = 6;
  const before = flight.wormholeTime;
  flight.pulse();
  assert.equal(flight.phase, 'approach');
  assert.equal(flight.wormholeTime, before);
  assert.equal(flight.fonsTime, -FONS_APPROACH);
  assert.equal(flight.hull, 2);
  assert.equal(flight.charges, 1);
  assert.equal(flight.score, 1000);
  assert.equal(flight.bossHealth, FONS_HP);
  assert.equal(flight.shots.length + flight.markers.length + flight.threats.length, 0);
  while (flight.phase === 'approach') flight.step(STEP);
  assert.equal(flight.phase, 'boss');
  assert(flight.isFonsFight && flight.planarBoss);
  assert(Math.abs(flight.fonsTime) < 1e-8);
  flight.bossHealth = 6;
  flight.pulse();
  assert.equal(flight.phase, 'won');
  assert.equal(flight.score, 3500);
  const finish = flight.wormholeTime;
  flight.step(3);
  assert.equal(flight.wormholeTime, finish);
});

test('the wall rifts open before the asteroids cross and both rocks recede after giving cover', () => {
  const wall = fonsRocks(6.9);
  assert(wall.every(rock => !rock.visible && rock.rift.opening === 0 && Math.abs(rock.x) - rock.rx > 4.5));
  const warning = fonsRocks(7.58)[0];
  assert(warning.rift.opening > 0 && !warning.visible);
  const crossing = fonsRocks(8.83);
  assert(crossing.every(rock => rock.visible && rock.rift.opening > .7 && rock.rift.clipping && !rock.covering));
  assert(crossing.every((rock, index) => Math.abs(rock.x) < Math.abs(wall[index].x) && rock.y < wall[index].y));
  assert(fonsRocks(10.95).every(rock => rock.visible && rock.covering && rock.rift.opening === 0));
  for (const time of [FONS_RAIN_AT, FONS_RAIN_AT + .80, FONS_RAIN_END - STEP]) {
    const rocks = fonsRocks(time);
    assert(fonsPhase(time).rain);
    assert(rocks.every(rock => rock.covering && rock.visible));
    for (const rock of rocks) {
      assert(fonsSheltered(rocks, { x: rock.x, y: -5.3 }));
      assert(!fonsSheltered(rocks, { x: rock.x, y: rock.y + .2 }));
    }
    assert(!fonsSheltered(rocks, { x: 0, y: -5.3 }));
  }
  const lastCover = fonsRocks(FONS_RAIN_END);
  for (const [index, rock] of fonsRocks(FONS_RAIN_END + 1.2).entries()) {
    assert(rock.visible && !rock.covering);
    assert(rock.y < lastCover[index].y && rock.depth < lastCover[index].depth && rock.rx < lastCover[index].rx);
  }
  assert(fonsRocks(18.5).every(rock => !rock.visible && !rock.covering));
  const flight = new Flight('sentry', [], 'vex', 'wormhole');
  flight.startFonsApproach();
  while (flight.phase === 'approach') flight.step(STEP);
  flight.time = FONS_RAIN_AT + .15;
  flight.player.x = fonsRocks(flight.time)[0].x;
  flight.step(STEP);
  assert.equal(flight.hull, 4);
  flight.player.x = 0;
  flight.step(STEP);
  assert.equal(flight.hull, 3);
  const beamTime = 4.6, beam = fonsBeams(beamTime)[0];
  assert(beam.active);
  assert(fonsBeamHits(beamTime, { x: (beam.from.x + beam.to.x) / 2, y: (beam.from.y + beam.to.y) / 2 }));
});

test('the mantle holds its pins while the trailing folds move and freezes at a fixed clock', () => {
  const cloth = createFonsMantle();
  const position = cloth.root.children[0].geometry.attributes.position.array;
  cloth.update(0, true);
  const first = position.slice();
  for (let tick = 1; tick <= 180; tick++) cloth.update(tick * STEP, false);
  assert.deepEqual(position.slice(0, 51), first.slice(0, 51));
  assert(position.some((value, index) => Math.abs(value - first[index]) > .09));
  const frozen = position.slice();
  cloth.update(3, false);
  assert.deepEqual(position, frozen);
  for (let tick = 181; tick <= 640; tick++) cloth.update(tick * STEP, false);
  const opposite = cloth.root.children[1].geometry.attributes.position.array;
  for (const [panel, side] of [[position, -1], [opposite, 1]]) {
    const hem = (9 * 17 + 16) * 3;
    assert(panel[hem] * side < -.2 && panel[hem + 2] > 1.6);
  }
  for (let tick = 641; tick <= 960; tick++) cloth.update(tick * STEP, false);
  assert(position.every(value => Number.isFinite(value) && Math.abs(value) < 6));
  assert(position.every((value, index) => index % 3 !== 2 || value <= -1.019));
});

test('Fons blocks pulse and direct fire as the cloak closes before the rain', () => {
  const flight = new Flight('sentry', [], 'vex', 'wormhole');
  flight.startFonsApproach();
  while (flight.phase === 'approach') flight.step(STEP);
  flight.invulnerable = 100;
  function fire(time) {
    flight.time = time;
    const { x, y } = fonsPose(time + STEP);
    const shot = { x, y: y - 1.45, z: 0, vx: 0, vy: 24, vz: -25 };
    flight.shots = [shot];
    flight.step(STEP);
    assert(!flight.shots.includes(shot));
  }
  assert(fonsPhase(FONS_RAIN_AT - 1.7).wrap > 0);
  assert(!fonsPhase(FONS_RAIN_AT - 1.7).shielded);
  fire(FONS_RAIN_AT - 1);
  assert(flight.fonsShielded && !fonsPhase(flight.fonsTime).rain);
  flight.pulse();
  assert.equal(flight.bossHealth, FONS_HP);
  fire(FONS_RAIN_AT + .6);
  assert.equal(flight.bossHealth, FONS_HP);
  fire(FONS_RAIN_END + 1.25);
  assert(!flight.fonsShielded);
  assert.equal(flight.bossHealth, FONS_HP - 1);
});

test('entry lightning redraws its branches on the presentation clock and clears before combat', () => {
  const lightning = createFonsLightning(2.7);
  assert.equal(lightning.update(-FONS_APPROACH, 22), 0);
  assert(!lightning.root.visible);
  assert(lightning.update(-1.8, 22) > .5);
  assert(lightning.root.visible);
  assert(lightning.root.geometry.drawRange.count > 0);
  const positions = lightning.root.geometry.attributes.position.array;
  const snapshot = positions.slice();
  lightning.update(-1.8, 22);
  assert.deepEqual(positions, snapshot);
  lightning.update(-1.6, 22);
  assert(positions.some((value, index) => value !== snapshot[index]));
  assert.equal(lightning.update(0, 22), 0);
  assert(!lightning.root.visible);
});
