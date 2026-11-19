import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createServer } from 'vite';

const server = await createServer({
  configFile: false, server: { middlewareMode: true, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, entries: [] }, appType: 'custom',
});
after(() => server.close());
const { Flight, STEP } = await server.ssrLoadModule('/src/game.ts');
const { bindFlightInput } = await server.ssrLoadModule('/src/app/input.ts');
const { recordFlightReplay, parseFlightReplay, playFlightReplay, replayRandom } =
  await server.ssrLoadModule('/src/dev/flight-replay.ts');

function setup(t, capture = false) {
  const keys = new EventTarget();
  globalThis.window = keys;
  globalThis.document = { body: new EventTarget() };
  const canvas = Object.assign(new EventTarget(), {
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 360, height: 640 }),
    setPointerCapture() {},
    hasPointerCapture: () => false,
  });
  const controller = new AbortController();
  t.after(() => {
    controller.abort();
    delete globalThis.window;
    delete globalThis.document;
  });
  const flight = new Flight('sentry', [], 'vex', 'boulevard');
  const recorder = capture && recordFlightReplay(flight, { drone: 'sentry', pilot: 'vex', wings: [], mode: 'regular' }, 28);
  const input = bindFlightInput(canvas, {
    flight: () => flight, active: () => true, pause() {},
    pulse() { flight.pulse(); if (recorder) recorder.pulse(flight); },
    ...(recorder ? { recordSteering: recorder.steer, recordDrone: recorder.drone } : {}),
  }, controller.signal);
  function pointer(type, clientX, clientY, pointerId = 1) {
    canvas.dispatchEvent(Object.assign(new Event(type), { pointerId, clientX, clientY, button: 0 }));
  }
  function space(target, repeat = false) {
    const event = Object.assign(new Event('keydown', { cancelable: true }), { code: 'Space', repeat });
    // The window listener receives the original focused target through bubbling in the browser.
    Object.defineProperty(event, 'target', { value: target });
    keys.dispatchEvent(event);
    return event.defaultPrevented;
  }
  return { flight, input, pointer, space, canvas, recorder, keys };
}

test('a tap parks the drone and a drag moves only the fighter', t => {
  const { flight, input, pointer } = setup(t);
  pointer('pointerdown', 100, 260);
  assert.equal(flight.droneTarget, undefined);
  pointer('pointermove', 102, 262);
  pointer('pointerup', 102, 262);
  assert.deepEqual(flight.droneTarget, { x: -2.25, y: 2 });
  const parked = { ...flight.droneTarget };
  for (let i = 0; i < 60; i++) flight.step(STEP);
  assert.deepEqual(flight.drone, parked);

  const startX = flight.player.x;
  pointer('pointerdown', 150, 400);
  pointer('pointermove', 152, 400);
  pointer('pointermove', 156, 400);
  input.steer(STEP);
  assert(flight.player.x > startX, 'small corrections accumulate across the tap threshold');
  pointer('pointermove', 296, 400);
  const stopped = { ...flight.player };
  pointer('pointerup', 296, 400);
  input.steer(STEP);
  assert.deepEqual(flight.player, stopped);
  for (let i = 0; i < 30; i++) {
    input.steer(STEP);
    flight.step(STEP);
  }
  assert.deepEqual(flight.player, stopped);
  assert.deepEqual(flight.drone, parked);
});

test('a fast swipe between ticks gets one movement step, including the release coordinate', t => {
  const { flight, input, pointer } = setup(t);
  const startX = flight.player.x;
  pointer('pointerdown', 100, 240);
  pointer('pointerup', 260, 240);
  input.steer(STEP);
  const endX = flight.player.x;
  assert(endX > startX);
  input.steer(STEP);
  assert.equal(flight.player.x, endX);
  assert.equal(flight.droneTarget, undefined);
});

test('cancel, lost capture, and pause discard the gesture', t => {
  const { flight, input, pointer } = setup(t);
  const start = { ...flight.player };
  for (const end of ['pointercancel', 'lostpointercapture', 'reset']) {
    for (const dx of [0, 60]) {
      pointer('pointerdown', 100, 240);
      pointer('pointermove', 100 + dx, 240);
      if (end === 'reset') input.reset();
      else pointer(end, 100 + dx, 240);
      pointer('pointerup', 100 + dx, 240);
      input.steer(STEP);
      assert.equal(flight.droneTarget, undefined);
      assert.deepEqual(flight.player, start);
    }
  }
});

test('Space stays native on HUD controls and fires once per press on the playfield', t => {
  const { flight, space, canvas } = setup(t);
  const charges = flight.charges;
  assert.equal(space(new EventTarget()), false);
  assert.equal(flight.charges, charges);
  assert.equal(space(canvas), true);
  assert.equal(space(canvas, true), true);
  assert.equal(flight.charges, charges - 1);
  assert.equal(space(document.body), true);
  assert.equal(flight.charges, charges - 2);
});

test('recorded controls replay a short swipe, interrupted drag, keyboard override and final-tick Pulse', t => {
  const { flight, input, pointer, space, recorder, keys, canvas } = setup(t, true);
  function step() {
    input.steer(STEP);
    flight.step(STEP);
    recorder.step(flight);
  }
  function key(type, code) {
    keys.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { code }));
  }
  pointer('pointerdown', 150, 400);
  pointer('pointerup', 208, 408);
  step();
  step();
  pointer('pointerdown', 112, 254);
  pointer('pointermove', 192, 240);
  step();
  key('keydown', 'ArrowUp');
  key('keydown', 'KeyW');
  key('keydown', 'KeyD');
  for (let i = 0; i < 27; i++) step();
  key('keyup', 'ArrowUp');
  key('keyup', 'KeyW');
  key('keyup', 'KeyD');
  pointer('pointermove', 192, 352);
  step();
  input.reset();
  pointer('pointerup', 192, 352);
  step();
  pointer('pointerdown', 120, 270);
  pointer('pointerup', 120, 270);
  for (let i = 0; i < 120; i++) step();
  space(canvas);
  const saved = parseFlightReplay(JSON.stringify(recorder.snapshot(flight)));
  assert.equal(saved.commands.at(-1)[0], saved.ticks);
  assert.deepEqual(saved.commands.at(-1), [saved.ticks, 'pulse']);
  assert.equal(saved.commands.filter(command => command[1] === 'steer' && command[3] === 2).length, 1);
  const replay = playFlightReplay(saved);
  const played = new Flight('sentry', [], 'vex', saved.level, replayRandom(saved.seed));
  for (let i = 0; i <= saved.ticks && !replay.done; i++) replay.step(played);
  assert.equal(replay.matches, true);
  assert.deepEqual(played.player, flight.player);
  assert.deepEqual(played.drone, flight.drone);
  assert.deepEqual(played.enemies, flight.enemies);
  assert.deepEqual(played.shots, flight.shots);
  assert.equal(played.time, flight.time, 'playback does not advance beyond the snapshot');
});
