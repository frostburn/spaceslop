import {summerRiver,summerScroll,smooth} from './layout';
import {vortexMotion,vortexWaveIndices} from './vortex';
export {hydraHead,hydraHit,hydraBeamEntry} from './hydra-targets';
export type SummerCourse={kind:'scout'|'drone'|'hydra'|'vortex';formation:'vee'|'weave'|'loop'|'cross';slot:number;mirror:number;at:number};
export const SUMMER_AIR_POOL=24,SUMMER_HYDRA_POOL=2;
export const HYDRA_BODY_Y=3.9;
export function summerMotion(age:number,lane:number,c:SummerCourse,time:number){
  if(c.kind==='hydra'){const world=c.at*2.8+7;return{x:summerRiver(world),y:world-summerScroll(time),heading:0,bank:0};}
  if(c.kind==='vortex')return vortexMotion(age,lane);
  const t=age-c.slot*.2;
  let x=lane,y=11-2.7*t;
  if(c.formation==='weave')x+=.85*Math.sin(t*1.3+c.slot*.65);
  if(c.formation==='cross')x=lane*Math.cos(Math.PI*smooth((t-.4)/3.6));
  if(c.formation==='loop'){const a=Math.PI*2*smooth((t-.8)/4.3);x=c.mirror*(1.9*Math.sin(a)+lane*.45);y=10-1.9*t+1.6*(Math.cos(a)-1);}
  return{x,y,heading:Math.PI,bank:.12*Math.sin(t*1.2+c.slot)};
}
const weapons=['cannon','homing','laser','omega'] as const;
export const summerWaves=Array.from({length:22},(_,i)=>{
  const hydra=i===5||i===12||i===18,vortexIndex=vortexWaveIndices.findIndex(index=>index===i),vortex=vortexIndex>=0,at=2+i*4.25;
  return{time:at,lanes:hydra?[0]:vortex?[vortexIndex%2?-1.55:1.55]:[-2,0,2],carrier:hydra||vortex?0:1,drop:weapons[i%4],summer:{kind:hydra?'hydra' as const:vortex?'vortex' as const:i%3===0?'drone' as const:'scout' as const,
    formation:(['vee','cross','loop','weave'] as const)[i%4],mirror:vortex?(vortexIndex%2?1:-1):i%2?1:-1,at}};
});
