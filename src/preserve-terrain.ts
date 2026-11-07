import * as T from 'three';
import { preserveBatch, preservePart } from './preserve-geometry';
import { PRESERVE_START, PRESERVE_END, PRESERVE_BAY, preserveChannel, preserveGround, preserveNoise, preservePools, preserveRandom, preserveHabitat } from './preserve-layout';
import { preserveRockGeometry } from './preserve-rocks';
import type { PreserveMaterials } from './preserve-materials';

export function createPreserveTerrain(materials: PreserveMaterials) {
  const root = new T.Group(); root.name = 'preserve-planting-bed';
  const clay = new T.Color(0x96846b), moss = new T.Color(0x648244), dark = new T.Color(0x536349), c = new T.Color();
  const cols = 48, rows = 40, n = new T.Vector3(), rock = preserveRockGeometry();
  const ochre = new T.Color(0xb9a386), wetStone = new T.Color(0x566657);
  for (let start = PRESERVE_START; start < PRESERVE_END; start += PRESERVE_BAY) {
    const positions: number[] = [], normals: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (let row = 0; row <= rows; row++) for (let col = 0; col <= cols; col++) {
      const by = start + row * PRESERVE_BAY / rows, bx = -3.5 + col * 7 / cols;
      const x = Math.fround(bx + (col === 0 || col === cols ? 0 : (preserveNoise(bx * 3, by * 2) - .5) * .09));
      // Boundary rows sample precisely the same coordinates and analytical normals.
      const y = Math.fround(by + (row === 0 || row === rows ? 0 : (preserveNoise(bx * 2 + 4, by * 3) - .5) * .1));
      const z = preserveGround(x, y);
      positions.push(x, y, z); uvs.push(x * 1.2, y * 1.2);
      n.set(preserveGround(x - .025, y) - preserveGround(x + .025, y), preserveGround(x, y - .025) - preserveGround(x, y + .025), .05).normalize();
      normals.push(n.x, n.y, n.z);
      const bank = T.MathUtils.smoothstep(Math.abs(x - preserveChannel(y)), 1.2, 2.65);
      c.copy(clay).lerp(moss, bank * (.3 + preserveNoise(x * .8, y * .7) * .7));
      const habitat = preserveHabitat(y);
      c.lerp(dark, preserveNoise(x * 3, y * 2) * .34).lerp(wetStone, habitat.wet * .68);
      c.lerp(ochre, habitat.dry * (.48 + .35 * T.MathUtils.smoothstep(-x, .5, 3))); colors.push(c.r, c.g, c.b);
    }
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const a = row * (cols + 1) + col, b = a + cols + 1;
      if ((row + col) % 2) indices.push(a, a + 1, b, a + 1, b + 1, b);
      else indices.push(a, a + 1, b + 1, a, b + 1, b);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    g.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
    g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2)); g.setIndex(indices);
    const ground = new T.Mesh(g, materials.soil); ground.name = 'preserve-soil-chunk'; ground.receiveShadow = true; root.add(ground);
    const r = preserveRandom(start + 515), parts = [];
    for (let i = 0; i < 37; i++) {
      const x = (i % 2 ? -1 : 1) * (1.65 + r() * 1.7), y = start + r() * PRESERVE_BAY;
      const scale = .13 + r() * .32;
      const h = preserveHabitat(y);
      parts.push(preservePart(x, y, preserveGround(x, y) - .04, scale * (1 + r()), scale * (.7 + r()), scale * .7, h.dry > .5 ? 0xc1ae8f : 0x9b9d85, r() * Math.PI));
    }
    // Clusters of bedded outcrops reinforce the high left-bank terraces and
    // wet ravine walls without intruding into the aerial combat plane.
    const habitat = preserveHabitat(start + 4);
    if (habitat.wet + habitat.dry > .3) for (let i = 0; i < 8; i++) {
      const side = habitat.dry > .5 ? -1 : i % 2 ? -1 : 1;
      const x = side * (2.1 + r() * 1.1), y = start + r() * 8;
      parts.push(preservePart(x, y, preserveGround(x, y) - .15, .5 + r() * .4, .65 + r() * .7,
        .25 + r() * .25, habitat.dry > .5 ? 0xc4b193 : 0x6d8073, r() * .5));
    }
    const rocks = preserveBatch('bank-rocks', rock, materials.rock, parts);
    root.add(rocks);
  }
  for (const pool of preservePools) {
    const points = Array.from({ length: 48 }, (_, i) => {
      const a = i / 48 * Math.PI * 2, r = 1 + Math.sin(a * 5) * .045;
      return new T.Vector2(pool.x + Math.cos(a) * pool.rx * r, pool.y + Math.sin(a) * pool.ry * r);
    });
    const g = new T.ShapeGeometry(new T.Shape(points)), p = g.attributes.position;
    // The water has a level surface inside a genuinely lowered soil basin.
    const z = pool.z;
    for (let i = 0; i < p.count; i++) p.setZ(i, z);
    const water = new T.Mesh(g, materials.water); water.name = 'irrigation-pool'; root.add(water);
  }
  return root;
}
