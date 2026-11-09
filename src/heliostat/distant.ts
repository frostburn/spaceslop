import * as T from 'three';
import { heliostatBatch } from './geometry';
import type { HeliostatMaterials } from './materials';

export function createDistantPlant(m: HeliostatMaterials) {
  const root = new T.Group(); root.name = 'modeled-distant-plant'; const b = heliostatBatch(root);
  for (const [x,y,z,height] of [[-13,24,-27,15],[15,36,-25,20],[-17,83,-8,32],[21,110,-7,36]]) {
    const anchorY = Math.min(100,y), anchorX = Math.sign(x)*(9+(anchorY-18)*13/82);
    b.rod([anchorX,anchorY,-9],[x,y,z+.6],.25,m.dark);
    b.box([4.5,5,1.5],[x,y,z],m.dark,.15);
    b.rod([x,y,z],[x,y,z+height],.55,m.titanium,12);
    for(let j=0;j<4;j++){
      const level=z+2+j*(height-3)/4;
      b.ring(1.8,.28,[x,y,level],m.copper,[0,0,0]);
      b.ring(2.2,.08,[x,y,level+.65],m.titanium,[0,0,0]);
      b.box([.45,.5,1.1],[x,y-.65,level+1.3],m.cyan);
      for(const side of[-1,1])b.rod([x+side*2,y,level],[x+side*.6,y,level+height/4],.07,m.titanium);
    }
    for(const side of[-1,1]){
      b.box([6.5,.3,height*.7],[x+side*4.2,y,z+height*.48],m.dark);
      for(let f=0;f<17;f++)b.box([.22,1.1,height*.67],[x+side*(1.4+f*.34),y,z+height*.48],m.graphite);
      for(const dz of[height*.18,height*.8])b.rod([x,y,z+dz],[x+side*7.6,y,z+dz],.09,m.copper);
    }
  }
  // Two deep truss spines visibly connect the remote banks to the collector.
  for(const side of[-1,1]){
    for(const y of[61.25,62.75]) b.rod([side*8.2,y,8],[side*16,62,-6],.18,m.dark);
    for(const z of[-6,-9]) b.rod([side*9,18,z],[side*22,100,z],.2,m.dark);
    for(let k=0;k<9;k++){
      const y=18+k*10.25,x=side*(9+k*1.625);
      b.rod([x,y,-9],[x+side*1.625,y+10.25,-6],.1,m.titanium);
    }
  }
  b.finish(); return { root };
}
