import * as T from 'three';
import { loadEncounterTexture } from './encounter-texture';
import { HEIGHT, WIDTH } from './game';

export function createStageBackdrops() {
  const uniforms = {
    preserveMap: { value: null as T.Texture | null },
    shipyardMap: { value: null as T.Texture | null },
    preserveCrop: { value: new T.Vector2(1, 1) },
    shipyardCrop: { value: new T.Vector2(1, 1) },
    hasPreserve: { value: 0 },
    hasShipyard: { value: 0 },
    reveal: { value: 0 },
    scroll: { value: 0 },
    tint: { value: new T.Color(0xc6c6c6) },
  };
  const material = new T.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D preserveMap, shipyardMap;
      uniform vec2 preserveCrop, shipyardCrop;
      uniform float hasPreserve, hasShipyard, reveal, scroll;
      uniform vec3 tint;
      varying vec2 vUv;
      void main() {
        float edge = mix(1.24, -0.24, reveal);
        float opening = smoothstep(edge - 0.23, edge + 0.23, vUv.y);
        float preserveWeight = (1.0 - opening) * hasPreserve;
        float shipyardWeight = opening * hasShipyard;
        float opacity = preserveWeight + shipyardWeight;
        if (opacity <= 0.0) discard;

        // The preserve keeps scrolling under the retreating foreground.
        float mirroredY = 1.0 - abs(mod(vUv.y + scroll, 2.0) - 1.0);
        vec2 groundUv = (vec2(vUv.x, mirroredY) - 0.5) * preserveCrop + 0.5;
        vec2 skyUv = (vUv - 0.5) * (0.86 + 0.14 * reveal) + vec2(0.5, 0.5 - 0.05 * (1.0 - reveal));
        skyUv = (skyUv - 0.5) * shipyardCrop + 0.5;
        vec3 ground = texture2D(preserveMap, groundUv).rgb;
        vec3 sky = texture2D(shipyardMap, skyUv).rgb;
        vec3 scenery = (ground * preserveWeight + sky * shipyardWeight) / opacity;
        float haze = 4.0 * opening * (1.0 - opening);
        gl_FragColor = vec4(mix(scenery * tint, vec3(0.11, 0.24, 0.39), haze * 0.12), opacity);
        #include <colorspace_fragment>
      }
    `,
  });
  const root = new T.Mesh(new T.PlaneGeometry(WIDTH, HEIGHT), material);
  // Stay behind the interceptor even at the far end of its approach.
  root.position.z = -102;
  root.renderOrder = -3;
  root.visible = false;

  function cropToField(texture: T.Texture, crop: T.Vector2) {
    const { width, height } = texture.image as HTMLImageElement;
    const aspect = (width / height) / (WIDTH / HEIGHT);
    crop.set(Math.min(1, 1 / aspect), Math.min(1, aspect));
  }
  const preserveReady = loadEncounterTexture('preserve', (texture) => {
    cropToField(texture, uniforms.preserveCrop.value);
    uniforms.preserveMap.value = texture;
    uniforms.hasPreserve.value = 1;
  });
  const shipyardReady = loadEncounterTexture('shipyard', (texture) => {
    cropToField(texture, uniforms.shipyardCrop.value);
    uniforms.shipyardMap.value = texture;
    uniforms.hasShipyard.value = 1;
  });

  return {
    root,
    ready: Promise.all([preserveReady, shipyardReady]),
    get hasPreserve() { return Boolean(uniforms.hasPreserve.value); },
    get hasShipyard() { return Boolean(uniforms.hasShipyard.value); },
    update(reveal: number, scroll: number, perspectiveDistance?: number) {
      uniforms.reveal.value = reveal;
      uniforms.scroll.value = scroll / HEIGHT;
      root.visible = (this.hasPreserve && reveal < 1) || (this.hasShipyard && reveal > 0);
      root.scale.setScalar(perspectiveDistance === undefined ? 1 : 1 - root.position.z / perspectiveDistance);
    },
  };
}
