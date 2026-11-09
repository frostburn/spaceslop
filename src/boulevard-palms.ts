import * as T from 'three';
import {BOULEVARD_DECK} from './boulevard';
import type {BoulevardMaterials} from './boulevard-materials';

// Each instance has its own recessed lamp at the foot of its trunk. Evaluate
// that local light in the material, avoiding hundreds of real scene lights.
export function createBoulevardPalmLighting(base:BoulevardMaterials){
 const strength={value:1};
 function lit(source:T.MeshStandardMaterial,leaf:boolean){
  const material=source.clone();material.name=leaf?'boulevard-uplit-fronds':'boulevard-uplit-bark';
  material.onBeforeCompile=shader=>{
   shader.uniforms.palmUplight=strength;
   const declarations='varying vec3 vPalmToLight;varying float vPalmHeight;varying vec2 vPalmGrain;';
   shader.vertexShader=declarations+'\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vec4 palmPoint=vec4(transformed,1.),palmOrigin=vec4(0.,0.,0.,1.);
    #ifdef USE_INSTANCING
    palmPoint=instanceMatrix*palmPoint;palmOrigin=instanceMatrix*palmOrigin;
    #endif
    vec3 lamp=vec3(palmOrigin.x-sign(palmOrigin.x)*.17,palmOrigin.y,${(BOULEVARD_DECK+.34).toFixed(2)});
    vPalmToLight=mat3(viewMatrix)*mat3(modelMatrix)*(lamp-palmPoint.xyz);
    vPalmHeight=max(0.,palmPoint.z-(${BOULEVARD_DECK.toFixed(1)}));vPalmGrain=uv;`);
   shader.fragmentShader='uniform float palmUplight;'+declarations+'\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    float palmCos=dot(normal,normalize(vPalmToLight)),palmFalloff=1./(1.+vPalmHeight*vPalmHeight*.024);
    ${leaf?`float palmLight=max(0.,palmCos)+.20*max(0.,-palmCos);
    vec3 palmTint=mix(vec3(1.35,.15,.52),vec3(.52,.10,1.15),smoothstep(.3,1.4,vPalmGrain.y));
    totalEmissiveRadiance+=palmTint*palmLight*palmFalloff*palmUplight*1.5;`:
    `float palmRings=.68+.32*smoothstep(-.2,.5,sin(vPalmGrain.y*105.+sin(vPalmGrain.x*31.)*1.5));
    totalEmissiveRadiance+=vec3(1.65,.61,.095)*(.22+max(0.,palmCos)*1.2)*palmFalloff*palmRings*palmUplight;`}`);
  };
  material.customProgramCacheKey=()=>leaf?'boulevard-palm-canopy-uplight':'boulevard-palm-trunk-uplight';return material;
 }
 const fixtures=new T.MeshBasicMaterial({color:new T.Color(0xffbb5d).multiplyScalar(2.2),toneMapped:false});
 return{bark:lit(base.bark,false),leaf:lit(base.leaf,true),fixtures,strength};
}
