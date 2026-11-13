import { missionFor } from '../campaign/missions';
import { challengeNames, type FlightMode } from '../campaign/challenges';
import { ranks, type Rank } from '../campaign/ranks';
import { FLEET_TRENCH_AT } from '../fleet/route';
import { Flight, STEP, type DroneWeapon } from '../game';
import { levels, type LevelId } from '../levels';
import type { PilotId } from '../pilot-data';
import { showSelectedPilot } from '../pilots';
import { createFlightView, type FlightView } from '../view';
import type { WingWeapon } from '../wing';
import type { FonsVariant } from '../wormhole/fons/variants';
import { createRankDisplays } from './briefing';
import { mountEndingCredits } from './ending-credits';
import { flightReadout } from './flight-hud';
import { bindFlightInput } from './input';

export type FlightLoadout = { pilot: PilotId; drone: DroneWeapon; wings: (WingWeapon | undefined)[]; mode: FlightMode };
export type FlightShortcut = 'boss' | 'trench' | FonsVariant;

type CampaignRun = {
  onClear(): { next?: LevelId; promoted?: Rank; unlockedBulletHell: boolean };
  onNext(level: LevelId): void;
};

type ChallengeRun = {
  onClear(): { next?: LevelId; unlockedHardcore: boolean };
  onNext(level: LevelId): void;
  onLoss(): void;
};

export async function openFlightSession(selectedLevel: LevelId, loadout: FlightLoadout, signal: AbortSignal, shortcut?: FlightShortcut, campaignRun?: CampaignRun, challengeRun?: ChallengeRun) {
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
  const promotionSubtitle = element('promotion-subtitle');
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
  element('return-menu').textContent = campaignRun || challengeRun ? 'Mission list' : 'Choose another sector';
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
  const credits = mountEndingCredits(canvas.parentElement!);
  const creditsWindow = element('ending-credits-window');
  const creditsRoll = element('ending-credits-roll');
  const creditsTitle = element('ending-title');
  const unlockNotice = element('ending-unlock');
  const skipCredits = element<HTMLButtonElement>('ending-skip');
  const continueCredits = element<HTMLButtonElement>('ending-continue');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const selectedPortrait = element('selected-portrait');
  const perkReadout = element('pilot-perk-readout');
  showSelectedPilot(loadout.pilot, selectedPortrait, element('selected-pilot'), signal);
  type Screen = 'loading' | 'active' | 'paused' | 'credits' | 'results';
  let screen: Screen = 'loading';
  const { mode } = loadout;
  const createFlight = () => new Flight(loadout.drone, loadout.wings, loadout.pilot, selectedLevel, undefined, mode);
  let flight = createFlight();
  let nextLevel: LevelId | undefined;
  let promotion: Rank | undefined;
  let unlockedBulletHell = false;
  let unlockedHardcore = false;
  let victoryTime: number | undefined;
  const recordProgress = !shortcut;
  let offlineReady = false;
  let view: FlightView | undefined;
  let preparing: AbortController | undefined;
  let contextLost = false;
  function syncUI() {
    const active = screen === 'active';
    const fighting = flight.phase === 'stage' || flight.phase === 'boss';
    const preparingGraphics = preparing !== undefined || screen === 'loading';
    const readout = flightReadout(flight, active, preparingGraphics, offlineReady);
    sector.textContent = readout.sector.label;
    sector.title = readout.sector.title;
    score.textContent = String(flight.score).padStart(6, '0');
    hull.textContent = String(flight.hull).padStart(2, '0');
    charges.textContent = String(flight.charges).padStart(2, '0');
    bossHud.hidden = !readout.showBoss;
    bossHealth.max = flight.bossMaxHealth;
    bossHealth.value = flight.bossHealth;
    bossName.textContent = readout.boss;
    pulse.disabled = !active || !fighting || flight.charges === 0;
    pause.hidden = !active;
    panel.hidden = active || screen === 'credits';
    heading.classList.toggle('preparing-flight', screen === 'loading');
    const victoryResults = screen === 'results' && flight.phase === 'won';
    panel.classList.toggle('victory-results', victoryResults);
    promotionSubtitle.hidden = !victoryResults || promotion === undefined;
    start.hidden = screen === 'loading';
    nextMission.hidden = screen !== 'results' || !nextLevel;
    perkReadout.hidden = screen === 'loading' || screen === 'credits' || screen === 'results';
    if (!perkReadout.hidden && perkReadout.textContent !== flight.perkReadout) {
      perkReadout.textContent = flight.perkReadout;
    }
    selectedPortrait.classList.toggle('perk-flash', active && flight.perkTime > 1.15);
    status.classList.toggle('preparing-graphics', preparingGraphics);
    if (status.textContent !== readout.tip)
      status.textContent = readout.tip;
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
      await currentView.warmup(controller.signal, () => currentView.render(flight, 0, victoryTime));
    }
    catch (error) {
      if (!controller.signal.aborted)
        throw error;
    }
    finally {
      if (preparing === controller) {
        preparing = undefined;
        if (!signal.aborted) {
          start.disabled = contextLost;
          syncUI();
        }
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
  function recordVictory() {
    if (flight.phase !== 'won' || victoryTime !== undefined) return;
    victoryTime = 0;
    input.reset();
    if (recordProgress && campaignRun) {
      const result = campaignRun.onClear();
      nextLevel = result.next;
      promotion = result.promoted;
      unlockedBulletHell = result.unlockedBulletHell;
    }
    if (recordProgress && challengeRun) ({ next: nextLevel, unlockedHardcore } = challengeRun.onClear());
    if (view?.hasEnding && reduceMotion.matches) {
      victoryTime = view.victoryDuration;
    }
  }
  function showResults() {
    if (screen !== 'active' && screen !== 'credits') return;
    const fromCredits = screen === 'credits';
    screen = 'results';
    credits.hidden = true;
    input.reset();
    heading.textContent = flight.phase === 'won' ? 'Mission Complete' : 'Ship lost';
    const report = [levels[selectedLevel].name, `Score ${flight.score}`];
    if (mode !== 'regular') report.splice(1, 0, challengeNames[mode]);
    if (flight.phase === 'won' && recordProgress && campaignRun) {
      if (promotion) setPilotRank(promotion);
      if (!nextLevel) report.push('Campaign complete');
    }
    if (unlockedHardcore) report.push('Bullet Hell Hardcore unlocked');
    if (flight.phase === 'lost' && recordProgress && challengeRun) {
      challengeRun.onLoss();
      if (mode === 'hardcore') report.push('Hardcore progress reset');
    }
    nextMission.textContent = nextLevel ? `Next briefing · ${levels[nextLevel].name}` : 'Next briefing';
    promotionSubtitle.textContent = promotion ? `Promoted to ${ranks[promotion].name}` : '';
    message.textContent = report.join(' · ');
    start.textContent = 'Fly again';
    panel.scrollTop = 0;
    syncUI();
    if (fromCredits && !contextLost) start.focus({ preventScroll: true });
  }
  function finishCredits() {
    if (screen !== 'credits') return;
    credits.classList.remove('rolling');
    unlockNotice.hidden = !unlockedBulletHell;
    continueCredits.hidden = false;
    const wasFocused = document.activeElement === skipCredits;
    skipCredits.hidden = true;
    if (wasFocused) continueCredits.focus({ preventScroll: true });
  }
  function showCredits() {
    screen = 'credits';
    input.reset();
    credits.hidden = false;
    unlockNotice.hidden = true;
    continueCredits.hidden = true;
    skipCredits.hidden = false;
    creditsWindow.scrollTop = 0;
    if (reduceMotion.matches) finishCredits();
    else credits.classList.add('rolling');
    syncUI();
    creditsTitle.focus({ preventScroll: true });
  }
  skipCredits.addEventListener('click', finishCredits, { signal });
  continueCredits.addEventListener('click', showResults, { signal });
  creditsRoll.addEventListener('animationend', (event) => {
    if (screen === 'credits' && event.target === creditsRoll) finishCredits();
  }, { signal });
  reduceMotion.addEventListener('change', () => {
    if (!reduceMotion.matches) return;
    if (view?.hasEnding && victoryTime !== undefined && (screen === 'active' || screen === 'paused')) {
      victoryTime = view.victoryDuration;
    } else finishCredits();
  }, { signal });
  nextMission.addEventListener('click', () => {
    if (screen === 'results' && nextLevel) (campaignRun ?? challengeRun)?.onNext(nextLevel);
  }, { signal });
  function startFlight() {
    if (!view || signal.aborted || start.disabled || screen === 'active' || screen === 'credits')
      return;
    if (screen !== 'paused') {
      if (screen === 'results') flight = createFlight();
      nextLevel = undefined;
      promotion = undefined;
      unlockedBulletHell = false;
      unlockedHardcore = false;
      victoryTime = undefined;
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
    view.render(flight, 0, victoryTime);
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
    recordVictory();
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
    if (contextLost) return;
    view?.resize(canvas.clientWidth, canvas.clientHeight);
    view?.render(flight, 0, victoryTime);
  });
  observer.observe(canvas);
  let previous = performance.now();
  let accumulator = 0;
  function frame(now: number) {
    const elapsed = Math.min(Math.max((now - previous) / 1000, 0), 0.1);
    previous = now;
    if (screen === 'active' && view) {
      let presentationStep = elapsed;
      if (victoryTime === undefined) {
        accumulator += elapsed;
        while (accumulator >= STEP && flight.phase !== 'won' && flight.phase !== 'lost') {
          input.steer(STEP);
          flight.step(STEP);
          accumulator -= STEP;
        }
        recordVictory();
      } else {
        const next = Math.min(view.victoryDuration, victoryTime + elapsed);
        presentationStep = next - victoryTime;
        victoryTime = next;
      }
      view.render(flight, presentationStep, victoryTime);
      if (flight.phase === 'lost') showResults();
      else if (victoryTime === view.victoryDuration) {
        if (view.hasEnding) showCredits();
        else showResults();
      }
      else syncUI();
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
    panel.classList.remove('victory-results');
    credits.remove();
    promotionSubtitle.hidden = true;
    observer.disconnect();
    cancelAnimationFrame(animation);
    view?.dispose();
  }
  signal.addEventListener('abort', cleanup, { once: true });
  try {
    start.disabled = true;
    panel.scrollTop = 0;
    syncUI();
    view = await createFlightView(canvas, selectedLevel, signal, loadout.pilot, mode);
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
