import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { iceTravel } from './ice-layout';

type Industry = { x: number; y: number; z: number; kind: number; scale: number; angle: number; loop?: boolean };
export const iceIndustry: Industry[] = [];
for (let section = 2; section < 10; section++) {
  const count = Math.min(5, section - 1);
  for (let i = 0; i < count; i++) iceIndustry.push({ x: (i % 2 ? -1 : 1) * (6.1 + i % 3 * 0.6),
    y: section * 16 + i * 13 / count - 4, z: -3 - i % 3,
    kind: section < 5 ? i % 2 : i % 4, scale: 0.8 + section * 0.045, angle: (i % 3 - 1) * 0.13 });
}
// The inner refinery belt continues beyond the stage's final screen during pursuit.
for (let i = 0; i < 10; i++) iceIndustry.push({ x: (i % 2 ? -1 : 1) * (6.8 + i % 3 * 0.5),
  y: 160 + i * 12.8, z: -3 - i % 3, kind: i % 4, scale: 1.1, angle: (i % 3 - 1) * 0.1, loop: true });
export function industryY(recipe: Industry, time: number) {
  const y = recipe.y - iceTravel(time);
  return recipe.loop ? iceTravel(time) < recipe.y - 96 ? 1000 : ((y + 24) % 128 + 128) % 128 - 24 : y;
}
export function industrialGeometry(kind: number) {
  const pieces: T.BufferGeometry[] = [];
  const box = (x: number, y: number, z: number, w: number, h: number, d: number) =>
    pieces.push(new T.BoxGeometry(w, h, d).translate(x, y, z));
  const pipe = (x: number, y: number, z: number, r: number, h: number) =>
    pieces.push(new T.CylinderGeometry(r, r, h, 12).translate(x, y, z));
  if (kind === 0) {
    for (const x of [-0.9, 0.9]) box(x, 0, 0, .13, 5.6, .18);
    for (let i = 0; i < 7; i++) box(0, i * .8 - 2.4, 0, 1.9, .1, .16);
    box(0, 0, -.12, 1.5, 3.5, .1);
  } else if (kind === 1) {
    box(0, 0, 0, 2.4, 4.8, .3);
    for (let i = 0; i < 4; i++) for (const x of [-.55, .55]) box(x, i * 1.1 - 1.6, .4, .9, .9, .55);
    for (const x of [-1.3, 1.3]) box(x, 0, .2, .1, 5.4, .2);
  } else if (kind === 2) {
    box(0, 0, 0, 2.6, 5.3, .22);
    for (const x of [-.65, .65]) pipe(x, 0, .55, .48, 3.9);
    for (const y of [-1.6, 1.6]) box(0, y, 1.0, 2.3, .14, .18);
    for (const x of [-1.2, 1.2]) pipe(x, 0, .45, .08, 5.5);
  } else {
    for (const x of [-1.2, 1.2]) box(x, 0, 0, .28, 6.5, .32);
    for (const y of [-2.8, 2.8]) box(0, y, .3, 2.8, .3, .45);
    box(.8, 0, 1, .4, 5, 2);
    for (let i = 0; i < 5; i++) box(-.2, i * 1.1 - 2.2, .7, 1.4, .12, .2);
  }
  return mergeGeometries(pieces);
}
