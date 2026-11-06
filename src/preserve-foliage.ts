import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { preserveBatch, preserveFrond, preserveLimb, preservePart } from './preserve-geometry';
import { PRESERVE_BAY, PRESERVE_END, PRESERVE_PITCH, PRESERVE_START, PRESERVE_WIDTH_SCALE, preserveGround, preserveRandom } from './preserve-layout';
import type { PreserveMaterials } from './preserve-materials';

export type PreserveWake = { x: number; y: number; strength: number };
const FRONDS_PER_CROWN = 6;

type Crown = { x: number; y: number; z: number; angle: number; length: number; seed: number; bendX: number; bendY: number };

export function createPreserveFoliage(materials: PreserveMaterials) {
  const root = new T.Group(); root.name = 'preserve-root-gardens';
  const frondGeometry = preserveFrond(), crowns: Crown[] = [];
  const batches: { mesh: T.InstancedMesh; crowns: Crown[]; }[] = [];
  const transform = new T.Object3D(), tint = new T.Color();
  const rootPaths: T.Vector3[][] = [];
  for (let start = PRESERVE_START; start < PRESERVE_END; start += PRESERVE_BAY) {
    const random = preserveRandom(start + 1812), limbs: T.BufferGeometry[] = [], local: Crown[] = [];
    function crown(x: number, y: number, z: number, length: number, angle: number) {
      const c = { x, y, z, angle, length, seed: random() * Math.PI * 2, bendX: 0, bendY: 0 };
      local.push(c); crowns.push(c);
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const x = side * (2.9 + random() * .35), y = start + .9 + i * 4.2 + random() * .8;
        const z = preserveGround(x, y), tall = i === 0 && Math.abs(start) % 16 === 0;
        const height = tall ? 2.85 : 1.25 + random() * .5, radius = tall ? .46 : .20 + random() * .07;
        const top = new T.Vector3(x + side * .12, y + .1, z + height);
        const trunk = [new T.Vector3(x, y, z - .18), new T.Vector3(x - side * .18, y - .05, z + height * .45), top];
        limbs.push(preserveLimb(trunk, radius, radius * .55, y));
        // Buttress roots spread from the buried trunk and conform to the soil.
        for (let j = 0; j < 6; j++) {
          const angle = j / 6 * Math.PI * 2 + random() * .5, length = .8 + random() * 1.15, path = [];
          for (let k = 0; k <= 5; k++) {
            const t = k / 5, rx = T.MathUtils.clamp(x + Math.cos(angle) * length * t, -3.48, 3.48);
            const ry = y + Math.sin(angle) * length * t + Math.sin(t * Math.PI) * .13;
            path.push(new T.Vector3(rx, ry, preserveGround(rx, ry) + .045 + (1 - t) ** 2 * .28));
          }
          rootPaths.push(path); limbs.push(preserveLimb(path, radius * .78, .018, j + y));
        }
        for (let j = 0; j < 3; j++) {
          const angle = j / 3 * Math.PI * 2 + random(), length = .55 + random() * .5;
          const tip = top.clone().add(new T.Vector3(Math.cos(angle) * length, Math.sin(angle) * length, -.06 + random() * .2));
          tip.x = T.MathUtils.clamp(tip.x, -3.9, 3.9);
          limbs.push(preserveLimb([top.clone().add(new T.Vector3(0, 0, -.36)), top.clone().lerp(tip, .6).add(new T.Vector3(0, 0, .16)), tip], radius * .48, .025, j));
          crown(tip.x, tip.y, tip.z, .9 + random() * .4, angle);
        }
        crown(top.x, top.y, top.z, 1.1 + random() * .3, random() * Math.PI);
      }
      // Understory clusters vary in scale and leave stretches of visible walkway.
      for (let i = 0; i < 6; i++) {
        const x = side * (2.12 + random() * 1.38), y = start + random() * 8;
        crown(x, y, preserveGround(x, y) + .08, .52 + random() * .53, random() * Math.PI * 2);
      }
      // A rooted vine snakes over the retaining lip, then along the rail.
      const y = start + 3.1, x = side * 3.3;
      limbs.push(preserveLimb([
        new T.Vector3(x, y, preserveGround(x, y)), new T.Vector3(side * 3.6, y + .4, -2.93),
        new T.Vector3(side * 3.71, y + 1.1, -2.8), new T.Vector3(side * 3.65, y + 2.0, -2.9),
      ], .075, .022, start));
      // Small, individually curved leaves soften the vine/engineering junction.
      crown(side * 3.66, y + .8, -2.83, .45, side * 1.4);
    }
    // One fallen trunk lies diagonally on a bank; the center flight plane is clear.
    if (start === 8) {
      const points = [[-3.45, start + 1], [-2.6, start + 2], [-1.7, start + 3.4]].map(([x, y]) => new T.Vector3(x, y, preserveGround(x, y) + .15));
      limbs.push(preserveLimb(points, .24, .18, 41));
    }
    const geometry = mergeGeometries(limbs), wood = new T.Mesh(geometry, materials.bark);
    limbs.forEach(g => g.dispose()); wood.name = 'rooted-trunks-and-buttresses'; wood.castShadow = wood.receiveShadow = true;
    root.add(wood);
    const fronds = new T.InstancedMesh(frondGeometry, materials.foliage, local.length * FRONDS_PER_CROWN);
    fronds.name = 'fern-crowns'; fronds.instanceMatrix.setUsage(T.DynamicDrawUsage);
    fronds.castShadow = fronds.receiveShadow = true;
    for (let i = 0; i < fronds.count; i++) {
      const c = local[Math.floor(i / FRONDS_PER_CROWN)], j = i % FRONDS_PER_CROWN;
      transform.position.set(c.x, c.y, c.z);
      transform.rotation.set(.05 * Math.sin(j), .05 * Math.cos(j), c.angle + j * Math.PI * 2 / FRONDS_PER_CROWN);
      transform.scale.set(c.length * (.88 + .12 * Math.sin(j * 5)), c.length, c.length);
      transform.updateMatrix(); fronds.setMatrixAt(i, transform.matrix);
      tint.setHex([0x689247, 0x7d9c4d, 0x41693d, 0x597f38, 0x8a9b51][i % 5]);
      fronds.setColorAt(i, tint);
    }
    fronds.computeBoundingSphere(); fronds.boundingSphere!.radius += .7;
    batches.push({ mesh: fronds, crowns: local }); root.add(fronds);
    // Leaf litter and mossy broken soil are actual small silhouettes, not cards.
    const litter = [];
    for (let i = 0; i < 55; i++) {
      const x = (random() - .5) * 6.7, y = start + random() * 8;
      litter.push(preservePart(x, y, preserveGround(x, y) + .028, .06 + random() * .08, .12 + random() * .12, .04,
        i % 3 === 0 ? 0x8e713d : 0x677744, random() * Math.PI * 2));
    }
    const leaves = preserveBatch('fallen-leaf-litter', new T.OctahedronGeometry(1), materials.rock, litter);
    leaves.castShadow = false; root.add(leaves);
  }
  return {
    root, rootPaths, crowns,
    update(time: number, scroll: number, exit: number, elapsed: number, actors: readonly PreserveWake[], reset = false) {
      const pitch = PRESERVE_PITCH * (1 - exit), cos = Math.cos(pitch), sin = Math.sin(pitch);
      for (const { mesh, crowns } of batches) {
        let index = 0;
        for (const c of crowns) {
          let dx = 0, dy = 0;
          for (const actor of actors) {
            const x = c.x * PRESERVE_WIDTH_SCALE - actor.x, y = (c.y - scroll) * cos + c.z * sin - actor.y;
            const distance = Math.hypot(x, y);
            const force = (1 - T.MathUtils.smoothstep(distance, .35, 2)) * actor.strength / Math.max(.3, distance);
            dx += x * force; dy += y * force;
          }
          const limit = Math.max(1, Math.hypot(dx, dy));
          if (reset) c.bendX = c.bendY = 0;
          c.bendX = T.MathUtils.damp(c.bendX, dx / limit, 7, elapsed);
          c.bendY = T.MathUtils.damp(c.bendY, dy / limit, 7, elapsed);
          const wind = Math.sin(time * 1.3 + c.seed) * .025 + Math.sin(time * 2.1 + c.y) * .015;
          for (let j = 0; j < FRONDS_PER_CROWN; j++) {
            const angle = c.angle + j * Math.PI * 2 / FRONDS_PER_CROWN;
            const turn = -c.bendX * Math.cos(angle) - c.bendY * Math.sin(angle);
            transform.position.set(c.x, c.y, c.z);
            transform.rotation.set(.05 * Math.sin(j) + wind, .05 * Math.cos(j) + wind,
              angle + turn * .46);
            transform.scale.set(c.length * (.88 + .12 * Math.sin(j * 5)), c.length * (1 - .1 * Math.hypot(c.bendX, c.bendY)), c.length);
            transform.updateMatrix(); mesh.setMatrixAt(index++, transform.matrix);
          }
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}
