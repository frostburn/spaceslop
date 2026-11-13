import { registerSW } from 'virtual:pwa-register';
import { setupBriefing } from './app/briefing';
import type { FlightLoadout, FlightShortcut } from './app/flight-session';
import { saveLevelOffline, savedLevels, clearSavedLevels } from './app/offline';
import { CHALLENGE_SAVE_KEY, challengeAvailable, challengeModes, challengeNames, challengeRoutes, decodeChallengeProgress,
  nextChallengeLevel, readChallengeCode, recordChallengeClear, resetHardcoreProgress, unlockChallenge, type ChallengeMode } from './campaign/challenges';
import { campaign } from './campaign/missions';
import { CAMPAIGN_SAVE_KEY, campaignStatus, decodeCampaignClears, recordCampaignClear } from './campaign/progress';
import { ranks } from './campaign/ranks';
import { levels, readLevel, type LevelId } from './levels';
import { setupPilotPicker } from './pilots';
import { readWingWeapon, wingWeapons } from './wing';
import { fonsNames, fonsVariants } from './wormhole/fons/variants';
import './style.css';
import './spaceslop-logo.css';

const menu = document.querySelector<HTMLElement>('#front-menu')!;
const app = document.querySelector<HTMLElement>('#game-app')!;
const missionList = document.querySelector<HTMLElement>('#mission-list')!;
const logo = document.querySelector<HTMLElement>('#menu-title')!;
const logoUnderline = logo.querySelector<HTMLElement>('.logo-underline')!;
const reduceLogoMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const briefing = document.querySelector<HTMLElement>('#menu-briefing')!;
const briefTitle = document.querySelector<HTMLElement>('#brief-title')!;
const cards = document.querySelector<HTMLElement>('#level-cards')!;
const prepare = document.querySelector<HTMLButtonElement>('#prepare-flight')!;
const status = document.querySelector<HTMLElement>('#menu-status')!;
const update = document.querySelector<HTMLButtonElement>('#menu-update')!;
const modeButtons = {
  campaign: document.querySelector<HTMLButtonElement>('#campaign-mode')!,
  'free-flight': document.querySelector<HTMLButtonElement>('#free-flight-mode')!,
  'bullet-hell': document.querySelector<HTMLButtonElement>('#bullet-hell-mode')!,
  hardcore: document.querySelector<HTMLButtonElement>('#hardcore-mode')!,
};
type MenuMode = keyof typeof modeButtons;
const droneWeapon = document.querySelector<HTMLSelectElement>('#drone-weapon')!;
const wingSelectors = ['#left-wing', '#right-wing'].map(selector => document.querySelector<HTMLSelectElement>(selector)!);
const query = new URLSearchParams(location.search);
const testingLoadout = import.meta.env.DEV || query.get('testLoadout') === '1';
let cleared = savedCampaign();
let challengeProgress = decodeChallengeProgress(null);
let savedChallengeData: string | null = null;
refreshChallenges();
const requestedMode = query.get('mode');
const requestedChallenge = challengeModes.find(mode => requestedMode === mode && challengeAvailable(challengeProgress, mode, cleared));
let mode: MenuMode = requestedChallenge ?? (requestedMode === 'campaign' || (requestedMode !== 'free-flight' && !query.has('level')) ? 'campaign' : 'free-flight');
let selected = requestedChallenge ? challengeSelection(requestedChallenge) : mode === 'campaign' ? campaignSelection() : readLevel(query.get('level'));
let saved = new Set<LevelId>();
let session: AbortController | undefined;
let briefController: AbortController | undefined;
let pilotPicker: ReturnType<typeof setupPilotPicker> | undefined;
let reloadBeforePreparation = false;
let logoPosition = .5;
let logoPointerX = 0;
let logoFrame = 0;
let logoFrameAt = 0;

function drawLogoDiamond(now?: number) {
  logoFrame = 0;
  const { left, width } = logoUnderline.getBoundingClientRect();
  if (width === 0) return;
  const target = Math.max(0, Math.min(1, (logoPointerX - left) / width));
  const distance = target - logoPosition;
  if (now !== undefined && !reduceLogoMotion.matches && Math.abs(distance) * width > .25) {
    // Touch events only change the target. The easing continues on the frame clock.
    const elapsed = Math.max(0, now - logoFrameAt);
    logoPosition += distance * (1 - Math.exp(-elapsed / 24));
    logoFrameAt = now;
    logoFrame = requestAnimationFrame(drawLogoDiamond);
  } else {
    logoPosition = target;
  }
  logo.style.setProperty('--logo-pointer-x', `${logoPosition * 100}%`);
}

function moveLogoDiamond(event: PointerEvent) {
  if (!event.isPrimary || menu.hidden || missionList.hidden) return;
  logoPointerX = event.clientX;
  if (event.pointerType === 'touch' && !reduceLogoMotion.matches) {
    if (!logoFrame) {
      logoFrameAt = performance.now();
      logoFrame = requestAnimationFrame(drawLogoDiamond);
    }
  } else {
    cancelAnimationFrame(logoFrame);
    drawLogoDiamond();
  }
}

window.addEventListener('pointerdown', moveLogoDiamond, { passive: true });
window.addEventListener('pointermove', moveLogoDiamond, { passive: true });

function savedCampaign() {
  try { return decodeCampaignClears(localStorage.getItem(CAMPAIGN_SAVE_KEY)); }
  catch { return new Set<LevelId>(); }
}

function refreshChallenges() {
  try {
    const value = localStorage.getItem(CHALLENGE_SAVE_KEY);
    if (value !== savedChallengeData) {
      challengeProgress = decodeChallengeProgress(value);
      savedChallengeData = value;
    }
  } catch { /* Keep the progress available in this tab. */ }
}

function saveChallenges() {
  const value = JSON.stringify(challengeProgress);
  try {
    localStorage.setItem(CHALLENGE_SAVE_KEY, value);
    savedChallengeData = value;
  }
  catch { /* Progress remains available in this tab. */ }
}

function campaignSelection() {
  return campaignStatus(cleared).next ?? campaign.at(-1)!.level;
}

function challengeSelection(challenge: ChallengeMode) {
  return nextChallengeLevel(challengeProgress, challenge) ?? challengeRoutes[challenge].at(-1)!;
}

const levelCards = campaign.map(({ level: id }, index) => {
  const button = document.createElement('button');
  const title = document.createElement('strong');
  const detail = document.createElement('span');
  button.type = 'button';
  button.dataset.level = id;
  button.className = 'level-card';
  button.append(title, detail);
  button.addEventListener('click', () => select(id));
  cards.append(button);
  return { id, number: String(index + 1).padStart(2, '0'), button, title, detail };
});

function updateCards() {
  const inCampaign = mode === 'campaign';
  const challenge = mode === 'bullet-hell' || mode === 'hardcore' ? mode : undefined;
  const next = challenge ? nextChallengeLevel(challengeProgress, challenge) : campaignStatus(cleared).next;
  for (const name of challengeModes) modeButtons[name].hidden = !challengeAvailable(challengeProgress, name, cleared);
  for (const card of levelCards) {
    const { id, button, title, detail } = card;
    const complete = challenge ? challengeProgress.cleared[challenge].includes(id) : cleared.has(id);
    button.hidden = challenge !== undefined && !challengeRoutes[challenge].includes(id);
    button.disabled = (inCampaign || challenge !== undefined) && !complete && id !== next;
    button.setAttribute('aria-pressed', String(id === selected));
    button.classList.toggle('saved-offline', saved.has(id));
    title.textContent = inCampaign || challenge ? `${card.number} · ${levels[id].name}` : levels[id].name;
    const note = inCampaign || challenge ? (complete ? 'Cleared' : id === next ? 'Ready' : 'Locked')
      : id === 'wormhole' ? 'Boss rush' : `${levels[id].duration} second route`;
    detail.textContent = saved.has(id) ? `${note} · Saved offline` : note;
  }
}

function showMenuStatus() {
  const { rank, next } = campaignStatus(cleared);
  const progress = next ? `${cleared.size}/${campaign.length} cleared` : 'Campaign complete';
  status.textContent = mode === 'campaign' ? `Return to Sender · ${ranks[rank].name} · ${progress}`
    : mode === 'free-flight' ? levels[selected].name
    : mode === 'hardcore' ? `${challengeNames[mode]} · One hit ends the run` : challengeNames[mode];
}

function select(id: LevelId) {
  selected = id;
  for (const [name, button] of Object.entries(modeButtons)) button.setAttribute('aria-pressed', String(name === mode));
  const url = new URL(location.href);
  if (mode === 'free-flight') {
    url.searchParams.delete('mode');
    url.searchParams.set('level', id);
  } else {
    url.searchParams.set('mode', mode);
    url.searchParams.delete('level');
  }
  history.replaceState(null, '', url);
  updateCards();
  showMenuStatus();
}

async function refreshSavedLevels() {
  saved = new Set(await savedLevels());
  updateCards();
}

modeButtons.campaign.addEventListener('click', () => {
  if (mode === 'campaign') return;
  mode = 'campaign';
  select(campaignSelection());
});
modeButtons['free-flight'].addEventListener('click', () => {
  if (mode === 'free-flight') return;
  mode = 'free-flight';
  select(selected);
});
for (const challenge of challengeModes) modeButtons[challenge].addEventListener('click', () => {
  if (!challengeAvailable(challengeProgress, challenge, cleared) || mode === challenge) return;
  mode = challenge;
  select(challengeSelection(challenge));
});
const challengeCode = document.querySelector<HTMLInputElement>('#challenge-code')!;
const challengeStatus = document.querySelector<HTMLElement>('#challenge-status')!;
challengeCode.form!.addEventListener('submit', event => {
  event.preventDefault();
  const challenge = readChallengeCode(challengeCode.value);
  if (!challenge) {
    challengeStatus.textContent = 'Code not recognized.';
    return;
  }
  refreshChallenges();
  if (!challengeAvailable(challengeProgress, challenge, cleared)) {
    unlockChallenge(challengeProgress, challenge);
    saveChallenges();
  }
  challengeCode.value = '';
  challengeStatus.textContent = `${challengeNames[challenge]} unlocked.`;
  updateCards();
});
select(selected);
void refreshSavedLevels();

function closeBriefing() {
  briefController?.abort();
  briefController = undefined;
  pilotPicker = undefined;
  briefing.hidden = true;
  missionList.hidden = false;
  menu.setAttribute('aria-labelledby', 'menu-title');
}

function openBriefing() {
  if (reloadBeforePreparation) { location.reload(); return; }
  briefController = new AbortController();
  const { signal } = briefController;
  briefTitle.textContent = levels[selected].name;
  setupBriefing(selected, briefing, signal);
  const challengeRules = document.querySelector<HTMLElement>('#brief-challenge')!;
  challengeRules.hidden = mode === 'campaign' || mode === 'free-flight';
  challengeRules.textContent = mode === 'hardcore' ? `${challengeNames.hardcore} · One hit ends the run and resets Hardcore progress.`
    : `${challengeNames['bullet-hell']} · Faster ship, denser enemy fire.`;
  pilotPicker = setupPilotPicker(document.querySelector('#pilot-choices')!, document.querySelector('#pilot-perk-description')!, signal, mode === 'hardcore');
  if (import.meta.env.DEV) updateShortcuts(selected);
  missionList.hidden = true;
  briefing.hidden = false;
  menu.setAttribute('aria-labelledby', 'brief-title');
  window.scrollTo(0, 0);
  briefTitle.focus({ preventScroll: true });
}

function returnToMenu() {
  session?.abort();
  session = undefined;
  app.hidden = true;
  menu.hidden = false;
  closeBriefing();
  showMenuStatus();
  prepare.focus();
  void refreshSavedLevels();
}
prepare.addEventListener('click', openBriefing);
document.querySelector('#brief-back')!.addEventListener('click', returnToMenu);
document.querySelector('#menu-button')!.addEventListener('click', returnToMenu);
document.querySelector('#return-menu')!.addEventListener('click', returnToMenu);

if (testingLoadout) {
  document.querySelector<HTMLElement>('#test-wing-loadout')!.hidden = false;
  for (const select of wingSelectors) {
    select.add(new Option('Empty', ''));
    for (const [key, weapon] of Object.entries(wingWeapons)) select.add(new Option(weapon.name, key));
  }
}

function completeMission(id: LevelId) {
  const outcome = recordCampaignClear(new Set([...cleared, ...savedCampaign()]), id);
  cleared = outcome.cleared;
  try { localStorage.setItem(CAMPAIGN_SAVE_KEY, JSON.stringify([...cleared])); }
  catch { /* Progress remains available in this tab. */ }
  updateCards();
  return outcome;
}

async function launchFlight(shortcut?: FlightShortcut) {
  if (session || !pilotPicker) return;
  const id = selected;
  const campaignFlight = mode === 'campaign';
  const flightMode = mode === 'bullet-hell' || mode === 'hardcore' ? mode : 'regular';
  const loadout: FlightLoadout = {
    pilot: pilotPicker.selectedId,
    drone: testingLoadout && droneWeapon.value === 'towline' ? 'towline' : 'sentry',
    wings: testingLoadout ? wingSelectors.map(select => readWingWeapon(select.value)) : [],
    mode: flightMode,
  };
  const controller = new AbortController();
  function nextBriefing(next: LevelId) {
    if (session !== controller) return;
    returnToMenu();
    select(next);
    openBriefing();
  }
  session = controller;
  closeBriefing();
  menu.hidden = true;
  document.querySelector<HTMLElement>('#panel')!.hidden = false;
  const heading = document.querySelector<HTMLElement>('#heading')!;
  heading.classList.add('preparing-flight');
  heading.textContent = 'Preparing flight';
  document.querySelector('#message')!.textContent = levels[id].name;
  document.querySelector<HTMLButtonElement>('#pause')!.hidden = true;
  document.querySelector<HTMLButtonElement>('#pulse')!.disabled = true;
  document.querySelector<HTMLElement>('#boss-hud')!.hidden = true;
  document.querySelector<HTMLElement>('#hull-readout')!.hidden = flightMode === 'hardcore';
  const flightStatus = document.querySelector<HTMLElement>('#status')!;
  flightStatus.classList.add('preparing-graphics');
  flightStatus.textContent = 'Preparing graphics…';
  document.querySelector<HTMLButtonElement>('#start')!.hidden = true;
  document.querySelector<HTMLButtonElement>('#next-mission')!.hidden = true;
  app.hidden = false;
  document.querySelector<HTMLButtonElement>('#menu-button')!.focus({ preventScroll: true });
  try {
    const { openFlightSession } = await import('./app/flight-session');
    if (controller.signal.aborted) return;
    const handle = await openFlightSession(id, loadout, controller.signal, shortcut, campaignFlight ? {
      onClear: () => completeMission(id),
      onNext: nextBriefing,
    } : undefined, flightMode !== 'regular' ? {
      onClear() {
        refreshChallenges();
        const outcome = recordChallengeClear(challengeProgress, flightMode, id);
        saveChallenges();
        updateCards();
        return outcome;
      },
      onNext: nextBriefing,
      onLoss() {
        if (flightMode !== 'hardcore') return;
        refreshChallenges();
        resetHardcoreProgress(challengeProgress);
        saveChallenges();
        updateCards();
      },
    } : undefined);
    if (handle && !controller.signal.aborted)
      void saveLevelOffline(id, controller.signal).then(ready => {
        if (!controller.signal.aborted)
          handle.setOfflineReady(ready);
        void refreshSavedLevels();
      });
  }
  catch {
    if (controller.signal.aborted) return;
    returnToMenu();
    reloadBeforePreparation = true;
    prepare.textContent = 'Reload menu';
    status.textContent = 'This sector could not be prepared. Check your connection or WebGL support, then reload the menu to retry. Apply an available update if needed.';
  }
}
document.querySelector('#launch-flight')!.addEventListener('click', () => void launchFlight());

function updateShortcuts(id: LevelId) {
  const boss = document.querySelector<HTMLButtonElement>('#dev-boss')!;
  const hasTransition: LevelId[] = ['den', 'titan', 'summer', 'heliostat', 'boulevard', 'preserve', 'vents', 'io'];
  boss.textContent = id === 'fleet' ? 'Launch at breach' : id === 'wormhole' ? 'Launch at first supply drop' : hasTransition.includes(id) ? 'Launch at transition' : 'Launch at boss';
  document.querySelector<HTMLElement>('#dev-trench')!.hidden = id !== 'fleet';
  for (const button of briefing.querySelectorAll<HTMLElement>('[data-fons-start]')) button.hidden = id !== 'wormhole';
}

document.querySelector('#clear-offline')!.addEventListener('click', async () => {
  const removed = await clearSavedLevels();
  await refreshSavedLevels();
  status.textContent = removed ? 'Saved level files cleared. Campaign progress is retained.' : 'Offline storage could not be cleared on this device.';
});
if (import.meta.env.DEV) {
  const links=document.createElement('nav');
  links.id='menu-dev-tools';links.className='dev-links';links.setAttribute('aria-label','Development tools');
  for(const [path,label]of [['workshop.html','Asset workshop'],['patrol-study.html','Draconian patrol blend'],['vent-study.html','Abyss camera study'],['io-study.html','Io camera study'],['heliostat-study.html','Uranus corridor study'],['biolume-study.html','Bioluminescence lighting study'],['black-hole-study.html','Black hole study']]){
    const link=document.createElement('a');link.href=import.meta.env.BASE_URL+path;link.textContent=label;links.append(link);
  }
  menu.querySelector('.menu-actions')!.append(links);

  const shortcuts = document.createElement('details');
  shortcuts.className = 'brief-shortcuts';
  const summary = document.createElement('summary');
  summary.textContent = 'Dev launch shortcuts';
  const actions = document.createElement('div');
  actions.className = 'dev-links';
  function addShortcut(id: string, label: string, shortcut: FlightShortcut) {
    const button = document.createElement('button');
    button.id = id;
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => void launchFlight(shortcut));
    actions.append(button);
    return button;
  }
  addShortcut('dev-boss', 'Launch at boss', 'boss');
  addShortcut('dev-trench', 'Launch at trench', 'trench');
  for (const variant of fonsVariants) {
    const id = variant === 'normal' ? 'dev-fons' : 'dev-fons-' + variant;
    addShortcut(id, 'Launch at ' + fonsNames[variant], variant).dataset.fonsStart = '';
  }
  shortcuts.append(summary, actions);
  briefing.querySelector('.brief-actions')!.before(shortcuts);
}
const applyUpdate = registerSW({
  onNeedRefresh() {
    update.hidden = false;
  },
  onOfflineReady() {
    void refreshSavedLevels();
  },
});
update.addEventListener('click', () => {
  void applyUpdate(true);
});
