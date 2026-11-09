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
float cityFade(float seed){return smoothstep(-.65,.65,sin(cityClock*.25+seed));}
vec3 cityColor(vec3 base,float amount,float minimum){
 float gradient=.5+.5*sin(vCityPosition.z*1.15+vCityPosition.y*.32+vCityPosition.x*.22-cityClock*.65);
 vec3 tint=mix(vec3(1.,.035,.40),vec3(.015,.92,1.),gradient);
 float peak=max(base.r,max(base.g,base.b));
 return mix(base,peak*tint*1.25,amount)*mix(minimum,1.,cityFade(vCitySeed));
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
 return{clock,stone:surface(base.stone,.70),interior:surface(base.interior,.55,.48),pink:surface(base.pink,.90),cyan:surface(base.cyan,.90),amber:surface(base.amber,.65,.12),streetLamp:surface(base.streetLamp,.50,.55),wire:emission(base.wire,.86,.76),emission,
  update(time:number){clock.value=time;}
 };
}
