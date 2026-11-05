import * as T from 'three';
import { loadEncounterTexture } from './encounter-texture';

export const GALAXY_SCREENS = 1.5;
// Shared by the sky and fake ice refraction so crop, wrap and boss rotation agree.
export const galaxySampling = `uniform sampler2D galaxy; uniform float reveal; uniform vec2 crop;
  vec3 sky(vec2 uv) { return texture2D(galaxy,(uv-0.5)*crop+0.5).rgb; }
  vec3 seamless(vec2 p) {
    vec2 uv = fract(p), edge = min(uv,1.0-uv);
    vec2 blend = (1.0-smoothstep(vec2(0.0),vec2(0.035),edge))*0.5;
    vec3 a = sky(uv), b = sky(vec2(1.0-uv.x,uv.y));
    vec3 c = sky(vec2(uv.x,1.0-uv.y)), d = sky(1.0-uv);
    return mix(mix(a,b,blend.x),mix(c,d,blend.x),blend.y);
  }
  vec3 galaxyAt(vec2 viewportUv) {
    vec2 p = (viewportUv-0.5)*vec2(1.0,16.0/9.0);
    float a = reveal*0.58; p = mat2(cos(a),-sin(a),sin(a),cos(a))*p;
    vec2 uv = p/vec2(1.0,24.0/9.0)+vec2(0.5,0.5+reveal*0.12);
    float lane = 0.75 + 0.25*smoothstep(0.0,0.45,abs(viewportUv.x-0.5));
    return seamless(uv)*lane*0.86;
  }`;
function fallbackGalaxy() {
  const width = 384, height = 1024, canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d')!, image = context.createImageData(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height;
    const cloud = Math.sin(u * 31 + Math.cos(v * 19) * 2) * Math.sin(v * 43 + Math.sin(u * 27));
    const lane = Math.sin((v - u * 0.38) * Math.PI * 2);
    const band = Math.exp(-lane * lane * 19) * (0.6 + cloud * 0.35);
    const dust = 0.7 + Math.sin(u * 89 + Math.sin(v * 47) * 2) * 0.22;
    const i = (y * width + x) * 4;
    image.data[i] = 2 + band * dust * 24; image.data[i + 1] = 4 + band * dust * 30;
    image.data[i + 2] = 8 + band * dust * 39; image.data[i + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  for (let i = 0; i < 2100; i++) {
    const x = (i * 127.13 % 383), y = (i * 311.71 % 1023), bright = i % 29 === 0;
    context.fillStyle = i % 7 ? `rgba(192,214,235,${bright ? 0.85 : 0.2 + i % 4 * 0.1})` : 'rgba(224,195,160,.6)';
    context.fillRect(x, y, bright ? 1.3 : .7, bright ? 1.3 : .7);
  }
  const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
  return texture;
}
export function createGalacticBackdrop() {
  const fallback = fallbackGalaxy();
  const uniforms = { galaxy: { value: fallback as T.Texture }, reveal: { value: 0 }, crop: { value: new T.Vector2(1, 1) } };
  const material = new T.ShaderMaterial({ uniforms, depthWrite: false, depthTest: false,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `${galaxySampling} varying vec2 vUv;
      void main() {
        // One view samples two thirds of the 1.5-screen plate. Wrapped sampling
        // permits the sky to reorient during the camera pitch without empty corners.
        gl_FragColor = vec4(galaxyAt(vUv),1.0);
        #include <colorspace_fragment>
      }`,
  });
  const root = new T.Mesh(new T.PlaneGeometry(9,16), material);
  root.name = 'galactic-backdrop'; root.position.z = -130; root.renderOrder = -10; root.frustumCulled = false;
  const ready = loadEncounterTexture('galaxy', texture => {
    const image = texture.image as HTMLImageElement, aspect = image.width / image.height;
    uniforms.crop.value.set(Math.min(1, (9 / 24) / aspect), Math.min(1, aspect / (9 / 24)));
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    uniforms.galaxy.value = texture; fallback.dispose();
  }).then(texture => texture ?? fallback);
  return { root, ready, uniforms, update(reveal: number, distance: number) {
    uniforms.reveal.value = reveal;
    root.scale.setScalar(1 - root.position.z / distance);
  } };
}
