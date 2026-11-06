import type {WingWeapon} from './wing';
export const CICADA_SCOUT_POOL=12;
export type CicadaFormation='chevron'|'sweep'|'dive';
export type CicadaCourse={formation:CicadaFormation;slot:number;count:number;mirror:number};
function cicadaPoint(age:number,lane:number,course:CicadaCourse){
 const t=age-course.slot*.18;
 if(course.formation==='sweep')return{x:course.mirror*(4.3-t*1.1)+lane*.42,y:9.2-t*2.5+Math.sin(t*1.2)*.4};
 if(course.formation==='dive'){
  const dive=Math.max(0,t-1),acceleration=dive<.6?dive*dive/1.2:dive-.3;
  return{x:lane+Math.sin(t*2.1)*.65,y:9.3-t*1.8-acceleration*2.5};
 }
 return{x:lane+Math.sin(age*1.8)*.42*course.mirror,y:9.2+Math.abs(lane)*.25-age*2.65};
}
export function cicadaMotion(age:number,lane:number,course:CicadaCourse){
 const p=cicadaPoint(age,lane,course),a=cicadaPoint(age-.01,lane,course),b=cicadaPoint(age+.01,lane,course);
 return{...p,heading:Math.atan2(b.x-a.x,b.y-a.y),bank:Math.max(-.4,Math.min(.4,(b.x-a.x)*5))};
}
export const titanInsectWaves=Array.from({length:20},(_,i)=>{
 const centipede=i%4===2;
 const lanes=centipede?[[.8],[-.8],[.2],[-.3],[.6]][Math.floor(i/4)]:i%4===0?[-2.3,0,2.3]:i%4===1?[-1.5,1.5]:[-2.4,-1.2,0,1.2,2.4];
 return{time:1+i*3.9,lanes,carrier:centipede?2+i%2:i%lanes.length,
  drop:(['homing','cannon','laser','omega'] as const)[i%4] as WingWeapon,
  centipede:centipede?6+Math.floor(i/8):undefined,
  cicada:centipede?undefined:({formation:(i%4===0?'chevron':i%4===1?'sweep':'dive') as CicadaFormation,mirror:i%8<4?1:-1})};
});
