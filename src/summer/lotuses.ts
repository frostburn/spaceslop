import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {atlasGeometries,rasterPart} from './atlas';
import {lotusLeaf} from './botany';

export const palaceLotusSites=[
  {name:'lotus-west',x:-6.6,y:3.5,z:-15.3,width:7.8,height:7.8,cell:0},
  {name:'lotus-east',x:6.6,y:3.5,z:-15.3,width:7.8,height:7.8,cell:1},
  {name:'lotus-far-wall',x:0,y:12,z:-16.2,width:13,height:26/3,cell:2},
] as const;

export function createPalaceLotuses(){
  const root=new T.Group();root.name='monumental-palace-lotuses';const clock={value:0};
  const quads=[...atlasGeometries(2,1,[[0,0,1,1],[0,0,1,1]]),new T.PlaneGeometry(1,1)],haloGeometry=new T.PlaneGeometry(1,1);
  const leaf=lotusLeaf(),fallbackGeometry:T.BufferGeometry[]=[];
  for(let layer=0;layer<3;layer++){
    const parts:T.BufferGeometry[]=[];
    for(let i=0;i<10;i++){const s=1-layer*.25,g=leaf.clone().scale(.6*s,.48*s,.3*s).translate(0,.06+layer*.025,layer*.018);g.rotateZ(i*Math.PI/5+layer*.32);parts.push(g);}
    fallbackGeometry.push(mergeGeometries(parts)!);parts.forEach(g=>g.dispose());
  }
  leaf.dispose();const core=new T.SphereGeometry(.16,16,8).scale(1,1,.32);
  const blooms=palaceLotusSites.map((site,i)=>{
    const node=new T.Group();node.name=site.name;node.position.set(site.x,site.y,site.z);root.add(node);
    const color=new T.Color(i===1?0xc49cdb:0xe5b6bc),haloMaterial=new T.ShaderMaterial({uniforms:{clock,color:{value:color},phase:{value:i*2.1}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,
      vertexShader:'varying vec2 p;void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'uniform float clock;uniform float phase;uniform vec3 color;varying vec2 p;void main(){float d=dot(p,p);float glow=exp(-d*3.4)*(1.-smoothstep(.65,1.,d));gl_FragColor=vec4(color,glow*.11*(1.+.035*sin(clock*.7+phase)));}'});
    rasterPart(node,haloGeometry,haloMaterial,site.width*1.25,site.height*1.25,0,0,-.045);
    const gain={value:1.03},bounds=new T.Vector4(i===1?.5:0,0,i<2?.5:1,1);
    const material=new T.MeshBasicMaterial({transparent:true,depthWrite:false,alphaTest:.004,side:T.DoubleSide});
    material.onBeforeCompile=s=>{s.uniforms.bloomGain=gain;s.uniforms.bloomBounds={value:bounds};s.fragmentShader='uniform float bloomGain;uniform vec4 bloomBounds;\n'+s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      #ifdef USE_MAP
      vec2 flowerUv=(vMapUv-bloomBounds.xy)/bloomBounds.zw;
      float edge=min(min(flowerUv.x,1.-flowerUv.x),min(flowerUv.y,1.-flowerUv.y));
      diffuseColor.a*=smoothstep(0.,.027,edge);
      #endif
      diffuseColor.rgb*=bloomGain;`);};
    material.customProgramCacheKey=()=> 'summer-lotus-raster-v1';
    const raster=rasterPart(node,quads[i],material,site.width,site.height);raster.visible=false;
    const fallback=new T.Group();fallback.scale.set(site.width/2,site.height/2,1);node.add(fallback);
    for(let layer=0;layer<3;layer++)fallback.add(new T.Mesh(fallbackGeometry[layer],new T.MeshBasicMaterial({color:layer===2?0xf3dfbb:color.clone().lerp(new T.Color(0xf4e6cf),layer*.3),side:T.DoubleSide})));
    const heart=new T.Mesh(core,new T.MeshBasicMaterial({color:0xffe2a1}));heart.position.z=.08;fallback.add(heart);
    return{node,raster,fallback,material,gain};
  });
  const set=(indices:readonly number[],texture:T.Texture)=>{for(const i of indices){blooms[i].material.map=texture;blooms[i].material.needsUpdate=true;blooms[i].raster.visible=true;blooms[i].fallback.visible=false;}};
  return{root,blooms,setFlanks(texture:T.Texture){set([0,1],texture);},setWall(texture:T.Texture){set([2],texture);},update(time:number){clock.value=time;blooms.forEach((b,i)=>b.gain.value=1.03+.018*Math.sin(time*.65+i*1.7));}};
}
