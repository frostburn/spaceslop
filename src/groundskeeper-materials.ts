import * as T from 'three';
import { preserveRandom } from './preserve-layout';

export function createGroundskeeperMaterials() {
  const random = preserveRandom(421), size = 128, pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const grain = .78 + Math.sin(x * Math.PI / 8 + Math.sin(y * Math.PI / 16)) * .05 + random() * .07;
    pixels.set([grain * 255, grain * 255, grain * 255, 255], (y * size + x) * 4);
  }
  const fallback = new T.DataTexture(pixels, size, size); fallback.colorSpace = T.SRGBColorSpace;
  fallback.wrapS = fallback.wrapT = T.RepeatWrapping; fallback.generateMipmaps = true;
  fallback.minFilter = T.LinearMipmapLinearFilter; fallback.magFilter = T.LinearFilter; fallback.needsUpdate = true;
  const scalePixels = new Uint8Array(size * size * 4);
  const seed = (x: number, y: number) => { const v = Math.sin((x % 16) * 127.1 + (y % 16) * 311.7) * 43758.5453; return v - Math.floor(v); };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = x / 8, py = y / 8; let nearest = 100, next = 100;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = Math.floor(px) + dx, cy = Math.floor(py) + dy;
      const d = Math.hypot(px - cx - .2 - seed(cx + 16, cy + 16) * .6, py - cy - .2 - seed(cy + 16, cx + 16) * .6);
      if (d < nearest) { next = nearest; nearest = d; } else next = Math.min(next, d);
    }
    const value = 170 + T.MathUtils.smoothstep(next - nearest, .025, .17) * 65;
    scalePixels.set([value, value, value, 255], (y * size + x) * 4);
  }
  const scales = new T.DataTexture(scalePixels, size, size); scales.wrapS = scales.wrapT = T.RepeatWrapping;
  scales.generateMipmaps = true; scales.minFilter = T.LinearMipmapLinearFilter; scales.magFilter = T.LinearFilter; scales.needsUpdate = true;
  const puff = { value: 0 };
  const feathers = new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, map: fallback,
    roughness: .87, side: T.DoubleSide, forceSinglePass: true });
  feathers.onBeforeCompile = shader => {
    shader.uniforms.gkPuff = puff;
    shader.vertexShader = 'uniform float gkPuff;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.z += uv.y*uv.y*gkPuff*.32;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        vec4 sampleVane = texture2D(map, vMapUv);
        float vane = dot(sampleVane.rgb, vec3(.2126,.7152,.0722));
        diffuseColor.rgb *= clamp(.85+(vane-.4)*.6,.65,1.15);
      #endif
    `);
  };
  feathers.customProgramCacheKey = () => 'groundskeeper-coarse-feathers-v1';
  const skin = new T.MeshStandardMaterial({ color: 0xa08b6f, map: fallback, bumpMap: scales, bumpScale: .025, roughness: .83 });
  const ochre = skin.clone(); ochre.color.setHex(0xb7813c);
  const down = new T.MeshStandardMaterial({ color: 0xa99e80, roughness: .95 });
  const darkDown = down.clone(); darkDown.color.setHex(0x695942);
  const claw = new T.MeshStandardMaterial({ color: 0xc1ad80, map: fallback, roughness: .55 });
  const dark = new T.MeshStandardMaterial({ color: 0x211a15, roughness: .92 });
  const flesh = new T.MeshStandardMaterial({ color: 0x754537, roughness: .77 });
  const tongue = new T.MeshStandardMaterial({ color: 0x8b5347, roughness: .58 });
  const eye = new T.MeshStandardMaterial({ color: 0xd6a046, roughness: .24 });
  const pupil = new T.MeshBasicMaterial({ color: 0x10110b });
  return { feathers, puff, skin, ochre, down, darkDown, claw, dark, flesh, tongue, eye, pupil,
    setFeathers(texture: T.Texture) { feathers.map = texture; feathers.needsUpdate = true; },
    setScales(texture: T.Texture) { skin.bumpMap = ochre.bumpMap = texture; skin.bumpScale = ochre.bumpScale = .045; skin.needsUpdate = ochre.needsUpdate = true; } };
}
