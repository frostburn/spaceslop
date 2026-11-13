// Pure timing/ordnance shared by flight simulation and the rotating emitter rig.
export const VORTEX_HP=15,VORTEX_RADIUS=.8,VORTEX_POOL=2;
export const VORTEX_ENTRY=2.2,VORTEX_FIRE=3,VORTEX_INTERVAL=.105,VORTEX_PULSES=20,VORTEX_CYCLE=3.9;
export const vortexWaveIndices=[4,10,16,20] as const;
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
export function vortexAngle(age:number,mirror:number){return mirror*(.35+age*2.8);}
export function vortexPhase(age:number){
  const cycle=Math.max(0,Math.floor((age-VORTEX_FIRE+.8)/VORTEX_CYCLE)),t=age-VORTEX_FIRE-cycle*VORTEX_CYCLE;
  return{charge:cycle<2&&t<0?clamp((t+.8)/.8):0,firing:cycle<2&&t>=0&&t<=(VORTEX_PULSES-1)*VORTEX_INTERVAL+.08};
}
export function vortexMotion(age:number,lane:number){
  const t=clamp(age/VORTEX_ENTRY),ease=t*t*(3-2*t),hover=clamp((age-VORTEX_ENTRY)/.8),exit=Math.max(0,age-9.4);
  return{x:lane+.23*Math.sin(Math.max(0,age-VORTEX_ENTRY)*.8)*hover,
    y:age<0?12.4-age*2.5:12.4-7.9*ease+.14*Math.sin(Math.max(0,age-VORTEX_ENTRY)*1.1)*hover-2.8*(exit-.7*(1-Math.exp(-exit/.7))),heading:0,bank:0};
}
export function vortexEmission(at:number,x:number,y:number,mirror:number){
  const cycle=at<VORTEX_FIRE+VORTEX_CYCLE-.01?0:1;
  const pulse=Math.round((at-VORTEX_FIRE-cycle*VORTEX_CYCLE)/VORTEX_INTERVAL);
  const angle=vortexAngle(at,mirror),shots=[0,Math.PI].map(offset=>{
    const a=angle+offset,dx=Math.cos(a),dy=Math.sin(a);
    return{x:x+dx*.71,y:y+dy*.71,z:0,vx:dx*2.8,vy:dy*2.8,vz:0};
  });
  const next=pulse+1<VORTEX_PULSES?VORTEX_FIRE+cycle*VORTEX_CYCLE+(pulse+1)*VORTEX_INTERVAL:cycle===0?VORTEX_FIRE+VORTEX_CYCLE:Infinity;
  return{shots,next};
}
