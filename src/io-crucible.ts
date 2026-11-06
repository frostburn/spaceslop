// Combat-plane coordinates; scenery and optional textures never affect these.
export const CRUCIBLE_HP=10;
export const CRUCIBLE_RADIUS=.9;
export const CRUCIBLE_FIRST_POUR=1.8;
export const CRUCIBLE_POUR_INTERVAL=2.6;
export const CRUCIBLE_WINDUP=.7;
export const CRUCIBLE_MUZZLE_Y=-.98;
export const CRUCIBLE_POOL=2;
export const SLAG_POOL=40;
export const SLAG_COOL_TIME=.9;
export const SLAG_RADIUS=.24;

export function crucibleMotion(age:number,direction:number){
  return {x:Math.sign(direction)*(-5.8+age*1.15),y:6.7-age*.23+Math.sin(age*.65)*.25};
}
export function crucibleValve(age:number,nextPour:number){
  const since=age-(nextPour-CRUCIBLE_POUR_INTERVAL);
  if(since>=-1e-6&&since<.3)return 1-Math.max(0,since)/.3;
  return Math.max(0,Math.min(1,(age-nextPour+CRUCIBLE_WINDUP)/CRUCIBLE_WINDUP));
}
export function slagHeat(age:number){return Math.max(0,1-age/SLAG_COOL_TIME);}
export function slagSpeed(age:number){return .72+.28*slagHeat(age);}
