import * as T from 'three';
import { loadEncounterTexture } from './encounter-texture';
import { HEIGHT, WIDTH } from './game';

export function createShipyardBackdrop(signal?:AbortSignal) {
  const uniforms = {
    shipyardMap: { value: null as T.Texture | null },
    shipyardCrop: { value: new T.Vector2(1, 1) },
    hasShipyard: { value: 0 },
    reveal: { value: 0 },
    edge: { value: 1.24 },
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
      uniform sampler2D shipyardMap;
      uniform vec2 shipyardCrop;
      uniform float reveal, edge;
      uniform vec3 tint;
      varying vec2 vUv;
      void main() {
        float opening = smoothstep(edge - 0.23, edge + 0.23, vUv.y);
        if (opening <= 0.0) discard;
        vec2 skyUv = (vUv - 0.5) * (0.86 + 0.14 * reveal) + vec2(0.5, 0.5 - 0.05 * (1.0 - reveal));
        skyUv = (skyUv - 0.5) * shipyardCrop + 0.5;
        vec3 sky = texture2D(shipyardMap, skyUv).rgb;
        gl_FragColor = vec4(sky * tint, opening);
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
  const shipyardReady = loadEncounterTexture('shipyard', (texture) => {
    cropToField(texture, uniforms.shipyardCrop.value);
    uniforms.shipyardMap.value = texture;
    uniforms.hasShipyard.value = 1;
  }, undefined, signal);

  return {
    root,
    ready: shipyardReady,
    get hasShipyard() { return Boolean(uniforms.hasShipyard.value); },
    update(reveal: number, perspectiveDistance: number) {
      uniforms.reveal.value = reveal;
      uniforms.edge.value = T.MathUtils.lerp(1.24, -0.24, reveal);
      root.visible = this.hasShipyard && reveal > 0;
      root.scale.setScalar(1 - root.position.z / perspectiveDistance);
      return uniforms.edge.value;
    },
  };
}
