import * as T from 'three';
import { HEIGHT, WIDTH } from '../playfield';
import { createBlackHoleMaterial } from '../studies/black-hole-material';

function surface(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return { context, texture };
}

function skyFallback() {
  const w = 768, h = 384;
  const { context, texture } = surface(w, h);
  context.fillStyle = '#100d1b';
  context.fillRect(0, 0, w, h);
  const nebula = ['#704352', '#554963', '#346476', '#a36b46'];
  for (let i = 0; i < 48; i++) {
    const x = (i * 173.51) % w, y = 183 + 60 * Math.sin(i * 1.73);
    const radius = 28 + i * 17 % 67;
    const cloud = context.createRadialGradient(x, y, 0, x, y, radius);
    cloud.addColorStop(0, nebula[i % nebula.length] + '80');
    cloud.addColorStop(1, nebula[i % nebula.length] + '00');
    context.fillStyle = cloud;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  for (let i = 0; i < 1550; i++) {
    const bright = i % 24 === 0;
    const size = bright ? 1.3 : .65;
    context.fillStyle = `rgba(226,215,244,${bright ? .84 : .15 + i % 6 * .053})`;
    context.fillRect((i * 159.397) % w, (i * 97.417) % h, size, size);
  }
  texture.wrapS = T.RepeatWrapping;
  return texture;
}

function gantryFallback() {
  const { context: c, texture } = surface(600, 960);
  const shape = (color: string, points: readonly (readonly [number, number])[]) => {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(...points[0]);
    points.slice(1).forEach(p => c.lineTo(...p));
    c.closePath();
    c.fill();
  };
  for (const side of [0, 1]) {
    c.save();
    if (side) { c.translate(600, 0); c.scale(-1, 1); }
    const ledges = [[340, 108], [466, 142], [614, 126], [754, 168]] as const;
    shape('#2c2831', [[0, 285], [27, 327], [62, 358], [43, 412], [84, 482], [63, 554], [94, 642], [80, 702], [115, 766], [93, 851], [135, 960], [0, 960]]);
    shape('#43383c', [[4, 326], [49, 399], [29, 484], [68, 576], [58, 680], [92, 783], [73, 902], [6, 960]]);
    for (const [y, x] of ledges) {
      shape('#3e3438', [[0, y], [x, y + 15], [x - 30, y + 37], [0, y + 53]]);
      shape('#72605a', [[0, y], [x, y + 15], [x - 8, y + 20], [0, y + 9]]);
      c.strokeStyle = '#a17652';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(0, y - 12);
      c.lineTo(x - 9, y + 2);
      for (let i = 1; i <= 4; i++) {
        const px = i * (x - 9) / 4;
        c.moveTo(px, y - 13 + 15 * px / x);
        c.lineTo(px, y + 15 * px / x);
      }
      c.stroke();
      c.fillStyle = '#ffab52';
      c.fillRect(x - 13, y - 5, 7, 7);
    }
    c.restore();
  }
  shape('#463c41', [[0, 926], [93, 877], [508, 877], [600, 926], [600, 960], [0, 960]]);
  c.fillStyle = '#27272f';
  c.fillRect(173, 884, 254, 76);
  c.fillStyle = '#5d5153';
  for (let y = 892; y < 960; y += 10) c.fillRect(173, y, 254, 2);
  for (let x = 181; x < 427; x += 13) c.fillRect(x, 884, 2, 76);
  return texture;
}

export function createDenScenery() {
  const root = new T.Group();
  const quad = new T.PlaneGeometry(2, 2);
  const lens = createBlackHoleMaterial(skyFallback());
  const lensUniforms = lens.material.uniforms;
  lensUniforms.frameScale.value.set(1, HEIGHT / WIDTH);
  lensUniforms.lensExtent.value = 11.7;
  lensUniforms.skyGain.value = .98;
  lensUniforms.diskGain.value = .78;
  lensUniforms.skyOffset.value.set(-.012, .027);
  const sky = new T.Mesh(quad, lens.material);
  sky.name = 'lensed-galactic-center';
  sky.frustumCulled = false;
  sky.renderOrder = -1000;

  const plateUniforms = {
    image: { value: gantryFallback() as T.Texture },
    crop: { value: new T.Vector2() },
    offset: { value: new T.Vector2() },
  };
  const plate = new T.Mesh(quad, new T.ShaderMaterial({
    uniforms: plateUniforms,
    depthTest: false,
    depthWrite: false,
    alphaToCoverage: true,
    vertexShader: `varying vec2 screenUV;
      void main() {
        screenUV = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader: `varying vec2 screenUV;
      uniform sampler2D image;
      uniform vec2 crop, offset;
      void main() {
        vec4 plate = texture2D(image, (screenUV - .5) * crop + .5 + offset);
        if (plate.a < .15) discard;
        gl_FragColor = vec4(plate.rgb * .76, smoothstep(.15, .7, plate.a));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  plate.name = 'gantry-plate';
  plate.frustumCulled = false;
  plate.renderOrder = -999;
  root.add(sky, plate);

  return {
    root,
    get textures(): T.Texture[] {
      return [...lens.tables, lensUniforms.skyArt.value, plateUniforms.image.value,
        ...(lensUniforms.diskArt.value ? [lensUniforms.diskArt.value] : [])];
    },
    setSky(map: T.Texture) {
      map.wrapT = T.ClampToEdgeWrapping;
      lensUniforms.skyArt.value.dispose();
      lensUniforms.skyArt.value = map;
    },
    setDisk(map: T.Texture) {
      map.wrapS = map.wrapT = T.ClampToEdgeWrapping;
      lensUniforms.diskArt.value = map;
      lensUniforms.useArt.value = true;
    },
    setPlate(map: T.Texture) {
      map.wrapS = map.wrapT = T.ClampToEdgeWrapping;
      plateUniforms.image.value.dispose();
      plateUniforms.image.value = map;
    },
    update(reveal: number, time: number) {
      const approach = 1 - reveal;
      lensUniforms.lensCenter.value.set(.035 + .62 * approach, .56 + .025 * approach);
      const angle = .18 * time;
      lensUniforms.diskRotation.value.set(Math.cos(angle), Math.sin(angle));
      const { width, height } = plateUniforms.image.value.image as HTMLCanvasElement | HTMLImageElement;
      const aspect = (width / height) / (WIDTH / HEIGHT);
      const x = Math.min(1, 1 / aspect) * (1 - .036 * approach);
      const y = Math.min(1, aspect) * (1 - .04 * approach);
      plateUniforms.crop.value.set(x, y);
      plateUniforms.offset.value.set(.32 * (1 - x) * approach, -.25 * (1 - y) * approach);
    },
  };
}
