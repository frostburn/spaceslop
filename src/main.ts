import { registerSW } from 'virtual:pwa-register';
import { setupBriefing } from './app/briefing';
import type { FlightLoadout, FlightShortcut } from './app/flight-session';
import { saveLevelOffline, savedLevels, clearSavedLevels } from './app/offline';
import { campaign } from './campaign/missions';
import { CAMPAIGN_SAVE_KEY, campaignStatus, decodeCampaignClears, recordCampaignClear } from './campaign/progress';
import { ranks } from './campaign/ranks';
import { levels, readLevel, type LevelId } from './levels';
import { setupPilotPicker } from './pilots';
import { readWingWeapon, wingWeapons } from './wing';
import { fonsNames, fonsVariants } from './wormhole/fons/variants';
import './style.css';

const menu = document.querySelector<HTMLElement>('#front-menu')!;
const app = document.querySelector<HTMLElement>('#game-app')!;
const missionList = document.querySelector<HTMLElement>('#mission-list')!;
const logo = document.querySelector<HTMLElement>('#menu-title')!;
const logoUnderline = logo.querySelector<HTMLElement>('.logo-underline')!;
const briefing = document.querySelector<HTMLElement>('#menu-briefing')!;
const briefTitle = document.querySelector<HTMLElement>('#brief-title')!;
const cards = document.querySelector<HTMLElement>('#level-cards')!;
const prepare = document.querySelector<HTMLButtonElement>('#prepare-flight')!;
const status = document.querySelector<HTMLElement>('#menu-status')!;
const update = document.querySelector<HTMLButtonElement>('#menu-update')!;
const campaignMode = document.querySelector<HTMLButtonElement>('#campaign-mode')!;
const freeFlightMode = document.querySelector<HTMLButtonElement>('#free-flight-mode')!;
const droneWeapon = document.querySelector<HTMLSelectElement>('#drone-weapon')!;
const wingSelectors = ['#left-wing', '#right-wing'].map(selector => document.querySelector<HTMLSelectElement>(selector)!);
const query = new URLSearchParams(location.search);
const testingLoadout = import.meta.env.DEV || query.get('testLoadout') === '1';
let inCampaign = query.get('mode') === 'campaign' || (query.get('mode') !== 'free-flight' && !query.has('level'));
let cleared = savedCampaign();
let selected = inCampaign ? campaignSelection() : readLevel(query.get('level'));
let saved = new Set<LevelId>();
let session: AbortController | undefined;
let briefController: AbortController | undefined;
let pilotPicker: ReturnType<typeof setupPilotPicker> | undefined;
let reloadBeforePreparation = false;

function moveLogoDiamond(event: PointerEvent) {
  if (!event.isPrimary || menu.hidden || missionList.hidden) return;
  const { left, width } = logoUnderline.getBoundingClientRect();
  if (width === 0) return;
  const position = Math.max(0, Math.min(1, (event.clientX - left) / width));
  logo.style.setProperty('--logo-pointer-x', `${position * 100}%`);
}

window.addEventListener('pointerdown', moveLogoDiamond, { passive: true });
window.addEventListener('pointermove', moveLogoDiamond, { passive: true });

function savedCampaign() {
  try { return decodeCampaignClears(localStorage.getItem(CAMPAIGN_SAVE_KEY)); }
  catch { return new Set<LevelId>(); }
}

function campaignSelection() {
  return campaignStatus(cleared).next ?? campaign.at(-1)!.level;
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
  const { next } = campaignStatus(cleared);
  for (const card of levelCards) {
    const { id, button, title, detail } = card;
    const complete = cleared.has(id);
    button.disabled = inCampaign && !complete && id !== next;
    button.setAttribute('aria-pressed', String(id === selected));
    button.classList.toggle('saved-offline', saved.has(id));
    title.textContent = inCampaign ? `${card.number} · ${levels[id].name}` : levels[id].name;
    const note = inCampaign ? (complete ? 'Cleared' : id === next ? 'Ready' : 'Locked') : `${levels[id].duration} second route`;
    detail.textContent = saved.has(id) ? `${note} · Saved offline` : note;
  }
}

function showMenuStatus() {
  const { rank, next } = campaignStatus(cleared);
  const progress = next ? `${cleared.size}/${campaign.length} cleared` : 'Campaign complete';
  status.textContent = inCampaign ? `Return to Sender · ${ranks[rank].name} · ${progress}` : levels[selected].name;
}

function select(id: LevelId) {
  selected = id;
  campaignMode.setAttribute('aria-pressed', String(inCampaign));
  freeFlightMode.setAttribute('aria-pressed', String(!inCampaign));
  const url = new URL(location.href);
  if (inCampaign) {
    url.searchParams.set('mode', 'campaign');
    url.searchParams.delete('level');
  } else {
    url.searchParams.delete('mode');
    url.searchParams.set('level', id);
  }
  history.replaceState(null, '', url);
  updateCards();
  showMenuStatus();
}

async function refreshSavedLevels() {
  saved = new Set(await savedLevels());
  updateCards();
}

campaignMode.addEventListener('click', () => {
  if (inCampaign) return;
  inCampaign = true;
  select(campaignSelection());
});
freeFlightMode.addEventListener('click', () => {
  if (!inCampaign) return;
  inCampaign = false;
  select(selected);
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
  pilotPicker = setupPilotPicker(document.querySelector('#pilot-choices')!, document.querySelector('#pilot-perk-description')!, signal);
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
  const campaignFlight = inCampaign;
  const loadout: FlightLoadout = {
    pilot: pilotPicker.selectedId,
    drone: testingLoadout && droneWeapon.value === 'towline' ? 'towline' : 'sentry',
    wings: testingLoadout ? wingSelectors.map(select => readWingWeapon(select.value)) : [],
  };
  const controller = new AbortController();
  session = controller;
  closeBriefing();
  menu.hidden = true;
  document.querySelector<HTMLElement>('#panel')!.hidden = false;
  document.querySelector('#heading')!.textContent = 'Preparing flight';
  document.querySelector('#message')!.textContent = levels[id].name;
  document.querySelector<HTMLButtonElement>('#pause')!.hidden = true;
  document.querySelector<HTMLButtonElement>('#pulse')!.disabled = true;
  document.querySelector<HTMLElement>('#boss-hud')!.hidden = true;
  document.querySelector<HTMLElement>('#status')!.textContent = 'Preparing graphics…';
  document.querySelector<HTMLButtonElement>('#start')!.hidden = true;
  document.querySelector<HTMLButtonElement>('#next-mission')!.hidden = true;
  app.hidden = false;
  document.querySelector<HTMLButtonElement>('#menu-button')!.focus({ preventScroll: true });
  try {
    const { openFlightSession } = await import('./app/flight-session');
    if (controller.signal.aborted) return;
    const handle = await openFlightSession(id, loadout, controller.signal, shortcut, campaignFlight ? {
      onClear: () => completeMission(id),
      onNext(next) {
        if (session !== controller) return;
        returnToMenu();
        select(next);
        openBriefing();
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
  const hasTransition: LevelId[] = ['den', 'titan', 'wormhole', 'summer', 'heliostat', 'boulevard', 'preserve', 'vents', 'io'];
  boss.textContent = id === 'fleet' ? 'Launch at breach' : hasTransition.includes(id) ? 'Launch at transition' : 'Launch at boss';
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
  for(const [path,label]of [['workshop.html','Asset workshop'],['vent-study.html','Abyss camera study'],['io-study.html','Io camera study'],['heliostat-study.html','Uranus corridor study'],['biolume-study.html','Bioluminescence lighting study'],['black-hole-study.html','Black hole study']]){
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
