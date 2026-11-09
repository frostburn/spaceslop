import * as T from 'three';
import {SUMMER_END,SUMMER_FLOOR,summerRiver,summerShoreDistance} from './layout';
import {grassTuft,meadowFlower} from './botany';
export const summerNoise=`float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
 float n(vec2 p){vec2 a=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(a),hash(a+vec2(1.,0.)),f.x),mix(hash(a+vec2(0.,1.)),hash(a+1.),f.x),f.y);}`;
export function createSummerTerrain(){
  const root=new T.Group();root.name='summer-steppe';const clock={value:0};
  const ground=new T.Mesh(new T.PlaneGeometry(44,SUMMER_END+90,12,96),new T.ShaderMaterial({uniforms:{clock},
    vertexShader:'varying vec2 p;void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform float clock;varying vec2 p;${summerNoise}
      void main(){vec2 q=p+vec2(0.,${((SUMMER_END+90)/2-30).toFixed(3)});
        float river=1.4*sin(q.y*.036)+.65*sin(q.y*.087+1.);
        float width=1.15+.4*sin(q.y*.05+1.)+.18*sin(q.y*.13);
        float d=abs(q.x-river),shore=n(q*2.3)*.17+n(q*7.)*.05;
        float braid=abs(q.x-river-2.1-sin(q.y*.15)*1.6);
        float branch=smoothstep(30.,44.,q.y)*(1.-smoothstep(153.,170.,q.y));
        d=min(d,mix(20.,braid+width-.3,branch));
        float coarse=n(q*.37),grain=n(q*15.)*.7+n(q*41.)*.3,dry=smoothstep(.4,.82,n(q*.11+9.));
        vec3 grass=mix(vec3(.035,.085,.014),vec3(.22,.28,.055),coarse*.6+dry*.4)*(.7+grain*.55);
        grass=mix(grass,vec3(.22,.16,.07),smoothstep(.65,.86,n(q*.28+14.))*.64);
        grass+=vec3(.028,.037,.01)*smoothstep(.4,.7,n(q*vec2(25.,6.)));
        vec3 water=mix(vec3(.012,.12,.145),vec3(.065,.30,.265),coarse);
        float flow=n(vec2(q.x*9.+sin(q.y*.5),q.y*1.8-clock*.35));
        float wave=sin(q.y*12.-clock*2.5+flow*9.+q.x*2.);
        water+=vec3(.06,.11,.09)*smoothstep(.88,.99,wave)*smoothstep(.52,.8,flow);
        float bank=smoothstep(width+shore-.07,width+shore+.1,d),mud=1.-smoothstep(width+.1,width+.6,d);
        grass=mix(grass,vec3(.18,.15,.085)*(.7+grain*.4),mud*.85);
        gl_FragColor=vec4(mix(water,grass,bank),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`}));
  ground.position.set(0,(SUMMER_END+90)/2-30,SUMMER_FLOOR);root.add(ground);
  const leaf=grassTuft(),flowerGeometry=meadowFlower(),rockGeometry=new T.IcosahedronGeometry(1,1);
  const leafMaterial=new T.MeshStandardMaterial({color:0xffffff,roughness:.96,side:T.DoubleSide}),flowerMaterial=new T.MeshStandardMaterial({color:0xffffff,roughness:.85}),rockMaterial=new T.MeshStandardMaterial({color:0x727362,roughness:1});
  const dummy=new T.Object3D(),color=new T.Color();let seed=7913;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const patches=Array.from({length:10},(_,i)=>{
    const node=new T.Group(),origin=i*28;node.position.y=origin;root.add(node);
    const leaves=new T.InstancedMesh(leaf,leafMaterial,360),flowers=new T.InstancedMesh(flowerGeometry,flowerMaterial,170),rocks=new T.InstancedMesh(rockGeometry,rockMaterial,18);node.add(leaves,flowers,rocks);
    for(let j=0;j<leaves.count;j++){
      let x=(random()-.5)*19,y=random()*28-9;while(summerShoreDistance(x,origin+y)<.6)x=(random()-.5)*19;
      dummy.position.set(x,y,SUMMER_FLOOR+.02);dummy.rotation.set(0,0,random()*6.28);dummy.scale.setScalar(.6+random()*1.3);dummy.updateMatrix();leaves.setMatrixAt(j,dummy.matrix);
      color.setHSL(.19+random()*.11,.38+random()*.2,.14+random()*.12);leaves.setColorAt(j,color);
    }
    for(let j=0;j<flowers.count;j++){
      const cluster=j%5,y=Math.floor(j/5)/34*28-8+random()*.8;
      let x=(cluster%2?1:-1)*(3+cluster*.8+Math.sin(y*.36+i)*1.7+random()*1.8);while(summerShoreDistance(x,origin+y)<.65)x+=x<0?-.35:.35;
      dummy.position.set(x,y,SUMMER_FLOOR+.25+random()*.2);dummy.rotation.set(0,0,random()*6.28);dummy.scale.setScalar(.7+random()*.8);dummy.updateMatrix();flowers.setMatrixAt(j,dummy.matrix);
      color.setHex([0xc5b951,0x9b8bb7,0xdccfa9,0x817ca5,0xcebb69][cluster]);flowers.setColorAt(j,color);
    }
    for(let j=0;j<rocks.count;j++){
      const y=random()*28-9,x=summerRiver(origin+y)+(j%2?1:-1)*(2+random()*1.4),s=.12+random()*.35;
      dummy.position.set(x,y,SUMMER_FLOOR+.05);dummy.rotation.set(random(),random(),random()*6.28);dummy.scale.set(s,s*(.7+random()),s*.5);dummy.updateMatrix();rocks.setMatrixAt(j,dummy.matrix);
    }
    return{node,origin};
  });
  return{root,ground,patches,update(scroll:number,time:number){clock.value=time;for(const p of patches)p.node.visible=Math.abs(p.origin-scroll)<43;},
    prime(){const before=patches.map(p=>[p.node.visible,p.node.position.y] as const);patches.forEach(p=>{p.node.visible=true;p.node.position.y=0;});return()=>patches.forEach((p,i)=>{p.node.visible=before[i][0];p.node.position.y=before[i][1];});}};
}
