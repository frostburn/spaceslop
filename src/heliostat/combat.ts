import { levels } from '../levels';

// Pure simulation data: the menu never imports models, media or Three.js.
export const HELIOSTAT_DURATION = levels.heliostat.duration, HELIOSTAT_APPROACH = 8, HELIOSTAT_HP = 120;
export const HELIOSTAT_SPEED = 2.8, HELIOSTAT_PITCH = 1.30, HELIOSTAT_DISTANCE = 36;
export const HELIOSTAT_INTERVAL = 4.4, HELIOSTAT_WINDUP = .65, HELIOSTAT_FIRE = 1.9;
export const HELIOSTAT_CHANNEL = 1.35, HELIOSTAT_GROW = .25, HELIOSTAT_FADE = .35, HELIOSTAT_EMITTER_X = 3.5;
export const HELIOSTAT_GUARD_FIRE = 6.4, HELIOSTAT_GUARD_CHARGE = .9;
export const HELIOSTAT_SPAWN_LEAD = 3, HELIOSTAT_DRONE_POOL = 14, HELIOSTAT_GUARD_POOL = 4;
export type HeliostatCourse = { kind: 'drone' | 'guard'; formation: 'vee' | 'weave' | 'line' | 'cross'; slot: number; mirror: number };
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };

export function heliostatScroll(time: number) {
  const t = Math.max(0, Math.min(HELIOSTAT_DURATION+HELIOSTAT_APPROACH, time)), u = clamp((t - HELIOSTAT_DURATION) / HELIOSTAT_APPROACH);
  return HELIOSTAT_SPEED * (Math.min(t, HELIOSTAT_DURATION) + HELIOSTAT_APPROACH * (u - u*u + u*u*u/3));
}
export const HELIOSTAT_END = heliostatScroll(HELIOSTAT_DURATION+HELIOSTAT_APPROACH);
export function heliostatFrame(reveal: number) { return { pitch: HELIOSTAT_PITCH * reveal, viewPitch: .46 * (1 - reveal), bank: 0 }; }
export function heliostatBossPoint(time: number, reveal: number) {
  const pitch = HELIOSTAT_PITCH * reveal;
  const y = HELIOSTAT_END + 4.2 * Math.cos(HELIOSTAT_PITCH) + 12 * Math.sin(HELIOSTAT_PITCH) - heliostatScroll(time);
  const z = 4.2 * Math.sin(HELIOSTAT_PITCH) - 12 * Math.cos(HELIOSTAT_PITCH);
  return { x: 0, y: y * Math.cos(pitch) + z * Math.sin(pitch), z: -y * Math.sin(pitch) + z * Math.cos(pitch) };
}
function coursePoint(age: number, lane: number, c: HeliostatCourse) {
  if (c.kind === 'guard') return { x: lane + .24 * Math.sin(age * .9 + c.slot), y: 10 - 1.35*age + 2.6*smooth((age - 1)/2) };
  const t = age - (c.formation === 'line' ? c.slot * .52 : 0);
  if (c.formation === 'cross') return { x: lane * Math.cos(Math.PI * smooth((t - .5)/3.4)), y: 10 + c.slot*.5 - 2.8*t };
  if (c.formation === 'line') return { x: c.mirror * 2.15 * Math.sin(t * 1.05), y: 10 - 3*t };
  return { x: lane + c.mirror*(c.formation === 'weave' ? .8 : .2)*Math.sin(t*1.3), y: 10 + Math.abs(lane)*.3 - 2.7*t };
}
export function heliostatMotion(age: number, lane: number, c: HeliostatCourse) {
  const p = coursePoint(age,lane,c), a = coursePoint(age-.002,lane,c), b = coursePoint(age+.002,lane,c);
  return { ...p, heading: Math.atan2(b.x-a.x, a.y-b.y), bank: Math.max(-.3, Math.min(.3,(b.x-a.x)*25)) };
}
export function heliostatCanAttack(age:number,lane:number,c:HeliostatCourse) {
  const p=heliostatMotion(age,lane,c);
  return c.kind!=='guard'||(p.y<=5.2&&p.y>=-5.2);
}
const weapons = ['homing','cannon','laser','omega'] as const;
export const heliostatWaves = Array.from({length:20},(_,i) => {
  const guard = i === 1 || i === 9 || i === 17, formation = (i%4 === 1 ? 'cross' : i%4 === 2 ? 'line' : i%4 === 3 ? 'weave' : 'vee') as HeliostatCourse['formation'];
  return { time: 2 + i*4.8-(i===19?2:0), lanes: guard ? [-2.15,2.15] : formation === 'line' ? [0,0,0,0] : [-2,0,2],
    carrier: guard ? 0 : 1, drop: weapons[i%4], heliostat: {kind: guard ? 'guard' as const : 'drone' as const, formation, mirror: i%2 ? 1 : -1} };
});

// Fixed capacitor gates sit in the same world frame as the station. Their gap is
// always safe. Warning, discharge and cooldown use simulation time, never timers.
export const electricSites = [18,34,50,65,80,94].map((at,i) => ({at, gap: [-1.85,1.7,0][i%3]}));
export const ELECTRIC_GAP = 2.3, ELECTRIC_WARNING = 1.35;
export function electricPose(site: number, time: number) {
  const s = electricSites[site], age = time-s.at+2.8;
  const hot = age >= ELECTRIC_WARNING;
  return { y: s.at*HELIOSTAT_SPEED-heliostatScroll(time), gap: s.gap, hot,
    warning: age >= 0 && age < ELECTRIC_WARNING, charge: clamp(age/ELECTRIC_WARNING), visible: s.at*HELIOSTAT_SPEED-heliostatScroll(time)>-65 && s.at*HELIOSTAT_SPEED-heliostatScroll(time)<85 };
}
export function electricHits(site: number, time: number, previous: number, point: {x:number;y:number}) {
  const p=electricPose(site,time), a=electricPose(site,previous);
  return p.hot && Math.abs(point.x-p.gap) > ELECTRIC_GAP/2-.22 && point.y >= Math.min(p.y,a.y)-.28 && point.y <= Math.max(p.y,a.y)+.28;
}
export function heliostatPlasmaPhase(time:number) {
  const t=Math.max(0,time)%HELIOSTAT_INTERVAL,age=t-HELIOSTAT_FIRE;
  return {growth:smooth(age/HELIOSTAT_GROW),strength:smooth(age/HELIOSTAT_GROW)*(1-smooth((age-HELIOSTAT_CHANNEL)/HELIOSTAT_FADE)),
    hot:age>=HELIOSTAT_GROW&&age<HELIOSTAT_CHANNEL};
}
export type PlasmaPoint={x:number;y:number;z:number};
export function heliostatPlasmaControls(side:number,target:{x:number;y:number}):PlasmaPoint[] {
  return [{x:side*HELIOSTAT_EMITTER_X,y:4.2,z:-11.2},{x:side*4.5,y:1.8,z:-8.6},
    {x:target.x+side*.6,y:target.y+1.9,z:-3.5},{...target,z:0}];
}
/** Curve and collision meet exactly at z=0; the tail continues toward camera. */
export function heliostatPlasmaPoint(u:number,points:readonly PlasmaPoint[]) {
  const t=Math.min(1,Math.max(0,u/.84)),s=1-t,[a,b,c,d]=points;
  const p={x:s*s*s*a.x+3*s*s*t*b.x+3*s*t*t*c.x+t*t*t*d.x,
    y:s*s*s*a.y+3*s*s*t*b.y+3*s*t*t*c.y+t*t*t*d.y,z:s*s*s*a.z+3*s*s*t*b.z+3*s*t*t*c.z+t*t*t*d.z};
  if(u>.84){const x=d.x-c.x,y=d.y-c.y,z=d.z-c.z,length=Math.hypot(x,y,z),distance=(u-.84)/.16*3;p.x+=x/length*distance;p.y+=y/length*distance;p.z+=z/length*distance;}
  return p;
}
export function heliostatPlasmaHits(time:number,targets:readonly {x:number;y:number}[],point:{x:number;y:number}) {
  return heliostatPlasmaPhase(time).hot&&targets.some(t=>Math.hypot(point.x-t.x,point.y-t.y)<.44);
}
export function heliostatSunspot(side:number) {
  return {x:side*4.65*.78,y:-4.65*.044,z:4.65*Math.sqrt(1-.78*.78-.044*.044)};
}
export function heliostatFeedPoint(side:number) {
  const p=heliostatSunspot(side),boss=heliostatBossPoint(0,0);
  return {x:p.x,y:HELIOSTAT_END+62-boss.y-p.z,z:8-boss.z+p.y};
}
