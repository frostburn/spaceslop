import {BOULEVARD_DECK,BOULEVARD_SPEED,BOULEVARD_VIEW} from './boulevard';
export const MINE_TRIGGER=2.2,MINE_WINDUP=.4,MINE_JUMP=.6,MINE_BURST_TIME=.35,MINE_POOL=4;
export const mineSites=[{at:16,x:-2.35},{at:25,x:2.35},{at:44,x:-1.8},{at:58,x:1.8},{at:74,x:-2.25},{at:86,x:2.3}];
export type BoulevardMine={site:number;triggeredAt?:number;burstAt?:number};
const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
export function minePose(mine:BoulevardMine,time:number){
 const site=mineSites[mine.site],elapsed=mine.triggeredAt===undefined?-1:time-mine.triggeredAt,jump=smooth((elapsed-MINE_WINDUP)/MINE_JUMP),z=(BOULEVARD_DECK+.36)*(1-jump),physicalX=site.x,physicalY=site.at*BOULEVARD_SPEED+8-time*BOULEVARD_SPEED,projection=1/(1-z/(36*Math.cos(BOULEVARD_VIEW)));
 return{x:physicalX*projection,y:(physicalY+Math.tan(BOULEVARD_VIEW)*z)*projection,physicalX,physicalY,z,elapsed,jump,charge:elapsed<0?0:Math.min(1,elapsed/(MINE_WINDUP+MINE_JUMP))};
}
export function triggerMine(mine:BoulevardMine,time:number,player:{x:number;y:number}){
 const p=minePose(mine,time);if(mine.triggeredAt===undefined&&p.y<8&&p.y>-8&&Math.hypot(player.x-p.x,player.y-p.y)<MINE_TRIGGER)mine.triggeredAt=time;return minePose(mine,time);
}
export function mineBurst(x:number,y:number){return Array.from({length:12},(_,i)=>{const a=i*Math.PI*2/12;return{x:x+Math.sin(a)*.28,y:y+Math.cos(a)*.28,z:0,vx:Math.sin(a)*3.6,vy:Math.cos(a)*3.6,vz:0};});}
