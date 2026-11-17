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
const { fieldBullet } = await server.ssrLoadModule('/src/bullet-field.ts');
const { sectorBest, recordSectorClear } = await server.ssrLoadModule('/src/campaign/sector-records.ts');

function bullet(flight, dx = .5) {
  return { x: flight.player.x + dx, y: flight.player.y, z: 0, vx: 0, vy: 0, vz: 0, planar: true, pattern: 'primary' };
}

function pass(flight, shot = bullet(flight)) {
  flight.threats = [shot];
  flight.step(STEP);
  shot.x = flight.player.x + 1.2;
  flight.step(STEP);
  return shot;
}

test('each live shot charges once on a clean pass, for every pilot', () => {
  for (const pilot of ['vex', 'brass', 'glint']) {
    const f = new Flight('sentry', [], pilot, 'boulevard');
    const shot = pass(f);
    shot.x = f.player.x + .5;
    pass(f, shot);
    assert.equal(f.graze.count, 1);
    for (let i = 0; i < 5; i++) pass(f);
    assert.equal(f.graze.charge, 4);
    assert.equal(f.graze.count, 6);
    assert.equal(f.score, 0);
    assert.equal(f.charges, pilot === 'vex' ? 3 : 2);

    f.damageEnemy({ x: 1, y: 1, hp: 1 }, 1);
    assert.equal(f.score, 200);
    assert.equal(f.graze.banked, 100);
    assert.equal(f.graze.charge, 0);
    pass(f);
    f.enemies = [{ x: 1, y: 1, hp: 2 }, { x: -1, y: 1, hp: 2 }];
    f.pulse();
    assert.equal(f.score, 425);
    assert.equal(f.graze.banked, 125);
  }
});

test('hits discard only unbanked charge, protected passes and cleared shots earn nothing', () => {
  const f = new Flight('sentry', [], 'brass', 'boulevard');
  pass(f);
  f.damageEnemy({ x: 0, y: 2, hp: 1 }, 1);
  pass(f);
  f.threats = [bullet(f, 0)];
  f.step(STEP);
  assert.equal(f.hull, 3);
  assert.equal(f.graze.charge, 0);
  assert.equal(f.graze.banked, 25);
  pass(f);
  assert.equal(f.graze.count, 2);
  f.invulnerable = 0;
  f.threats = [bullet(f)];
  f.step(STEP);
  f.pulse();
  f.step(STEP);
  assert.equal(f.graze.count, 2);
});

test('depth shots graze at the fighter plane and hollow fields must first be live', () => {
  const depth = new Flight('sentry', [], 'glint', 'broodlock');
  depth.phase = 'boss';
  depth.threats = [{ ...bullet(depth, .8), z: -1.5 * STEP, vz: 1, planar: false, pattern: undefined }];
  depth.step(STEP);
  assert.equal(depth.graze.count, 0);
  depth.step(STEP);
  assert.equal(depth.graze.count, 1);
  assert.equal(depth.threats.length, 0);

  const f = new Flight('sentry', [], 'brass', 'boulevard');
  const point = { ...f.player, x: f.player.x + .45 };
  const pellet = fieldBullet(point, point, 0, 0, 'primary');
  f.threats = [pellet];
  f.step(STEP);
  f.player.x -= 1;
  f.step(STEP);
  assert.equal(f.graze.count, 0);
  f.player.x += 1;
  pellet.age = pellet.field.fillAt + .4;
  f.step(STEP);
  assert.equal(f.graze.charge, 0);
  pellet.age += .8;
  f.step(STEP);
  f.step(STEP);
  assert.equal(f.graze.count, 1);
  assert.equal(f.hull, 4);
});

test('boss quarters bank once even when one hit crosses several or ends a rematch', () => {
  const f = new Flight('sentry', [], 'glint', 'wormhole');
  f.time = f.stageDuration;
  f.step(0);
  f.step(f.transitionDuration);
  const quarter = f.bossMaxHealth / 4;
  pass(f);
  f.damageBoss(quarter - .25);
  assert.equal(f.graze.charge, 1);
  f.damageBoss(.25, true);
  assert.equal(f.score, 25);
  pass(f);
  f.damageBoss(quarter * 2);
  assert.equal(f.score, 50);
  pass(f);
  f.damageBoss(quarter);
  assert.equal(f.phase, 'approach');
  assert.equal(f.score, 1075);
  assert.equal(f.graze.charge, 0);
  assert.equal(f.graze.banked, 75);
  f.step(f.transitionDuration);
  assert.equal(f.graze.count, 3);
});

test('lingering at the Lantern Ray cannot bank grazes or collect unlimited seeker bounties', () => {
  const f = new Flight('sentry', [], 'brass', 'biolume');
  f.phase = 'boss';
  pass(f);
  const seeker = () => ({ x: 1, y: 2, hp: 1, rayOrb: { heading: 0 } });
  for (let i = 0; i < 3; i++) f.damageEnemy(seeker(), 1);
  assert.equal(f.score, 50);
  assert.equal(f.graze.charge, 1);
  assert.equal(f.threats.filter(s => !s.pattern).length, 24);
  f.damageBoss(f.bossMaxHealth / 4);
  f.damageEnemy(seeker(), 1);
  assert.equal(f.score, 100);
  assert.equal(f.graze.banked, 25);
});

function installStorage(t, get) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  });
}

test('sector records compare full scores independently, including ties and newer saved clears', async t => {
  const values = new Map();
  installStorage(t, () => ({
    getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
  }));
  assert.equal(await recordSectorClear('boulevard', 'regular', 3200), undefined);
  assert.equal(await recordSectorClear('boulevard', 'regular', 3000), 3200);
  assert.equal(await recordSectorClear('boulevard', 'regular', 3200), 3200);
  assert.equal(await recordSectorClear('boulevard', 'regular', 3650), 3200);
  assert.equal(sectorBest('boulevard', 'regular'), 3650);
  assert.equal(sectorBest('heliostat', 'regular'), undefined);
  assert.equal(sectorBest('boulevard', 'hardcore'), undefined);
  values.set('spaceslop.sector-best.regular.boulevard', '5900');
  assert.equal(await recordSectorClear('boulevard', 'regular', 4600), 5900);
  for (const corrupt of ['', '-1', '25.5', 'NaN', '9007199254740992']) {
    values.set('spaceslop.sector-best.bullet-hell.boulevard', corrupt);
    assert.equal(sectorBest('boulevard', 'bullet-hell'), undefined);
  }
});

test('sector records survive a denied storage API for the rest of the session', async t => {
  installStorage(t, () => { throw new Error('Storage unavailable'); });
  assert.equal(await recordSectorClear('den', 'hardcore', 1050), undefined);
  assert.equal(await recordSectorClear('den', 'hardcore', 850), 1050);
  assert.equal(sectorBest('den', 'hardcore'), 1050);
});
