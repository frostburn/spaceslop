import * as T from 'three';
import { sealMarineTube } from './marine-geometry';
import { marineJawGeometry, marineEyeFrame, JAW_HINGE_Y, JAW_HINGE_Z } from './marine-jaw';
import { part, pivot } from './rig-geometry';
import { iceEnvironment } from './ice-surfaces';
import { leviathanMotion, type MarineKind } from './marine';

type Animal = MarineKind | 'mosasaur';
const hideMaterials: T.MeshPhysicalMaterial[] = [];
type SkinPattern = 'plain' | 'stripes' | 'spots';
const skins = new Map<string, T.MeshPhysicalMaterial>();
let hideTexture: T.Texture | undefined;
function skin(scales = 0, pattern: SkinPattern = 'plain') {
  const key = `${scales}/${pattern}`;
  if (skins.has(key)) return skins.get(key)!;
  const material = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: .48, metalness: 0,
    clearcoat: .22, clearcoatRoughness: .3, envMap: iceEnvironment(), envMapIntensity: .35, bumpScale: .025 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute vec3 hideCoord; varying vec3 vHide;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvHide=hideCoord;');
    shader.fragmentShader = `varying vec3 vHide;\n` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP\n vec3 detail=texture2D(map,vMapUv).rgb;diffuseColor.rgb*=clamp(detail*1.4+0.72,0.8,1.18);\n #endif`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float mottling = sin(vHide.x*19.0+sin(vHide.y*13.0)*2.0)*sin(vHide.y*23.0+vHide.z*17.0);
      float broad = sin(vHide.x*7.0+sin(vHide.y*6.0))*sin(vHide.z*9.0+vHide.y*4.0);
      diffuseColor.rgb *= 0.86 + mottling*0.075 + broad*0.10;
      ${pattern === 'stripes' ? `
      float band = 1.0-smoothstep(.26,.49,abs(sin(vHide.y*11.0+sin(vHide.x*7.0+vHide.z*3.0)*.65)));
      float back = .3+.7*smoothstep(-.18,.12,vHide.z);
      diffuseColor.rgb *= mix(1.14,.46,band*back);` : pattern === 'spots' ? `
      vec2 p = vec2(vHide.x+sin(vHide.y*2.1)*.12,vHide.y+vHide.z*.3)*6.0;
      vec2 cell = floor(p); float spots = 0.0;
      for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++) {
        vec2 c = cell+vec2(float(x),float(y));
        float h = fract(sin(dot(c,vec2(127.1,311.7)))*43758.5453);
        float h2 = fract(sin(dot(c,vec2(269.5,183.3)))*41563.123);
        vec2 q = (p-c-vec2(.2+h*.6,.2+h2*.6))/vec2(.23+h*.21,.23+h2*.19);
        float d = dot(q,q)+sin(q.x*7.0+q.y*5.0)*.13;
        spots = max(spots,(1.0-smoothstep(.6,1.25,d))*smoothstep(.18,.34,h2));
      }
      float back = .2+.8*smoothstep(-.22,.12,vHide.z);
      diffuseColor.rgb *= mix(1.22,.48,spots*back);` : ''}
      ${scales ? `vec2 scaleCell = fract(vec2(vHide.x*69.0+sin(vHide.y*100.0)*.13,vHide.y*100.0));
      float seam = smoothstep(.38,.49,max(abs(scaleCell.x-.5),abs(scaleCell.y-.5)));
      diffuseColor.rgb *= 1.0-seam*.13;` : ''}`);
  };
  material.customProgramCacheKey = () => `marine-hide-v2-${key}`;
  if (hideTexture) { material.map = material.bumpMap = hideTexture; }
  skins.set(key, material); hideMaterials.push(material); return material;
}
export function setMarineTexture(texture: T.Texture) {
  hideTexture = texture;
  texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.repeat.set(2,3);
  for (const material of hideMaterials) { material.map = material.bumpMap = texture; material.needsUpdate = true; }
}

const geometryCache = new Map<string,T.BufferGeometry>();
const dorsal = new T.Color(0x35434a), flank = new T.Color(0x82908c), belly = new T.Color(0xcfc6ac), tint = new T.Color();
function tintGeometry(geometry: T.BufferGeometry, fin = false) {
  const positions = geometry.getAttribute('position'), colors: number[] = [];
  for (let i=0;i<positions.count;i++) {
    const shade = fin ? T.MathUtils.smoothstep(positions.getZ(i),-.015,.025) : T.MathUtils.smoothstep(positions.getZ(i),-.12,.14);
    tint.copy(belly).lerp(flank,Math.min(1,shade*2)).lerp(dorsal,Math.max(0,shade*2-1)); colors.push(tint.r,tint.g,tint.b);
  }
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geometry.setAttribute('hideCoord',positions.clone()); return geometry;
}
const profiles: Record<MarineKind, number[][]> = {
  ichthyosaur: [[-1.45,.025,.04],[-1.1,.09,.11],[-.65,.22,.25],[-.15,.35,.34],[.4,.29,.28],[.75,.23,.21],[.93,.12,.10],[1.3,.075,.06],[1.62,.008,.012]],
  plesiosaur: [[-1.1,.008,.01],[-.8,.18,.12],[-.3,.43,.29],[.25,.4,.30],[.58,.23,.21],[.9,.17,.17],[1.4,.14,.14],[1.85,.13,.12],[2.03,.20,.14],[2.24,.16,.11],[2.42,.018,.025]],
};
function bodyGeometry(kind: MarineKind) {
  if(geometryCache.has(kind))return geometryCache.get(kind)!;
  const curve = new T.CatmullRomCurve3(profiles[kind].map(([y,w,h])=>new T.Vector3(w,y,h)),false,'centripetal');
  const p:number[]=[],uv:number[]=[],indices:number[]=[],weights:number[]=[],joints:number[]=[];
  const rows=80,cols=32;
  for(let row=0;row<=rows;row++) {
    const v=curve.getPoint(row/rows), y=v.y;
    for(let col=0;col<=cols;col++) {
      const a=col/cols*Math.PI*2;
      let z=Math.sin(a)*Math.max(.002,v.z);
      p.push(Math.cos(a)*Math.max(.002,v.x),y,z); uv.push(col/cols,row/rows);
      let first=0,second=1,weight=T.MathUtils.clamp((-y-.2)/.5,0,1);
      if(y<-.7){first=1;second=2;weight=T.MathUtils.clamp((-y-.7)/.9,0,1);}
      if(kind==='plesiosaur'&&y>.5){
        first=y<1.0?0:y<1.6?3:4;second=first===0?3:first+1;
        const start=first===0?.5:first===3?1.0:1.6, length=first===0?.5:first===3?.6:.3;
        weight=T.MathUtils.clamp((y-start)/length,0,1);
      }
      joints.push(first,second,0,0);weights.push(1-weight,weight,0,0);
      if(row<rows&&col<cols){const i=row*(cols+1)+col;indices.push(i,i+cols+1,i+1,i+1,i+cols+1,i+cols+2);}
    }
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  g.setAttribute('skinIndex',new T.Uint16BufferAttribute(joints,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));g.setIndex(indices);sealMarineTube(g,rows,cols);g.computeVertexNormals();
  // Average UV seam duplicates without smoothing away the body shape.
  const n=g.getAttribute('normal');for(let row=0;row<=rows;row++){const a=row*(cols+1),b=a+cols;
    const v=new T.Vector3(n.getX(a)+n.getX(b),n.getY(a)+n.getY(b),n.getZ(a)+n.getZ(b)).normalize();n.setXYZ(a,v.x,v.y,v.z);n.setXYZ(b,v.x,v.y,v.z);}
  tintGeometry(g);geometryCache.set(kind,g);return g;
}
function flipper(length:number,width:number) {
  const key=`fin-${length}-${width}`;if(geometryCache.has(key))return geometryCache.get(key)!;
  const p:number[]=[],uv:number[]=[],ix:number[]=[];
  for(let row=0;row<=16;row++) {
    const t=row/16, w=width*(.35+.65*Math.sin(Math.PI*Math.min(1,t*1.15))) * Math.sqrt(1-t) + .001;
    for(let j=0;j<=12;j++){const a=j/12*Math.PI*2;p.push(t*length, -t*t*length*.45 + Math.cos(a)*w,Math.sin(a)*w*.19);uv.push(j/12,t);
      if(row<16&&j<12){const i=row*13+j;ix.push(i,i+1,i+13,i+1,i+14,i+13);}}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);sealMarineTube(g,16,12,true);g.computeVertexNormals();tintGeometry(g,true);geometryCache.set(key,g);return g;
}
function verticalFin(kind:'dorsal'|'fluke') {
  if(geometryCache.has(kind))return geometryCache.get(kind)!;
  const shape=new T.Shape();
  if(kind==='dorsal'){shape.moveTo(-.5,0);shape.quadraticCurveTo(-.35,.3,-.07,.68);shape.quadraticCurveTo(-.04,.28,.35,0);}
  else {shape.moveTo(.05,0);shape.quadraticCurveTo(-.1,.32,-.47,.62);shape.quadraticCurveTo(-.3,.22,-.25,0);shape.quadraticCurveTo(-.35,-.26,-.58,-.78);shape.quadraticCurveTo(-.13,-.43,.05,0);}
  const g=new T.ExtrudeGeometry(shape,{depth:.018,bevelEnabled:true,bevelSize:.018,bevelThickness:.018,bevelSegments:3,steps:1,curveSegments:16});
  const p=g.getAttribute('position');for(let i=0;i<p.count;i++){const y=p.getX(i),z=p.getY(i),x=p.getZ(i)-.009;p.setXYZ(i,x,y,z);}g.computeVertexNormals();tintGeometry(g);geometryCache.set(kind,g);return g;
}
const orb = tintGeometry(new T.SphereGeometry(1,24,16));
const eyeMaterial = new T.MeshPhysicalMaterial({color:0x060c0d,roughness:.08,clearcoat:1});
const amber = new T.MeshStandardMaterial({color:0x69533b,roughness:.3});
const mouthMaterial = new T.MeshBasicMaterial({color:0x080609,side:T.DoubleSide});
const toothMaterial = new T.MeshStandardMaterial({color:0xa59e89,roughness:.7});
function eyes(parent:T.Object3D,y:number,width:number,z:number,size:number) {
  for(const side of [-1,1]) {
    const socket=part(parent,orb,skin(),side*width,y,z);socket.scale.set(size*1.35,size*1.6,size*.7);
    const iris=part(parent,orb,amber,side*(width+.004),y+size*.08,z+size*.12);iris.scale.set(size*.84,size*1.03,size*.30);
    const pupil=part(parent,orb,eyeMaterial,side*(width+.006),y+size*.12,z+size*.32);pupil.scale.set(size*.70,size*.90,size*.22);
  }
}

function animal(kind:Animal) {
  const root=new T.Group();root.name=kind;
  const large=kind==='mosasaur',jawParts=large?marineJawGeometry(tintGeometry):undefined;
  const bones=Array.from({length:large?7:6},()=>new T.Bone());
  bones[0].add(bones[1],bones[3]);bones[1].position.y=-.7;bones[1].add(bones[2]);bones[2].position.y=-.9;
  bones[3].position.y=.5;bones[3].add(bones[4]);bones[4].position.y=.65;bones[4].add(bones[5]);bones[5].position.y=.65;
  if(large){bones[6].name='lower-jaw';bones[6].position.set(0,JAW_HINGE_Y-.5,JAW_HINGE_Z);bones[3].add(bones[6]);}
  const pattern: SkinPattern = kind==='plesiosaur'?'stripes':kind==='mosasaur'?'spots':'plain';
  const body=new T.SkinnedMesh(kind==='mosasaur'?jawParts!.exterior:bodyGeometry(kind),skin(kind==='mosasaur'?1:0,pattern));body.name=`${kind}-body`;body.add(bones[0]);body.bind(new T.Skeleton(bones));body.frustumCulled=false;root.add(body);
  const flippers:T.Group[]=[];
  for(const rear of [false,true])for(const side of [-1,1]) {
    const x=large?(rear?.5:.7):(kind==='plesiosaur'?(rear?.22:.29):rear?.19:.27);
    const y=large?(rear?-1.6:0):(kind==='plesiosaur'?(rear?-.50:.25):rear?-.55:.25);
    const fin=pivot(root,`${rear?'rear':'fore'}-flipper-${side<0?'L':'R'}`,side*x,y,-.04);
    const length=large?(rear?1.15:1.55):kind==='plesiosaur'?(rear?.9:1.1):rear?.32:.65;
    const base=flipper(length,large?.36:kind==='plesiosaur'?.22:.14);
    const key=`${kind}-${rear}-${side}-flipper`;
    if(!geometryCache.has(key)) {
      const geometry=base.clone(), coords=geometry.getAttribute('hideCoord');
      for(let i=0;i<coords.count;i++)coords.setXYZ(i,side*(x+coords.getX(i)),y+coords.getY(i),-.04+coords.getZ(i));
      geometryCache.set(key,geometry);
    }
    const mesh=part(fin,geometryCache.get(key)!,skin(kind==='plesiosaur'?1:large?1:0,pattern),0,0,0);
    mesh.scale.x=side; // mirror the volume; Three corrects the front-face winding for negative determinants
    flippers.push(fin);
  }
  if(kind==='ichthyosaur')part(root,verticalFin('dorsal'),skin(),0,-.04,.27);
  if(kind!=='plesiosaur') {
    const tail=part(bones[2],verticalFin('fluke'),skin(large?1:0,pattern),0,large?-2.4:.15,0);
    tail.name='vertical-tail-fluke';if(large)tail.scale.setScalar(1.5);
  }
  const headParent=kind==='plesiosaur'?bones[5]:large?bones[3]:root, offset=kind==='plesiosaur'?1.8:large?.5:0;
  if(!large)eyes(headParent,(kind==='plesiosaur'?2.08:.77)-offset,kind==='plesiosaur'?.16:.19,kind==='plesiosaur'?.085:.10,kind==='plesiosaur'?.04:.045);
  // Mouth seam and nostrils follow the snout, rather than using a generated face decal.
  const start=kind==='plesiosaur'?2.05:large?.93:.91,end=kind==='plesiosaur'?2.38:large?1.92:1.53;
  for(const side of [-1,1]) {
    const w=large?.50:kind==='plesiosaur'?.16:.10;
    const curve=new T.CatmullRomCurve3([new T.Vector3(side*w,start-offset,-.015),new T.Vector3(side*w*.7,(start+end)*.5-offset,-.025),new T.Vector3(side*(kind==='ichthyosaur'?.018:.012),end-offset,-.005)]);
    if(!large)part(headParent,new T.TubeGeometry(curve,18,.004,5,false),mouthMaterial,0,0,0);
    const nostril=part(headParent,orb,eyeMaterial,side*(kind==='ichthyosaur'?.112:large?.12:.035),
      (kind==='ichthyosaur'?.955:end-.12)-offset,kind==='ichthyosaur'?.026:large?.175:.05);
    nostril.name=`nostril-${side<0?'L':'R'}`;
    if(kind==='ichthyosaur')nostril.scale.set(.006,.025,.009);
    else nostril.scale.set(large?.028:.012,large?.055:.022,.008);
  }
  const glowMaterial=new T.MeshBasicMaterial({color:0xffb65f,transparent:true,opacity:0,depthWrite:false,blending:T.AdditiveBlending});
  const glow=part(headParent,orb,glowMaterial,0,end-.12-offset,-.03);glow.scale.setScalar(large?.10:.065);glow.name='mouth-charge';
  const jaw=large?bones[6]:undefined;
  if(jaw && jawParts) {
    jawParts.ridges.forEach((geometry,index)=>{part(headParent,geometry,skin(1,'spots'),0,-offset,0).name=`cranial-ridge-${index}`;});
    part(headParent,jawParts.upperPalate,mouthMaterial,0,-offset,0).name='upper-palate';
    part(jaw,jawParts.lowerPalate,mouthMaterial,0,0,0).name='lower-palate';
    const throat=new T.SkinnedMesh(jawParts.throat,mouthMaterial);throat.name='oral-cavity';root.add(throat);
    throat.bind(body.skeleton,body.bindMatrix);throat.frustumCulled=false;
    for(const side of [-1,1]) {
      const name=side<0?'L':'R';
      pivot(headParent,`skull-hinge-${name}`,side*.50,JAW_HINGE_Y-offset,JAW_HINGE_Z);
      pivot(jaw,`jaw-hinge-${name}`,side*.50,0,0);
      part(headParent,jawParts.socketRims[side<0?0:1],skin(1,'spots'),0,-offset,0).name=`orbital-rim-${name}`;
      part(headParent,jawParts.socketCups[side<0?0:1],mouthMaterial,0,-offset,0).name=`orbital-cup-${name}`;
      const frame=marineEyeFrame(side),eye=pivot(headParent,`protected-eye-${name}`,frame.position.x,frame.position.y-offset,frame.position.z);
      eye.quaternion.copy(frame.rotation);
      const globe=part(eye,orb,eyeMaterial,0,0,-.038);globe.scale.set(.073,.108,.040);
      const iris=part(eye,orb,amber,0,0,.004);iris.scale.set(.044,.074,.014);
      const pupil=part(eye,orb,eyeMaterial,0,0,.017);pupil.scale.set(.014,.058,.009);
    }
    part(headParent,jawParts.upperTeeth,toothMaterial,0,-offset,0).name='upper-dentition';
    part(jaw,jawParts.lowerTeeth,toothMaterial,0,0,0).name='lower-dentition';
    const upperLip=part(headParent,jawParts.upperLip,mouthMaterial,0,-offset,0);upperLip.name='upper-lip';
    part(jaw,jawParts.lowerLip,mouthMaterial,0,0,0).name='lower-lip';
  }
  return {root,body,head:headParent,headOffset:offset, pose(time:number,charge=0,jawOpen=.1) {
    bones[1].rotation.z=kind==='plesiosaur'?0:Math.sin(time*3.2)*.13;
    bones[2].rotation.z=Math.sin(time*3.2-.9)*(kind==='plesiosaur'?.025:.30);
    if(large){bones[3].rotation.x=.5;bones[1].rotation.x=-.12;bones[2].rotation.x=-.20;}
    if(kind==='plesiosaur'){bones[3].rotation.z=Math.sin(time*.8)*.025;bones[4].rotation.z=Math.sin(time*.8-.5)*.020;bones[5].rotation.z=-bones[3].rotation.z*.4;}
    flippers.forEach((fin,i)=>{
      const side=i%2?1:-1;
      if(kind==='plesiosaur') {
        const stroke=time*2.4-(i<2?0:.5);
        fin.rotation.set(Math.cos(stroke)*.14,side*Math.sin(stroke)*.28,side*(.06+Math.cos(stroke)*.10));
      } else {
        const phase=i<2?0:1.25;
        fin.rotation.y=side*Math.sin(time*2.5+phase)*.25;
        fin.rotation.z=side*(.08+Math.cos(time*2.5+phase)*.08);
      }
    });
    if(jaw)jaw.rotation.x=-jawOpen*.50;
    glowMaterial.opacity=charge*.4;glow.scale.setScalar((large?.10:.0650)*(1+charge*.8));
  } };
}
export function createMarineRig(kind:MarineKind) {
  const rig=animal(kind),root=rig.root;root.scale.setScalar(kind==='plesiosaur'?.66:.67);
  root.rotation.order='ZYX'; // Bank around the animal's forward axis before turning into the route.
  return {...rig,pose(time:number,bank=0,charge=0){root.rotation.y=bank;rig.pose(time,charge);}};
}
export function createLeviathan() {
  const root=new T.Group();root.name='leviathan';const rig=animal('mosasaur');
  rig.root.rotation.set(-Math.PI/2+.5,0,Math.PI);rig.root.scale.setScalar(2.5);rig.root.position.set(0,.75,-4.2);root.add(rig.root);
  for(const side of ['L','R'])pivot(rig.head,`laser_contact_${side}`,0,1.65-rig.headOffset,-.10);
  return {root,pose(reveal:number,_windup:number,_exposed:number,_fired:number,_recoil:number,time=0){
    const motion=leviathanMotion(time);rig.pose(time,motion.windup,motion.jaw);
    rig.root.position.z=-4.2+motion.recoil*.40;rig.root.rotation.y=Math.sin(time*.8)*.025;
    root.scale.setScalar(.7+.3*reveal);
  }};
}
