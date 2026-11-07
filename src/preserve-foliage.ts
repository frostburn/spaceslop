import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { preserveBatch, preserveFrond, preserveLimb, preservePart } from './preserve-geometry';
import { PRESERVE_BAY, PRESERVE_END, PRESERVE_START, PRESERVE_WIDTH_SCALE, preserveFrame, preserveGround, preserveRandom, preserveHabitat, preserveWater } from './preserve-layout';
import { preserveCycadFrond } from './preserve-botany';
import type { PreserveMaterials } from './preserve-materials';

export type PreserveWake = { x: number; y: number; strength: number };
const FRONDS_PER_CROWN = 6;

type Crown = { kind: 'fern' | 'cycad' | 'fan'; x: number; y: number; z: number; angle: number; length: number; seed: number; bendX: number; bendY: number };

export function createPreserveFoliage(materials: PreserveMaterials) {
  const root = new T.Group(); root.name = 'preserve-root-gardens';
  const frondGeometry = {fern:preserveFrond(),cycad:preserveCycadFrond(),fan:preserveCycadFrond(true)}, crowns: Crown[] = [];
  const batches: { mesh: T.InstancedMesh; crowns: Crown[]; start: number; }[] = [];
  const transform = new T.Object3D(), tint = new T.Color();
  const rootPaths: T.Vector3[][] = [];
  for (let start = PRESERVE_START; start < PRESERVE_END; start += PRESERVE_BAY) {
    const random = preserveRandom(start + 1812), limbs: T.BufferGeometry[] = [], local: Crown[] = [];
    const habitat = preserveHabitat(start + 4);
    function crown(x: number, y: number, z: number, length: number, angle: number, kind: Crown['kind'] = 'fern') {
      const c = { kind, x, y, z, angle, length, seed: random() * Math.PI * 2, bendX: 0, bendY: 0 };
      local.push(c); crowns.push(c);
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        if (habitat.nest > .5 && (i === 1 || side > 0)) continue;
        const kind: Crown['kind'] = habitat.dry > .55 ? (i === 0 ? 'cycad' : 'fan') : 'fern';
        let x = side * (habitat.wet > .5 ? 2.0 + random() * 1.2 : 2.65 + random() * .65), y = start + .6 + i * 3.8 + random() * 2;
        if (habitat.wet > .5) { const w=preserveWater(y); if(Math.abs(x-w.x)<w.width+.4)x=T.MathUtils.clamp(w.x+side*(w.width+.4),-3.3,3.3); }
        const z = preserveGround(x, y), tall = i === 0 && Math.abs(start) % 16 === 0;
        const height = kind === 'cycad' ? .45 + random() * .35 : kind === 'fan' ? 2.2 : habitat.wet > .5 ? 2 + random() * .75 : tall ? 2.85 : 1.25 + random() * .5;
        const radius = kind === 'cycad' ? .25 : height > 2 ? .38 : .20 + random() * .07;
        const top = new T.Vector3(x + side * .12, y + .1, z + height);
        const trunk = [new T.Vector3(x, y, z - .18), new T.Vector3(x - side * .18, y - .05, z + height * .45), top];
        limbs.push(preserveLimb(trunk, radius, radius * .55, y));
        // Buttress roots spread from the buried trunk and conform to the soil.
        for (let j = 0; j < 4; j++) {
          const angle = j / 4 * Math.PI * 2 + random() * .9, length = .8 + random() * 1.15, path = [];
          for (let k = 0; k <= 5; k++) {
            const t = k / 5, rx = T.MathUtils.clamp(x + Math.cos(angle) * length * t, -3.48, 3.48);
            const ry = y + Math.sin(angle) * length * t + Math.sin(t * Math.PI) * .13;
            path.push(new T.Vector3(rx, ry, preserveGround(rx, ry) + .045 + (1 - t) ** 2 * .18));
          }
          rootPaths.push(path); limbs.push(preserveLimb(path, radius * .6, .018, j + y));
        }
        for (let j = 0; j < (kind === 'cycad' ? 0 : 3); j++) {
          const angle = j / 3 * Math.PI * 2 + random(), length = .55 + random() * .5;
          const tip = top.clone().add(new T.Vector3(Math.cos(angle) * length, Math.sin(angle) * length, -.06 + random() * .2));
          tip.x = T.MathUtils.clamp(tip.x, -3.9, 3.9);
          limbs.push(preserveLimb([top.clone().add(new T.Vector3(0, 0, -.36)), top.clone().lerp(tip, .6).add(new T.Vector3(0, 0, .16)), tip], radius * .48, .025, j));
          crown(tip.x, tip.y, tip.z, .9 + random() * .4, angle, kind);
        }
        crown(top.x, top.y, top.z, (kind === 'cycad' ? 1.5 : 1.1) + random() * .3, random() * Math.PI, kind);
      }
      // Understory clusters vary in scale and leave stretches of visible walkway.
      for (let i = 0; i < (habitat.nest > .5 ? 3 : habitat.dry > .5 ? 2 : 4); i++) {
        const x = side * (1.8 + random() * 1.7), y = start + random() * 8;
        if(habitat.wet>.5&&preserveGround(x,y)<preserveWater(y).z+.12)continue;
        crown(x, y, preserveGround(x, y) + .08, .52 + random() * .53, random() * Math.PI * 2, habitat.dry > .5 && i % 2 === 0 ? 'cycad' : 'fern');
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
    if (start === 56 || start === 80 || start === 112) {
      const points = [[-3.45, start + 1], [-2.6, start + 2], [start === 56 ? 2.1 : -1.7, start + 3.4]].map(([x, y]) => new T.Vector3(x, y, preserveGround(x, y) + .35));
      limbs.push(preserveLimb(points, .42, .26, 41));
    }
    const geometry = mergeGeometries(limbs), wood = new T.Mesh(geometry, materials.bark);
    limbs.forEach(g => g.dispose()); wood.name = 'rooted-trunks-and-buttresses'; wood.castShadow = wood.receiveShadow = true;
    root.add(wood);
    for (const kind of ['fern','cycad','fan'] as const) {
    const plants = local.filter(c => c.kind === kind); if (!plants.length) continue;
    const fronds = new T.InstancedMesh(frondGeometry[kind], materials.foliage, plants.length * FRONDS_PER_CROWN);
    fronds.name = kind === 'fern' ? 'fern-crowns' : kind === 'cycad' ? 'cycad-crowns' : 'fan-leaf-crowns'; fronds.instanceMatrix.setUsage(T.DynamicDrawUsage);
    fronds.castShadow = fronds.receiveShadow = true;
    for (let i = 0; i < fronds.count; i++) {
      const c = plants[Math.floor(i / FRONDS_PER_CROWN)], j = i % FRONDS_PER_CROWN;
      transform.position.set(c.x, c.y, c.z);
      transform.rotation.set(.05 * Math.sin(j), .05 * Math.cos(j), c.angle + j * Math.PI * 2 / FRONDS_PER_CROWN);
      transform.scale.set(c.length * (.88 + .12 * Math.sin(j * 5)), c.length, c.length);
      transform.updateMatrix(); fronds.setMatrixAt(i, transform.matrix);
      tint.setHex(kind === 'fan' ? [0x9c9e4c,0xb5a65b,0x718249][i%3] : kind === 'cycad' ? [0x69814a,0x4c713e,0x849052][i%3] : [0x689247, 0x7d9c4d, 0x41693d, 0x597f38, 0x8a9b51][i % 5]);
      fronds.setColorAt(i, tint);
    }
    fronds.computeBoundingSphere(); fronds.boundingSphere!.radius += .7;
    batches.push({ mesh: fronds, crowns: plants, start }); root.add(fronds);
    }
    // Leaf litter and mossy broken soil are actual small silhouettes, not cards.
    const litter = [];
    for (let i = 0; i < 55; i++) {
      const x = (random() - .5) * 6.7, y = start + random() * 8;
      litter.push(preservePart(x, y, preserveGround(x, y) + .028, .06 + random() * .08, .12 + random() * .12, .04,
        habitat.dry > .5 ? 0xb19552 : i % 3 === 0 ? 0x8e713d : 0x677744, random() * Math.PI * 2));
    }
    const leaf = new T.OctahedronGeometry(1);
    leaf.setAttribute('color',new T.Float32BufferAttribute(Array(leaf.attributes.position.count*3).fill(1),3));
    const leaves = preserveBatch('fallen-leaf-litter', leaf, materials.foliage, litter);
    leaves.castShadow = false; root.add(leaves);
  }
  return {
    root, rootPaths, crowns,
    update(time: number, scroll: number, exit: number, elapsed: number, actors: readonly PreserveWake[], reset = false) {
      const { pitch, height } = preserveFrame(exit), cos = Math.cos(pitch), sin = Math.sin(pitch);
      for (const { mesh, crowns, start } of batches) {
        if (!reset && Math.abs(start + 4 - scroll) > 28) continue;
        let index = 0;
        for (const c of crowns) {
          let dx = 0, dy = 0;
          for (const actor of actors) {
            const x = c.x * PRESERVE_WIDTH_SCALE - actor.x, y = (c.y - scroll) * cos + (c.z - height) * sin - actor.y;
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
