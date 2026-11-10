import * as T from 'three';
import {SUMMER_END} from './layout';
import {summerNoise} from './noise';

export const SUMMER_CLOUD_HEIGHT=120;
export function createSummerSkyState(){
  const uniforms={summerSkyTime:{value:0},summerSkyScroll:{value:0},summerReflection:{value:1}};
  return{uniforms,update(scroll:number,time:number){uniforms.summerSkyScroll.value=scroll;uniforms.summerSkyTime.value=time;}};
}
export type SummerSkyState=ReturnType<typeof createSummerSkyState>;

// Both the overhead sheet and the water sample this same drifting world-space sky.
const cloudSky=`${summerNoise}
 uniform float summerSkyTime;uniform float summerSkyScroll;uniform float summerReflection;
 vec3 summerCloudRadiance(vec2 field){
   vec2 q=field*vec2(.043,.037)-vec2(.009,.005)*summerSkyTime+vec2(4.7,11.3);
   q+=vec2(n(q*.61+8.2),n(q*.61-5.7))*.65;
   mat2 turn=mat2(.8,-.6,.6,.8);
   float density=n(q)*.58+n(turn*q*2.07+17.3)*.29+n(q*4.13-9.1)*.13;
   float cloud=smoothstep(.48,.69,density);
   vec3 clear=vec3(.22,.44,.67);
   vec3 white=mix(vec3(2.6,3.05,3.3),vec3(6.4,6.6,6.35),smoothstep(.56,.79,density));
   return mix(clear,white,cloud);
 }
`;
export const summerWaterVertex=`varying vec2 p;varying vec3 summerWaterWorld;
 void main(){p=position.xy;vec4 world=modelMatrix*vec4(position,1.);summerWaterWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`;

export const summerWaterReflection=`${cloudSky}
 varying vec3 summerWaterWorld;
 vec3 summerReflectClouds(vec3 bed){
   vec2 field=summerWaterWorld.xy+vec2(0.,summerSkyScroll);
   float t=summerSkyTime;
   vec2 ripples=vec2(sin(field.y*5.1-field.x*.8-t*1.7),cos(field.x*7.3+field.y*2.4-t*1.2))*.0025;
   ripples+=(vec2(n(field*1.3+vec2(t*.13,0.)),n(field*1.7-vec2(0.,t*.17)))-.5)*.007;
   vec3 normal=normalize(vec3(ripples,1.));
   vec3 eye=normalize(cameraPosition-summerWaterWorld);
   vec3 ray=reflect(-eye,normal);
   float toSky=(${SUMMER_CLOUD_HEIGHT.toFixed(1)}-summerWaterWorld.z)/max(ray.z,.04);
   vec2 reflected=summerWaterWorld.xy+ray.xy*toSky+vec2(0.,summerSkyScroll);
   vec3 sky=summerCloudRadiance(reflected);
   float fresnel=.025+.975*pow(1.-clamp(dot(eye,normal),0.,1.),5.);
   return mix(bed,bed*(1.-fresnel)+sky*fresnel,summerReflection);
 }
`;

export function createSummerClouds(){
  const state=createSummerSkyState(),root=new T.Group();root.name='summer-overhead-clouds';
  const material=new T.ShaderMaterial({uniforms:state.uniforms,side:T.DoubleSide,
    vertexShader:'varying vec3 field;void main(){vec4 world=modelMatrix*vec4(position,1.);field=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}',
    fragmentShader:`varying vec3 field;${cloudSky}
      void main(){gl_FragColor=vec4(summerCloudRadiance(field.xy+vec2(0.,summerSkyScroll)),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
  const sheet=new T.Mesh(new T.PlaneGeometry(400,SUMMER_END+400),material);sheet.name='summer-cloud-sheet';sheet.position.set(0,SUMMER_END/2,SUMMER_CLOUD_HEIGHT);root.add(sheet);
  return{root,state,update:state.update};
}
