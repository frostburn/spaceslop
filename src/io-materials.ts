import * as T from 'three';
import { texturedSurface } from './encounter-surfaces';
import { IO_PITCH } from './io-layout';

export function ioRandom(seed:number) {
  return () => { seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296; };
}
function grain() {
  const n=128,data=new Uint8Array(n*n*4),r=ioRandom(42016);
  const grid=Array.from({length:256},r);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const gx=x/8,gy=y/8,ix=Math.floor(gx),iy=Math.floor(gy),u=gx-ix,v=gy-iy;
    const sample=(dx:number,dy:number)=>grid[((iy+dy)%16)*16+(ix+dx)%16];
    const a=sample(0,0)*(1-u)+sample(1,0)*u,b=sample(0,1)*(1-u)+sample(1,1)*u;
    const c=150+(a*(1-v)+b*v)*65+(r()-.5)*22;
    data.set([c,c,c,255],(y*n+x)*4);
  }
  const t=new T.DataTexture(data,n,n);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;
  t.generateMipmaps=true;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.needsUpdate=true;return t;
}
const detail=grain();
export const ioRock=texturedSurface(new T.MeshStandardMaterial({color:0x4c4845,map:detail,bumpMap:detail,bumpScale:.24,roughness:.88,vertexColors:true}),.06,9);
export const ioGround=texturedSurface(ioRock.clone(),.08,6);ioGround.color.setHex(0xffffff);
export const ioCeramic=new T.MeshStandardMaterial({color:0xe8ddc0,map:detail,bumpMap:detail,bumpScale:.045,roughness:.66,vertexColors:true});
export const ioBand=ioCeramic.clone();ioBand.color.setHex(0x824438);
export const ioSafety=new T.MeshStandardMaterial({color:0xb38a39,roughness:.7,metalness:.28});
export const ioSteel=texturedSurface(new T.MeshStandardMaterial({color:0x777d81,metalness:.68,roughness:.42,map:detail,bumpMap:detail,bumpScale:.035}),.12,2.5);
ioSteel.userData.shipAlloy=true;
export const ioChrome=new T.MeshStandardMaterial({color:0xbac8d0,metalness:.88,roughness:.24});
export const ioDark=new T.MeshStandardMaterial({color:0x211c1c,roughness:.73,metalness:.35});
export const ioRust=new T.MeshStandardMaterial({color:0x753e2a,map:detail,roughness:.92});
export const ioHot=new T.MeshStandardMaterial({color:0xff851c,emissive:0xff3900,emissiveIntensity:1.5,roughness:.43});
export const ioTarget=new T.MeshStandardMaterial({color:0x5ddbd5,emissive:0x29bfb5,emissiveIntensity:1.3,roughness:.3,metalness:.25});
export function setIoRockTexture(t:T.Texture) {t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;for(const m of [ioRock,ioGround,ioCrust]){m.map=m.bumpMap=t;m.needsUpdate=true;}}
export function setIoCeramicTexture(t:T.Texture) {t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;for(const m of [ioCeramic,ioBand]){m.map=m.bumpMap=t;m.needsUpdate=true;}}

export function ioWeather(geometry:T.BufferGeometry,seed=1) {
  const p=geometry.attributes.position,colors:number[]=[],rng=ioRandom(seed);
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),d=.72+Math.sin(x*2.7+y*.9+z*2.1)*.08+rng()*.10;
    colors.push(d,d*.97,d*.90);
  }
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));return geometry;
}

// A shared finite HDR sky/ground probe gives metal real specular structure.
const width=128,height=64,data=new Uint16Array(width*height*4),sun=new T.Vector3(-5,-5,12).normalize(),direction=new T.Vector3();
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
 const a=(x+.5)/width*Math.PI*2,b=(y+.5)/height*Math.PI;
 direction.set(-Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a));
 const sky=Math.max(0,direction.z),hot=Math.max(0,-direction.z);
 const glint=Math.pow(Math.max(0,direction.dot(sun)),180)*11;
 const i=(y*width+x)*4;
 for(const[c,value]of [[0,.13+sky*.20+hot*.38+glint],[1,.15+sky*.24+hot*.08+glint*.94],[2,.19+sky*.31+hot*.015+glint*.81],[3,1]])data[i+c]=T.DataUtils.toHalfFloat(value);
}
export const ioEnvironment=new T.DataTexture(data,width,height,T.RGBAFormat,T.HalfFloatType);
ioEnvironment.mapping=T.EquirectangularReflectionMapping;ioEnvironment.needsUpdate=true;
for(const m of [ioSteel,ioChrome,ioCeramic,ioBand,ioDark]){m.envMap=ioEnvironment;m.envMapIntensity=(m===ioCeramic||m===ioBand)?.22:.75;}
export function poseIoEnvironment(rise:number){
 const angle=(rise-1)*Math.PI/2-rise*IO_PITCH;
 for(const m of [ioSteel,ioChrome,ioCeramic,ioBand,ioDark])m.envMapRotation.set(angle,0,0);
}

export const ioFurnace=new T.MeshStandardMaterial({color:0x542407,emissive:0xff8b16,emissiveIntensity:2.4,emissiveMap:detail,bumpMap:detail,bumpScale:.15,roughness:.55});
const glowPixels=new Uint8Array(64*64*4);
for(let y=0;y<64;y++)for(let x=0;x<64;x++){
 const r=Math.hypot((x-31.5)/31.5,(y-31.5)/31.5),alpha=Math.max(0,1-r)**3;
 glowPixels.set([255,123,16,alpha*180],(y*64+x)*4);
}
const glowMap=new T.DataTexture(glowPixels,64,64);glowMap.colorSpace=T.SRGBColorSpace;glowMap.needsUpdate=true;
export const ioHeatGlow=new T.SpriteMaterial({map:glowMap,transparent:true,depthWrite:false,blending:T.AdditiveBlending});
export const ioCrust=texturedSurface(ioRock.clone(),.08,6);
ioCrust.color.setHex(0x393330);
const crustBase=ioCrust.onBeforeCompile;
ioCrust.onBeforeCompile=(shader,renderer)=>{
 crustBase(shader,renderer);
 shader.vertexShader='attribute float temperature; varying float vTemperature;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTemperature=temperature;');
 shader.fragmentShader='varying float vTemperature;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(2.5,.38,.012)*vTemperature;');
};
ioCrust.customProgramCacheKey=()=> 'io-fracture-hot-walls-v1';
