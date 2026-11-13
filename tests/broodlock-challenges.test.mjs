import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { Flight, STEP } = await server.ssrLoadModule('/src/game.ts');
const { campaign } = await server.ssrLoadModule('/src/campaign/missions.ts');
const { PATTERN_HIT_RADIUS, PATTERN_BULLET_CAPACITY } = await server.ssrLoadModule('/src/challenge-patterns.ts');
const { challengeAvailable, decodeChallengeProgress, readChallengeCode, recordChallengeClear, resetHardcoreProgress, unlockChallenge } =
  await server.ssrLoadModule('/src/campaign/challenges.ts');

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
  assert.deepEqual(recordChallengeClear(progress, 'bullet-hell', 'vents'), { next: undefined, unlockedHardcore: true });
  assert(challengeAvailable(progress, 'hardcore', campaignClears));
  recordChallengeClear(progress, 'hardcore', 'broodlock');
  const saved = decodeChallengeProgress(JSON.stringify(progress));
  assert.deepEqual(saved.cleared.hardcore, ['broodlock']);
  resetHardcoreProgress(saved);
  assert.deepEqual(saved.cleared, { 'bullet-hell': ['broodlock', 'io', 'vents'], hardcore: [] });
  assert(challengeAvailable(saved, 'hardcore', campaignClears));

  const firstStageSave = decodeChallengeProgress('{"unlocked":["hardcore"],"cleared":{"bullet-hell":["broodlock"]}}');
  assert(challengeAvailable(firstStageSave, 'hardcore', campaignClears));
  assert.deepEqual(recordChallengeClear(firstStageSave, 'bullet-hell', 'broodlock'), { next: 'io', unlockedHardcore: false });
  assert.deepEqual(recordChallengeClear(firstStageSave, 'bullet-hell', 'io'), { next: 'vents', unlockedHardcore: false });
  const twoStageSave = decodeChallengeProgress(JSON.stringify(firstStageSave));
  assert.deepEqual(recordChallengeClear(twoStageSave, 'bullet-hell', 'vents'), { next: undefined, unlockedHardcore: false });
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
