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
  FLEET_APPROACH, FLEET_DURATION, FLEET_SPEED, flagshipEngines, flankShips, carrierPose, grayCarriers,
  TRACTOR_MOUNT, FLEET_CAMERA_DISTANCE, CAPITAL_DEPTH, projectedSaucerMount } =
  await server.ssrLoadModule('/src/fleet/route.ts');
const { FLEET_BOSS_CYCLE, FLEET_BOSS_HP, FLEET_BOSS_MOUNTS, createFleetBossAttack, fleetBossEntry,
  fleetBossPose, fleetBossSignal, stepFleetBoss } = await server.ssrLoadModule('/src/fleet/boss.ts');
const { createSaucerFactory } = await server.ssrLoadModule('/src/fleet/saucers.ts');
const { createFleetBossRig } = await server.ssrLoadModule('/src/fleet/boss-rig.ts');
const { FLEET_PURSUIT_AT, pursuitFighter, pursuitSaucer } = await server.ssrLoadModule('/src/fleet/pursuit.ts');

test('the stern and its exhaust clear the previous bow before a continuous coast to the breach', () => {
  const stern = hullPoint(trenchShip, .5, .984);
  const entrance = hullPoint(trenchShip, .5, .81);
  const breach = hullPoint(trenchShip, .5, .25);
  assert.equal(stern.x, 0);
  assert(fleetViewY(stern.y, FLEET_TRENCH_AT) > 8, 'the stern is ahead of the viewport at the jump');
  assert(fleetViewY(stern.y, 81) < fleetViewY(entrance.y, 81));
  assert(fleetViewY(entrance.y, 84) > -5.3 && fleetViewY(entrance.y, 88) < -5.3);
  const previous = flankShips.at(-1);
  const nozzle = hullPoint(trenchShip, ...flagshipEngines.trench.mounts[0]);
  const exhaustEnd = nozzle.y - 7.62 * flagshipEngines.trench.radius * trenchShip.width;
  assert(exhaustEnd > previous.y + previous.width + 2.5);
  assert.equal(FLEET_DURATION, 98);
  assert.equal(fleetScroll(FLEET_DURATION), FLEET_DURATION * FLEET_SPEED);
  const end = FLEET_DURATION + FLEET_APPROACH;
  assert(fleetViewY(breach.y, end) < fleetViewY(breach.y, FLEET_DURATION) - 2.7);
  assert(fleetViewY(breach.y, end) > -5.3);
  assert.equal(fleetScroll(end), fleetScroll(end + 5));
  const scrollSpeed = (fleetScroll(FLEET_DURATION + STEP) - fleetScroll(FLEET_DURATION - STEP)) / (2 * STEP);
  assert(Math.abs(scrollSpeed - FLEET_SPEED) < .001);
});

test('the pursuit squad enters behind the saucers and leaves before the stern', () => {
  const sternEntry = (hullPoint(trenchShip, .5, .984).y - 8) / FLEET_SPEED;
  const finish = sternEntry - FLEET_PURSUIT_AT;
  for (let index = 0; index < 4; index++) {
    assert(pursuitFighter(0, index).y < -9);
    assert(pursuitFighter(finish, index).y > 9);
    for (const age of [2.6, 3.2, 4.4]) {
      const fighter = pursuitFighter(age, index);
      const saucer = pursuitSaucer(age, index % 2 === 0 ? -1 : 1);
      assert(Math.abs(fighter.x) < 4.5 && Math.abs(fighter.y) < 8);
      assert(fighter.y < saucer.y - 2);
      assert(Math.abs(fighter.heading) < Math.PI / 2);
    }
  }
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

test('asset-independent patrol combat keeps saucers visible at fire time and fits the pool', () => {
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
      if (enemy.reward) drops.add(enemy.reward.weapon);
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
  assert.equal(flight.phase, 'approach');
  assert.equal(flight.bossHealth, FLEET_BOSS_HP);
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

test('the command saucer banks continuously into view and shares its emitter coordinates with combat', () => {
  const start = fleetBossPose(-FLEET_APPROACH), end = fleetBossPose(0);
  assert(start.y - start.radius > 8);
  assert(end.y + end.radius < 8 && end.pitch > Math.PI / 2);
  const rig = createFleetBossRig(createSaucerFactory());
  for (const t of [-2.1, -.15, 0, 1.42, 4.62, 12]) {
    const pose = fleetBossPose(t);
    rig.pose(t, false, FLEET_CAMERA_DISTANCE);
    rig.root.updateMatrixWorld(true);
    for (const [port, mount] of FLEET_BOSS_MOUNTS.entries()) {
      const source = rig.root.getObjectByName('fleet-boss-emitter-' + port).getWorldPosition(new Vector3());
      const factor = FLEET_CAMERA_DISTANCE / (FLEET_CAMERA_DISTANCE - source.z);
      const p = projectedSaucerMount(pose, mount);
      assert(Math.hypot(source.x * factor - p.x, source.y * factor - p.y) < 1e-8);
    }
  }
  assert(Number.isFinite(fleetBossEntry(0, { x: 0, y: -5 }, { x: 0, y: 8 })));
  assert.equal(fleetBossEntry(0, { x: 4, y: -5 }, { x: 4, y: 8 }), Infinity);
});

test('aimed fans lock before firing and the pulse wheel adds a ring on the next damaged cycle', () => {
  const attack = createFleetBossAttack(), first = { x: -2, y: -5 }, moved = { x: 2, y: -6 };
  stepFleetBoss(attack, .54, .02, first, FLEET_BOSS_HP);
  const shots = stepFleetBoss(attack, 1.425, .01, moved, FLEET_BOSS_HP);
  assert.equal(shots.length, 5);
  assert(fleetBossSignal(1.34, 0, false).charge > .9);
  assert(fleetBossSignal(1.425, 0, false).flash > .95);
  assert(Math.abs(shots[2].x + shots[2].vx * (first.y - shots[2].y) / shots[2].vy - first.x) < 1e-8);
  const second = stepFleetBoss(attack, 1.644, .01, moved, 45);
  assert.equal(second.length, 4);
  assert.equal(attack.rapid, false);
  const ring = stepFleetBoss(attack, 4.625, .01, moved, 45);
  const echo = stepFleetBoss(attack, 5.205, .01, moved, 45);
  assert.equal(ring.length, 16);
  assert.equal(echo.length, 16);
  assert.notEqual(ring[0].vx, echo[0].vx);
  assert.equal(stepFleetBoss(attack, 5.754, .01, moved, 45).length, 0);
  assert.equal(stepFleetBoss(attack, FLEET_BOSS_CYCLE + 5.754, .01, moved, 45).length, 16);
  assert(attack.rapid);
});

test('weapons stay planar across the approach and every loadout can damage the saucer', () => {
  const crossing = new Flight('sentry', [], 'vex', 'fleet');
  crossing.time = FLEET_DURATION;
  crossing.step(0);
  assert.equal(crossing.phase, 'approach');
  const shot = crossing.shots[0];
  crossing.step(STEP);
  assert(crossing.shots.includes(shot) && shot.z === 0);
  while (crossing.phase === 'approach') {
    assert.equal(crossing.threats.length, 0);
    crossing.step(STEP);
  }
  assert.equal(crossing.phase, 'boss');
  assert(crossing.shots.length && crossing.shots.every(shot => shot.z === 0));

  for (const weapon of ['primary', 'sentry', 'towline', 'homing', 'cannon', 'omega', 'laser', 'pulse']) {
    const f = new Flight(weapon === 'towline' ? 'towline' : 'sentry',
      ['homing', 'cannon', 'omega', 'laser'].includes(weapon) ? [weapon] : [], 'vex', 'fleet');
    f.phase = 'boss';
    f.invulnerable = 100;
    f.cooldown = weapon === 'primary' ? 0 : 100;
    f.droneCooldown = weapon === 'sentry' ? 0 : 100;
    f.towlineCooldown = 0;
    f.drone = { x: 0, y: weapon === 'towline' ? 3.6 : -4.9 };
    if (weapon === 'pulse') f.pulse();
    for (let i = 0; i < 144; i++) f.step(STEP);
    assert(f.bossHealth < FLEET_BOSS_HP, weapon + ' dealt damage');
    assert(f.shots.every(shot => shot.z === 0));
  }
});
