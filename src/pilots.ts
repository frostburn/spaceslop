declare const __PILOT_PORTRAITS__: readonly string[];

const pilots = [
  { id: 'vex', name: 'Vex', color: '#88f2ff' },
  { id: 'rook', name: 'Rook', color: '#ffbd76' },
  { id: 'glint', name: 'Glint', color: '#dca2f8' },
] as const;
type Pilot = typeof pilots[number];

const storageKey = 'spaceslop.pilot';

function savedPilot() {
  try {
    const id = localStorage.getItem(storageKey);
    return pilots.find((pilot) => pilot.id === id) ?? pilots[0];
  } catch {
    return pilots[0];
  }
}

function portrait(pilot: Pilot) {
  const frame = document.createElement('span');
  frame.className = 'portrait';
  frame.setAttribute('aria-hidden', 'true');
  frame.style.setProperty('--pilot-color', pilot.color);

  const fallback = document.createElement('span');
  fallback.className = 'portrait-fallback';
  fallback.textContent = pilot.name[0];
  frame.append(fallback);

  const path = `pilots/${pilot.id}.png`;
  if (__PILOT_PORTRAITS__.includes(path)) {
    const image = document.createElement('img');
    image.alt = '';
    image.addEventListener('error', () => image.remove(), { once: true });
    image.src = import.meta.env.BASE_URL + path;
    frame.append(image);
  }

  return frame;
}

export function setupPilots(
  picker: HTMLFieldSetElement,
  choices: HTMLElement,
  selectedPortrait: HTMLElement,
  selectedName: HTMLElement,
  desktopSlot: HTMLElement,
  mobileSlot: HTMLElement,
) {
  const desktop = matchMedia('(min-width: 760px)');
  function placePicker() {
    const focused = document.activeElement;
    (desktop.matches ? desktopSlot : mobileSlot).append(picker);
    if (focused instanceof HTMLElement && picker.contains(focused)) {
      focused.focus({ preventScroll: true });
    }
  }

  desktop.addEventListener('change', placePicker);
  placePicker();

  const selected = savedPilot();
  function showPilot(pilot: Pilot) {
    selectedPortrait.replaceChildren(portrait(pilot));
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

  return (selectable: boolean) => {
    if (picker.hidden === selectable) picker.hidden = !selectable;
  };
}
