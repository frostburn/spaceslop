import { registerSW } from 'virtual:pwa-register';
import { BOSS_HP, Flight, HEIGHT, STEP, WIDTH } from './game';
import { setupPilots } from './pilots';
import { FlightView } from './view';
import { readWingWeapon, wingWeapons } from './wing';
import './style.css';

function element<T extends HTMLElement>(id: string) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing #${id}`);
  return node as T;
}

const canvas = element<HTMLCanvasElement>('field');
const panel = element('panel');
if (import.meta.env.DEV) {
  const workshop = document.createElement('a');
  workshop.href = import.meta.env.BASE_URL + 'workshop.html';
  workshop.textContent = 'Asset workshop';
  workshop.style.cssText = 'margin-top: .8rem; color: var(--accent); font-size: .75rem';
  panel.append(workshop);
}
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
const droneWeapon = element<HTMLSelectElement>('drone-weapon');
const testingWings = import.meta.env.DEV || new URLSearchParams(location.search).get('testLoadout') === '1';
element('test-wing-loadout').hidden = !testingWings;
const wingSelectors = ['left-wing', 'right-wing'].map((id) => element<HTMLSelectElement>(id));
for (const select of wingSelectors) {
  select.add(new Option('Empty', ''));
  for (const [key, weapon] of Object.entries(wingWeapons)) select.add(new Option(weapon.name, key));
}
bossHealth.max = BOSS_HP;

const selectedPortrait = element('selected-portrait');
const perkReadout = element('pilot-perk-readout');
const pilotPicker = setupPilots(
  element('loadout-picker'),
  element('pilot-choices'),
  selectedPortrait,
  element('selected-pilot'),
  element('pilot-perk-description'),
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
let flight = new Flight('sentry', [], pilotPicker.selectedId);
let pointer: { id: number; x: number; y: number; dragging: boolean } | undefined;
let pendingUpdate = false;
let offlineReady = false;
let view: FlightView | undefined;
let preparing: AbortController | undefined;

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
  pilotPicker.setVisible(betweenRuns);
  perkReadout.hidden = betweenRuns;
  if (!betweenRuns && perkReadout.textContent !== flight.perkReadout) {
    perkReadout.textContent = flight.perkReadout;
  }
  selectedPortrait.classList.toggle('perk-flash', active && flight.perkTime > 1.15);
  update.hidden = !pendingUpdate || !betweenRuns;
  let tip = 'Tap for drone · Drag to steer';
  if (preparing) tip = 'Preparing graphics…';
  else if (screen === 'title' && offlineReady) tip = 'Ready offline';
  else if (flight.droneWeapon === 'towline') {
    tip = flight.phase === 'boss' ? 'Sweep the arc across the green cannon.' : 'Park the drone · Sweep the arc';
  } else if (flight.phase === 'boss') tip = 'Tap the green cannon. Dodge amber rings.';
  if (active && flight.perkTime > 0) {
    tip = flight.perkMessage;
  } else if (active && flight.pickupTime > 0) {
    tip = flight.pickupMessage;
  } else if (active && flight.phase === 'stage') {
    const wings = flight.wings.flatMap((wing) => wing.weapon
      ? [`${wing.side < 0 ? 'L' : 'R'} ${wingWeapons[wing.weapon].short}`]
      : []);
    if (wings.length) tip = wings.join(' · ');
    else if (flight.drops.length) tip = 'Fly through the drop to equip it';
  }
  if (status.textContent !== tip) status.textContent = tip;
}

async function prepareGraphics() {
  if (!view) return;
  const controller = new AbortController();
  preparing = controller;
  start.disabled = true;
  syncUI();
  try {
    const currentView = view;
    await currentView.warmup(controller.signal, () => currentView.render(flight));
  } catch (error) {
    console.warn('Graphics warm-up did not complete.', error);
  } finally {
    if (preparing === controller) {
      preparing = undefined;
      start.disabled = false;
      syncUI();
    }
  }
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
  if (!view || start.disabled || screen === 'active') return;
  if (screen !== 'paused') {
    flight = new Flight(
      droneWeapon.value === 'towline' ? 'towline' : 'sentry',
      testingWings ? wingSelectors.map((select) => readWingWeapon(select.value)) : [],
      pilotPicker.selectedId,
    );
  }
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
  preparing?.abort();
  preparing = undefined;
  pauseFlight();
  start.disabled = true;
  syncUI();
});
canvas.addEventListener('webglcontextrestored', () => {
  void prepareGraphics();
});

canvas.addEventListener('pointerdown', (event) => {
  if (screen !== 'active' || pointer || event.button !== 0) return;
  const { left, top, width, height } = canvas.getBoundingClientRect();
  if (width === 0 || height === 0) return;
  canvas.setPointerCapture(event.pointerId);
  flight.deployDrone(
    ((event.clientX - left) / width - 0.5) * WIDTH,
    (0.5 - (event.clientY - top) / height) * HEIGHT,
  );
  pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
});
canvas.addEventListener('pointermove', (event) => {
  if (pointer?.id !== event.pointerId) return;
  const { width, height } = canvas.getBoundingClientRect();
  if (width === 0 || height === 0) return;
  const dx = event.clientX - pointer.x;
  const dy = pointer.y - event.clientY;
  if (!pointer.dragging) {
    if (Math.hypot(dx, dy) < 5) return;
    pointer.dragging = true;
    flight.clearAim();
  }
  flight.aimBy(dx * WIDTH / width, dy * HEIGHT / height);
  pointer.x = event.clientX;
  pointer.y = event.clientY;
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
  canvas.addEventListener(type, (event) => {
    if (pointer?.id !== event.pointerId) return;
    if (type !== 'pointerup' && pointer.dragging) flight.clearAim();
    pointer = undefined;
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
void prepareGraphics();
requestAnimationFrame(frame);
