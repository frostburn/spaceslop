import {titanLights} from './titan-features';

const clamp=(n:number)=>Math.max(0,Math.min(1,n));
// Packs cyan specimen glass / selected lamp caps into green / blue. It is built
// from each decoded tile during preflight; no generated mask file is required.
export function titanMask(pixels:Uint8ClampedArray,width:number,height:number,top:number,totalHeight:number){
 const out=new Uint8ClampedArray(width*height*4),sx=720/width,sy=12800/totalHeight;
 for(let y=0;y<height;y++){
  const globalY=(top+y)*sy;
  for(let x=0;x<width;x++){
   const i=(y*width+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2],px=x*sx;
   const pipe=px>490&&globalY>5750&&globalY<6210?clamp((Math.min(g,b)-r*1.15)/45)*clamp((Math.min(g,b)-50)/65):0;
   out[i+1]=Math.round(pipe*255);out[i+3]=255;
  }
 }
 for(const [lx,ly] of titanLights){
  const cx=lx/sx,cy=ly/sy-top;if(cy< -14||cy>height+14)continue;
  for(let y=Math.max(0,Math.floor(cy-14));y<Math.min(height,cy+14);y++)for(let x=Math.max(0,Math.floor(cx-14));x<Math.min(width,cx+14);x++){
   const i=(y*width+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];
   const radial=clamp((14-Math.hypot((x-cx)*sx,(y-cy)*sy))/5);
   const white=clamp((Math.min(g,b)-115)/85)*clamp((b-r+10)/25);
   out[i+2]=Math.max(out[i+2],Math.round(radial*white*255));
  }
 }
 return out;
}
