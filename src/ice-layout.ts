import { HEIGHT } from './playfield';

export const ICE_SCREENS = 10;
export const ICE_TRAVEL = (ICE_SCREENS - 1) * HEIGHT;
export const ICE_DURATION = 90;
export const ICE_CAMERA_DISTANCE = 32;
export const iceSections = ['Outer drift', 'Broken ice', 'Open hunting ground', 'Ice narrows', 'Survey wreck',
  'Cold passage', 'Scattered flotilla', 'Shattered shelf', 'Last patrol', 'Interceptor arena'] as const;
export type IceRock = { x: number; y: number; z: number; radius: number; variant: number; angle: number; solid: boolean };
export const iceRocks: IceRock[] = [];
const random = (i: number) => { const n = Math.sin(i * 127.1 + 31.7) * 43758.5453; return n - Math.floor(n); };
for (let section = 0; section < ICE_SCREENS; section++) {
  // Solid outcrops stay outside the central escape lane; the last screen is an open arena.
  if (section < 9) for (const side of [-1, 1]) iceRocks.push({
    x: side * (3.55 + random(section * 5 + side) * 0.4), y: section * HEIGHT + (side < 0 ? 1 : section === 8 ? 4 : 8), z: -0.2,
    radius: 0.7 + random(section + side * 3) * 0.18, variant: section % 6, angle: section * 1.7, solid: true,
  });
  for (let i = 0; i < 9; i++) {
    const seed = section * 19 + i, side = i % 2 ? -1 : 1, foreground = i < 2;
    iceRocks.push({ x: side * (foreground ? 5.6 + random(seed) : 3 + random(seed) * 5),
      y: section * HEIGHT - 6 + random(seed + 1) * 16, z: foreground ? 2.4 : -7 - random(seed + 3) * 14,
      radius: foreground ? 1.5 + random(seed + 4) * 0.8 : 0.5 + random(seed + 4) * 1.5,
      variant: seed % 6, angle: random(seed + 2) * Math.PI * 2, solid: false });
  }
}
export const iceSolids = iceRocks.filter((rock) => rock.solid);
export const iceWrecks = [
  { x: -5.2, y: 25, z: -4, angle: 0.27, kind: 0 }, { x: 5.4, y: 62, z: -3, angle: -0.45, kind: 1 },
  { x: -5.5, y: 69, z: -5, angle: 0.4, kind: 2 }, { x: 5.1, y: 103, z: -4, angle: 0.16, kind: 0 },
  { x: -6.2, y: 139, z: -5, angle: -0.25, kind: 1 }, { x: 6.1, y: 145, z: -6, angle: 0.32, kind: 2 },
] as const;
export function iceScroll(progress: number) { return Math.max(0, Math.min(1, progress)) * ICE_TRAVEL; }
export function iceSection(progress: number) { return iceSections[Math.min(9, Math.floor(Math.max(0, progress) * 10))]; }
