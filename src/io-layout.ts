export const IO_DURATION = 20;
export const IO_APPROACH = 8;
export const IO_SPEED = 1.6;
export const IO_PITCH = 55 * Math.PI / 180;
export const IO_HEIGHT = 8;
export const IO_HP = 72;
export const IO_LEG_HP = 20;
export const IO_INTERVAL = 3.8;
export const IO_WINDUP = .65;
export const IO_FIRE = 1.65;
export const IO_TRAVEL = 1.05;
export const IO_SKIPPER_POOL = 12;
export const IO_FOOT_DROP = 6.85;
export const IO_FINAL_SCROLL = IO_SPEED * (IO_DURATION + IO_APPROACH / 2);
export const IO_BOSS_Y = IO_FINAL_SCROLL + 4.8 * Math.cos(IO_PITCH) + 12 * Math.sin(IO_PITCH);
export const IO_BOSS_Z = IO_HEIGHT + 4.8 * Math.sin(IO_PITCH) - 12 * Math.cos(IO_PITCH);
export const smooth01 = (t: number) => { const p=Math.max(0,Math.min(1,t)); return p*p*(3-2*p); };

export function ioScroll(time: number) {
  const stage = Math.max(0,Math.min(IO_DURATION,time)), t=Math.max(0,Math.min(IO_APPROACH,time-IO_DURATION));
  return IO_SPEED * (stage + t - t*t/(2*IO_APPROACH));
}
export function ioFrame(time: number, rise: number) {
  return { pitch: IO_PITCH * rise, height: IO_HEIGHT, scroll: ioScroll(time) };
}
export function ioWorld(y: number, z: number, time: number, rise: number) {
  const f=ioFrame(time,rise),dy=y-f.scroll,dz=z-f.height;
  return {y:dy*Math.cos(f.pitch)+dz*Math.sin(f.pitch),z:-dy*Math.sin(f.pitch)+dz*Math.cos(f.pitch)};
}

// The same rigid pose drives the rig, projectile origins, marker and weapon aim.
export function calderaLocal(x:number,y:number,z:number,collapse:number) {
  const a=-.14*collapse,c=Math.cos(a),s=Math.sin(a);
  return {x:x*c-y*s,y:x*s+y*c-.45*collapse,z};
}
export function calderaPoint(x:number,y:number,z:number,collapse:number) {
  const p=calderaLocal(x,y,z,collapse);
  const q=ioWorld(IO_BOSS_Y-p.z,IO_BOSS_Z+p.y,IO_DURATION+IO_APPROACH,1);
  return {x:p.x,...q};
}
export function calderaContact(collapse:number,broken:boolean) {
  return calderaPoint(broken?0:-2.4,-.4,broken?1.32:1.25,collapse);
}
export function calderaWheel(time:number,collapse:number) {
  const a=time*.55+collapse*.7;
  return calderaPoint(Math.cos(a)*2.15,2.5+Math.sin(a)*2.15,.95,collapse);
}

// Authored macro terrain; continuous sampling makes chunk seams impossible.
export function ioGroundHeight(x:number,y:number) {
  const lake=Math.hypot(x/17,(y-56)/19);
  const low=-3+Math.sin(x*.33+y*.08)*.35+Math.sin(y*.27-x*.13)*.22;
  const lip=Math.exp(-(((lake-1)/.16)**2))*2.0;
  const basin=1-smooth01((lake-.68)/.23);
  const causeway=(1-smooth01((Math.abs(x)-2.3)/.8))*(1-smooth01((y-39)/3));
  return Math.max(low + lip - basin*5, -3*causeway-9*(1-causeway));
}

export function skipperMotion(age:number,lane:number,slot=0) {
  const t=Math.max(0,age-slot*.14),sweep=Math.sin(t*1.5+slot*.7);
  const x=lane+sweep*.60,y=9.3-t*2.7-Math.max(0,t-1.2)**2*.38;
  const vx=Math.cos(t*1.5+slot*.7)*.9,vy=-2.7-Math.max(0,t-1.2)*.76;
  return {x,y,heading:Math.atan2(vx,vy),bank:-vx*.18,jet:smooth01((t%1.7-.95)/.22)*(1-smooth01((t%1.7-1.3)/.2))};
}
export const ioWaves = [
  {time:.7,lanes:[-2.3,0,2.3],carrier:1,drop:'homing' as const,skipper:true},
  {time:3.7,lanes:[-1.8,.7,2.3],carrier:0,drop:'cannon' as const,skipper:true},
  {time:6.8,lanes:[-2.6,-.9,.9,2.6],carrier:2,drop:'laser' as const,skipper:true},
  {time:10,lanes:[-2.0,0,2.0],carrier:1,drop:'omega' as const,skipper:true},
  {time:13.2,lanes:[-2.7,-1.35,0,1.35,2.7],carrier:2,drop:'homing' as const,skipper:true},
];
