import {levels} from '../levels';
export const SUMMER_DURATION=levels.summer.duration,SUMMER_APPROACH=6,SUMMER_SPEED=2.8,SUMMER_DISTANCE=22,SUMMER_FLOOR=-18,SUMMER_HP=90;
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
export const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};
export function summerScroll(time:number){const u=clamp((time-SUMMER_DURATION)/SUMMER_APPROACH);return SUMMER_SPEED*(Math.max(0,Math.min(time,SUMMER_DURATION))+SUMMER_APPROACH*(u-u*u+u*u*u/3));}
export const SUMMER_END=summerScroll(SUMMER_DURATION+SUMMER_APPROACH);
export function summerRiver(y:number){return 1.4*Math.sin(y*.036)+.65*Math.sin(y*.087+1);}
export function summerShoreDistance(x:number,y:number){
  const river=summerRiver(y),width=1.15+.4*Math.sin(y*.05+1)+.18*Math.sin(y*.13);
  const branch=smooth((y-30)/14)*(1-smooth((y-153)/17));
  return Math.min(Math.abs(x-river),20*(1-branch)+(Math.abs(x-river-2.1-Math.sin(y*.15)*1.6)+width-.3)*branch)-width;
}
export function summerSection(time:number){return time<26?'Mammoth meadow':time<54?'Braided meltwater':time<78?'Glacier gardens':time<100?'Lotus terraces':'Lotus palace';}
export const mammothSites=Array.from({length:14},(_,i)=>{const y=9+i*18;return{x:(i%2?1:-1)*(4.8+(i%3)*.7),y,size:i%5===3?.58:1,angle:(i%2?-.3:.3)+(i%3-1)*.18};});
