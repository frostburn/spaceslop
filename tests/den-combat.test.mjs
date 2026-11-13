import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { Texture, Triangle, Vector2, Vector3 } from 'three';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { DEN_CYCLE, denBodyEntry, denPose } = await server.ssrLoadModule('/src/den/combat.ts');
const { Flight, STEP } = await server.ssrLoadModule('/src/game.ts');
const { DEN_APPROACH, DEN_DURATION, DEN_SCREENS, denScroll } = await server.ssrLoadModule('/src/den/route.ts');
const { DEN_PATROL_POOL, denWaves, denPatrolPose, denPatrolCanFire, denPatrolWarp } = await server.ssrLoadModule('/src/den/patrol.ts');
const { turn16Hardpoints } = await server.ssrLoadModule('/src/den/patrol-atlas-16.ts');
const { createDenPatrols } = await server.ssrLoadModule('/src/den/patrol-rig.ts');
const { createPatrolWarpCard, patrolAtlasFor, patrolGridPadding, patrolGridPoint, patrolGridTurn, patrolRestPoint, PATROL_GRID_SIZE } = await server.ssrLoadModule('/src/den/patrol-warp.ts');
const { DEN_TURRET_REACH, DEN_TURRET_RECOIL, DEN_MINE_FUSE, createDenTurret, denMinePose,
  denTurretSignal, stepDenTurret } = await server.ssrLoadModule('/src/den/defense.ts');

test('the gantry sweep alternates from the settled bike position and carries its hit area', () => {
  const a = denPose(DEN_CYCLE - .0001), b = denPose(DEN_CYCLE);
  assert(Math.hypot(a.x - b.x, a.y - b.y) < .001);
  assert(denPose(.42).rev > .75 && denPose(.69).rev === 0);
  assert(denPose(1.23).rev === 1 && denPose(1.23).throttle > denPose(.2).throttle + .6);
  assert.equal(denPose(1.6).rev, 0);
  for (const time of [.2, 1.92, DEN_CYCLE + 2.6]) {
    const { x, y } = denPose(time);
    assert(Number.isFinite(denBodyEntry(time, { x, y: y - 2 }, { x, y: y + 1 })));
    assert.equal(denBodyEntry(time, { x: x + 3, y: y - 2 }, { x: x + 3, y: y + 1 }), Infinity);
  }
});

test('the ten-screen route joins the gantry with continuous scroll speed', () => {
  assert.equal(denScroll(0), 0);
  assert.equal(denScroll(DEN_DURATION), DEN_SCREENS - 1);
  assert.equal(denScroll(DEN_DURATION + DEN_APPROACH), DEN_SCREENS);
  const step = .001;
  const before = denScroll(DEN_DURATION) - denScroll(DEN_DURATION - step);
  const after = denScroll(DEN_DURATION + step) - denScroll(DEN_DURATION);
  assert(Math.abs(before - after) < 1e-7);
  assert(denScroll(DEN_DURATION + DEN_APPROACH) - denScroll(DEN_DURATION + DEN_APPROACH - step) < 1e-7);
});

test('patrols turn through both supported atlases and wait until they are fully visible', () => {
  assert(denWaves.length >= 18);
  const activePose = ({ first, second, blend }) => blend < .5 ? first : second;
  for (const count of [7, 16]) for (let i = 0; i < count; i++) {
    const angle = (Math.PI / 2) * i / (count - 1);
    assert.equal(activePose(denPatrolWarp(-angle, count)), i);
    assert.equal(activePose(denPatrolWarp(angle, count)), i);
    assert.equal(denPatrolWarp(-angle, count).mirror, false);
    assert.equal(denPatrolWarp(angle, count).mirror, i > 0);
  }
  for (const side of [-1, 1]) {
    const patrol = { course: 'cross', side, slot: 0, heavy: false };
    const initial = denPatrolPose(0, -1.1 * side, patrol);
    const settled = denPatrolPose(2.3, -1.1 * side, patrol);
    assert.equal(activePose(denPatrolWarp(initial.heading, 16)), 15);
    assert(!denPatrolCanFire(initial, patrol));
    assert.equal(activePose(denPatrolWarp(settled.heading, 16)), 0);
    assert(denPatrolCanFire(settled, patrol));
  }
});

function patrolPixel(card, attribute, x, y) {
  const { index, attributes } = card.geometry, uv = attributes[attribute], { position } = attributes;
  const triangle = new Triangle(), weights = new Vector3(), point = new Vector3(x, y, 0);
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
    triangle.a.set(uv.getX(a), uv.getY(a), 0);
    triangle.b.set(uv.getX(b), uv.getY(b), 0);
    triangle.c.set(uv.getX(c), uv.getY(c), 0);
    if (!triangle.getBarycoord(point, weights) || Math.min(weights.x, weights.y, weights.z) < -1e-5) continue;
    return new Vector2(
      weights.x * position.getX(a) + weights.y * position.getX(b) + weights.z * position.getX(c),
      weights.x * position.getY(a) + weights.y * position.getY(b) + weights.z * position.getY(c),
    );
  }
  assert.fail('Source pixel escaped the patrol grid');
}

test('the painted patrol sprite stays continuous when the handoff grids change', () => {
  const card = createPatrolWarpCard(), epsilon = 1e-5;
  assert.throws(() => card.setArt(new Texture({ width: 640, height: 480 })), /Unsupported patrol atlas layout/);
  assert.equal(card.root.visible, false);
  for (const [width, height] of [[768, 512], [627, 627]]) {
    const atlas = patrolAtlasFor(width, height), count = atlas.crops.length;
    const texture = new Texture({ width, height });
    card.setArt(texture);
    const { index, attributes: { position, uv } } = card.root.geometry;
    assert.equal(position.count, 256);
    assert.equal(index.count, 6 * 15 ** 2);
    const step = Math.PI / (2 * (count - 1));
    const weights = card.root.material.uniforms.poseBlend;
    const sample = (frame, heading, attribute) => {
      const [l, t, r, b] = atlas.crops[frame];
      card.pose(heading);
      return [.2, .5, .8].flatMap(u => [.2, .5, .8].map(v =>
        patrolPixel(card.root, attribute, (l + u * (r - l)) / atlas.width, 1 - (t + v * (b - t)) / atlas.height)));
    };
    const samePixels = (a, b) => a.forEach((pixel, i) => assert(pixel.distanceTo(b[i]) < .00001));
    samePixels(sample(0, -epsilon, 'uv'), sample(0, epsilon, 'uv'));
    const straight = Array.from(uv.array);
    card.pose(Math.PI / 2);
    assert.notDeepEqual(Array.from(uv.array), straight);
    assert.equal(weights.value, 1);
    card.pose(.05 * step);
    assert.equal(weights.value > 0, count === 16);
    card.pose(.95 * step);
    assert.equal(weights.value < 1, count === 16);
    for (const side of [-1, 1]) for (let frame = 1; frame < count; frame++) {
      const key = frame * step, before = sample(frame, side * (key - epsilon), 'nextUV');
      assert(Math.abs(weights.value - 1) < 1e-6);
      const isLast = frame === count - 1;
      const after = sample(frame, side * (key + epsilon), isLast ? 'nextUV' : 'uv');
      assert(Math.abs(weights.value - (isLast ? 1 : 0)) < 1e-6);
      samePixels(before, after);
      for (let eighth = 0; eighth < 8; eighth++) {
        card.pose(side * (frame - 1 + eighth / 8) * step);
        for (let i = 0; i < index.count; i += 3) {
          const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
          assert((position.getX(b) - position.getX(a)) * (position.getY(c) - position.getY(a))
            - (position.getY(b) - position.getY(a)) * (position.getX(c) - position.getX(a)) > 0);
        }
      }
    }
    texture.dispose();
  }
  card.root.geometry.dispose();
  card.root.material.dispose();
});

test('editing a pose grid affects only its handoff and invalid edits are rejected atomically', async () => {
  const { movePatrolPoint } = await server.ssrLoadModule('/src/studies/patrol-registration.ts');
  const card = createPatrolWarpCard();
  const texture = new Texture({ width: 627, height: 627 });
  card.setArt(texture);
  const handoff = 2, heading = -15 * Math.PI / 180, neighbor = -9 * Math.PI / 180, point = 3 * PATROL_GRID_SIZE + 4;
  const { position, uv, nextUV } = card.root.geometry.attributes;
  const weights = card.root.material.uniforms.poseBlend;
  const atlas = patrolAtlasFor(627, 627), crop = atlas.crops[handoff];
  card.pose(neighbor);
  const neighborUV = Array.from(nextUV.array);
  card.pose(heading, 0);
  const base = Array.from(position.array), originalUV = Array.from(uv.array);
  assert.equal(weights.value, 0);
  card.pose(heading, 1);
  assert.equal(weights.value, 1);
  assert.deepEqual(Array.from(position.array), base);

  const edited = [...atlas.handoffs], [outgoing, incoming] = edited[handoff];
  const [x, y] = patrolGridPoint(crop, outgoing, point);
  const nextX = Math.round((x - 1) * 10) / 10, nextY = Math.round((y + 2) * 10) / 10;
  const next = JSON.parse(JSON.stringify(movePatrolPoint(atlas, handoff, outgoing, point, nextX, nextY)));
  edited[handoff] = [next, incoming];
  card.setRegistration(atlas, edited);
  card.pose(heading);
  assert(Math.abs(weights.value - .5) < 1e-8);
  assert.notDeepEqual(Array.from(position.array), base);
  assert(Math.abs(uv.getX(point) * atlas.width - (crop[0] + nextX)) < .0001);
  assert(Math.abs((1 - uv.getY(point)) * atlas.height - (crop[1] + nextY)) < .0001);
  assert(uv.array.every((value, i) => Math.floor(i / 2) === point || value === originalUV[i]));
  const editedUV = Array.from(uv.array);
  card.pose(neighbor);
  assert.deepEqual(Array.from(nextUV.array), neighborUV);
  const folded = [...edited];
  folded[handoff] = [movePatrolPoint(atlas, handoff, next, point, 0, 0), incoming];
  assert.throws(() => card.setRegistration(atlas, folded), /folds/);
  card.pose(heading);
  assert.deepEqual(Array.from(uv.array), editedUV);
  card.setRegistration(atlas);
  card.pose(heading);
  assert.deepEqual(Array.from(position.array), base);
  texture.dispose();
  card.root.geometry.dispose();
  card.root.material.dispose();
});

test('the padded grid rim can move while keeping the painted bike tip inside', async () => {
  const { movePatrolPoint } = await server.ssrLoadModule('/src/studies/patrol-registration.ts');
  const atlas = patrolAtlasFor(1254, 1254), card = createPatrolWarpCard();
  const handoff = 0, frame = 1, crop = atlas.crops[frame], pad = patrolGridPadding(crop);
  const height = crop[3] - crop[1], outgoing = atlas.handoffs[handoff][0], incoming = atlas.handoffs[handoff][1];
  const rimPoint = (PATROL_GRID_SIZE - 1) * PATROL_GRID_SIZE + 2, tipPoint = rimPoint - PATROL_GRID_SIZE;
  const [rimX, rimY] = patrolGridPoint(crop, incoming, rimPoint), [tipX] = patrolGridPoint(crop, incoming, tipPoint);
  assert.equal(patrolRestPoint(crop, rimPoint)[1], height + pad);
  assert(rimY > height);

  const movedRim = movePatrolPoint(atlas, frame, incoming, rimPoint, rimX + 3, rimY + 6);
  assert.deepEqual(movedRim[rimPoint], [Math.round((rimX + 3) * 10) / 10, Math.round((rimY + 6) * 10) / 10]);
  assert.equal(movePatrolPoint(atlas, frame, movedRim, rimPoint, rimX, height - 20)[rimPoint][1], height);
  const movedTip = movePatrolPoint(atlas, frame, movedRim, tipPoint, tipX, height + 1);
  assert.equal(movedTip[tipPoint][1], height + 1);
  const edited = [...atlas.handoffs];
  edited[handoff] = [outgoing, movedTip];
  card.setRegistration(atlas, edited);
  card.pose(-Math.PI / 30);
  const [x, y] = turn16Hardpoints[frame][2];
  const actual = patrolPixel(card.root, 'uv', x / atlas.width, 1 - y / atlas.height);
  const expected = new Vector2((x - crop[4]) * atlas.pixel, -(y - crop[5]) * atlas.pixel).rotateAround(new Vector2(), Math.PI / 30);
  assert(actual.distanceTo(expected) < .00001);

  const clipped = [...movedTip], invalid = [...edited];
  clipped[rimPoint] = [rimX, height - 1];
  invalid[handoff] = [outgoing, clipped];
  assert.throws(() => card.setRegistration(atlas, invalid), /crosses the sprite crop/);
  card.root.geometry.dispose();
  card.root.material.dispose();
});

test('patrol exhaust sits on the engine pixels through both directions of a warped handoff', () => {
  const patrols = createDenPatrols(1), rig = patrols.rigs[0];
  const texture = new Texture({ width: 627, height: 627 });
  patrols.setArt(texture);
  const card = rig.root.getObjectByName('patrol-heading');
  const nozzles = rig.root.getObjectsByProperty('name', 'burner_nozzle');
  assert.equal(nozzles.length, 2);
  assert(nozzles.every(nozzle => nozzle.position.z < card.position.z && nozzle.children[0].renderOrder < card.renderOrder));
  const mapPixel = (attr, frame, mount, mirror) => {
    const [x, y] = turn16Hardpoints[frame][mirror && frame !== 0 && mount < 2 ? 1 - mount : mount];
    return patrolPixel(card, attr, x / 1254, 1 - y / 1254);
  };
  for (let degrees = -90; degrees <= 90; degrees += 1.5) {
    const heading = degrees * Math.PI / 180;
    const turn = patrolGridTurn(heading, 16);
    rig.pose(0, 0, heading, 1, .6, 0, 2);
    const mounts = [0, 1, 2].map(i => mapPixel('uv', turn.handoff, i, turn.mirror)
      .lerp(mapPixel('nextUV', turn.handoff + 1, i, turn.mirror), turn.blend));
    const aft = mounts[0].clone().add(mounts[1]).multiplyScalar(.5).sub(mounts[2]).normalize();
    nozzles.forEach((nozzle, i) => {
      assert(Math.hypot(nozzle.position.x - mounts[i].x, nozzle.position.y - mounts[i].y) < .001);
      assert(Math.hypot(Math.sin(nozzle.rotation.z) - aft.x, -Math.cos(nozzle.rotation.z) - aft.y) < .001);
    });
  }
  texture.dispose();
});

test('Den turretmen hold fire offscreen and fire a three-round burst from the locked muzzle', () => {
  const turret = createDenTurret(0), point = { x: -2.5, y: 7 }, player = { x: 1.5, y: -3 };
  for (let time = 0; time < 3; time += STEP) assert.equal(stepDenTurret(turret, point, player, time, STEP), undefined);
  assert.equal(turret.fireAt, Infinity);
  point.y = 6;
  const shots = [];
  let locked;
  for (let time = 3; time < 5; time += STEP) {
    const before = turret.heading;
    const muzzle = stepDenTurret(turret, point, player, time, STEP);
    assert(Math.abs(turret.heading - before) <= 4.5 * STEP + 1e-10);
    if (turret.locked !== undefined && locked === undefined) {
      locked = turret.locked;
      player.x = -3.2;
    }
    if (!muzzle) continue;
    shots.push(muzzle);
    assert.equal(denTurretSignal(turret, time).recoil, 1);
    assert(Math.abs(Math.hypot(muzzle.x - point.x, muzzle.y - point.y) - (DEN_TURRET_REACH - DEN_TURRET_RECOIL)) < 1e-9);
  }
  assert.equal(shots.length, 3);
  assert(shots.every(shot => shot.heading === locked));
});

test('Den turretmen take swept fire and laser damage while their base is fixed to the scroll', () => {
  const flight = new Flight('sentry', ['laser'], 'vex', 'den');
  flight.time = 7.1;
  flight.step(0);
  const enemy = flight.enemies.find(enemy => enemy.denTurret);
  assert(enemy);
  const { x, y, hp } = enemy;
  flight.player.x += x - flight.wingOrigin(-1).x;
  flight.shots.push({ x, y: y - 1.6, z: 0, vx: 0, vy: 150, vz: 0 });
  flight.step(STEP);
  assert.equal(enemy.x, x);
  assert(Math.abs(enemy.y - y + .09 * 16 * STEP) < 1e-9);
  assert.equal(flight.wings[0].laserTarget, enemy);
  assert(enemy.laserDamage > 0 && enemy.hp < hp - 1);
  flight.pulse();
  assert.equal(enemy.hp, 0);
  assert(!flight.enemies.includes(enemy));
});

test('Den mines can be skirted and each armed mine survives Pulse until its one shrapnel burst', () => {
  const flight = new Flight('sentry', [], 'vex', 'den');
  flight.time = 6;
  const mine = flight.denMines[0];
  const pose = denMinePose(0, mine, denScroll(flight.time), flight.time);
  flight.player = { x: -3, y: pose.y };
  flight.step(STEP);
  assert.equal(mine.armedAt, undefined);
  flight.player = { x: pose.x, y: pose.y - .62 };
  flight.step(STEP);
  assert.equal(mine.armedAt, flight.time);
  flight.pulse();
  flight.player.x = 3.9;
  assert.equal(mine.burstAt, undefined);
  while (flight.time + STEP < mine.armedAt + DEN_MINE_FUSE) flight.step(STEP);
  assert.equal(mine.burstAt, undefined);
  flight.step(STEP);
  assert.equal(mine.burstAt, flight.time);
  const shards = () => flight.threats.filter(shot => Math.abs(Math.hypot(shot.vx, shot.vy) - 4) < 1e-7);
  assert.equal(shards().length, 10);
  assert(shards().every(shot => shot.z === 0 && shot.planar));
  flight.step(STEP);
  assert.equal(shards().length, 10);
});

test('the gantry encounter is winnable with the ordinary ship and planar shots', () => {
  const flight = new Flight('sentry', [], 'vex', 'den');
  assert.equal(flight.phase, 'stage');
  flight.time = flight.stageDuration;
  flight.step(0);
  assert.equal(flight.phase, 'approach');
  flight.deployDrone(0, -2.8);
  let sawAttack = false, dodgeX = 0;
  const dangerAt = x => flight.threats.some(shot => {
    const until = (flight.player.y - shot.y) / shot.vy;
    return until >= 0 && until < .45 && Math.abs(shot.x + shot.vx * until - x) < .62;
  });
  for (let frame = 0; frame < 1750 && flight.phase !== 'won' && flight.phase !== 'lost'; frame++) {
    if (dangerAt(flight.player.x)) {
      if (flight.charges) flight.pulse();
      else dodgeX = [-1.8, 1.8, -2.8, 2.8].find(x => !dangerAt(x)) ?? dodgeX;
    } else if (!dangerAt(0)) dodgeX = 0;
    const delta = dodgeX - flight.player.x;
    if (Math.abs(delta) > .12) flight.steer(Math.sign(delta), 0, STEP);
    flight.step(STEP);
    sawAttack ||= flight.threats.length > 0;
    assert(flight.shots.every(shot => shot.z === 0 && shot.vz === 0));
  }
  assert(sawAttack);
  assert.equal(flight.phase, 'won');
  const time = flight.denBossTime;
  flight.step(STEP);
  assert.equal(flight.denBossTime, time);
});

test('reinforced Den formations fit the prewarmed patrol pool and still share their carrier reward', () => {
  const flight = new Flight('sentry', [], 'vex', 'den');
  flight.invulnerable = flight.cooldown = flight.droneCooldown = 1e5;
  let maxPatrols = 0;
  while (flight.phase === 'stage') {
    flight.step(STEP);
    maxPatrols = Math.max(maxPatrols, flight.enemies.filter(enemy => enemy.den && enemy.age >= 0).length);
  }
  assert(maxPatrols > 4 && maxPatrols <= DEN_PATROL_POOL);

  const carrier = new Flight('sentry', [], 'vex', 'den');
  carrier.time = 68.7;
  carrier.nextWave = denWaves.findIndex(wave => wave.time === carrier.time);
  carrier.step(0);
  const members = carrier.enemies.filter(enemy => enemy.den);
  assert.equal(members.length, 4);
  for (const enemy of members.slice(0, -1)) carrier.damageEnemy(enemy, enemy.hp);
  assert.equal(carrier.drops.length, 0);
  carrier.damageEnemy(members.at(-1), members.at(-1).hp);
  assert.deepEqual(carrier.drops.map(drop => drop.weapon), ['laser']);
});
