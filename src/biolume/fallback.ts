import * as T from 'three';
import type {SurfaceKind} from './layout';

// Source-drawn material samples remain usable when the optional raster is absent.
export function fallbackTexture(kind:SurfaceKind){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d')!;
  let seed=117;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  if(kind==='ground'){
    c.fillStyle='#706657';c.fillRect(0,0,256,256);
    for(let i=0;i<4500;i++){const n=35+random()*90;c.fillStyle=`rgb(${n+10} ${n+4} ${n})`;c.fillRect(random()*256,random()*256,1+random()*3,1+random()*2);}
  }else{
    c.beginPath();
    if(kind==='root'){
      c.moveTo(123,5);c.bezierCurveTo(20,70,203,140,65,238);c.quadraticCurveTo(75,257,160,249);c.bezierCurveTo(262,158,88,72,189,20);c.closePath();c.fillStyle='#8b806b';
    }else if(kind==='leaf'){
      c.moveTo(128,7);c.bezierCurveTo(143,35,256,100,233,166);c.bezierCurveTo(222,213,148,215,128,250);c.bezierCurveTo(110,219,24,222,19,164);c.bezierCurveTo(8,100,109,43,128,7);c.fillStyle='#778361';
    }else{
      c.moveTo(126,4);c.bezierCurveTo(158,74,243,138,211,202);c.quadraticCurveTo(198,232,128,252);c.quadraticCurveTo(30,215,36,164);c.bezierCurveTo(40,120,128,73,126,4);c.fillStyle='#b4a17d';
    }
    c.fill();c.save();c.clip();
    for(let i=0;i<2500;i++){const n=50+random()*100;c.fillStyle=`rgba(${n+16},${n+9},${n},.18)`;c.fillRect(random()*256,random()*256,1+random()*4,1+random()*3);}
    c.strokeStyle=kind==='leaf'?'#b4bd98':'#665e4b';c.lineWidth=1.7;
    for(let i=0;i<12;i++){c.beginPath();if(kind==='leaf'){c.moveTo(128,34+i*16);c.quadraticCurveTo(162,50+i*13,214-i*4,90+i*10);c.moveTo(128,34+i*16);c.quadraticCurveTo(95,50+i*13,42+i*4,90+i*10);}else{c.moveTo(20+i*20,0);c.bezierCurveTo(i*20+44,82,i*20-17,156,i*20+25,256);}c.stroke();}
    c.restore();
  }
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;return texture;
}
