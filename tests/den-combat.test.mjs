import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { Texture, Triangle, Vector2, Vector3 } from 'three';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { DEN_CYCLE, denBodyEntry, denPose } = await server.ssrLoadModule('/src/den/combat.ts');
const { Flight, STEP } = await server.ssrLoadModule('/src/game.ts');
const { DEN_APPROACH, DEN_DURATION, DEN_SCREENS, denScroll } = await server.ssrLoadModule('/src/den/route.ts');
const { denWaves, denPatrolPose, denPatrolCanFire, denPatrolWarp } = await server.ssrLoadModule('/src/den/patrol.ts');
const { turn16Hardpoints } = await server.ssrLoadModule('/src/den/patrol-atlas-16.ts');
const { createDenPatrols } = await server.ssrLoadModule('/src/den/patrol-rig.ts');
const { createPatrolWarpCard, patrolAtlasFor } = await server.ssrLoadModule('/src/den/patrol-warp.ts');
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

test('patrol mesh stays continuous through atlas handoffs and straight ahead', () => {
  const card = createPatrolWarpCard(), geometry = card.root.geometry;
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv'), nextUV = geometry.getAttribute('nextUV');
  const sample = angle => {
    card.pose(angle);
    return {
      shape: Array.from(position.array), uv: Array.from(uv.array), nextUV: Array.from(nextUV.array),
      blend: card.root.material.uniforms.poseBlend.value,
    };
  };
  const epsilon = 1e-5;
  assert.throws(() => card.setArt(new Texture({ width: 640, height: 480 })), /Unsupported patrol atlas layout/);
  assert.equal(card.root.visible, false);
  for (const [count, width, height] of [[7, 768, 512], [16, 627, 627]]) {
    const texture = new Texture({ width, height });
    card.setArt(texture);
    const step = Math.PI / (2 * (count - 1));
    const straight = sample(0);
    assert.deepEqual(sample(-epsilon).uv, sample(epsilon).uv);
    assert.notDeepEqual(straight.uv, sample(Math.PI / 2).uv);
    if (count === 16) {
      assert(sample(.05 * step).blend > 0);
      assert(sample(.95 * step).blend < 1);
    } else {
      assert.equal(sample(.29 * step).blend, 0);
      assert(sample(.31 * step).blend > 0);
      assert.equal(sample(.71 * step).blend, 1);
    }
    for (const side of [-1, 1]) for (let i = 0; i < count - 1; i++) {
      const angle = side * (i + .5) * step;
      const a = sample(angle - epsilon), b = sample(angle + epsilon);
      assert.deepEqual(a.uv, b.uv);
      assert.deepEqual(a.nextUV, b.nextUV);
      assert.notDeepEqual(a.uv, a.nextUV);
      assert(Math.abs(a.blend - .5) < .001 && Math.abs(b.blend - .5) < .001);
      assert(a.shape.every((coordinate, j) => Math.abs(coordinate - b.shape[j]) < .001));
      for (let eighth = 0; eighth < 8; eighth++) {
        card.pose(side * (i + eighth / 8) * step);
        for (let j = 0; j < geometry.index.count; j += 3) {
          const a = geometry.index.getX(j), b = geometry.index.getX(j + 1), c = geometry.index.getX(j + 2);
          assert((position.getX(b) - position.getX(a)) * (position.getY(c) - position.getY(a))
            - (position.getY(b) - position.getY(a)) * (position.getX(c) - position.getX(a)) > 0);
        }
      }
      const key = (i + 1) * step;
      const before = sample(side * (key - epsilon)), after = sample(side * (key + epsilon));
      assert(Math.abs(before.blend - 1) < 1e-6);
      assert(Math.abs(after.blend) < 1e-6);
      assert.deepEqual(before.nextUV, after.uv);
    }
    if (count === 16) for (let i = -(count - 2); i < count - 1; i++) {
      const angle = i * step, h = 1e-4;
      const before = sample(angle - h).shape, at = sample(angle).shape, after = sample(angle + h).shape;
      assert(at.every((x, j) => Math.abs((after[j] - x) - (x - before[j])) / h < .12));
    }
    texture.dispose();
  }
  geometry.dispose();
  card.root.material.dispose();
});

test('the workshop can adjust one atlas band and isolate either texture on the same posed mesh', () => {
  const card = createPatrolWarpCard();
  const texture = new Texture({ width: 627, height: 627 });
  card.setArt(texture);
  const angle = -15 * Math.PI / 180;
  const mesh = () => Array.from(card.root.geometry.attributes.position.array);
  const weights = card.root.material.uniforms.poseBlend;
  card.pose(angle, 0);
  const base = mesh();
  assert.equal(weights.value, 0);
  card.pose(angle, 1);
  assert.equal(weights.value, 1);
  assert.deepEqual(mesh(), base);
  const atlas = patrolAtlasFor(627, 627), frames = [...atlas.rows], pose = [...frames[2]];
  const [y, l, mid, r, il, ir] = pose[12];
  pose[12] = [y + 1, l, mid - 1, r, il, ir];
  frames[2] = pose;
  card.setRegistration(atlas, frames);
  card.pose(angle);
  assert(Math.abs(weights.value - .5) < 1e-8);
  assert.notDeepEqual(mesh(), base);
  card.setRegistration(atlas);
  card.pose(angle);
  assert.deepEqual(mesh(), base);
  texture.dispose();
  card.root.geometry.dispose();
  card.root.material.dispose();
});

test('patrol exhaust sits on the engine pixels through both directions of a warped handoff', () => {
  const patrols = createDenPatrols(1), rig = patrols.rigs[0];
  const texture = new Texture({ width: 627, height: 627 });
  patrols.setArt(texture);
  const card = rig.root.getObjectByName('patrol-heading');
  const nozzles = rig.root.getObjectsByProperty('name', 'burner_nozzle');
  const { geometry } = card, positions = geometry.getAttribute('position');
  assert.equal(nozzles.length, 2);
  assert(nozzles.every(nozzle => nozzle.position.z < card.position.z && nozzle.children[0].renderOrder < card.renderOrder));
  const triangle = new Triangle(), weights = new Vector3();
  const mapPixel = (attr, frame, mount, mirror) => {
    const [x, y] = turn16Hardpoints[frame][mirror && frame !== 0 && mount < 2 ? 1 - mount : mount];
    const uv = geometry.getAttribute(attr), point = new Vector3(x / 1254, 1 - y / 1254, 0);
    for (let i = 0; i < geometry.index.count; i += 3) {
      const a = geometry.index.getX(i), b = geometry.index.getX(i + 1), c = geometry.index.getX(i + 2);
      triangle.a.set(uv.getX(a), uv.getY(a), 0);
      triangle.b.set(uv.getX(b), uv.getY(b), 0);
      triangle.c.set(uv.getX(c), uv.getY(c), 0);
      if (!triangle.getBarycoord(point, weights) || Math.min(weights.x, weights.y, weights.z) < -1e-5) continue;
      return new Vector2(
        weights.x * positions.getX(a) + weights.y * positions.getX(b) + weights.z * positions.getX(c),
        weights.x * positions.getY(a) + weights.y * positions.getY(b) + weights.z * positions.getY(c),
      );
    }
    assert.fail('Engine or nose pixel escaped the warp');
  };
  for (let degrees = -90; degrees <= 90; degrees += 1.5) {
    const heading = degrees * Math.PI / 180;
    const turn = denPatrolWarp(heading, 16);
    rig.pose(0, 0, heading, 1, .6, 0, 2);
    const mounts = [0, 1, 2].map(i => mapPixel('uv', turn.first, i, turn.mirror)
      .lerp(mapPixel('nextUV', turn.second, i, turn.mirror), turn.blend));
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
  let sawAttack = false;
  for (let frame = 0; frame < 1750 && flight.phase !== 'won' && flight.phase !== 'lost'; frame++) {
    const danger = flight.threats.some(shot => {
      const until = (flight.player.y - shot.y) / shot.vy;
      return until >= 0 && until < .39 && Math.abs(shot.x + shot.vx * until - flight.player.x) < .54;
    });
    if (danger && flight.charges) flight.pulse();
    else if (danger) flight.steer(flight.player.x > 0 ? -1 : 1, 0, STEP);
    else if (Math.abs(flight.player.x) > .12) flight.steer(-Math.sign(flight.player.x), 0, STEP);
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
