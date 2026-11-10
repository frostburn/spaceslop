export const RAY_HP=90,RAY_SIZE=8.6,RAY_CYCLE=6,RAY_FAN_AT=1.8,RAY_SEEKER_AT=4.15;
export const RAY_PROJECTION=22/34,RAY_ORGAN_RADIUS=.58,RAY_SEEKER_RADIUS=.34,RAY_SEEKER_HP=3,RAY_SEEKER_POOL=6;
type Point={x:number;y:number};
export type RaySeeker={heading:number;previousX:number;previousY:number};
export type RayOrb=Point&{age:number;rayOrb:RaySeeker};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};
export function raySignal(time:number){
 const t=Math.max(0,time),cycle=Math.floor(t/RAY_CYCLE),phase=t%RAY_CYCLE;
 return{cycle,phase,side:cycle%2?1:-1,fan:time>=0&&phase<RAY_FAN_AT?smooth((phase-.65)/1.15):0,seeker:time>=0&&phase<RAY_SEEKER_AT?smooth((phase-3.2)/.95):0};
}
export function rayRoot(time:number,reveal=1){return{x:.16*Math.sin(time*.41),y:3.15+.10*Math.sin(time*.53)+17*(1-smooth(reveal)),angle:.025*Math.sin(time*.47),sx:1+.012*Math.sin(time*.91),sy:1+.018*Math.sin(time*.91+.3)};}
export function rayVertex(x:number,y:number,time:number,reveal=1,out={x:0,y:0,z:0}){
 const span=clamp((Math.abs(x)-.9)/3.3),phase=time*.95-span*1.7,fold=.32+.68*smooth(reveal);
 out.x=x*(1-span*.10*(.5+.5*Math.sin(phase)))*(1-span*(1-fold));
 out.x+=.22*Math.sin(time*.8-y*.55)*smooth((y-1.5)/2.6)*Math.exp(-x*x*3);
 out.y=y+.10*span*Math.sin(phase+.6);
 out.z=.18+.16*Math.exp(-x*x/.6)+span*span*.68*Math.sin(phase);
 return out;
}
export function rayLocalOrgan(side:number){return{x:side*RAY_SIZE*.12,y:-RAY_SIZE*.10};}
export function rayOrgan(time:number,side:number){
 const local=rayLocalOrgan(side),p=rayVertex(local.x,local.y,time),r=rayRoot(time),c=Math.cos(r.angle),s=Math.sin(r.angle),k=22/(22-p.z);
 return{x:(r.x+p.x*r.sx*c-p.y*r.sy*s)*k,y:(r.y+p.x*r.sx*s+p.y*r.sy*c)*k};
}
export function rayShotPoint(p:Point&{z:number}){const k=22/(22-p.z);return{x:p.x*k,y:p.y*k};}
export function stepRaySeeker(orb:RayOrb,target:Point,dt:number){
 const s=orb.rayOrb;s.previousX=orb.x;s.previousY=orb.y;
 const aim=Math.atan2(target.x-orb.x,orb.y-target.y),delta=Math.atan2(Math.sin(aim-s.heading),Math.cos(aim-s.heading));
 s.heading+=Math.max(-.82*dt,Math.min(.82*dt,delta));
 orb.x+=Math.sin(s.heading)*2.25*dt;orb.y-=Math.cos(s.heading)*2.25*dt;
}
export function rayOrbEntry(orb:RayOrb,a:Point,b:Point){
 const x=a.x-orb.rayOrb.previousX,y=a.y-orb.rayOrb.previousY,dx=b.x-a.x-(orb.x-orb.rayOrb.previousX),dy=b.y-a.y-(orb.y-orb.rayOrb.previousY),r=RAY_SEEKER_RADIUS+.06;
 const c=x*x+y*y-r*r;if(c<=0)return 0;const aa=dx*dx+dy*dy,bb=x*dx+y*dy,d=bb*bb-aa*c;if(aa<1e-12||d<0)return Infinity;
 const t=(-bb-Math.sqrt(d))/aa;return t>=0&&t<=1?t:Infinity;
}
export function raySeekerBurst(point:Point,heading:number){return Array.from({length:8},(_,i)=>{
 const a=heading+i*Math.PI/4,dx=Math.sin(a),dy=-Math.cos(a);
 return{x:point.x+dx*.16,y:point.y+dy*.16,z:0,vx:dx*3.6,vy:dy*3.6,vz:0,planar:true};
});}

// First contact with the animated body, in the top-down flight plane.
export function rayBodyEntry(time:number,a:Point,b:Point){
 let first=Infinity;const root=rayRoot(time);
 for(const [x,y,rx,ry]of[[0,-.35,1.17,2],[0,-2.35,.35,.33],[-2.05,-.85,1.25,.8],[2.05,-.85,1.25,.8]]){
  const p=rayVertex(x,y,time),c=Math.cos(root.angle),s=Math.sin(root.angle),k=22/(22-p.z);
  const cx=(root.x+p.x*root.sx*c-p.y*root.sy*s)*k,cy=(root.y+p.x*root.sx*s+p.y*root.sy*c)*k;
  const ax=(a.x-cx)/rx,ay=(a.y-cy)/ry,dx=(b.x-a.x)/rx,dy=(b.y-a.y)/ry;
  const cc=ax*ax+ay*ay-1,aa=dx*dx+dy*dy,bb=ax*dx+ay*dy,disc=bb*bb-aa*cc;
  if(cc<=0)first=0;else if(aa>1e-12&&disc>=0){const t=(-bb-Math.sqrt(disc))/aa;if(t>=0&&t<=1)first=Math.min(first,t);}
 }return first;
}
