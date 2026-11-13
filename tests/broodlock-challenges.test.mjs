import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' });
after(() => server.close());
const { Flight, STEP } = await server.ssrLoadModule('/src/game.ts');
const { campaign } = await server.ssrLoadModule('/src/campaign/missions.ts');
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

  assert(recordChallengeClear(progress, 'bullet-hell'));
  assert(!recordChallengeClear(progress, 'bullet-hell'));
  assert(challengeAvailable(progress, 'hardcore', campaignClears));
  recordChallengeClear(progress, 'hardcore');
  const saved = decodeChallengeProgress(JSON.stringify(progress));
  assert.deepEqual(saved.cleared.hardcore, ['broodlock']);
  resetHardcoreProgress(saved);
  assert.deepEqual(saved.cleared, { 'bullet-hell': ['broodlock'], hardcore: [] });
  assert(challengeAvailable(saved, 'hardcore', campaignClears));
});

test('both challenges share a denser route and boss than the regular campaign', () => {
  function sample(flight, seconds) {
    const shots = new Set(), enemies = new Set();
    flight.cooldown = flight.droneCooldown = flight.invulnerable = 1e5;
    for (let frame = 0; frame < seconds / STEP; frame++) {
      flight.step(STEP);
      for (const threat of flight.threats) shots.add(threat);
      for (const enemy of flight.enemies) enemies.add(enemy);
    }
    const speeds = [...shots].map(shot => Math.hypot(shot.vx, shot.vy));
    return { shots: shots.size, enemies: enemies.size, meanSpeed: speeds.reduce((sum, speed) => sum + speed, 0) / speeds.length };
  }

  const regular = launch('regular');
  const gantry = sample(launch('regular', 'vex', 'den'), 100);
  const normal = sample(regular, regular.stageDuration);
  const bulletHell = launch('bullet-hell');
  const hardcore = launch('hardcore');
  const challenge = sample(bulletHell, bulletHell.stageDuration);
  assert.deepEqual(challenge, sample(hardcore, hardcore.stageDuration));
  assert.equal(bulletHell.stageDuration, regular.stageDuration);
  assert.equal(normal.enemies, 15);
  assert(challenge.enemies > normal.enemies);
  assert(challenge.shots / bulletHell.stageDuration > gantry.shots / 100);
  assert(challenge.meanSpeed > gantry.meanSpeed);

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
