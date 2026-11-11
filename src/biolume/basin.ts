import {groveScroll} from './route';

const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export const BASIN_START=3.38,BASIN_END=5.52;
export function basinVisible(time:number){const s=groveScroll(time);return s+1>BASIN_START&&s<BASIN_END;}

// Linear albedo distinguishes the olive, low-contrast pools from raised brown
// roots. Route bounds keep similar colored foliage elsewhere completely dry.
export function basinWetness(r:number,g:number,b:number,u:number,at:number,artwork=true){
  const reach=smooth(BASIN_START,3.68,at)*(1-smooth(5.1,BASIN_END,at));
  if(!artwork){const center=.51+.035*Math.sin(at*5);return reach*smooth(4,4.12,at)*(1-smooth(.22,.255,Math.abs(u-center)));}
  const red=(r-g)/Math.max(.001,r+g),lum=r*.2126+g*.7152+b*.0722;
  return reach*(1-smooth(.035,.105,red))*smooth(-.05,-.005,red)*(1-smooth(.075,.12,lum));
}
export const basinMaskGLSL=`
float groveWetness(vec3 albedo,vec2 p,float artwork){
 float reach=smoothstep(${BASIN_START},3.68,p.y)*(1.-smoothstep(5.1,${BASIN_END},p.y));
 if(artwork<.5)return reach*smoothstep(4.,4.12,p.y)*(1.-smoothstep(.22,.255,abs(p.x-(.51+.035*sin(p.y*5.)))));
 float red=(albedo.r-albedo.g)/max(.001,albedo.r+albedo.g),lum=dot(albedo,vec3(.2126,.7152,.0722));
 return reach*(1.-smoothstep(.035,.105,red))*smoothstep(-.05,-.005,red)*(1.-smoothstep(.075,.12,lum));
}`;
