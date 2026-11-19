import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, entries: [] } });
after(() => server.close());
const { advanceHook, hookBullet } = await server.ssrLoadModule('/src/hook-bullet.ts');
const { Flight, STEP } = await server.ssrLoadModule('/src/game.ts');
const { wormholeBosses } = await server.ssrLoadModule('/src/wormhole/route.ts');
const { ioChallengeBoss } = await server.ssrLoadModule('/src/io-challenge.ts');
const { lotusChallengeBoss } = await server.ssrLoadModule('/src/summer/challenge.ts');
const { boulevardChallengeBoss, stepBoulevardChallengeDriver } = await server.ssrLoadModule('/src/boulevard-challenge.ts');
const { stepChallengeAnt } = await server.ssrLoadModule('/src/broodlock/challenge.ts');

function move(shot, dt) {
  if (shot.hook) advanceHook(shot, shot.hook, dt);
  else { shot.x += shot.vx * dt; shot.y += shot.vy * dt; }
}

function checkLock(shot, target) {
  const copy = structuredClone(shot);
  if (copy.hook) move(copy, copy.hook.lead + copy.hook.remaining + 1e-8);
  const dx = target.x - copy.x, dy = target.y - copy.y;
  const speed = Math.hypot(copy.vx, copy.vy);
  assert(speed > 0 && dx * copy.vx + dy * copy.vy >= -1e-6, 'the exit points towards the lock');
  move(copy, Math.hypot(dx, dy) / speed);
  assert(Math.hypot(copy.x - target.x, copy.y - target.y) < 1e-6, 'the ballistic path passes through the lock');
}

test('aft-fired pairs round opposite lobes, cross at the lock, then carry on at the same speed', () => {
  const origin = { x: 0, y: 2 }, target = { x: 0, y: -5 };
  const [left, right] = [-1, 1].map(side => hookBullet(origin, target, side * 3.4, 2.4, 4.8, 'accent'));
  for (const shot of [left, right]) {
    assert(shot.vy > 0);
    checkLock(shot, target);
  }
  let width = 0, height = 0;
  for (let tick = 0; tick < 230; tick++) {
    move(left, STEP); move(right, STEP);
    assert(Math.abs(left.x + right.x) < 1e-9 && Math.abs(left.y - right.y) < 1e-9);
    width = Math.max(width, right.x - left.x); height = Math.max(height, right.y - origin.y);
  }
  assert(width > 4 && height > .65);
  assert(right.x < 0 && right.y < target.y && !right.hook);
  assert(Math.abs(Math.hypot(right.vx, right.vy) - 4.8) < 1e-8);
});

test('edge, close and overhead locks stay finite and agree across step sizes', () => {
  const origin = { x: 3.9, y: 5.15 };
  for (const target of [{x:-3.9,y:-6.9}, {x:4,y:5.2}, {x:4.5,y:7.15}, {x:3.4,y:6.6}, origin]) {
    const shot = hookBullet(origin, target, 2.4, 2, 5, 'accent');
    checkLock(shot, target);
    const stepped = structuredClone(shot);
    for (let i = 0; i < 210; i++) move(stepped, STEP);
    move(shot, 210 * STEP);
    for (const axis of ['x', 'y', 'vx', 'vy']) assert(Math.abs(shot[axis] - stepped[axis]) < 1e-8);
  }
});

test('soldiers and armored hovercars lock at release from the moving rear and keep that aim', () => {
  const player = { x: -2.75, y: -4.5 }, lock = { x: 2.6, y: -2.1 };
  for (const fire of [
    enemy => stepChallengeAnt(enemy, 'soldier', 0, player),
    enemy => stepBoulevardChallengeDriver(enemy, { heavy:true, formation:'rush', slot:0, mirror:1 }, player, 12, STEP),
  ]) {
    Object.assign(player, { x: -2.75, y: -4.5 });
    const enemy = { x: 1.1, y: 4.2, lane: 1, heading: .14, age: 1.6, fire: 2 };
    assert.equal(fire(enemy), undefined);
    Object.assign(player, lock);
    enemy.age = 2; enemy.y = 3.5;
    const hooks = fire(enemy).filter(shot => shot.hook);
    assert(hooks.length >= 2);
    assert(hooks.every(shot => shot.y > enemy.y + .6 && shot.x < enemy.x && shot.vy > 0));
    for (const shot of hooks) checkLock(shot, lock);
    player.x = -3;
    enemy.age = enemy.fire;
    for (const shot of fire(enemy).filter(shot => shot.hook)) checkLock(shot, lock);
  }
});

const bosses = { io: ioChallengeBoss, summer: lotusChallengeBoss, boulevard: boulevardChallengeBoss };
function beginBoss(level, mode = 'bullet-hell', rush = false) {
  const f = new Flight('sentry', [], 'vex', rush ? 'wormhole' : level, () => .5, mode);
  if (rush) f.startWormholeEncounter(wormholeBosses.indexOf(level));
  else { f.time = f.stageDuration; f.step(0); }
  f.step(f.transitionDuration);
  f.cooldown = f.droneCooldown = f.invulnerable = 1e5;
  return f;
}
function until(f, time) { while (f.time + 1e-9 < time) f.step(STEP); }
function nextHooks(f, time) {
  f.threats = [];
  until(f, time);
  return f.threats.filter(shot => shot.hook);
}

test('all three bosses use the same locked trajectories in Bullet Hell and Hardcore wormhole rematches', () => {
  for (const [level, timing] of Object.entries(bosses)) {
    const volleys = [];
    for (const [mode, rush] of [['bullet-hell', false], ['hardcore', true], ['regular', false]]) {
      const f = beginBoss(level, mode, rush);
      const start = level === 'io' ? 0 : timing.interval;
      f.time = start;
      const lock = {x:-2.8,y:-4.4};
      assert.equal(f.hookTargeting, false);
      Object.assign(f.player, {x:2.5,y:-6.1});
      until(f, start + timing.lockAt + STEP);
      assert.equal(f.hookTargeting, mode !== 'regular', level);
      Object.assign(f.player, lock);
      const shots = nextHooks(f, start + timing.first + STEP);
      assert.equal(f.hookTargeting, false, level);
      if (mode === 'regular') { assert.equal(shots.length, 0); continue; }
      assert(shots.length >= 2 && shots.every(shot => shot.vy > 0), level);
      shots.forEach(shot => checkLock(shot, lock));
      assert.deepEqual(f.bossWarnings, []);
      volleys.push(shots);
      f.pulse();
      assert.equal(f.threats.length, 0);
    }
    assert.deepEqual(volleys[0], volleys[1], level);
  }
});

test('a released volley hits a parked ship and lets a ship that breaks sideways escape', () => {
  for (const dodge of [false, true]) {
    const f = beginBoss('io');
    Object.assign(f.player, {x:0,y:-5});
    until(f, ioChallengeBoss.first + STEP);
    assert(f.threats.some(shot => shot.hook));
    f.invulnerable = 0;
    const hull = f.hull;
    while (f.time < ioChallengeBoss.interval + .55) {
      if (dodge) f.steer(1, 0, STEP);
      f.step(STEP);
    }
    assert.equal(f.hull, hull - Number(!dodge));
  }
});

test('later cruiser and Hydra salvos take a fresh lock, and breaking the next crown silences it', () => {
  for (const [level, relockRow, firstRow] of [['boulevard', 6, 9], ['summer', 4, 6]]) {
    const timing = bosses[level], f = beginBoss(level);
    const first = timing.interval + timing.first;
    f.time = timing.interval;
    Object.assign(f.player, {x:-3,y:-5});
    until(f, first + STEP);
    const oldShots = [...f.threats];
    const lock = {x:1.8,y:-3.2};
    Object.assign(f.player, {x:3,y:-6.7});
    until(f, first + relockRow * timing.spacing + STEP);
    assert.equal(f.hookTargeting, true, level);
    Object.assign(f.player, lock);
    oldShots.forEach(shot => checkLock(shot, {x:-3,y:-5}));
    const shots = nextHooks(f, first + firstRow * timing.spacing + STEP);
    assert(shots.length > 0);
    assert.equal(f.hookTargeting, false, level);
    shots.forEach(shot => checkLock(shot, lock));
    if (level === 'summer') {
      f.damageBoss(f.summerHeadMaxHealth, false, 1);
      until(f, first + 10 * timing.spacing + STEP);
      assert.equal(f.summerHeadCharge(1), 0);
      assert.equal(f.hookTargeting, false);
      assert.deepEqual(nextHooks(f, first + 15 * timing.spacing + STEP), []);
    }
  }
});

test('a soldier warns only while charging and Pulse removes the warning', () => {
  const f = new Flight('sentry', [], 'vex', 'broodlock', () => .5, 'bullet-hell');
  f.cooldown = f.droneCooldown = f.invulnerable = 1e5;
  assert.equal(f.hookTargeting, false);
  while (!f.hookTargeting && f.time < 6) f.step(STEP);
  assert.equal(f.hookTargeting, true);
  f.pulse();
  assert.equal(f.hookTargeting, false);
});
