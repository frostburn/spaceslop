import * as T from 'three';
import { fonsPhase, fonsPose } from './combat';

function fallbackLocks(front: boolean) {
  const count = front ? 24 : 52;
  const positions: number[] = [], colors: number[] = [], faces: number[] = [];
  const tips = 13, sides = 6;
  const black = new T.Color(0x151927), cyan = new T.Color(0x37667c), green = new T.Color(0x215344);
  const color = new T.Color();
  for (let lock = 0; lock < count; lock++) {
    const angle = lock / count * Math.PI * 2 + .044 * Math.sin(lock * 7.01 + Number(front));
    const x = Math.cos(angle), y = Math.sin(angle);
    if (front && Math.abs(y) < .40) continue;
    const noise = .5 + .5 * Math.sin(lock * 2.41 + 1.7);
    const length = (front ? .41 : .67) + noise * (front ? .38 : .76) + (y < 0 ? -.95 * y : 0);
    const width = (front ? .095 : .135) + .065 * noise;
    const start = positions.length / 3;
    for (let i = 0; i <= tips; i++) {
      const t = i / tips;
      const bend = Math.sin(t * 3.9 + lock * .83) * t * (.15 + noise * .29);
      const px = x * (.73 + t * length) - y * bend;
      const py = y * (1.20 + .52 * t * length) - t * length * (.25 + .25 * (1 - y));
      const pz = (front ? .46 : -.42) + .32 * Math.sin(t * Math.PI) + noise * .23 - .35 * t;
      const taper = Math.max(.015, Math.sin((.22 + .78 * t) * Math.PI) ** .75);
      for (let j = 0; j < sides; j++) {
        const turn = j * Math.PI * 2 / sides;
        const w = Math.cos(turn) * width * taper;
        positions.push(px - y * w, py + x * w, pz + Math.sin(turn) * width * .66 * taper);
        color.copy(black).lerp(y > -.25 ? cyan : green, (.19 + noise * .39) * (.35 + .65 * t) * (.53 + .47 * Math.sin(turn)));
        colors.push(color.r, color.g, color.b);
        if (i < tips) {
          const a = start + i * sides + j, b = start + i * sides + (j + 1) % sides;
          faces.push(a, a + sides, b, b, a + sides, b + sides);
        }
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  return geometry;
}

export function createFonsMane() {
  const root = new T.Group();
  const clock = { value: 0 }, wind = { value: 0 }, lift = { value: 0 };
  function animated<TMaterial extends T.Material>(material: TMaterial, layer: number) {
    material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, { maneClock: clock, maneWind: wind, maneLift: lift });
      shader.vertexShader = `uniform float maneClock, maneWind, maneLift;\n` +
        shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
          float reach = length(position.xy / vec2(.91, 1.50));
          float tip = smoothstep(.90, 2.45, reach);
          float phase = maneClock * ${layer ? '5.3' : '2.75'} - position.y * 2.8 + position.x * 1.55 + ${layer ? '1.8' : '0.0'};
          transformed.x += tip * (sin(phase) * ${layer ? '.14' : '.10'} + maneWind * ${layer ? '.31' : '.55'});
          transformed.y += tip * (.12 * cos(phase * .79) + .28 * maneLift);
          transformed.z += tip * .18 * sin(phase * .77 + .5);`);
    };
    material.customProgramCacheKey = () => `fons-mane-${layer}`;
    return material;
  }
  const layers = [false, true].map((front, index) => {
    const fallback = new T.Mesh(fallbackLocks(front), animated(new T.MeshStandardMaterial({
      vertexColors: true, roughness: .69, side: T.DoubleSide,
    }), index));
    fallback.name = 'fons-modeled-mane-' + index;
    const geometry = new T.PlaneGeometry(6.60, 6.26, 26, 28);
    geometry.translate(0, -1.01, front ? .62 : -.43);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (uv.getX(i) * .996 + .002 + index) * .5);
    const raster = new T.Mesh(geometry, animated(new T.MeshBasicMaterial({
      alphaTest: .15, alphaToCoverage: true, color: 0xced4e2,
    }), index));
    raster.name = 'fons-raster-mane-' + index;
    raster.visible = false;
    root.add(fallback, raster);
    return { fallback, raster };
  });
  return {
    root,
    setArt(map: T.Texture) {
      map.anisotropy = 4;
      for (const { fallback, raster } of layers) {
        raster.material.map = map;
        raster.material.needsUpdate = true;
        raster.visible = true;
        fallback.visible = false;
      }
    },
    update(time: number) {
      clock.value = time;
      wind.value = fonsPose(time - .17).x - fonsPose(time).x;
      lift.value = fonsPhase(time).lift;
    },
  };
}
