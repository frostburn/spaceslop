import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {SUMMER_END,SUMMER_FLOOR} from './layout';
import {lotusLeaf,meadowFlower} from './botany';
import {summerNoise} from './terrain';

function petal(){
  const p:number[]=[],uv:number[]=[],indices:number[]=[];
  for(let j=0;j<=20;j++){const t=j/20,width=Math.sin(Math.PI*t)**.75*2.8;for(const side of[-1,0,1]){p.push(side*width,9+t*8.5,SUMMER_FLOOR+1.1+Math.sin(Math.PI*t)*4.2+(1-Math.abs(side))*.45);uv.push((side+1)/2,t);}}
  for(let j=0;j<20;j++)for(let i=0;i<2;i++){const a=j*3+i;indices.push(a,a+1,a+3,a+1,a+4,a+3);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function createLotusPalace(){
  const root=new T.Group();root.name='botanical-lotus-palace';root.position.y=SUMMER_END;
  const buckets=new Map<T.Material,T.BufferGeometry[]>(),clock={value:0};
  const stone=new T.MeshStandardMaterial({color:0xbdb998,roughness:.87}),bronze=new T.MeshStandardMaterial({color:0x8b7752,metalness:.55,roughness:.49});
  stone.onBeforeCompile=s=>{s.vertexShader='varying vec3 stoneP;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nstoneP=position;');s.fragmentShader='varying vec3 stoneP;\n'+s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float ring=abs(sin(length(stoneP.xy)*8.));float spoke=abs(sin(atan(stoneP.y,stoneP.x)*24.));
    float joint=1.-smoothstep(.025,.08,min(ring,spoke));
    float grain=fract(sin(dot(floor(stoneP.xy*90.),vec2(12.98,78.233)))*43758.5453);
    diffuseColor.rgb*=.83+grain*.13-joint*.18;`);};
  stone.customProgramCacheKey=()=> 'summer-palace-inlaid-stone';
  const pink=new T.MeshStandardMaterial({color:0xc3979d,roughness:.43,metalness:.12,side:T.DoubleSide}),ivory=new T.MeshStandardMaterial({color:0xc8ceb9,roughness:.48,metalness:.1,side:T.DoubleSide});
  const foliage=new T.MeshStandardMaterial({color:0x46643b,roughness:.9,side:T.DoubleSide}),soil=new T.MeshStandardMaterial({color:0x484638,roughness:1}),bloom=new T.MeshStandardMaterial({color:0xc09bb7,roughness:.75});
  const add=(g:T.BufferGeometry,m:T.Material,at:T.Vector3=new T.Vector3(),angle=0)=>{if(g.index){const source=g;g=g.toNonIndexed();source.dispose();}g.rotateZ(angle);g.translate(at.x,at.y,at.z);const list=buckets.get(m)??[];list.push(g);buckets.set(m,list);};
  add(new T.CircleGeometry(16,80),stone,new T.Vector3(0,0,SUMMER_FLOOR+.2));
  const waterMaterial=new T.ShaderMaterial({uniforms:{clock},vertexShader:'varying vec2 p;void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform float clock;varying vec2 p;${summerNoise}
    void main(){float bed=n(p*.7)*.6+n(p*3.)*.4;vec3 c=mix(vec3(.012,.10,.09),vec3(.045,.22,.18),bed);
    float caustic=sin(p.x*7.+n(p*2.+clock*.05)*9.)*sin(p.y*8.+n(p*2.-clock*.06)*8.);
    c+=vec3(.05,.08,.055)*smoothstep(.73,.98,caustic);gl_FragColor=vec4(c,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`});
  const water=new T.Mesh(new T.CircleGeometry(8.7,80),waterMaterial);water.scale.y=1.25;water.position.z=SUMMER_FLOOR+.25;root.add(water);
  const leaf=lotusLeaf(),flower=meadowFlower();
  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4;add(petal(),i%2?pink:ivory,new T.Vector3(),angle+Math.PI/8);
    const a=angle+Math.PI/8;
    for(const r of[11.1,14.6]){
      const x=Math.cos(a)*r,y=Math.sin(a)*r;
      add(new T.CylinderGeometry(.17,.28,4.8,12).rotateX(Math.PI/2),bronze,new T.Vector3(x,y,SUMMER_FLOOR+2.6));
      add(new T.CylinderGeometry(.45,.5,.22,16).rotateX(Math.PI/2),stone,new T.Vector3(x,y,SUMMER_FLOOR+.45));
    }
    // Individual planted courts sit between the outer lotus canopies and the pool.
    const x=Math.cos(a)*10.1,y=Math.sin(a)*10.1;
    add(new T.CylinderGeometry(1.65,1.8,.55,20).rotateX(Math.PI/2),stone,new T.Vector3(x,y,SUMMER_FLOOR+.6));
    add(new T.CircleGeometry(1.48,24),soil,new T.Vector3(x,y,SUMMER_FLOOR+.89));
    for(let j=0;j<14;j++){
      const theta=j*2.39996,r=.3+(j%3)*.32,at=new T.Vector3(x+Math.cos(theta)*r,y+Math.sin(theta)*r,SUMMER_FLOOR+.91);
      add(leaf.clone().scale(.5,.8,.9).rotateX(.2),foliage,at,theta);
      if(j%4===0)add(flower.clone().scale(2.3,2.3,2.3),bloom,new T.Vector3(at.x,at.y,at.z+.35));
    }
  }
  for(const r of[8.85,11.6,15.4])add(new T.TorusGeometry(r,.08,6,96),bronze,new T.Vector3(0,0,SUMMER_FLOOR+.42));
  for(let i=0;i<54;i++){
    const a=i*2.39996,r=3.7+(i%6)*.62,x=Math.cos(a)*r,y=Math.sin(a)*r*1.2;
    add(new T.CircleGeometry(.2+(i%3)*.08,14,0,Math.PI*1.85),foliage,new T.Vector3(x,y,SUMMER_FLOOR+.29),a);
    if(i%6===0){for(let j=0;j<6;j++)add(leaf.clone().scale(.18,.23,.3),bloom,new T.Vector3(x,y,SUMMER_FLOOR+.33),j*Math.PI/3);}
  }
  leaf.dispose();flower.dispose();
  for(const [material,parts]of buckets){const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());if(g)root.add(new T.Mesh(g,material));}
  const glassMaterial=new T.MeshPhysicalMaterial({color:0xc8e0d8,metalness:.04,roughness:.17,clearcoat:.85,transparent:true,opacity:.09,depthWrite:false,side:T.FrontSide});
  glassMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',
    'diffuseColor.a*=.6+.65*pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),2.);\n#include <opaque_fragment>');};
  glassMaterial.customProgramCacheKey=()=> 'summer-glass-dome-v1';
  const dome=new T.Mesh(new T.SphereGeometry(15,48,24,0,Math.PI*2,0,Math.PI/2).rotateX(Math.PI/2).scale(1,1,23/15),glassMaterial);
  dome.position.z=SUMMER_FLOOR;dome.name='palace-glass-dome';dome.renderOrder=80;root.add(dome);
  const ribMaterial=new T.MeshStandardMaterial({color:0xc0b78c,metalness:.55,roughness:.34,transparent:true,opacity:.24,depthWrite:false}),ribs:T.BufferGeometry[]=[];
  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4,points=Array.from({length:25},(_,j)=>{const t=j/24*Math.PI/2;return new T.Vector3(Math.cos(angle)*15*Math.sin(t),Math.sin(angle)*15*Math.sin(t),SUMMER_FLOOR+23*Math.cos(t)+.045);});
    ribs.push(new T.TubeGeometry(new T.CatmullRomCurve3(points),32,.025,6,false));
  }
  const geometry=mergeGeometries(ribs);ribs.forEach(g=>g.dispose());if(geometry){const frame=new T.Mesh(geometry,ribMaterial);frame.name='dome-ribs';frame.renderOrder=81;root.add(frame);}
  return{root,dome,water,update(time:number){clock.value=time;}};
}
