import * as T from 'three';
import { preserveBatch, preservePart } from './preserve-geometry';
import { PRESERVE_START, PRESERVE_END, PRESERVE_BAY, preserveChannel, preserveGround, preserveNoise, preservePools, preserveRandom } from './preserve-layout';
import type { PreserveMaterials } from './preserve-materials';

export function createPreserveTerrain(materials: PreserveMaterials) {
  const root = new T.Group(); root.name = 'preserve-planting-bed';
  const clay = new T.Color(0x96846b), moss = new T.Color(0x648244), dark = new T.Color(0x536349), c = new T.Color();
  const cols = 48, rows = 40, n = new T.Vector3();
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
      c.lerp(dark, preserveNoise(x * 3, y * 2) * .34); colors.push(c.r, c.g, c.b);
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
      const scale = .12 + r() * .34;
      parts.push(preservePart(x, y, preserveGround(x, y) - .04, scale * (1 + r()), scale * (.7 + r()), scale * .6, 0x9b9d85, r() * Math.PI));
    }
    const rock = new T.IcosahedronGeometry(1, 1), p = rock.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), s = .88 + preserveNoise(x * 3 + 8, y * 3 + z) * .2;
      p.setXYZ(i, x * s, y * s, z * s);
    }
    rock.computeVertexNormals(); root.add(preserveBatch('bank-rocks', rock, materials.rock, parts));
  }
  for (const pool of preservePools) {
    const points = Array.from({ length: 48 }, (_, i) => {
      const a = i / 48 * Math.PI * 2, r = 1 + Math.sin(a * 5) * .045;
      return new T.Vector2(pool.x + Math.cos(a) * pool.rx * r, pool.y + Math.sin(a) * pool.ry * r);
    });
    const g = new T.ShapeGeometry(new T.Shape(points)), p = g.attributes.position;
    // The water has a level surface inside a genuinely lowered soil basin.
    const z = preserveGround(pool.x, pool.y) + .38;
    for (let i = 0; i < p.count; i++) p.setZ(i, z);
    const water = new T.Mesh(g, materials.water); water.name = 'irrigation-pool'; root.add(water);
  }
  return root;
}
