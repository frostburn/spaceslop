import type {MeshStandardMaterial} from 'three';
import {summerNoise} from './noise';

type Surface='stone'|'bronze'|'snow'|'rock'|'aircraft';
const noise=summerNoise.replace(/\bhash\(/g,'summerDirtHash(').replace(/\bn\(/g,'summerDirtNoise(');

// Model/instance coordinates keep deposits attached while the world scrolls.
// Compose with the stone's existing inlay shader; leave lamps and glass clean.
export function weatherSummerSurface(material:MeshStandardMaterial,surface:Surface,floor=-18){
  const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{
    compile.call(material,shader,renderer);
    const varying='varying vec3 summerDirtPoint,summerDirtNormal;\n';
    shader.vertexShader=varying+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      summerDirtPoint=position;summerDirtNormal=normal;
      #ifdef USE_INSTANCING
        summerDirtPoint=(instanceMatrix*vec4(position,1.)).xyz;
        mat3 dirtBasis=mat3(instanceMatrix);
        summerDirtNormal=dirtBasis*(normal/vec3(dot(dirtBasis[0],dirtBasis[0]),dot(dirtBasis[1],dirtBasis[1]),dot(dirtBasis[2],dirtBasis[2])));
      #endif`);
    shader.fragmentShader=varying+noise+'\n'+shader.fragmentShader;
    const tint=surface==='aircraft'?'vec3(.085,.06,.035)':surface==='bronze'?'vec3(.055,.105,.075)':surface==='snow'?'vec3(.21,.18,.12)':'vec3(.095,.105,.052)';
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec3 dirtN=normalize(summerDirtNormal),dirtW=abs(dirtN);
      vec2 dirtP=dirtW.z>max(dirtW.x,dirtW.y)?summerDirtPoint.xy:dirtW.x>dirtW.y?summerDirtPoint.yz:summerDirtPoint.xz;
      float dirtBroad=summerDirtNoise(dirtP*${surface==='aircraft'?'3.7':'.87'}+vec2(7.3,2.1));
      vec2 dirtGrain=${surface==='aircraft'?'dirtP*vec2(13.,1.6)':'dirtW.z>.75?dirtP*2.1:dirtP*vec2(7.1,.34)'};
      float dirtStreak=summerDirtNoise(dirtGrain+vec2(2.8,9.7));
      float dirtGrit=summerDirtNoise(dirtP*14.3);
      float dirtDetail=1.-smoothstep(.1,.6,length(fwidth(dirtP))*14.3);
      float dirtFoot=1.-smoothstep(.08,1.5,summerDirtPoint.z-(${floor.toFixed(3)}));
      float dirtPatch=smoothstep(.36,.78,dirtBroad)*(.35+.65*dirtStreak);
      float dirtCoat=${surface==='aircraft'?'.1*dirtStreak+dirtPatch*.46':surface==='snow'?'(1.-smoothstep(.12,.8,summerDirtPoint.z))*(.07+.31*dirtPatch)':surface==='bronze'?'dirtPatch*(.16+.35*dirtFoot)':'dirtPatch*(.19+.28*dirtFoot)'};
      diffuseColor.rgb*=1.-dirtPatch*${surface==='snow'?'.07':'.22'};
      diffuseColor.rgb=mix(diffuseColor.rgb,${tint},dirtCoat);
      diffuseColor.rgb*=1.-dirtDetail*smoothstep(.6,.85,dirtGrit)*dirtCoat*.22;
      ${surface==='aircraft'?`float dirtScuff=dirtDetail*smoothstep(.72,.91,summerDirtNoise(dirtP*vec2(27.,3.7)))*smoothstep(.44,.72,dirtBroad);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.32,.30,.23),dirtScuff*.24);`:''}`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.98,clamp(dirtCoat+dirtPatch*.2,0.,.7));');
    shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor*=1.-dirtCoat*.85;');
  };
  material.customProgramCacheKey=()=>key+'/summer-weathering-v1/'+surface+'/'+floor;
  return material;
}
