import * as T from 'three';
import type {SurfaceKind} from './layout';

// Source-drawn material samples remain usable when the optional raster is absent.
export function fallbackTexture(kind:SurfaceKind,screen=0){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d')!;
  let seed=117+screen*137;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  if(kind==='backdrop'){
    c.fillStyle='#706657';c.fillRect(0,0,256,256);
    for(let i=0;i<4500;i++){const n=35+random()*90;c.fillStyle=`rgb(${n+10} ${n+4} ${n})`;c.fillRect(random()*256,random()*256,1+random()*3,1+random()*2);}
    c.strokeStyle='#8b806b';c.lineWidth=22;c.beginPath();c.moveTo(20,0);c.bezierCurveTo(42,85,0,160,24,256);c.moveTo(235,0);c.bezierCurveTo(205,80,260,190,240,256);c.stroke();
    if(screen===4||screen===5){c.fillStyle='#303c37';c.beginPath();c.moveTo(56,0);c.bezierCurveTo(100,60,30,170,55,256);c.lineTo(215,256);c.bezierCurveTo(180,180,230,60,204,0);c.fill();}
  }else{
    const leaf=(x:number,y:number,angle:number,size:number)=>{
      c.save();c.translate(x,y);c.rotate(angle);c.scale(size,size);c.beginPath();c.moveTo(0,-55);c.bezierCurveTo(62,-25,55,35,0,55);c.bezierCurveTo(-55,35,-62,-25,0,-55);c.fillStyle='#a6b294';c.fill();
      c.strokeStyle='#67775d';c.lineWidth=2;c.beginPath();c.moveTo(0,-55);c.lineTo(0,55);for(let i=-30;i<40;i+=15){c.moveTo(0,i);c.lineTo(25,i-14);c.moveTo(0,i);c.lineTo(-25,i-14);}c.stroke();c.restore();
    };
    if(screen!==9){leaf(35,30,-.7,.9);leaf(15,66,-.3,.8);}
    leaf(230,108,.8,screen>=8?.4:.9);if(screen!==4&&screen!==5&&screen<8){leaf(227,150,.5,.8);leaf(38,226,-.9,.9);}
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return texture;
}
