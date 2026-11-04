import * as T from 'three';

export const PRESERVE_LOOP = 24;

type Vertex = [x: number, y: number, z: number];
type WakeActor = { x: number; y: number; strength: number };

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

function createTrench(tiles: number[], material: T.MeshBasicMaterial) {
  const placements: { x: number; y: number; z: number; width: number; height: number; angle: number; color: number }[] = [];
  function block(x: number, y: number, z: number, width: number, height: number, color: number, angle = 0) {
    placements.push({ x, y, z, width, height, angle, color });
  }

  const length = tiles.length * PRESERVE_LOOP;
  block(0, PRESERVE_LOOP / 2, -4.6, 9, length, 0x10131b);
  for (const side of [-1, 1]) {
    block(side * 2.81, PRESERVE_LOOP / 2, -4.38, 0.16, length, 0x202630);
    block(side * 3.17, PRESERVE_LOOP / 2, -3.48, 0.5, length, 0x22252d);
    block(side * 3.47, PRESERVE_LOOP / 2, -1.62, 0.09, length, 0x675047);
    block(side * 4.37, PRESERVE_LOOP / 2, -1.53, 0.11, length, 0x43373b);
  }

  for (const tile of tiles) {
    const offset = tile * PRESERVE_LOOP;
    for (const y of [3.6, 14.8]) {
      block(0, offset + y, -4.2, 6.44, 0.47, 0x252831, 0.11);
      block(0, offset + y + 0.34, -4.14, 6.44, 0.11, 0x35333a, 0.11);
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i++) {
        const y = offset + 1.5 + 3 * i;
        block(side * 4.08, y, -2.12, 1.19, 2.81, i % 2 ? 0x41363a : 0x30323b);
        block(side * 4.03, y + 0.14, -2.02, 0.87, 1.79, 0x1b2028);
        for (let slat = -4; slat <= 4; slat++) {
          block(side * 4.03, y + 0.14 + slat * 0.185, -1.95, 0.86, 0.025, 0x50464a);
        }
        for (const x of [3.69, 3.89, 4.09, 4.29]) {
          block(side * x, y + 0.14, -1.89, 0.023, 1.78, 0x3e3b43);
        }
        block(side * 4.11, y - 1.19, -1.84, 1.14, 0.18, 0x63443d);
        if (i % 3 === 1) {
          for (let stripe = 0; stripe < 4; stripe++) {
            block(side * (3.64 + stripe * 0.18), y - 1.19, -1.77, 0.09, 0.18, 0x8a703f, side * 0.42);
          }
        }
        if (i % 4 === 2) {
          block(side * 3.52, y + 1.05, -1.47, 0.05, 0.19, 0x92734a);
        }
      }
    }
  }

  const mesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 0.08), material, placements.length);
  mesh.renderOrder = -2;
  const transform = new T.Object3D();
  const tint = new T.Color();
  for (const [index, { x, y, z, width, height, angle, color }] of placements.entries()) {
    transform.position.set(x, y, z);
    transform.rotation.z = angle;
    transform.scale.set(width, height, 1);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
    mesh.setColorAt(index, tint.setHex(color));
  }
  return mesh;
}

export function createPreserveEdges() {
  const group = new T.Group();
  const crownsPerSide = 8;
  const frondsPerCrown = 5;
  const tiles = [-1, 0, 1];
  const structureMaterial = new T.MeshBasicMaterial({ transparent: true });
  const frondMaterial = new T.MeshBasicMaterial({
    vertexColors: true, side: T.DoubleSide, transparent: true, forceSinglePass: true,
  });
  const structure = createTrench(tiles, structureMaterial);
  const crownCount = 2 * crownsPerSide * tiles.length;
  const braces = new T.InstancedMesh(
    new T.BoxGeometry(1.11, 0.23, 0.12), structureMaterial, crownCount,
  );
  braces.renderOrder = -2;
  const fronds = new T.InstancedMesh(
    fernFrond(), frondMaterial, crownCount * frondsPerCrown,
  );
  fronds.renderOrder = -1;
  fronds.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const transform = new T.Object3D();
  const moss = [0x4e7448, 0x5d7944, 0x41654e, 0x6b8050].map((color) => new T.Color(color));
  const braceColors = [new T.Color(0x342827), new T.Color(0x252d33)];
  const random = seededRandom(316);
  const crowns: {
    x: number; y: number; bendX: number; bendY: number; start: number;
    fan: { angle: number; length: number; spread: number; color: T.Color }[];
  }[] = [];
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
      crowns.push({ x, y, bendX: 0, bendY: 0, start: fernIndex, fan });
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

  structure.add(braces);
  group.add(structure, fronds);
  // Keep enough room for the tips to bend beyond the resting bounds.
  fronds.computeBoundingSphere();
  fronds.boundingSphere!.radius += 1.5;

  return {
    root: group,
    update(scroll: number, exit: number, showTrench: boolean, elapsed: number, actors: readonly WakeActor[]) {
      group.position.y = -scroll - exit * 11;
      const opacity = 1 - T.MathUtils.smoothstep(exit, 0.12, 0.76);
      group.visible = opacity > 0;
      structure.visible = showTrench;
      for (const material of [structureMaterial, frondMaterial]) {
        material.opacity = opacity;
        material.depthWrite = opacity === 1;
      }
      if (elapsed <= 0 || !group.visible) return;

      let changed = false;
      for (const crown of crowns) {
        let targetX = 0;
        let targetY = 0;
        for (const actor of actors) {
          const dx = crown.x - actor.x;
          if (Math.abs(dx) >= 2.4) continue;
          // The repeating copies share a pose, including when the scroll wraps.
          const dy = T.MathUtils.euclideanModulo(crown.y + group.position.y - actor.y + PRESERVE_LOOP / 2,
            PRESERVE_LOOP) - PRESERVE_LOOP / 2;
          const distance = Math.hypot(dx, dy);
          const force = actor.strength * (1 - T.MathUtils.smoothstep(distance, 0.25, 2.4)) / Math.max(distance, 0.25);
          targetX += dx * force;
          targetY += dy * force;
        }
        const limit = Math.max(1, Math.hypot(targetX, targetY));
        const follow = targetX || targetY ? 15 : 5;
        const bendX = T.MathUtils.damp(crown.bendX, targetX / limit, follow, elapsed);
        const bendY = T.MathUtils.damp(crown.bendY, targetY / limit, follow, elapsed);
        const x = Math.abs(bendX) < 0.001 ? 0 : bendX;
        const y = Math.abs(bendY) < 0.001 ? 0 : bendY;
        if (x === crown.bendX && y === crown.bendY) continue;
        crown.bendX = x;
        crown.bendY = y;
        changed = true;

        let index = crown.start;
        const reach = 1 - 0.19 * Math.hypot(x, y);
        for (const tile of tiles) {
          for (const [j, { angle, length, spread }] of crown.fan.entries()) {
            const turn = -x * Math.cos(angle) - y * Math.sin(angle);
            transform.position.set(crown.x, crown.y + tile * PRESERVE_LOOP, -1.24 + j * 0.035);
            transform.rotation.set(0, 0, angle + 0.95 * turn);
            transform.scale.set(length * spread, length * reach, 1);
            transform.updateMatrix();
            fronds.setMatrixAt(index++, transform.matrix);
          }
        }
      }
      if (changed) fronds.instanceMatrix.needsUpdate = true;
    },
  };
}
