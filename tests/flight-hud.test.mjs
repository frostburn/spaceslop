import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({
  root: new URL('..', import.meta.url).pathname, configFile: false,
  server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, entries: [] }, appType: 'custom',
});
after(() => server.close());
const { Flight } = await server.ssrLoadModule('/src/game.ts');
const { flightReadout } = await server.ssrLoadModule('/src/app/flight-hud.ts');
const { wormholeBosses } = await server.ssrLoadModule('/src/wormhole/route.ts');

test('Wormhole HUD uses the active encounter while the mission is in the Return Channel', () => {
  const flight = new Flight('sentry', [], 'vex', 'wormhole');
  flight.startWormholeEncounter(wormholeBosses.indexOf('summer'));
  let hud = flightReadout(flight, true, false, false);
  assert.deepEqual(hud.sector, { label: 'SUPPLIES · 8/13', title: 'LOTUS HYDRA' });
  assert.equal(hud.boss, 'LOTUS HYDRA · 3 HEADS');
  assert(hud.showBoss);
  assert.equal(hud.tip, 'Collect weapon drops before the next fight');
  flight.step(flight.transitionDuration);
  assert.equal(flightReadout(flight, true, false, false).tip, 'Destroy all three hydra heads. Dodge amber rings.');
  flight.pickupTime = 1;
  flight.pickupMessage = 'Hull repaired · +1';
  assert.equal(flightReadout(flight, true, false, false).tip, flight.pickupMessage);
  assert.equal(flightReadout(flight, false, true, true).tip, 'Preparing graphics…');
  assert.equal(flightReadout(flight, false, false, true).tip, 'Level ready offline');
  flight.phase = 'won';
  hud = flightReadout(flight, false, false, true);
  assert.equal(hud.sector.label, 'CLEAR');
  assert.equal(hud.tip, '');
  assert(!hud.showBoss);
});

test('route progress, section names and the active boss tip stay independent', () => {
  const flight = new Flight('towline', [], 'vex', 'io');
  flight.time = 40;
  assert.equal(flightReadout(flight, true, false, false).sector.label, 'IO · 5/10');
  flight.phase = 'approach';
  assert.equal(flightReadout(flight, true, false, false).sector.label, 'CALDERA APPROACH');
  flight.phase = 'boss';
  assert.equal(flightReadout(flight, true, false, false).tip, 'Sweep the arc across the cyan support, then exposed machinery.');
});
