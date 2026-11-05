import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import * as T from 'three';
import { createServer } from 'vite';

const server = await createServer({ root: new URL('..', import.meta.url).pathname, configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, entries: [] }, appType: 'custom' });
after(() => server.close());
const { createBossLaserContact, createLaserContactTrace } = await server.ssrLoadModule('/src/laser-contact.ts');
const { Flight, BOSS_PROJECTION, STEP } = await server.ssrLoadModule('/src/game.ts');
const solid = new T.MeshBasicMaterial();
const box = (x, y, z, width = 1, height = 1) => {
  const mesh = new T.Mesh(new T.BoxGeometry(width, height, 1), solid);
  mesh.position.set(x, y, z); return mesh;
};

test('a laser meets a raised shell before the simulation hitbox, including a rotated flight plane', () => {
  const plane = new T.Group(); plane.rotation.x = -Math.PI / 2;
  const model = new T.Group(); model.add(box(0, 2, 1, 2, 2)); plane.add(model);
  const origin = { x: 0, y: -5 }, hitbox = { x: 0, y: 2 };
  const contact = createLaserContactTrace(plane)(origin, hitbox, model, 26);
  assert(Math.abs(contact.x) < 1e-6);
  assert(Math.abs(contact.y - 26 / 25.5) < 1e-6);
  assert.deepEqual(hitbox, { x: 0, y: 2 }, 'render tracing must not move the simulation hitbox');
});

test('tracing skips holes inside bounds, hidden parts, and transparent effects', () => {
  const plane = new T.Group(), model = new T.Group(); plane.add(model);
  const split = new T.BufferGeometry();
  split.setAttribute('position', new T.Float32BufferAttribute([-2, 0, 1, -1, 0, 1, -1, 4, 1,
    1, 0, 1, 2, 0, 1, 1, 4, 1], 3));
  model.add(new T.Mesh(split, solid), box(0, 4, 1));
  const hidden = box(0, -2, 1); hidden.visible = false; model.add(hidden);
  const glow = box(0, -3, 1); glow.material = new T.MeshBasicMaterial({ transparent: true }); model.add(glow);
  const contact = createLaserContactTrace(plane)({ x: 0, y: -5 }, { x: 0, y: 4 }, model);
  assert(Math.abs(contact.y - 3.5) < 1e-6);
});

test('a distant model silhouette projects into flight-plane coordinates', () => {
  const plane = new T.Group(), model = new T.Group(); plane.add(model);
  model.position.set(0, 4.2, -12); model.add(box(-2.4, 0, 0, 1.2, 1));
  const x = -2.4 * 22 / 34, end = { x, y: 4.2 * 22 / 34 };
  const contact = createLaserContactTrace(plane)({ x, y: -5 }, end, model, 22);
  assert.equal(contact.x, x);
  assert(contact.y > 2.2 && contact.y < 2.5);
  assert(contact.y < end.y);
});

test('a missed silhouette keeps the beam endpoint and a diagonal beam follows its visible edge', () => {
  const plane = new T.Group(), model = new T.Group(); plane.add(model); model.add(box(2, 2, 1, 2, 2));
  const trace = createLaserContactTrace(plane);
  assert.deepEqual(trace({ x: -2, y: -4 }, { x: -2, y: 2 }, model).toArray(), [-2, 2]);
  const contact = trace({ x: -2, y: -2 }, { x: 2, y: 2 }, model);
  assert(Math.abs(contact.x - 1) < 1e-6 && Math.abs(contact.y - 1) < 1e-6);
});

test('boss contact stays on the animated muzzle instead of the hull silhouette', () => {
  const plane = new T.Group(); plane.rotation.x = -0.7;
  const model = new T.Group(); model.position.set(0, 4.2, -12); plane.add(model);
  const anchors = [-1, 1].map((side) => {
    const anchor = new T.Object3D(); anchor.name = side < 0 ? 'laser_contact_L' : 'laser_contact_R';
    anchor.position.set(side * 2.4, 0, 0.83); model.add(anchor); return anchor;
  });
  model.add(box(0, -2, 1, 7, 1)); // A closer hull edge must not steal muzzle contact.
  const trace = createBossLaserContact(plane, model);
  for (const side of [-1, 1]) {
    let point = trace(side * 2.4, 22);
    assert(Math.abs(point.x - side * 2.4 * 22 / 33.17) < 1e-6);
    assert(Math.abs(point.y - 4.2 * 22 / 33.17) < 1e-6);
    anchors[side < 0 ? 0 : 1].position.z -= 0.29;
    point = trace(side * 2.4, 22);
    assert(Math.abs(point.y - 4.2 * 22 / 33.46) < 1e-6, 'contact follows recoil');
  }
});

test('laser damage is distinguished from simultaneous bullets and clamped at death', () => {
  const flight = new Flight('sentry', ['laser'], 'vex', 'preserve');
  flight.cooldown = flight.droneCooldown = 100;
  const x = flight.wingOrigin(-1).x;
  const enemy = { x, y: 1, lane: x, age: 0, fire: 100, hp: 4 };
  flight.enemies = [enemy];
  flight.shots = [{ x, y: 0.6, z: 0, vx: 0, vy: 30, vz: 0 }];
  flight.step(STEP);
  assert(enemy.laserDamage > 0);
  assert(Math.abs(4 - enemy.hp - enemy.laserDamage - 1) < 1e-6, 'bullet hit is still identifiable');
  enemy.hp = 0.001; const before = enemy.laserDamage;
  flight.step(STEP);
  assert.equal(enemy.hp, 0);
  assert(Math.abs(enemy.laserDamage - before - 0.001) < 1e-6, 'laser overkill does not count as body damage');
});

test('boss laser damage is tracked through a lethal hit', () => {
  for (const level of ['preserve', 'broodlock']) {
    const flight = new Flight('sentry', ['laser'], 'vex', level);
    flight.phase = 'boss'; flight.time = 0.5; flight.cooldown = flight.droneCooldown = 100;
    flight.player.x = flight.exposedCannonX * BOSS_PROJECTION + 1.22;
    flight.step(STEP);
    assert(Math.abs(30 - flight.bossHealth - flight.bossLaserDamage) < 1e-6);
    flight.bossHealth = 0.001; const before = flight.bossLaserDamage;
    flight.step(STEP);
    assert.equal(flight.phase, 'won');
    assert(Math.abs(flight.bossLaserDamage - before - 0.001) < 1e-6);
  }
});
