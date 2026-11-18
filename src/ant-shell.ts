import * as T from 'three';

type Ring = readonly [y: number, width: number, depth: number, center: number];

function chitinShell(rings: readonly Ring[], sutures: readonly number[], rows: number, sides: number) {
  const first = rings[0][0], last = rings[rings.length - 1][0];

  function groove(y: number, angle: number) {
    // The plates overlap toward the back. The seam runs around each section.
    let cut = 0, lip = 0;
    for (const seam of sutures) {
      const d = y - seam + 0.012 * Math.cos(angle);
      cut += Math.exp(-((d / 0.009) ** 2));
      lip += Math.exp(-(((d - 0.015) / 0.014) ** 2));
    }
    return { cut, lip };
  }

  function point(y: number, angle: number, lift = 0) {
    y = T.MathUtils.clamp(y, first, last);
    let i = 0;
    while (i < rings.length - 2 && y > rings[i + 1][0]) i++;
    const a = rings[i], b = rings[i + 1];
    const lo = rings[Math.max(0, i - 1)], hi = rings[Math.min(rings.length - 1, i + 2)];
    const dy = b[0] - a[0], t = (y - a[0]) / dy, tt = t * t;
    const interpolate = (k: 1 | 2 | 3) => T.MathUtils.lerp(a[k], b[k], tt * (3 - 2 * t))
      + t * (1 - t) ** 2 * dy * (b[k] - lo[k]) / (b[0] - lo[0])
      - tt * (1 - t) * dy * (hi[k] - a[k]) / (hi[0] - a[0]);
    const { cut, lip } = groove(y, angle);
    const plate = lip * 0.017 - cut * 0.012;
    return new T.Vector3(
      Math.sin(angle) * (interpolate(1) + plate + lift), y,
      interpolate(3) + Math.cos(angle) * (interpolate(2) + plate * 0.76 + lift),
    );
  }

  const positions: number[] = [], uv: number[] = [], indices: number[] = [], colors: number[] = [];
  const polish = new T.Color(0xe8bd9b), underside = new T.Color(0x82706a), stain = new T.Color(0x554031);
  const color = new T.Color();
  // Add rows near the overlaps so the crease still reads as geometry at grazing angles.
  const heights = Array.from({ length: rows + 1 }, (_, i) => T.MathUtils.lerp(first, last, i / rows));
  heights.push(...sutures.flatMap(y => [y - 0.012, y, y + 0.012, y + 0.024]));
  heights.sort((a, b) => a - b);
  for (const [row, y] of heights.entries()) for (let col = 0; col <= sides; col++) {
    const angle = (col / sides - 0.5) * Math.PI * 2;
    const p = point(y, angle);
    const { cut, lip } = groove(y, angle);
    positions.push(p.x, p.y, p.z);
    uv.push(col / sides, (y - first) / (last - first));
    color.copy(underside).lerp(polish, T.MathUtils.smoothstep(Math.cos(angle), -0.7, 0.95))
      .lerp(stain, 0.67 * cut).multiplyScalar(0.96 + 0.11 * lip);
    colors.push(color.r, color.g, color.b);
    if (row < heights.length - 1 && col < sides) {
      const a = row * (sides + 1) + col, b = a + sides + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const normal = geometry.getAttribute('normal');
  const n = new T.Vector3(), m = new T.Vector3();
  for (let row = 0; row < heights.length; row++) {
    const start = row * (sides + 1), end = start + sides;
    if (row === 0 || row === heights.length - 1) {
      for (let i = start; i <= end; i++) normal.setXYZ(i, 0, row === 0 ? -1 : 1, 0);
    } else {
      n.fromBufferAttribute(normal, start).add(m.fromBufferAttribute(normal, end)).normalize();
      normal.setXYZ(start, n.x, n.y, n.z);
      normal.setXYZ(end, n.x, n.y, n.z);
    }
  }
  function outward(y: number, angle: number) {
    const across = point(y, angle + 0.001).sub(point(y, angle - 0.001));
    return across.cross(point(y + 0.001, angle).sub(point(y - 0.001, angle))).normalize();
  }
  return { geometry, point, outward };
}

export const antGaster = chitinShell([
  [-0.47, 0, 0, -0.012], [-0.45, 0.125, 0.089, -0.012], [-0.39, 0.234, 0.167, -0.008],
  [-0.27, 0.306, 0.225, 0], [-0.085, 0.345, 0.257, 0], [0.065, 0.33, 0.24, 0.012],
  [0.195, 0.269, 0.183, 0.02], [0.32, 0.163, 0.109, 0.02], [0.365, 0.078, 0.061, 0.017],
  [0.382, 0, 0, 0.016],
], [-0.27, -0.095, 0.09, 0.242], 38, 28);

export const antThorax = chitinShell([
  [-0.205, 0, 0, 0.155], [-0.165, 0.135, 0.105, 0.166], [-0.075, 0.196, 0.155, 0.181],
  [0.065, 0.216, 0.179, 0.187], [0.192, 0.244, 0.19, 0.196],
  [0.272, 0.205, 0.155, 0.195], [0.344, 0.103, 0.091, 0.192], [0.37, 0, 0, 0.184],
], [-0.08, 0.098], 26, 24);

export const antHead = chitinShell([
  [-0.255, 0, 0, -0.015], [-0.23, 0.138, 0.105, -0.015], [-0.16, 0.236, 0.163, -0.011],
  [-0.051, 0.283, 0.194, -0.006], [0.057, 0.29, 0.19, 0.004], [0.16, 0.251, 0.159, 0.028],
  [0.23, 0.179, 0.115, 0.05], [0.287, 0.089, 0.065, 0.057], [0.31, 0, 0, 0.056],
], [0.22], 28, 28);
