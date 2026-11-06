import * as T from 'three';
// Blend three Cartesian projections, rather than pinching UVs into a cap's
// center. Coordinates stay attached to geometry/instances through camera moves.
export function applyTriplanar(material: T.MeshStandardMaterial, scale: number) {
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer);
    const varyings = 'varying vec3 vIoSurface; varying vec3 vIoNormal;\n';
    shader.vertexShader = varyings + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vIoSurface=position;vIoNormal=normal;
      #ifdef USE_INSTANCING
        vIoSurface=(instanceMatrix*vec4(position,1.)).xyz;
        mat3 basis=mat3(instanceMatrix);
        vIoNormal=basis*(normal/vec3(dot(basis[0],basis[0]),dot(basis[1],basis[1]),dot(basis[2],basis[2])));
      #endif
    `);
    shader.fragmentShader = varyings + `
      vec3 ioWeights(){vec3 w=pow(abs(normalize(vIoNormal)),vec3(5.));return w/max(dot(w,vec3(1.)),.0001);}
      vec4 ioSample(sampler2D tex){vec3 p=vIoSurface*${scale.toFixed(4)},w=ioWeights();
        return texture2D(tex,p.yz)*w.x+texture2D(tex,p.xz)*w.y+texture2D(tex,p.xy)*w.z;}
    `+ shader.fragmentShader;
    // The existing grain normalization may already have expanded this chunk.
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', T.ShaderChunk.map_fragment);
    shader.fragmentShader = shader.fragmentShader.replace('texture2D( map, vMapUv )', 'ioSample(map)');
    const bump = T.ShaderChunk.bumpmap_pars_fragment.replace(/vec2 dHdxy_fwd\(\) \{[\s\S]*?\n\t\}/, `vec2 dHdxy_fwd(){float height=ioSample(bumpMap).r*bumpScale;return vec2(dFdx(height),dFdy(height));}`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <bumpmap_pars_fragment>', bump);
  };
  material.customProgramCacheKey = () => `triplanar/${key}/${scale}`;
  return material;
}
