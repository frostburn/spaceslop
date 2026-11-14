import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { Flight, STEP } = await server.ssrLoadModule('/src/game.ts');
const { campaign } = await server.ssrLoadModule('/src/campaign/missions.ts');
const { PATTERN_HIT_RADIUS, PATTERN_BULLET_CAPACITY } = await server.ssrLoadModule('/src/challenge-patterns.ts');
const { challengeAvailable, decodeChallengeProgress, nextChallengeLevel, readChallengeCode, recordChallengeClear, resetHardcoreProgress, unlockChallenge } =
  await server.ssrLoadModule('/src/campaign/challenges.ts');

const { heliostatChallengeBoss } = await server.ssrLoadModule('/src/heliostat/challenge.ts');
const { HELIOSTAT_FIRE, HELIOSTAT_GROW, HELIOSTAT_INTERVAL } = await server.ssrLoadModule('/src/heliostat/combat.ts');

const launch = (mode, pilot = 'vex', level = 'broodlock') => new Flight('sentry', [], pilot, level, () => .5, mode);

test('challenge unlocks are case-insensitive and Hardcore loss resets only Hardcore clears', () => {
  const progress = decodeChallengeProgress('invalid');
  const campaignClears = new Set(campaign.map(mission => mission.level));
  assert(!challengeAvailable(progress, 'bullet-hell', new Set(['broodlock'])));
  assert(challengeAvailable(progress, 'bullet-hell', campaignClears));
  assert(!challengeAvailable(progress, 'hardcore', campaignClears));
  assert.equal(readChallengeCode('  BuLLeT hELL  '), 'bullet-hell');
  assert.equal(readChallengeCode('Bullet Hell HardCore'), 'hardcore');
  assert.equal(readChallengeCode('hardcore'), undefined);

  const byCode = decodeChallengeProgress(null);
  unlockChallenge(byCode, readChallengeCode('bullet hell hardcore'));
  assert(challengeAvailable(byCode, 'hardcore', new Set()));
  assert(!challengeAvailable(byCode, 'bullet-hell', new Set()));

  assert.deepEqual(recordChallengeClear(progress, 'bullet-hell', 'io'), { next: 'broodlock', unlockedHardcore: false });
  assert.deepEqual(recordChallengeClear(progress, 'bullet-hell', 'broodlock'), { next: 'io', unlockedHardcore: false });
  assert.deepEqual(recordChallengeClear(progress, 'bullet-hell', 'broodlock'), { next: 'io', unlockedHardcore: false });
  assert(!challengeAvailable(progress, 'hardcore', campaignClears));
  assert.deepEqual(recordChallengeClear(progress, 'bullet-hell', 'vents'), { next: 'io', unlockedHardcore: false });
  assert.deepEqual(recordChallengeClear(progress, 'bullet-hell', 'io'), { next: 'vents', unlockedHardcore: false });
  assert.deepEqual(recordChallengeClear(progress, 'bullet-hell', 'vents'), { next: 'titan', unlockedHardcore: false });
  assert.deepEqual(recordChallengeClear(progress, 'bullet-hell', 'ice'), { next: 'titan', unlockedHardcore: false });
  assert.deepEqual(recordChallengeClear(progress, 'bullet-hell', 'titan'), { next: 'heliostat', unlockedHardcore: false });
  assert.deepEqual(recordChallengeClear(progress, 'bullet-hell', 'heliostat'), { next: 'ice', unlockedHardcore: false });
  assert.deepEqual(recordChallengeClear(progress, 'bullet-hell', 'ice'), { next: 'preserve', unlockedHardcore: false });
  assert.deepEqual(recordChallengeClear(progress, 'bullet-hell', 'summer'), { next: 'preserve', unlockedHardcore: false });
  assert(!challengeAvailable(progress, 'hardcore', campaignClears));
  assert.deepEqual(recordChallengeClear(progress, 'bullet-hell', 'preserve'), { next: 'summer', unlockedHardcore: false });
  assert.deepEqual(recordChallengeClear(progress, 'bullet-hell', 'summer'), { next: 'boulevard', unlockedHardcore: false });
  assert.deepEqual(recordChallengeClear(progress, 'bullet-hell', 'biolume'), { next: 'boulevard', unlockedHardcore: false });
  assert.deepEqual(recordChallengeClear(progress, 'bullet-hell', 'boulevard'), { next: 'biolume', unlockedHardcore: false });
  assert(!challengeAvailable(progress, 'hardcore', campaignClears));
  assert.deepEqual(recordChallengeClear(progress, 'bullet-hell', 'biolume'), { next: undefined, unlockedHardcore: true });
  assert(challengeAvailable(progress, 'hardcore', campaignClears));
  recordChallengeClear(progress, 'hardcore', 'broodlock');
  const saved = decodeChallengeProgress(JSON.stringify(progress));
  assert.deepEqual(saved.cleared.hardcore, ['broodlock']);
  resetHardcoreProgress(saved);
  assert.deepEqual(saved.cleared, { 'bullet-hell': ['broodlock', 'io', 'vents', 'titan', 'heliostat', 'ice', 'preserve', 'summer', 'boulevard', 'biolume'], hardcore: [] });
  assert(challengeAvailable(saved, 'hardcore', campaignClears));

  const firstStageSave = decodeChallengeProgress('{"unlocked":["hardcore"],"cleared":{"bullet-hell":["broodlock"]}}');
  assert(challengeAvailable(firstStageSave, 'hardcore', campaignClears));
  assert.deepEqual(recordChallengeClear(firstStageSave, 'bullet-hell', 'broodlock'), { next: 'io', unlockedHardcore: false });
  assert.deepEqual(recordChallengeClear(firstStageSave, 'bullet-hell', 'io'), { next: 'vents', unlockedHardcore: false });
  const twoStageSave = decodeChallengeProgress(JSON.stringify(firstStageSave));
  assert.deepEqual(recordChallengeClear(twoStageSave, 'bullet-hell', 'vents'), { next: 'titan', unlockedHardcore: false });
  assert(challengeAvailable(twoStageSave, 'hardcore', campaignClears));

  const frostwakeSave = decodeChallengeProgress('{"unlocked":["bullet-hell","hardcore"],"cleared":{"bullet-hell":["broodlock","io","vents","titan","heliostat","ice"]}}');
  assert.equal(nextChallengeLevel(frostwakeSave, 'bullet-hell'), 'preserve');
  assert(challengeAvailable(frostwakeSave, 'hardcore', campaignClears));
  const lotusSave = decodeChallengeProgress(JSON.stringify({
    unlocked: ['bullet-hell', 'hardcore'], cleared: { 'bullet-hell': saved.cleared['bullet-hell'].slice(0, 8) },
  }));
  assert.equal(nextChallengeLevel(lotusSave, 'bullet-hell'), 'boulevard');
  assert(challengeAvailable(lotusSave, 'hardcore', campaignClears));
});

test('both challenges build dense fields of slow, readable projectiles', () => {
  function sample(flight, seconds) {
    const shots = new Set(), enemies = new Set();
    let fieldTotal = 0;
    flight.cooldown = flight.droneCooldown = flight.invulnerable = 1e5;
    for (let frame = 0; frame < seconds / STEP; frame++) {
      flight.step(STEP);
      assert(flight.threats.length <= PATTERN_BULLET_CAPACITY);
      fieldTotal += flight.threats.length;
      for (const threat of flight.threats) shots.add(threat);
      for (const enemy of flight.enemies) enemies.add(enemy);
    }
    const speeds = [...shots].map(shot => Math.hypot(shot.vx, shot.vy));
    return { shots: shots.size, enemies: enemies.size, fieldDensity: fieldTotal * STEP / seconds,
      meanSpeed: speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length };
  }

  const regular = launch('regular');
  const gantry = sample(launch('regular', 'vex', 'den'), 100);
  const normal = sample(regular, regular.stageDuration);
  const bulletHell = launch('bullet-hell');
  const hardcore = launch('hardcore');
  const challenge = sample(bulletHell, bulletHell.stageDuration);
  assert.deepEqual(challenge, sample(hardcore, hardcore.stageDuration));
  const io = launch('bullet-hell', 'vex', 'io');
  const ioStage = sample(io, io.stageDuration);
  assert(ioStage.fieldDensity > challenge.fieldDensity);
  assert(ioStage.meanSpeed > challenge.meanSpeed);
  const hadal = launch('bullet-hell', 'vex', 'vents');
  const hadalStage = sample(hadal, hadal.stageDuration);
  assert(hadalStage.shots / hadal.stageDuration > ioStage.shots / io.stageDuration);
  assert(hadalStage.fieldDensity > ioStage.fieldDensity);
  assert(hadalStage.meanSpeed > ioStage.meanSpeed);
  assert.equal(bulletHell.stageDuration, regular.stageDuration);
  assert.equal(normal.enemies, 15);
  assert(challenge.enemies > normal.enemies);
  assert(challenge.shots / bulletHell.stageDuration > gantry.shots / 100);
  assert(challenge.fieldDensity > gantry.fieldDensity * 2);
  assert(challenge.meanSpeed < gantry.meanSpeed && hadalStage.meanSpeed < 5);

  for (const flight of [regular, bulletHell, hardcore]) {
    if (flight.phase === 'stage') flight.step(STEP);
    while (flight.phase === 'approach') flight.step(STEP);
    assert.equal(flight.phase, 'boss');
  }
  const guardian = sample(bulletHell, 4);
  assert.deepEqual(guardian, sample(hardcore, 4));
  assert(guardian.shots > sample(regular, 4).shots * 2);
  assert(bulletHell.bossMaxHealth > regular.bossMaxHealth);
});

test('pattern shots can graze just outside the fighter marker and hit inside it', () => {
  const flight = launch('hardcore');
  const shot = { ...flight.player, z: 0, vx: 0, vy: 0, vz: 0, planar: true, pattern: 'primary' };
  flight.threats = [{ ...shot, x: shot.x + PATTERN_HIT_RADIUS + .03 }];
  flight.step(STEP);
  assert.equal(flight.threats[0].graze, 'near');
  assert.equal(flight.hull, 1);
  flight.threats = [{ ...shot, x: shot.x + PATTERN_HIT_RADIUS - .03 }];
  flight.step(STEP);
  assert.equal(flight.phase, 'lost');
});

test('Hardcore ends on its first hit and Brass can clear on-screen fire repeatedly', () => {
  const regular = launch('regular');
  const bulletHell = launch('bullet-hell');
  const hardcore = launch('hardcore', 'brass');
  for (const flight of [regular, bulletHell, hardcore]) flight.steer(1, 0, STEP);
  assert(bulletHell.player.x > regular.player.x);
  assert.equal(hardcore.player.x, bulletHell.player.x);

  for (let i = 0; i < 5; i++) {
    hardcore.drops.push({ ...hardcore.player, weapon: 'cannon' });
    hardcore.step(STEP);
  }
  assert.equal(hardcore.droneWeapon, 'towline');
  assert(hardcore.wings.every(wing => wing.upgraded));
  const charges = hardcore.charges;
  for (let i = 0; i < 2; i++) {
    const offscreen = { x: 0, y: 8.5, z: 0, vx: 0, vy: -6, vz: 0 };
    hardcore.threats = [offscreen, { ...offscreen, y: 0 }];
    hardcore.drops.push({ ...hardcore.player, weapon: 'cannon' });
    hardcore.step(STEP);
    assert.deepEqual(hardcore.threats, [offscreen]);
    assert.match(hardcore.perkMessage, /Hostile fire cleared/);
    assert.equal(hardcore.charges, charges);
  }
  hardcore.drops.push({ ...hardcore.player, kind: 'repair' });
  hardcore.step(STEP);
  assert.equal(hardcore.hull, 1);
  for (const flight of [regular, bulletHell, hardcore]) {
    flight.threats.push({ ...flight.player, z: 0, vx: 0, vy: 0, vz: 0 });
    flight.step(STEP);
  }
  assert.equal(regular.hull, 3);
  assert.equal(bulletHell.hull, 3);
  assert.equal(hardcore.hull, 0);
  assert.equal(hardcore.phase, 'lost');
});

test('new Bullet Hell sectors escalate the volleys within the actor pools', () => {
  const sectors = [
    ['titan', [[e => e.cicada, 12], [e => e.centipede, 32]]],
    ['heliostat', [[e => e.heliostat?.kind === 'drone', 14], [e => e.heliostat?.kind === 'guard', 4]]],
    ['ice', [[e => e.marine === 'ichthyosaur', 12], [e => e.marine === 'plesiosaur', 4]]],
  ];
  let previousRate = 16;
  for (const [level, pools] of sectors) {
    const flight = launch('bullet-hell', 'vex', level);
    const regular = launch('regular', 'vex', level);
    assert.equal(flight.stageDuration, regular.stageDuration);
    assert.equal(flight.transitionDuration, regular.transitionDuration);
    assert(flight.bossMaxHealth > regular.bossMaxHealth);
    flight.cooldown = flight.droneCooldown = flight.invulnerable = 1e5;
    const shots = new Set();
    while (flight.phase === 'stage') {
      flight.step(STEP);
      for (const [matches, capacity] of pools) assert(flight.enemies.filter(matches).length <= capacity, level);
      assert(flight.threats.length <= PATTERN_BULLET_CAPACITY, level);
      for (const shot of flight.threats) shots.add(shot);
    }
    const rate = shots.size / flight.stageDuration;
    assert(rate > previousRate && rate - previousRate < 5, level);
    previousRate = rate;
    assert.deepEqual(new Set([...shots].map(shot => shot.pattern)), new Set(['primary', 'accent']));
    for (const shot of shots) assert(Math.hypot(shot.vx, shot.vy) < 5.5 && shot.vy < 0, level);
    while (flight.phase === 'approach') flight.step(STEP);
    flight.cooldown = flight.droneCooldown = 1e5;
    while (flight.time < .8) flight.step(STEP);
    assert(flight.cannonWindup > 0 && flight.threats.length === 0, level);
    while (flight.time < 3.55) flight.step(STEP);
    assert(flight.threats.length >= 100 && flight.threats.length <= PATTERN_BULLET_CAPACITY, level);
    assert.deepEqual(new Set(flight.threats.map(shot => shot.pattern)), new Set(['primary', 'accent']));
  }
});

function launchRegulator() {
  const flight = launch('bullet-hell', 'vex', 'heliostat');
  flight.time = flight.stageDuration;
  flight.step(0);
  flight.step(flight.transitionDuration);
  flight.cooldown = flight.droneCooldown = 1e5;
  return flight;
}

function stepTo(flight, time) {
  while (flight.time < time && flight.phase === 'boss') flight.step(STEP);
}

test('the regulator follows its bullet torrent with locked and damaging plasma', () => {
  const flight = launchRegulator();
  const plasmaStart = heliostatChallengeBoss.interval;
  flight.invulnerable = 1e5;
  stepTo(flight, 1.4);
  assert.deepEqual(new Set(flight.threats.map(shot => shot.pattern)), new Set(['primary', 'accent']));
  assert.deepEqual(flight.heliostatTargets, []);

  flight.player = { x: 1.2, y: -5.4 };
  stepTo(flight, plasmaStart + .8);
  assert(flight.cannonWindup > 0);
  const targets = flight.heliostatTargets.map(target => ({ ...target }));
  assert.equal(targets.length, 2);
  assert.deepEqual(targets[0], flight.player);
  assert.notDeepEqual(targets[0], targets[1]);
  const remainingBullets = new Set(flight.threats);
  flight.player = { x: -3.8, y: -6 };
  stepTo(flight, plasmaStart + HELIOSTAT_FIRE + HELIOSTAT_GROW - .05);
  assert.deepEqual(flight.heliostatTargets, targets);
  assert(flight.threats.every(shot => remainingBullets.has(shot)));

  flight.invulnerable = 0;
  const hull = flight.hull;
  flight.player = { ...targets[0] };
  stepTo(flight, plasmaStart + HELIOSTAT_FIRE + HELIOSTAT_GROW + .06);
  assert.equal(flight.hull, hull - 1);
  stepTo(flight, plasmaStart + HELIOSTAT_INTERVAL + .2);
  assert.deepEqual(flight.heliostatTargets, []);
});

test('Pulse interrupts either regulator attack and half health staggers the following attacks', () => {
  const flight = launchRegulator();
  const plasmaStart = heliostatChallengeBoss.interval;
  const nextTorrent = plasmaStart + HELIOSTAT_INTERVAL;
  flight.invulnerable = 1e5;
  stepTo(flight, 1.4);
  flight.damageBoss(flight.bossMaxHealth * .6);
  flight.pulse();
  assert.equal(flight.cannonWindup, 0);
  stepTo(flight, plasmaStart + .3);
  assert.equal(flight.threats.length, 0);
  assert(flight.heliostatUnstable);

  stepTo(flight, plasmaStart + HELIOSTAT_FIRE + HELIOSTAT_GROW + .1);
  assert.equal(flight.heliostatPattern, -1);
  assert.equal(flight.heliostatTargets.length, 2);
  flight.pulse();
  stepTo(flight, plasmaStart + HELIOSTAT_FIRE + 1);
  assert.deepEqual(flight.heliostatTargets, []);
  assert.equal(flight.cannonWindup, 0);

  stepTo(flight, nextTorrent + heliostatChallengeBoss.first + .12);
  assert(flight.threats.length > 0 && flight.threats.every(shot => shot.pattern === 'accent'));
  stepTo(flight, nextTorrent + heliostatChallengeBoss.first + .52);
  assert(flight.threats.some(shot => shot.pattern === 'primary'));
  stepTo(flight, nextTorrent + plasmaStart + .8);
  assert.equal(flight.heliostatPattern, 1);
});
