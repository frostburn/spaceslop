import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import * as T from 'three';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, define: { __ENCOUNTER_TEXTURES__: '{}' },
  server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { Flight, STEP, BOSS_DEPTH, BOSS_CAMERA_DISTANCE } = await server.ssrLoadModule('/src/game.ts');
const { PATTERN_BULLET_CAPACITY } = await server.ssrLoadModule('/src/challenge-patterns.ts');
const { FLYER_POOL } = await server.ssrLoadModule('/src/preserve-flyer.ts');
const { AMBUSHER_POOL } = await server.ssrLoadModule('/src/preserve-ambusher.ts');
const { GROUNDSKEEPER_CYCLE, GROUNDSKEEPER_STRIKE } = await server.ssrLoadModule('/src/groundskeeper.ts');
const { preserveChallengeBoss } = await server.ssrLoadModule('/src/preserve-challenge.ts');
const { SUMMER_AIR_POOL, SUMMER_HYDRA_POOL } = await server.ssrLoadModule('/src/summer/combat.ts');
const { VORTEX_POOL } = await server.ssrLoadModule('/src/summer/vortex.ts');
const { HYDRA_BOSS_SIZE, HYDRA_SIDES, hydraBossHead, hydraCrown } = await server.ssrLoadModule('/src/summer/hydra-targets.ts');
const { lotusChallengeBoss } = await server.ssrLoadModule('/src/summer/challenge.ts');

function launch(level, mode = 'bullet-hell') {
  const flight = new Flight('sentry', [], 'vex', level, () => .5, mode);
  flight.cooldown = flight.droneCooldown = flight.invulnerable = 1e5;
  return flight;
}

function stepTo(flight, time) {
  while (flight.time < time && flight.phase === 'boss') flight.step(STEP);
}

function stepToVolley(flight, deadline) {
  while (flight.threats.length === 0 && flight.time < deadline && flight.phase === 'boss') flight.step(STEP);
}

function atBoss(level, mode) {
  const flight = launch(level, mode);
  flight.time = flight.stageDuration;
  flight.step(0);
  flight.step(flight.transitionDuration);
  assert.equal(flight.phase, 'boss');
  flight.cooldown = flight.droneCooldown = 1e5;
  return flight;
}

test('Greenhouse and Lotus patrols fill the playfield while fitting the warmed pools', () => {
  const stages = [
    ['ice', []],
    ['preserve', [[e => e.flyer, FLYER_POOL], [e => e.raptor, 3], [e => e.ambusher, AMBUSHER_POOL]]],
    ['summer', [[e => e.summer?.kind === 'scout', SUMMER_AIR_POOL / 2], [e => e.summer?.kind === 'drone', SUMMER_AIR_POOL / 2],
      [e => e.summer?.kind === 'hydra', SUMMER_HYDRA_POOL], [e => e.summer?.kind === 'vortex', VORTEX_POOL]]],
  ];
  let previousDensity = 0;
  for (const [level, pools] of stages) {
    const flight = launch(level);
    const regular = launch(level, 'regular');
    assert.equal(flight.stageDuration, regular.stageDuration);
    assert.equal(flight.transitionDuration, regular.transitionDuration);
    assert(flight.bossMaxHealth > regular.bossMaxHealth);
    const shots = new Set(), weapons = new Set();
    let fieldTotal = 0, frames = 0;
    while (flight.phase === 'stage') {
      flight.step(STEP);
      fieldTotal += flight.threats.length;
      frames++;
      assert(flight.threats.length <= PATTERN_BULLET_CAPACITY);
      for (const [matches, capacity] of pools) assert(flight.enemies.filter(matches).length <= capacity, level);
      for (const enemy of flight.enemies) if (enemy.reward) weapons.add(enemy.reward.weapon);
      for (const shot of flight.threats) shots.add(shot);
    }
    const density = fieldTotal / frames;
    assert(density > previousDensity, level);
    previousDensity = density;
    assert(shots.size / flight.stageDuration >= 22, level);
    assert.equal(weapons.size, 4);
    assert.deepEqual(new Set([...shots].map(s => s.pattern)), new Set(['primary', 'accent']));
    for (const shot of shots) assert(shot.planar && Math.hypot(shot.vx, shot.vy) < 5.5, level);
  }
});

test('the Groundskeeper keeps its physical rake and fires the feather torrent in recovery', () => {
  const flight = atBoss('preserve');
  flight.invulnerable = 0;
  stepTo(flight, GROUNDSKEEPER_STRIKE + .8);
  assert.equal(flight.hull, 3);
  assert.equal(flight.threats.length, 0);
  flight.invulnerable = 1e5;
  stepTo(flight, preserveChallengeBoss.lockAt + .16);
  assert(flight.groundskeeperFeatherCharge > 0 && flight.markers.length === 1);
  stepToVolley(flight, preserveChallengeBoss.first + .1);
  assert.equal(flight.threats.length, 20);
  const origins = flight.threats.map(s => s.x - s.vx * STEP);
  assert(origins[0] < 0 && origins.every(x => Math.abs(x - origins[0]) < 1e-8));
  flight.pulse();
  stepTo(flight, GROUNDSKEEPER_CYCLE + .1);
  assert.equal(flight.threats.length, 0);
  assert.equal(flight.groundskeeperFeatherCharge, 0);
  stepToVolley(flight, GROUNDSKEEPER_CYCLE + preserveChallengeBoss.first + .1);
  assert(flight.threats.every(s => s.x - s.vx * STEP > 0));
  assert(flight.threats.length > 0);
});

test('Lotus Hydra fires from its posed crowns and silences a destroyed head mid-volley', () => {
  const flight = atBoss('summer', 'hardcore');
  const headHP = flight.summerHeadMaxHealth;
  assert.equal(flight.hull, 1);
  assert.deepEqual(flight.summerHydra.hp, [headHP, headHP, headHP]);
  assert.equal(flight.bossHealth, headHP * 3);
  stepToVolley(flight, lotusChallengeBoss.first + .1);
  assert.equal(flight.threats.length, 8);
  const crown = hydraCrown(hydraBossHead(flight.time, -1), HYDRA_BOSS_SIZE);
  const scale = BOSS_CAMERA_DISTANCE / (BOSS_CAMERA_DISTANCE - BOSS_DEPTH - crown.z);
  for (const shot of flight.threats) {
    assert(Math.abs(shot.x - shot.vx * STEP - crown.x * scale) < 1e-8);
    assert(Math.abs(shot.y - shot.vy * STEP - crown.y * scale) < 1e-8);
  }
  stepTo(flight, lotusChallengeBoss.first + .6);
  const emitted = new Set(flight.threats);
  assert([...emitted].some(s => s.pattern === 'accent'));
  flight.damageBoss(headHP, false, 0);
  assert.equal(flight.bossHealth, headHP * 2);
  assert.equal(flight.summerHeadCharge(0), 0);
  stepTo(flight, lotusChallengeBoss.first + 1.2);
  const newShots = flight.threats.filter(s => !emitted.has(s));
  assert(newShots.length > 0 && newShots.every(s => s.pattern === 'primary'));
  flight.pulse();
  stepTo(flight, lotusChallengeBoss.interval);
  assert.equal(flight.threats.length, 0);
  assert(HYDRA_SIDES.every(side => flight.summerHeadCharge(side) === 0));
  stepTo(flight, lotusChallengeBoss.interval + lotusChallengeBoss.first + .05);
  assert(flight.threats.length > 0);
  flight.damageBoss(headHP, false, -1);
  flight.damageBoss(headHP, false, 1);
  assert.equal(flight.phase, 'won');
});

test('procedural bosses render the active launch points and the challenge bullets use their own batch', async () => {
  const { createLevel: createPreserve } = await server.ssrLoadModule('/src/rendering/levels/preserve.ts');
  const { createLevel: createSummer } = await server.ssrLoadModule('/src/rendering/levels/summer.ts');
  const { disposeScene } = await server.ssrLoadModule('/src/rendering/dispose.ts');
  const { FlightView } = await server.ssrLoadModule('/src/view.ts');
  const { createPatternProjectileBatch, createProjectileBatch, projectileKinds } = await server.ssrLoadModule('/src/projectile-graphics.ts');
  const stageChecks = [
    { level: 'preserve', createLevel: createPreserve, pattern: preserveChallengeBoss, shape: 'feather' },
    { level: 'summer', createLevel: createSummer, pattern: lotusChallengeBoss, shape: 'petal' },
  ];
  for (const { level, createLevel, pattern, shape } of stageChecks) {
    const scene = new T.Scene(), plane = new T.Group();
    scene.add(plane);
    const stage = createLevel({ plane, scene, fighter: new T.Group(), signal: new AbortController().signal });
    plane.add(stage.root);
    const patternProjectiles = createPatternProjectileBatch({ primary: 0xffa842, accent: 0xef91ff, shape });
    const projectiles = Object.fromEntries(projectileKinds.map(kind => [kind, createProjectileBatch(kind)]));
    plane.add(patternProjectiles.root, ...Object.values(projectiles).map(batch => batch.root));
    try {
      await stage.ready;
      const flight = atBoss(level);
      stepToVolley(flight, pattern.first + .1);
      const time = flight.stageDuration + flight.transitionDuration + flight.bossTime;
      stage.update({ flight, time, reveal: 1, distance: BOSS_CAMERA_DISTANCE, animationTime: time, elapsed: 0,
        newFlight: true, fighterSpeed: 0, droneSpeed: 0 });
      if (level === 'preserve') {
        const glows = stage.boss.getObjectsByProperty('name', 'pattern-charge').filter(node => node.visible);
        assert.equal(glows.length, 1);
        assert(glows[0].getWorldPosition(new T.Vector3()).x < 0);
      } else {
        const bars = stage.boss.children.filter(node => node.geometry?.type === 'PlaneGeometry');
        assert.equal(bars.length, 3);
        assert(bars.every(bar => Math.abs(bar.scale.x - .8 * HYDRA_BOSS_SIZE) < 1e-8));
      }
      FlightView.prototype.drawProjectiles.call({ projectiles, patternProjectiles, animationTime: time }, flight);
      assert(patternProjectiles.root.visible);
      assert.equal(patternProjectiles.root.children[0].count, flight.threats.length);
      assert(!projectiles.hostile.root.visible);
    } finally {
      stage.dispose?.();
      disposeScene(scene);
    }
  }
});
