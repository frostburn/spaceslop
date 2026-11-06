import {VENT_PITCH,ventBossPose,ventFarEdge,ventFarFloor} from './vent-layout';
export const CRAB_CLAW_HP=12,CRAB_CORE_HP=40,CRAB_HP=CRAB_CLAW_HP*2+CRAB_CORE_HP;
export const CRAB_TARGET_X=2.4,CRAB_LEGS=8;
export const crabSmooth=(value:number)=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
export function crabTarget(claws:readonly number[],volley:number){
 if(claws[0]<=0&&claws[1]<=0)return 0;
 const preferred=volley%2;return(claws[preferred]>0?preferred:1-preferred)===0?-CRAB_TARGET_X:CRAB_TARGET_X;
}
// Convert world feet on the far rim into the crab's fixed world-facing plane.
export function crabFeet(reveal:number){
 const boss=ventBossPose(reveal),c=Math.cos(VENT_PITCH),s=Math.sin(VENT_PITCH);
 return Array.from({length:CRAB_LEGS},(_,i)=>{
  const side=i%2?1:-1,row=Math.floor(i/2),step=Math.sin(reveal*Math.PI*8+i*Math.PI)*Math.sin(reveal*Math.PI);
  const x=side*(3.0+row*.8)+boss.x*(1-reveal),y=ventFarEdge(x)+.18+row*.65*reveal+step*.16;
  const z=ventFarFloor(x,y)-7*(1-reveal)+Math.max(0,step)*.55,dy=y-boss.y,dz=z-boss.z;
  return{x:x-boss.x,y:dy*c+dz*s,z:-dy*s+dz*c};
 });
}
