import * as T from 'three';
import { preserveGround, preservePools, preserveWater } from './preserve-layout';

// Bathymetry belongs to the same heightfield as the shore. Interpolating depth
// across a tessellated surface gives both transparency and a soft waterline.
export function preserveWaterSurface(g:T.BufferGeometry,river=true) {
  const p=g.attributes.position,depth:number[]=[],flow:number[]=[];
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i);depth.push(p.getZ(i)-preserveGround(x,y));
    const dx=river?(preserveWater(y+.05).x-preserveWater(y-.05).x)/.1:0;
    const s=1/Math.hypot(dx,1);flow.push(dx*s,s*(river?1:.12));
  }
  g.setAttribute('waterDepth',new T.Float32BufferAttribute(depth,1));
  g.setAttribute('waterFlow',new T.Float32BufferAttribute(flow,2));return g;
}

export function preservePoolSurface(pool:typeof preservePools[number]) {
  const p:number[]=[],uv:number[]=[],indices:number[]=[],rings=12,sides=64;
  for(let row=0;row<=rings;row++)for(let i=0;i<=sides;i++){
    const a=(i%sides)/sides*Math.PI*2,r=row/rings*(1+Math.sin(a*5)*.045);
    p.push(pool.x+Math.cos(a)*pool.rx*r,pool.y+Math.sin(a)*pool.ry*r,pool.z);uv.push(i/sides,row/rings);
    if(row<rings&&i<sides){const n=row*(sides+1)+i;indices.push(n,n+sides+1,n+1,n+1,n+sides+1,n+sides+2);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  g.setIndex(indices);g.computeVertexNormals();return preserveWaterSurface(g,false);
}

export function shadePreserveWater(water:T.MeshStandardMaterial,clock:{value:number}) {
  water.onBeforeCompile=shader=>{
    shader.uniforms.preserveFlowTime=clock;
    shader.vertexShader='attribute float waterDepth; attribute vec2 waterFlow; varying vec3 vPreserveWater; varying float vWaterDepth; varying vec2 vWaterFlow;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvPreserveWater=position;vWaterDepth=waterDepth;vWaterFlow=waterFlow;');
    shader.fragmentShader=`uniform float preserveFlowTime; varying vec3 vPreserveWater; varying float vWaterDepth; varying vec2 vWaterFlow;
      float waterHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float waterNoise(vec2 p){p=mat2(.83,.55,-.55,.83)*p;vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(waterHash(i),waterHash(i+vec2(1,0)),f.x),mix(waterHash(i+vec2(0,1)),waterHash(i+vec2(1,1)),f.x),f.y);}
      float waterHeight(vec2 p){return .025*waterNoise(p*vec2(3.2,5.7))+.010*waterNoise(p*vec2(9.3,13.1)+vec2(13.7,4.1));}
      vec3 waterNormal(vec3 eye,vec3 n,vec2 gradient,float face){
        vec3 dx=dFdx(eye),dy=dFdy(eye),r1=cross(dy,n),r2=cross(n,dx);
        float det=dot(dx,r1)*face;
        return normalize(abs(det)*n-sign(det)*(gradient.x*r1+gradient.y*r2));
      }
      `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      if(vWaterDepth<.008)discard;
      float depth=max(vWaterDepth,0.);
      vec2 current=vPreserveWater.xy-vWaterFlow*preserveFlowTime*.48;
      float turbidity=waterNoise(current*.9);
      diffuseColor.rgb=mix(vec3(.13,.23,.17),vec3(.022,.095,.083),1.-exp(-depth*1.7));
      diffuseColor.a*=smoothstep(.008,.10,depth)*(.22+.6*(1.-exp(-depth*2.2)));
      float shore=(1.-smoothstep(.035,.17,depth))*smoothstep(.48,.73,waterNoise(current*vec2(13.,6.)));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.33,.39,.27),shore*.32);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
      float height=waterHeight(current);
      normal=waterNormal(-vViewPosition,normal,vec2(dFdx(height),dFdy(height)),faceDirection);
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=.17+.13*turbidity;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
      float fresnel=.025+.35*pow(1.-max(0.,dot(normal,geometryViewDir)),4.);
      // Broad broken ceiling glints, perturbed by the moving surface. This
      // supplements direct-light specular without a second scene capture.
      float glint=pow(max(0.,1.-abs(normal.x*.75+normal.y*.65-.26)),50.);
      float broken=smoothstep(.48,.78,waterNoise(current*vec2(2.,7.)));
      reflectedLight.indirectSpecular+=vec3(.62,.79,.83)*(fresnel+glint*broken*.20);
    `);
  };
  water.customProgramCacheKey=()=> 'preserve-depth-water-v2';
}
