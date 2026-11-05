import * as T from 'three';
import { iceRefraction, iceLayerSampling } from './ice-refraction';
import { iceEnvironment } from './ice-surfaces';
import { prismLight } from './prism-light';

export const caveSampling = `${prismLight}
 vec3 cavePaint(vec3 point) {
   vec3 p=point+vec3(0,caveScroll,0);
   float stone=caveNoise(vec2(p.x+p.z*.37,p.y)*1.8);
   float grain=caveHash(floor(p.xy*90.0));
   float joint=positivePow(1.0-abs(sin(p.x*6.0+p.y*2.0+floor(p.y*1.3)*1.7)),26.0);
   vec3 rock=mix(vec3(.014,.020,.027),vec3(.09,.098,.10),stone*stone);
   rock*=.7+grain*.45;rock*=1.0-joint*.7;
   return rock+stellarCaustics(point)*(.17+stone*.25);
 }
 vec3 caveRay(vec3 origin,vec3 direction) {
   // Shallow analytic transport beyond the three captured crystal layers.
   float wall=(5.8*sign(direction.x)-origin.x)/max(abs(direction.x),.001)*sign(direction.x);
   float floorHit=(-4.0-origin.z)/(abs(direction.z)>.001?direction.z:.001);
   float roofHit=(5.0-origin.z)/(abs(direction.z)>.001?direction.z:.001);
   if(direction.z>.0 && roofHit<abs(wall))return caveRoof((origin+direction*roofHit).xy+vec2(0,caveScroll));
   if(floorHit>0.0 && floorHit<abs(wall)){
     vec3 p=origin+direction*floorHit;
     return caveRoof(p.xy+vec2(0,caveScroll))*.25+stellarCaustics(p)*.65+vec3(.006,.015,.025);
   }
   return cavePaint(origin+direction*clamp(abs(wall),0.0,90.0));
 }
`;
export function prismOptics() {
  const refraction=iceRefraction('prism-crystals-');
  const uniforms={caveScroll:{value:0},caveTime:{value:0},caveEye:{value:new T.Vector3(0,0,32)},iceViewport:{value:new T.Vector2(1,1)},
    viewToCave:{value:new T.Matrix4()},caveProjectionInverse:{value:new T.Matrix4()}};
  const surface=new T.MeshPhysicalMaterial({color:0xffffff,roughness:.035,metalness:0,flatShading:true,
    ior:1.54,specularIntensity:1.3,envMap:iceEnvironment(),envMapIntensity:1.6});
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
      vec2 red=refract(incident,normal,1.0/1.49).xy*.085;
      vec2 green=refract(incident,normal,1.0/1.54).xy*.085;
      vec2 blue=refract(incident,normal,1.0/1.60).xy*.085;
      vec3 transmitted=vec3(iceBehind(uv+red).r,iceBehind(uv+green).g,iceBehind(uv+blue).b);
      vec3 localNormal=normalize(mat3(viewToCave)*normal);
      vec3 reflected=caveRay(vCavePosition,normalize(mat3(viewToCave)*reflect(incident,normal)));
      float fresnel=.045+.955*positivePow(1.0-clamp(dot(normal,-incident),0.0,1.0),5.0);
      float fracture=positivePow(1.0-abs(sin(vCrystalPosition.y*39.0+vCrystalPosition.x*17.0+vRockId*37.0)),80.0)*.045;
      float star=positivePow(max(0.0,dot(localNormal,normalize(vec3(.65,.48,.72)))),24.0)*1.5;
      vec3 dispersion=stellarCaustics(vCavePosition);
      outgoingLight=transmitted*(1.0-fresnel)*.97+reflected*(.15+fresnel*.85)
        +(reflectedLight.directSpecular+reflectedLight.indirectSpecular)*1.5
        +vec3(star+fracture)+dispersion*(.12+fresnel*.3);
      outgoingLight=safeHDR(outgoingLight);
      #include <opaque_fragment>
      if(captureLayer>.5)gl_FragColor.a=vRockId;`);
  };
  surface.customProgramCacheKey=()=> 'prism-stellar-dispersion-v2';
  return {surface,uniforms,refraction};
}
export function caveWallMaterial(uniforms:ReturnType<typeof prismOptics>['uniforms']) {
  return new T.ShaderMaterial({side:T.DoubleSide,uniforms,
    vertexShader:`uniform float caveScroll;varying vec3 vCavePosition;
      void main(){vec3 p=position;float y=p.y+caveScroll;
      p.z+=.22*sin(y*1.4+p.x*5.0)+.17*sin(y*3.7-p.x*7.0);p.x+=.10*sin(y*2.1+p.x*8.0);vCavePosition=p;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
    fragmentShader:`${caveSampling}
      varying vec3 vCavePosition;
      void main(){vec3 n=normalize(cross(dFdx(vCavePosition),dFdy(vCavePosition)));float light=.5+.5*abs(dot(n,normalize(vec3(.65,.48,.72))));
      gl_FragColor=vec4(safeHDR(cavePaint(vCavePosition)*light),1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
}
