import { registerSW } from 'virtual:pwa-register';
import { levels, readLevel, type LevelId } from './levels';
import { saveLevelOffline, savedLevels, clearSavedLevels } from './app/offline';
import './style.css';
const menu = document.querySelector<HTMLElement>('#front-menu')!;
const app = document.querySelector<HTMLElement>('#game-app')!;
const cards = document.querySelector<HTMLElement>('#level-cards')!;
const prepare = document.querySelector<HTMLButtonElement>('#prepare-flight')!;
const status = document.querySelector<HTMLElement>('#menu-status')!;
const update = document.querySelector<HTMLButtonElement>('#menu-update')!;
let selected = readLevel(new URLSearchParams(location.search).get('level'));
let session: AbortController | undefined;
let reloadBeforePreparation = false;
const descriptions: Record<LevelId, string> = {
  biolume:'Fly beneath translucent luminous leaves, over tangled root bridges and blackwater pools. Lantern gliders guard the nursery; the enormous Lantern Ray waits in the Dark Crown.',
  summer:'Grazing mammoths, flower-rich meadows and thawing glacier gardens. Follow the river into the glass-covered lotus palace.',
  heliostat:'Fly through an artificial-star power plant above Uranus. Dodge capacitor discharges, cyborg man o’wars and inspection drones, then disable the Sunspot Regulator.',
  boulevard:'A rain-polished neon resort, luminous wireframe architecture and a pursuit cruiser beneath an artificial sunset.',
  vents: 'Mineral gardens, black smokers and the abyss. An articulated crab guards the drop.',
  io: 'Sulfur works, flowing lava and the Caldera Engine.',
  titan: 'An overgrown research station beneath amber haze. Rise to face the cicada.',
  ice: 'Tumbling ice, remote industry and ancient marine predators.',
  broodlock: 'An infected ant hive threaded with parasitic growth.',
  preserve: 'Enter an orbital greenhouse through its spaceport, cross flooded ravines and cycad terraces, then face the Groundskeeper.',
};
function select(id: LevelId) {
  selected = id;
  for (const button of cards.querySelectorAll<HTMLButtonElement>('button'))
    button.setAttribute('aria-pressed', String(button.dataset.level === id));
  const url = new URL(location.href);
  url.searchParams.set('level', id);
  history.replaceState(null, '', url);
  status.textContent = descriptions[id];
}
for (const [id, level] of Object.entries(levels)) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.level = id;
  button.className = 'level-card';
  const title = document.createElement('strong');
  const detail = document.createElement('span');
  title.textContent = level.name;
  detail.textContent = `${level.duration} second route · ${level.boss}`;
  button.append(title, detail);
  button.addEventListener('click', () => select(id as LevelId));
  cards.append(button);
}
async function refreshSavedLevels() {
  const ready = await savedLevels();
  for (const card of cards.querySelectorAll<HTMLButtonElement>('button')) {
    const id = card.dataset.level as LevelId;
    const saved = ready.includes(id);
    card.classList.toggle('saved-offline', saved);
    card.querySelector('span')!.textContent = `${levels[id].duration} second route · ${saved ? 'Saved offline' : levels[id].boss}`;
  }
}
select(selected);
void refreshSavedLevels();
function returnToMenu() {
  session?.abort();
  session = undefined;
  app.hidden = true;
  menu.hidden = false;
  prepare.disabled = false;
  status.textContent = descriptions[selected];
  prepare.focus();
  void refreshSavedLevels();
}
document.querySelector('#menu-button')!.addEventListener('click', returnToMenu);
document.querySelector('#return-menu')!.addEventListener('click', returnToMenu);
prepare.addEventListener('click', async () => {
  if (session) return;
  // Failed module loads can remain in the browser's module map until reload.
  if (reloadBeforePreparation) { location.reload(); return; }
  const controller = new AbortController();
  session = controller;
  prepare.disabled = true;
  menu.hidden = true;
  app.hidden = false;
  // Disable the old session's launch control before the async import yields.
  document.querySelector<HTMLButtonElement>('#start')!.disabled = true;
  try {
    const { openFlightSession } = await import('./app/flight-session');
    if (controller.signal.aborted)
      return;
    const handle = await openFlightSession(selected, controller.signal);
    if (handle && !controller.signal.aborted)
      void saveLevelOffline(selected, controller.signal).then(ready => {
        if (!controller.signal.aborted)
          handle.setOfflineReady(ready);
        void refreshSavedLevels();
      });
  }
  catch {
    if (controller.signal.aborted)
      return;
    returnToMenu();
    reloadBeforePreparation = true; prepare.textContent = 'Reload menu';
    status.textContent = 'This sector could not be prepared. Check your connection or WebGL support, then reload the menu to retry. Apply an available update if needed.';
  }
});
document.querySelector('#clear-offline')!.addEventListener('click', async () => {
  const cleared = await clearSavedLevels();
  await refreshSavedLevels();
  status.textContent = cleared ? 'Saved level files cleared. The menu remains available offline.' : 'Offline storage could not be cleared on this device.';
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
  }, onOfflineReady() {
    if (!session && !reloadBeforePreparation)
      status.textContent = 'Menu available offline. Prepare a sector to save its flight.';
  }
});
update.addEventListener('click', () => {
  void applyUpdate(true);
});
