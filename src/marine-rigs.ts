import * as T from 'three';
import { applyRelief } from './encounter-surfaces';
import { createMarineMouth } from './marine-mouth';
import { sealMarineTube } from './marine-geometry';
import { flexMarineFin, marineDorsal, marineFluke, marinePaddle } from './marine-fins';
import { marineJawGeometry, marineEyeFrame, JAW_HINGE_Y, JAW_HINGE_Z } from './marine-jaw';
import { part, pivot } from './rig-geometry';
import { iceEnvironment } from './ice-surfaces';
import { leviathanMotion, leviathanRig, type MarineKind } from './marine';

type Animal = MarineKind | 'mosasaur';
type SkinPattern = 'plain' | 'saddles' | 'mottle';
const skins = new Map<string, T.MeshPhysicalMaterial>();
let hideTexture: T.Texture | undefined;
function skin(scales = 0, pattern: SkinPattern = 'plain') {
  const key = `${scales}/${pattern}`;
  if (skins.has(key)) return skins.get(key)!;
  const material = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: .54, metalness: 0,
    clearcoat: .19, clearcoatRoughness: .42, envMap: iceEnvironment(), envMapIntensity: .35, bumpScale: .025 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = 'attribute vec3 hideCoord; varying vec3 vHide;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvHide=hideCoord;');
    shader.fragmentShader = `
      varying vec3 vHide;
      float hideHash(vec2 cell) {
        return fract(sin(dot(cell, vec2(113.7, 249.3))) * 37264.29);
      }
      float hideNoise(vec2 p) {
        vec2 cell = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hideHash(cell), hideHash(cell + vec2(1.0, 0.0)), f.x),
          mix(hideHash(cell + vec2(0.0, 1.0)), hideHash(cell + vec2(1.0, 1.0)), f.x), f.y);
      }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#ifdef USE_MAP\n vec3 detail=texture2D(map,vMapUv).rgb;diffuseColor.rgb*=clamp(detail*1.4+0.72,0.8,1.18);\n #endif`);
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 skinSpace = vec2(vHide.x + vHide.z * .38, vHide.y + vHide.z * .27);
      float grain = hideNoise(skinSpace * vec2(22.0, 19.0));
      float clouds = hideNoise(skinSpace * vec2(4.1, 3.2));
      diffuseColor.rgb *= .88 + grain * .085 + clouds * .095;
      ${pattern === 'saddles' ? `
      float phase = vHide.y * 8.7 + sin(vHide.y * 3.1) * .9 + clouds * 1.6;
      float edge = abs(sin(phase + .55 * sin(vHide.x * 7.0 + vHide.z * 5.0)));
      float saddle = (1.0 - smoothstep(.22, .53, edge)) * smoothstep(-.10, .11, vHide.z);
      diffuseColor.rgb *= 1.06 - saddle * (.37 + grain * .11);` : pattern === 'mottle' ? `
      float broken = hideNoise(skinSpace * vec2(10.2, 7.5) + clouds);
      float patches = smoothstep(.42, .69, clouds * .67 + broken * .33);
      float back = smoothstep(-.11, .29, vHide.z + clouds * .11);
      diffuseColor.rgb *= 1.07 - patches * back * .57;` : ''}
      ${scales ? `vec2 scaleCell = fract(vec2(vHide.x*69.0+sin(vHide.y*100.0)*.13,vHide.y*100.0));
      float seam = smoothstep(.38,.49,max(abs(scaleCell.x-.5),abs(scaleCell.y-.5)));
      diffuseColor.rgb *= 1.0-seam*.13;` : ''}`);
  };
  material.customProgramCacheKey = () => `marine-hide-v3-${key}`;
  if (hideTexture) applyRelief(hideTexture, [material]);
  skins.set(key, material);
  return material;
}
export function setMarineTexture(texture: T.Texture) {
  hideTexture = texture;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.repeat.set(2, 3);
  applyRelief(texture, [...skins.values()]);
  function release() {
    texture.removeEventListener('dispose', release);
    if (hideTexture === texture) hideTexture = undefined;
  }
  texture.addEventListener('dispose', release);
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
function paintedFin(key: string, create: () => T.BufferGeometry, x: number, y: number, z: number, side = 1, scale = 1) {
  if (!geometryCache.has(key)) {
    const geometry = tintGeometry(create(), true), coord = geometry.getAttribute('hideCoord');
    for (let i = 0; i < coord.count; i++) {
      coord.setXYZ(i, x + side * coord.getX(i) * scale, y + coord.getY(i) * scale, z + coord.getZ(i) * scale);
    }
    geometryCache.set(key, geometry);
  }
  return geometryCache.get(key)!;
}
const orb = tintGeometry(new T.SphereGeometry(1,24,16));
const eyeMaterial = new T.MeshPhysicalMaterial({color:0x060c0d,roughness:.08,clearcoat:1});
const amber = new T.MeshStandardMaterial({color:0x69533b,roughness:.3});
const mouthMaterial = new T.MeshBasicMaterial({color:0x080609,side:T.DoubleSide});
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
  const mouth=large?createMarineMouth():undefined;
  const bones=Array.from({length:large?7:6},()=>new T.Bone());
  bones[0].add(bones[1],bones[3]);bones[1].position.y=-.7;bones[1].add(bones[2]);bones[2].position.y=-.9;
  bones[3].position.y=leviathanRig.headY;bones[3].add(bones[4]);bones[4].position.y=.65;bones[4].add(bones[5]);bones[5].position.y=.65;
  if(large){bones[6].name='lower-jaw';bones[6].position.set(0,JAW_HINGE_Y-.5,JAW_HINGE_Z);bones[3].add(bones[6]);}
  const pattern: SkinPattern = kind==='plesiosaur'?'saddles':kind==='mosasaur'?'mottle':'plain';
  const body=new T.SkinnedMesh(kind==='mosasaur'?jawParts!.exterior:bodyGeometry(kind),skin(kind==='mosasaur'?1:0,pattern));body.name=`${kind}-body`;body.add(bones[0]);body.bind(new T.Skeleton(bones));body.frustumCulled=false;root.add(body);
  const flippers: { joint: T.Group; blade: T.Mesh; rear: boolean; side: number }[] = [];
  for (const rear of [false, true]) for (const side of [-1, 1]) {
    const hips = rear && kind !== 'plesiosaur';
    const parent = hips ? bones[large ? 2 : 1] : root;
    const x = large ? (rear ? .43 : .68) : kind === 'plesiosaur' ? (rear ? .22 : .28) : (rear ? .132 : .25);
    const y = large ? (rear ? -1.6 : 0) : kind === 'plesiosaur' ? (rear ? -.50 : .25) : (rear ? -.70 : .25);
    const joint = pivot(parent, `${rear ? 'rear' : 'fore'}-flipper-${side < 0 ? 'L' : 'R'}`, side * x, hips ? 0 : y, -.04);
    const length = large ? (rear ? 1.07 : 1.52) : kind === 'plesiosaur' ? (rear ? .95 : 1.11) : (rear ? .33 : .68);
    const width = large ? (rear ? .27 : .36) : kind === 'plesiosaur' ? (rear ? .22 : .25) : (rear ? .095 : .14);
    const geometry = paintedFin(`${kind}-${rear}-${side}-paddle`,
      () => marinePaddle(length, width, kind === 'plesiosaur' ? .27 : .38), side * x, y, -.04, side);
    const blade = part(joint, geometry, skin(large || kind === 'plesiosaur' ? 1 : 0, pattern), 0, 0, 0);
    blade.scale.x = side;
    flippers.push({ joint, blade, rear, side });
  }
  if (kind === 'ichthyosaur') {
    const dorsal = paintedFin('dorsal', marineDorsal, 0, .025, .23);
    part(root, dorsal, skin(), 0, .025, .23).name = 'dorsal-fin';
  }
  let tail: T.Mesh | undefined;
  if (kind !== 'plesiosaur') {
    const tailY = large ? -3.86 : -1.42, scale = large ? 1.50 : 1;
    const geometry = paintedFin(`${kind}-fluke`,
      () => marineFluke(large ? .86 : .69, large ? .52 : .62, .48), 0, tailY, 0, 1, scale);
    tail = part(bones[2], geometry, skin(large ? 1 : 0, pattern), 0, tailY + 1.6, 0);
    tail.name = 'vertical-tail-fluke';
    tail.scale.setScalar(scale);
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
  const glow=part(headParent,orb,glowMaterial,0,(large?leviathanRig.mouthY:end-.12)-offset,leviathanRig.mouthZ);glow.scale.setScalar(large?.10:.065);glow.name='mouth-charge';
  const jaw=large?bones[6]:undefined;
  if(jaw && jawParts && mouth) {
    jawParts.ridges.forEach((geometry,index)=>{part(headParent,geometry,skin(1,'mottle'),0,-offset,0).name=`cranial-ridge-${index}`;});
    part(headParent,jawParts.upperPalate,mouth.tissue,0,-offset,0).name='upper-palate';
    part(jaw,jawParts.lowerPalate,mouth.tissue,0,0,0).name='lower-palate';
    const throat=new T.SkinnedMesh(jawParts.throat,mouth.tissue);throat.name='oral-cavity';root.add(throat);
    throat.bind(body.skeleton,body.bindMatrix);throat.frustumCulled=false;
    part(jaw,jawParts.tongue,mouth.tongue,0,0,0).name='tongue';
    for(const side of [-1,1]) {
      const name=side<0?'L':'R';
      pivot(headParent,`skull-hinge-${name}`,side*.50,JAW_HINGE_Y-offset,JAW_HINGE_Z);
      pivot(jaw,`jaw-hinge-${name}`,side*.50,0,0);
      part(headParent,jawParts.socketRims[side<0?0:1],skin(1,'mottle'),0,-offset,0).name=`orbital-rim-${name}`;
      part(headParent,jawParts.socketCups[side<0?0:1],mouthMaterial,0,-offset,0).name=`orbital-cup-${name}`;
      const frame=marineEyeFrame(side),eye=pivot(headParent,`protected-eye-${name}`,frame.position.x,frame.position.y-offset,frame.position.z);
      eye.quaternion.copy(frame.rotation);
      const globe=part(eye,orb,eyeMaterial,0,0,-.038);globe.scale.set(.073,.108,.040);
      const iris=part(eye,orb,amber,0,0,.004);iris.scale.set(.044,.074,.014);
      const pupil=part(eye,orb,eyeMaterial,0,0,.017);pupil.scale.set(.014,.058,.009);
    }
    part(headParent,jawParts.upperTeeth,mouth.teeth,0,-offset,0).name='upper-dentition';
    part(jaw,jawParts.lowerTeeth,mouth.teeth,0,0,0).name='lower-dentition';
    const upperLip=part(headParent,jawParts.upperLip,mouth.tissue,0,-offset,0);upperLip.name='upper-lip';
    part(jaw,jawParts.lowerLip,mouth.tissue,0,0,0).name='lower-lip';
  }
  return {root,body,head:headParent,headOffset:offset, pose(time: number, charge = 0, jawOpen = .1, bank = 0) {
    const wave = time * (large ? 2.3 : 3.85);
    bones[1].rotation.z = kind === 'plesiosaur' ? 0 : Math.sin(wave) * .115;
    bones[2].rotation.z = Math.sin(wave - .93) * (kind === 'plesiosaur' ? .025 : large ? .26 : .30);
    if(tail) flexMarineFin(tail, Math.sin(wave - 1.66) * .88);
    if(large){const motion=leviathanMotion(time);bones[3].rotation.set(.5+motion.headPitch,motion.headRoll,motion.headYaw);bones[1].rotation.x=-.12;bones[2].rotation.x=-.20;}
    if(kind==='plesiosaur'){bones[3].rotation.z=Math.sin(time*.8)*.025;bones[4].rotation.z=Math.sin(time*.8-.5)*.020;bones[5].rotation.z=-bones[3].rotation.z*.4;}
    for (const { joint, blade, rear, side } of flippers) {
      if (kind === 'plesiosaur') {
        const turn = time * .52 - (rear ? .22 : 0);
        const cycle = turn - Math.floor(turn);
        // A long broad stroke and a quicker, edge-on return. The rear pair
        // follows the front; the flexible tips trail their own shoulder.
        const phase = 2 * Math.PI * cycle;
        const stroke = phase - .5 * (1 - Math.cos(phase));
        const pull = Math.sin(stroke), lift = Math.cos(stroke);
        joint.rotation.set(-.14 + .56 * pull, side * (.44 * lift), side * (.08 + .18 * pull));
        flexMarineFin(blade, .91 * Math.sin(stroke - .61));
      } else {
        const trim = side * bank;
        const phase = wave * .73 - (rear ? 1.17 : 0);
        joint.rotation.set(.075 * Math.sin(phase) - trim * .28,
          side * (.10 + Math.sin(phase) * .16 - trim * .21),
          side * (.08 + Math.cos(phase) * .11 + .13 * charge));
        flexMarineFin(blade, .53 * Math.sin(phase - .77));
      }
    }
    if(jaw)jaw.rotation.x=-jawOpen*.50;
    mouth?.pose(jawOpen);
    glowMaterial.opacity=charge*.4;glow.scale.setScalar((large?.10:.0650)*(1+charge*.8));
  } };
}
export function createMarineRig(kind:MarineKind) {
  const rig=animal(kind),root=rig.root;root.scale.setScalar(kind==='plesiosaur'?.66:.67);
  root.rotation.order='ZYX'; // Bank around the animal's forward axis before turning into the route.
  return {...rig,pose(time:number,bank=0,charge=0){root.rotation.y=bank;rig.pose(time,charge,.1,bank);}};
}
export function createLeviathan() {
  const root=new T.Group();root.name='leviathan';const rig=animal('mosasaur');
  rig.root.rotation.set(leviathanRig.pitch,0,Math.PI);rig.root.scale.setScalar(leviathanRig.scale);rig.root.position.set(0,leviathanRig.y,leviathanRig.z);root.add(rig.root);
  for(const side of ['L','R'])pivot(rig.head,`laser_contact_${side}`,0,1.65-rig.headOffset,-.10);
  return {root,pose(reveal:number,windup:number,_exposed:number,_fired:number,recoil:number,time=0,pattern=false){
    const motion=leviathanMotion(time);rig.pose(time,pattern ? windup : motion.windup,pattern ? .02 + .88 * Math.max(windup, recoil) : motion.jaw);
    rig.root.position.z=leviathanRig.z+(pattern ? recoil*leviathanRig.patternRecoil : motion.recoil*.40);
    rig.root.rotation.y=motion.swimYaw;
    root.scale.setScalar(.7+.3*reveal);
  }};
}
