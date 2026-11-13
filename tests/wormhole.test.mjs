import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { Color, Euler, Vector3 } from 'three';
import { createServer } from 'vite';

const server = await createServer({
  root: new URL('..', import.meta.url).pathname, configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, entries: [] }, appType: 'custom',
});
after(() => server.close());
const { Flight, STEP, BOSS_CAMERA_DISTANCE, BOSS_Y, BOSS_PROJECTION } = await server.ssrLoadModule('/src/game.ts');
const { levels } = await server.ssrLoadModule('/src/levels.ts');
const { wormholeFrame, WORMHOLE_SUPPLY_TIME, wormholeBosses } = await server.ssrLoadModule('/src/wormhole/route.ts');
const { CICADA_FIRE, CICADA_HP, CICADA_WINDUP } = await server.ssrLoadModule('/src/cicada.ts');
const { wormholeReflectionPose, createWormholeReflection } = await server.ssrLoadModule('/src/wormhole/reflection.ts');
const { createFighterRig } = await server.ssrLoadModule('/src/ship-rigs.ts');
const { FONS_APPROACH, FONS_HP, FONS_CYCLE, FONS_RAIN_AT, FONS_RAIN_END, fonsPhase, fonsPose, fonsRocks, fonsSheltered, fonsTuskPaths } =
  await server.ssrLoadModule('/src/wormhole/fons/combat.ts');
const { fonsBeams, fonsBeamHits, fonsCrownfireFlash, fonsTuskTip, fonsVolleys } =
  await server.ssrLoadModule('/src/wormhole/fons/attacks.ts');
const { createFonsMantle } = await server.ssrLoadModule('/src/wormhole/fons/mantle.ts');
const { createFonsLightning } = await server.ssrLoadModule('/src/wormhole/fons/lightning.ts');
const { createFonsBackdrop } = await server.ssrLoadModule('/src/wormhole/fons/backdrop.ts');

test('the royal backdrops follow their variant and Invictus cycles smoothly on the encounter clock', () => {
  const { uniforms, textures, update } = createFonsBackdrop();
  const mix = () => uniforms.royalBackdrop.value.toArray();
  const angle = () => uniforms.inclination.value;
  try {
    update('normal', 0, 1);
    assert.deepEqual(mix(), [0, 0]);
    update('rex', -1.6, .42);
    assert.deepEqual(mix(), [.42, 0]);
    update('invictus', -FONS_APPROACH, 0);
    assert.deepEqual(mix(), [0, 0]);
    const initialAngle = angle();
    assert(initialAngle > Math.PI * .45);
    update('invictus', FONS_CYCLE / 2, 1);
    assert.deepEqual(mix(), [0, 1]);
    assert(angle() < Math.PI / 10);
    const faceOnAngle = angle();
    update('invictus', FONS_CYCLE / 2, 1);
    assert.equal(angle(), faceOnAngle);
    update('invictus', FONS_CYCLE, 1);
    assert.equal(angle(), initialAngle);
    update('normal', -FONS_APPROACH, 0);
    assert.deepEqual(mix(), [0, 0]);
  } finally {
    for (const texture of textures) texture.dispose();
  }
});

test('the traveling aperture centers for the rush and opens again for each arrival', () => {
  const end = levels.wormhole.duration;
  const start = wormholeFrame(0, end);
  const approach = wormholeFrame(end, end);
  const open = wormholeFrame(end + 2.5, end);
  const combat = wormholeFrame(end + WORMHOLE_SUPPLY_TIME, end);
  const settled = wormholeFrame(end + WORMHOLE_SUPPLY_TIME + 3, end);
  assert.equal(start.lensStrength, 0);
  assert.equal(approach.arrival, 0);
  assert(approach.lensX < 0 && approach.lensY > 0);
  assert(open.lensRadius > approach.lensRadius && open.echo > approach.echo);
  assert(open.arrival > 0 && open.arrival < 1);
  assert.equal(combat.arrival, 1);
  assert.equal(Math.hypot(combat.lensX, combat.lensY), 0);
  assert(settled.lensStrength < combat.lensStrength);
  assert(settled.echo < combat.echo);
  const next = wormholeFrame(end + 33, end, 2.25);
  const nextCombat = wormholeFrame(end + 33, end, WORMHOLE_SUPPLY_TIME);
  assert(next.lensStrength > settled.lensStrength && next.waveStrength > 0);
  assert(next.arrival > 0 && next.arrival < 1);
  assert.equal(nextCombat.arrival, 1);
  assert.equal(next.travel, nextCombat.travel);

  let previous = start.travel;
  for (let tick = 1; tick < 60 * 30; tick++) {
    const frame = wormholeFrame(tick * STEP, end);
    assert(Object.values(frame).every(value => typeof value === 'boolean' || Number.isFinite(value)));
    assert(frame.travel > previous);
    previous = frame.travel;
  }
});

function finishApproach(flight) {
  assert.equal(flight.phase, 'approach');
  while (flight.phase === 'approach') flight.step(STEP);
  assert.equal(flight.phase, 'boss');
}

function defeatEncounter(flight) {
  assert.equal(flight.phase, 'boss');
  if (flight.encounterLevel === 'vents') {
    for (let i = 0; i < 2; i++) {
      flight.damageBoss(1000);
      flight.volley++;
    }
  }
  if (flight.encounterLevel === 'summer') {
    for (const side of [-1, 0, 1]) flight.damageBoss(1000, false, side);
  } else {
    flight.damageBoss(1000);
    if (flight.encounterLevel === 'io' && flight.phase === 'boss') flight.damageBoss(1000);
  }
}

test('the fourth encounter is a five-shot Titan rematch with locked warnings', () => {
  const flight = new Flight('sentry', [], 'vex', 'wormhole');
  flight.time = flight.stageDuration;
  flight.step(0);
  for (let i = 0; i < 3; i++) {
    finishApproach(flight);
    defeatEncounter(flight);
  }
  finishApproach(flight);
  assert.equal(flight.encounterLevel, 'titan');
  assert.equal(flight.bossMaxHealth, CICADA_HP);
  assert.equal(flight.bossHealth, CICADA_HP);
  assert(flight.exposedCannonX < 0);
  while (flight.time < CICADA_WINDUP + .17) flight.step(STEP);
  const locked = flight.markers.map(marker => ({ ...marker }));
  assert.equal(locked.length, 5);
  assert(flight.cannonWindup > 0 && flight.cannonWindup < 1);
  assert(flight.bossHealth < CICADA_HP);
  flight.player.x = 2;
  while (flight.time < CICADA_FIRE + .08) flight.step(STEP);
  assert.deepEqual(flight.markers, locked);
  assert(flight.firedCannonX < 0);
  assert(flight.exposedCannonX > 0);
  assert.equal(flight.threats.length, locked.length);
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

test('the entire campaign roster shares a flight clock, loadout, score and charges through Fons', () => {
  const weapons = ['homing', 'cannon', 'laser', 'omega'];
  let draws = 0;
  const flight = new Flight('sentry', ['cannon'], 'vex', 'wormhole', () => (draws++ % 4 + .5) / 4);
  const expected = ['broodlock', 'io', 'vents', 'titan', 'heliostat', 'ice', 'preserve',
    'summer', 'boulevard', 'biolume', 'fleet', 'den', 'wormhole'];
  assert.deepEqual(wormholeBosses, expected);
  for (let tick = 0; flight.phase === 'stage'; tick++) {
    assert(tick <= Math.ceil(flight.stageDuration / STEP));
    assert.equal(flight.enemies.length + flight.drops.length + flight.threats.length, 0);
    flight.step(STEP);
  }
  flight.player.x = 3.5;
  flight.hull = 2;
  flight.charges = 1;
  flight.wings[0].upgraded = true;
  for (const [index, id] of expected.entries()) {
    assert.equal(flight.level, 'wormhole');
    assert.equal(flight.encounterLevel, id);
    assert.equal(flight.wormholeBossNumber, index + 1);
    assert.equal(flight.transitionDuration, WORMHOLE_SUPPLY_TIME);
    assert.equal(flight.shots.length + flight.markers.length + flight.threats.length + flight.enemies.length, 0);
    assert.deepEqual(flight.drops.flatMap(drop => drop.weapon ? [drop.weapon] : []),
      [weapons[2 * index % 4], weapons[(2 * index + 1) % 4]]);
    assert.equal(flight.drops.filter(drop => drop.kind === 'repair').length, index > 0 && index % 3 === 0 ? 1 : 0);
    assert.equal(draws, 2 * (index + 1));
    assert.equal(flight.wings[0].weapon, 'cannon');
    assert(flight.wings[0].upgraded);
    assert.equal(flight.hull, 2);
    assert.equal(flight.charges, 1);
    assert.equal(flight.bossHealth, id === 'wormhole' ? FONS_HP : new Flight('sentry', [], 'vex', id).bossMaxHealth);
    finishApproach(flight);
    assert.equal(flight.drops.length, 0);
    if (id === 'wormhole') {
      assert(flight.isFonsFight && flight.planarBoss);
      assert.equal(flight.fonsTime, 0);
      assert.equal(flight.fonsVariant, 'normal');
    }
    const before = flight.wormholeTime;
    defeatEncounter(flight);
    assert.equal(flight.wormholeTime, before);
    assert.equal(flight.phase, id === 'wormhole' ? 'won' : 'approach');
  }
  assert.equal(flight.score, 14500);
  const finish = flight.wormholeTime;
  flight.step(3);
  assert.equal(flight.wormholeTime, finish);
  assert.equal(flight.drops.length, 0);
});

test('supply capsules use existing weapon upgrades and restore one hull up to the current capacity', () => {
  const flight = new Flight('sentry', [], 'brass', 'wormhole', () => .3);
  flight.time = flight.stageDuration;
  flight.step(0);
  const collect = drop => {
    Object.assign(flight.player, { x: drop.x, y: drop.y });
    flight.step(STEP);
    assert(!flight.drops.includes(drop));
  };
  const pair = [...flight.drops];
  pair.forEach(collect);
  assert.equal(flight.wings[0].weapon, 'cannon');
  assert(flight.wings[0].upgraded);
  flight.player.x = 3.5;
  for (let i = 0; i < 12; i++) {
    finishApproach(flight);
    defeatEncounter(flight);
    const repair = flight.drops.find(drop => drop.kind === 'repair');
    if (!repair) continue;
    if (i === 2) {
      flight.hull = 2;
      collect(repair);
      assert.equal(flight.hull, 3);
      assert.equal(flight.pickupMessage, 'Hull repaired · +1');
    } else if (i === 5) {
      flight.hull = 4;
      collect(repair);
      assert.equal(flight.hull, 4);
      assert.equal(flight.pickupMessage, 'Hull already full');
    } else if (i === 8) {
      flight.droneWeapon = 'towline';
      collect(flight.drops[0]);
      assert.equal(flight.hull, 5);
      flight.hull = 4;
      collect(repair);
      assert.equal(flight.hull, 5);
    } else {
      collect(repair);
      assert.equal(flight.hull, 5);
    }
    Object.assign(flight.player, { x: 3.5, y: -5.3 });
  }
});

test('losing during the sequence freezes the current encounter without spawning supplies', () => {
  const flight = new Flight('sentry', [], 'vex', 'wormhole');
  flight.time = flight.stageDuration;
  flight.step(0);
  finishApproach(flight);
  flight.hull = 1;
  flight.hit();
  const finish = flight.wormholeTime;
  flight.step(3);
  assert.equal(flight.wormholeTime, finish);
  assert.equal(flight.phase, 'lost');
  assert.equal(flight.encounterLevel, 'broodlock');
  assert.equal(flight.drops.length, 0);
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

test('both royal variants fire Crownfire in two interleaved fans from their tusk tips', () => {
  const player = { x: 0, y: -5.35 };
  const outside = 1.38, inside = 1.98;
  const volley = (time, variant) => fonsVolleys(time + STEP / 2, STEP, player, variant);
  assert.equal(fonsCrownfireFlash(outside - .1, 'rex').tusks, 'outer');
  assert.equal(fonsCrownfireFlash(inside - .1, 'invictus').tusks, 'inner');
  assert.equal(fonsCrownfireFlash(outside - .1, 'normal'), undefined);
  assert.deepEqual(volley(outside, 'normal'), []);
  const first = volley(outside, 'rex'), second = volley(inside, 'rex');
  assert.equal(first.length, 6);
  assert.equal(second.length, 5);
  assert.deepEqual(first, volley(outside, 'invictus'));
  assert.deepEqual(second, volley(inside, 'invictus'));
  const atLane = shot => shot.x + shot.vx * (player.y - shot.y) / shot.vy;
  for (const [index, shot] of second.entries()) {
    assert(Math.abs(atLane(shot) - (atLane(first[index]) + atLane(first[index + 1])) / 2) < 1e-10);
  }
  const pose = fonsPose(outside);
  const [x, y, z] = fonsTuskPaths.outer[4];
  const tip = new Vector3(-x, y, z).applyEuler(new Euler(pose.pitch, pose.yaw, pose.bank));
  const scale = pose.scale * (1 - pose.depth / BOSS_CAMERA_DISTANCE);
  tip.multiplyScalar(scale).add(new Vector3(pose.x * scale / pose.scale, pose.y * scale / pose.scale, pose.depth));
  tip.multiplyScalar(1 / (1 - tip.z / BOSS_CAMERA_DISTANCE));
  assert(Math.hypot(first[0].x - tip.x, first[0].y - tip.y) < 1e-10);
  assert.deepEqual(fonsTuskTip(pose, -1, 'outer'), { x: first[0].x, y: first[0].y });
});

test('Fons fires four seven-shot fans before the wall breaches open', () => {
  const player = { x: 0, y: -5.35 };
  const volleys = [];
  for (let time = STEP; time < 4; time += STEP) {
    const shots = fonsVolleys(time, STEP, player);
    if (shots.length) volleys.push(shots);
  }
  assert.deepEqual(volleys.map(shots => shots.length), [7, 7, 7, 7]);
  assert(volleys.flat().every(shot => shot.planar && Math.hypot(shot.vx, shot.vy) >= 6.1 - 1e-12));
});

test('only Invictus damages the reflected path after the False Horizon warning', () => {
  const warning = fonsBeams(5.46, 'invictus');
  const start = fonsBeams(5.63, 'invictus');
  assert(warning[0].active && warning[1].warning > .9 && !warning[1].active);
  assert(warning[1].impact > 0 && start[1].active);
  assert.deepEqual(warning[0].to, start[1].from);
  assert.deepEqual(warning[1].to, start[1].to);
  const time = 5.96;
  const { from, to } = fonsBeams(time, 'invictus')[1];
  const hit = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  assert(fonsBeamHits(time, hit, 'invictus'));
  assert(!fonsBeamHits(time, { x: 3.5, y: -5.5 }, 'invictus'));
  assert.equal(fonsBeams(FONS_CYCLE + time, 'invictus')[1].from.x, -from.x);
  for (const variant of ['normal', 'rex', 'invictus']) {
    const flight = new Flight('sentry', [], 'vex', 'wormhole');
    flight.startFonsApproach(variant);
    while (flight.phase === 'approach') flight.step(STEP);
    assert.equal(flight.fonsVariant, variant);
    Object.assign(flight.player, hit);
    flight.time = time - STEP;
    const hull = flight.hull;
    flight.step(STEP);
    assert.equal(flight.hull, variant === 'invictus' ? hull - 1 : hull);
  }
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
