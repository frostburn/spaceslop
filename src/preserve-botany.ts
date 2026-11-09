import * as T from 'three';

// Stiff pinnate cycad fronds and fan-leaved branches share the fern's radial
// crown contract, but have distinct silhouettes at phone scale.
export function preserveCycadFrond(fan = false) {
  const positions: number[] = [], colors: number[] = [], uv: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => {
    positions.push(...a, ...b, ...c);
    colors.push(.6, .65, .5, .88, .92, .7, 1, 1, .85);
    for (const p of [a, b, c]) uv.push(p[0] + .5, p[1]);
  };
  for (let j = 0; j < 18; j++) {
    const t = (j + 1) / 19, z = .46 * Math.sin(t * 1.9), x = .045 * Math.sin(t * 3);
    tri([x - .012, t - .06, z - .02], [x + .012, t - .06, z - .02], [x, t + .04, z]);
    for (const side of [-1, 1]) {
      const reach = (.1 + .18 * Math.sin(t * Math.PI)) * (fan ? 1.15 : 1), tip = [x + side * reach, t + .08, z + .05];
      if (fan) {
        const base = [x, t, z];
        for (let k = 0; k < 5; k++) {
          const a = (k / 5 - .5) * 1.8, b = ((k + 1) / 5 - .5) * 1.8;
          tri(base, [tip[0] + Math.sin(a) * .1, tip[1] + Math.cos(a) * .1, tip[2]],
            [tip[0] + Math.sin(b) * .1, tip[1] + Math.cos(b) * .1, tip[2] + .018]);
        }
      } else {
        const ridge = [x + side * reach * .55, t + .035, z + .065];
        tri([x, t - .012, z], [tip[0], tip[1] - .025, tip[2]], ridge);
        tri([x, t + .012, z], ridge, [tip[0], tip[1] + .025, tip[2]]);
      }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.computeVertexNormals(); return g;
}
