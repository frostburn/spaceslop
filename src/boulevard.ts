// Stable simulation coordinates; the scenery and camera do the head-on swing.
export const BOULEVARD_DURATION=100, BOULEVARD_SPEED=1.7, BOULEVARD_APPROACH=7;
export const BOULEVARD_HP=100, BOULEVARD_INTERVAL=3.4, BOULEVARD_WINDUP=.55, BOULEVARD_FIRE=1.55, BOULEVARD_TRAVEL=.85;
export const BOULEVARD_PITCH=Math.PI*.415, BOULEVARD_VIEW=.40, BOULEVARD_DECK=-3.1, BOULEVARD_RISE=6, BOULEVARD_POOL=16;
export const BOULEVARD_SPAWN_LEAD=4;
export type BoulevardCourse={formation:'chevron'|'cross'|'train'|'rush';slot:number;mirror:number;heavy?:boolean};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
export function boulevardScroll(time:number){
 const stage=Math.max(0,Math.min(time,BOULEVARD_DURATION)),coast=Math.max(0,Math.min(BOULEVARD_APPROACH,time-BOULEVARD_DURATION));
 return BOULEVARD_SPEED*(stage+coast-coast*coast/(2*BOULEVARD_APPROACH)+Math.max(0,time-BOULEVARD_DURATION-BOULEVARD_APPROACH)*.45);
}
export function boulevardFrame(reveal:number){return{pitch:BOULEVARD_PITCH*reveal,viewPitch:BOULEVARD_VIEW*(1-reveal),bank:0};}
export function boulevardBossPoint(time:number,reveal:number){
 const pitch=BOULEVARD_PITCH*reveal,relative=4.2*Math.cos(BOULEVARD_PITCH)+12*Math.sin(BOULEVARD_PITCH),height=4.2*Math.sin(BOULEVARD_PITCH)-12*Math.cos(BOULEVARD_PITCH)+BOULEVARD_RISE;
 const final=BOULEVARD_SPEED*(BOULEVARD_DURATION+BOULEVARD_APPROACH/2),travel=Math.max(0,boulevardScroll(time)-final);
 const y=final+relative+travel-boulevardScroll(time);
 return{x:0,y:y*Math.cos(pitch)+(height-BOULEVARD_RISE*reveal)*Math.sin(pitch),z:-y*Math.sin(pitch)+(height-BOULEVARD_RISE*reveal)*Math.cos(pitch)};
}
export function boulevardSection(time:number){return time<30?'Palm approach':time<43?'Fountain court':time<65?'Entertainment district':time<100?'Skyline express':time<107?'Sunset plaza approach':'Pursuit cruiser';}
function coursePoint(age:number,lane:number,c:BoulevardCourse){
 const t=age-(c.formation==='train'?c.slot*.65:0),speed=c.heavy?1.7:2.65;
 if(c.formation==='cross')return{x:lane*Math.cos(Math.PI*smooth((t-1.1)/3.7)),y:10+c.slot*1.6-speed*t};
 if(c.formation==='train')return{x:c.mirror*1.9*Math.sin(t*1.1),y:10-3*t};
 if(c.formation==='rush')return{x:lane+c.mirror*.5*Math.sin(t*.9),y:10-speed*t-1.3*Math.max(0,t-1.8)**1.3};
 return{x:lane+c.mirror*.34*Math.sin(t*1.2),y:10+Math.abs(lane)*.4-speed*t};
}
export function boulevardMotion(age:number,lane:number,c:BoulevardCourse){
 const p=coursePoint(age,lane,c),a=coursePoint(age-.002,lane,c),b=coursePoint(age+.002,lane,c);
 const vx=(b.x-a.x)/.004,vy=(b.y-a.y)/.004;
 return{...p,heading:Math.atan2(vx,-vy),bank:Math.max(-.25,Math.min(.25,vx*.12))};
}
const drops=['homing','cannon','laser','omega'] as const;
export const boulevardWaves=Array.from({length:20},(_,i)=>({time:1.5+i*4.8,lanes:i%5===4?[0]:i%4===1?[-2,2]:i%4===2?[0,0,0,0]:[-2.1,0,2.1],carrier:i%5===4?0:i%4===2?2:1,drop:drops[i%4],
 boulevard:{formation:(i%5===4?'rush':i%4===1?'cross':i%4===2?'train':'chevron') as BoulevardCourse['formation'],mirror:i%2?1:-1,heavy:i%5===4}}));

// Small, deterministic trim corrections stay inside the fixed combat proxy.
export function boulevardHover(time:number){return{x:.06*Math.sin(time*.73)+.02*Math.sin(time*1.19),y:.045*Math.sin(time*.47),z:.075*Math.sin(time*.91),pitch:.012*Math.sin(time*.61),roll:.014*Math.sin(time*.83),yaw:.010*Math.sin(time*.39)};}
