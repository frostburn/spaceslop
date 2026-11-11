import * as T from 'three';
import { fonsPhase, fonsPose } from './combat';

const columns = 17, rows = 20;
const step = 1 / 90;
const clothFront = -1.02;
type Seam = { a: number; b: number; length: number; stiffness: number };

function makePanel(side: number, material: T.ShaderMaterial) {
  const rest: number[] = [], uv: number[] = [], indices: number[] = [];
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const u = column / (columns - 1), v = row / (rows - 1);
    const shoulder = Math.sin(Math.PI * v * .93);
    const crest = Math.sin(u * Math.PI * 4.6 + v * (1.7 + side * .47));
    const width = 1.42 + shoulder * (1.83 + .18 * side) - v * .23;
    const x = side * (.50 + width * u + .25 * v * Math.sin(3 * u + side));
    const y = .73 + .54 * Math.sin(u * 2.45) - v * (3.49 + .24 * side) +
      .46 * v ** 4 * Math.cos(u * 14.8 + side) - .31 * u * v;
    const z = -1.39 - .26 * u + crest * (.19 + .15 * v) - .48 * v * u;
    rest.push(x, y, z);
    uv.push(u, 1 - v);
    if (row < rows - 1 && column < columns - 1) {
      const i = row * columns + column;
      if (side > 0) indices.push(i, i + columns, i + 1, i + 1, i + columns, i + columns + 1);
      else indices.push(i, i + 1, i + columns, i + 1, i + columns + 1, i + columns);
    }
  }
  const geometry = new T.BufferGeometry();
  const position = new T.Float32BufferAttribute(rest, 3);
  position.setUsage(T.DynamicDrawUsage);
  geometry.setAttribute('position', position);
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('normal', new T.BufferAttribute(new Float32Array(rest.length), 3).setUsage(T.DynamicDrawUsage));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const positions = position.array, previous = positions.slice();
  const seams: Seam[] = [];
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    for (const [dx, dy, stiffness] of [[1, 0, .89], [0, 1, .89], [1, 1, .56], [-1, 1, .56], [2, 0, .23], [0, 2, .24]]) {
      if (row + dy >= rows || column + dx >= columns || column + dx < 0) continue;
      const a = 3 * (row * columns + column), b = 3 * ((row + dy) * columns + column + dx);
      const length = Math.hypot(rest[b] - rest[a], rest[b + 1] - rest[a + 1], rest[b + 2] - rest[a + 2]);
      seams.push({ a, b, length, stiffness });
    }
  }
  const mesh = new T.Mesh(geometry, material);
  mesh.name = side < 0 ? 'fons-mantle-left' : 'fons-mantle-right';
  mesh.frustumCulled = false;

  return {
    mesh,
    reset() { positions.set(rest); previous.set(rest); },
    integrate(time: number, lift: number, inertiaX: number, inertiaY: number, twist: number) {
      // Move the pins along the collar. The trailing folds follow the
      // structural, diagonal and bend constraints over subsequent steps.
      for (let i = 0; i < columns; i++) {
        const j = i * 3, u = i / (columns - 1);
        positions[j] = rest[j] + side * lift * (.17 + .56 * u);
        positions[j + 1] = rest[j + 1] + lift * (.23 + .52 * u);
        positions[j + 2] = rest[j + 2] - lift * (.18 + .33 * u);
      }
      for (let i = columns * 3; i < positions.length; i += 3) {
        const u = (i / 3 % columns) / (columns - 1);
        const v = Math.floor(i / (3 * columns)) / (rows - 1);
        const gust = Math.sin(time * 3.45 - v * 4.3 + u * 3.8 + side);
        const x = positions[i], y = positions[i + 1], z = positions[i + 2];
        positions[i] = x + (x - previous[i]) * .978 +
          ((rest[i] - x) * 7.3 + inertiaX * (.75 + .55 * v) + side * lift * 6.8 + gust * 2.8) * step ** 2;
        positions[i + 1] = y + (y - previous[i + 1]) * .978 +
          ((rest[i + 1] - y) * 7.3 + inertiaY * .67 + lift * 7.6 - 1.8) * step ** 2;
        positions[i + 2] = z + (z - previous[i + 2]) * .977 +
          ((rest[i + 2] - z) * 9.6 + gust * 9.2 + side * twist * 8.3 + lift * 6.8) * step ** 2;
        previous[i] = x; previous[i + 1] = y; previous[i + 2] = z;
      }
      for (let iteration = 0; iteration < 4; iteration++) {
        for (const { a, b, length, stiffness } of seams) {
          const freeA = a >= 3 * columns ? 1 : 0, freeB = b >= 3 * columns ? 1 : 0;
          if (!(freeA + freeB)) continue;
          const dx = positions[b] - positions[a], dy = positions[b + 1] - positions[a + 1], dz = positions[b + 2] - positions[a + 2];
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const correction = (1 - length / Math.max(.0001, distance)) * stiffness / (freeA + freeB);
          positions[a] += dx * correction * freeA; positions[b] -= dx * correction * freeB;
          positions[a + 1] += dy * correction * freeA; positions[b + 1] -= dy * correction * freeB;
          positions[a + 2] += dz * correction * freeA; positions[b + 2] -= dz * correction * freeB;
        }
        // Stop the animated folds behind the deepest tips of the rear mane.
        for (let i = columns * 3 + 2; i < positions.length; i += 3)
          positions[i] = Math.min(positions[i], clothFront);
      }
    },
    upload() {
      position.needsUpdate = true;
      geometry.computeVertexNormals();
    },
  };
}

export function createFonsMantle() {
  const charge = { value: 0 };
  const material = new T.ShaderMaterial({
    side: T.DoubleSide,
    uniforms: { charge },
    vertexShader: /* glsl */ `
      varying vec2 cloth;
      varying vec3 surfaceNormal, eye;
      void main() {
        cloth = uv;
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        surfaceNormal = normalMatrix * normal;
        eye = -p.xyz;
        gl_Position = projectionMatrix * p;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 cloth;
      varying vec3 surfaceNormal, eye;
      uniform float charge;
      void main() {
        vec3 n = normalize(surfaceNormal) * (gl_FrontFacing ? 1.0 : -1.0);
        vec3 v = normalize(eye);
        vec3 light = normalize(vec3(-.41, .68, .73));
        float diffuse = max(0.0, dot(n, light));
        float shine = pow(max(0.0, dot(n, normalize(v + light))), 14.0);
        float rim = pow(1.0 - max(0.0, dot(n, v)), 3.8);
        float stripe = .82 + .18 * sin(cloth.x * 148.0 + 1.6 * sin(cloth.y * 23.0));
        float lining = smoothstep(.23, .86, -.18 * n.y + .55 * n.x + .27) *
          (.60 + .40 * sin(cloth.x * 12.4 + cloth.y * 3.0));
        vec3 color = vec3(.006, .010, .016) + vec3(.018, .025, .031) * diffuse * stripe;
        color += vec3(.013, .11, .18) * (shine * .52 + rim * .6);
        color += vec3(.003, .16, .061) * lining * (.70 + .52 * charge);
        color += vec3(.012, .30, .45) * (.8 * rim + .3 * shine) * charge * .42;
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const root = new T.Group();
  root.name = 'fons-mantle';
  const panels = [-1, 1].map(side => makePanel(side, material));
  root.add(...panels.map(panel => panel.mesh));
  let last = -Infinity;
  return {
    root,
    update(time: number, reset: boolean) {
      const { lift } = fonsPhase(time);
      charge.value = lift;
      if (reset || time < last || time - last > .24) {
        for (const panel of panels) panel.reset();
        last = time - step;
      }
      if (time - last < step - 1e-8) return;
      while (last + step <= time + 1e-8) {
        last += step;
        const a = fonsPose(last - .045), b = fonsPose(last), c = fonsPose(last + .045);
        const dx = T.MathUtils.clamp((2 * b.x - a.x - c.x) * 1800, -11, 11);
        const dy = T.MathUtils.clamp((2 * b.y - a.y - c.y) * 1380, -8, 8);
        const twist = (c.yaw - a.yaw) * 11;
        for (const panel of panels) panel.integrate(last, fonsPhase(last).lift, dx, dy, twist);
      }
      for (const panel of panels) panel.upload();
    },
  };
}
