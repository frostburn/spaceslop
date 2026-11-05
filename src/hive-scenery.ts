import * as T from 'three';
import { loadEncounterTexture } from './encounter-texture';
import { HEIGHT, WIDTH } from './game';

function createFallback() {
  const root = new T.Group();
  const metal = new T.MeshBasicMaterial({ color: 0x493d47 });
  const frame = new T.MeshBasicMaterial({ color: 0x98704c });
  const eggs = new T.MeshBasicMaterial({ color: 0xa4835e });
  const rail = new T.BoxGeometry(0.16, HEIGHT * 3, 0.18);
  const rim = new T.RingGeometry(0.55, 0.66, 6);
  const egg = new T.SphereGeometry(1, 8, 6);
  for (const side of [-1, 1]) {
    const wall = new T.Mesh(new T.BoxGeometry(1.35, HEIGHT * 3, 0.2), metal);
    wall.position.set(side * 4.22, HEIGHT, 0);
    root.add(wall);
    const pipe = new T.Mesh(rail, frame);
    pipe.position.set(side * 3.43, HEIGHT, 0.22);
    root.add(pipe);
    for (let i = 0; i < 14; i++) {
      const y = -6.5 + i * 3.35;
      const chamber = new T.Mesh(rim, frame);
      chamber.position.set(side * (4.02 + 0.11 * Math.sin(i * 2.4)), y, 0.14);
      root.add(chamber);
      for (let j = 0; j < 3; j++) {
        const brood = new T.Mesh(egg, eggs);
        brood.position.set(chamber.position.x + (j - 1) * 0.21, y - 0.2 + (j % 2) * 0.08, 0.18);
        brood.scale.set(0.13, 0.18, 0.11);
        root.add(brood);
      }
    }
  }
  root.position.z = -3.3;
  return root;
}

export function createHiveScenery() {
  const root = new T.Group();
  const fallback = createFallback();
  const uniforms = {
    foreground: { value: null as T.Texture | null }, mask: { value: null as T.Texture | null },
    stars: { value: null as T.Texture | null }, mines: { value: null as T.Texture | null },
    hasForeground: { value: 0 }, hasMask: { value: 0 }, hasStars: { value: 0 }, hasMines: { value: 0 },
    starCrop: { value: new T.Vector2(1, 1) }, mineCrop: { value: new T.Vector2(1, 1) },
    progress: { value: 0 }, screens: { value: 3 },
  };
  const material = new T.ShaderMaterial({
    uniforms, depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform sampler2D foreground, mask, stars, mines;
      uniform float hasForeground, hasMask, hasStars, hasMines, progress, screens;
      uniform vec2 starCrop, mineCrop;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        vec2 cell = floor(vUv * vec2(90.0, 160.0));
        float point = step(0.985, hash(cell)) * pow(max(0.0, 1.0 - length(fract(vUv * vec2(90.0, 160.0)) - 0.5) * 3.0), 3.0);
        vec3 sky = vec3(0.003, 0.005, 0.012) + point * vec3(0.22, 0.29, 0.42);
        if (hasStars > 0.5) sky = texture2D(stars, (vUv - 0.5) * starCrop + 0.5).rgb;
        vec2 mineUv = (vUv - 0.5) * mineCrop * 0.8 + 0.5 + vec2(0.0, (progress - 0.5) * 0.14);
        float rib = 1.0 - smoothstep(0.025, 0.045, abs(fract(vUv.y * 5.0 + progress * 0.7) - 0.5));
        vec3 shaft = vec3(0.005, 0.009, 0.013) + rib * vec3(0.012, 0.014, 0.017);
        if (hasMines > 0.5) shaft = texture2D(mines, mineUv).rgb;
        vec2 plateUv = vec2(vUv.x, (vUv.y + (screens - 1.0) * progress) / screens);
        float channel = 1.0 - smoothstep(0.29, 0.33, abs(vUv.x - 0.5));
        if (hasForeground > 0.5 && hasMask > 0.5) channel = texture2D(mask, plateUv).r;
        vec3 scenery = mix(sky, shaft, channel);
        if (hasForeground > 0.5) {
          vec4 plate = texture2D(foreground, plateUv);
          scenery = mix(scenery, plate.rgb, plate.a);
        }
        gl_FragColor = vec4(scenery, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const backdrop = new T.Mesh(new T.PlaneGeometry(WIDTH, HEIGHT), material);
  backdrop.position.z = -102;
  root.add(backdrop, fallback);
  const ready = Promise.all([
    loadEncounterTexture('hive', (texture) => {
      uniforms.foreground.value = texture;
      const image = texture.image as HTMLImageElement;
      uniforms.screens.value = Math.max(1, image.height / image.width * WIDTH / HEIGHT);
      uniforms.hasForeground.value = 1;
    }),
    loadEncounterTexture('hiveMask', (texture) => {
      texture.colorSpace = T.NoColorSpace;
      uniforms.mask.value = texture;
      uniforms.hasMask.value = 1;
    }),
    loadEncounterTexture('hiveStars', (texture) => {
      uniforms.stars.value = texture;
      uniforms.hasStars.value = 1;
      crop(texture, uniforms.starCrop.value);
    }),
    loadEncounterTexture('hiveMines', (texture) => {
      uniforms.mines.value = texture;
      uniforms.hasMines.value = 1;
      crop(texture, uniforms.mineCrop.value);
    }),
  ]);

  function crop(texture: T.Texture, target: T.Vector2) {
    const { width, height } = texture.image as HTMLImageElement;
    const aspect = width / height / (WIDTH / HEIGHT);
    target.set(Math.min(1, 1 / aspect), Math.min(1, aspect));
  }

  return {
    root, ready,
    update(progress: number, perspectiveDistance?: number) {
      uniforms.progress.value = T.MathUtils.clamp(progress, 0, 1);
      backdrop.scale.setScalar(perspectiveDistance === undefined ? 1 : 1 - backdrop.position.z / perspectiveDistance);
      fallback.visible = !uniforms.hasForeground.value;
      const scale = perspectiveDistance === undefined ? 1 : 1 - fallback.position.z / perspectiveDistance;
      fallback.scale.setScalar(scale);
      fallback.position.y = -(HEIGHT * 2) * uniforms.progress.value * scale;
    },
  };
}
