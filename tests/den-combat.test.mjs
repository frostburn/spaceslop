import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { DEN_CYCLE, denBodyEntry, denPose } = await server.ssrLoadModule('/src/den/combat.ts');
const { Flight, STEP } = await server.ssrLoadModule('/src/game.ts');

test('the gantry sweep alternates from the settled bike position and carries its hit area', () => {
  const a = denPose(DEN_CYCLE - .0001), b = denPose(DEN_CYCLE);
  assert(Math.hypot(a.x - b.x, a.y - b.y) < .001);
  assert(denPose(1.23).throttle > denPose(.2).throttle + .6);
  for (const time of [.2, 1.92, DEN_CYCLE + 2.6]) {
    const { x, y } = denPose(time);
    assert(Number.isFinite(denBodyEntry(time, { x, y: y - 2 }, { x, y: y + 1 })));
    assert.equal(denBodyEntry(time, { x: x + 3, y: y - 2 }, { x: x + 3, y: y + 1 }), Infinity);
  }
});

test('the gantry encounter is winnable with the ordinary ship and planar shots', () => {
  const flight = new Flight('sentry', [], 'vex', 'den');
  assert.equal(flight.phase, 'approach');
  flight.deployDrone(0, -2.8);
  let sawAttack = false;
  for (let frame = 0; frame < 1200 && flight.phase !== 'won' && flight.phase !== 'lost'; frame++) {
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
