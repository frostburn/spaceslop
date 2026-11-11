import * as T from 'three';

type Rect=readonly[number,number,number,number];
export const POD_CROP:Rect=[159/1254,658/1254,456/1254,1238/1254];
export const ENEMY_CROP:Rect=[0,80/1254,1,1100/1254];
const WING_WIDTH=3.1,WING_HEIGHT=WING_WIDTH*1020/1254;

function podFallback(){
  const c=document.createElement('canvas');c.width=128;c.height=256;const p=c.getContext('2d')!;
  p.fillStyle='#aaa087';p.beginPath();p.moveTo(62,3);p.bezierCurveTo(85,80,127,136,118,187);p.quadraticCurveTo(110,226,64,253);p.quadraticCurveTo(10,226,9,181);p.bezierCurveTo(4,135,65,80,62,3);p.fill();
  p.strokeStyle='#716c5a';p.lineWidth=2;for(const x of[20,45,75,105]){p.beginPath();p.moveTo(64,46);p.bezierCurveTo(x,128,x,205,64,250);p.stroke();}
  const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;
}

function rasterMaterial(fallback:T.Texture,emission:{value:number},pod:boolean){
  const m=new T.MeshStandardMaterial({map:fallback,roughness:pod?.82:.72,metalness:0,side:T.DoubleSide,alphaTest:.35});
  m.onBeforeCompile=s=>{
    s.uniforms.moduleGlow=emission;
    s.vertexShader='attribute vec2 moduleUV;varying vec2 vModuleUV;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvModuleUV=moduleUV;');
    s.fragmentShader='uniform float moduleGlow;varying vec2 vModuleUV;\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      #ifdef USE_MAP
        vec3 tissue=texture2D(map,vMapUv).rgb;
        ${pod?`vec2 q=(vModuleUV-vec2(.5,.29))/vec2(.43,.30);float organ=exp(-dot(q,q)*1.6);`:`
        vec2 p=vec2(abs(vModuleUV.x-.5),vModuleUV.y);
        float organ=1.-smoothstep(.65,1.,length((p-vec2(.063,.187))/vec2(.016,.024)));
        organ=max(organ,1.-smoothstep(.65,1.,length((p-vec2(.056,.143))/vec2(.012,.018))));
        organ=max(organ,1.-smoothstep(.65,1.,length((p-vec2(.041,.111))/vec2(.009,.012))));`}
        totalEmissiveRadiance+=tissue*vec3(1.,${pod?'.24,.025':'.40,.08'})*organ*moduleGlow;
      #endif`);
  };
  m.customProgramCacheKey=()=>pod?'biolume-pod-v1':'biolume-glider-v1';return m;
}

function moduleGeometry(width:number,height:number,x=8,y=16){
  const g=new T.PlaneGeometry(width,height,x,y);g.setAttribute('moduleUV',g.attributes.uv.clone());return g;
}
function setCrop(g:T.BufferGeometry,rect:Rect){
  const uv=g.attributes.uv,local=g.attributes.moduleUV;
  for(let i=0;i<uv.count;i++)uv.setXY(i,rect[0]+local.getX(i)*(rect[2]-rect[0]),1-rect[3]+local.getY(i)*(rect[3]-rect[1]));uv.needsUpdate=true;
}

export function wingPoint(x:number,y:number,time:number,out={x:0,y:0,z:0}){
  const span=T.MathUtils.clamp((Math.abs(x)-.23)/1.3,0,1),phase=time*5;
  out.x=x*(1-.16*span*(.5+.5*Math.sin(phase)));out.y=y;
  out.z=.14*Math.exp(-x*x/.035)+span*span*(.6*Math.sin(phase)+.12*Math.sin(phase-span*.6));return out;
}
export function createWingGeometry(){
  const g=moduleGeometry(WING_WIDTH,WING_HEIGHT,48,24);g.boundingSphere=new T.Sphere(new T.Vector3(),3);
  g.boundingBox=new T.Box3(new T.Vector3(-WING_WIDTH/2,-WING_HEIGHT/2,-.8),new T.Vector3(WING_WIDTH/2,WING_HEIGHT/2,.8)).expandByScalar(.001);return g;
}
const deformed={x:0,y:0,z:0};
export function poseWingGeometry(g:T.BufferGeometry,time:number){
  const p=g.attributes.position,uv=g.attributes.moduleUV;
  for(let i=0;i<p.count;i++){const v=wingPoint((uv.getX(i)-.5)*WING_WIDTH,(uv.getY(i)-.5)*WING_HEIGHT,time,deformed);p.setXYZ(i,v.x,v.y,v.z);}
  p.needsUpdate=true;g.computeVertexNormals();
}

export function createRasterGlider(emission:{value:number}){
  const fallback=new T.DataTexture(new Uint8Array([128,128,128,0]),1,1);fallback.colorSpace=T.SRGBColorSpace;fallback.needsUpdate=true;
  const geometry=createWingGeometry(),material=rasterMaterial(fallback,emission,false),mesh=new T.Mesh(geometry,material);mesh.name='biolume-raster-glider';
  let last=NaN,available=false;
  return{mesh,get available(){return available;},setArt(t:T.Texture|undefined){available=!!t;material.map=t??fallback;setCrop(geometry,t?ENEMY_CROP:[0,0,1,1]);},
    pose(time:number){if(time!==last){poseWingGeometry(geometry,time);last=time;}},release(){material.map=null;fallback.dispose();}};
}

export function createSeedPods(emission:{value:number},count=3){
  const fallback=podFallback(),material=rasterMaterial(fallback,emission,true),geometry=moduleGeometry(1.2,2.35);
  const meshes=Array.from({length:count},(_,i)=>{const m=new T.Mesh(geometry,material);m.name='biolume-seed-pod-'+i;return m;});
  const uvSites=[[.175,.84],[.87,.59],[.12,.16]]as const;
  const z=.3,height=2*Math.tan(39*Math.PI/360)*(22-z),bulbOffset=(.5-.29)*2.35;
  const anchors=meshes.map(()=>new T.Vector3());
  function fit(aspect:number){for(let i=0;i<count;i++){const site=uvSites[i%3];meshes[i].position.set((site[0]-.5)*height*aspect,(site[1]-.5)*height+bulbOffset,z);anchors[i].copy(meshes[i].position).add(new T.Vector3(0,-bulbOffset,.5));}}
  fit(9/16);
  return{meshes,anchors,fit,setArt(t:T.Texture|undefined){material.map=t??fallback;setCrop(geometry,t?POD_CROP:[0,0,1,1]);},release(){material.map=null;fallback.dispose();}};
}
