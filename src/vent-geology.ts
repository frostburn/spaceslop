import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ioNoise} from './io-layout';
import {ventFloor,ventCliffEdge,ventFarEdge,ventFarFloor} from './vent-layout';

export function createVentGeology(){
 const root=new T.Group();root.name='vent-cliff-geology';
 const material=new T.MeshStandardMaterial({vertexColors:true,roughness:.98,side:T.DoubleSide});
 const tint=new T.Color(),positions:number[]=[],colors:number[]=[],indices:number[]=[];
 function vertex(x:number,y:number,z:number,shade:number){positions.push(x,y,z);tint.setRGB(.018*shade,.040*shade,.048*shade);colors.push(tint.r,tint.g,tint.b);}
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
