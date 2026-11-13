import * as T from 'three';
import { patrolPoseSampling } from '../den/patrol-warp';

export function createPatrolDifference(
  renderer: T.WebGLRenderer, scene: T.Scene, camera: T.Camera, sprite: T.Mesh<T.BufferGeometry, T.ShaderMaterial>, sampleGrid = 1,
) {
  const blendMaterial = sprite.material;
  const { atlas, crop, nextCrop } = blendMaterial.uniforms;
  const scorePass = { value: false };
  const differenceMaterial = new T.ShaderMaterial({
    uniforms: { atlas, crop, nextCrop, scorePass },
    vertexShader: blendMaterial.vertexShader,
    fragmentShader: `${patrolPoseSampling}
      uniform bool scorePass;
      void main() {
        vec4 a = samplePose(artUV, crop), b = samplePose(nextArtUV, nextCrop);
        vec4 delta = abs(a - b);
        float error = max(delta.a, dot(delta.rgb, vec3(.2126, .7152, .0722)));
        float coverage = max(a.a, b.a);
        gl_FragColor = vec4(scorePass ? vec3(error, coverage, 0.0) : vec3(error), 1.0);
      }`,
  });
  const size = 256;
  const width = size * sampleGrid;
  const target = new T.WebGLRenderTarget(width, width, { depthBuffer: false });
  target.scissorTest = sampleGrid > 1;
  const pixels = new Uint8Array(width * width * 4);

  function renderPass(destination: T.WebGLRenderTarget | null) {
    const previous = renderer.getRenderTarget();
    scorePass.value = destination !== null;
    sprite.material = differenceMaterial;
    try {
      renderer.setRenderTarget(destination);
      renderer.render(scene, camera);
    } finally {
      sprite.material = blendMaterial;
      renderer.setRenderTarget(previous);
    }
  }

  return {
    render() { renderPass(null); },
    async measure(pose?: (sample: number) => void) {
      // Put each heading in its own tile so a trial needs just one GPU readback.
      for (let i = 0; i < sampleGrid ** 2; i++) {
        pose?.(i);
        target.viewport.set(i % sampleGrid * size, Math.floor(i / sampleGrid) * size, size, size);
        target.scissor.copy(target.viewport);
        renderPass(target);
      }
      await renderer.readRenderTargetPixelsAsync(target, 0, 0, width, width, pixels);
      let error = 0, coverage = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        error += pixels[i];
        coverage += pixels[i + 1];
      }
      return coverage ? 100 * (1 - error / coverage) : undefined;
    },
    dispose() {
      differenceMaterial.dispose();
      target.dispose();
    },
  };
}
