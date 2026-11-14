import { wingRewardForWave } from './wing';
// Stable simulation coordinates; the scenery and camera do the head-on swing.
export const BOULEVARD_DURATION=100, BOULEVARD_SPEED=1.7, BOULEVARD_APPROACH=7;
export const BOULEVARD_HP=120, BOULEVARD_INTERVAL=3.4, BOULEVARD_WINDUP=.55, BOULEVARD_FIRE=1.55, BOULEVARD_TRAVEL=.85;
export const BOULEVARD_PITCH=Math.PI*.415, BOULEVARD_VIEW=.40, BOULEVARD_DECK=-3.1, BOULEVARD_RISE=6, BOULEVARD_POOL=16;
export const BOULEVARD_SPAWN_LEAD=4;
export function turnBoulevardTurret(angle:number,target:number,dt:number){const delta=Math.atan2(Math.sin(target-angle),Math.cos(target-angle)),step=6*Math.max(0,dt);return angle+Math.max(-step,Math.min(step,delta));}
export type BoulevardCourse={formation:'chevron'|'cross'|'train'|'rush'|'intercept';slot:number;mirror:number;heavy?:boolean};
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
 const t=age-(c.formation==='train'?c.slot*.65:c.formation==='intercept'?c.slot*.6:0),speed=c.heavy?1.7:2.65;
 if(c.formation==='intercept')return{x:lane*(1-2*smooth((t-1.2)/1.8)+2*smooth((t-4.8)/1.8)),y:10-2.65*t+1.5*smooth((t-.6)/2)};
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
export const boulevardWaves=Array.from({length:20},(_,i)=>{
  const heavy = i % 5 === 4;
  const formation = i % 5 === 3 ? 'intercept' : heavy ? 'rush' : i % 4 === 1 ? 'cross' : i % 4 === 2 ? 'train' : 'chevron';
  const lanes = i === 14 ? [-1.2, 1.2] : heavy ? [0]
    : i === 11 || i === 16 ? [-2.45, -.82, .82, 2.45]
    : formation === 'intercept' ? [-1.9, 1.9] : formation === 'cross' ? [-2, 2] : formation === 'train' ? [0, 0, 0, 0] : [-2.1, 0, 2.1];
  return { time: 1.5 + i * 4.8, lanes, drop: wingRewardForWave(drops, i),
    boulevard: { formation, mirror: i % 2 ? 1 : -1, heavy } as Omit<BoulevardCourse, 'slot'> };
});

// Small, deterministic trim corrections stay inside the fixed combat proxy.
export function boulevardHover(time:number){return{x:.06*Math.sin(time*.73)+.02*Math.sin(time*1.19),y:.045*Math.sin(time*.47),z:.075*Math.sin(time*.91),pitch:.012*Math.sin(time*.61),roll:.014*Math.sin(time*.83),yaw:.010*Math.sin(time*.39)};}

export const CRUISER_CANNON_X = 2.4, CRUISER_CANNON_Y = -1.15, CRUISER_CANNON_Z = -.19;
export const CRUISER_ROTOR_Y = -.7, CRUISER_MUZZLE_Y = -.45, CRUISER_RECOIL = .22;

export function boulevardCruiserMuzzle(time: number, side: number, recoil: number) {
  const hull = boulevardBossPoint(time, 1);
  const hover = boulevardHover(time);
  const x = side * CRUISER_CANNON_X, y = CRUISER_CANNON_Y + CRUISER_ROTOR_Y + CRUISER_MUZZLE_Y + recoil * CRUISER_RECOIL;
  const yawX = x * Math.cos(hover.yaw) - y * Math.sin(hover.yaw);
  const yawY = x * Math.sin(hover.yaw) + y * Math.cos(hover.yaw);
  const rollX = yawX * Math.cos(hover.roll) + CRUISER_CANNON_Z * Math.sin(hover.roll);
  const rollZ = CRUISER_CANNON_Z * Math.cos(hover.roll) - yawX * Math.sin(hover.roll);
  const pitch = hover.pitch - BOULEVARD_PITCH;
  const c = Math.cos(BOULEVARD_PITCH), s = Math.sin(BOULEVARD_PITCH);
  return {
    x: hull.x + hover.x + rollX,
    y: hull.y + hover.y * c + hover.z * s + yawY * Math.cos(pitch) - rollZ * Math.sin(pitch),
    z: hull.z - hover.y * s + hover.z * c + yawY * Math.sin(pitch) + rollZ * Math.cos(pitch),
  };
}
