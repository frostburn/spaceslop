import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import * as T from 'three';
import { createServer } from 'vite';

globalThis.document = {
  createElement() {
    const gradient = () => ({ addColorStop() {} });
    const context = new Proxy({ createLinearGradient: gradient, createRadialGradient: gradient },
      { get: (target, key) => target[key] ?? (() => {}), set: () => true });
    return { width: 0, height: 0, getContext: () => context };
  },
};
globalThis.Path2D = class {
  moveTo() {}
  lineTo() {}
  closePath() {}
};

const server = await createServer({ configFile: false, define: { __ENCOUNTER_TEXTURES__: '{}' },
  server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());

const { Flight, STEP, BOSS_CAMERA_DISTANCE } = await server.ssrLoadModule('/src/game.ts');
const { PATTERN_BULLET_CAPACITY } = await server.ssrLoadModule('/src/challenge-patterns.ts');
const { FLEET_SAUCER_POOL, broadsideShots, broadsideGuns } = await server.ssrLoadModule('/src/fleet/combat.ts');
const { FLEET_BOSS_MOUNTS, fleetBossPose } = await server.ssrLoadModule('/src/fleet/boss.ts');
const { FLEET_TRENCH_AT, projectedSaucerMount } = await server.ssrLoadModule('/src/fleet/route.ts');
const { fleetChallengeBoss, fleetChallengeGunSignal } = await server.ssrLoadModule('/src/fleet/challenge.ts');
const { DEN_PATROL_POOL } = await server.ssrLoadModule('/src/den/patrol.ts');
const { DEN_GUNS, denMount, denPose } = await server.ssrLoadModule('/src/den/combat.ts');
const { DEN_MINE_FUSE, denMinePose, denTurretSites } = await server.ssrLoadModule('/src/den/defense.ts');
const { denScroll } = await server.ssrLoadModule('/src/den/route.ts');
const { denChallengeBoss } = await server.ssrLoadModule('/src/den/challenge.ts');

function launch(level, mode = 'bullet-hell') {
  const flight = new Flight('sentry', [], 'vex', level, () => .5, mode);
  flight.player = { x: 0, y: -5.8 };
  flight.cooldown = flight.droneCooldown = flight.invulnerable = Infinity;
  return flight;
}

function advance(flight, time) {
  while (flight.time < time) flight.step(STEP);
}

function atBoss(level) {
  const f = launch(level);
  f.time = f.stageDuration;
  f.step(0);
  f.step(f.transitionDuration);
  assert.equal(f.phase, 'boss');
  f.cooldown = f.droneCooldown = Infinity;
  return f;
}

function comesFrom(shot, origin) {
  return Math.hypot(shot.x - shot.vx * STEP - origin.x, shot.y - shot.vy * STEP - origin.y) < 1e-8;
}

test('the last two patrols increase fire after Lantern Grove within the warmed pools', () => {
  let previousRate = 0;
  for (const level of ['biolume', 'fleet', 'den']) {
    const flight = launch(level), shots = new Set(), turretSites = new Set(), rewards = new Set();
    while (flight.phase === 'stage') {
      flight.player.x = 1.75 * Math.sin(flight.time * .58);
      flight.step(STEP);
      assert(flight.enemies.filter(e => e.fleet && e.age >= 0 && e.y <= 9.2).length <= FLEET_SAUCER_POOL);
      assert(flight.enemies.filter(e => e.den && e.age >= 0).length <= DEN_PATROL_POOL);
      assert(flight.threats.length < PATTERN_BULLET_CAPACITY);
      for (const enemy of flight.enemies) {
        if (enemy.denTurret) turretSites.add(enemy.denTurret.site);
        if (enemy.reward && (enemy.den || enemy.fleet)) rewards.add(enemy.reward.weapon);
      }
      for (const shot of flight.threats) shots.add(shot);
    }
    const rate = shots.size / flight.stageDuration;
    assert(rate > previousRate);
    previousRate = rate;
    if (level === 'biolume') continue;
    assert(shots.size > 2900 && [...shots].every(s => s.planar && s.pattern && Math.hypot(s.vx, s.vy) < 5.9));
    assert.deepEqual([...rewards].sort(), ['cannon', 'homing', 'laser', 'omega']);
    assert.equal(flight.phase, 'approach');
    assert.equal(flight.threats.length, 0);
    if (level === 'den') assert.equal(turretSites.size, denTurretSites.length);
  }
});

test('broadsides fire paired shots from the scheduled barrels after a trench shortcut', () => {
  const f = launch('fleet');
  f.time = FLEET_TRENCH_AT;
  f.step(0);
  assert.equal(f.threats.length, 0);
  const nextShot = Math.min(...broadsideGuns.flatMap(gun => gun.fires.filter(time => time > FLEET_TRENCH_AT)));
  advance(f, nextShot - STEP);
  const old = new Set(f.threats), previous = f.time;
  f.step(STEP);
  const bolts = broadsideShots(previous, f.time);
  assert(bolts.length > 0);
  for (const bolt of bolts) {
    const shots = f.threats.filter(s => !old.has(s) && comesFrom(s, bolt));
    assert.equal(shots.length, 2);
    assert.deepEqual(new Set(shots.map(s => s.pattern)), new Set(['primary', 'accent']));
    assert(shots.every(s => Math.sign(s.vx) === Math.sign(bolt.vx) && s.vy < 0));
  }
});

test('cliff mines retain their fuse and emit one six-spoke burst', () => {
  const f = launch('den'), mine = f.denMines[0];
  f.time = 6;
  const position = denMinePose(0, mine, denScroll(f.time), f.time);
  f.player = { x: position.x, y: position.y - .6 };
  f.step(STEP);
  assert.equal(mine.armedAt, f.time);
  f.pulse();
  f.player.x = 3.9;
  while (f.time + STEP < mine.armedAt + DEN_MINE_FUSE) f.step(STEP);
  assert.equal(mine.burstAt, undefined);
  f.step(STEP);
  assert.equal(mine.burstAt, f.time);
  const spokes = f.threats.filter(s => Math.abs(Math.hypot(s.vx, s.vy) - 4.25) < 1e-8);
  const branches = f.threats.filter(s => Math.abs(Math.hypot(s.vx, s.vy) - 3.27) < 1e-8);
  assert.equal(spokes.length, 6);
  assert.equal(branches.length, 12);
  assert(spokes.every(s => s.pattern === 'primary') && branches.every(s => s.pattern === 'accent'));
  f.step(STEP);
  assert.equal(f.threats.filter(s => Math.abs(Math.hypot(s.vx, s.vy) - 4.25) < 1e-8).length, 6);
});

test('the command saucer warns at its side ports before opening the pulse wheel', () => {
  const f = atBoss('fleet'), pattern = fleetChallengeBoss;
  advance(f, .86);
  assert(fleetChallengeGunSignal(f.fleetBossTime, 0).charge > 0);
  assert.equal(fleetChallengeGunSignal(f.fleetBossTime, 2).charge, 0);
  assert.equal(f.threats.length, 0);
  advance(f, pattern.first);
  assert.equal(f.threats.length, 22);
  for (const port of [0, 1]) {
    const origin = projectedSaucerMount(fleetBossPose(f.fleetBossTime), FLEET_BOSS_MOUNTS[port]);
    const side = f.threats.filter(s => s.pattern === (port ? 'accent' : 'primary'));
    assert.equal(side.length, 11);
    assert(side.every(s => comesFrom(s, origin)));
  }
  let wheel;
  while (!wheel?.length && f.time < pattern.interval - 1) {
    const old = new Set(f.threats);
    f.step(STEP);
    const origin = projectedSaucerMount(fleetBossPose(f.fleetBossTime), FLEET_BOSS_MOUNTS[2]);
    wheel = f.threats.filter(s => !old.has(s) && comesFrom(s, origin));
  }
  assert(wheel.length > 20 && wheel.some(s => s.vy > 0) && wheel.some(s => s.vy < 0));
  f.pulse();
  assert(f.bossTorrentCancelled && f.threats.length === 0);
  advance(f, pattern.interval - STEP);
  assert.equal(f.threats.length, 0);
  advance(f, pattern.interval + pattern.first);
  assert(!f.bossTorrentCancelled && f.threats.length > 0);
});

test('the Gantry Chief fires from both guns during the posed sweep', () => {
  const f = atBoss('den'), pattern = denChallengeBoss;
  advance(f, .84);
  assert(f.markers.length && !f.threats.length);
  advance(f, pattern.first + .58);
  const active = new Set(f.threats);
  while (f.threats.every(s => active.has(s)) && f.time < 2.25) f.step(STEP);
  const row = f.threats.filter(s => !active.has(s));
  assert.equal(row.length, 24);
  for (const [index, gun] of DEN_GUNS.entries()) {
    const origin = denMount(denPose(f.denBossTime), gun);
    const bank = row.filter(s => s.pattern === (index ? 'accent' : 'primary'));
    assert.equal(bank.length, 12);
    assert(bank.every(s => comesFrom(s, origin)));
  }
  advance(f, pattern.interval * 5);
  assert(f.threats.length < PATTERN_BULLET_CAPACITY);
  f.pulse();
  advance(f, pattern.interval * 5 + pattern.first);
  assert(f.bossTorrentCancelled && f.threats.length === 0);
});

test('both bosses and their warnings render with procedural assets and the warmed bullet batch', async () => {
  const { FlightView } = await server.ssrLoadModule('/src/view.ts');
  const { createPatternProjectileBatch, createProjectileBatch, projectileKinds } = await server.ssrLoadModule('/src/projectile-graphics.ts');
  const { disposeScene } = await server.ssrLoadModule('/src/rendering/dispose.ts');
  for (const [level, time, shape] of [['fleet', fleetChallengeBoss.first + .25, 'pearl'],
    ['den', denChallengeBoss.first + .25, 'ember']]) {
    const { createLevel } = await server.ssrLoadModule('/src/rendering/levels/' + level + '.ts');
    const scene = new T.Scene(), plane = new T.Group();
    scene.add(plane);
    const stage = createLevel({ plane, scene, fighter: new T.Group(), signal: new AbortController().signal });
    const patternProjectiles = createPatternProjectileBatch({ primary: 0xffac57, accent: 0xabadff, shape });
    const projectiles = Object.fromEntries(projectileKinds.map(kind => [kind, createProjectileBatch(kind)]));
    plane.add(stage.root, patternProjectiles.root, ...Object.values(projectiles).map(batch => batch.root));
    try {
      await stage.ready;
      const f = atBoss(level);
      advance(f, time);
      const levelTime = f.stageDuration + f.transitionDuration + f.bossTime;
      stage.update({ flight: f, time: levelTime, reveal: 1, distance: BOSS_CAMERA_DISTANCE,
        animationTime: levelTime, elapsed: 0, newFlight: true, fighterSpeed: 0, droneSpeed: 0 });
      assert(stage.boss.visible);
      if (level === 'den') assert(stage.boss.getObjectByName('gantry-gun-flash-0').visible);
      FlightView.prototype.drawProjectiles.call({ projectiles, patternProjectiles, animationTime: levelTime }, f);
      assert(f.threats.length > 0 && patternProjectiles.root.visible);
      assert.equal(patternProjectiles.root.children[0].count, f.threats.length);
      assert(!projectiles.hostile.root.visible);
    } finally {
      stage.dispose?.();
      disposeScene(scene);
    }
  }
});
