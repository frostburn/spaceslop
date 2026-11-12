import { registerSW } from 'virtual:pwa-register';
import { saveLevelOffline, savedLevels, clearSavedLevels } from './app/offline';
import { campaign, missionFor } from './campaign/missions';
import { CAMPAIGN_SAVE_KEY, campaignStatus, decodeCampaignClears, recordCampaignClear } from './campaign/progress';
import { ranks } from './campaign/ranks';
import { levels, readLevel, type LevelId } from './levels';
import './style.css';

const menu = document.querySelector<HTMLElement>('#front-menu')!;
const app = document.querySelector<HTMLElement>('#game-app')!;
const cards = document.querySelector<HTMLElement>('#level-cards')!;
const prepare = document.querySelector<HTMLButtonElement>('#prepare-flight')!;
const status = document.querySelector<HTMLElement>('#menu-status')!;
const update = document.querySelector<HTMLButtonElement>('#menu-update')!;
const campaignMode = document.querySelector<HTMLButtonElement>('#campaign-mode')!;
const freeFlightMode = document.querySelector<HTMLButtonElement>('#free-flight-mode')!;
const query = new URLSearchParams(location.search);
let inCampaign = query.get('mode') === 'campaign' || (query.get('mode') !== 'free-flight' && !query.has('level'));
let cleared = savedCampaign();
let selected = inCampaign ? campaignSelection() : readLevel(query.get('level'));
let saved = new Set<LevelId>();
let session: AbortController | undefined;
let reloadBeforePreparation = false;

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
  status.textContent = inCampaign ? `Return to Sender · ${ranks[rank].name} · ${progress}` : missionFor[selected].objective;
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

function returnToMenu() {
  session?.abort();
  session = undefined;
  app.hidden = true;
  menu.hidden = false;
  prepare.disabled = false;
  showMenuStatus();
  prepare.focus();
  void refreshSavedLevels();
}
document.querySelector('#menu-button')!.addEventListener('click', returnToMenu);
document.querySelector('#return-menu')!.addEventListener('click', returnToMenu);

function completeMission(id: LevelId) {
  const outcome = recordCampaignClear(new Set([...cleared, ...savedCampaign()]), id);
  cleared = outcome.cleared;
  try { localStorage.setItem(CAMPAIGN_SAVE_KEY, JSON.stringify([...cleared])); }
  catch { /* Progress remains available in this tab. */ }
  updateCards();
  return outcome;
}

async function prepareFlight() {
  if (session) return;
  // Failed module loads can remain in the browser's module map until reload.
  if (reloadBeforePreparation) { location.reload(); return; }
  const id = selected;
  const campaignFlight = inCampaign;
  const controller = new AbortController();
  session = controller;
  prepare.disabled = true;
  menu.hidden = true;
  app.hidden = false;
  // Disable the old session's launch control before the async import yields.
  document.querySelector<HTMLButtonElement>('#start')!.disabled = true;
  document.querySelector<HTMLElement>('#mission-brief')!.hidden = true;
  document.querySelector<HTMLButtonElement>('#next-mission')!.hidden = true;
  try {
    const { openFlightSession } = await import('./app/flight-session');
    if (controller.signal.aborted) return;
    const handle = await openFlightSession(id, controller.signal, campaignFlight ? {
      onClear: () => completeMission(id),
      onNext(next) {
        if (session !== controller) return;
        returnToMenu();
        select(next);
        void prepareFlight();
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
prepare.addEventListener('click', () => void prepareFlight());

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
