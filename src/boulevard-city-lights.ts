import * as T from 'three';
import type {BoulevardMaterials} from './boulevard-materials';

// All positions are sampled before the city/camera transform. Gradients stay on
// the architecture during ascent, and fixture phases survive pursuit recycling.
const declarations='varying vec3 vCityPosition;varying float vCitySeed;';
const position=`vec4 cityPosition=vec4(position,1.);vCitySeed=dot(position,vec3(.13,.07,.19));
#ifdef USE_INSTANCING
cityPosition=instanceMatrix*cityPosition;vCitySeed=dot(instanceMatrix[3].xyz,vec3(2.31,1.47,.87));
#endif
vCityPosition=cityPosition.xyz;`;
const colors=`uniform float cityClock;${declarations}
float cityFade(float seed){return smoothstep(-.65,.65,sin(cityClock*.13+seed));}
vec3 cityColor(vec3 base,float amount,float minimum){
 float gradient=.5+.5*sin(vCityPosition.z*.53+vCityPosition.y*.16+vCityPosition.x*.11-cityClock*.095);
 vec3 tint=mix(vec3(1.,.18,.63),vec3(.12,.75,1.),gradient);
 float peak=max(base.r,max(base.g,base.b));
 return mix(base,peak*tint,amount)*mix(minimum,1.,cityFade(vCitySeed));
}`;
export function createBoulevardCityLights(base:BoulevardMaterials){
 const clock={value:0};
 function surface<M extends T.MeshBasicMaterial|T.MeshStandardMaterial>(source:M,amount:number,minimum=1){
  const material=source.clone() as M;material.name='boulevard-animated-'+source.type;
  material.onBeforeCompile=shader=>{shader.uniforms.cityClock=clock;shader.vertexShader=declarations+'\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+position);shader.fragmentShader=colors+'\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=cityColor(diffuseColor.rgb,'+amount.toFixed(2)+','+minimum.toFixed(2)+');');};
  material.customProgramCacheKey=()=>`boulevard-city-${amount}-${minimum}`;return material;
 }
 function emission(source:T.ShaderMaterial,amount:number,minimum:number){
  const material=source.clone();material.uniforms.cityClock=clock;
  if(material.uniforms.resolution){const viewport=new T.Vector4();material.onBeforeRender=renderer=>{renderer.getCurrentViewport(viewport);material.uniforms.resolution.value.set(Math.max(1,viewport.z),Math.max(1,viewport.w));material.uniformsNeedUpdate=true;};}
  material.vertexShader=declarations+'\n'+material.vertexShader.replace('void main(){','void main(){'+position);
  material.fragmentShader=colors+'\n'+material.fragmentShader.replace('#include <colorspace_fragment>',`gl_FragColor.rgb=cityColor(gl_FragColor.rgb,${amount.toFixed(2)},${minimum.toFixed(2)});\n#include <colorspace_fragment>`);return material;
 }
 return{clock,stone:surface(base.stone,.24),interior:surface(base.interior,.22,.58),pink:surface(base.pink,.40),cyan:surface(base.cyan,.40),amber:surface(base.amber,.27,.22),streetLamp:surface(base.streetLamp,.16,.68),wire:emission(base.wire,.38,.76),emission,
  update(time:number){clock.value=time;}
 };
}
