import { levels } from '../levels';

// Pure simulation data: the menu never imports models, media or Three.js.
export const HELIOSTAT_DURATION = levels.heliostat.duration, HELIOSTAT_APPROACH = 8, HELIOSTAT_HP = 120;
export const HELIOSTAT_SPEED = 2.8, HELIOSTAT_PITCH = 1.30, HELIOSTAT_DISTANCE = 36;
export const HELIOSTAT_INTERVAL = 4.4, HELIOSTAT_WINDUP = .65, HELIOSTAT_FIRE = 1.9;
export const HELIOSTAT_TRAVEL = 1.15, HELIOSTAT_PULSES = 6, HELIOSTAT_PULSE_STEP = .14;
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
const weapons = ['homing','cannon','laser','omega'] as const;
export const heliostatWaves = Array.from({length:20},(_,i) => {
  const guard = i === 1 || i === 9 || i === 18, formation = (i%4 === 1 ? 'cross' : i%4 === 2 ? 'line' : i%4 === 3 ? 'weave' : 'vee') as HeliostatCourse['formation'];
  return { time: 2 + i*4.8, lanes: guard ? [-2.15,2.15] : formation === 'line' ? [0,0,0,0] : [-2,0,2],
    carrier: guard ? 0 : 1, drop: weapons[i%4], heliostat: {kind: guard ? 'guard' as const : 'drone' as const, formation, mirror: i%2 ? 1 : -1} };
});

// Fixed capacitor gates sit in the same world frame as the station. Their gap is
// always safe. Warning, discharge and cooldown use simulation time, never timers.
export const electricSites = [18,34,50,65,80,94].map((at,i) => ({at, gap: [-1.85,1.7,0][i%3]}));
export const ELECTRIC_GAP = 2.3, ELECTRIC_WARNING = 1.35, ELECTRIC_HOT = .85;
export function electricPose(site: number, time: number) {
  const s = electricSites[site], age = time-s.at+2.8;
  const hot = age >= ELECTRIC_WARNING && age < ELECTRIC_WARNING+ELECTRIC_HOT;
  return { y: s.at*HELIOSTAT_SPEED-heliostatScroll(time), gap: s.gap, hot,
    warning: age >= 0 && age < ELECTRIC_WARNING, charge: clamp(age/ELECTRIC_WARNING), visible: age >= -.6 && age < 5.8 };
}
export function electricHits(site: number, time: number, previous: number, point: {x:number;y:number}) {
  const p=electricPose(site,time), a=electricPose(site,previous);
  return p.hot && Math.abs(point.x-p.gap) > ELECTRIC_GAP/2-.22 && point.y >= Math.min(p.y,a.y)-.28 && point.y <= Math.max(p.y,a.y)+.28;
}
/** Every emitted packet crossed by a step, including a dropped render frame. */
export function heliostatPackets(previous: number, time: number) {
  const packets: {cycle:number;pulse:number}[] = [];
  for (let cycle=Math.max(0,Math.floor(previous/HELIOSTAT_INTERVAL)); cycle<=Math.floor(time/HELIOSTAT_INTERVAL);cycle++)
    for(let pulse=0;pulse<HELIOSTAT_PULSES;pulse++) {
      const at=cycle*HELIOSTAT_INTERVAL+HELIOSTAT_FIRE+pulse*HELIOSTAT_PULSE_STEP;
      if(at>previous && at<=time) packets.push({cycle,pulse});
    }
  return packets;
}
