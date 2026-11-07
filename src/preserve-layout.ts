import { levels } from './levels';

// A first habitat section, not the final ten-screen dinosaur route.
export const PRESERVE_SPEED = 1.65;
export const PRESERVE_PITCH = 16 * Math.PI / 180;
export const PRESERVE_DISTANCE = 38;
export const PRESERVE_WIDTH_SCALE = .84;
export const PRESERVE_START = -16;
export const PRESERVE_BAY = 8;
export const PRESERVE_END = Math.ceil((levels.preserve.duration * PRESERVE_SPEED + 16) / PRESERVE_BAY) * PRESERVE_BAY;
export const PRESERVE_DECK = -3.05;
export const PRESERVE_APPROACH = 6;
export const PRESERVE_BOSS_PITCH = 70 * Math.PI / 180;
export const PRESERVE_RISE = 6;
export const PRESERVE_FINAL_SCROLL = levels.preserve.duration * PRESERVE_SPEED + PRESERVE_SPEED * PRESERVE_APPROACH / 2;
export const PRESERVE_ARENA_Y = PRESERVE_FINAL_SCROLL + 11;
export const PRESERVE_ARENA_RADIUS = 11.2;
export const PRESERVE_ARENA_FLOOR = -4.45;
export const PRESERVE_ARENA_UNDERLAY = -4.8;

export function preserveRandom(seed: number) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const smooth = (t: number) => { const v = Math.max(0, Math.min(1, t)); return v * v * (3 - 2 * v); };
export function preserveNoise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), u = smooth(x - ix), v = smooth(y - iy);
  const at = (a: number, b: number) => {
    let h = Math.imul(a, 374761393) + Math.imul(b, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  return (at(ix, iy) * (1 - u) + at(ix + 1, iy) * u) * (1 - v)
    + (at(ix, iy + 1) * (1 - u) + at(ix + 1, iy + 1) * u) * v;
}

export function preserveChannel(y: number) {
  return .42 * Math.sin(y * .24) + .16 * Math.sin(y * .57 + .4);
}

export const preservePools = [
  { x: 1.45, y: 5.1, rx: .57, ry: 1.65 },
  { x: -1.8, y: 21.8, rx: .55, ry: 1.3 },
] as const;

export function preserveGround(x: number, y: number) {
  const edge = Math.abs(x - preserveChannel(y));
  const bank = smooth((edge - 1.3) / 1.6);
  const detail = (preserveNoise(x * 1.7, y * 1.3) - .5) * .16
    + (preserveNoise(x * .7, y * .45) - .5) * .32;
  let z = -4.25 + bank * 1.16 + detail;
  for (const pool of preservePools) {
    const r = Math.hypot((x - pool.x) / pool.rx, (y - pool.y) / pool.ry);
    z -= (1 - smooth((r - .72) / .5)) * .56;
  }
  // The rotunda owns its floor. Ease the incoming soil down outside its rim,
  // then keep the entire underlay below the slab rather than intersecting it.
  const distance = Math.hypot(x, (y - PRESERVE_ARENA_Y) / 1.1);
  const buried = smooth((PRESERVE_ARENA_RADIUS + 1.4 - distance) / 1.4);
  return z + (PRESERVE_ARENA_UNDERLAY - z) * buried;
}

export function preserveScroll(time: number) {
  // The habitat passes beneath the aircraft; no path-following camera or wrap.
  const stage = Math.max(0, Math.min(levels.preserve.duration, time));
  const coast = Math.max(0, Math.min(PRESERVE_APPROACH, time - levels.preserve.duration));
  return PRESERVE_SPEED * (stage + coast - coast * coast / (2 * PRESERVE_APPROACH));
}

export function preserveFrame(exit: number) {
  return { pitch: PRESERVE_PITCH + (PRESERVE_BOSS_PITCH - PRESERVE_PITCH) * exit,
    height: PRESERVE_RISE * exit, bank: 0 };
}
