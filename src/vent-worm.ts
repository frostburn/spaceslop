export const WORM_HP=8,WORM_POOL=4,WORM_FIRST_ATTACK=3.6,WORM_INTERVAL=6.6,WORM_WINDUP=.9;
export const WORM_STRIKE=.65,WORM_HOLD=.3,WORM_RETREAT=1.3,WORM_REACH=13.5,WORM_SEGMENTS=34;
const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};

// nextAttack advances at launch. The previous launch remains available throughout
// the strike/retraction, so live play and workshop scrubbing use the same pose.
export function wormPose(age:number,nextAttack:number,reach=8.5,bend=1){
 const since=age-(nextAttack-WORM_INTERVAL),until=nextAttack-age;
 let phase:'hidden'|'windup'|'strike'|'hold'|'retreat'='hidden',length=0,charge=0,jaw=0;
 if(since>=-1e-6&&since<WORM_STRIKE+WORM_HOLD+WORM_RETREAT){
  if(since<WORM_STRIKE){phase='strike';length=1.4+(reach-1.4)*smooth(since/WORM_STRIKE);jaw=1;}
  else if(since<WORM_STRIKE+WORM_HOLD){phase='hold';length=reach;jaw=.7;}
  else {phase='retreat';const t=smooth((since-WORM_STRIKE-WORM_HOLD)/WORM_RETREAT);length=reach*(1-t);jaw=.7*(1-t);}
 }else if(until<=WORM_WINDUP&&until>=0){phase='windup';charge=smooth(1-until/WORM_WINDUP);length=1.4*charge;jaw=charge*.8;}
 const visible=length>.035,count=visible?Math.max(1,Math.ceil(length/.42)):0;
 const joints=Array.from({length:count+1},(_,i)=>{const u=count?i/count:0;return{x:Math.sin(Math.PI*u)*(bend+.12*Math.sin(age*7-u*6))*Math.min(1,length/2),y:-length*u};});
 return{phase,length,charge,jaw,visible,joints};
}
