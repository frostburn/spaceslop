import { levels } from '../levels';

export const DEN_DURATION = levels.den.duration;
export const DEN_SCREENS = 10;
export const DEN_APPROACH = 7;

const speed = (DEN_SCREENS - 1) / DEN_DURATION;

export function denScroll(time: number) {
  if (time <= DEN_DURATION) return Math.max(0, time) * speed;
  const u = Math.min(1, (time - DEN_DURATION) / DEN_APPROACH);
  // Continue across the shared grate at the route's scroll speed and ease
  // to rest after the gantry has filled the screen.
  const tangent = speed * DEN_APPROACH;
  return DEN_SCREENS - 1 + u * (tangent + u * (3 - 2 * tangent + u * (tangent - 2)));
}

export function denSection(time: number) {
  const names = ['Outer Docks', 'Workshops', 'Rookery', 'Bastion', 'Gantry Approach'];
  return names[Math.min(names.length - 1, Math.floor(Math.max(0, time) / (DEN_DURATION / names.length)))];
}
