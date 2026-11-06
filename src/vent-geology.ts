import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ioNoise} from './io-layout';
import {ioTriplanar} from './io-surface';
import {ventFloor,ventCliffEdge,ventFarEdge,ventFarFloor} from './vent-layout';

let basalt:T.DataTexture|undefined;
function basaltRelief(){
 if(basalt)return basalt;
 const n=128,data=new Uint8Array(n*n*4);
 const hash=(x:number,y:number)=>{let h=Math.imul((x%8+8)%8,374761393)^Math.imul((y%8+8)%8,668265263);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;};
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const u=x/n*8,v=y/n*8,cx=Math.floor(u),cy=Math.floor(v);let first=10,second=10;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const a=cx+dx,b=cy+dy,d=Math.hypot(u-a-.1-hash(a,b)*.8,v-b-.1-hash(a+3,b+5)*.8);
   if(d<first){second=first;first=d;}else if(d<second)second=d;
  }
  const crack=Math.min(1,(second-first)*14),grain=ioNoise(x*.7+20,y*.7+10),value=(.40+crack*.36+grain*.12)*255;
  data.set([value,value,value,255],(y*n+x)*4);
 }
 basalt=new T.DataTexture(data,n,n);basalt.wrapS=basalt.wrapT=T.RepeatWrapping;basalt.generateMipmaps=true;basalt.minFilter=T.LinearMipmapLinearFilter;basalt.magFilter=T.LinearFilter;basalt.needsUpdate=true;return basalt;
}
export function createVentGeology(){
 const root=new T.Group();root.name='vent-cliff-geology';
 const relief=basaltRelief(),material=ioTriplanar(new T.MeshStandardMaterial({vertexColors:true,map:relief,bumpMap:relief,bumpScale:.22,roughness:.98,side:T.DoubleSide}),.20);
 const tint=new T.Color(),positions:number[]=[],colors:number[]=[],indices:number[]=[];
 function vertex(x:number,y:number,z:number,shade:number){positions.push(x,y,z);tint.setRGB(.012*shade,.018*shade,.020*shade);colors.push(tint.r,tint.g,tint.b);}
 function grid(front:boolean){
  const start=positions.length/3,cols=48,rows=front?18:90;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
   const x=-24+i,edge=front?ventFarEdge(x):ventCliffEdge(x),y=front?edge+j/rows*30:-20+(edge+20)*j/rows;
   const z=front?ventFarFloor(x,y):ventFloor(x,y);
   const bank=Math.min(1,Math.max(0,(Math.abs(x)-1.6)/3)),grain=ioNoise(x*.55+40,y*.5+20);
   vertex(x,y,z,(front?1.0:.65+bank*.65)*(.7+grain*.5));
  }
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=start+j*(cols+1)+i,b=a+cols+1;indices.push(a,a+1,b,a+1,b+1,b);}
 }
 grid(false);grid(true);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
 const shelf=new T.Mesh(g,material);shelf.name='finite-corridor-shelves';shelf.receiveShadow=true;root.add(shelf);
 const walls:T.BufferGeometry[]=[];
 for(const far of [false,true]){
  const v:number[]=[],c:number[]=[],idx:number[]=[],cols=96,rows=14;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
   const x=-24+i*.5,top=far?ventFarFloor(x,ventFarEdge(x)):ventFloor(x,ventCliffEdge(x)),z=top-j/rows*38;
   const y=(far?ventFarEdge(x):ventCliffEdge(x))+(j===0?0:Math.sin(i*1.8+j*.7)*.20);
   v.push(x,y,z);const noise=ioNoise(x*.8+50,z*.65+50),strata=(.65+.35*Math.sin(z*3+x*.2))*.25*Math.exp(-(top-z)*.23);c.push((.055+noise*.07)*strata,(.10+noise*.08)*strata,(.12+noise*.08)*strata);
  }
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;idx.push(a,b,a+1,a+1,b,b+1);}
  const wall=new T.BufferGeometry();wall.setAttribute('position',new T.Float32BufferAttribute(v,3));wall.setAttribute('color',new T.Float32BufferAttribute(c,3));wall.setIndex(idx);wall.computeVertexNormals();walls.push(wall);
 }
 const cliff=new T.Mesh(mergeGeometries(walls),material);cliff.name='abyss-cliff-faces';root.add(cliff);walls.forEach(g=>g.dispose());return root;
}
