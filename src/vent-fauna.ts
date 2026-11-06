export type ShrimpFormation='weave'|'cross'|'curl';
export type ShrimpCourse={formation:ShrimpFormation;mirror:number;slot:number};
export const SHRIMP_HP=3,SHRIMP_POOL=12,SHRIMP_FIRST_FIRE=1.9,SHRIMP_INTERVAL=3.1;
export const WORM_HP=6,WORM_POOL=4,WORM_FIRST_FIRE=2.4,WORM_INTERVAL=4.6,WORM_WINDUP=.7;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};

function shrimpPoint(age:number,lane:number,course:ShrimpCourse){
 const t=age-(course.formation==='curl'?course.slot*.48:0),mirror=course.mirror;
 if(course.formation==='cross')return{x:lane*Math.cos(Math.PI*smooth(t/5)),y:8.8-2.1*t};
 if(course.formation==='curl'){
  const angle=2*Math.PI*smooth((t-1.15)/3.3);
  return{x:mirror*(-1.05+1.05*(1-Math.cos(angle))),y:8.8-2.1*t-1.65*Math.sin(angle)};
 }
 return{x:lane+mirror*.35*Math.sin(t*1.6),y:8.8-2.15*t+Math.abs(lane)*.25};
}
// Absolute, tangent-continuous routes let the train follow one curve without
// teleporting or frame-rate-dependent turns. Local forward is -Y for both rigs.
export function shrimpMotion(age:number,lane:number,course:ShrimpCourse){
 const p=shrimpPoint(age,lane,course),a=shrimpPoint(age-.001,lane,course),b=shrimpPoint(age+.001,lane,course);
 const vx=(b.x-a.x)/.002,vy=(b.y-a.y)/.002;
 return{...p,heading:Math.atan2(vx,-vy),speed:Math.hypot(vx,vy)};
}
export function wormPose(age:number,nextFire:number){
 const charge=clamp(1-(nextFire-age)/WORM_WINDUP),since=age-(nextFire-WORM_INTERVAL);
 const recoil=since>=-1e-6&&since<.35?1-smooth(Math.max(0,since)/.35):0;
 const open=Math.max(charge,recoil),extension=.68+.45*open,bend=.16*Math.sin(age*.9)*(1-open*.5);
 const joints=Array.from({length:4},(_,i)=>({x:bend*Math.sin(i*.7),y:-i*.28*extension}));
 return{charge,recoil,open,joints};
}
type Body={x:number;y:number;age:number;fire:number;heading?:number;mortarAngle?:number;ventScale?:number;ventWorm?:boolean;shrimp?:ShrimpCourse};
export function faunaPoint(body:Body,local:{x:number;y:number}){
 const angle=body.ventWorm?body.mortarAngle??0:body.heading??0,c=Math.cos(angle),s=Math.sin(angle),scale=body.ventScale??1;
 return{x:body.x+(local.x*c-local.y*s)*scale,y:body.y+(local.x*s+local.y*c)*scale};
}
export function faunaMuzzle(body:Body){return faunaPoint(body,body.ventWorm?wormPose(body.age,body.fire).joints[3]:{x:0,y:-.73});}
export function faunaHulls(body:Body){
 const local=body.ventWorm?wormPose(body.age,body.fire).joints.slice(1).map((p,i)=>({...p,radius:i===2?.40:.27})):
  [{x:0,y:-.43,radius:.38},{x:0,y:.04,radius:.38},{x:0,y:.52,radius:.32}];
 return local.map(p=>({...faunaPoint(body,p),radius:p.radius*(body.ventScale??1)}));
}
// Swept projectiles, lasers, towlines and ramming share the same articulated
// living silhouette. Tube rims and fine legs are decorative, not extra targets.
export function faunaBodyHit(body:Body,a:{x:number;y:number},b:{x:number;y:number},padding=0){
 const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
 return faunaHulls(body).some(p=>{
  const t=length?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/length):0;
  return(p.x-a.x-dx*t)**2+(p.y-a.y-dy*t)**2<=(p.radius+padding)**2;
 });
}
