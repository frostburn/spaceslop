import * as T from 'three';
import { iceRefraction, iceLayerSampling } from './ice-refraction';
import { iceEnvironment } from './ice-surfaces';

export const caveSampling = `
 uniform float caveScroll,caveTime;
 float caveHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 vec3 spectrum(float t) { return .5+.5*cos(6.2831853*(t+vec3(0.0,.333,.667))); }
 vec3 cavePaint(vec3 point) {
   vec3 p=point+vec3(0.0,caveScroll,0.0);
   vec2 tile=vec2(p.x*.8+p.z*.37,p.y*.65)+vec2(sin(p.y*.37),sin(p.x*.53+p.z*.8))*.45;
   vec2 cell=floor(tile),f=fract(tile),blend=f*f*(3.0-2.0*f);
   float stone=mix(mix(caveHash(cell),caveHash(cell+vec2(1,0)),blend.x),mix(caveHash(cell+vec2(0,1)),caveHash(cell+vec2(1,1)),blend.x),blend.y);
   float grain=caveHash(floor(vec2(p.x+p.z*.31,p.y)*32.0));
   float angle=caveHash(cell+7.0)*6.2831853;
   float joint=abs(dot(f-.5,vec2(cos(angle),sin(angle))));
   float crack=(1.0-smoothstep(.005,.020,joint))*smoothstep(.60,.8,caveHash(cell+19.0));
   float fleck=pow(max(0.0,sin(p.x*17.0+p.y*7.0+p.z*19.0)),32.0);
   float bend=sin(p.x*1.7+p.y*.4)*.3+sin(p.z*2.0-p.y*.8)*.14;
   float stripe=pow(max(0.0,sin(p.y*1.45+p.x*2.3+p.z*1.2+bend+caveTime*.12)),22.0);
   stripe*=pow(abs(sin(p.y*.31+p.z*1.4)),5.0);
   float edge=smoothstep(1.5,4.8,abs(p.x));
   vec3 rock=mix(vec3(.009,.011,.018),vec3(.026,.023,.033),stone);
   rock*=.65+grain*.55;
   float vein=pow(1.0-abs(sin(p.y*.53+p.x*2.7+sin(p.z)*.5)),60.0);
   return rock*(1.0-crack*.45)+fleck*.008
     +vein*vec3(.08,.10,.13)*edge
     +stripe*spectrum(p.y*.025+p.x*.065)*(.016+edge*.34);
 }
 vec3 caveRay(vec3 origin,vec3 direction) {
   vec2 p=vec2(origin.x/5.4,(origin.z+1.5)/6.5),d=vec2(direction.x/5.4,direction.z/6.5);
   float a=dot(d,d),b=dot(p,d),c=dot(p,p)-1.0;
   float distance=a>.00001?(-b+sqrt(max(0.0,b*b-a*c)))/a:64.0;
   return cavePaint(origin+direction*clamp(distance,0.0,90.0));
 }
`;
export function prismOptics() {
  const refraction=iceRefraction('prism-crystals-');
  const uniforms={caveScroll:{value:0},caveTime:{value:0},iceViewport:{value:new T.Vector2(1,1)},
    viewToCave:{value:new T.Matrix4()},caveProjectionInverse:{value:new T.Matrix4()}};
  const surface=new T.MeshPhysicalMaterial({color:0xffffff,roughness:.075,metalness:0,flatShading:true,
    ior:1.54,specularIntensity:1.2,envMap:iceEnvironment(),envMapIntensity:.75});
  surface.name='prism-dispersive-crystal';
  surface.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms,refraction.uniforms);
    shader.vertexShader='attribute float rockId; varying float vRockId; varying vec3 vCavePosition,vCrystalPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vRockId=rockId;vCrystalPosition=position;vCavePosition=(instanceMatrix*vec4(position,1.0)).xyz;`);
    shader.fragmentShader=`${caveSampling}
      uniform vec2 iceViewport;uniform mat4 viewToCave,caveProjectionInverse;
      varying vec3 vCavePosition,vCrystalPosition;
      vec3 caveScreen(vec2 uv) {
        vec4 ray=caveProjectionInverse*vec4(uv*2.0-1.0,1.0,1.0);
        return caveRay(vCavePosition,normalize(mat3(viewToCave)*normalize(ray.xyz/ray.w)));
      }
      ${iceLayerSampling.replace('galaxyAt(uv)','caveScreen(uv)')}
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      if(captureLayer>1.5 && abs(texture2D(previousBody0,gl_FragCoord.xy/vec2(textureSize(previousBody0,0))).a-vRockId)<.001)discard;
      if(captureLayer>2.5 && abs(texture2D(previousBody1,gl_FragCoord.xy/vec2(textureSize(previousBody1,0))).a-vRockId)<.001)discard;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
      vec2 uv=gl_FragCoord.xy/iceViewport;
      vec3 incident=-normalize(vViewPosition);
      vec2 red=refract(incident,normal,1.0/1.49).xy*.065;
      vec2 green=refract(incident,normal,1.0/1.54).xy*.065;
      vec2 blue=refract(incident,normal,1.0/1.60).xy*.065;
      vec3 transmitted=vec3(iceBehind(uv+red).r,iceBehind(uv+green).g,iceBehind(uv+blue).b);
      float thickness=.8+sin(vCrystalPosition.y*3.14159)*.5;
      transmitted*=pow(max(diffuseColor.rgb,vec3(.12)),vec3(thickness));
      vec3 reflected=caveRay(vCavePosition,normalize(mat3(viewToCave)*reflect(incident,normal)));
      float fresnel=.045+.955*pow(1.0-clamp(dot(normal,-incident),0.0,1.0),5.0);
      float fracture=pow(1.0-abs(sin(vCrystalPosition.y*39.0+vCrystalPosition.x*17.0)),48.0)*.1;
      float cloud=.06+.08*(.5+.5*sin(vRockId*937.0+vCrystalPosition.y*7.0));
      float faceLight=.045+.12*max(0.0,dot(normal,normalize(vec3(.4,.5,1.0))));
      outgoingLight=transmitted*(1.0-fresnel)*(.91-cloud)+reflected*(.1+fresnel*.85)
        +(reflectedLight.directSpecular+reflectedLight.indirectSpecular)*.85
        +diffuseColor.rgb*faceLight*cloud+fracture*diffuseColor.rgb;
      #include <opaque_fragment>
      if(captureLayer>.5)gl_FragColor.a=vRockId;`);
  };
  surface.customProgramCacheKey=()=> 'prism-layered-dispersion-v1';
  return {surface,uniforms,refraction};
}
export function caveWallMaterial(uniforms:ReturnType<typeof prismOptics>['uniforms']) {
  return new T.ShaderMaterial({side:T.DoubleSide,uniforms,
    vertexShader:`uniform float caveScroll;attribute float caveAngle;varying vec3 vCavePosition;
      void main(){vec3 p=position;float bump=1.0+.028*sin((p.y+caveScroll)*.9+caveAngle*7.0)+.018*sin((p.y+caveScroll)*2.1-caveAngle*11.0);
      p.x*=bump;p.z=-1.5+(p.z+1.5)*bump;vCavePosition=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
    fragmentShader:`${caveSampling}
      varying vec3 vCavePosition;
      void main(){vec3 n=normalize(cross(dFdx(vCavePosition),dFdy(vCavePosition)));float light=.45+.55*abs(dot(n,normalize(vec3(.4,.5,1.0))));
      gl_FragColor=vec4(cavePaint(vCavePosition)*light,1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
}
