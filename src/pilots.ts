import { pilots, type PilotId } from './pilot-data';

declare const __PILOT_URLS__:Record<string,string>;
declare const __PILOT_PORTRAITS__: readonly string[];

type Pilot = typeof pilots[number];

const storageKey = 'spaceslop.pilot';

function savedPilot() {
  try {
    const savedId = localStorage.getItem(storageKey);
    const id = savedId === 'rook' ? 'brass' : savedId;
    return pilots.find((pilot) => pilot.id === id) ?? pilots[0];
  } catch {
    return pilots[0];
  }
}

export function createPortrait(initials: string, color: string, url?: string, signal?: AbortSignal) {
  const frame = document.createElement('span');
  frame.className = 'portrait';
  frame.setAttribute('aria-hidden', 'true');
  frame.style.setProperty('--pilot-color', color);

  const fallback = document.createElement('span');
  fallback.className = 'portrait-fallback';
  fallback.textContent = initials;
  frame.append(fallback);

  if (url && !signal?.aborted) {
    const image = document.createElement('img');
    image.alt = '';
    image.addEventListener('error', () => image.remove(), { once: true, signal });
    signal?.addEventListener('abort', () => image.removeAttribute('src'), { once: true });
    image.src = url;
    frame.append(image);
  }

  return frame;
}

function portrait(pilot: Pilot, signal: AbortSignal) {
  const path = `pilots/${pilot.id}.png`;
  const url = __PILOT_PORTRAITS__.includes(path) ? import.meta.env.BASE_URL + __PILOT_URLS__[path] : undefined;
  return createPortrait(pilot.name[0], pilot.color, url, signal);
}

export function showSelectedPilot(id: PilotId, slot: HTMLElement, name: HTMLElement, signal: AbortSignal) {
  const pilot = pilots.find(pilot => pilot.id === id) ?? pilots[0];
  slot.replaceChildren(portrait(pilot, signal));
  slot.style.setProperty('--pilot-color', pilot.color);
  name.textContent = pilot.name;
}

export function setupPilotPicker(choices: HTMLElement, perkDescription: HTMLElement, signal: AbortSignal) {
  choices.replaceChildren();

  let selected = savedPilot();
  let hardcore = false;
  function showPilot(pilot: Pilot) {
    selected = pilot;
    const description = hardcore && pilot.id === 'brass'
      ? 'Each surplus weapon pickup clears hostile bullets on screen.' : pilot.description;
    perkDescription.textContent = `${pilot.perk} · ${description}`;
  }
  showPilot(selected);

  for (const pilot of pilots) {
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'pilot';
    radio.value = pilot.id;
    radio.checked = pilot === selected;
    radio.addEventListener('change', () => {
      showPilot(pilot);
      try {
        localStorage.setItem(storageKey, pilot.id);
      } catch {
        // The current choice still works when storage is unavailable.
      }
    }, { signal });

    const card = document.createElement('span');
    card.className = 'pilot-card';
    const name = document.createElement('span');
    name.textContent = pilot.name;
    card.append(portrait(pilot, signal), name);
    label.append(radio, card);
    choices.append(label);
  }

  return {
    get selectedId() { return selected.id; },
    setHardcore(value: boolean) {
      hardcore = value;
      showPilot(selected);
    },
  };
}
