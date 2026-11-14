import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import * as T from 'three';
import { createServer } from 'vite';

globalThis.document = {
  createElement() {
    const context = new Proxy({}, { get: () => () => {}, set: () => true });
    return { width: 0, height: 0, getContext: () => context };
  },
};
const server = await createServer({ configFile: false, define: { __ENCOUNTER_TEXTURES__: '{}' },
  server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { Flight, STEP, BOSS_CAMERA_DISTANCE } = await server.ssrLoadModule('/src/game.ts');
const { PATTERN_BULLET_CAPACITY } = await server.ssrLoadModule('/src/challenge-patterns.ts');
const { BOULEVARD_POOL, BOULEVARD_PITCH, boulevardBossPoint } = await server.ssrLoadModule('/src/boulevard.ts');
const { MINE_POOL, mineSites } = await server.ssrLoadModule('/src/boulevard-mines.ts');
const { boulevardChallengeBoss } = await server.ssrLoadModule('/src/boulevard-challenge.ts');
const { GROVE_ENEMY_POOL, groveWaves } = await server.ssrLoadModule('/src/biolume/combat.ts');
const { FROG_POOL } = await server.ssrLoadModule('/src/biolume/frog.ts');
const { RAY_ENTRANCE, RAY_SEEKER_HP, rayOrgan } = await server.ssrLoadModule('/src/biolume/lantern-ray.ts');
const { GROVE_CHALLENGE_SEEKER_AT, groveChallengeBoss } = await server.ssrLoadModule('/src/biolume/challenge.ts');

function launch(level, mode = 'bullet-hell') {
  const f = new Flight('sentry', [], 'vex', level, () => .5, mode);
  f.cooldown = f.droneCooldown = f.invulnerable = 1e5;
  f.player.y = -5.6;
  return f;
}

function boss(level) {
  const f = launch(level);
  f.time = f.stageDuration;
  f.step(0);
  if (f.phase === 'approach') f.step(f.transitionDuration);
  assert.equal(f.phase, 'boss');
  f.cooldown = f.droneCooldown = 1e5;
  return f;
}

function advance(f, time) {
  while (f.time < time) f.step(STEP);
}

test('the new patrols ramp up from Lotus Thaw within their warmed actor and shot pools', () => {
  function sample(level, mode) {
    const f = launch(level, mode), actors = new Set(), shots = new Set();
    let activeShots = 0, frames = 0;
    while (f.phase === 'stage') {
      f.player.x = 2.3 * Math.sin(f.time * .63);
      f.step(STEP);
      const cars = f.enemies.filter(e => e.boulevard);
      assert(cars.filter(e => !e.boulevard.heavy && e.boulevard.formation !== 'intercept').length <= BOULEVARD_POOL);
      assert(cars.filter(e => e.boulevard.heavy).length <= 3);
      assert(cars.filter(e => e.boulevard.formation === 'intercept').length <= 4);
      assert(f.enemies.filter(e => e.mine).length <= MINE_POOL);
      assert(f.enemies.filter(e => e.frog).length <= FROG_POOL);
      assert(f.enemies.filter(e => e.grove && !e.frog).length <= GROVE_ENEMY_POOL);
      assert(f.threats.length < PATTERN_BULLET_CAPACITY);
      activeShots += f.threats.length;
      frames++;
      for (const e of f.enemies) actors.add(e);
      for (const shot of f.threats) shots.add(shot);
    }
    return { rate: shots.size / f.stageDuration, density: activeShots / frames, actors: [...actors], shots: [...shots] };
  }

  const lotus = sample('summer');
  const boulevard = sample('boulevard'), grove = sample('biolume');
  assert(boulevard.rate > lotus.rate && grove.rate > boulevard.rate);
  assert(boulevard.density > lotus.density && grove.density > boulevard.density);
  assert.deepEqual(boulevard.actors.filter(e => e.mine).map(e => e.mine.site), mineSites.map((_, i) => i));
  assert.deepEqual(grove.actors.filter(e => e.frog).map(e => e.grove.anchor),
    groveWaves.filter(w => w.grove.kind === 'frog').map(w => w.grove.anchor));
  for (const [level, result] of [['boulevard', boulevard], ['biolume', grove]]) {
    assert(result.shots.every(s => s.planar && s.pattern && Math.hypot(s.vx, s.vy) < 5.9));
    assert.deepEqual(new Set(result.actors.map(e => e.reward?.weapon).filter(Boolean)), new Set(['homing', 'cannon', 'laser', 'omega']));
    assert(sample(level, 'regular').shots.every(s => s.pattern === undefined));
  }
});

test('the cruiser warns, fires from both modeled cannons, then crosses the two streams', async () => {
  const { createPursuitCruiser } = await server.ssrLoadModule('/src/boulevard-rigs.ts');
  const { createBoulevardMaterials } = await server.ssrLoadModule('/src/boulevard-materials.ts');
  const { CRUISER_MUZZLE_Y } = await server.ssrLoadModule('/src/boulevard.ts');
  const { disposeScene } = await server.ssrLoadModule('/src/rendering/dispose.ts');
  const rig = createPursuitCruiser(createBoulevardMaterials());
  const f = boss('boulevard'), pattern = boulevardChallengeBoss;
  advance(f, .85);
  assert(f.cannonWindup > 0 && f.markers.length === 1 && f.threats.length === 0);
  advance(f, pattern.first);
  const time = f.stageDuration + f.transitionDuration + f.time;
  const hull = boulevardBossPoint(time, 1);
  rig.root.position.set(hull.x, hull.y, hull.z);
  rig.root.rotation.x = -BOULEVARD_PITCH;
  rig.pose(time, f.cannonWindup, 1);
  const shots = f.threats;
  assert.equal(shots.length, 22);
  for (const [i, { rotor }] of rig.guns.entries()) {
    const origin = rotor.localToWorld(new T.Vector3(0, CRUISER_MUZZLE_Y, 0));
    const scale = BOSS_CAMERA_DISTANCE / (BOSS_CAMERA_DISTANCE - origin.z);
    const row = shots.filter(s => s.pattern === (i === 0 ? 'primary' : 'accent'));
    assert.equal(row.length, 11);
    assert(row.every(s => Math.hypot(s.x - s.vx * STEP - origin.x * scale, s.y - s.vy * STEP - origin.y * scale) < 1e-8));
  }
  disposeScene(rig.root);
  const landingX = (shot, y) => shot.x + (y - shot.y) * shot.vx / shot.vy;
  assert(Math.max(...shots.filter(s => s.pattern === 'primary').map(s => landingX(s, -5.55))) <
    Math.min(...shots.filter(s => s.pattern === 'accent').map(s => landingX(s, -5.55))));
  f.pulse();
  assert.equal(f.cannonWindup, 0);
  advance(f, pattern.interval - .05);
  assert.equal(f.threats.length, 0);
  advance(f, pattern.interval + pattern.first);
  assert(Math.min(...f.threats.filter(s => s.pattern === 'primary').map(s => landingX(s, -5.55))) >
    Math.max(...f.threats.filter(s => s.pattern === 'accent').map(s => landingX(s, -5.55))));
});

test('the Lantern Ray lights its firing organ and releases a shootable seeker in the lull', async () => {
  const f = boss('biolume'), pattern = groveChallengeBoss;
  const { createLanternRay } = await server.ssrLoadModule('/src/biolume/lantern-ray-rig.ts');
  const { disposeScene } = await server.ssrLoadModule('/src/rendering/dispose.ts');
  const rig = createLanternRay();
  advance(f, RAY_ENTRANCE + .84);
  rig.pose(f.rayTime, false, f.rayAttackSignal);
  assert(rig.glow.fan.value > 0 && f.threats.length === 0);
  assert.equal(rig.glow.side.value, -1);
  advance(f, RAY_ENTRANCE + pattern.first);
  assert.equal(f.threats.length, 24);
  const organ = rayOrgan(f.rayTime, -1);
  assert(f.threats.every(s => Math.hypot(s.x - s.vx * STEP - organ.x, s.y - s.vy * STEP - organ.y) < 1e-8));
  advance(f, RAY_ENTRANCE + GROVE_CHALLENGE_SEEKER_AT - .15);
  assert(f.rayAttackSignal.seeker > 0 && f.rayAttackSignal.fan === 0);
  assert(!f.enemies.some(e => e.rayOrb));
  advance(f, RAY_ENTRANCE + GROVE_CHALLENGE_SEEKER_AT + .01);
  const seeker = f.enemies.find(e => e.rayOrb);
  assert(seeker?.x > 0 && seeker.hp === RAY_SEEKER_HP);
  const count = f.threats.length;
  f.damageEnemy(seeker, RAY_SEEKER_HP);
  const seeds = f.threats.slice(count);
  assert.equal(seeds.length, 12);
  assert.deepEqual(new Set(seeds.map(s => s.pattern)), new Set(['primary', 'accent']));
  advance(f, RAY_ENTRANCE + pattern.interval + .82);
  assert.equal(f.rayAttackSignal.side, 1);
  assert(f.cannonWindup > 0);
  f.pulse();
  assert.equal(f.rayAttackSignal.fan, 0);
  advance(f, RAY_ENTRANCE + pattern.interval * 2 - .05);
  assert.equal(f.threats.length, 0);
  assert(f.enemies.some(e => e.rayOrb), 'the other organ still launches its lantern');
  rig.release();
  disposeScene(rig.root);
});

test('both procedural levels draw the volleys in the challenge instance batch', async () => {
  const { FlightView } = await server.ssrLoadModule('/src/view.ts');
  const { createPatternProjectileBatch, createProjectileBatch, projectileKinds } = await server.ssrLoadModule('/src/projectile-graphics.ts');
  const { disposeScene } = await server.ssrLoadModule('/src/rendering/dispose.ts');
  for (const [level, time, shape] of [['boulevard', boulevardChallengeBoss.first + .6, 'shard'],
    ['biolume', RAY_ENTRANCE + groveChallengeBoss.first + .6, 'seed']]) {
    const { createLevel } = await server.ssrLoadModule('/src/rendering/levels/' + level + '.ts');
    const scene = new T.Scene(), plane = new T.Group();
    scene.add(plane);
    const stage = createLevel({ plane, scene, fighter: new T.Group(), signal: new AbortController().signal });
    const patternProjectiles = createPatternProjectileBatch({ primary: 0xffcd62, accent: 0xb990ff, shape });
    const projectiles = Object.fromEntries(projectileKinds.map(kind => [kind, createProjectileBatch(kind)]));
    plane.add(stage.root, patternProjectiles.root, ...Object.values(projectiles).map(batch => batch.root));
    try {
      await stage.ready;
      const f = boss(level);
      advance(f, time);
      const levelTime = f.stageDuration + f.transitionDuration + f.bossTime;
      stage.update({ flight: f, time: levelTime, reveal: 1, distance: BOSS_CAMERA_DISTANCE,
        animationTime: levelTime, elapsed: 0, newFlight: true, fighterSpeed: 0, droneSpeed: 0 });
      assert(stage.boss.visible);
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
