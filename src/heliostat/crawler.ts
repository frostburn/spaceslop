import {heliostatScroll,HELIOSTAT_SPEED,HELIOSTAT_DISTANCE} from './combat';

export const CRAWLER_HP=6,CRAWLER_POOL=2,CRAWLER_RAIL_X=4.08*.82,CRAWLER_RAIL_Z=-5.28;
export const CRAWLER_WARNING=2.6,CRAWLER_FIRE=3.8,CRAWLER_SWEEP=1.7;
export const crawlerSites=[{at:24,side:-1},{at:42,side:1},{at:60,side:-1},{at:85,side:1}];
export type CrawlerState={site:number;aimY?:number};
type Point={x:number;y:number};
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(v:number)=>{const t=clamp(v);return t*t*(3-2*t);};

export function crawlerPose(state:CrawlerState,time:number){
  const site=crawlerSites[state.site],age=time-site.at+4,lift=smooth((age-.3)/1.7);
  const travel=2.5*(1-smooth(age/2.1))-.8*Math.max(0,age-7);
  const physicalY=site.at*HELIOSTAT_SPEED+travel-heliostatScroll(time),z=CRAWLER_RAIL_Z+.45+(-CRAWLER_RAIL_Z-.45)*lift;
  const head={x:site.side*(CRAWLER_RAIL_X-.3*lift),y:physicalY,z};
  const projection=1/(1-z/(HELIOSTAT_DISTANCE*Math.cos(.46)));
  const x=head.x*projection,y=(head.y+Math.tan(.46)*z)*projection;
  const warning=age>=CRAWLER_WARNING&&age<CRAWLER_FIRE,hot=age>=CRAWLER_FIRE&&age<CRAWLER_FIRE+CRAWLER_SWEEP;
  const aimY=state.aimY??clamp(y-4,-6,1.5),sweep=smooth((age-CRAWLER_FIRE)/CRAWLER_SWEEP);
  const start={x:site.side*2.6,y:aimY},end={x:-site.side*.35,y:aimY};
  const target={x:start.x+(end.x-start.x)*sweep,y:aimY};
  const length=Math.hypot(target.x-head.x,target.y-head.y),dx=(target.x-head.x)/Math.max(.01,length),dy=(target.y-head.y)/Math.max(.01,length);
  const muzzle={x:head.x+dx*.43,y:head.y+dy*.43};
  return{x,y,head,physicalY,age,side:site.side,lift,travel,warning,hot,start,end,target,muzzle,
    heading:Math.atan2(dy,dx),charge:warning?clamp((age-CRAWLER_WARNING)/(CRAWLER_FIRE-CRAWLER_WARNING)):hot?1:0,
    brace:smooth((age-2.1)/.4)*(1-smooth((age-5.7)/.7))};
}
export function stepCrawler(state:CrawlerState,time:number,player:Point){
  const p=crawlerPose(state,time);
  if(state.aimY===undefined&&(p.warning||p.hot))state.aimY=clamp(player.y,-6,Math.min(1.5,p.y-1.5));
  return crawlerPose(state,time);
}
function distance(p:Point,a:Point,b:Point){
  const x=b.x-a.x,y=b.y-a.y,t=clamp(((p.x-a.x)*x+(p.y-a.y)*y)/Math.max(.0001,x*x+y*y));
  return Math.hypot(p.x-a.x-t*x,p.y-a.y-t*y);
}
/** The cutter sits on z=0; its complete visible segment is damaging. */
export function crawlerHits(state:CrawlerState,time:number,previous:number,player:Point){
  const p=crawlerPose(state,time);if(!p.hot||state.aimY===undefined)return false;
  const old=crawlerPose(state,Math.max(previous,crawlerSites[state.site].at-4+CRAWLER_FIRE));
  return distance(player,p.muzzle,p.target)<.34||distance(player,old.muzzle,old.target)<.34;
}
