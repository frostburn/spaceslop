import { wingRewardForWave } from '../wing';
import {groveScroll} from './route';
export type GroveCourse={kind:'glider'|'skimmer'|'sentry'|'frog';anchor?:number;formation:'weave'|'train'|'sweep';slot:number;mirror:number};
export const GROVE_ENEMY_POOL=18,GROVE_SPAWN_LEAD=2.5;
const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
const integratedRamp=(t:number)=>t<=0?0:t>=1?t-.5:t*t*t-.5*t*t*t*t;

function point(age:number,lane:number,c:GroveCourse){
  const t=age-c.slot*.3;
  let x=lane+.55*Math.sin(t*1.1+c.slot*.7),y=9.5-t*2.3;
  if(c.kind==='frog')return{x:lane,y:6.6-(groveScroll((c.anchor??0)+age)-groveScroll(c.anchor??0))*16};
  if(c.kind==='sentry'){
    const pause=integratedRamp(t-1.5)-integratedRamp(t-4.5);
    x=lane+.18*Math.sin(t*1.3);y=9.5-2.3*(t-pause);
  }else if(c.formation==='train'){
    const loop=Math.PI*2*smooth((t-.8)/4.2);
    x=c.mirror*(lane*.3+1.9*Math.sin(loop));y=9.5-2.2*t+1.25*(Math.cos(loop)-1);
  }else if(c.formation==='sweep'){
    x=c.mirror*(lane*.25-2.8+1.05*t);y=9.5-t*(c.kind==='skimmer'?3.3:2.5);
  }else if(c.kind==='skimmer'){x=lane+.7*Math.sin(t*1.8);y=9.5-3.25*t;}
  return{x,y};
}
export function groveMotion(age:number,lane:number,c:GroveCourse){
  const p=point(age,lane,c),a=point(age-.005,lane,c),b=point(age+.005,lane,c);
  return{...p,heading:Math.atan2(b.x-a.x,a.y-b.y),bank:.12*Math.sin(age*1.3+c.slot)};
}
export function groveCanAttack(age:number,lane:number,c:GroveCourse){const p=point(age,lane,c);return age>1&&p.y<(c.kind==='frog'?5.3:6.6)&&p.y>(c.kind==='frog'?-4.8:-6)&&Math.abs(p.x)<3.6;}
export function groveEnemySize(c:GroveCourse){return c.kind==='frog'?.68:c.kind==='sentry'?.7:c.kind==='skimmer'?.44:.57;}
const drops=['homing','cannon','laser','omega']as const;
const aerialWaves=Array.from({length:20},(_,i)=>{
  const time = 3 + i * 4.45;
  const sentries = i % 5 === 3 || i === 16 || i === 19;
  const kind = sentries ? 'sentry' : i >= 8 && i <= 12 ? 'skimmer' : 'glider';
  const formation=(['weave','sweep','train','weave']as const)[i%4];
  const lanes = kind === 'sentry' ? (i === 19 ? [-2.65, 0, 2.65] : [-2.65, 2.65])
    : formation === 'train' ? [0, 0, 0, 0] : i === 12 || i === 15 ? [-2.6, -.9, .9, 2.6] : [-2, 0, 2];
  return{time,lanes,drop:wingRewardForWave(drops,i),
    grove:{kind,formation,mirror:i%2?1:-1}as Omit<GroveCourse,'slot'>};
});

// Bank-perched frogs are registered to the raster route, not aerial paths.
const frogWaves=[[22,1.8],[36,-2.6],[48,2.5],[62,-2.4],[75,2.5],[85,-2.6]].map(([time,lane],i)=>({time,lanes:[lane],drop:drops[(i+1)%4],grove:{kind:'frog',formation:'weave',slot:0,mirror:1,anchor:time}as GroveCourse}));
export const groveWaves=[...aerialWaves,...frogWaves].sort((a,b)=>a.time-b.time);
