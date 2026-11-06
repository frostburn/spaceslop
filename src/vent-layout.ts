// One world: X across the corridor, Y forward, Z up. Rendering and rooted
// enemies use this same transform throughout the abyss approach.
export const VENT_DURATION=100;
export const VENT_APPROACH=8;
export const VENT_SPEED=1.5;
export const VENT_CAMERA_DISTANCE=40;
export const VENT_STAGE_PITCH=22*Math.PI/180;
export const VENT_PITCH=72*Math.PI/180;
export const VENT_END_SCROLL=VENT_SPEED*(VENT_DURATION+VENT_APPROACH/2);
export const VENT_CLIFF_Y=153;
export const ventSmooth=(t:number)=>{const v=Math.max(0,Math.min(1,t));return v*v*(3-2*v);};
export function ventScroll(time:number){
 const stage=Math.max(0,Math.min(VENT_DURATION,time)),t=Math.max(0,Math.min(VENT_APPROACH,time-VENT_DURATION));
 return VENT_SPEED*(stage+t-t*t/(2*VENT_APPROACH));
}
export function ventFrame(time:number,rise:number){
 return{scroll:ventScroll(time),pitch:VENT_STAGE_PITCH+(VENT_PITCH-VENT_STAGE_PITCH)*rise,height:8-2*rise};
}
export function ventWorld(x:number,y:number,z:number,time:number,rise:number){
 const f=ventFrame(time,rise),dy=y-f.scroll,dz=z-f.height;
 return{x,y:dy*Math.cos(f.pitch)+dz*Math.sin(f.pitch),z:-dy*Math.sin(f.pitch)+dz*Math.cos(f.pitch)};
}
export function ventCliffEdge(x:number){return VENT_CLIFF_Y+Math.sin(x*.35)*.6;}
export function ventFarEdge(x:number){const t=Math.min(1,Math.abs(x)/9);return 168.5+2.5*t*t;}
export function ventFarFloor(x:number,y:number){return 1.5+Math.sin(x*.7+y*.4)*.18;}
export function ventBankHeight(x:number,y:number){return -2+Math.sin(x*.7+y*.19)*.15+Math.sin(y*.7+x*.3)*.08;}
export function ventFloor(x:number,y:number){
 // Deep seabed under the raster terraces. Only the last stretch rises into the
 // solid cliff lip; it must not cover the middle/deep formations along the route.
 const lip=ventSmooth((y-135)/18);
 return -16.5+(ventBankHeight(x,y)+16.5)*lip+Math.sin(x*.5+y*.12)*.22*(1-lip);
}
export function ventBossPose(rise:number){
 const endY=VENT_END_SCROLL+4.2*Math.cos(VENT_PITCH)+12*Math.sin(VENT_PITCH);
 const endZ=6+4.2*Math.sin(VENT_PITCH)-12*Math.cos(VENT_PITCH);
 const a=-1.1*(1-rise),climb=ventSmooth((rise-.1)/.75);
 const x=Math.sin(a)*8.7;
 return{x,y:endY+ventFarEdge(x)-ventFarEdge(0),z:-7+(endZ+7)*climb};
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
