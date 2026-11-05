import { Euler, Quaternion, Vector3 } from 'three';
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

// Constant angular velocities model residual spin; all motion is sampled from flight time.
// Built-on outcrops alone keep a fixed orientation relative to the lane.
export const iceMotions = iceRocks.map((rock, i) => {
  const z = random(i * 7 + 101) * 2 - 1, azimuth = random(i * 7 + 103) * Math.PI * 2;
  const radial = Math.sqrt(1 - z * z);
  return { axis: new Vector3(radial * Math.cos(azimuth), radial * Math.sin(azimuth), z),
    rate: rock.solid ? 0 : 0.07 + random(i * 7 + 107) * 0.11,
    initial: new Quaternion().setFromEuler(new Euler(rock.solid ? 0 : random(i * 7 + 109) * Math.PI * 2,
      rock.solid ? 0 : random(i * 7 + 113) * Math.PI * 2, rock.angle)) };
});
export function iceOrientation(index: number, time: number, out: Quaternion) {
  const motion = iceMotions[index];
  return out.setFromAxisAngle(motion.axis, Math.max(0, time) * motion.rate).multiply(motion.initial);
}
export function iceTravel(time: number) { return Math.max(0, time) * ICE_TRAVEL / ICE_DURATION; }
export function iceRockY(index: number, time: number) {
  const rock = iceRocks[index], y = rock.y - iceTravel(time);
  // Only decorative rocks recycle, beyond the visible region. Solid stations pass once.
  const length = ICE_SCREENS * HEIGHT;
  return rock.solid ? y : ((y + 24) % length + length) % length - 24;
}

export const ICE_SHIP_Y = -5.3;
// This forward axis joins the default ship position to the interceptor's center.
export const ICE_CORRIDOR_PITCH = Math.atan2(12, 4.2 - ICE_SHIP_Y);
export function iceCrossSection(index: number) { return (random(index * 13 + 211) * 2 - 1) * 3.8; }
export function iceCorridorPoint(point: Vector3, reveal: number, out: Vector3) {
  const angle = -ICE_CORRIDOR_PITCH * Math.max(0, Math.min(1, reveal));
  const y = point.y - ICE_SHIP_Y;
  return out.set(point.x, ICE_SHIP_Y + Math.cos(angle) * y - Math.sin(angle) * point.z,
    Math.sin(angle) * y + Math.cos(angle) * point.z);
}
