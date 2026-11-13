import {levels} from '../levels';
import {mammothBankX} from './river';
export {summerRiver,summerShoreDistance} from './river';
export const SUMMER_DURATION=levels.summer.duration,SUMMER_APPROACH=6,SUMMER_SPEED=2.8,SUMMER_DISTANCE=22,SUMMER_FLOOR=-18;
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
export const smooth=(x:number)=>{const t=clamp(x);return t*t*(3-2*t);};
export function summerScroll(time:number){const u=clamp((time-SUMMER_DURATION)/SUMMER_APPROACH);return SUMMER_SPEED*(Math.max(0,Math.min(time,SUMMER_DURATION))+SUMMER_APPROACH*(u-u*u+u*u*u/3));}
export const SUMMER_END=summerScroll(SUMMER_DURATION+SUMMER_APPROACH);
export function summerSection(time:number){return time<26?'Mammoth meadow':time<54?'Meandering meltwater':time<78?'Glacier gardens':time<100?'Lotus terraces':'Lotus palace';}
export const mammothSites=Array.from({length:14},(_,i)=>{const y=9+i*18,size=i%5===3?.58:1;return{x:mammothBankX(y,i%2?1:-1,size),y,size,angle:(i%2?-.18:.18)+(i%3-1)*.1};});
