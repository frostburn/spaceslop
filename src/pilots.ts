import { pilots } from './pilot-data';

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

function portrait(pilot: Pilot) {
  const path = `pilots/${pilot.id}.png`;
  const url = __PILOT_PORTRAITS__.includes(path) ? import.meta.env.BASE_URL + __PILOT_URLS__[path] : undefined;
  return createPortrait(pilot.name[0], pilot.color, url);
}

export function setupPilots(
  picker: HTMLElement,
  choices: HTMLElement,
  selectedPortrait: HTMLElement,
  selectedName: HTMLElement,
  perkDescription: HTMLElement,
  desktopSlot: HTMLElement,
  mobileSlot: HTMLElement,
  signal?:AbortSignal,
) {
  const desktop = matchMedia('(min-width: 760px)');
  function placePicker() {
    const focused = document.activeElement;
    (desktop.matches ? desktopSlot : mobileSlot).append(picker);
    if (focused instanceof HTMLElement && picker.contains(focused)) {
      focused.focus({ preventScroll: true });
    }
  }

  desktop.addEventListener('change', placePicker,{signal});
  choices.replaceChildren();
  placePicker();

  let selected = savedPilot();
  function showPilot(pilot: Pilot) {
    selected = pilot;
    selectedPortrait.replaceChildren(portrait(pilot));
    selectedPortrait.style.setProperty('--pilot-color', pilot.color);
    perkDescription.textContent = `${pilot.perk} · ${pilot.description}`;
    selectedName.textContent = pilot.name;
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
    });

    const card = document.createElement('span');
    card.className = 'pilot-card';
    const name = document.createElement('span');
    name.textContent = pilot.name;
    card.append(portrait(pilot), name);
    label.append(radio, card);
    choices.append(label);
  }

  return {
    get selectedId() { return selected.id; },
    setVisible(selectable: boolean) {
      if (picker.hidden === selectable) picker.hidden = !selectable;
    },
  };
}
