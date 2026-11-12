import { wingRewardForWave } from './wing';
import {levels} from './levels';
export const IO_SCREENS = 10;
export const IO_DURATION=levels.io.duration;
export const IO_APPROACH = 8;
export const IO_SPEED = 1.6;
export const IO_PITCH = 55 * Math.PI / 180;
export const IO_HEIGHT = 8;
export const IO_STAGE_HEIGHT = 12;
export const IO_CAMERA_DISTANCE = 40;
export const IO_HP = 60;
export const IO_LEG_HP = 16;
export const IO_INTERVAL = 4.5;
export const IO_WINDUP = .65;
export const IO_FIRE = 1.65;
export const IO_TRAVEL = 1.05;
export const IO_SKIPPER_POOL = 12;
export const IO_FOOT_DROP = 6.85;
export const IO_WHEEL_SCALE = 1.35;
export const IO_WHEEL_Y = 3.25;
export const IO_FINAL_SCROLL = IO_SPEED * (IO_DURATION + IO_APPROACH / 2);
export const IO_BOSS_Y = IO_FINAL_SCROLL + 4.8 * Math.cos(IO_PITCH) + 12 * Math.sin(IO_PITCH);
export const IO_CALDERA_Y = IO_FINAL_SCROLL + 17.6;
export const IO_APRON_Y = IO_FINAL_SCROLL - 6;
export const IO_BREACH_Y = 134;
export const IO_BOSS_Z = IO_HEIGHT + 4.8 * Math.sin(IO_PITCH) - 12 * Math.cos(IO_PITCH);
export const smooth01 = (t: number) => { const p=Math.max(0,Math.min(1,t)); return p*p*(3-2*p); };

export function ioScroll(time: number) {
  const stage = Math.max(0,Math.min(IO_DURATION,time)), t=Math.max(0,Math.min(IO_APPROACH,time-IO_DURATION));
  return IO_SPEED * (stage + t - t*t/(2*IO_APPROACH));
}
export function ioFrame(time: number, rise: number) {
  const scroll=ioScroll(time),stage=1-rise;
  // Straight, steady flight: the terrain can meander without steering the view.
  return { pitch:28*Math.PI/180*stage+IO_PITCH*rise,bank:0,
    height:IO_STAGE_HEIGHT*stage+IO_HEIGHT*rise,scroll,trackX:0 };
}
export function ioWorld(y: number, z: number, time: number, rise: number,x=0) {
  const f=ioFrame(time,rise),dx=x-f.trackX,dy=y-f.scroll,dz=z-f.height;
  const side=dx*Math.cos(f.bank)+dz*Math.sin(f.bank),depth=-dx*Math.sin(f.bank)+dz*Math.cos(f.bank);
  return {x:side,y:dy*Math.cos(f.pitch)+depth*Math.sin(f.pitch),z:-dy*Math.sin(f.pitch)+depth*Math.cos(f.pitch)};
}

// The same rigid pose drives the rig, projectile origins, marker and weapon aim.
export function calderaLocal(x:number,y:number,z:number,collapse:number) {
  const a=-.14*collapse,c=Math.cos(a),s=Math.sin(a);
  return {x:x*c-y*s,y:x*s+y*c-.45*collapse,z};
}
export function calderaPoint(x:number,y:number,z:number,collapse:number) {
  const p=calderaLocal(x,y,z,collapse);
  return ioWorld(IO_BOSS_Y-p.z,IO_BOSS_Z+p.y,IO_DURATION+IO_APPROACH,1,p.x);
}
export function calderaContact(collapse:number,broken:boolean) {
  return calderaPoint(broken?0:-2.4,-.4,broken?1.32:1.25,collapse);
}
export function calderaWheel(time:number,collapse:number) {
  const a=time*.55+collapse*.7;
  return calderaPoint(Math.cos(a)*2.15*IO_WHEEL_SCALE,IO_WHEEL_Y+Math.sin(a)*2.15*IO_WHEEL_SCALE,.5+.45*IO_WHEEL_SCALE,collapse);
}

// Authored macro terrain; continuous sampling makes chunk seams impossible.
export function ioNoise(x:number,y:number){
  const ix=Math.floor(x),iy=Math.floor(y),u=smooth01(x-ix),v=smooth01(y-iy);
  const at=(a:number,b:number)=>{let h=Math.imul(a,374761393)+Math.imul(b,668265263);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;};
  return (at(ix,iy)*(1-u)+at(ix+1,iy)*u)*(1-v)+(at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u)*v;
}
export function ioChannel(y:number){
  const rim=1-smooth01((y-145)/22);
  return(2.15*Math.sin(y*.16)+.7*Math.sin(y*.31+.4))*rim;
}
export function ioBreach(y:number,x:number){return y-IO_BREACH_Y-x*.48-Math.sin(x*.8)*.45;}
export function ioGroundHeight(x:number,y:number) {
  const lake=Math.hypot(x/17,(y-IO_CALDERA_Y)/19),edge=Math.abs(x-ioChannel(y))+(ioNoise(x*.45+20,y*.9)-.5)*.48+(ioNoise(x*.9,y*2.1)-.5)*.16;
  const bank=smooth01((edge-1.85)/.42),detail=(ioNoise(x*.8,y*.8)-.5)*.32+(ioNoise(x*2.3,y*2.3)-.5)*.13;
  // Successive ledges expose rock strata instead of two uniformly smooth banks.
  const terraces=bank*(1.1+smooth01((edge-3.5)/.35)*.85+smooth01((edge-5.5)/.5)*.65);
  const quarry=Math.exp(-((x-ioChannel(y)-5.2)**2/6+(y-53)**2/100))*3.4;
  const low=-3+detail+Math.sin(y*.27-x*.13)*.13+terraces*(.7+ioNoise(x*.35,y*.23)*.4)-quarry;
  const lip=Math.exp(-(((lake-1)/.16)**2))*2.0,basin=1-smooth01((lake-.68)/.23);
  const breach=(1-smooth01((Math.abs(ioBreach(y,x))-1.1)/1.8))*5.6;
  const apron=1-smooth01((Math.hypot(x/4.5,(y-IO_APRON_Y)/7)-.65)/.25);
  return low+lip-Math.max(basin,apron)*5-breach;
}
export const ioSections=[
  {end:20,name:'SULFUR OUTSKIRTS'}, {end:40,name:'EXTRACTION TERRACES'},
  {end:60,name:'PROCESSING YARDS'}, {end:78,name:'REFINERY'},
  {end:90,name:'MOLTEN BREACH'}, {end:100,name:'CALDERA RIM'},
] as const;
export function ioSection(time:number){return(ioSections.find(s=>time<s.end)??ioSections[ioSections.length-1]).name;}

export function skipperMotion(age:number,lane:number,slot=0) {
  const t=Math.max(0,age-slot*.14),sweep=Math.sin(t*1.5+slot*.7);
  const x=lane+sweep*.60,y=9.3-t*2.7-Math.max(0,t-1.2)**2*.38;
  const vx=Math.cos(t*1.5+slot*.7)*.9,vy=-2.7-Math.max(0,t-1.2)*.76;
  return {x,y,heading:Math.atan2(vx,vy),bank:-vx*.18,jet:smooth01((t%1.7-.95)/.22)*(1-smooth01((t%1.7-1.3)/.2))};
}
// Authored waves span all ten screens, leaving a quiet rim reveal before ascent.
const patrols = [
  [.7,[-2.3,0,2.3]], [5,[-1.8,.7,2.3]], [10.5,[-2.6,-.9,.9,2.6]], [16,[-2,0,2]],
  [22,[-2.7,-1.35,0,1.35,2.7]], [27,[-2.1,-.3,1.7]], [32,[-1.4,.2,2.3]], [37,[-2.6,-.8,.8,2.6]],
  [43,[-2.4,-.6,1.2]], [48,[-1.2,.5,2.3]], [53,[-2.6,-1,1,2.6]], [58,[-2,0,2]],
  [64,[-2.6,-.9,.9,2.6]], [69,[-2.1,0,2.1]], [74,[-2.6,-1.3,0,1.3,2.6]],
  [80,[-2.4,-.7,1.1]], [85,[-1.2,.6,2.3]], [91,[-2.3,0,2.3]],
] as const;
const drops=['homing','cannon','laser','omega'] as const;
type IoWave={time:number;lanes:number[];drop?:typeof drops[number];skipper?:boolean;crucible?:boolean};
const skippers:IoWave[]=patrols.map(([time,lanes],i)=>({time,lanes:[...lanes],drop:wingRewardForWave(drops,i),skipper:true}));
const crucibles:IoWave[]=[
  {time:12.8,lanes:[1],crucible:true,drop:'cannon'},
  {time:34.5,lanes:[-1],crucible:true},
  {time:55.5,lanes:[1],crucible:true,drop:'omega'},
  {time:76.5,lanes:[-1],crucible:true},
  {time:87.7,lanes:[1],crucible:true},
];
export const ioWaves=[...skippers,...crucibles].sort((a,b)=>a.time-b.time);
