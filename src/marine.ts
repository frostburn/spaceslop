export type MarineKind = 'ichthyosaur' | 'plesiosaur';
export const marineSpecs = {
  ichthyosaur: { hp: 3, radius: 0.5, halfLength: 1.04, speed: 2.75 },
  plesiosaur: { hp: 9, radius: 0.62, halfLength: 1.55, speed: 1.25 },
} as const;

// Packs bank together, then accelerate through the lane. Sweepers hold longer,
// paddle across their lane and release a slow, visibly charged fan from the mouth.
export function marineMotion(kind: MarineKind, age: number, lane: number) {
  const sweep = kind === 'plesiosaur';
  const hunt = sweep ? 0 : Math.max(0, Math.min(1, (age - 1.25) / .7));
  const frequency = sweep ? 1.1 : 1.7;
  const amplitude = sweep ? .7 : .55;
  const wave = Math.sin(age * frequency);
  return { x: lane + wave * amplitude, speed: marineSpecs[kind].speed + hunt * 1.15,
    heading: -Math.atan2(Math.cos(age * frequency) * amplitude * frequency, marineSpecs[kind].speed + hunt * 1.15),
    bank: Math.cos(age * frequency) * (sweep ? .16 : .65), hunt };
}

export const LEVIATHAN_HP = 60;
export const LEVIATHAN_INTERVAL = 3.2;
export const LEVIATHAN_WINDUP = .55;
export const LEVIATHAN_FIRE = 1.45;
export const LEVIATHAN_TRAVEL = .85;
export function leviathanMotion(time: number) {
  const elapsed = Math.max(0,time) % LEVIATHAN_INTERVAL;
  const windup = Math.max(0,Math.min(1,(elapsed - LEVIATHAN_WINDUP) / (LEVIATHAN_FIRE - LEVIATHAN_WINDUP)));
  const recoil = elapsed < LEVIATHAN_FIRE ? 0 : Math.max(0,1-(elapsed-LEVIATHAN_FIRE)/.45);
  return { windup: elapsed < LEVIATHAN_FIRE ? windup : 0, recoil,
    jaw: elapsed < LEVIATHAN_FIRE ? .12 + windup * .7 : .12 + recoil * .78 };
}
