import * as T from 'three';
import {VENT_STAGE_PITCH} from './vent-layout';

// Eight independent cells: four overhead formations, four head-on formations.
// Optional reviewed art replaces this runtime-drawn atlas without changing the
// placement, camera, collision or animation. No generated image is stored in Git.
export const VENT_ATLAS_COLUMNS=4,VENT_ATLAS_ROWS=2;
function random(seed:number){return()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};}
export function createVentAtlas(){
 const size=256,canvas=document.createElement('canvas');canvas.width=size*4;canvas.height=size*2;const c=canvas.getContext('2d')!;
 for(let cell=0;cell<8;cell++){
  c.save();c.translate(cell%4*size,Math.floor(cell/4)*size);c.beginPath();c.rect(0,0,size,size);c.clip();const rng=random(7921+cell*103);
  function rock(x:number,y:number,rx:number,ry:number){
   const points=Array.from({length:12},(_,i)=>{const a=i/12*Math.PI*2,r=.8+rng()*.3;return[x+Math.cos(a)*rx*r,y+Math.sin(a)*ry*r];});
   c.beginPath();points.forEach(([px,py],i)=>i?c.lineTo(px,py):c.moveTo(px,py));c.closePath();
   const fill=c.createLinearGradient(x-rx,y-ry,x+rx,y+ry);fill.addColorStop(0,'#7e8a83');fill.addColorStop(.3,'#414e4c');fill.addColorStop(1,'#101f25');c.fillStyle=fill;c.fill();c.strokeStyle='#202c2e';c.lineWidth=2;c.stroke();
   for(let i=0;i<6;i++){const p=points[i],q=points[(i+4)%12];c.beginPath();c.moveTo(...p as [number,number]);c.lineTo((p[0]+q[0])/2,(p[1]+q[1])/2);c.stroke();}
  }
  const front=cell>=4;
  if(front){for(let i=0;i<12;i++)rock(55+rng()*145,120+rng()*80,25+rng()*33,45+rng()*55);}
  else for(let i=0;i<16;i++)rock(40+rng()*176,48+rng()*165,23+rng()*40,20+rng()*35);
  const vent=cell===2||cell===3||cell===5||cell===7;
  if(vent){
   const x=128,y=front?32:59;rock(x,front?134:128,37,front?108:78);
   c.beginPath();c.ellipse(x,y,27,front?12:22,0,0,Math.PI*2);c.fillStyle='#c0b99b';c.fill();c.lineWidth=6;c.strokeStyle='#848b78';c.stroke();
   c.beginPath();c.ellipse(x,y,17,front?7:14,0,0,Math.PI*2);c.fillStyle='#06141b';c.fill();
  }
  // Fine mineral crust, sparse pale colonies and rust-colored sulfide patches.
  c.globalCompositeOperation='source-atop';
  for(let i=0;i<220;i++){
   const x=46+rng()*164,y=(front?110:52)+rng()*(front?117:152);
   c.fillStyle=i%4===0?'#947248':i%3===0?'#abb7a4':'#687775';c.globalAlpha=.3+rng()*.4;c.fillRect(x,y,1+rng()*4,1+rng()*4);
  }
  c.globalAlpha=1;c.globalCompositeOperation='source-over';
  if(cell===6||cell===1){for(let i=0;i<16;i++){const x=70+rng()*118,y=144+rng()*48;c.strokeStyle='#aebdb2';c.lineWidth=3;c.beginPath();c.moveTo(x,y);c.lineTo(x-3,y-10-rng()*25);c.stroke();}}
  c.restore();
 }
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.generateMipmaps=true;texture.anisotropy=4;return texture;
}
// Raise the painted chimney above its rubble apron. Low shelves can overlap
// the foot without cutting across the tower or its mouth.
export function ventCardRelief(cell:number,v:number){return cell===2||cell===3?-.65+Math.max(0,v-.35)*10:0;}
export function ventCardGeometry(cell:number){
 const g=new T.PlaneGeometry(1,1,1,cell===2||cell===3?16:1),uv=g.attributes.uv,col=cell%4,row=Math.floor(cell/4),pad=.012;
 const positions=g.attributes.position;for(let i=0;i<uv.count;i++){const relief=ventCardRelief(cell,uv.getY(i));positions.setZ(i,relief);positions.setY(i,positions.getY(i)-relief*Math.tan(VENT_STAGE_PITCH)/7.5);}g.computeVertexNormals();
 for(let i=0;i<uv.count;i++)uv.setXY(i,(col+pad+uv.getX(i)*(1-pad*2))/4,1-(row+1-pad-uv.getY(i)*(1-pad*2))/2);
 return g;
}
