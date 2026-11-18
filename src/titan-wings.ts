import * as T from 'three';

const spanSteps = 22;
const chordSteps = 8;

export function cicadaWingGeometry(span: number, sweep: number, chord: number, camber: number, flex: number) {
  function sample(s: number, c: number, lifted: boolean, offset = 0) {
    const taper = .05 + .95 * Math.sin(Math.PI * s) ** .73;
    return [
      span * s,
      sweep * s ** 1.4 + chord * taper * (c - .5),
      camber * Math.sin(Math.PI * s) * Math.sin(Math.PI * c)
        + (lifted ? flex * s * s * (.34 + .66 * c) : 0) + offset,
    ];
  }

  const positions: number[] = [], raised: number[] = [], indices: number[] = [];
  for (let i = 0; i <= spanSteps; i++) for (let j = 0; j <= chordSteps; j++) {
    positions.push(...sample(i / spanSteps, j / chordSteps, false));
    raised.push(...sample(i / spanSteps, j / chordSteps, true));
    if (i < spanSteps && j < chordSteps) {
      const a = i * (chordSteps + 1) + j, b = a + chordSteps + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const membrane = new T.BufferGeometry();
  membrane.setIndex(indices);
  membrane.setAttribute('position', new T.Float32BufferAttribute(raised, 3));
  membrane.computeVertexNormals();
  const flexedNormals = membrane.attributes.normal.clone();
  membrane.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  membrane.computeVertexNormals();
  membrane.morphAttributes.position = [new T.Float32BufferAttribute(raised, 3)];
  membrane.morphAttributes.normal = [flexedNormals];

  // Both states of each vein are sampled from the same surface as the wing.
  // Branches join existing ribs at their start, then taper toward the margin.
  const restingVeins: number[] = [], flexedVeins: number[] = [];
  function branch(startSpan: number, endSpan: number, chordAt: (s: number) => number) {
    for (let i = 0; i < spanSteps; i++) for (const endpoint of [i, i + 1]) {
      const s = T.MathUtils.lerp(startSpan, endSpan, endpoint / spanSteps);
      const c = chordAt(s), offset = .009 * span;
      restingVeins.push(...sample(s, c, false, offset));
      flexedVeins.push(...sample(s, c, true, offset));
    }
  }
  for (const rib of [.12, .31, .5, .69, .88]) {
    const course = (s: number) => T.MathUtils.lerp(.50, rib, T.MathUtils.smoothstep(s, 0, .6));
    branch(.015, 1, course);
    if (rib === .5) continue;
    for (const start of [.47, .66, .81]) {
      const finish = start + .13;
      const edge = rib < .5 ? .025 : .975;
      branch(start, finish, s => T.MathUtils.lerp(course(start), edge, (s - start) / (finish - start)));
    }
  }
  const veins = new T.BufferGeometry();
  veins.setAttribute('position', new T.Float32BufferAttribute(restingVeins, 3));
  veins.morphAttributes.position = [new T.Float32BufferAttribute(flexedVeins, 3)];
  return { membrane, veins };
}

export function mountCicadaWing(
  geometry: ReturnType<typeof cicadaWingGeometry>, surface: T.Material, veins: T.LineBasicMaterial,
) {
  const membrane = new T.Mesh(geometry.membrane, surface);
  membrane.name = 'wing-membrane';
  const ribs = new T.LineSegments(geometry.veins, veins);
  ribs.name = 'wing-veins';
  const blade = new T.Group();
  blade.add(membrane, ribs);
  return { blade, flex(amount: number) {
    membrane.morphTargetInfluences![0] = amount;
    ribs.morphTargetInfluences![0] = amount;
  } };
}
