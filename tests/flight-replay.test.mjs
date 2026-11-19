import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({ configFile: false, appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, entries: [] } });
after(() => server.close());
const { Flight, STEP } = await server.ssrLoadModule('/src/game.ts');
const { parseFlightReplay, playFlightReplay, recordFlightReplay, replayRandom } =
  await server.ssrLoadModule('/src/dev/flight-replay.ts');

const seed = 0x2fbbd051;
const loadout = { mode: 'bullet-hell', pilot: 'glint', drone: 'towline', wings: [undefined, 'laser'] };
function toSupplies(seed) {
  const flight = new Flight(loadout.drone, loadout.wings, loadout.pilot, 'wormhole', replayRandom(seed), loadout.mode);
  flight.time = flight.stageDuration;
  flight.step(0);
  return flight;
}

test('replay roundtrip restores seeded Wormhole drops, the shortcut and right-only loadout', () => {
  const flight = toSupplies(seed);
  const recorder = recordFlightReplay(flight, loadout, seed, 'boss');
  const supply = flight.drops.map(drop => drop.weapon);
  assert.notDeepEqual(toSupplies(42).drops.map(drop => drop.weapon), supply);
  const initial = recorder.snapshot(flight);
  for (let i = 0; i < 630; i++) {
    const x = i < 180 ? -1 : 1;
    recorder.steer(x, 0, undefined);
    flight.steer(x, 0, STEP);
    flight.step(STEP);
    recorder.step(flight);
  }
  assert.equal(initial.ticks, 0);
  assert.deepEqual(initial.commands, []);
  const saved = parseFlightReplay(JSON.stringify(recorder.snapshot(flight)));
  assert.deepEqual(saved.loadout.wings, [null, 'laser']);
  assert.equal(saved.shortcut, 'boss');
  assert(saved.milestones.some(mark => mark.phase === 'boss'));
  const replay = playFlightReplay(saved), watched = toSupplies(saved.seed);
  assert.deepEqual(watched.drops.map(drop => drop.weapon), supply);
  for (let i = 0; i <= saved.ticks && !replay.done; i++) replay.step(watched);
  assert.equal(replay.matches, true);
  assert.deepEqual(watched.threats, flight.threats);
  assert.deepEqual(watched.wings, flight.wings);
  assert.deepEqual(watched.drops, flight.drops);
});

test('an input-only snapshot includes a Pulse before the first tick and diagnoses changed results', () => {
  const launch = () => new Flight('sentry', [], 'vex', 'broodlock', replayRandom(seed));
  const flight = launch();
  const recorder = recordFlightReplay(flight, { ...loadout, mode: 'regular', pilot: 'vex', drone: 'sentry', wings: [] }, seed);
  flight.pulse();
  recorder.pulse(flight);
  const saved = parseFlightReplay(JSON.stringify(recorder.snapshot(flight)));
  assert.equal(saved.ticks, 0);
  assert.equal(saved.milestones.at(-1).charges, 1);
  const replay = playFlightReplay(saved), watched = launch();
  replay.step(watched);
  assert.equal(watched.charges, 1);
  assert.equal(watched.time, 0);
  assert.equal(replay.matches, true);
  const changed = playFlightReplay({ ...saved, end: { ...saved.end, hull: 1 } });
  changed.step(launch());
  assert.equal(changed.matches, false);
});

test('the replay parser rejects unsupported clocks, bad loadouts and unusable input', () => {
  const valid = recordFlightReplay(toSupplies(seed), loadout, seed, 'boss').snapshot(toSupplies(seed));
  const mutations = [
    { version: 2 }, { step: .25 }, { level: 'constructor' }, { shortcut: 'trench' },
    { loadout: { ...valid.loadout, wings: ['missing', null] } },
    { commands: [[1, 'pulse']] }, { commands: [[0, 'drag', 0, 0]] },
    { ticks: 2, commands: [[1, 'pulse'], [0, 'pulse']] },
    { commands: [[0, 'drone', 0, 8]] },
  ];
  for (const changes of mutations) assert.throws(() => parseFlightReplay(JSON.stringify({ ...valid, ...changes })), /replay/i);
  assert.throws(() => parseFlightReplay('{'), /JSON/);
});
