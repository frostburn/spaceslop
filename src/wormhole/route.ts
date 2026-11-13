import { campaign } from '../campaign/missions';

export const WORMHOLE_SUPPLY_TIME = 4.8;
export const wormholeBosses = [
  ...campaign.flatMap(({ level }) => level === 'wormhole' ? [] : [level]),
  'wormhole',
] as const;

function smooth(start: number, end: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

// The opening scroll slows continuously while each encounter opens the aperture.
export function wormholeFrame(time: number, routeDuration: number, encounterAge = time - routeDuration, finale = false) {
  const age = time - routeDuration;
  const approach = smooth(-2.9, 1.6, age);
  const opening = smooth(-1.65, 2.25, age);
  const lingering = 1 - smooth(WORMHOLE_SUPPLY_TIME - .35, WORMHOLE_SUPPLY_TIME + 2.75, age);
  const brakeTime = Math.max(0, age - .6);
  const contact = finale ? 0 : smooth(.45, 2.65, encounterAge) *
    (1 - smooth(WORMHOLE_SUPPLY_TIME, WORMHOLE_SUPPLY_TIME + 2.4, encounterAge));
  const wave = smooth(.95, 2.75, encounterAge);
  return {
    travel: 1.65 * time - 1.07 * (brakeTime + 1.7 * Math.expm1(-brakeTime / 1.7)),
    // Offsets are measured in fractions of the viewport's half-height.
    lensX: -.43 * (1 - approach),
    lensY: (.32 + .065 * Math.sin(approach * Math.PI)) * (1 - approach),
    lensRadius: Math.max((.041 + .285 * opening) * (.72 + .28 * lingering), .32 * contact),
    lensStrength: Math.max(smooth(-2.8, .7, age) * (.18 + .82 * lingering), .7 * contact),
    echo: smooth(-6.6, .95, age) * (.27 + .73 * lingering),
    waveRadius: .2 + .95 * wave,
    waveStrength: Math.sin(wave * Math.PI) * .52,
    arrival: smooth(1.25, WORMHOLE_SUPPLY_TIME, encounterAge),
  };
}
