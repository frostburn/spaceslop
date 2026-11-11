import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { DEN_CYCLE, denBodyEntry, denPose } = await server.ssrLoadModule('/src/den/combat.ts');
const { Flight, STEP } = await server.ssrLoadModule('/src/game.ts');
const { DEN_APPROACH, DEN_DURATION, DEN_SCREENS, denScroll } = await server.ssrLoadModule('/src/den/route.ts');
const { denWaves, denPatrolPose, denPatrolCanFire, denPatrolFrame } = await server.ssrLoadModule('/src/den/patrol.ts');

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

test('patrols turn through seven art views and wait until they are fully visible', () => {
  assert(denWaves.length >= 18);
  for (let i = 0; i <= 6; i++) {
    const angle = i * Math.PI / 12;
    assert.equal(denPatrolFrame(-angle).index, i);
    assert.equal(denPatrolFrame(angle).index, i);
    assert.equal(denPatrolFrame(-angle).mirror, false);
    assert.equal(denPatrolFrame(angle).mirror, i > 0);
  }
  for (const side of [-1, 1]) {
    const patrol = { course: 'cross', side, slot: 0, heavy: false };
    const initial = denPatrolPose(0, -1.1 * side, patrol);
    const settled = denPatrolPose(2.3, -1.1 * side, patrol);
    assert.equal(denPatrolFrame(initial.heading).index, 6);
    assert(!denPatrolCanFire(initial, patrol));
    assert.equal(denPatrolFrame(settled.heading).index, 0);
    assert(denPatrolCanFire(settled, patrol));
  }
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
