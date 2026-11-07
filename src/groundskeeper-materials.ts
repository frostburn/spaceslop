import * as T from 'three';
import { preserveRandom } from './preserve-layout';

function detailTexture(data: Uint8Array, size: number, color = true) {
  const texture = new T.DataTexture(data, size, size);
  if (color) texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.generateMipmaps = true;
  texture.minFilter = T.LinearMipmapLinearFilter; texture.magFilter = T.LinearFilter; texture.needsUpdate = true;
  return texture;
}
function neutralGrain(material: T.MeshStandardMaterial, contrast: number) {
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        float grain = dot(texture2D(map,vMapUv).rgb,vec3(.2126,.7152,.0722));
        diffuseColor.rgb *= clamp(.88+(grain-.4)*${contrast.toFixed(2)},.58,1.12);
      #endif
    `);
  };
  material.customProgramCacheKey = () => `groundskeeper-neutral-grain/${contrast}`;
  return material;
}

export function createGroundskeeperMaterials() {
  const random = preserveRandom(421), size = 128;
  const vane = new Uint8Array(size * size * 4), horn = new Uint8Array(vane.length), scales = new Uint8Array(vane.length), pigment = new Uint8Array(vane.length);
  const seed = (x: number, y: number) => { const v = Math.sin((x % 16) * 127.1 + (y % 16) * 311.7) * 43758.5453; return v - Math.floor(v); };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const shaft = Math.exp(-Math.abs(x - 63.5) * .24), barb = Math.cos((y + Math.abs(x - 63.5) * .55) * Math.PI / 3);
    const feather = 204 + shaft * 34 + barb * 9 + (random() - .5) * 6;
    vane.set([feather, feather, feather, 255], (y * size + x) * 4);
    const keratin = 205 + Math.sin(x * Math.PI / 4 + Math.sin(y * Math.PI / 64) * .2) * 12 + random() * 8;
    horn.set([keratin, keratin, keratin, 255], (y * size + x) * 4);
    const px = x / 8, py = y / 8; let nearest = 100, next = 100;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = Math.floor(px) + dx, cy = Math.floor(py) + dy;
      const d = Math.hypot(px - cx - .2 - seed(cx + 16, cy + 16) * .6, py - cy - .2 - seed(cy + 16, cx + 16) * .6);
      if (d < nearest) { next = nearest; nearest = d; } else next = Math.min(next, d);
    }
    const raised = T.MathUtils.smoothstep(next - nearest, .025, .17), value = 160 + raised * 80;
    scales.set([value, value, value, 255], (y * size + x) * 4);
    const albedo = 198 + raised * 24 + random() * 8;
    pigment.set([albedo, albedo, albedo, 255], (y * size + x) * 4);
  }
  const vaneMap = detailTexture(vane, size), hornMap = detailTexture(horn, size);
  const scaleMap = detailTexture(scales, size, false), skinMap = detailTexture(pigment, size);
  scaleMap.repeat.set(1.7, 1.4);
  const puff = { value: 0 };
  const feathers = new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, map: vaneMap,
    roughness: .9, side: T.DoubleSide, forceSinglePass: true });
  feathers.onBeforeCompile = shader => {
    shader.uniforms.gkPuff = puff;
    shader.vertexShader = 'uniform float gkPuff;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.z += uv.y*uv.y*gkPuff*.42;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        float vane = dot(texture2D(map,vMapUv).rgb,vec3(.2126,.7152,.0722));
        diffuseColor.rgb *= clamp(.85+(vane-.4)*.9,.56,1.13);
      #endif
    `);
  };
  feathers.customProgramCacheKey = () => 'groundskeeper-layered-feathers-v2';
  const skin = neutralGrain(new T.MeshStandardMaterial({ color: 0x8b806c, map: skinMap, bumpMap: scaleMap, bumpScale: .035, roughness: .82 }), .65);
  const face = neutralGrain(skin.clone(), .65); face.color.setHex(0xffffff); face.vertexColors = true;
  const ochre = neutralGrain(skin.clone(), .65); ochre.color.setHex(0x927354);
  const hand = neutralGrain(skin.clone(), .65); hand.color.setHex(0x716a59);
  const fineVane = vaneMap.clone(); fineVane.repeat.set(5, 9); fineVane.needsUpdate = true;
  const down = neutralGrain(new T.MeshStandardMaterial({ color: 0x93866e, map: fineVane, bumpMap: fineVane, bumpScale: .018, roughness: .96 }), 1.2);
  const darkDown = neutralGrain(down.clone(), 1.2); darkDown.color.setHex(0x62513f);
  const claw = neutralGrain(new T.MeshStandardMaterial({ color: 0xb3a58b, map: hornMap, bumpMap: hornMap, bumpScale: .012, roughness: .49 }), .6);
  const toeClaw = neutralGrain(claw.clone(), .6); toeClaw.color.setHex(0x6a6255);
  const dark = new T.MeshStandardMaterial({ color: 0x1d1913, roughness: .96 });
  const flesh = new T.MeshStandardMaterial({ color: 0x573c34, roughness: .82, side: T.DoubleSide });
  const tongue = new T.MeshStandardMaterial({ color: 0x78574b, roughness: .64 });
  const eye = new T.MeshPhysicalMaterial({ color: 0xac803b, roughness: .22, clearcoat: .8, clearcoatRoughness: .16 });
  const pupil = new T.MeshBasicMaterial({ color: 0x100e0a });
  const shadowPixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const r = Math.hypot((x - 31.5) / 31.5, (y - 31.5) / 31.5);
    shadowPixels.set([12, 15, 8, Math.max(0, 1 - r * r) ** 2 * 150], (y * 64 + x) * 4);
  }
  const shadowMap = detailTexture(shadowPixels, 64); shadowMap.wrapS = shadowMap.wrapT = T.ClampToEdgeWrapping;
  const contactShadow = new T.MeshBasicMaterial({ map: shadowMap, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  return { feathers, puff, skin, face, ochre, hand, down, darkDown, claw, toeClaw, dark, flesh, tongue, eye, pupil, contactShadow,
    setFeathers(texture: T.Texture) { feathers.map = texture; feathers.needsUpdate = true; },
    setScales(texture: T.Texture) { for (const material of [skin, face, ochre, hand]) { material.map = texture; material.needsUpdate = true; } } };
}
