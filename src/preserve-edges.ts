import * as T from 'three';

export const PRESERVE_LOOP = 24;

type Vertex = [x: number, y: number, z: number];

function fernFrond() {
  const positions: number[] = [];
  const colors: number[] = [];
  function triangle(a: Vertex, b: Vertex, c: Vertex, shades: [number, number, number]) {
    positions.push(...a, ...b, ...c);
    for (const shade of shades) colors.push(shade, shade, shade);
  }

  function stemAt(t: number): Vertex {
    return [0.17 * t * t, t, 0.16 * Math.sin(t * Math.PI) + 0.045 * t];
  }

  function stemEdge(t: number, side: number): Vertex {
    const [x, y, z] = stemAt(t);
    return [x + side * (0.009 * (1 - t) + 0.0015), y, z];
  }

  const stemSegments = 14;
  for (let i = 0; i < stemSegments; i++) {
    const t = i / stemSegments;
    const next = (i + 1) / stemSegments;
    const a = stemEdge(t, -1);
    const b = stemEdge(t, 1);
    const c = stemEdge(next, 1);
    const d = stemEdge(next, -1);
    triangle(a, b, c, [0.66, 0.85, 0.92]);
    triangle(a, c, d, [0.66, 0.92, 0.74]);
  }

  // Each leaflet has a raised midrib, a swept tip, and two shaded surfaces.
  for (let i = 0; i < 10; i++) {
    for (const side of [-1, 1]) {
      const t = 0.095 + i * 0.083 + (side > 0 ? 0.019 : 0);
      const spread = Math.sin(Math.PI * (t + 0.04));
      const base = stemAt(t);
      const dx = side * (0.026 + 0.236 * spread);
      const dy = 0.055 + 0.068 * spread;
      const length = Math.hypot(dx, dy);
      const width = 0.016 + 0.028 * spread;
      const acrossX = -dy / length * width;
      const acrossY = dx / length * width;
      const [x, y, z] = base;
      const ridge: Vertex = [x + dx * 0.44, y + dy * 0.44, z + 0.022 * spread];
      const upper: Vertex = [x + dx * 0.39 + acrossX, y + dy * 0.39 + acrossY, z - 0.012 * spread];
      const lower: Vertex = [x + dx * 0.39 - acrossX, y + dy * 0.39 - acrossY, z - 0.014 * spread];
      const tip: Vertex = [x + dx, y + dy, z - 0.04 * spread];
      triangle(base, upper, ridge, [0.55, 0.78, 1]);
      triangle(upper, tip, ridge, [0.78, 0.83, 1]);
      triangle(base, ridge, lower, [0.55, 1, 0.56]);
      triangle(ridge, tip, lower, [1, 0.83, 0.56]);
    }
  }

  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  return geometry;
}

function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function createPreserveEdges() {
  const group = new T.Group();
  const railGeometry = new T.BoxGeometry(0.095, 3 * PRESERVE_LOOP, 0.08);
  const railMaterial = new T.MeshBasicMaterial({ color: 0x21262c });
  for (const side of [-1, 1]) {
    const rail = new T.Mesh(railGeometry, railMaterial);
    rail.position.set(side * 4.18, PRESERVE_LOOP / 2, -1.4);
    group.add(rail);
  }

  const crownsPerSide = 8;
  const frondsPerCrown = 5;
  const tiles = [-1, 0, 1];
  const crownCount = 2 * crownsPerSide * tiles.length;
  const braces = new T.InstancedMesh(
    new T.BoxGeometry(1.11, 0.23, 0.12), new T.MeshBasicMaterial(), crownCount,
  );
  const fronds = new T.InstancedMesh(
    fernFrond(), new T.MeshBasicMaterial({ vertexColors: true, side: T.DoubleSide }), crownCount * frondsPerCrown,
  );
  const transform = new T.Object3D();
  const moss = [0x4e7448, 0x5d7944, 0x41654e, 0x6b8050].map((color) => new T.Color(color));
  const braceColors = [new T.Color(0x342827), new T.Color(0x252d33)];
  const random = seededRandom(316);
  let braceIndex = 0;
  let fernIndex = 0;

  for (const side of [-1, 1]) {
    for (let i = 0; i < crownsPerSide; i++) {
      const y = (i + random() * 0.66 + (side > 0 ? 0.28 : 0)) * PRESERVE_LOOP / crownsPerSide;
      const x = side * (4.58 + random() * 0.18);
      const fan = Array.from({ length: frondsPerCrown }, (_, j) => ({
        angle: side * (0.49 + 0.44 * j + (random() - 0.5) * 0.37),
        length: 0.84 + random() * 0.58,
        spread: 0.8 + random() * 0.2,
        color: moss[Math.floor(random() * moss.length)],
      }));
      for (const tile of tiles) {
        const tileY = y + tile * PRESERVE_LOOP;
        transform.position.set(side * 4.46, tileY - 0.34, -1.5);
        transform.rotation.set(0, 0, side * 0.14);
        transform.scale.set(1, 1, 1);
        transform.updateMatrix();
        braces.setMatrixAt(braceIndex, transform.matrix);
        braces.setColorAt(braceIndex++, braceColors[i % 2]);
        for (const [j, frond] of fan.entries()) {
          transform.position.set(x, tileY, -1.24 + j * 0.035);
          transform.rotation.z = frond.angle;
          transform.scale.set(frond.length * frond.spread, frond.length, 1);
          transform.updateMatrix();
          fronds.setMatrixAt(fernIndex, transform.matrix);
          fronds.setColorAt(fernIndex++, frond.color);
        }
      }
    }
  }

  group.add(braces, fronds);
  return group;
}
