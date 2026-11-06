import * as T from 'three';
import { shipAlloy, texturedSurface } from './encounter-surfaces';

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
export const ioRock=texturedSurface(new T.MeshStandardMaterial({color:0x6e6257,map:detail,bumpMap:detail,bumpScale:.075,roughness:.94,vertexColors:true}),.08,2.2);
export const ioGround=texturedSurface(ioRock.clone(),.08,2.2);ioGround.color.setHex(0xffffff);
export const ioCeramic=new T.MeshStandardMaterial({color:0xe8ddc0,map:detail,bumpMap:detail,bumpScale:.028,roughness:.77,vertexColors:true});
export const ioSteel=shipAlloy(0x797b78);
export const ioDark=new T.MeshStandardMaterial({color:0x211c1c,roughness:.73,metalness:.35});
export const ioRust=new T.MeshStandardMaterial({color:0x753e2a,map:detail,roughness:.92});
export const ioHot=new T.MeshStandardMaterial({color:0xff851c,emissive:0xff3900,emissiveIntensity:1.5,roughness:.43});
export const ioTarget=new T.MeshStandardMaterial({color:0x5ddbd5,emissive:0x29bfb5,emissiveIntensity:1.3,roughness:.3,metalness:.25});
export function setIoRockTexture(t:T.Texture) {t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;for(const m of [ioRock,ioGround]){m.map=m.bumpMap=t;m.needsUpdate=true;}}
export function setIoCeramicTexture(t:T.Texture) {t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;ioCeramic.map=ioCeramic.bumpMap=t;ioCeramic.needsUpdate=true;}

export function ioWeather(geometry:T.BufferGeometry,seed=1) {
  const p=geometry.attributes.position,colors:number[]=[],rng=ioRandom(seed);
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),d=.72+Math.sin(x*2.7+y*.9+z*2.1)*.08+rng()*.10;
    colors.push(d,d*.97,d*.90);
  }
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));return geometry;
}
