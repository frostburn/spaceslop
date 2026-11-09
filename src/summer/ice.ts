import * as T from 'three';
import {atlasRectangles,rasterPart} from './atlas';
import {smooth} from './layout';
export function createSummerIce(){
  const root=new T.Group();root.name='palette-animated-thaw';const clock={value:0},material=new T.MeshBasicMaterial({alphaTest:.25,side:T.DoubleSide});
  material.onBeforeCompile=shader=>{
    shader.uniforms.thawClock=clock;
    shader.vertexShader='varying vec3 icePosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nicePosition=position;');
    shader.fragmentShader='uniform float thawClock;varying vec3 icePosition;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      float lum=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      float iceMask=smoothstep(.015,.10,diffuseColor.b-diffuseColor.r*.7);
      float phase=fract(lum*5.+thawClock*.075+sin(icePosition.y*7.+icePosition.x*11.)*.07);
      vec3 cold=mix(vec3(.12,.35,.38),vec3(.58,.72,.81),smoothstep(.1,.65,phase));
      cold=mix(cold,vec3(.93,.95,.92),smoothstep(.68,.95,phase));
      float stream=pow(max(0.,sin(icePosition.y*39.-thawClock*1.4+sin(icePosition.x*14.))),14.);
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.78+cold*.22,iceMask);
      diffuseColor.rgb+=iceMask*stream*(1.-smoothstep(.55,.9,lum))*vec3(.035,.06,.065);`);
  };material.customProgramCacheKey=()=> 'summer-thaw-palette-v1';
  const geometries=atlasRectangles([[5/1246,51/1262,598/1246,615/1262],[613/1246,4/1262,1242/1246,628/1262],[3/1246,655/1262,603/1246,1219/1262],[609/1246,635/1262,1243/1246,1255/1262]]);
  const fallbackMaterial=new T.MeshStandardMaterial({color:0xb9d8db,roughness:.69,metalness:.06}),snow=new T.MeshStandardMaterial({color:0xe6e7dc,roughness:.95});
  const fallbackTemplate=new T.Group();
  for(let j=0;j<5;j++){
    const g=new T.IcosahedronGeometry(1,1),ice=new T.Mesh(g,fallbackMaterial);ice.scale.set(2.7,2.1,1);ice.position.set((j-2)*1.5,Math.sin(j*2)*.8,0);fallbackTemplate.add(ice);
    const cap=new T.Mesh(g,snow);cap.scale.set(2.3,1.9,.28);cap.position.copy(ice.position);cap.position.z=.8;fallbackTemplate.add(cap);
  }
  const modules=Array.from({length:24},(_,i)=>{
    const node=new T.Group(),raster=new T.Group(),fallback=fallbackTemplate.clone(true);root.add(node);node.add(raster,fallback);
    node.position.set((i%2?1:-1)*(11.4+(i%3)*.6),Math.floor(i/2)*27-12,-17.55+(i%2)*.04);
    node.position.x+=(i%2?1:-1)*9*smooth((node.position.y-220)/45);
    node.rotation.z=(i%2?-.08:.08)+(i%3-1)*.12;
    rasterPart(raster,geometries[i%4],material,11.5+(i%3),15+(i%2)*2);fallback.scale.set(1.15,2.5,.4);
    raster.visible=false;return{node,raster,fallback};
  });
  return{root,material,modules,setAtlas(texture:T.Texture){material.map=texture;material.needsUpdate=true;for(const m of modules){m.raster.visible=true;m.fallback.visible=false;}},
    update(scroll:number,time:number){clock.value=time;for(const m of modules)m.node.visible=Math.abs(m.node.position.y-scroll)<48;},
    prime(){const states=modules.map(m=>[m.node.visible,m.node.position.y] as const);modules.forEach((m,i)=>{m.node.visible=i<4;m.node.position.y=0;});return()=>modules.forEach((m,i)=>{m.node.visible=states[i][0];m.node.position.y=states[i][1];});}};
}
