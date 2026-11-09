import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export function grassTuft(){
  const positions:number[]=[],indices:number[]=[];
  for(let blade=0;blade<5;blade++){
    const angle=blade*2.39996,h=.38+(blade%3)*.12,bend=.12+(blade%2)*.12,base=positions.length/3;
    for(let j=0;j<=5;j++){
      const u=j/5,width=.038*(1-u)**.75;
      for(const side of[-1,1]){const x=side*width,y=bend*u*u;positions.push(Math.cos(angle)*x-Math.sin(angle)*y,Math.sin(angle)*x+Math.cos(angle)*y,h*u);}
    }
    for(let j=0;j<5;j++){const a=base+j*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function meadowFlower(){
  const parts:T.BufferGeometry[]=[];
  for(let i=0;i<6;i++){const g=new T.SphereGeometry(1,6,4).scale(.045,.092,.014).translate(0,.065,0).rotateZ(i*Math.PI/3);parts.push(g);}
  const center=new T.SphereGeometry(.025,6,4);center.translate(0,0,.014);parts.push(center);
  const g=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());return g;
}
export function lotusLeaf(){
  const p:number[]=[],uv:number[]=[],index:number[]=[];
  // Curved, tapered leaf used by planted court islands; the crease catches daylight.
  for(let j=0;j<=8;j++){const u=j/8,w=Math.sin(u*Math.PI)**.85*.45;for(const side of[-1,0,1]){p.push(side*w,u*2,.25*Math.sin(u*Math.PI)+(1-Math.abs(side))*.12);uv.push((side+1)/2,u);}}
  for(let j=0;j<8;j++)for(let i=0;i<2;i++){const a=j*3+i;index.push(a,a+1,a+3,a+1,a+4,a+3);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
}
