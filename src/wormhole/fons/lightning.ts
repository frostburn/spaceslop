import * as T from 'three';
import { FONS_APPROACH, fonsEase } from './combat';

const branchCapacity = 144;
const depth = -16;
const noise = (key: number) => {
  const value = Math.sin(key * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

export function createFonsLightning(apertureY: number) {
  const points = new Float32Array(branchCapacity * 4 * 3);
  const energy = new Float32Array(branchCapacity * 4);
  const across = new Float32Array(branchCapacity * 4);
  const indices = new Uint16Array(branchCapacity * 6);
  for (let i = 0; i < branchCapacity; i++) {
    const vertex = i * 4;
    across.set([-1, 1, -1, 1], vertex);
    indices.set([vertex, vertex + 2, vertex + 1, vertex + 1, vertex + 2, vertex + 3], i * 6);
  }
  const geometry = new T.BufferGeometry();
  const position = new T.BufferAttribute(points, 3).setUsage(T.DynamicDrawUsage);
  const brightness = new T.BufferAttribute(energy, 1).setUsage(T.DynamicDrawUsage);
  geometry.setAttribute('position', position);
  geometry.setAttribute('brightness', brightness);
  geometry.setAttribute('acrossBolt', new T.BufferAttribute(across, 1));
  geometry.setIndex(new T.BufferAttribute(indices, 1));
  const material = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float brightness, acrossBolt;
      varying float light, across;
      void main() {
        light = brightness;
        across = acrossBolt;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float light, across;
      void main() {
        float d = abs(across);
        float core = exp(-d * d * 48.0);
        float halo = exp(-d * d * 4.4) * (1.0 - smoothstep(.60, 1.0, d));
        vec3 color = vec3(.71, .034, 1.36) * halo + vec3(1.23, .45, 1.80) * core;
        gl_FragColor = vec4(color, light * max(core, halo * .63));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const root = new T.Mesh(geometry, material);
  root.name = 'fons-entry-lightning';
  root.frustumCulled = false;
  root.position.z = depth;
  root.visible = false;
  let segment = 0;

  function ribbon(ax: number, ay: number, bx: number, by: number, width: number, power: number) {
    const dx = bx - ax, dy = by - ay;
    const factor = width / Math.max(.001, Math.hypot(dx, dy));
    const nx = -dy * factor, ny = dx * factor;
    const i = segment * 12;
    points[i] = ax + nx; points[i + 1] = ay + ny;
    points[i + 3] = ax - nx; points[i + 4] = ay - ny;
    points[i + 6] = bx + nx; points[i + 7] = by + ny;
    points[i + 9] = bx - nx; points[i + 10] = by - ny;
    energy.fill(power, segment * 4, segment * 4 + 4);
    segment++;
  }

  function bolt(ax: number, ay: number, bx: number, by: number, seed: number, width: number, power: number, steps: number) {
    const dx = bx - ax, dy = by - ay;
    const length = Math.max(.001, Math.hypot(dx, dy));
    const nx = -dy / length, ny = dx / length;
    let x = ax, y = ay;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const jag = (noise(seed + i * 2.03) - .5) * Math.sin(t * Math.PI) * (steps === 10 ? .75 : .36);
      const nextX = ax + dx * t + nx * jag, nextY = ay + dy * t + ny * jag;
      ribbon(x, y, nextX, nextY, width * (1 - .49 * t), power * (1 - .52 * t));
      if (steps === 10 && (i === 4 || i === 7)) {
        const side = noise(seed + i) > .5 ? 1 : -1;
        const spread = .39 + noise(seed - i) * .6;
        bolt(nextX, nextY, nextX + dx * .23 + nx * side * spread, nextY + dy * .23 + ny * side * spread,
          seed + i * 1.71, width * .57, power * .56, 4);
      }
      x = nextX; y = nextY;
    }
  }

  return {
    root,
    update(time: number, distance: number) {
      const age = time + FONS_APPROACH;
      const glow = fonsEase(.18, .65, age) * (1 - fonsEase(2.30, FONS_APPROACH, age));
      root.visible = glow > .003;
      if (!root.visible) return 0;
      segment = 0;
      for (let i = 0; i < 8; i++) {
        const tick = Math.floor((age + i * .042) * 12.5);
        const seed = tick * 17.74 + i * 4.13;
        const angle = i * Math.PI / 4 + .13 * Math.sin(age * 1.35 + i) + (noise(seed) - .5) * .38;
        const reach = 2.85 + noise(seed + 4) * 2.55;
        const exitAngle = angle + (noise(seed + 3) - .5) * .71;
        const power = glow * (.31 + .69 * noise(seed + 7));
        bolt(Math.cos(angle) * 1.68, apertureY + Math.sin(angle) * 1.53,
          Math.cos(exitAngle) * reach, apertureY + Math.sin(exitAngle) * reach * .88,
          seed, .088 + noise(seed + 13) * .054, power, 10);
      }
      const projection = 1 - depth / distance;
      root.scale.set(projection, projection, 1);
      geometry.setDrawRange(0, segment * 6);
      position.needsUpdate = brightness.needsUpdate = true;
      return glow;
    },
  };
}
