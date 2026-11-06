import * as T from 'three';
import { createGalacticBackdrop, galaxySampling } from './galactic-backdrop';
import { iceRefraction, iceLayerSampling } from './ice-refraction';
import { asteroidRelief, iceEnvironment } from './ice-surfaces';

export function iceOptics(galaxy: ReturnType<typeof createGalacticBackdrop>) {
  const relief = asteroidRelief(), environment = iceEnvironment(), refraction = iceRefraction();
  const uniforms = { iceMap: { value: null as T.Texture | null }, rockMap: { value: null as T.Texture | null },
    hasIce: { value: 0 }, hasRock: { value: 0 }, iceViewport: { value: new T.Vector2(1, 1) }, bend: { value: 1 } };
  const surface = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 1, metalness: 0,
    ior: 1.31, specularIntensity: 1, envMap: environment, envMapIntensity: 0.85,
    normalMap: relief.normal, normalScale: new T.Vector2(0.85, 0.85), roughnessMap: relief.roughness });
  surface.name = 'fractured-water-ice';
  surface.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, galaxy.uniforms, refraction.uniforms);
    shader.vertexShader = 'attribute float frost, rockId; varying float vFrost, vRockId; varying vec2 vIceUv;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRockId = rockId; vFrost = frost; vIceUv = uv * 2.0;');
    shader.fragmentShader = `${galaxySampling}
${iceLayerSampling}
      uniform sampler2D iceMap, rockMap; uniform float hasIce, hasRock, bend; uniform vec2 iceViewport;
      varying float vFrost; varying vec2 vIceUv;\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n if(captureLayer > 1.5 && abs(texture2D(previousBody0,gl_FragCoord.xy/vec2(textureSize(previousBody0,0))).a-vRockId)<0.001) discard;\n if(captureLayer > 2.5 && abs(texture2D(previousBody1,gl_FragCoord.xy/vec2(textureSize(previousBody1,0))).a-vRockId)<0.001) discard;`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec3 iceGrain = vec3(1.0), rockGrain = vec3(1.0);
      if (hasIce > 0.5) {
        vec3 grain = texture2D(iceMap, vIceUv).rgb;
        // Retain uploaded cracks while avoiding a muddy blue tint in otherwise clear ice.
        float luminance = dot(grain, vec3(0.2126,0.7152,0.0722));
        iceGrain = vec3(clamp(luminance * 1.1 + 0.72, 0.75, 1.2));
      }
      if (hasRock > 0.5) rockGrain = clamp(texture2D(rockMap, vIceUv).rgb * 3.0 + 0.6, 0.6, 1.25);
      diffuseColor.rgb *= mix(rockGrain, iceGrain, vFrost);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(0.86, roughnessFactor, vFrost);`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
      // Refract a deeper asteroid surface, rejecting this body and anything in front.
      // View-space normals and framebuffer pixels keep it aligned at any DPR or boss pitch.
      vec2 screenUv = gl_FragCoord.xy / iceViewport;
      vec3 refractedRay = refract(vec3(0.0,0.0,-1.0), normal, 1.0/1.31);
      vec2 offset = refractedRay.xy * (0.12 + (1.0-abs(normal.z))*0.09) * bend;
      vec3 transmitted = iceBehind(screenUv + offset) * vec3(0.88,0.96,1.0);
      float fresnel = 0.018 + 0.982 * pow(1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0),5.0);
      float clarity = smoothstep(0.72,0.98,vFrost) * (1.0-smoothstep(0.16,0.65,roughnessFactor));
      float glass = (0.35 + clarity*0.63) * (1.0-fresnel);
      // Preserve the physical direct and probe highlights while replacing part of the diffuse body.
      outgoingLight = mix(outgoingLight, transmitted, glass)
        + (reflectedLight.directSpecular + reflectedLight.indirectSpecular) * glass;
      #include <opaque_fragment>
      if(captureLayer > 0.5) gl_FragColor.a = vRockId;`);
  };
  surface.customProgramCacheKey = () => 'frostwake-layered-ice-v3';
  return { surface, uniforms, dispose:refraction.dispose,capture: refraction.capture, textures: [relief.normal, relief.roughness, environment, refraction.empty] };
}
