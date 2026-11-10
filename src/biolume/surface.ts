import * as T from 'three';
import {atlasCrops,relief,type SurfaceKind} from './layout';
import {fallbackTexture} from './fallback';

export function lightUniforms(){return{
  lightPosition:{value:Array.from({length:6},()=>new T.Vector3())},
  lightColor:{value:Array.from({length:6},()=>new T.Vector3())},
  lightRange:{value:new Float32Array([7,7,6,6,7,4])},
  blocker:{value:Array.from({length:6},(_,i)=>new T.Vector3(i<3?-3.1:3.8,(i%3-1)*3+(i<3?0:4),-3.1))},
  reliefGain:{value:1},transmissionGain:{value:1},occlusionGain:{value:1},emissionGain:{value:1},
};}
export type LightUniforms=ReturnType<typeof lightUniforms>;
export const occlusionShader=`uniform vec3 blocker[6];uniform float occlusionGain;
float visibility(vec3 p,vec3 light){
  if(occlusionGain<.01)return 1.;
  vec3 ray=light-p;float result=1.;
  for(int j=0;j<6;j++){
    float t=clamp(dot(blocker[j]-p,ray)/max(dot(ray,ray),.001),.015,.985);
    float d=length(p+ray*t-blocker[j]);
    result*=mix(1.,smoothstep(.62,.95,d),step(.02,t)*step(t,.98));
  }return mix(1.,max(.04,result),occlusionGain);
}`;

export function createSurface(kind:SurfaceKind,w:number,h:number,shared:LightUniforms){
  const geometry=new T.PlaneGeometry(w,h,32,96),p=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i++)p.setZ(i,relief(kind,uv.getX(i),uv.getY(i)));geometry.computeVertexNormals();
  const fallback=fallbackTexture(kind),crop=new T.Vector4(0,0,1,1);
  const material=new T.ShaderMaterial({uniforms:{...shared,map:{value:fallback},crop:{value:crop},kind:{value:['ground','root','leaf','pod'].indexOf(kind)},
    repeatUV:{value:kind==='ground'?new T.Vector2(2,3):new T.Vector2(1,1)}},side:T.DoubleSide,
    vertexShader:`varying vec2 vUv;varying vec3 worldP,worldN;void main(){vUv=uv;worldP=(modelMatrix*vec4(position,1.)).xyz;worldN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*vec4(worldP,1.);}`,
    fragmentShader:`uniform sampler2D map;uniform vec4 crop;uniform vec2 repeatUV;uniform int kind;
    uniform vec3 lightPosition[6],lightColor[6];uniform float lightRange[6];
    uniform float reliefGain,transmissionGain,emissionGain;
    varying vec2 vUv;varying vec3 worldP,worldN;${occlusionShader}
    void main(){
      vec2 uv=clamp(fract(vUv*repeatUV),vec2(.002),vec2(.998));
      vec2 texUV=vec2(mix(crop.x,crop.z,uv.x),1.-mix(crop.w,crop.y,uv.y));
      vec4 surface=texture2D(map,texUV);if(surface.a<.35)discard;
      vec3 N=normalize(mix(vec3(0.,0.,1.),worldN,reliefGain)),V=normalize(cameraPosition-worldP),lit=vec3(0.);
      for(int i=0;i<6;i++){
        if(dot(lightColor[i],lightColor[i])<.000001)continue;
        vec3 delta=lightPosition[i]-worldP;float d=length(delta);vec3 L=delta/max(d,.001);
        if(d>=lightRange[i])continue;
        float fall=pow(clamp(1.-pow(d/lightRange[i],4.),0.,1.),2.)/max(d*d,.25);
        float ndl=dot(N,L),back=kind==2?max(0.,-ndl)*transmissionGain*.28:0.;
        float vis=kind==1?1.:visibility(worldP,lightPosition[i]);
        vec3 H=normalize(V+L+vec3(.00001));float spec=pow(max(0.,dot(N,H)),kind==2?36.:kind==0?22.:10.)*step(0.,ndl)*.08;
        lit+=lightColor[i]*fall*vis*(surface.rgb*(max(0.,ndl)+back)/3.14159+spec);
      }
      float glow=0.;vec3 glowColor=vec3(0.);
      if(kind==2){
        // Pale veins in the same raster register the emission without repainting it.
        glow=pow(smoothstep(.20,.43,min(surface.r,surface.g)),1.8)*.75;glowColor=vec3(.015,.65,.55);
      }
      if(kind==3){glow=sin(vUv.y*3.14159)*.28;glowColor=vec3(1.,.28,.025);}
      gl_FragColor=vec4(lit+glowColor*glow*emissionGain,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  const mesh=new T.Mesh(geometry,material);mesh.name='biolume-'+kind;
  return{mesh,fallback,setArt(texture:T.Texture|undefined){material.uniforms.map.value=texture??fallback;if(texture){crop.set(...atlasCrops[kind]);}else crop.set(0,0,1,1);}};
}
