import {SUMMER_DURATION,SUMMER_APPROACH,SUMMER_DISTANCE,summerRiver,summerScroll,smooth} from './layout';
export const HYDRA_SIDES=[-1,0,1] as const;
export type HydraSide=typeof HYDRA_SIDES[number];
type Triple=[number,number,number];
export type HydraState={hp:Triple;brokenAt:Triple};
export const HYDRA_HEAD_HP=5,HYDRA_BOSS_HEAD_HP=34,HYDRA_BOSS_SIZE=1.85;
export const SUMMER_HP = HYDRA_SIDES.length * HYDRA_BOSS_HEAD_HP;
export const HYDRA_BODY_Y=3.9,HYDRA_BODY_DEPTH=-16.2,HYDRA_ROOT_Y=2.9,HYDRA_HEAD_Z=.2;
export function createHydraState(hp=HYDRA_HEAD_HP):HydraState{return{hp:[hp,hp,hp],brokenAt:[-1,-1,-1]};}
export function hydraAlive(state:HydraState|undefined,side:HydraSide){return !state||state.hp[side+1]>0;}
export function damageHydraHead(state:HydraState,side:HydraSide,damage:number,time:number){
  const i=side+1,before=state.hp[i];state.hp[i]=Math.max(0,before-damage);
  if(before>0&&state.hp[i]===0)state.brokenAt[i]=time;
  return before-state.hp[i];
}
export function hydraHead(time:number,side:number,size=1){
  const phase=time*.85+side*1.7;
  return{x:(side*1.22+(side?Math.sin(phase)*.13:0))*size,y:(side?-.15+.12*Math.cos(phase):0)*size};
}
export function hydraBossHead(time:number,side:HydraSide){
  const h=hydraHead(SUMMER_DURATION+SUMMER_APPROACH+time,side,HYDRA_BOSS_SIZE);
  return{x:h.x,y:4.2+h.y};
}
export function nearestHydraHead(state:HydraState,x:number,boss=false):HydraSide{
  let chosen:HydraSide=0,distance=Infinity;
  for(const side of[0,-1,1] as const)if(hydraAlive(state,side)){
    const d=Math.abs(x-side*1.22*(boss?HYDRA_BOSS_SIZE:1));if(d<distance){distance=d;chosen=side;}
  }
  return chosen;
}
type Point={x:number;y:number};
type Hydra=Point&{hydra?:HydraState};
// At entry, register the foreground heads to the distant body's projected front.
// Blend out before combat; the original neck roots and settled pose are unchanged.
export function hydraEntryHead(head:Point,origin:Point,bodyX:number){
  const blend=smooth((origin.y-2)/4),projection=(SUMMER_DISTANCE-HYDRA_HEAD_Z)/(SUMMER_DISTANCE-HYDRA_BODY_DEPTH);
  if(blend===0)return head;
  return{x:head.x+((origin.x+bodyX)*projection-origin.x)*blend,
    y:head.y*(1-blend)+((origin.y+HYDRA_ROOT_Y)*projection-origin.y-.62)*blend};
}
export function riverHydraHead(enemy:Point,time:number,side:number){
  if(enemy.y<=2)return hydraHead(time,side);
  const bodyX=summerRiver(enemy.y+summerScroll(time)+HYDRA_BODY_Y)-enemy.x;
  return hydraEntryHead(hydraHead(time,side),enemy,bodyX);
}
export function damageRiverHydra(enemy:Hydra&{hp:number;hitPoint?:Point&{z?:number}},time:number,damage:number,head?:HydraSide,laser=false){
  const state=enemy.hydra??=createHydraState(enemy.hp/3);
  if(head===undefined){for(const side of HYDRA_SIDES)damageHydraHead(state,side,damage,time);}
  else{const applied=damageHydraHead(state,head,damage,time);if(applied>0&&!laser){const p=riverHydraHead(enemy,time,head);enemy.hitPoint={x:enemy.x+p.x,y:enemy.y+p.y,z:.8};}}
  enemy.hp=state.hp[0]+state.hp[1]+state.hp[2];
}
export function closestRiverHead(enemy:Hydra,time:number,origin:Point,limit:number){
  let point:Point|undefined;
  for(const side of HYDRA_SIDES){if(!hydraAlive(enemy.hydra,side))continue;const h=riverHydraHead(enemy,time,side),p={x:enemy.x+h.x,y:enemy.y+h.y};if(p.y<=origin.y)continue;const d=(p.x-origin.x)**2+(p.y-origin.y)**2;if(d<limit){limit=d;point=p;}}
  return point?{point,distance:limit}:undefined;
}
// First intersection of a swept segment with the visible head ellipse.
function entry(center:Point,start:Point,end:Point,rx:number,ry:number){
  const x=(start.x-center.x)/rx,y=(start.y-center.y)/ry,dx=(end.x-start.x)/rx,dy=(end.y-start.y)/ry;
  const c=x*x+y*y-1;if(c<=0)return 0;
  const a=dx*dx+dy*dy,b=x*dx+y*dy,disc=b*b-a*c;if(a<1e-12||disc<0)return Infinity;
  const t=(-b-Math.sqrt(disc))/a;return t>=0&&t<=1?t:Infinity;
}
export function hydraContact(enemy:Hydra,time:number,start:Point,end:Point,padding=.05,skip?:ReadonlySet<HydraSide>){
  let side:HydraSide|undefined,first=Infinity;
  for(const s of HYDRA_SIDES){
    if(!hydraAlive(enemy.hydra,s)||skip?.has(s))continue;
    const h=riverHydraHead(enemy,time,s),t=entry({x:enemy.x+h.x,y:enemy.y+h.y},start,end,.43+padding,.7+padding);
    if(t<first){first=t;side=s;}
  }
  return side===undefined?undefined:{side,entry:first};
}
export function hydraHit(enemy:Hydra,time:number,start:Point,end:Point,padding=.05){return hydraContact(enemy,time,start,end,padding)!==undefined;}
export function hydraBeamContact(enemy:Hydra,time:number,origin:Point){
  const hit=hydraContact(enemy,time,origin,{x:origin.x,y:9});return hit?{side:hit.side,entry:origin.y+(9-origin.y)*hit.entry}:undefined;
}
export function hydraBeamEntry(enemy:Hydra,time:number,origin:Point){return hydraBeamContact(enemy,time,origin)?.entry??Infinity;}
export function hydraBossContact(state:HydraState,time:number,start:Point,end=start,padding=0,skip?:ReadonlySet<HydraSide>){
  let side:HydraSide|undefined,first=Infinity;
  for(const s of HYDRA_SIDES){
    if(!hydraAlive(state,s)||skip?.has(s))continue;
    const t=entry(hydraBossHead(time,s),start,end,.48*HYDRA_BOSS_SIZE+padding,.75*HYDRA_BOSS_SIZE+padding);
    if(t<first){side=s;first=t;}
  }
  return side===undefined?undefined:{side,entry:first};
}
