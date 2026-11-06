import * as T from 'three';
import {ioNoise} from './io-layout';

// Low-frequency, mip-filtered deposits stay readable at phone scale. The
// coating is evaluated in model coordinates, never camera/world scroll space.
const n=128,pixels=new Uint8Array(n*n*4);
for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const a=x/n*Math.PI*2,b=y/n*Math.PI*2;
  const noise=(scale:number,offset:number)=>ioNoise(offset+Math.cos(a)*scale+Math.sin(b)*scale,offset+Math.sin(a)*scale+Math.cos(b)*scale);
  pixels.set([noise(3,20)*255,noise(7,40)*255,noise(15,60)*255,255],(y*n+x)*4);
}
export const ioDepositMask=new T.DataTexture(pixels,n,n);
ioDepositMask.wrapS=ioDepositMask.wrapT=T.RepeatWrapping;ioDepositMask.generateMipmaps=true;
ioDepositMask.minFilter=T.LinearMipmapLinearFilter;ioDepositMask.magFilter=T.LinearFilter;ioDepositMask.needsUpdate=true;

export function ioDustCoating(material:T.MeshStandardMaterial,strength:number){
  const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.userData.ioDustCoating=strength;
  material.onBeforeCompile=(shader,renderer)=>{
    compile(shader,renderer);shader.uniforms.ioDepositMap={value:ioDepositMask};
    const varying='varying vec3 vIoDepositPoint,vIoDepositNormal;\n';
    shader.vertexShader=varying+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vIoDepositPoint=position;vIoDepositNormal=normal;
      #ifdef USE_INSTANCING
        vIoDepositPoint=(instanceMatrix*vec4(position,1.)).xyz;
        mat3 depositBasis=mat3(instanceMatrix);
        vIoDepositNormal=depositBasis*(normal/vec3(dot(depositBasis[0],depositBasis[0]),dot(depositBasis[1],depositBasis[1]),dot(depositBasis[2],depositBasis[2])));
      #endif
    `);
    shader.fragmentShader=varying+'uniform sampler2D ioDepositMap;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 dp=vIoDepositPoint;
      vec3 deposits=texture2D(ioDepositMap,vec2(dp.x+dp.y*.43,dp.z+dp.y*.29)*.33).rgb;
      float upright=pow(max(0.,normalize(vIoDepositNormal).z),2.);
      float coat=${strength.toFixed(3)}*(.12+smoothstep(.27,.68,deposits.r)*(.30+.70*upright));
      float streak=texture2D(ioDepositMap,vec2((dp.x+dp.y*.37)*.7,dp.z*.10)).g;
      float grime=smoothstep(.48,.77,streak)*(.3+.7*deposits.b)*(1.-upright)*${(strength*.7).toFixed(3)};
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.48,.36,.16),coat);
      diffuseColor.rgb*=1.-grime;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.97,clamp(coat+grime,0.,1.));');
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor*=1.-clamp(coat+grime,0.,.9);');
  };
  material.customProgramCacheKey=()=>`io-dust/${key}/${strength}`;
  return material;
}
