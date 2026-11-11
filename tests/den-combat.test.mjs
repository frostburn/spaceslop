import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { DEN_CYCLE, denBodyEntry, denPose } = await server.ssrLoadModule('/src/den/combat.ts');
const { Flight, STEP } = await server.ssrLoadModule('/src/game.ts');
const { DEN_APPROACH, DEN_DURATION, DEN_SCREENS, denScroll } = await server.ssrLoadModule('/src/den/route.ts');
const { denWaves, denPatrolPose, denPatrolCanFire, denPatrolBlend } = await server.ssrLoadModule('/src/den/patrol.ts');
const { createDenPlateMotion } = await server.ssrLoadModule('/src/den/plate-motion.ts');

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
  const dominant = pose => pose.mix < .5 ? pose.first : pose.second;
  for (let i = 0; i <= 6; i++) {
    const angle = i * Math.PI / 12;
    assert.equal(dominant(denPatrolBlend(-angle)), i);
    assert.equal(dominant(denPatrolBlend(angle)), i);
    assert.equal(denPatrolBlend(-angle).mirror, false);
    assert.equal(denPatrolBlend(angle).mirror, i > 0);
  }
  const blend = denPatrolBlend(2.5 * Math.PI / 12);
  assert.equal(blend.first, 2);
  assert.equal(blend.second, 3);
  assert(Math.abs(blend.mix - .5) < 1e-10);
  for (const side of [-1, 1]) {
    const patrol = { course: 'cross', side, slot: 0, heavy: false };
    const initial = denPatrolPose(0, -1.1 * side, patrol);
    const settled = denPatrolPose(2.3, -1.1 * side, patrol);
    assert.equal(dominant(denPatrolBlend(initial.heading)), 6);
    assert(!denPatrolCanFire(initial, patrol));
    assert.equal(dominant(denPatrolBlend(settled.heading)), 0);
    assert(denPatrolCanFire(settled, patrol));
  }
});

test('passing actors disturb a visible flag, and a paused frame holds the wake', () => {
  const motion = createDenPlateMotion(), scroll = .55;
  const sample = (elapsed, actors = [], newFlight = false) => {
    motion.update(0, scroll, 2, { elapsed, actors, newFlight });
    assert.equal(motion.uniforms.flagCount.value, 1);
    return motion.uniforms.flagTips.value[0].w;
  };
  motion.useCliff(true);
  assert.equal(sample(0), 0);
  const rod = motion.uniforms.flagRods.value[0], tip = motion.uniforms.flagTips.value[0];
  const near = { x: ((rod.x + rod.z + 2 * tip.x) * .25 - .5) * 9,
    y: ((Math.max(rod.y, rod.w) + tip.y) * .5 - scroll - .5) * 16, speed: 6 };
  const wake = sample(.12, [near]);
  assert(wake > .8);
  assert.equal(sample(0), wake);
  const tail = sample(.23);
  assert(tail > 0 && tail < wake);
  assert.equal(sample(0, [], true), 0);
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
