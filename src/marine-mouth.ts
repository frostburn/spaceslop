import * as T from 'three';

// Lit flesh with aperture-dependent cavity occlusion. This approximates light
// blocked by the roof and cheeks without another scene-wide shadow render pass.
// The warm albedo remains visible at the lips and on the exposed tongue.
export function createMarineMouth() {
  const aperture = { value: .02 };
  function flesh(color: number, roughness: number) {
    const material = new T.MeshPhysicalMaterial({ color, roughness, metalness: 0,
      clearcoat: .12, clearcoatRoughness: .5, side: T.DoubleSide });
    material.onBeforeCompile = shader => {
      shader.uniforms.mouthAperture = aperture;
      shader.vertexShader = 'attribute float oralLight; varying float vOralLight;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvOralLight=oralLight;');
      shader.fragmentShader = 'uniform float mouthAperture; varying float vOralLight;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <aomap_fragment>', `#include <aomap_fragment>
        float cavity = mix(.08,.48,mouthAperture) * mix(.16,1.0,vOralLight);
        reflectedLight.indirectDiffuse *= cavity;
        reflectedLight.indirectSpecular *= cavity;
        reflectedLight.directDiffuse *= sqrt(cavity);
        reflectedLight.directSpecular *= cavity;
      `);
    };
    material.customProgramCacheKey = () => 'marine-mouth-cavity-v1';
    return material;
  }
  return { tissue: flesh(0x79464d, .78), tongue: flesh(0x96555e, .62),
    pose(open: number) { aperture.value = T.MathUtils.clamp(open,0,1); } };
}
