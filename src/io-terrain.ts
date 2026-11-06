import * as T from 'three';
import {ioChannel,ioGroundHeight,ioNoise,smooth01,IO_CALDERA_Y} from './io-layout';
import {ioGround} from './io-materials';

// More samples at the banks, irregular vertices and mixed diagonals break the
// visible square lattice. Shared border coordinates/normals remain identical.
export function createIoTerrain(){
  const root=new T.Group();root.name='io-heightfield';
  const offsets:number[]=[];
  for(let x=-48;x<-8;x++)offsets.push(x);
  for(let i=-40;i<=40;i++)offsets.push(i/5);
  for(let x=9;x<=48;x++)offsets.push(x);
  const basalt=new T.Color(0x363638),sulfur=new T.Color(0xbba03b),red=new T.Color(0x80432c),pale=new T.Color(0xc9b995),color=new T.Color(),normal=new T.Vector3();
  const cols=offsets.length,rows=80;
  for(let start=-24;start<IO_CALDERA_Y+40;start+=24){
    const positions:number[]=[],normals:number[]=[],colors:number[]=[],uv:number[]=[],indices:number[]=[];
    for(let row=0;row<=rows;row++)for(let col=0;col<cols;col++){
      const baseY=(start*10+row*3)/10,offset=offsets[col];
      const y=Math.fround(baseY+(row===0||row===rows?0:(ioNoise(col*1.31+11,baseY*.71+20)-.5)*.15));
      const jitter=(ioNoise(offset*1.2+30,baseY*1.4)-.5)*(Math.abs(offset)<=8?.08:.24);
      const x=Math.fround(offset+ioChannel(y)+jitter),z=ioGroundHeight(x,y);
      positions.push(x,y,z);uv.push(x*.19,y*.19);
      normal.set(ioGroundHeight(x-.06,y)-ioGroundHeight(x+.06,y),ioGroundHeight(x,y-.06)-ioGroundHeight(x,y+.06),.12).normalize();normals.push(normal.x,normal.y,normal.z);
      const stain=ioNoise(x*.31,y*.22)*.65+ioNoise(x*1.4,y*1.4)*.35,bank=smooth01((Math.abs(x-ioChannel(y))-1.8)/.8);
      color.copy(basalt).lerp(red,bank*.8).lerp(sulfur,bank*smooth01((stain-.35)/.24));
      color.lerp(pale,bank*smooth01((ioNoise(x*.6+40,y*.5)-.51)/.24)).lerp(basalt,(1-Math.abs(normal.z))*.7);colors.push(color.r,color.g,color.b);
    }
    for(let row=0;row<rows;row++)for(let col=0;col<cols-1;col++){
      const a=row*cols+col,b=a+1,c=a+cols,d=c+1;
      if(ioNoise(col*17.13+3,(start+row*.3)*3.71)>.5)indices.push(a,b,d,a,d,c);else indices.push(a,b,c,b,d,c);
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);
    const mesh=new T.Mesh(g,ioGround);mesh.name='io-ground-chunk';root.add(mesh);
  }
  return root;
}
