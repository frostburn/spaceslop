// One world: X across the corridor, Y forward, Z up. Rendering and rooted
// enemies use this same transform throughout the abyss approach.
export const VENT_DURATION=100;
export const VENT_APPROACH=8;
export const VENT_CAMERA_SWING=5;
export const VENT_SPEED=1.5;
export const VENT_CAMERA_DISTANCE=40;
export const VENT_STAGE_PITCH=22*Math.PI/180;
export const VENT_PITCH=50*Math.PI/180;
export const VENT_SHAFT_Y=177,VENT_SHAFT_RADIUS=24,VENT_CRAB_RADIUS=21,VENT_CRAB_Z=-7;
export const VENT_END_SCROLL=VENT_SHAFT_Y+VENT_CRAB_RADIUS-4.2*Math.cos(VENT_PITCH)-12*Math.sin(VENT_PITCH);
export const VENT_END_HEIGHT=VENT_CRAB_Z-4.2*Math.sin(VENT_PITCH)+12*Math.cos(VENT_PITCH);
export const VENT_CLIFF_Y=153;
export const ventSmooth=(t:number)=>{const v=Math.max(0,Math.min(1,t));return v*v*(3-2*v);};
// Finish moving the view before revealing the flat articulated boss.
export const ventCameraRise=(time:number)=>ventSmooth((time-VENT_DURATION)/VENT_CAMERA_SWING);
export const ventBossReveal=(time:number)=>ventSmooth((time-VENT_DURATION-VENT_CAMERA_SWING)/(VENT_APPROACH-VENT_CAMERA_SWING));
export function ventScroll(time:number){
 if(time<=VENT_DURATION)return Math.max(0,time)*VENT_SPEED;
 const t=Math.min(1,(time-VENT_DURATION)/VENT_CAMERA_SWING),t2=t*t,t3=t2*t;
 return VENT_SPEED*VENT_DURATION*(2*t3-3*t2+1)+VENT_END_SCROLL*(-2*t3+3*t2)+VENT_SPEED*VENT_CAMERA_SWING*(t3-2*t2+t);
}
// Bursts, planted pauses and direction reversals; the view follows most of the
// angular travel while the crab retains a small, real lateral combat offset.
export function ventOrbit(time:number){
 const t=Math.max(0,time)%12;let angle=0,speed=0;
 const move=(from:number,to:number,start:number,duration:number)=>{const u=(t-start)/duration;angle=from+(to-from)*ventSmooth(u);speed=(to-from)*6*u*(1-u)/duration;};
 if(t<1){}else if(t<3)move(0,.35,1,2);else if(t<5)angle=.35;else if(t<8)move(.35,-.35,5,3);else if(t<10)angle=-.35;else move(-.35,0,10,2);
 const yaw=angle*.85,delta=angle-yaw;
 return{angle,yaw,speed,offsetX:VENT_CRAB_RADIUS*Math.tan(delta)};
}
export function ventFrame(time:number,rise:number){
 return{scroll:ventScroll(time),pitch:VENT_STAGE_PITCH+(VENT_PITCH-VENT_STAGE_PITCH)*rise,height:8+(VENT_END_HEIGHT-8)*rise,yaw:ventOrbit(Math.max(0,time-VENT_DURATION-VENT_APPROACH)).yaw};
}
export function ventWorld(x:number,y:number,z:number,time:number,rise:number){
 const f=ventFrame(time,rise),c=Math.cos(f.yaw),s=Math.sin(f.yaw),dx=x*c-(y-VENT_SHAFT_Y)*s,dy=x*s+(y-VENT_SHAFT_Y)*c+VENT_SHAFT_Y-f.scroll,dz=z-f.height;
 return{x:dx,y:dy*Math.cos(f.pitch)+dz*Math.sin(f.pitch),z:-dy*Math.sin(f.pitch)+dz*Math.cos(f.pitch)};
}
export function ventCliffEdge(x:number){return VENT_SHAFT_Y-Math.sqrt(Math.max(0,(VENT_SHAFT_RADIUS+.2)**2-x*x));}
export function ventFarEdge(x:number){return VENT_SHAFT_Y+Math.sqrt(Math.max(0,VENT_SHAFT_RADIUS**2-x*x));}
export function ventRimHeight(angle:number){return -2+3.5*(1+Math.cos(angle))/2+Math.sin(angle*7)*.12;}
export function ventFarFloor(x:number,y:number){return 1.5+Math.sin(x*.7+y*.4)*.18;}
export function ventBankHeight(x:number,y:number){return -2+Math.sin(x*.7+y*.19)*.15+Math.sin(y*.7+x*.3)*.08;}
export function ventFloor(x:number,y:number){
 // Deep seabed under the raster terraces. Only the last stretch rises into the
 // solid cliff lip; it must not cover the middle/deep formations along the route.
 const lip=ventSmooth((y-135)/18);
 return -16.5+(ventBankHeight(x,y)+16.5)*lip+Math.sin(x*.5+y*.12)*.22*(1-lip);
}
export function ventBossPose(reveal:number,fightTime=0){
 const orbit=ventOrbit(fightTime),a=orbit.angle,radius=VENT_CRAB_RADIUS/Math.cos(orbit.angle-orbit.yaw);
 return{x:Math.sin(a)*radius,y:VENT_SHAFT_Y+Math.cos(a)*radius,z:30+(VENT_CRAB_Z-30)*reveal};
}
export const VENT_SPAWN_LEAD=3;
const anchorTimes=[8,23,39,54,70,84];
export const ventAnchors=[...anchorTimes.map((time,i)=>({time,x:(i%2?-1:1)*3.8,y:time*VENT_SPEED+13,z:1.25,worm:false})),
 ...[17,47,77,90].map((time,i)=>({time,x:(i%2?1:-1)*3.65,y:time*VENT_SPEED+13,z:1.25,worm:true}))];
export function ventAnchorPoint(index:number,time:number){
 const a=ventAnchors[index],p=ventWorld(a.x,a.y,a.z,time,0),scale=VENT_CAMERA_DISTANCE/(VENT_CAMERA_DISTANCE-p.z);
 return{x:p.x*scale,y:p.y*scale,scale};
}
const drops=['homing','cannon','laser','omega'] as const;
type VentWave={time:number;lanes:number[];carrier?:number;drop?:typeof drops[number];ventAnchor?:number;ventWorm?:boolean;shrimp?:{formation:'weave'|'cross'|'curl';mirror:number}};
const patrols:VentWave[]=Array.from({length:18},(_,i)=>({time:.7+i*5.15,lanes:i%3===0?[-2.1,0,2.1]:i%3===1?[-1.9,1.9]:[0,0,0,0],carrier:i%2,drop:drops[i%4],shrimp:{formation:i%3===0?'weave':i%3===1?'cross':'curl',mirror:i%2?1:-1}}));
export const ventWaves:VentWave[]=[...patrols,...ventAnchors.map((a,i)=>({time:a.time-VENT_SPAWN_LEAD,lanes:[0],ventAnchor:i,ventWorm:a.worm}))].sort((a,b)=>a.time-b.time);
export function ventSection(time:number){return time<24?'MINERAL GARDENS':time<50?'BLACK SMOKERS':time<76?'CHIMNEY CANYON':time<94?'FRACTURED SHELF':'ABYSSAL DROP';}
