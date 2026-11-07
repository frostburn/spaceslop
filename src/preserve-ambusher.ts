import { PRESERVE_SPEED, PRESERVE_WIDTH_SCALE, PRESERVE_DISTANCE, PRESERVE_PITCH, preserveGround, preservePools, preserveScroll, preserveWater } from './preserve-layout';

export const AMBUSHER_HP = 6, AMBUSHER_POOL = 2, AMBUSHER_SPAWN_LEAD = 12;
export const AMBUSHER_WINDUP = 1.1, AMBUSHER_LEAP = .62, AMBUSHER_BITE = .18, AMBUSHER_RETREAT = 1.05;
export const AMBUSHER_DURATION = AMBUSHER_WINDUP + AMBUSHER_LEAP + AMBUSHER_BITE + AMBUSHER_RETREAT;
export type AmbusherPoint = {x:number;y:number;z:number};
type Point = {x:number;y:number};
const clamp = (n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth = (n:number)=>{const t=clamp(n);return t*t*(3-2*t);};
const mix = (a:number,b:number,t:number)=>a+(b-a)*t;
const wrap = (a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
export const ambusherSites = [
  {y:29,side:1,pool:0,drop:'cannon'}, {y:57,side:-1,drop:'laser'},
  {y:68,side:1,drop:'homing'}, {y:84,side:-1,drop:'omega'}, {y:119,side:-1,pool:1,drop:'laser'},
].map(site=>{
  const pool=site.pool===undefined?undefined:preservePools[site.pool],water=preserveWater(site.y);
  const x=pool?pool.x+site.side*(pool.rx+.24):water.x+site.side*(water.width+.45);
  return {...site,x,z:preserveGround(x,site.y),waterZ:pool?.z??water.z,waterX:pool?.x??water.x};
});
export type AmbusherState = {site:number;heading:number;fromHeading:number;attackHeading:number;attackAt:number;readyAt:number;aim:Point};
export function ambusherHome(site:number,time:number) {
  const s=ambusherSites[site];return{x:s.x*PRESERVE_WIDTH_SCALE,y:s.y-preserveScroll(time),z:s.z};
}
export function createAmbusherState(site:number):AmbusherState {
  const heading=-ambusherSites[site].side*.28;
  return{site,heading,fromHeading:heading,attackHeading:heading,attackAt:-100,readyAt:0,aim:{x:0,y:-5.3}};
}
export function stepAmbusher(state:AmbusherState,time:number,player:Point,dt:number) {
  const home=ambusherHome(state.site,time),age=time-state.attackAt;
  if(age<AMBUSHER_DURATION)return;
  const desired=Math.atan2(player.x-home.x,home.y-player.y);
  state.heading+=clamp(wrap(desired-state.heading),-1.8*dt,1.8*dt);
  if(time<state.readyAt||home.y>4.8||home.y<-3.2||Math.hypot(player.x-home.x,player.y-home.y)>7.7)return;
  state.aim={x:clamp(player.x,-3.5,3.5),y:clamp(player.y,-6.8,5.5)};
  state.fromHeading=state.heading;state.attackHeading=desired;state.attackAt=time;
  state.heading=desired;
  state.readyAt=time+AMBUSHER_DURATION+1.8;
}
export function ambusherPose(state:AmbusherState,time:number) {
  const home=ambusherHome(state.site,time),age=time-state.attackAt;
  let phase:'lurking'|'warning'|'leap'|'bite'|'retreat'='lurking',out=0,raised=0,jaw=.035;
  if(age>=0&&age<AMBUSHER_DURATION){
    if(age<AMBUSHER_WINDUP){phase='warning';raised=smooth(age/AMBUSHER_WINDUP);jaw=.035+raised*.65;}
    else if(age<AMBUSHER_WINDUP+AMBUSHER_LEAP){phase='leap';out=smooth((age-AMBUSHER_WINDUP)/AMBUSHER_LEAP);raised=1-out;jaw=.68;}
    else if(age<AMBUSHER_WINDUP+AMBUSHER_LEAP+AMBUSHER_BITE){phase='bite';out=1;jaw=mix(.68,.08,smooth((age-AMBUSHER_WINDUP-AMBUSHER_LEAP)/AMBUSHER_BITE));}
    else{phase='retreat';out=1-smooth((age-AMBUSHER_WINDUP-AMBUSHER_LEAP-AMBUSHER_BITE)/AMBUSHER_RETREAT);jaw=.08+out*.15;}
  }
  const heading=phase==='lurking'?state.heading:state.fromHeading+wrap(state.attackHeading-state.fromHeading)*(phase==='warning'?raised:1);
  const dx=Math.sin(heading),dy=-Math.cos(heading),pitch=-.1-.24*raised+.2*out;
  const noseReach=1.1+1.42*Math.cos(.1),peakZ=-.9+1.42*Math.sin(.1);
  const root={x:mix(home.x,state.aim.x-dx*noseReach,out),y:mix(home.y,state.aim.y-dy*noseReach,out),
    z:mix(Math.min(home.z+2.1,-1.8)-.15*raised,peakZ,out)+.20*Math.sin(out*Math.PI)};
  const localHead={x:0,y:-1.1,z:.9+1.1*raised};
  const toWorld=(p:AmbusherPoint):AmbusherPoint=>({x:root.x+p.x*Math.cos(heading)-p.y*Math.sin(heading),y:root.y+p.x*Math.sin(heading)+p.y*Math.cos(heading),z:root.z+p.z});
  const head=toWorld(localHead),mouth=toWorld({x:0,y:localHead.y-1.42*Math.cos(pitch),z:localHead.z-1.42*Math.sin(pitch)});
  const headPoint=(y:number,z=0)=>toWorld({x:0,y:localHead.y+y*Math.cos(pitch)-z*Math.sin(pitch),z:localHead.z+y*Math.sin(pitch)+z*Math.cos(pitch)});
  const hulls=[{...head,radius:.41},{...headPoint(-.55),radius:.29},{...headPoint(-1.05),radius:.23},{...mouth,radius:.20},
    {...toWorld({x:0,y:-.65,z:.55}),radius:.40},{...toWorld({x:0,y:-.9,z:mix(.55,localHead.z,.55)}),radius:.36}];
  return{phase,age,root,home,water:{x:ambusherSites[state.site].waterX*PRESERVE_WIDTH_SCALE,y:home.y,z:ambusherSites[state.site].waterZ},head,mouth,localHead,heading,pitch,jaw,out,raised,hulls,
    footZ:mix(home.z-root.z,-.4,out),active:phase==='leap'||phase==='bite',warning:phase==='warning',aim:state.aim};
}
export type AmbusherPose=ReturnType<typeof ambusherPose>;
// Only anatomical volumes reaching the flight surface can be shot or rammed.
// A submerged silhouette does not turn into an invisible floating hitbox.
export function ambusherHulls(state:AmbusherState,time:number,padding=0) {
  return ambusherPose(state,time).hulls.flatMap(p=>{const r=p.radius+padding,d=r*r-p.z*p.z;return d>0?[{x:p.x,y:p.y,radius:Math.sqrt(d)}]:[];});
}
export function ambusherBodyHit(state:AmbusherState,time:number,a:Point,b:Point,padding=0) {
  const dx=b.x-a.x,dy=b.y-a.y,length=dx*dx+dy*dy;
  return ambusherHulls(state,time,padding).some(p=>{const t=length?clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/length):0;return(p.x-a.x-dx*t)**2+(p.y-a.y-dy*t)**2<=p.radius*p.radius;});
}
export function ambusherBeamEntry(state:AmbusherState,time:number,origin:Point) {
  let nearest=Infinity;
  for(const p of ambusherHulls(state,time)){const q=p.radius*p.radius-(origin.x-p.x)**2;if(q<0)continue;const r=Math.sqrt(q);if(p.y+r<origin.y||p.y-r>9)continue;nearest=Math.min(nearest,Math.max(origin.y,p.y-r));}
  return nearest;
}
export function ambusherHits(state:AmbusherState,time:number,previous:number,player:Point) {
  const now=ambusherPose(state,time),before=ambusherPose(state,previous);if(!now.active)return false;
  const p={...player,z:0};
  return now.hulls.some((a,i)=>{const b=before.hulls[i],dx=a.x-b.x,dy=a.y-b.y,dz=a.z-b.z,length=dx*dx+dy*dy+dz*dz;
    const t=length?clamp(((p.x-b.x)*dx+(p.y-b.y)*dy+(p.z-b.z)*dz)/length):0;
    return(p.x-b.x-dx*t)**2+(p.y-b.y-dy*t)**2+(p.z-b.z-dz*t)**2<(a.radius+.22)**2;});
}
// Helps foliage leave a readable launch/landing pocket at each bank.
export function ambusherClearing(x:number,y:number,radius=1.35) {
  return ambusherSites.some(site=>Math.hypot((x-site.x)*1.1,y-site.y)<radius);
}
// Hold the workshop bank still while scrubbing the same attack and bank height.
export function ambusherStudy(time:number) {
  const state=createAmbusherState(0),worldTime=ambusherSites[0].y/PRESERVE_SPEED;
  state.attackAt=worldTime+1-time;state.aim={x:-1.2,y:-4.2};state.attackHeading=Math.atan2(state.aim.x-ambusherHome(0,worldTime).x,-state.aim.y);
  state.heading=state.fromHeading=state.attackHeading;
  return ambusherPose(state,worldTime);
}
// Keep hit feedback on the rendered face in the tilted stage camera.
export function ambusherProjection(p:AmbusherPoint) {
  const d=PRESERVE_DISTANCE*Math.cos(PRESERVE_PITCH),s=1/(1-p.z/d);
  return{x:p.x*s,y:(p.y+Math.tan(PRESERVE_PITCH)*p.z)*s,z:0};
}
export function ambusherFeedback(state:AmbusherState,time:number) {
  return ambusherProjection(ambusherPose(state,time).head);
}
