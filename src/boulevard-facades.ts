import * as T from 'three';
import type {BoulevardPart} from './boulevard-geometry';
export type FacadePart=BoulevardPart&{cell:number;side?:number};
// Source-painted rooms are the fallback for the optional 2x2 façade atlas.
// Pigment/emission only: the footprint, balconies and trim remain real geometry.
function fallbackAtlas(){
 const size=256,cell=size/2,data=new Uint8Array(size*size*4);
 const hash=(x:number,y:number)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const col=Math.floor(x/cell),row=Math.floor(y/cell),kind=(1-row)*2+col,u=(x%cell)/cell,v=(y%cell)/cell;
  const columns=kind===1?3:4,rows=kind===3?2:3,wx=u*columns,wy=v*rows,ix=Math.floor(wx),iy=Math.floor(wy),fx=wx-ix,fy=wy-iy,lit=hash(ix+kind*8,iy)>.23;
  let r=12,g=16,b=27;
  if(fx>.07&&fx<.93&&fy>.12&&fy<.88){
   const lamp=Math.exp(-(((fx-.7)/.32)**2+((fy-.67)/.38)**2));
   const warm=lit?(1-fy*.4)*(.4+lamp*.6):.07;
   r+=warm*180;g+=warm*104;b+=warm*48;
   // Distant tables, curtains and occasional silhouettes suggest occupied rooms.
   if(fy<.32&&fx>.22&&fx<.84){r*=.35;g*=.4;b*=.55;}
   if((fx<.15||fx>.86)&&fy>.2){r*=.45;g*=.5;}
   if(hash(ix,iy+kind)>.5&&((fx-.37)**2/.007+(fy-.45)**2/.015<1)){r*=.2;g*=.24;b*=.35;}
  }
  const stripe=Math.abs(v-.12)<.012||Math.abs(v-.91)<.012;
  if(stripe){r=kind%2?210:38;g=kind%2?37:177;b=220;}
  const speck=.91+hash(x,y)*.09;data.set([r*speck,g*speck,b*speck,255],(y*size+x)*4);
 }
 const map=new T.DataTexture(data,size,size);map.colorSpace=T.SRGBColorSpace;map.generateMipmaps=true;map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;map.needsUpdate=true;return map;
}
export function createBoulevardFacades(){
 const material=new T.MeshBasicMaterial({map:fallbackAtlas(),color:0xb0adbf,toneMapped:false});
 material.onBeforeCompile=shader=>{
  shader.vertexShader='attribute vec4 facadeUv; varying vec2 vFacadeUv;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFacadeUv=mix(facadeUv.xy,facadeUv.zw,uv);');
  shader.fragmentShader='varying vec2 vFacadeUv;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#ifdef USE_MAP\ndiffuseColor*=texture2D(map,vFacadeUv);\n#endif');
 };
 material.customProgramCacheKey=()=> 'boulevard-facade-cells-v1';
 return{material,setAtlas(texture:T.Texture){texture.wrapS=texture.wrapT=T.ClampToEdgeWrapping;texture.anisotropy=4;material.map?.dispose();material.map=texture;material.needsUpdate=true;}};
}
export function facadeInstances(parts:FacadePart[],material:T.Material){
 const geometry=new T.PlaneGeometry(1,1),ranges=new Float32Array(parts.length*4),mesh=new T.InstancedMesh(geometry,material,parts.length),o=new T.Object3D(),basis=new T.Matrix4();mesh.name='boulevard-facade-cards';
 parts.forEach((p,i)=>{
  o.position.set(p.x,p.y,p.z);o.scale.set(p.sx,p.sy,1);
  if(p.side)basis.makeBasis(new T.Vector3(0,-p.side,0),new T.Vector3(0,0,1),new T.Vector3(-p.side,0,0));
  else basis.makeRotationX(Math.PI/2);
  o.quaternion.setFromRotationMatrix(basis);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);
  const x=p.cell%2*.5,y=(1-Math.floor(p.cell/2))*.5;ranges.set([x+.006,y+.006,x+.494,y+.494],i*4);
 });
 geometry.setAttribute('facadeUv',new T.InstancedBufferAttribute(ranges,4));mesh.computeBoundingSphere();return mesh;
}
