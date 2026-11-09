import {summerRiver,summerScroll,smooth} from './layout';
export type SummerCourse={kind:'scout'|'drone'|'hydra';formation:'vee'|'weave'|'loop'|'cross';slot:number;mirror:number;at:number};
export const SUMMER_AIR_POOL=24,SUMMER_HYDRA_POOL=2;
export function summerMotion(age:number,lane:number,c:SummerCourse,time:number){
  if(c.kind==='hydra'){const world=c.at*2.8+7;return{x:summerRiver(world),y:world-summerScroll(time),heading:0,bank:0};}
  const t=age-c.slot*.2;
  let x=lane,y=11-2.7*t;
  if(c.formation==='weave')x+=.85*Math.sin(t*1.3+c.slot*.65);
  if(c.formation==='cross')x=lane*Math.cos(Math.PI*smooth((t-.4)/3.6));
  if(c.formation==='loop'){const a=Math.PI*2*smooth((t-.8)/4.3);x=c.mirror*(1.9*Math.sin(a)+lane*.45);y=10-1.9*t+1.6*(Math.cos(a)-1);}
  return{x,y,heading:Math.PI,bank:.12*Math.sin(t*1.2+c.slot)};
}
const weapons=['cannon','homing','laser','omega'] as const;
export function hydraHead(time:number,side:number,size=1){
  const phase=time*.85+side*1.7;
  return{x:(side*1.22+(side?Math.sin(phase)*.13:0))*size,y:side?-.15*size+.12*Math.cos(phase):0};
}
type Point={x:number;y:number};
export function hydraHit(enemy:Point,time:number,start:Point,end:Point,padding=.05){
  for(const side of[-1,0,1]){
    const h=hydraHead(time,side),rx=.43+padding,ry=.7+padding;
    const x=(start.x-enemy.x-h.x)/rx,y=(start.y-enemy.y-h.y)/ry,dx=(end.x-start.x)/rx,dy=(end.y-start.y)/ry;
    const u=Math.max(0,Math.min(1,-(x*dx+y*dy)/(dx*dx+dy*dy||1)));
    if((x+u*dx)**2+(y+u*dy)**2<=1)return true;
  }
  return false;
}
export function hydraBeamEntry(enemy:Point,time:number,origin:Point){
  let entry=Infinity;
  for(const side of[-1,0,1]){
    const h=hydraHead(time,side),dx=(origin.x-enemy.x-h.x)/.48;
    if(Math.abs(dx)>1)continue;
    const reach=.75*Math.sqrt(1-dx*dx),center=enemy.y+h.y;
    if(center+reach>=origin.y)entry=Math.min(entry,Math.max(origin.y,center-reach));
  }
  return entry;
}
export const summerWaves=Array.from({length:22},(_,i)=>{
  const hydra=i===5||i===12||i===18,at=2+i*4.25;
  return{time:at,lanes:hydra?[0]:[-2,0,2],carrier:hydra?0:1,drop:weapons[i%4],summer:{kind:hydra?'hydra' as const:i%3===0?'drone' as const:'scout' as const,
    formation:(['vee','cross','loop','weave'] as const)[i%4],mirror:i%2?1:-1,at}};
});
