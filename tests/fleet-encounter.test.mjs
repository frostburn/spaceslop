import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { Euler, Vector3 } from 'three';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { Flight, STEP } = await server.ssrLoadModule('/src/game.ts');
const { broadsideGuns, broadsideShots, broadsideSignal, BROADSIDE_BARREL, FLEET_SAUCER_POOL,
  saucerCanFire, saucerPose } = await server.ssrLoadModule('/src/fleet/combat.ts');
const { fleetViewY, fleetScroll, hullPoint, tractorPose, tractorSites, trenchShip, FLEET_TRENCH_AT,
  carrierPose, grayCarriers, TRACTOR_MOUNT, FLEET_CAMERA_DISTANCE, CAPITAL_DEPTH } =
  await server.ssrLoadModule('/src/fleet/route.ts');

test('the whole trench moves in through its stern and reaches its forward breach before results', () => {
  const stern = hullPoint(trenchShip, .5, .984);
  const entrance = hullPoint(trenchShip, .5, .81);
  const breach = hullPoint(trenchShip, .5, .25);
  assert.equal(stern.x, 0);
  assert(fleetViewY(stern.y, FLEET_TRENCH_AT) > 8, 'the stern is ahead of the viewport at the jump');
  assert(fleetViewY(stern.y, 77) < fleetViewY(entrance.y, 77));
  assert(fleetViewY(entrance.y, 81) > -5.3 && fleetViewY(entrance.y, 84) < -5.3);
  assert(fleetViewY(breach.y, 97) > -5.3 && fleetViewY(breach.y, 100) < -5.3);
  assert.equal(fleetScroll(100), 160);
});

test('a broadside has a visible windup, leaves its own barrel and only fires once per scheduled shot', () => {
  for (const gun of broadsideGuns) {
    const at = gun.fires[0];
    assert(at > 3);
    assert(broadsideSignal(gun, at - .3).charge > .5);
    assert.equal(broadsideSignal(gun, at).flash, 1);
    const shots = broadsideShots(at - STEP, at);
    assert(shots.some(shot => shot.broadside && Math.abs(shot.x - (gun.x + BROADSIDE_BARREL * gun.side)) < 1e-6
      && Math.abs(shot.y - fleetViewY(gun.y, at)) < 1e-6 && Math.sign(shot.vx) === gun.side));
    assert(!broadsideShots(at, at + STEP).some(shot => Math.abs(shot.y - fleetViewY(gun.y, at + STEP)) < 1e-6));
  }
});

test('tractor motion and hull contact share a continuous pose', () => {
  for (const site of tractorSites) {
    const time = site.at + 2;
    const carrier = grayCarriers[site.carrier], p = carrierPose(carrier, time);
    const scale = 1 - CAPITAL_DEPTH / FLEET_CAMERA_DISTANCE;
    const mount = new Vector3(...TRACTOR_MOUNT).multiplyScalar(scale * carrier.radius)
      .applyEuler(new Euler(p.pitch, p.bank, p.yaw, 'ZXY'))
      .add(new Vector3(p.x * scale, p.y * scale, CAPITAL_DEPTH));
    const factor = FLEET_CAMERA_DISTANCE / (FLEET_CAMERA_DISTANCE - mount.z);
    const { source } = tractorPose(site, time);
    assert(Math.hypot(source.x - mount.x * factor, source.y - mount.y * factor) < 1e-8);
  }
  const site = tractorSites.find(site => site.wreck);
  const time = site.at + 3.1;
  const before = tractorPose(site, time - STEP), pose = tractorPose(site, time);
  assert(pose.x > before.x && Math.hypot(pose.x - before.x, pose.y - before.y) < .1);
  assert(pose.visibility > .9 && pose.charge > .9);
  const flight = new Flight('sentry', [], 'vex', 'fleet');
  flight.time = time - STEP;
  flight.player = { x: pose.x, y: pose.y };
  flight.step(STEP);
  assert.equal(flight.hull, 3);
});

test('asset-independent combat keeps saucers visible at fire time, fits the pool and clears without a boss phase', () => {
  const flight = new Flight('sentry', [], 'vex', 'fleet');
  flight.invulnerable = flight.cooldown = flight.droneCooldown = 1e6;
  let maxActive = 0, saucerFire = 0, volleys = 0, deepestBank = 0;
  const drops = new Set(), courses = new Set();
  for (let i = 0; flight.phase === 'stage' && i < 6200; i++) {
    const prev = new Map(flight.enemies.map(enemy => [enemy, enemy.fire]));
    flight.step(STEP);
    maxActive = Math.max(maxActive, flight.enemies.length);
    for (const enemy of flight.enemies) {
      const saucer = enemy.fleet;
      assert(saucer, 'other sector enemies did not spawn');
      courses.add(saucer.course);
      if (enemy.drop) drops.add(enemy.drop);
      deepestBank = Math.max(deepestBank, Math.abs(saucerPose(enemy.age, enemy.lane, saucer).bank));
      if (Number.isFinite(enemy.fire) && prev.get(enemy) < enemy.fire) {
        assert(saucerCanFire(enemy, saucer));
        saucerFire++;
      }
    }
    if (flight.threats.some(shot => shot.broadside)) volleys++;
  }
  assert(maxActive > 3 && maxActive <= FLEET_SAUCER_POOL);
  assert.equal(courses.size, 4);
  assert.deepEqual([...drops].sort(), ['cannon', 'homing', 'laser', 'omega']);
  assert(saucerFire > 20 && volleys > 100 && deepestBank > .32);
  assert.equal(flight.phase, 'won');
  assert.equal(flight.bossHealth, 0);
  assert.equal(flight.threats.length, 0);
});

test('starting at the trench does not replay earlier volleys or skip to a boss', () => {
  const flight = new Flight('sentry', [], 'vex', 'fleet');
  flight.time = FLEET_TRENCH_AT;
  flight.step(0);
  assert.equal(flight.phase, 'stage');
  assert(flight.enemies.length <= FLEET_SAUCER_POOL);
  assert.equal(flight.threats.length, 0);
  assert(flight.enemies.every(enemy => enemy.y > -9));
});
