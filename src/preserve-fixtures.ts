import * as T from 'three';
import { preserveLighting } from './preserve-lighting';

// Tube identities are fixed by bay, side, fixture and socket. Two empty sockets
// occur early enough to notice; a few independent ballasts stutter occasionally.
export const missingPreserveTubes = [8,55] as const;
const faultyTubes = [1,26,50,91,128];
export function preserveTubeState(id:number) {
  return missingPreserveTubes.some(n=>n===id)?'missing':faultyTubes.includes(id)?'flicker':'steady';
}
export function preserveTubeBrightness(id:number,time:number) {
  if(preserveTubeState(id)==='missing')return 0;
  if(preserveTubeState(id)==='steady')return 1;
  const period=6.3+(id%7)*.43,t=((time+id*.7919)%period+period)%period;
  return t<.10?.025:t<.18?.62:t<.24?.025:t<.34?.85:1;
}

export function shadePreserveUvGlow(material:T.MeshBasicMaterial) {
  material.onBeforeCompile=shader=>{
    shader.uniforms.fixtureCore={value:new T.Color(0xffd9ee)};
    shader.uniforms.fixturePink={value:new T.Color(preserveLighting.fixtureGlow)};
    shader.uniforms.fixtureViolet={value:new T.Color(preserveLighting.uv)};
    shader.vertexShader='varying vec2 vFixtureUv;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFixtureUv=uv;');
    shader.fragmentShader='varying vec2 vFixtureUv; uniform vec3 fixtureCore,fixturePink,fixtureViolet;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float edge=abs(vFixtureUv.x-.5)*2.;
      diffuseColor.rgb=mix(fixtureCore,fixturePink,smoothstep(.0,.30,edge));
      diffuseColor.rgb=mix(diffuseColor.rgb,fixtureViolet,smoothstep(.30,.88,edge));
      diffuseColor.a*=1.-smoothstep(.58,1.,edge);
      diffuseColor.a*=smoothstep(0.,.045,vFixtureUv.y)*(1.-smoothstep(.955,1.,vFixtureUv.y));
    `);
  };
  material.customProgramCacheKey=()=> 'preserve-uv-phosphor-gradient';
}
