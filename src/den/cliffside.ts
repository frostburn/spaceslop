import * as T from 'three';
import { HEIGHT, WIDTH } from '../playfield';
import { cutPlateTile, disposePlateTiles, PLATE_GUTTER } from '../rendering/scroll-plate';
import { DEN_SCREENS } from './route';
import { createDenPlateMotion, denPlateMotionShader, type DenWakeFrame } from './plate-motion';

function fallbackCliff(arena: T.Texture) {
  const canvas = document.createElement('canvas');
  const w = canvas.width = 216, h = canvas.height = 384 * DEN_SCREENS;
  const c = canvas.getContext('2d')!;
  const edge = (y: number) => Math.min(w, w * (.75 + .034 * Math.sin(y * .025) + .026 * Math.sin(y * .083)) + Math.max(0, 67 - y * .63));
  const rim = new Path2D();
  rim.moveTo(0, 0);
  for (let y = 0; y <= h; y += 8) rim.lineTo(edge(y), y);
  rim.lineTo(0, h);
  rim.closePath();
  c.save();
  c.clip(rim);
  const stone = c.createLinearGradient(0, 0, w, 0);
  stone.addColorStop(0, '#1d1820');
  stone.addColorStop(.52, '#36333a');
  stone.addColorStop(.72, '#3e373b');
  stone.addColorStop(1, '#65423a');
  c.fillStyle = stone;
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 680; i++) {
    const x = i * 63.389 % w, y = i * 125.711 % h;
    const size = 6 + i * 7 % 20;
    c.fillStyle = i % 3 === 0 ? '#5a4b4b59' : '#110e18a0';
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + size, y - size * .8);
    c.lineTo(x + size * 1.4, y - size * .18);
    c.lineTo(x + size * .21, y + size * .42);
    c.fill();
  }
  for (let i = 0; i < 23; i++) {
    const y = 320 + i * 150.5;
    const right = i % 3 === 2;
    const x = right ? edge(y) - 45 : 0;
    const span = 30 + (i * 19 % 36);
    c.fillStyle = '#242027';
    c.fillRect(x, y, span, 53);
    c.fillStyle = '#69504a';
    c.fillRect(x, y + 42, span, 4);
    c.fillStyle = '#6d352a';
    c.fillRect(x + 8, y + 19, 13, 29);
    c.fillStyle = i % 5 ? '#c7813f' : '#65a3ad';
    c.fillRect(x + span - 11, y + 37, 4, 4);
  }
  c.strokeStyle = '#ab6f454c';
  c.lineWidth = 2.5;
  c.stroke(rim);
  c.restore();

  c.fillStyle = '#463c41';
  c.beginPath();
  c.moveTo(0, 0); c.lineTo(w, 0); c.lineTo(152, 183); c.lineTo(24, 183);
  c.fill();
  c.fillStyle = '#27272f';
  c.fillRect(62, 0, 91, 184);
  c.fillStyle = '#5d5153';
  for (let y = 2; y < 183; y += 6) c.fillRect(62, y, 91, 1);
  for (let x = 63; x < 153; x += 5) c.fillRect(x, 0, 1, 183);
  const image = arena.image as HTMLCanvasElement | HTMLImageElement;
  const cropWidth = Math.min(image.width, image.height * WIDTH / HEIGHT);
  c.drawImage(image, (image.width - cropWidth) / 2, image.height - 1, cropWidth, 1, 0, 0, w, 1);
  const tiles = Array.from({ length: DEN_SCREENS }, (_, index) => cutPlateTile(canvas, w, h, index, DEN_SCREENS));
  canvas.width = canvas.height = 1;
  return tiles;
}

function setCrop(crop: T.Vector2, texture: T.Texture, isArena: boolean) {
  const { width, height } = texture.image as HTMLCanvasElement | HTMLImageElement;
  if (isArena) {
    const aspect = width / height / (WIDTH / HEIGHT);
    crop.set(Math.min(1, 1 / aspect), Math.min(1, aspect));
  } else {
    crop.set(1, 1 - 2 * PLATE_GUTTER / height);
  }
}

export function createDenCliffside(fallback: T.Texture) {
  let arena = fallback;
  let tiles: T.CanvasTexture[] = [];
  const motion = createDenPlateMotion();
  const uniforms = {
    ...motion.uniforms,
    lowerPlate: { value: arena },
    upperPlate: { value: arena },
    lowerCrop: { value: new T.Vector2(1, 1) },
    upperCrop: { value: new T.Vector2(1, 1) },
    scrollFraction: { value: 0 },
  };
  const root = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    alphaToCoverage: true,
    vertexShader: `varying vec2 screenUV;
      void main() {
        screenUV = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader: `varying vec2 screenUV;
      uniform sampler2D lowerPlate, upperPlate;
      uniform vec2 lowerCrop, upperCrop;
      uniform float scrollFraction;
      ${denPlateMotionShader}
      void main() {
        vec2 p = vec2(screenUV.x, screenUV.y + scrollFraction);
        vec2 source = p + vec2(clothBend(p), 0.0);
        float steam = risingSteam(p, source);
        vec4 plate;
        if (source.y < 1.0) plate = texture2D(lowerPlate, (source - .5) * lowerCrop + .5);
        else plate = texture2D(upperPlate, (source - vec2(.5, 1.5)) * upperCrop + .5);
        if (plate.a < .15) discard;
        vec3 color = mix(plate.rgb, vec3(.28, .245, .223), steam);
        gl_FragColor = vec4(color * .76, smoothstep(.15, .7, plate.a));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  root.name = 'cliffside-and-gantry';
  root.frustumCulled = false;
  root.renderOrder = -999;
  return {
    root,
    get textures() { return [arena, ...tiles]; },
    setArena(texture: T.Texture) {
      arena.dispose();
      arena = texture;
      arena.minFilter = T.LinearFilter;
      arena.generateMipmaps = false;
      const crop = new T.Vector2();
      setCrop(crop, arena, true);
      motion.useArena(crop.x);
    },
    setCliff(maps: T.CanvasTexture[]) {
      tiles = maps.length ? maps : fallbackCliff(arena);
      motion.useCliff(maps.length > 0);
    },
    update(scroll: number, time: number, wake?: DenWakeFrame) {
      const index = Math.min(DEN_SCREENS, Math.floor(scroll + 1e-9));
      uniforms.scrollFraction.value = Math.max(0, scroll - index);
      const lower = tiles[index] ?? arena;
      const upper = tiles[index + 1] ?? arena;
      uniforms.lowerPlate.value = lower;
      uniforms.upperPlate.value = upper;
      setCrop(uniforms.lowerCrop.value, lower, lower === arena);
      setCrop(uniforms.upperCrop.value, upper, upper === arena);
      motion.update(index, scroll, time, wake);
    },
    dispose() { disposePlateTiles(tiles); arena.dispose(); },
  };
}
