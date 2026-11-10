import * as T from 'three';
import {SUMMER_END,SUMMER_FLOOR,summerRiver,summerShoreDistance} from './layout';
import {grassTuft,meadowFlower} from './botany';
import {createSummerSkyState,summerWaterVertex,summerWaterReflection,type SummerSkyState} from './clouds';
import {summerChannel,summerRiverShader} from './river';
import {createRiverGardens} from './gardens';
import {weatherSummerSurface} from './weathering';
export function createSummerTerrain(sharedSky?:SummerSkyState){
  const root=new T.Group();root.name='summer-steppe';const clock={value:0},windScroll={value:0},gardens=createRiverGardens();root.add(gardens.root);
  const sky=sharedSky??createSummerSkyState();
  const ground=new T.Mesh(new T.PlaneGeometry(44,SUMMER_END+90,12,96),new T.ShaderMaterial({uniforms:{clock,...sky.uniforms},
    vertexShader:summerWaterVertex,
    fragmentShader:`uniform float clock;varying vec2 p;${summerWaterReflection}${summerRiverShader()}
      void main(){vec2 q=p+vec2(0.,${((SUMMER_END+90)/2-30).toFixed(3)});
        vec4 channel=summerChannel(q.y);
        float width=channel.y,side=(q.x-channel.x)/sqrt(1.+channel.z*channel.z);
        float d=abs(side),shore=(n(q*2.3)-.5)*.16+(n(q*7.)-.5)*.05;
        float coarse=n(q*.37),grain=n(q*15.)*.7+n(q*41.)*.3,dry=smoothstep(.4,.82,n(q*.11+9.));
        vec3 grass=mix(vec3(.035,.085,.014),vec3(.22,.28,.055),coarse*.6+dry*.4)*(.7+grain*.55);
        grass=mix(grass,vec3(.22,.16,.07),smoothstep(.65,.86,n(q*.28+14.))*.64);
        grass+=vec3(.028,.037,.01)*smoothstep(.4,.7,n(q*vec2(25.,6.)));
        vec2 relief=vec2(n((q+vec2(.15,0.))*.37)-n((q-vec2(.15,0.))*.37),n((q+vec2(0.,.15))*.37)-n((q-vec2(0.,.15))*.37));
        grass*=clamp(1.+dot(relief,vec2(1.2,-1.8)),.8,1.18);
        vec3 water=mix(vec3(.012,.12,.145),vec3(.065,.30,.265),coarse);
        float flow=n(vec2(q.x*9.+sin(q.y*.5),q.y*1.8-clock*.35));
        water+=vec3(.012,.022,.018)*smoothstep(.72,.96,flow);
        float foam=(1.-smoothstep(.02,.14,abs(d-width+.09)))*smoothstep(.64,.83,n(vec2(q.x*4.,q.y*3.-clock*.25)));
        water+=vec3(.05,.065,.045)*foam;
        float bank=smoothstep(width+shore-.07,width+shore+.1,d),mud=1.-smoothstep(width+.08,width+.72+(n(q*.8)-.5)*.35,d);
        if(bank<1.)water=summerReflectClouds(water);
        float inner=clamp(side*channel.w*18.,0.,1.);
        float bar=smoothstep(.35,.96,d/width)*inner*(.5+.5*n(q*.7));
        water=mix(water,vec3(.24,.205,.13)*(.78+grain*.35),bar*.88);
        float damp=1.-smoothstep(width+.1,width+.45,d);
        vec3 soil=mix(vec3(.23,.18,.10),vec3(.085,.08,.043),damp)*(.74+grain*.36);
        grass=mix(grass,soil,mud*.9);
        float bare=smoothstep(.57,.8,n(q*.65+7.8))*(1.-smoothstep(width+.7,width+2.4,d))*(1.-mud);
        grass=mix(grass,soil,bare*.35);
        water=mix(water,vec3(.12,.16,.10),smoothstep(width-.55,width,d)*.13);
        gl_FragColor=vec4(mix(water,grass,bank),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`}));
  ground.name='summer-meltwater-meadow';ground.position.set(0,(SUMMER_END+90)/2-30,SUMMER_FLOOR);root.add(ground);
  const leaf=grassTuft(),flowerGeometry=meadowFlower(),rockGeometry=new T.IcosahedronGeometry(1,1);
  const leafMaterial=new T.MeshStandardMaterial({color:0xffffff,roughness:.96,side:T.DoubleSide}),flowerMaterial=new T.MeshStandardMaterial({color:0xffffff,roughness:.85}),rockMaterial=new T.MeshStandardMaterial({color:0x727362,roughness:1});
  weatherSummerSurface(rockMaterial,'rock');
  leafMaterial.onBeforeCompile=shader=>{shader.uniforms.summerWindTime=clock;shader.uniforms.summerWindScroll=windScroll;
    shader.vertexShader='uniform float summerWindTime;uniform float summerWindScroll;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec3 stem=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;
      float wind=summerWindTime*1.3+(stem.y+summerWindScroll)*.8+stem.x*.6;
      float tip=pow(position.z/.62,2.);
      transformed.xy+=vec2(sin(wind)*.11,cos(wind*.79)*.065)*tip;`);};
  leafMaterial.customProgramCacheKey=()=> 'summer-instanced-bank-wind';
  const dummy=new T.Object3D(),color=new T.Color();let seed=7913;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const patches=Array.from({length:10},(_,i)=>{
    const node=new T.Group(),origin=i*28;node.position.y=origin;root.add(node);
    const leaves=new T.InstancedMesh(leaf,leafMaterial,360),flowers=new T.InstancedMesh(flowerGeometry,flowerMaterial,170),rocks=new T.InstancedMesh(rockGeometry,rockMaterial,18);node.add(leaves,flowers,rocks);
    for(let j=0;j<leaves.count;j++){
      let x=(random()-.5)*19,y=random()*28-9;while(summerShoreDistance(x,origin+y)<.6)x=(random()-.5)*19;
      if(j<110){const c=summerChannel(origin+y);x=c.x+(j%2?1:-1)*(c.width*Math.sqrt(1+c.slope**2)+.35+random()*.7);}
      dummy.position.set(x,y,SUMMER_FLOOR+.02);dummy.rotation.set(0,0,random()*6.28);const size=.6+random()*1.3;dummy.scale.set(size,size,size*(j<110?1.6:1));dummy.updateMatrix();leaves.setMatrixAt(j,dummy.matrix);
      color.setHSL(.19+random()*.11,.38+random()*.2,.14+random()*.12);leaves.setColorAt(j,color);
    }
    const clusters=Array.from({length:5},(_,j)=>({x:(j%2?1:-1)*(3.6+random()*3.4),y:random()*25-7}));
    for(let j=0;j<flowers.count;j++){
      const cluster=j%5,center=clusters[cluster],angle=random()*Math.PI*2,r=Math.sqrt(random())*1.85,y=center.y+Math.sin(angle)*r*1.4;
      let x=center.x+Math.cos(angle)*r;while(summerShoreDistance(x,origin+y)<.65)x+=center.x<0?-.35:.35;
      dummy.position.set(x,y,SUMMER_FLOOR+.25+random()*.2);dummy.rotation.set(0,0,random()*6.28);dummy.scale.setScalar(.7+random()*.8);dummy.updateMatrix();flowers.setMatrixAt(j,dummy.matrix);
      color.setHex([0xc5b951,0x9b8bb7,0xdccfa9,0x817ca5,0xcebb69][random()<.14?(cluster+2)%5:cluster]);flowers.setColorAt(j,color);
    }
    for(let j=0;j<rocks.count;j++){
      const y=random()*28-9,channel=summerChannel(origin+y),x=summerRiver(origin+y)+(j%2?1:-1)*(channel.width*Math.sqrt(1+channel.slope**2)+.2+random()*.7),s=.12+random()*.35;
      dummy.position.set(x,y,SUMMER_FLOOR+.05);dummy.rotation.set(random(),random(),random()*6.28);dummy.scale.set(s,s*(.7+random()),s*.5);dummy.updateMatrix();rocks.setMatrixAt(j,dummy.matrix);
    }
    return{node,origin};
  });
  return{root,ground,patches,gardens,clock,update(scroll:number,time:number){clock.value=time;windScroll.value=scroll;gardens.update(scroll);if(!sharedSky)sky.update(scroll,time);for(const p of patches)p.node.visible=Math.abs(p.origin-scroll)<43;},
    prime(){const restoreGardens=gardens.prime(),before=patches.map(p=>[p.node.visible,p.node.position.y] as const);patches.forEach(p=>{p.node.visible=true;p.node.position.y=0;});return()=>{restoreGardens();patches.forEach((p,i)=>{p.node.visible=before[i][0];p.node.position.y=before[i][1];});};}};
}
