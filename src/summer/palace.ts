import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {SUMMER_END,SUMMER_FLOOR} from './layout';
import {lotusLeaf,meadowFlower} from './botany';
import {createSummerSkyState,summerWaterVertex,summerWaterReflection,type SummerSkyState} from './clouds';
import {createPalaceLotuses} from './lotuses';
import {weatherSummerSurface} from './weathering';

export function createLotusPalace(sharedSky?:SummerSkyState){
  const root=new T.Group();root.name='botanical-lotus-palace';root.position.y=SUMMER_END;
  const buckets=new Map<T.Material,T.BufferGeometry[]>(),clock={value:0};
  const sky=sharedSky??createSummerSkyState();
  const lotuses=createPalaceLotuses();root.add(lotuses.root);
  const stone=new T.MeshStandardMaterial({color:0xbdb998,roughness:.87}),bronze=new T.MeshStandardMaterial({color:0x8b7752,metalness:.55,roughness:.49});
  stone.onBeforeCompile=s=>{s.vertexShader='varying vec3 stoneP;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nstoneP=position;');s.fragmentShader='varying vec3 stoneP;\n'+s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    float ring=abs(sin(length(stoneP.xy)*8.));float spoke=abs(sin(atan(stoneP.y,stoneP.x)*24.));
    float joint=1.-smoothstep(.025,.08,min(ring,spoke));
    float grain=fract(sin(dot(floor(stoneP.xy*90.),vec2(12.98,78.233)))*43758.5453);
    diffuseColor.rgb*=.83+grain*.13-joint*.18;
    float lowStone=1.-smoothstep(-17.4,-16.8,stoneP.z);
    float poolR=length(stoneP.xy/vec2(1.,1.25));
    float tide=(1.-smoothstep(.05,.65,abs(poolR-8.8)))*lowStone;
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.105,.13,.068),tide*.34+joint*lowStone*.12);`);};
  stone.customProgramCacheKey=()=> 'summer-palace-inlaid-stone';
  weatherSummerSurface(stone,'stone');weatherSummerSurface(bronze,'bronze');
  const foliage=new T.MeshStandardMaterial({color:0x46643b,roughness:.9,side:T.DoubleSide}),soil=new T.MeshStandardMaterial({color:0x484638,roughness:1}),bloom=new T.MeshStandardMaterial({color:0xc09bb7,roughness:.75});
  const add=(g:T.BufferGeometry,m:T.Material,at:T.Vector3=new T.Vector3(),angle=0)=>{if(g.index){const source=g;g=g.toNonIndexed();source.dispose();}g.rotateZ(angle);g.translate(at.x,at.y,at.z);const list=buckets.get(m)??[];list.push(g);buckets.set(m,list);};
  add(new T.CircleGeometry(16,80),stone,new T.Vector3(0,0,SUMMER_FLOOR+.2));
  const farWall=new T.Shape(),start=Math.PI/2-.7,end=Math.PI/2+.7;
  farWall.moveTo(Math.cos(start)*15.8,Math.sin(start)*15.8);farWall.absarc(0,0,15.8,start,end,false);farWall.lineTo(Math.cos(end)*13.5,Math.sin(end)*13.5);farWall.absarc(0,0,13.5,end,start,true);farWall.closePath();
  add(new T.ExtrudeGeometry(farWall,{depth:.8,bevelEnabled:true,bevelThickness:.06,bevelSize:.08,bevelSegments:1,curveSegments:28}),stone,new T.Vector3(0,0,SUMMER_FLOOR+.6));
  add(new T.TorusGeometry(14.7,.11,8,64,1.4),bronze,new T.Vector3(0,0,SUMMER_FLOOR+1.4),start);
  add(new T.BoxGeometry(2.1,5.2,.38),bronze,new T.Vector3(0,10.4,-17.1));
  const waterMaterial=new T.ShaderMaterial({uniforms:{clock,...sky.uniforms},vertexShader:summerWaterVertex,fragmentShader:`uniform float clock;varying vec2 p;${summerWaterReflection}
    void main(){float bed=n(p*.7)*.6+n(p*3.)*.4;vec3 c=mix(vec3(.012,.10,.09),vec3(.045,.22,.18),bed);
    float caustic=sin(p.x*7.+n(p*2.+clock*.05)*9.)*sin(p.y*8.+n(p*2.-clock*.06)*8.);
    c+=vec3(.015,.024,.018)*smoothstep(.73,.98,caustic);gl_FragColor=vec4(summerReflectClouds(c),1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    }`});
  const water=new T.Mesh(new T.CircleGeometry(8.7,80),waterMaterial);water.name='lotus-reflecting-pool';water.scale.y=1.25;water.position.z=SUMMER_FLOOR+.25;root.add(water);
  const leaf=lotusLeaf(),flower=meadowFlower();
  // A complete annular trellis carries the dome at its outer waist. Both rows
  // of posts seat into the same beams instead of ending below empty glass.
  const inner=11.1,outer=14.6,roofZ=SUMMER_FLOOR+23*Math.sqrt(1-(outer/15)**2),footZ=SUMMER_FLOOR+.56;
  for(const r of[inner,outer])add(new T.TorusGeometry(r,.16,8,128),bronze,new T.Vector3(0,0,roofZ));
  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4;
    const a=angle+Math.PI/8;
    for(const r of[inner,outer]){
      const x=Math.cos(a)*r,y=Math.sin(a)*r;
      add(new T.CylinderGeometry(.17,.28,roofZ-footZ,12).rotateX(Math.PI/2),bronze,new T.Vector3(x,y,(roofZ+footZ)/2));
      add(new T.CylinderGeometry(.36,.24,.22,12).rotateX(Math.PI/2),bronze,new T.Vector3(x,y,roofZ-.1));
      add(new T.CylinderGeometry(.45,.5,.22,16).rotateX(Math.PI/2),stone,new T.Vector3(x,y,SUMMER_FLOOR+.45));
    }
    const beam=new T.BoxGeometry(outer-inner,.22,.26);add(beam,bronze,new T.Vector3(Math.cos(a)*(inner+outer)/2,Math.sin(a)*(inner+outer)/2,roofZ),a);
    for(const r of[inner,outer]){
      const from=new T.Vector3(Math.cos(a)*r,Math.sin(a)*r,roofZ-.9),to=new T.Vector3(Math.cos(a)*(r+(r===inner?.8:-.8)),Math.sin(a)*(r+(r===inner?.8:-.8)),roofZ);
      const brace=new T.CylinderGeometry(.07,.07,from.distanceTo(to),8);brace.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),to.clone().sub(from).normalize()));
      add(brace,bronze,from.add(to).multiplyScalar(.5));
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
  return{root,dome,water,lotuses,update(time:number){clock.value=time;lotuses.update(time);if(!sharedSky)sky.update(0,time);}};
}
