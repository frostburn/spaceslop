import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import * as T from 'three';
import { createServer } from 'vite';

const server = await createServer({
  root: new URL('..', import.meta.url).pathname,
  configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, entries: [] },
  appType: 'custom',
});
after(() => server.close());
const { BOSS_DEPTH, Flight, STEP } = await server.ssrLoadModule('/src/game.ts');
const { addVictoryWingShots, createBossDefeat, createVictoryFlares, SALUTE_ANGLE, SALUTE_START, VICTORY_DURATION, VICTORY_LASER_OVERSCAN, victoryLaserLength } =
  await server.ssrLoadModule('/src/rendering/victory.ts');
const { createFighterRig } = await server.ssrLoadModule('/src/ship-rigs.ts');
const { shipBurners } = await server.ssrLoadModule('/src/burners.ts');
const { createWormholeEnding, WORMHOLE_EXIT_HOLD } = await server.ssrLoadModule('/src/wormhole/ending.ts');

test('a lethal projectile clears in-flight ordnance and records the final boss time', () => {
  const flight = new Flight('sentry', [], 'vex', 'broodlock');
  flight.phase = 'boss';
  flight.time = 2;
  flight.bossHealth = 1;
  flight.cooldown = flight.droneCooldown = 100;
  flight.markers = [{ x: 0, y: -4 }];
  flight.shots = [
    { x: 2, y: -4, z: 0, vx: 0, vy: 15, vz: 0 },
    { x: flight.exposedCannonX, y: flight.bossAimY, z: BOSS_DEPTH + .1, vx: 0, vy: 0, vz: -20, wing: 'omega', damage: 3, pierced: new Set() },
  ];
  flight.step(STEP);
  assert.equal(flight.phase, 'won');
  assert.equal(flight.score, 1000);
  assert.equal(flight.shots.length + flight.threats.length + flight.markers.length, 0);
  assert.equal(flight.bossTime, 2 + STEP);
  flight.step(10);
  assert.equal(flight.bossTime, 2 + STEP);
  assert.equal(flight.score, 1000);
});

test('the defeat rig starts from the authored pose and resets for a replay', () => {
  const plane = new T.Group(), scenery = new T.Group(), boss = new T.Group();
  scenery.position.set(0, -35, -4);
  scenery.rotation.x = .24;
  boss.position.set(1, 38, -12);
  plane.add(scenery);
  scenery.add(boss);
  const before = boss.getWorldPosition(new T.Vector3());
  const defeat = createBossDefeat(boss, plane, 'io');
  assert(boss.getWorldPosition(new T.Vector3()).distanceTo(before) < 1e-9);
  const bursts = [];
  const emit = (point, tint) => bursts.push({ point: point.clone(), tint });
  assert(defeat.pose(0, emit));
  assert(boss.getWorldPosition(new T.Vector3()).distanceTo(before) < 1e-9);
  assert(defeat.pose(.5, emit));
  assert(boss.getWorldPosition(new T.Vector3()).distanceTo(before) > .3);
  assert.equal(bursts.length, 3);
  assert(!defeat.pose(.5, emit));
  defeat.pose(VICTORY_DURATION, emit);
  assert.equal(boss.visible, false);
  defeat.reset();
  assert.equal(boss.visible, true);
  assert(boss.getWorldPosition(new T.Vector3()).distanceTo(before) < 1e-9);
  assert(defeat.pose(0, emit));
});

test('retiring a lit boss preserves the point light count without leaving it illuminated', () => {
  const plane = new T.Group(), boss = new T.Group(), emitter = new T.Group();
  plane.add(boss);
  boss.add(emitter);
  const light = new T.PointLight(0xff6300, 14);
  emitter.add(light);
  const defeat = createBossDefeat(boss, plane, 'io');
  const visiblePointLights = () => {
    const lights = [];
    plane.traverseVisible(object => {
      if (object instanceof T.PointLight) lights.push(object);
    });
    return lights;
  };
  const emit = () => {};
  defeat.pose(0, emit);
  assert.deepEqual(visiblePointLights(), [light]);
  defeat.pose(VICTORY_DURATION, emit);
  const retired = visiblePointLights();
  assert.equal(retired.length, 1);
  assert.equal(retired[0].intensity, 0);
  defeat.reset();
  assert.deepEqual(visiblePointLights(), [light]);
  assert.equal(light.intensity, 14);
});

test('flares fan out from one launcher and hold their positions in the freeze frame', () => {
  const { root, pose } = createVictoryFlares();
  pose(.9);
  assert.equal(root.visible, false);
  pose(SALUTE_START);
  const first = root.children.filter(flare => flare.visible);
  assert.equal(first.length, 3);
  assert(first.every(flare => flare.position.lengthSq() === 0));
  pose(VICTORY_DURATION);
  const bright = root.children.filter(flare => flare.visible && flare.scale.x > .5);
  assert.equal(bright.length, 6);
  assert.deepEqual(new Set(bright.map(flare => Math.sign(flare.position.x))), new Set([-1, 0, 1]));
  const frozen = bright.map(flare => flare.position.toArray());
  pose(VICTORY_DURATION);
  assert.deepEqual(bright.map(flare => flare.position.toArray()), frozen);
  pose();
  assert.equal(root.visible, false);
});

test('salute rounds keep their equipped weapon and upgrade and travel along the muzzle direction', () => {
  const muzzle = new T.Vector3(-1, -2, .1);
  const direction = new T.Vector3(-.5, Math.sqrt(.75), 0);
  for (const weapon of ['homing', 'cannon', 'omega']) {
    const shots = [];
    assert.equal(addVictoryWingShots(shots, weapon, true, SALUTE_START - .01, muzzle, direction), 0);
    assert.equal(shots.length, 0);
    assert(addVictoryWingShots(shots, weapon, true, VICTORY_DURATION, muzzle, direction) > 0);
    assert(shots.every(shot => shot.wing === weapon && shot.upgraded && shot.x < muzzle.x && shot.y > muzzle.y));
    assert(shots.every(shot => shot.vx < 0 && shot.vy > 0 && shot.vz === 0));
  }
});

test('the tunnel escape fires another flare salvo after the normal victory beat', () => {
  const throughExit = createVictoryFlares(true);
  const ordinary = createVictoryFlares();
  const time = VICTORY_DURATION + 1.35;
  throughExit.pose(time);
  ordinary.pose(time);
  assert(throughExit.root.children.some(flare => flare.visible && flare.position.y > 0));
  assert(ordinary.root.children.every(flare => !flare.visible));
});

test('the exterior holds on the exit, then follows the fighter and its trails to a repeatable freeze', () => {
  const fighter = createFighterRig().root;
  let exterior, camera;
  const renderer = { render(scene, lens) {
    scene.updateMatrixWorld();
    lens.updateMatrixWorld();
    exterior = scene;
    camera = lens;
  } };
  const ending = createWormholeEnding(fighter, 2.7);
  const exteriorDuration = ending.duration - ending.cutToExterior;
  try {
    ending.warmup(renderer);
    const ship = exterior.getObjectByName('wormhole-exit-fighter');
    const lightning = exterior.getObjectByName('wormhole-exit-lightning');
    const trails = exterior.getObjectByName('wormhole-exit-engine-trails');
    assert(ship.visible && lightning.visible && trails.visible);
    ending.renderExterior(renderer, WORMHOLE_EXIT_HOLD / 2);
    assert(!ship.visible && !lightning.visible && !trails.visible);

    ending.renderExterior(renderer, WORMHOLE_EXIT_HOLD + .3);
    assert(ship.visible && lightning.visible && trails.visible);
    const emergence = ship.position.clone();
    ending.renderExterior(renderer, exteriorDuration);
    assert(ship.position.z > emergence.z + 20);
    const projected = ship.position.clone().project(camera);
    assert(Math.abs(projected.x) < .92 && Math.abs(projected.y) < .92);

    const ribbon = trails.geometry.getAttribute('position');
    for (const [index, burner] of shipBurners(ship).entries()) {
      const left = index * ribbon.count / 2;
      const center = new T.Vector3().fromBufferAttribute(ribbon, left)
        .add(new T.Vector3().fromBufferAttribute(ribbon, left + 1)).multiplyScalar(.5);
      assert(center.distanceTo(burner.getWorldPosition(new T.Vector3())) < 1e-5);
    }
    const finalPose = ship.matrixWorld.clone();
    const finalTrail = ribbon.array.slice();
    ending.renderExterior(renderer, exteriorDuration + 5);
    assert(ship.matrixWorld.equals(finalPose));
    assert.deepEqual(ribbon.array, finalTrail);
  } finally {
    ending.dispose();
  }
});

test('victory lasers extend past the first screen edge along each wing muzzle', () => {
  const camera = new T.PerspectiveCamera(40, 9 / 16, .05, 240);
  camera.position.set(0, 0, 22);
  camera.updateMatrixWorld();
  const projection = new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const frustum = new T.Frustum().setFromProjectionMatrix(projection);
  for (const side of [-1, 1]) {
    const muzzle = new T.Vector3(side * 1.25, -2.6, .085);
    for (const angle of [SALUTE_ANGLE, .12]) {
      const direction = new T.Vector3(side * Math.sin(angle), Math.cos(angle), 0);
      const length = victoryLaserLength(frustum, muzzle, direction);
      const at = distance => muzzle.clone().addScaledVector(direction, distance);
      const edge = at(length - VICTORY_LASER_OVERSCAN).applyMatrix4(projection);
      assert(Math.abs(Math.max(Math.abs(edge.x), Math.abs(edge.y)) - 1) < 1e-12);
      assert(!frustum.containsPoint(at(length)));
      assert(frustum.containsPoint(at(length - VICTORY_LASER_OVERSCAN - .01)));
    }
  }
});
