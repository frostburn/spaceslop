import {VENT_PITCH,ventBossPose,ventOrbit,VENT_SHAFT_Y,VENT_SHAFT_RADIUS} from './vent-layout';
export const CRAB_CLAW_HP=12,CRAB_CORE_HP=40,CRAB_HP=CRAB_CLAW_HP*2+CRAB_CORE_HP;
export const CRAB_TARGET_X=2.4,CRAB_LEGS=8;
export const crabSmooth=(value:number)=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
export function crabTarget(claws:readonly number[],volley:number){
 if(claws[0]<=0&&claws[1]<=0)return 0;
 const preferred=volley%2;return(claws[preferred]>0?preferred:1-preferred)===0?-CRAB_TARGET_X:CRAB_TARGET_X;
}
// Stance feet hold angular position while the body scurries; swing feet lift
// inward from the cylindrical wall and step to the next anchor.
export function crabFeet(reveal:number,fightTime=0){
 const boss=ventBossPose(reveal,fightTime),orbit=ventOrbit(fightTime),c=Math.cos(VENT_PITCH),s=Math.sin(VENT_PITCH),cy=Math.cos(orbit.yaw),sy=Math.sin(orbit.yaw);
 return Array.from({length:CRAB_LEGS},(_,i)=>{
  const side=i%2?1:-1,row=Math.floor(i/2),phase=((orbit.angle*VENT_SHAFT_RADIUS/1.25+i*.31)%1+1)%1;
  let shift=.325-phase,lift=0;
  if(phase>.65){const t=(phase-.65)/.35,t2=t*t,t3=t2*t;shift=(-.325)*(2*t3-3*t2+1)+.325*(-2*t3+3*t2)-.35*(2*t3-3*t2+t);lift=Math.sin(t*Math.PI)*Math.min(1,Math.abs(orbit.speed)/.1);}
  const climb=Math.max(0,Math.sin(reveal*Math.PI*8+i*Math.PI))*Math.sin(reveal*Math.PI);
  const angle=-.35*(1-reveal)+orbit.angle+side*(.13+row*.045)+shift*1.25/VENT_SHAFT_RADIUS;
  const radius=VENT_SHAFT_RADIUS-.5-(lift+climb)*.35,x=Math.sin(angle)*radius,y=VENT_SHAFT_Y+Math.cos(angle)*radius,z=boss.z-4.6+row*.5+(lift+climb)*.12;
  const dx=x-boss.x,dy=y-boss.y,dz=z-boss.z,ax=dx*cy-dy*sy,ay=dx*sy+dy*cy;
  return{x:ax,y:ay*c+dz*s,z:-ay*s+dz*c};
 });
}
