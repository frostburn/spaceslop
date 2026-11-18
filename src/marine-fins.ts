import * as T from 'three';
import { sealMarineTube } from './marine-geometry';

const sections = 24, sides = 16;
type Section = (span: number, chord: number, thickness: number, load: number) => [number, number, number];

function blade(sample: Section, flexible: boolean) {
  const uv: number[] = [], indices: number[] = [];
  for (let i = 0; i <= sections; i++) for (let j = 0; j <= sides; j++) {
    uv.push(j / sides, i / sections);
    if (i < sections && j < sides) {
      const a = i * (sides + 1) + j, b = a + sides + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }

  function shape(load: number) {
    const positions: number[] = [];
    for (let i = 0; i <= sections; i++) for (let j = 0; j <= sides; j++) {
      const angle = j % sides * 2 * Math.PI / sides;
      positions.push(...sample(i / sections, Math.cos(angle), Math.sin(angle), load));
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(indices);
    sealMarineTube(g, sections, sides, true);
    g.computeVertexNormals();
    const normals = g.attributes.normal, normal = new T.Vector3(), other = new T.Vector3();
    for (let i = 0; i <= sections; i++) {
      const first = i * (sides + 1), last = first + sides;
      normal.fromBufferAttribute(normals, first).add(other.fromBufferAttribute(normals, last)).normalize();
      normals.setXYZ(first, normal.x, normal.y, normal.z);
      normals.setXYZ(last, normal.x, normal.y, normal.z);
    }
    return g;
  }

  const rest = shape(0);
  if (flexible) {
    const loaded = [shape(1), shape(-1)];
    rest.morphAttributes.position = loaded.map(g => g.attributes.position);
    rest.morphAttributes.normal = loaded.map(g => g.attributes.normal);
  }
  return rest;
}

export function marinePaddle(length: number, width: number, sweep: number) {
  return blade((t, edge, roundness, load) => {
    const chord = width * (.58 + .51 * Math.sin(t * Math.PI)) * (1 - t) ** .62 + .003;
    const y = edge * chord;
    const z = chord * (.16 * roundness * (1 + .28 * edge) + .06 * (1 - edge * edge));
    // Flex increases farther from the socket, with the trailing edge yielding
    // to the stroke. Both morphs leave the embedded root ring in place.
    const twist = load * .46 * t * t, cos = Math.cos(twist), sin = Math.sin(twist);
    return [
      length * t * (1 - Math.abs(load) * .022 * t * t),
      -length * sweep * t ** 1.65 + y * cos - z * sin,
      y * sin + z * cos + load * .17 * length * t * t,
    ];
  }, true);
}

export function marineDorsal() {
  return blade((t, edge, roundness) => {
    const chord = .405 * (1 - t) ** .83 + .003;
    return [-roundness * chord * .17, chord * edge - .08 - .34 * t ** 1.35, .65 * t];
  }, false);
}

export function marineFluke(lower: number, upper: number, sweep: number) {
  return blade((t, edge, roundness, load) => {
    const height = t * 2 - 1, reach = Math.abs(height);
    const chord = .297 * (1 - reach) ** .73 * (1 + .16 * Math.sin(reach * Math.PI)) + .005;
    const flesh = .087 * (1 - reach) ** 1.15 * (1 - .18 * edge) + .003;
    return [
      -roundness * flesh + load * reach * reach * (.22 - edge * .06),
      -.13 - sweep * reach ** 1.48 + edge * chord,
      height * (height < 0 ? lower : upper),
    ];
  }, true);
}

export function flexMarineFin(fin: T.Mesh, load: number) {
  const weights = fin.morphTargetInfluences!;
  weights[0] = Math.max(0, load);
  weights[1] = Math.max(0, -load);
}
