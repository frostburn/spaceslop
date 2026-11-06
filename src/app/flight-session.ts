import { bindFlightInput } from './input';
import { ventSection } from '../vent-layout';
import { ioSection, IO_SCREENS } from '../io-layout';
import { titanSection } from '../titan-layout';
import { BOSS_HP, Flight, STEP } from '../game';
import { setupPilots } from '../pilots';
import { createFlightView, type FlightView } from '../view';
import { levels, readLevel, type LevelId } from '../levels';
import { iceSection } from '../ice-layout';
import { readWingWeapon, wingWeapons } from '../wing';
export async function openFlightSession(selectedLevel: LevelId, signal: AbortSignal) {
  function element<T extends HTMLElement>(id: string) {
    const node = document.getElementById(id);
    if (!node)
      throw new Error(`Missing #${id}`);
    return node as T;
  }
  const previousCanvas = element<HTMLCanvasElement>('field');
  const canvas = previousCanvas.cloneNode(false) as HTMLCanvasElement;
  previousCanvas.replaceWith(canvas);
  const panel = element('panel');
  let devBossLaunch = false;
  if (import.meta.env.DEV) {
    panel.querySelector('#dev-tools')?.remove();
    const devTools = document.createElement('div');
    devTools.id = 'dev-tools';
    devTools.className='dev-links';
    panel.append(devTools);
    const bossStart = document.createElement('button');
    bossStart.id = 'dev-boss';
    bossStart.type = 'button';
    bossStart.textContent = 'Launch at boss';
    bossStart.style.marginTop = '.75rem';
    bossStart.disabled = true;
    bossStart.addEventListener('click', () => {
      if (screen !== 'title' && screen !== 'results')
        return;
      devBossLaunch = true;
      start.click();
      devBossLaunch = false;
    }, { signal });
    devTools.append(bossStart);
    const workshop = document.createElement('a');
    workshop.href = import.meta.env.BASE_URL + 'workshop.html';
    workshop.textContent = 'Asset workshop';
    devTools.append(workshop);
    const ventStudy = document.createElement('a');
    ventStudy.id = 'vent-study';
    ventStudy.href = import.meta.env.BASE_URL + 'vent-study.html';
    ventStudy.textContent = 'Abyss camera study';
    devTools.append(ventStudy);
    const ioStudy = document.createElement('a');
    ioStudy.id = 'io-study';
    ioStudy.href = import.meta.env.BASE_URL + 'io-study.html';
    ioStudy.textContent = 'Io camera study';
    devTools.append(ioStudy);
  }
  const heading = element('heading');
  const message = element('message');
  const start = element<HTMLButtonElement>('start');
  const pause = element<HTMLButtonElement>('pause');
  const pulse = element<HTMLButtonElement>('pulse');
  const status = element('status');
  const sector = element('sector');
  const hull = element('hull');
  const score = element('score');
  const charges = element('charges');
  const bossHud = element('boss-hud');
  const bossName = element('boss-name');
  const bossHealth = element<HTMLProgressElement>('boss-health');
  const droneWeapon = element<HTMLSelectElement>('drone-weapon');
  const levelSelector = element<HTMLSelectElement>('level');
  levelSelector.value = selectedLevel;
  levelSelector.disabled = true;
  const testingWings = import.meta.env.DEV || new URLSearchParams(location.search).get('testLoadout') === '1';
  element('test-wing-loadout').hidden = !testingWings;
  const wingSelectors = ['left-wing', 'right-wing'].map((id) => element<HTMLSelectElement>(id));
  for (const select of wingSelectors) {
    select.replaceChildren();
    select.add(new Option('Empty', ''));
    for (const [key, weapon] of Object.entries(wingWeapons))
      select.add(new Option(weapon.name, key));
  }
  bossHealth.max = BOSS_HP;
  const selectedPortrait = element('selected-portrait');
  const perkReadout = element('pilot-perk-readout');
  const pilotPicker = setupPilots(element('loadout-picker'), element('pilot-choices'), selectedPortrait, element('selected-pilot'), element('pilot-perk-description'), element('desktop-picker'), element('mobile-picker'), signal);
  type Screen = 'title' | 'active' | 'paused' | 'results';
  let screen: Screen = 'title';
  let flight = new Flight('sentry', [], pilotPicker.selectedId, readLevel(levelSelector.value));
  let offlineReady = false;
  let view: FlightView | undefined;
  let preparing: AbortController | undefined;
  let contextLost = false;
  function syncUI() {
    const active = screen === 'active';
    const fighting = flight.phase === 'stage' || flight.phase === 'boss';
    const label = {
      stage: levels[flight.level].sector,
      approach: flight.level === 'vents' ? 'ABYSSAL DROP' : flight.level === 'io' ? 'CALDERA APPROACH' : flight.level === 'titan' ? 'ASCENT' : 'CONTACT',
      boss: 'BOSS',
      won: 'CLEAR',
      lost: 'SIGNAL LOST',
    }[flight.phase];
    sector.textContent = (flight.level === 'vents' || flight.level === 'ice' || flight.level === 'titan') && flight.phase === 'stage'
      ? `${label} · ${Math.min(10, Math.floor(flight.hiveProgress * 10) + 1)}/10` : label;
    if (flight.level === 'io' && flight.phase === 'stage')
      sector.textContent = `IO · ${Math.min(IO_SCREENS, Math.floor(flight.hiveProgress * IO_SCREENS) + 1)}/${IO_SCREENS}`;
    sector.title = flight.level === 'vents' && flight.phase === 'stage' ? ventSection(flight.time) : flight.level === 'io' && flight.phase === 'stage' ? ioSection(flight.time) : flight.level === 'titan' ? titanSection(flight.hiveProgress) : flight.level === 'ice' ? iceSection(flight.hiveProgress) : levels[flight.level].name;
    score.textContent = String(flight.score).padStart(6, '0');
    hull.textContent = String(flight.hull).padStart(2, '0');
    charges.textContent = String(flight.charges).padStart(2, '0');
    bossHud.hidden = flight.phase !== 'boss';
    bossHealth.max = flight.bossMaxHealth;
    bossHealth.value = flight.bossHealth;
    bossName.textContent = levels[flight.level].boss;
    pulse.disabled = !active || !fighting || flight.charges === 0;
    pause.hidden = !active;
    panel.hidden = active;
    const betweenRuns = screen === 'title' || screen === 'results';
    if (import.meta.env.DEV) {
      const bossStart = element<HTMLButtonElement>('dev-boss');
      bossStart.hidden = !betweenRuns;
      element('vent-study').hidden = !betweenRuns || flight.level !== 'vents';
      element('io-study').hidden = !betweenRuns || flight.level !== 'io';
      bossStart.textContent = flight.level === 'vents' || flight.level === 'titan' || flight.level === 'io' ? 'Launch at transition' : 'Launch at boss';
      bossStart.disabled = start.disabled || !view;
    }
    pilotPicker.setVisible(betweenRuns);
    perkReadout.hidden = betweenRuns;
    if (!betweenRuns && perkReadout.textContent !== flight.perkReadout) {
      perkReadout.textContent = flight.perkReadout;
    }
    selectedPortrait.classList.toggle('perk-flash', active && flight.perkTime > 1.15);
    let tip = 'Tap for drone · Drag to steer';
    if (preparing)
      tip = 'Preparing graphics…';
    else if (screen === 'title')
      tip = offlineReady ? 'Level ready offline' : 'Ready to launch';
    else if (flight.droneWeapon === 'towline') {
      tip = flight.phase === 'boss' ? (flight.level === 'ice' ? 'Sweep the arc across the mouth marker.' : flight.level === 'io' ? 'Sweep the arc across the cyan support, then exposed machinery.' : flight.level === 'titan' ? 'Sweep the arc across the glowing thorax vent.' : flight.level === 'vents' ? (flight.crabCoreOpen ? 'Sweep the arc across the exposed gills.' : 'Sweep the arc across a glowing claw joint.') : 'Sweep the arc across the green cannon.') : 'Park the drone · Sweep the arc';
    }
    else if (flight.phase === 'boss')
      tip = flight.level === 'ice' ? 'Tap the mouth marker. Dodge amber rings.' : flight.level === 'io' ? (flight.ioLegBroken ? 'Machinery exposed · Dodge the wheel shots.' : 'Break the cyan front support.') : flight.level === 'titan' ? 'Tap the glowing thorax vent. Dodge amber rings.' : flight.level === 'vents' ? (flight.crabCoreOpen ? 'Tap the gill chamber. Dodge amber rings.' : 'Tap the glowing joint. Break both claws.') : 'Tap the green cannon. Dodge amber rings.';
    if (active && flight.perkTime > 0) {
      tip = flight.perkMessage;
    }
    else if (active && flight.pickupTime > 0) {
      tip = flight.pickupMessage;
    }
    else if (active && flight.phase === 'stage') {
      const wings = flight.wings.flatMap((wing) => wing.weapon
        ? [`${wing.side < 0 ? 'L' : 'R'} ${wingWeapons[wing.weapon].short}`]
        : []);
      if (wings.length)
        tip = wings.join(' · ');
      else if (flight.drops.length)
        tip = 'Fly through the drop to equip it';
    }
    if (status.textContent !== tip)
      status.textContent = tip;
  }
  async function prepareGraphics() {
    if (!view)
      return;
    const controller = new AbortController();
    preparing = controller;
    start.disabled = true;
    syncUI();
    try {
      const currentView = view;
      signal.addEventListener('abort', () => controller.abort(), { once: true });
      await currentView.warmup(controller.signal, () => currentView.render(flight));
    }
    catch (error) {
      if (!signal.aborted)
        throw error;
    }
    finally {
      if (preparing === controller) {
        preparing = undefined;
        start.disabled = signal.aborted || contextLost;
        syncUI();
      }
    }
  }
  function pauseFlight() {
    if (screen !== 'active')
      return;
    screen = 'paused';
    input.reset();
    heading.textContent = 'Paused';
    message.textContent = 'Your run is on hold.';
    start.textContent = 'Resume';
    syncUI();
  }
  function showResults() {
    screen = 'results';
    input.reset();
    heading.textContent = flight.phase === 'won' ? 'Sector clear' : 'Ship lost';
    message.textContent = `Score ${flight.score}`;
    start.textContent = 'Fly again';
    syncUI();
  }
  start.addEventListener('click', () => {
    if (!view || start.disabled || screen === 'active')
      return;
    if (screen !== 'paused') {
      flight = new Flight(droneWeapon.value === 'towline' ? 'towline' : 'sentry', testingWings ? wingSelectors.map((select) => readWingWeapon(select.value)) : [], pilotPicker.selectedId, readLevel(levelSelector.value));
      if (import.meta.env.DEV && devBossLaunch) {
        // Enter the normal approach through the simulation, preserving level
        // progress, the selected loadout and the full camera transition.
        flight.time = flight.stageDuration;
        flight.step(0);
      }
    }
    screen = 'active';
    input.reset();
    view.render(flight);
    syncUI();
  }, { signal });
  function firePulse() {
    if (screen !== 'active')
      return;
    flight.pulse();
    if (flight.phase === 'won')
      showResults();
    else
      syncUI();
  }
  pause.addEventListener('click', pauseFlight, { signal });
  pulse.addEventListener('click', firePulse, { signal });
  const input = bindFlightInput(canvas, {
    flight: () => flight,
    active: () => screen === 'active',
    pause: pauseFlight,
    pulse: firePulse
  }, signal);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden)
      pauseFlight();
  }, { signal });
  window.addEventListener('blur', pauseFlight, { signal });
  window.addEventListener('pagehide', pauseFlight, { signal });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    contextLost = true;
    preparing?.abort();
    preparing = undefined;
    pauseFlight();
    start.disabled = true;
    syncUI();
  }, { signal });
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    void prepareGraphics().catch(() => {
      message.textContent = 'Graphics recovery failed. Return to menu and retry.';
      start.disabled = true;
    });
  }, { signal });
  const observer = new ResizeObserver(() => {
    view?.resize(canvas.clientWidth, canvas.clientHeight);
    view?.render(flight);
  });
  observer.observe(canvas);
  let previous = performance.now();
  let accumulator = 0;
  function frame(now: number) {
    const elapsed = Math.min(Math.max((now - previous) / 1000, 0), 0.1);
    previous = now;
    if (screen === 'active' && view) {
      accumulator += elapsed;
      while (accumulator >= STEP && screen === 'active') {
        input.steer(STEP);
        flight.step(STEP);
        accumulator -= STEP;
        if (flight.phase === 'won' || flight.phase === 'lost')
          showResults();
      }
      view.render(flight, elapsed);
      syncUI();
    }
    else {
      accumulator = 0;
    }
    animation = requestAnimationFrame(frame);
  }
  let animation = 0;
  let disposed = false;
  function cleanup() {
    if (disposed)
      return;
    disposed = true;
    preparing?.abort();
    input.reset();
    observer.disconnect();
    cancelAnimationFrame(animation);
    view?.dispose();
  }
  signal.addEventListener('abort', cleanup, { once: true });
  try {
    heading.textContent = 'Spaceslop';
    message.textContent = 'Tap to place the drone. Drag to steer.';
    start.textContent = 'Launch';
    start.disabled = true;
    view = await createFlightView(canvas, selectedLevel,signal);
    if (signal.aborted) {
      view.dispose();
      return;
    }
    view.resize(canvas.clientWidth, canvas.clientHeight);
    syncUI();
    await prepareGraphics();
    if (signal.aborted)
      return;
    animation = requestAnimationFrame(frame);
    return {
      setOfflineReady(value: boolean) {
        offlineReady = value;
        syncUI();
      }
    };
  }
  catch (error) {
    cleanup();
    throw error;
  }
}
