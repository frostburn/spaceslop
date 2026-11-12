export const WORMHOLE_APPROACH = 3.8;

function smooth(start: number, end: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

// One timeline registers the backdrop, aperture and rig. The age is zero at
// approach start and reaches WORMHOLE_APPROACH when combat takes over.
export function wormholeFrame(time: number, routeDuration: number) {
  const age = time - routeDuration;
  const approach = smooth(-2.9, 1.6, age);
  const opening = smooth(-1.65, 2.25, age);
  const lingering = 1 - smooth(WORMHOLE_APPROACH - .35, WORMHOLE_APPROACH + 2.75, age);
  const brakeTime = Math.max(0, age - .6);
  const wave = smooth(.95, 2.75, age);
  return {
    travel: 1.65 * time - 1.07 * (brakeTime + 1.7 * Math.expm1(-brakeTime / 1.7)),
    // Offsets are measured in fractions of the viewport's half-height.
    lensX: -.43 * (1 - approach),
    lensY: (.32 + .065 * Math.sin(approach * Math.PI)) * (1 - approach),
    lensRadius: (.041 + .285 * opening) * (.72 + .28 * lingering),
    lensStrength: smooth(-2.8, .7, age) * (.18 + .82 * lingering),
    echo: smooth(-6.6, .95, age) * (.27 + .73 * lingering),
    waveRadius: .2 + .95 * wave,
    waveStrength: Math.sin(wave * Math.PI) * .52,
    arrival: smooth(.76, WORMHOLE_APPROACH, age),
    wingSpread: smooth(.84, 2.55, age),
    bossVisible: age >= .76,
  };
}
