import * as T from 'three';
import { preserveBatch, preserveBeam, preserveFrond, preserveLimb, preservePart, type PreservePart } from './preserve-geometry';
import { PRESERVE_ARENA_Y, preserveNoise, preserveRandom } from './preserve-layout';
import { GROUNDSKEEPER_FLOOR } from './groundskeeper';
import type { PreserveMaterials } from './preserve-materials';
import { mergeGkFixed } from './groundskeeper-geometry';

export function createPreserveArena(m: PreserveMaterials) {
  const root = new T.Group(); root.name = 'observation-rotunda'; root.position.y = PRESERVE_ARENA_Y;
  const parts: PreservePart[] = [], lamps: PreservePart[] = [], glass: PreservePart[] = [];
  const box = new T.BoxGeometry(), random = preserveRandom(7493);
  const beam = (a: T.Vector3, b: T.Vector3, width: number, depth: number, color: number) => parts.push(preserveBeam(a, b, width, depth, color));
  const ellipse = (a: number, radius: number, z: number) => new T.Vector3(Math.sin(a) * radius, Math.cos(a) * radius * 1.1, z);
  // A structural floor beneath the flyable apron, and a genuinely raised soil bed.
  const apron = m.metal.clone(); apron.color.setHex(0x697365);
  const floor = new T.Mesh(new T.CircleGeometry(11.2, 80), apron); floor.position.z = -4.45; floor.scale.y = 1.1; floor.receiveShadow = true; root.add(floor);
  const wall = new T.Mesh(new T.CylinderGeometry(6.3, 6.5, 1.55, 64, 1, true), apron);
  wall.rotation.x = Math.PI / 2; wall.scale.z = 1.05; wall.position.z = GROUNDSKEEPER_FLOOR - .8; wall.receiveShadow = wall.castShadow = true; root.add(wall);
  const soil = new T.CircleGeometry(6.3, 80, 0, Math.PI * 2), pos = soil.attributes.position, colors = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i); pos.setXYZ(i, x, y * 1.05, GROUNDSKEEPER_FLOOR - .06 + preserveNoise(x, y) * .08);
    const c = new T.Color(0x7c7751).lerp(new T.Color(0x536337), preserveNoise(x * .6, y * .6)); colors.push(c.r, c.g, c.b);
  }
  soil.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); soil.computeVertexNormals();
  const bed = new T.Mesh(soil, m.soil); bed.receiveShadow = true; bed.name = 'nesting-bed'; root.add(bed);
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * Math.PI * 2, b = (i + 1) / 72 * Math.PI * 2;
    beam(ellipse(a, 6.34, GROUNDSKEEPER_FLOOR + .03), ellipse(b, 6.34, GROUNDSKEEPER_FLOOR + .03), .16, .14, 0x8c8e72);
    // Individual worn apron plates make the floor's scale legible.
    const p = ellipse(a, 8.0, -4.37), q = preservePart(p.x, p.y, p.z, 1.45, 1.1, .12, i % 4 ? 0x5e665b : 0x868575, -a);
    parts.push(q);
    if (i % 6 === 0) {
      const l = ellipse(a, 6.45, -3.65); lamps.push(preservePart(l.x, l.y, l.z, .55, .12, .19, 0xffd7a0, -a));
    }
  }
  for (let i = 0; i < 32; i++) {
    const a = i / 32 * Math.PI * 2, b = (i + 1) / 32 * Math.PI * 2;
    // Preserve an open corridor entrance on the near side.
    if (Math.cos(a) < -.84) continue;
    for (const z of [-4.15, -2.7, 3.3, 9.4]) beam(ellipse(a, 10, z), ellipse(b, 10, z), z > 0 ? .12 : .18, .14, 0x727c68);
    if (i % 2 === 0) {
      const p = ellipse(a, 10, -4.1), q = ellipse(a, 10, 8.8 + random());
      beam(p, q, .19, .2, 0x8e957c);
      beam(ellipse(a, 10, 9.1), ellipse(a, 6.3 + random() * 1.5, 13.4), .16, .18, 0x9a9d83);
    }
    for (const r of [8.9, 10.0]) {
      beam(ellipse(a, r, .6), ellipse(b, r, .6), .075, .075, 0x9b9876);
      beam(ellipse(a, r, -.1), ellipse(b, r, -.1), .04, .04, 0x7b8267);
      beam(ellipse(a, r, -1.0), ellipse(a, r, .6), .055, .055, 0x9d9a75);
    }
    const deck = ellipse((a + b) / 2, 9.45, -1.05);
    parts.push(preservePart(deck.x, deck.y, deck.z, 1.04, 2.05, .16, 0x727b63, -(a + b) / 2));
    if (i % 5 === 0) {
      const pane = ellipse(a + .05, 9.97, 6.1);
      const p = preservePart(pane.x, pane.y, pane.z, 1.35, .025, 4.6, 0x9fb9a1, -a); glass.push(p);
    }
  }
  root.add(preserveBatch('rotunda-ribs-and-catwalks', box, m.metal, parts), preserveBatch('rotunda-warm-lamps', box, m.lamp, lamps));
  const panes = preserveBatch('rotunda-surviving-glass', box, m.glass, glass); panes.castShadow = false; root.add(panes);
  // Ferns are rooted in the bed; the center and the visible feet stay clear.
  const fronds = [], rocks = [];
  for (let i = 0; i < 32; i++) {
    const a = random() * Math.PI * 2, r = 4.1 + random() * 1.8, x = Math.cos(a) * r, y = Math.sin(a) * r;
    rocks.push(preservePart(x, y, GROUNDSKEEPER_FLOOR, .3 + random() * .4, .4 + random() * .4, .3, 0x838773, a));
    for (let j = 0; j < 6; j++) fronds.push(preservePart(x, y, GROUNDSKEEPER_FLOOR + .15, 1.1, 1.4, 1.1, 0x61803d, j * Math.PI / 3 + a));
  }
  root.add(preserveBatch('rotunda-ferns', preserveFrond(), m.foliage, fronds), preserveBatch('rotunda-rocks', new T.IcosahedronGeometry(1, 1), m.rock, rocks));
  const nest = new T.Group(); nest.name = 'nest-behind-groundskeeper'; root.add(nest);
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, radius = 1.8 + random() * .5, y = 3.2;
    const points = [a - .65, a, a + .65].map((t, j) => new T.Vector3(Math.cos(t) * radius, y + Math.sin(t) * radius, GROUNDSKEEPER_FLOOR + .1 + (j === 1 ? .3 : .08) + random() * .15));
    nest.add(new T.Mesh(preserveLimb(points, .07, .04, i), m.bark));
  }
  const eggs = new T.MeshStandardMaterial({ color: 0xb5ae8b, map: m.rock.map, roughness: .88 });
  for (const [x, y] of [[-.55, 3.1], [.6, 3.6], [0, 4.1]]) {
    const egg = new T.Mesh(new T.SphereGeometry(.7, 20, 16), eggs); egg.position.set(x, y, GROUNDSKEEPER_FLOOR + .6); egg.scale.set(.8, .8, 1.1); nest.add(egg);
  }
  mergeGkFixed(nest);
  return { root };
}
