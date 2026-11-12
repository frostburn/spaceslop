export const MORTAR_HP=4;
export const MORTAR_REACH=.56;
export const MORTAR_RADIUS=.66;
export const MORTAR_FIRST_FIRE=1.8;
export const MORTAR_INTERVAL=4.5;
export const MORTAR_WINDUP=1.05;
export const MORTAR_SHOT_SPEED=3.35;
export const MORTAR_POOL=4;
export function mortarPose(age:number,nextFire:number){
 const charge=Math.max(0,Math.min(1,1-(nextFire-age)/MORTAR_WINDUP)),since=age-(nextFire-MORTAR_INTERVAL);
 const recoil=since>=-1e-6&&since<.24?1-Math.max(0,since)/.24:0;
 return{charge,recoil,opening:Math.max(.12,charge,recoil*.8),extension:.16*charge-.10*recoil};
}
export function mortarAim(enemy:{x:number;y:number},target:{x:number;y:number}){return Math.atan2(target.x-enemy.x,enemy.y-target.y);}
export function mortarMuzzle(enemy:{x:number;y:number;ventScale?:number;age:number;fire:number},angle:number){
 const reach=(MORTAR_REACH+mortarPose(enemy.age,enemy.fire).extension)*(enemy.ventScale??1);
 return{x:enemy.x+Math.sin(angle)*reach,y:enemy.y-Math.cos(angle)*reach};
}
