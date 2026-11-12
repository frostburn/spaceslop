import {groveSection} from '../biolume/route';
import { DEN_SCREENS, denSection } from '../den/route';
import {boulevardSection} from '../boulevard';
import {summerSection} from '../summer/layout';
import { fleetSection, FLEET_TRENCH_AT } from '../fleet/route';
import { missionFor } from '../campaign/missions';
import { ranks, type Rank } from '../campaign/ranks';
import { createRankDisplays } from './briefing';
import { bindFlightInput } from './input';
import { ventSection } from '../vent-layout';
import { ioSection, IO_SCREENS } from '../io-layout';
import { titanSection } from '../titan-layout';
import { BOSS_HP, Flight, STEP, type DroneWeapon } from '../game';
import type { PilotId } from '../pilot-data';
import { showSelectedPilot } from '../pilots';
import { createFlightView, type FlightView } from '../view';
import { levels, type LevelId } from '../levels';
import { iceSection } from '../ice-layout';
import { wingWeapons, type WingWeapon } from '../wing';
import { FONS_RAIN_END, fonsPhase } from '../wormhole/fons/combat';
import { fonsAttackCue } from '../wormhole/fons/attacks';
import { fonsNames, type FonsVariant } from '../wormhole/fons/variants';

export type FlightLoadout = { pilot: PilotId; drone: DroneWeapon; wings: (WingWeapon | undefined)[] };
export type FlightShortcut = 'boss' | 'trench' | FonsVariant;

type CampaignRun = {
  onClear(): { next?: LevelId; promoted?: Rank };
  onNext(level: LevelId): void;
};

export async function openFlightSession(selectedLevel: LevelId, loadout: FlightLoadout, signal: AbortSignal, shortcut?: FlightShortcut, campaignRun?: CampaignRun) {
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
  const heading = element('heading');
  const message = element('message');
  const mission = missionFor[selectedLevel];
  const rankDisplay = createRankDisplays(signal);
  const setFullRank = rankDisplay(element('pilot-rank'));
  const setCompactRank = rankDisplay(element('pilot-rank-hud'), true);
  function setPilotRank(rank: Rank) {
    setFullRank(rank);
    setCompactRank(rank);
  }
  setPilotRank(mission.pilotRank);
  const start = element<HTMLButtonElement>('start');
  const nextMission = element<HTMLButtonElement>('next-mission');
  element('return-menu').textContent = campaignRun ? 'Mission list' : 'Choose another sector';
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
  bossHealth.max = BOSS_HP;
  const selectedPortrait = element('selected-portrait');
  const perkReadout = element('pilot-perk-readout');
  showSelectedPilot(loadout.pilot, selectedPortrait, element('selected-pilot'), signal);
  type Screen = 'loading' | 'active' | 'paused' | 'results';
  let screen: Screen = 'loading';
  let flight = new Flight(loadout.drone, loadout.wings, loadout.pilot, selectedLevel);
  let nextLevel: LevelId | undefined;
  const progressOnClear = !shortcut;
  let offlineReady = false;
  let view: FlightView | undefined;
  let preparing: AbortController | undefined;
  let contextLost = false;
  function syncUI() {
    const active = screen === 'active';
    const fighting = flight.phase === 'stage' || flight.phase === 'boss';
    const label = {
      stage: levels[flight.level].sector,
      approach: flight.isFonsFight ? 'FINAL APPROACH' : flight.level === 'wormhole' ? 'TITAN ECHO' : flight.isFleet ? 'BREACH APPROACH' : flight.isDen ? 'GANTRY APPROACH' : flight.level==='biolume'?'DARK CROWN':flight.level==='summer'?'LOTUS PALACE':flight.level==='heliostat'?'COLLECTOR APPROACH':flight.level==='boulevard'?'SUNSET PLAZA':flight.level === 'vents' ? 'ABYSSAL DROP' : flight.level === 'io' ? 'CALDERA APPROACH' : flight.level === 'titan' ? 'ASCENT' : 'CONTACT',
      boss: 'BOSS',
      won: 'CLEAR',
      lost: 'SIGNAL LOST',
    }[flight.phase];
    sector.textContent = (flight.level === 'summer' || flight.level === 'heliostat' || flight.level === 'vents' || flight.level === 'ice' || flight.level === 'titan') && flight.phase === 'stage'
      ? `${label} · ${Math.min(10, Math.floor(flight.hiveProgress * 10) + 1)}/10` : label;
    if (flight.level === 'io' && flight.phase === 'stage')
      sector.textContent = `IO · ${Math.min(IO_SCREENS, Math.floor(flight.hiveProgress * IO_SCREENS) + 1)}/${IO_SCREENS}`;
    if(flight.level==='boulevard'&&flight.phase==='stage')sector.textContent=`BOULEVARD · ${Math.min(10,1+Math.floor(flight.time/10))}/10`;
    if(flight.level==='biolume'&&flight.phase==='stage')sector.textContent=`LANTERN GROVE · ${Math.min(10,1+Math.floor(flight.time/10))}/10`;
    if (flight.isDen && flight.phase === 'stage') sector.textContent = `${label} · ${Math.min(DEN_SCREENS, 1 + Math.floor(flight.hiveProgress * DEN_SCREENS))}/${DEN_SCREENS}`;
    sector.title = flight.isDen ? denSection(flight.phase === 'stage' ? flight.time : flight.stageDuration) : flight.level==='biolume'?groveSection(flight.phase==='stage'?flight.time:100):flight.level==='summer'?summerSection(flight.time):flight.level==='boulevard'?boulevardSection(flight.time):flight.level === 'vents' && flight.phase === 'stage' ? ventSection(flight.time) : flight.level === 'io' && flight.phase === 'stage' ? ioSection(flight.time) : flight.level === 'titan' ? titanSection(flight.hiveProgress) : flight.level === 'ice' ? iceSection(flight.hiveProgress) : levels[flight.level].name;
    if (flight.level === 'fleet' && flight.phase === 'stage') {
      sector.title = fleetSection(flight.time);
      sector.textContent = sector.title.toUpperCase();
    }
    score.textContent = String(flight.score).padStart(6, '0');
    hull.textContent = String(flight.hull).padStart(2, '0');
    charges.textContent = String(flight.charges).padStart(2, '0');
    bossHud.hidden = flight.phase !== 'boss';
    bossHealth.max = flight.bossMaxHealth;
    bossHealth.value = flight.bossHealth;
    bossName.textContent = flight.isFonsFight ? fonsNames[flight.fonsVariant].toUpperCase() : levels[flight.level].boss+(flight.level==='summer'?' · '+flight.summerHeadsAlive+(flight.summerHeadsAlive===1?' HEAD':' HEADS'):'');
    pulse.disabled = !active || !fighting || flight.charges === 0;
    pause.hidden = !active;
    panel.hidden = active;
    start.hidden = screen === 'loading';
    nextMission.hidden = screen !== 'results' || !nextLevel;
    perkReadout.hidden = screen === 'loading' || screen === 'results';
    if (!perkReadout.hidden && perkReadout.textContent !== flight.perkReadout) {
      perkReadout.textContent = flight.perkReadout;
    }
    selectedPortrait.classList.toggle('perk-flash', active && flight.perkTime > 1.15);
    let tip = 'Tap for drone · Drag to steer';
    if (preparing || screen === 'loading')
      tip = 'Preparing graphics…';
    else if (flight.isFonsFight && flight.phase === 'boss') {
      const storm = fonsPhase(flight.fonsTime);
      if (storm.rain || storm.warning > 0) tip = 'Stay in the wake of a falling crystal';
      else if (storm.shielded) tip = storm.age < FONS_RAIN_END ? 'Fons shielded · Find cover' : 'Cloak opening';
      else if (storm.wrap > 0 && storm.age < FONS_RAIN_END) tip = 'Cloak closing · Find cover';
      else if (storm.openingRifts) tip = 'Wall rifts opening · Watch for falling cover';
      else tip = fonsAttackCue(storm.age, flight.fonsVariant) ??
        (flight.droneWeapon === 'towline' ? 'Sweep the arc across the mirror' : 'Fire into the mirror · Dodge the sweeps');
    }
    else if (flight.isDen && flight.phase === 'boss')
      tip = flight.droneWeapon === 'towline' ? 'Sweep the arc across the bike.' : 'Watch the engines · Dodge the sweeping bursts';
    else if (flight.isFleet && flight.phase === 'boss')
      tip = flight.droneWeapon === 'towline' ? 'Sweep the arc across the saucer.' : 'Move after the side guns light up · Thread the rings';
    else if (flight.droneWeapon === 'towline') {
      tip = flight.phase === 'boss' ? (flight.level==='biolume'?'Sweep the arc through seekers or the ray.':flight.level==='heliostat'||flight.level==='boulevard'?'Sweep the arc across the cyan core.':flight.level === 'ice' ? 'Sweep the arc across the mouth marker.' : flight.level === 'io' ? 'Sweep the arc across the cyan support, then exposed machinery.' : flight.isCicadaFight ? 'Sweep the arc across the glowing thorax vent.' : flight.level === 'vents' ? (flight.crabCoreOpen ? 'Sweep the arc across the exposed gills.' : 'Sweep the arc across a glowing claw joint.') : 'Sweep the arc across the green cannon.') : 'Park the drone · Sweep the arc';
    }
    else if(flight.phase==='boss'&&flight.level==='biolume')tip='Shoot seeking lanterns · Dodge their burst · Fire straight into the ray.';
    else if(flight.phase==='boss'&&(flight.level==='boulevard'||flight.level==='heliostat'))tip='Target the cyan core · Move after the amber aim lock.';
    else if (flight.phase === 'boss' && flight.level === 'preserve')
      tip = 'Dodge the claw windups. Pulse interrupts an attack. Fire into the belly.';
    else if (flight.phase === 'boss')
      tip = flight.level === 'ice' ? 'Tap the mouth marker. Dodge amber rings.' : flight.level === 'io' ? (flight.ioLegBroken ? 'Machinery exposed · Dodge the wheel shots.' : 'Break the cyan front support.') : flight.isCicadaFight ? 'Tap the glowing thorax vent. Dodge amber rings.' : flight.level === 'vents' ? (flight.crabCoreOpen ? 'Tap the gill chamber. Dodge amber rings.' : 'Tap the glowing joint. Break both claws.') : flight.level==='summer'?'Destroy all three hydra heads. Dodge amber rings.':'Tap the green cannon. Dodge amber rings.';
    if (active && flight.perkTime > 0) {
      tip = flight.perkMessage;
    }
    else if (active && flight.pickupTime > 0) {
      tip = flight.pickupMessage;
    }
    else if (active && flight.phase === 'stage') {
      const equipment = flight.wings.flatMap((wing) => wing.weapon
        ? [`${wing.side < 0 ? 'L' : 'R'} ${wingWeapons[wing.weapon].short}${wing.upgraded ? ' II' : ''}`]
        : []);
      if (flight.droneWeapon === 'towline') equipment.push('Towline');
      if (equipment.length)
        tip = equipment.join(' · ');
      else if (flight.drops.length)
        tip = 'Fly through the drop to equip it';
    }
    if (!active && offlineReady && !preparing && screen !== 'loading') tip = 'Level ready offline';
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
      if (!controller.signal.aborted)
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
    if (screen !== 'active') return;
    screen = 'results';
    input.reset();
    heading.textContent = flight.phase === 'won' ? 'Sector clear' : 'Ship lost';
    const report = [`Score ${flight.score}`];
    if (flight.phase === 'won' && progressOnClear && campaignRun) {
      const result = campaignRun.onClear();
      nextLevel = result.next;
      if (result.promoted) {
        setPilotRank(result.promoted);
        report.push(`Promoted to ${ranks[result.promoted].name}`);
      }
      if (nextLevel) report.push(levels[nextLevel].name);
      else report.push('Campaign complete');
    }
    message.textContent = report.join(' · ');
    start.textContent = 'Fly again';
    panel.scrollTop = 0;
    syncUI();
  }
  nextMission.addEventListener('click', () => {
    if (screen === 'results' && nextLevel) campaignRun?.onNext(nextLevel);
  }, { signal });
  function startFlight() {
    if (!view || signal.aborted || start.disabled || screen === 'active')
      return;
    if (screen !== 'paused') {
      if (screen === 'results') flight = new Flight(loadout.drone, loadout.wings, loadout.pilot, selectedLevel);
      nextLevel = undefined;
      setPilotRank(mission.pilotRank);
      if (import.meta.env.DEV && shortcut) {
        if (shortcut === 'boss' || shortcut === 'trench') {
          flight.time = shortcut === 'trench' ? FLEET_TRENCH_AT : flight.stageDuration;
          flight.step(0);
        } else flight.startFonsApproach(shortcut);
      }
    }
    screen = 'active';
    input.reset();
    previous = performance.now();
    view.render(flight);
    if (document.hidden) pauseFlight();
    else {
      syncUI();
      canvas.focus({ preventScroll: true });
    }
  }
  start.addEventListener('click', startFlight, { signal });
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
    void prepareGraphics().then(() => {
      if (screen === 'loading') startFlight();
    }).catch(() => {
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
    start.disabled = true;
    panel.scrollTop = 0;
    syncUI();
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
    startFlight();
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
