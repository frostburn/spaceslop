import { levels } from './levels';

export const PRESERVE_SCREENS = 10;
export const PRESERVE_SPEED = 1.65;
export const PRESERVE_PITCH = 26 * Math.PI / 180;
export const PRESERVE_DISTANCE = 38;
export const PRESERVE_WIDTH_SCALE = .84;
export const PRESERVE_DOCK_Y = 8;
export const PRESERVE_START = 8;
export const PRESERVE_BAY = 8;
export const PRESERVE_END = Math.ceil((levels.preserve.duration * PRESERVE_SPEED + 8) / PRESERVE_BAY) * PRESERVE_BAY;
export const PRESERVE_DECK = -3.05;
export const PRESERVE_APPROACH = 6;
export const PRESERVE_BOSS_PITCH = 70 * Math.PI / 180;
export const PRESERVE_RISE = 6;
export const PRESERVE_FINAL_SCROLL = levels.preserve.duration * PRESERVE_SPEED + PRESERVE_SPEED * PRESERVE_APPROACH / 2;
export const PRESERVE_ARENA_Y = PRESERVE_FINAL_SCROLL + 11;
export const PRESERVE_ARENA_RADIUS = 11.2;
export const PRESERVE_ARENA_FLOOR = -4.45;
export const PRESERVE_ARENA_UNDERLAY = -4.8;
export const PRESERVE_WATER_START = 49;
export const PRESERVE_WATER_END = 91;
export const preserveSections = [
  { y: 0, name: 'Spaceport approach' }, { y: 18, name: 'Cultivated beds' },
  { y: 48, name: 'Flooded fern ravine' }, { y: 98, name: 'Cycad terraces' },
  { y: 143, name: 'Nesting grounds' },
] as const;

export function preserveRandom(seed: number) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const smooth = (t: number) => { const v = Math.max(0, Math.min(1, t)); return v * v * (3 - 2 * v); };
const band = (y: number, a: number, b: number, feather = 7) => smooth((y - a) / feather) * (1 - smooth((y - b) / feather));
export function preserveHabitat(y: number) {
  return { wet: band(y, 42, 90), dry: band(y, 94, 133, 9), nest: smooth((y - 140) / 14) };
}
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
  return .42 * Math.sin(y * .19) + .22 * Math.sin(y * .43 + .4);
}
export function preserveWater(y: number) {
  const x = .15 + .85 * Math.sin(y * .17) + .2 * Math.sin(y * .43), pool = Math.exp(-(((y - 65) / 4.5) ** 2));
  return { x, width: .55 + pool * 1.05 + .16 * Math.sin(y * .33) ** 2,
    z: -4.65 + .36 * smooth((y - 74) / 1.2) + .55 * smooth((y - 85) / 1.4) };
}
export const preservePools = [
  { x: 1.45, y: 29, rx: .67, ry: 2.1, z: -4.35 },
  { x: -1.8, y: 119, rx: .68, ry: 1.7, z: -4.05 },
] as const;

export function preserveGround(x: number, y: number) {
  const { wet, dry, nest } = preserveHabitat(y), edge = Math.abs(x - preserveChannel(y));
  const bank = smooth((edge - 1.1) / 1.8);
  const detail = (preserveNoise(x * 1.7, y * 1.3) - .5) * .16
    + (preserveNoise(x * .7, y * .45) - .5) * .32;
  let z = -4.25 + bank * (1.1 - nest * .5) + detail;
  const w = preserveWater(y), shore = smooth((Math.abs(x - w.x) - w.width * .65) / (w.width * .4));
  const ravine = w.z - .46 + shore * 1.37 + detail * .5;
  z += (ravine - z) * wet;
  // Unequal ledges with roughened edges form a rocky left bank, not a square grid.
  const ridgeX = -x + .17 * Math.sin(y * .37) + .08 * Math.sin(y * 1.1);
  const terraces = smooth((ridgeX - .6) / .28) * .36 + smooth((ridgeX - 1.65) / .26) * .48
    + smooth((ridgeX - 2.6) / .24) * .4;
  z += dry * terraces;
  for (const pool of preservePools) {
    const r = Math.hypot((x - pool.x) / pool.rx, (y - pool.y) / pool.ry);
    const basin = pool.z - .45 + .65 * smooth((r - .75) / .4);
    const blend = 1 - smooth((r - 1.15) / .4);
    z += (basin - z) * blend;
  }
  // The rotunda owns its floor. Keep the entire underlay below its slab.
  const distance = Math.hypot(x, (y - PRESERVE_ARENA_Y) / 1.1);
  const buried = smooth((PRESERVE_ARENA_RADIUS + 1.4 - distance) / 1.4);
  return z + (PRESERVE_ARENA_UNDERLAY - z) * buried;
}
export function preserveScroll(time: number) {
  const stage = Math.max(0, Math.min(levels.preserve.duration, time));
  const coast = Math.max(0, Math.min(PRESERVE_APPROACH, time - levels.preserve.duration));
  return PRESERVE_SPEED * (stage + coast - coast * coast / (2 * PRESERVE_APPROACH));
}
export function preserveFrame(exit: number) {
  return { pitch: PRESERVE_BOSS_PITCH * exit, viewPitch: PRESERVE_PITCH * (1 - exit),
    height: PRESERVE_RISE * exit, bank: 0 };
}
