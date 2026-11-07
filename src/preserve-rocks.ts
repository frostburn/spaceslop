import * as T from 'three';
import { preserveNoise } from './preserve-layout';

export function preserveRockGeometry() {
  const g = new T.IcosahedronGeometry(1, 2), p = g.attributes.position, colors = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const s = .88 + preserveNoise(x * 3 + 8, y * 3 + z) * .22;
    // Flattened irregular bedding planes, broken by fractures rather than UV rings.
    p.setXYZ(i, x * s + .07 * Math.sin(z * 14), y * s, z * .85 + .045 * Math.sin(z * 21 + x * 2));
    const shade = .75 + .16 * preserveNoise(x * 5, y * 5 + z) + .06 * Math.sin(z * 19);
    colors.push(shade, shade * .97, shade * .86);
  }
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); g.computeVertexNormals(); return g;
}
