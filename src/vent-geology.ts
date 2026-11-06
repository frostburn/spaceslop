import * as T from 'three';
import {ioNoise} from './io-layout';
import {ioTriplanar} from './io-surface';
import {ventFloor,ventCliffEdge,ventRimHeight,VENT_SHAFT_Y,VENT_SHAFT_RADIUS} from './vent-layout';

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
  const crack=Math.min(1,(second-first)*14),grain=ioNoise(x*.7+20,y*.7+10),value=(.50+crack*.10+grain*.25)*255;
  data.set([value,value,value,255],(y*n+x)*4);
 }
 basalt=new T.DataTexture(data,n,n);basalt.wrapS=basalt.wrapT=T.RepeatWrapping;basalt.generateMipmaps=true;basalt.minFilter=T.LinearMipmapLinearFilter;basalt.magFilter=T.LinearFilter;basalt.needsUpdate=true;return basalt;
}
export function createVentGeology(){
 const root=new T.Group();root.name='vent-cliff-geology';
 const relief=basaltRelief(),material=ioTriplanar(new T.MeshStandardMaterial({vertexColors:true,map:relief,bumpMap:relief,bumpScale:.42,roughness:.98,side:T.DoubleSide}),.20);
 const positions:number[]=[],colors:number[]=[],indices:number[]=[];
 function vertex(x:number,y:number,z:number,shade:number){positions.push(x,y,z);colors.push(.012*shade,.018*shade,.020*shade);}
 const cols=96,rows=90;
 for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
  const x=24*Math.sin((i/cols-.5)*Math.PI),edge=ventCliffEdge(x),y=-20+(edge+20)*j/rows;
  vertex(x,y,ventFloor(x,y),(.65+Math.min(1,Math.max(0,(Math.abs(x)-1.6)/3))*.65)*(.7+ioNoise(x*.55+40,y*.5+20)*.5));
 }
 for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;indices.push(a,a+1,b,a+1,b+1,b);}
 const start=positions.length/3,segments=192,bands=8;
 // An annulus around an open shaft. There is no horizontal cap inside the rim.
 for(let j=0;j<=bands;j++)for(let i=0;i<=segments;i++){
  const angle=i/segments*Math.PI*2,r=VENT_SHAFT_RADIUS+j/bands*18;
  const x=Math.sin(angle)*r,y=VENT_SHAFT_Y+Math.cos(angle)*r;
  const z=Math.abs(x)<24&&y<ventCliffEdge(x)?ventFloor(x,y)-.1:ventRimHeight(angle)+j/bands*.22;vertex(x,y,z,1.0);
 }
 for(let j=0;j<bands;j++)for(let i=0;i<segments;i++){const a=start+j*(segments+1)+i,b=a+segments+1;indices.push(a,a+1,b,a+1,b+1,b);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();
 smoothSeam(g,start,segments,bands);
 const shelf=new T.Mesh(g,material);shelf.name='finite-corridor-shelves';shelf.receiveShadow=true;root.add(shelf);
 const p:number[]=[],c:number[]=[],idx:number[]=[],depthRows=36;
 for(let j=0;j<=depthRows;j++)for(let i=0;i<=segments;i++){
  const angle=i/segments*Math.PI*2,top=ventRimHeight(angle),depth=j/depthRows*78,z=top-depth;
  const r=VENT_SHAFT_RADIUS+Math.min(1,depth/3)*(ioNoise(Math.sin(angle)*7+20,z*.3+30)*1.25+.4*Math.sin(angle*11+Math.sin(z*.2))**2);
  p.push(Math.sin(angle)*r,VENT_SHAFT_Y+Math.cos(angle)*r,z);
  const strata=(.65+.2*Math.sin(z*.7+angle*2))*(.22+.78*Math.exp(-depth*.035)),noise=.75+ioNoise(angle*8+50,z*.45+50)*.4;
  c.push(.11*strata*noise,.18*strata*noise,.20*strata*noise);
 }
 for(let j=0;j<depthRows;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;idx.push(a,b,a+1,a+1,b,b+1);}
 const wall=new T.BufferGeometry();wall.setAttribute('position',new T.Float32BufferAttribute(p,3));wall.setAttribute('color',new T.Float32BufferAttribute(c,3));wall.setIndex(idx);wall.computeVertexNormals();
 smoothSeam(wall,0,segments,depthRows);
 const cliff=new T.Mesh(wall,material);cliff.name='abyss-cliff-faces';root.add(cliff);return root;
}

function smoothSeam(g:T.BufferGeometry,start:number,segments:number,rows:number){
 const n=g.attributes.normal,v=new T.Vector3();for(let row=0;row<=rows;row++){const a=start+row*(segments+1),b=a+segments;v.set(n.getX(a)+n.getX(b),n.getY(a)+n.getY(b),n.getZ(a)+n.getZ(b)).normalize();n.setXYZ(a,v.x,v.y,v.z);n.setXYZ(b,v.x,v.y,v.z);}
}
