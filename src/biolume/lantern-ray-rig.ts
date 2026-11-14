import * as T from 'three';
import {RAY_SIZE,rayArrival,rayRoot,rayVertex,rayLocalOrgan,raySignal,RAY_SEEKER_RADIUS,type RayOrb} from './lantern-ray';

function rayFallback(){
 const c=document.createElement('canvas');c.width=c.height=512;const p=c.getContext('2d')!;p.scale(512,512);
 p.fillStyle='#555d61';p.beginPath();p.moveTo(.5,.02);p.bezierCurveTo(.54,.35,.56,.39,.69,.39);p.quadraticCurveTo(.85,.43,.98,.53);p.quadraticCurveTo(.88,.58,.82,.78);p.quadraticCurveTo(.76,.64,.57,.68);p.lineTo(.5,.83);p.lineTo(.43,.68);p.quadraticCurveTo(.24,.64,.18,.78);p.quadraticCurveTo(.12,.58,.02,.53);p.quadraticCurveTo(.15,.43,.31,.39);p.bezierCurveTo(.44,.39,.46,.35,.5,.02);p.fill();
 p.lineWidth=.0025;p.strokeStyle='#46c9d2';
 for(const side of[-1,1])for(let i=0;i<8;i++){p.beginPath();p.moveTo(.5+side*.12,.60);p.quadraticCurveTo(.5+side*(.2+i*.027),.42+i*.035,.5+side*(.46-i*.012),.51+i*.027);p.stroke();}
 p.fillStyle='#f5a627';for(const side of[-1,1]){p.beginPath();p.ellipse(.5+side*.12,.60,.04,.055,side*.6,0,Math.PI*2);p.fill();}
 for(let i=0;i<7;i++)for(const side of[-1,1]){p.beginPath();p.ellipse(.5+side*(.014+i*.004),.12+i*.06,.008+i*.002,.015,0,0,Math.PI*2);p.fill();}
 p.fillStyle='#f85227';for(const x of[.485,.5,.515]){p.beginPath();p.arc(x,.775+Math.abs(x-.5)*-1.4,.005,0,Math.PI*2);p.fill();}
 const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;return map;
}
export function createLanternRay(){
 const root=new T.Group();root.name='lantern-ray';
 const fallback=rayFallback(),geometry=new T.PlaneGeometry(RAY_SIZE,RAY_SIZE,64,64),uv=geometry.attributes.uv,position=geometry.attributes.position;
 geometry.boundingBox=new T.Box3(new T.Vector3(-5,-5,-1.3),new T.Vector3(5,5,1.3));geometry.boundingSphere=new T.Sphere(new T.Vector3(),8);
 const glow={clock:{value:0},fan:{value:0},seeker:{value:0},side:{value:-1},life:{value:1}};
 const material=new T.MeshStandardMaterial({map:fallback,side:T.DoubleSide,alphaTest:.2,roughness:.68,metalness:.015});
 material.onBeforeCompile=s=>{
  Object.assign(s.uniforms,{rayClock:glow.clock,rayFan:glow.fan,raySeeker:glow.seeker,raySide:glow.side,rayLife:glow.life});
  s.fragmentShader='uniform float rayClock,rayFan,raySeeker,raySide,rayLife;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
   vec3 tissue=texture2D(map,vMapUv).rgb;
   float amber=smoothstep(.06,.32,tissue.r-max(tissue.g,tissue.b));
   float cyan=smoothstep(.065,.22,min(tissue.g,tissue.b)-tissue.r);
   float phase=.5+.5*sin(rayClock*2.2-vMapUv.y*24.+abs(vMapUv.x-.5)*5.);float wave=.3+.7*phase*phase;
   float organSide=vMapUv.x<.5?-1.:1.;
   float shoulder=exp(-dot((vMapUv-vec2(.5+organSide*.12,.4))*vec2(20.,18.),(vMapUv-vec2(.5+organSide*.12,.4))*vec2(20.,18.)));
   float charge=organSide==raySide?rayFan:raySeeker;
   vec3 amberColor=tissue.g<tissue.r*.10?vec3(1.,.025,.008):vec3(1.,.30,.025);
   totalEmissiveRadiance+=rayLife*(amber*amberColor*(.7+wave+shoulder*charge*3.)+cyan*vec3(.025,.65,.75)*(.25+wave*.9));`);
 };
 material.customProgramCacheKey=()=> 'lantern-ray-patterns-v1';
 const mesh=new T.Mesh(geometry,material);mesh.name='lantern-ray-raster';root.add(mesh);
 const anchors=[-1,1].map(side=>{const a=new T.Object3D();a.name=side<0?'laser_contact_L':'laser_contact_R';root.add(a);return a;});
 let last=NaN,lastDead=false;const point={x:0,y:0,z:0};
 function pose(time:number,dead=false,signal=raySignal(time)){
  const arrival=rayArrival(time),r=rayRoot(time,arrival);root.position.set(r.x,r.y,dead?-.25:0);root.rotation.z=r.angle;root.scale.set(r.sx,r.sy,1);
  glow.clock.value=time;glow.fan.value=signal.fan;glow.seeker.value=signal.seeker;glow.side.value=signal.side;glow.life.value=dead?.12:1;
  if(time===last&&dead===lastDead)return;last=time;lastDead=dead;
  const wingSpread=dead?arrival*.784:arrival;
  for(let i=0;i<position.count;i++){rayVertex((uv.getX(i)-.5)*RAY_SIZE,(uv.getY(i)-.5)*RAY_SIZE,time,wingSpread,point);position.setXYZ(i,point.x,point.y,point.z);}
  position.needsUpdate=true;geometry.computeVertexNormals();
  anchors.forEach((a,i)=>{const p=rayLocalOrgan(i?1:-1);rayVertex(p.x,p.y,time,wingSpread,point);a.position.set(point.x,point.y,point.z);});
 }
 pose(0);
 return{root,mesh,glow,fallback,pose,setArt(map:T.Texture){material.map=map;},release(){material.map=null;fallback.dispose();}};
}

export function createRaySeekerAssets(){return{body:new T.IcosahedronGeometry(RAY_SEEKER_RADIUS*.82,2),ring:new T.TorusGeometry(RAY_SEEKER_RADIUS,.025,6,24),halo:new T.SphereGeometry(RAY_SEEKER_RADIUS*1.32,14,10),
 core:new T.MeshBasicMaterial({color:0xff7f2d}),edge:new T.MeshBasicMaterial({color:0xffd775}),glow:new T.MeshBasicMaterial({color:0xff8f26,transparent:true,opacity:.12,blending:T.AdditiveBlending,depthWrite:false})};}
export function createRaySeekerRig(a:ReturnType<typeof createRaySeekerAssets>){
 const root=new T.Group(),shell=new T.Group();root.name='ray-seeking-lantern';root.add(new T.Mesh(a.body,a.core),new T.Mesh(a.halo,a.glow),shell);
 for(let i=0;i<2;i++){const ring=new T.Mesh(a.ring,a.edge);ring.rotation.x=i*Math.PI/2;shell.add(ring);}
 return{root,pose(orb:RayOrb){root.position.set(orb.x,orb.y,.12);root.scale.setScalar(1+.055*Math.sin(orb.age*7));shell.rotation.set(orb.age*.9,orb.age*1.3,orb.rayOrb.heading);}};
}
