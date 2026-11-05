import {titanLights,titanRiver,titanRiverSpans} from './titan-features';

export function riverCenter(y:number){
 let i=0;while(i<titanRiver.length-2&&titanRiver[i+1][0]<y)i++;
 const a=titanRiver[i],b=titanRiver[i+1],t=Math.max(0,Math.min(1,(y-a[0])/(b[0]-a[0])));
 return a[1]+(b[1]-a[1])*t;
}
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
// Packs river / cyan specimen glass / selected lamp caps into RGB. It is built
// from each decoded tile during preflight; no generated mask file is required.
export function titanMask(pixels:Uint8ClampedArray,width:number,height:number,top:number,totalHeight:number){
 const out=new Uint8ClampedArray(width*height*4),sx=720/width,sy=12800/totalHeight;
 for(let y=0;y<height;y++){
  const globalY=(top+y)*sy,cx=riverCenter(globalY);
  const exposed=Math.max(0,...titanRiverSpans.map(([a,b])=>clamp(Math.min(globalY-a,b-globalY)/24)));
  for(let x=0;x<width;x++){
   const i=(y*width+x)*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2],px=x*sx;
   const channel=exposed*clamp((40-Math.abs(px-cx))/14)*clamp((40-(r+g+b)/3)/18);
   const pipe=px>490&&globalY>5750&&globalY<6210?clamp((Math.min(g,b)-r*1.15)/45)*clamp((Math.min(g,b)-50)/65):0;
   out[i]=Math.round(channel*255);out[i+1]=Math.round(pipe*255);out[i+3]=255;
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
