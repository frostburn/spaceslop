import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({
  root: new URL('..', import.meta.url).pathname,
  configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, entries: [] },
  appType: 'custom',
});
after(() => server.close());
const { Flight, STEP } = await server.ssrLoadModule('/src/game.ts');
const { FIGHTER_HULL } = await server.ssrLoadModule('/src/hive-collision.ts');

function quietFlight(level = 'broodlock', pilot = 'vex') {
  const flight = new Flight('sentry', [], pilot, level);
  flight.cooldown = flight.droneCooldown = 100;
  flight.invulnerable = 100;
  return flight;
}

function collect(flight, weapon, side = -1) {
  flight.drops.push({ x: flight.player.x + side * .4, y: flight.player.y, weapon });
  flight.collectDrops(0);
  assert.equal(flight.drops.length, 0);
}

test('only the final member of an authored formation drops a weapon, within flight bounds', () => {
  const flight = quietFlight();
  flight.time = .8;
  flight.step(STEP);
  const [left, center, right] = flight.enemies;
  flight.damageEnemy(center, center.hp);
  flight.damageEnemy(left, left.hp);
  assert.equal(flight.drops.length, 0);
  Object.assign(right, { x: 5.5, y: -8 });
  flight.damageEnemy(right, right.hp);
  flight.damageEnemy(right, 1);
  assert.equal(flight.drops.length, 1);
  const [drop] = flight.drops;
  assert.equal(drop.weapon, 'cannon');
  assert(Math.abs(drop.x) <= 3.95 && drop.y >= -7.1 && drop.y <= 6.6);
  assert(!flight.obstacles.overlaps(drop, FIGHTER_HULL));
});

test('a member that escapes forfeits its own formation reward while Pulse clears the next formation', () => {
  const flight = quietFlight();
  flight.time = .8;
  flight.step(STEP);
  const escaped = flight.enemies[0];
  escaped.y = -10;
  flight.step(STEP);
  assert(!flight.enemies.includes(escaped));
  flight.time = 4.8;
  flight.step(STEP);
  assert.equal(flight.enemies.length, 4);
  flight.pulse();
  assert.equal(flight.enemies.length, 0);
  assert.equal(flight.drops.length, 1);
  assert.equal(flight.drops[0].weapon, 'cannon');
});

test('Fleet and Den formations share a reward across all their members', () => {
  for (const [level, time, index] of [['fleet', 2.1, 0], ['den', 7.4, 1]]) {
    const flight = quietFlight(level);
    flight.time = time;
    flight.nextWave = index;
    flight.step(STEP);
    const [first, ...rest] = flight.enemies;
    assert(rest.length > 0);
    flight.damageEnemy(first, first.hp);
    assert.equal(flight.drops.length, 0, level);
    flight.pulse();
    assert.equal(flight.drops.length, 1, level);
    assert.equal(flight.drops[0].weapon, 'homing', level);
  }
});

test('pickups use collection side, preserve an existing matching wing, and reset replacements to base strength', () => {
  const flight = quietFlight();
  collect(flight, 'cannon', 1);
  collect(flight, 'laser', 1);
  assert.deepEqual(flight.wings.map(wing => wing.weapon), ['laser', 'cannon']);

  collect(flight, 'cannon', -1);
  assert.equal(flight.wings[1].upgraded, true);
  assert.equal(flight.droneWeapon, 'sentry');
  collect(flight, 'cannon', -1);
  assert.equal(flight.droneWeapon, 'towline');
  collect(flight, 'cannon');
  assert.equal(flight.score, 250);

  collect(flight, 'omega', 1);
  assert.deepEqual(flight.wings.map(wing => [wing.weapon, wing.upgraded]), [['laser', false], ['omega', false]]);
  collect(flight, 'cannon', 1);
  assert.equal(flight.wings[1].upgraded, false);
  assert.equal(flight.droneWeapon, 'towline');
  assert.equal(flight.score, 250);
});

test('Broodlock can award Brass Towline and bonus hull from its first four clears', () => {
  const flight = quietFlight('broodlock', 'brass');
  const startingHull = flight.hull;
  for (const time of [.8, 4.8, 9.2, 13.5]) {
    flight.time = time;
    flight.step(STEP);
    for (const enemy of flight.enemies) flight.damageEnemy(enemy, enemy.hp);
    assert.equal(flight.drops.length, 1);
    const [drop] = flight.drops;
    flight.player = { x: drop.x, y: drop.y };
    flight.collectDrops(0);
  }
  assert.equal(flight.droneWeapon, 'towline');
  assert.equal(flight.hull, startingHull + 1);
  assert.equal(flight.perkMessage, 'Reinforcement · +1 Hull');
  const score = flight.score;
  collect(flight, 'cannon');
  collect(flight, 'cannon');
  assert.equal(flight.hull, startingHull + 3);
  assert.equal(flight.score, score);
});

test('each Mk II sidearm deals 50 percent more damage through its normal weapon path', () => {
  for (const weapon of ['homing', 'cannon', 'omega', 'laser']) {
    const damage = upgraded => {
      const flight = quietFlight('preserve');
      collect(flight, weapon);
      if (upgraded) collect(flight, weapon);
      const [wing] = flight.wings;
      wing.cooldown = 0;
      const target = { x: flight.wingOrigin(-1).x, y: 0, hp: 100 };
      flight.enemies = [target];
      flight.stepWing(wing, false, .1);
      return weapon === 'laser' ? 100 - target.hp : flight.shots[0].damage;
    };
    assert(Math.abs(damage(true) - damage(false) * 1.5) < 1e-10, weapon);
  }
});

test('Towline adds an independent three-damage pulse to parked Sentry fire', () => {
  const flight = quietFlight('preserve');
  for (let i = 0; i < 3; i++) collect(flight, 'cannon');
  flight.player = { x: -2, y: 0 };
  flight.drone = { x: 2, y: 0 };
  flight.droneCooldown = 0;
  const target = { x: 0, y: 0, hp: 12 };
  flight.enemies = [target];

  flight.stepDroneWeapon(STEP);
  assert.equal(target.hp, 9);
  assert.equal(flight.towlineFlash, .3);
  assert.equal(flight.shots.filter(shot => shot.drone).length, 1);
  flight.stepDroneWeapon(.2);
  assert.equal(target.hp, 9);
  flight.stepDroneWeapon(.25);
  assert.equal(target.hp, 9);
  assert.equal(flight.shots.filter(shot => shot.drone).length, 2);
});
