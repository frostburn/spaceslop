import * as T from 'three';
import {relief,LIGHT_COUNT,type SurfaceKind} from './layout';
import {fallbackTexture} from './fallback';

export function lightUniforms(){return{
  lightPosition:{value:Array.from({length:LIGHT_COUNT},()=>new T.Vector3())},
  lightColor:{value:Array.from({length:LIGHT_COUNT},()=>new T.Vector3())},
  lightRange:{value:new Float32Array([7,7,6,6,7,4,7,7])},
  blocker:{value:Array.from({length:6},(_,i)=>new T.Vector3(i<3?-3.1:3.8,(i%3-1)*3+(i<3?0:4),-3.1))},
  reliefGain:{value:1},transmissionGain:{value:1},occlusionGain:{value:1},emissionGain:{value:1},
};}
export type LightUniforms=ReturnType<typeof lightUniforms>;
export const occlusionShader=`uniform vec3 blocker[6];uniform float occlusionGain;
float visibility(vec3 p,vec3 light){
  if(occlusionGain<.01)return 1.;
  vec3 ray=light-p;float result=1.;
  for(int j=0;j<6;j++){
    if(distance(p,blocker[j])<.96)continue;
    float t=clamp(dot(blocker[j]-p,ray)/max(dot(ray,ray),.001),.015,.985);
    float d=length(p+ray*t-blocker[j]);
    result*=mix(1.,smoothstep(.62,.95,d),step(.02,t)*step(t,.98));
  }return mix(1.,max(.04,result),occlusionGain);
}`;

export function createSurface(kind:SurfaceKind,w:number,h:number,shared:LightUniforms){
  const geometry=new T.PlaneGeometry(w,h,32,96),p=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i++)p.setZ(i,relief(kind,uv.getX(i),uv.getY(i)));geometry.computeVertexNormals();
  const fallback=fallbackTexture(kind);
  const material=new T.ShaderMaterial({uniforms:{...shared,map:{value:fallback},texelSize:{value:new T.Vector2(1/256,1/256)},kind:{value:kind==='foreground'?2:0}},side:T.DoubleSide,transparent:kind==='foreground',depthWrite:kind!=='foreground',
    vertexShader:`varying vec2 vUv;varying vec3 worldP,worldN;
    void main(){
      vUv=uv;
      // Keep the whole painted frame registered; relief must not zoom its edges.
      vec3 flatWorld=(modelMatrix*vec4(position.xy,0.,1.)).xyz;
      worldP=(modelMatrix*vec4(position,1.)).xyz;
      worldP.xy=cameraPosition.xy+(flatWorld.xy-cameraPosition.xy)*(cameraPosition.z-worldP.z)/max(.01,cameraPosition.z-flatWorld.z);
      vec3 n=normalMatrix*normal;
      worldN=normalize(vec3(dot(viewMatrix[0].xyz,n),dot(viewMatrix[1].xyz,n),dot(viewMatrix[2].xyz,n)));
      gl_Position=projectionMatrix*viewMatrix*vec4(flatWorld,1.);
    }`,
    fragmentShader:`uniform sampler2D map;uniform vec2 texelSize;uniform int kind;
    uniform vec3 lightPosition[${LIGHT_COUNT}],lightColor[${LIGHT_COUNT}];uniform float lightRange[${LIGHT_COUNT}];
    uniform float reliefGain,transmissionGain,emissionGain;
    varying vec2 vUv;varying vec3 worldP,worldN;${occlusionShader}
    void main(){
      vec4 surface=texture2D(map,clamp(vUv,vec2(.0001),vec2(.9999)));if(kind==2&&surface.a<.01)discard;
      float structure=0.;
      if(kind==2){
        vec4 a=texture2D(map,vUv+vec2(texelSize.x*2.,0.)),b=texture2D(map,vUv-vec2(texelSize.x*2.,0.));
        vec4 c=texture2D(map,vUv+vec2(0.,texelSize.y*2.)),d=texture2D(map,vUv-vec2(0.,texelSize.y*2.));
        vec3 neighborhood=(a.rgb*a.a+b.rgb*b.a+c.rgb*c.a+d.rgb*d.a)/max(.001,a.a+b.a+c.a+d.a);
        float lum=dot(surface.rgb,vec3(.2126,.7152,.0722)),local=dot(neighborhood,vec3(.2126,.7152,.0722));
        structure=max(1.-smoothstep(.32,.62,lum),smoothstep(.008,.035,local-lum));
      }
      vec3 N=normalize(mix(vec3(0.,0.,1.),worldN,reliefGain)),V=normalize(cameraPosition-worldP),lit=vec3(0.);
      for(int i=0;i<${LIGHT_COUNT};i++){
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
        glow=pow(1.-smoothstep(.35,.83,min(surface.r,surface.g)),2.)*.35;glowColor=vec3(.015,.65,.55);
      }
      gl_FragColor=vec4(lit+glowColor*glow*emissionGain,kind==2?mix(surface.a*.35,smoothstep(.1,.85,surface.a)*.98,structure):1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  const mesh=new T.Mesh(geometry,material);mesh.name='biolume-'+kind;
  return{mesh,fallback,setArt(texture:T.Texture|undefined){const map=texture??fallback;material.uniforms.map.value=map;const image=map.image as {width?:number;height?:number}|undefined;material.uniforms.texelSize.value.set(1/Math.max(1,image?.width??256),1/Math.max(1,image?.height??256));}};
}
