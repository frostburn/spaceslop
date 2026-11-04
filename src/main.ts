import { registerSW } from 'virtual:pwa-register';
import { BOSS_HP, Flight, HEIGHT, STEP, WIDTH } from './game';
import { setupPilots } from './pilots';
import { FlightView } from './view';
import './style.css';

function element<T extends HTMLElement>(id: string) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

const canvas = element<HTMLCanvasElement>('field');
const panel = element('panel');
const heading = element('heading');
const message = element('message');
const start = element<HTMLButtonElement>('start');
const pause = element<HTMLButtonElement>('pause');
const pulse = element<HTMLButtonElement>('pulse');
const update = element<HTMLButtonElement>('update');
const status = element('status');
const sector = element('sector');
const hull = element('hull');
const score = element('score');
const charges = element('charges');
const bossHud = element('boss-hud');
const bossHealth = element<HTMLProgressElement>('boss-health');
bossHealth.max = BOSS_HP;

const showPilotPicker = setupPilots(
  element<HTMLFieldSetElement>('pilot-picker'),
  element('pilot-choices'),
  element('selected-portrait'),
  element('selected-pilot'),
  element('desktop-picker'),
  element('mobile-picker'),
);

type Screen = 'title' | 'active' | 'paused' | 'results';
const directions: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
  ArrowUp: [0, 1], KeyW: [0, 1], ArrowDown: [0, -1], KeyS: [0, -1],
};
const keys = new Set<string>();
let screen: Screen = 'title';
let flight = new Flight();
let pointer: { id: number; x: number; y: number } | undefined;
let pendingUpdate = false;
let offlineReady = false;
let view: FlightView | undefined;

try {
  view = new FlightView(canvas);
} catch {
  start.disabled = true;
  message.textContent = 'This device needs WebGL 2 to launch Spaceslop.';
}

const applyUpdate = registerSW({
  onNeedRefresh() {
    pendingUpdate = true;
    syncUI();
  },
  onOfflineReady() {
    offlineReady = true;
    syncUI();
  },
});

function syncUI() {
  const active = screen === 'active';
  const fighting = flight.phase === 'stage' || flight.phase === 'boss';
  const label = {
    stage: 'SECTOR 01', approach: 'CONTACT', boss: 'BOSS', won: 'CLEAR', lost: 'SIGNAL LOST',
  }[flight.phase];
  sector.textContent = label;
  score.textContent = String(flight.score).padStart(6, '0');
  hull.textContent = String(flight.hull).padStart(2, '0');
  charges.textContent = String(flight.charges).padStart(2, '0');
  bossHud.hidden = flight.phase !== 'boss';
  bossHealth.value = flight.bossHealth;
  pulse.disabled = !active || !fighting || flight.charges === 0;
  pause.hidden = !active;
  panel.hidden = active;
  const betweenRuns = screen === 'title' || screen === 'results';
  showPilotPicker(betweenRuns);
  update.hidden = !pendingUpdate || !betweenRuns;
  const tip = screen === 'title' && offlineReady ? 'Ready offline'
    : flight.phase === 'boss' ? 'Line up. Dodge the rings.' : 'Drag to steer';
  if (status.textContent !== tip) status.textContent = tip;
}

function resetInput() {
  if (pointer && canvas.hasPointerCapture(pointer.id)) canvas.releasePointerCapture(pointer.id);
  pointer = undefined;
  flight.clearAim();
  keys.clear();
}

function pauseFlight() {
  if (screen !== 'active') return;
  screen = 'paused';
  resetInput();
  heading.textContent = 'Paused';
  message.textContent = 'Your run is on hold.';
  start.textContent = 'Resume';
  syncUI();
}

function showResults() {
  screen = 'results';
  resetInput();
  heading.textContent = flight.phase === 'won' ? 'Sector clear' : 'Ship lost';
  message.textContent = `Score ${flight.score}`;
  start.textContent = 'Fly again';
  syncUI();
}

start.addEventListener('click', () => {
  if (!view || screen === 'active') return;
  if (screen !== 'paused') flight = new Flight();
  screen = 'active';
  resetInput();
  view.render(flight);
  syncUI();
});

function firePulse() {
  if (screen !== 'active') return;
  flight.pulse();
  if (flight.phase === 'won') showResults();
  else syncUI();
}

pause.addEventListener('click', pauseFlight);
pulse.addEventListener('click', firePulse);
update.addEventListener('click', () => { void applyUpdate(true); });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseFlight();
});
window.addEventListener('blur', pauseFlight);
window.addEventListener('pagehide', pauseFlight);
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault();
  pauseFlight();
  start.disabled = true;
});
canvas.addEventListener('webglcontextrestored', () => {
  start.disabled = false;
  requestAnimationFrame(() => view?.render(flight));
});

canvas.addEventListener('pointerdown', (event) => {
  if (screen !== 'active' || pointer || event.button !== 0) return;
  canvas.setPointerCapture(event.pointerId);
  flight.clearAim();
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
});
canvas.addEventListener('pointermove', (event) => {
  if (pointer?.id !== event.pointerId) return;
  const { width, height } = canvas.getBoundingClientRect();
  if (width === 0 || height === 0) return;
  flight.aimBy(
    (event.clientX - pointer.x) * WIDTH / width,
    (pointer.y - event.clientY) * HEIGHT / height,
  );
  pointer.x = event.clientX;
  pointer.y = event.clientY;
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
  canvas.addEventListener(type, (event) => {
    if (pointer?.id !== event.pointerId) return;
    pointer = undefined;
    if (type !== 'pointerup') flight.clearAim();
  });
}

window.addEventListener('keydown', (event) => {
  if (screen !== 'active') return;
  if (event.code === 'Escape') {
    event.preventDefault();
    pauseFlight();
  } else if (event.code === 'Space' && !event.repeat) {
    event.preventDefault();
    firePulse();
  } else if (Object.hasOwn(directions, event.code)) {
    event.preventDefault();
    keys.add(event.code);
  }
});
window.addEventListener('keyup', (event) => keys.delete(event.code));

new ResizeObserver(() => {
  view?.resize(canvas.clientWidth, canvas.clientHeight);
  view?.render(flight);
}).observe(canvas);

let previous = performance.now();
let accumulator = 0;
function frame(now: number) {
  const elapsed = Math.min(Math.max((now - previous) / 1000, 0), 0.1);
  previous = now;
  if (screen === 'active' && view) {
    accumulator += elapsed;
    while (accumulator >= STEP && screen === 'active') {
      let x = 0;
      let y = 0;
      for (const key of keys) {
        x += directions[key][0];
        y += directions[key][1];
      }
      flight.steer(x, y, STEP);
      flight.step(STEP);
      accumulator -= STEP;
      if (flight.phase === 'won' || flight.phase === 'lost') showResults();
    }
    view.render(flight, elapsed);
    syncUI();
  } else {
    accumulator = 0;
  }
  requestAnimationFrame(frame);
}
syncUI();
requestAnimationFrame(frame);
